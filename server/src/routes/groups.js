const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');

router.use(tenantScope);

/** GET /api/groups — list with schedule + capacity */
router.get('/', async (req, res, next) => {
  try {
    if (req.user.role === 'teacher') {
      // teachers: only their own groups
      const { rows } = await query(GROUP_QUERY + ' WHERE g.tenant_id = $1 AND g.teacher_id = $2 ORDER BY g.name',
        [req.tid, (await query('SELECT id FROM teachers WHERE user_id = $1 AND tenant_id = $2', [req.user.id, req.tid])).rows[0]?.id]);
      return res.json(rows);
    }
    const { branch_id, term_id, teacher_id, grade_level_id } = req.query;
    const where = ['g.tenant_id = $1'];
    const vals = [req.tid];
    let i = 2;
    if (branch_id) { where.push(`g.branch_id = $${i++}`); vals.push(branch_id); }
    if (term_id) { where.push(`g.term_id = $${i++}`); vals.push(term_id); }
    if (teacher_id) { where.push(`g.teacher_id = $${i++}`); vals.push(teacher_id); }
    if (grade_level_id) { where.push(`g.grade_level_id = $${i++}`); vals.push(grade_level_id); }
    if (req.user.role === 'branch_manager' && req.user.branch_id) {
      where.push(`g.branch_id = $${i++}`); vals.push(req.user.branch_id);
    }
    const { rows } = await query(GROUP_QUERY + ` WHERE ${where.join(' AND ')} ORDER BY g.name`, vals);
    res.json(rows);
  } catch (e) { next(e); }
});

const GROUP_QUERY = `
  SELECT g.*,
    b.name AS branch_name, sub.name AS subject_name, gr.name AS grade_name, gr.stage,
    t.name AS teacher_name, c.name AS classroom_name, y.name AS year_name, tm.name AS term_name,
    (SELECT count(*) FROM enrollments e WHERE e.group_id = g.id AND e.status = 'active') AS enrolled,
    COALESCE((SELECT json_agg(json_build_object('day', gs.day_of_week, 'start', gs.start_time, 'end', gs.end_time) ORDER BY gs.day_of_week)
      FROM group_schedules gs WHERE gs.group_id = g.id), '[]') AS schedule
  FROM groups g
  JOIN branches b ON b.id = g.branch_id
  JOIN subjects sub ON sub.id = g.subject_id
  JOIN grade_levels gr ON gr.id = g.grade_level_id
  JOIN academic_years y ON y.id = g.academic_year_id
  JOIN terms tm ON tm.id = g.term_id
  LEFT JOIN teachers t ON t.id = g.teacher_id
  LEFT JOIN classrooms c ON c.id = g.classroom_id`;

/** GET /api/groups/:id — detail + student list */
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(GROUP_QUERY + ' WHERE g.tenant_id = $1 AND g.id = $2', [req.tid, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role === 'teacher') {
      const tid = (await query('SELECT id FROM teachers WHERE user_id = $1 AND tenant_id = $2', [req.user.id, req.tid])).rows[0]?.id;
      if (rows[0].teacher_id !== tid) return res.status(403).json({ error: 'Not your group' });
    }
    const students = await query(
      `SELECT s.id, s.name, s.student_code, e.status AS enrollment_status, e.enrolled_at
       FROM enrollments e JOIN students s ON s.id = e.student_id
       WHERE e.group_id = $1 AND e.tenant_id = $2 ORDER BY s.name`, [req.params.id, req.tid]);
    res.json({ ...rows[0], students: students.rows });
  } catch (e) { next(e); }
});

/** POST /api/groups — create with schedule + conflict detection */
router.post('/', requireRole('owner', 'admin', 'branch_manager'), async (req, res, next) => {
  try {
    const { branch_id, academic_year_id, term_id, grade_level_id, subject_id, teacher_id, classroom_id,
      name, max_capacity = 30, schedule = [] } = req.body;

    const conflicts = await detectConflicts(req.tid, { teacher_id, classroom_id, group_id: null, schedule });
    if (conflicts.length) return res.status(409).json({ error: 'Schedule conflict', conflicts });

    const { rows } = await query(
      `INSERT INTO groups (tenant_id, branch_id, academic_year_id, term_id, grade_level_id, subject_id,
         teacher_id, classroom_id, name, max_capacity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.tid, branch_id, academic_year_id, term_id, grade_level_id, subject_id, teacher_id || null,
       classroom_id || null, name, max_capacity]
    );
    const group = rows[0];
    for (const s of schedule) {
      await query('INSERT INTO group_schedules (tenant_id, group_id, day_of_week, start_time, end_time) VALUES ($1,$2,$3,$4,$5)',
        [req.tid, group.id, s.day_of_week, s.start_time, s.end_time]);
    }
    await audit(req.tid, req.user.id, 'create', 'group', group.id, null, { name }, req.ip);
    res.status(201).json(group);
  } catch (e) { next(e); }
});

/** PATCH /api/groups/:id — incl. schedule replace + conflict check */
router.patch('/:id', requireRole('owner', 'admin', 'branch_manager'), async (req, res, next) => {
  try {
    const allowed = ['name', 'teacher_id', 'classroom_id', 'max_capacity', 'status'];
    const sets = [], vals = [];
    let i = 2;
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = $${i++}`); vals.push(v);
    }
    if (Array.isArray(req.body.schedule)) {
      const current = (await query(
        `SELECT g.teacher_id, g.classroom_id FROM groups g WHERE g.id = $1 AND g.tenant_id = $2`,
        [req.params.id, req.tid])).rows[0];
      const conflicts = await detectConflicts(req.tid, {
        teacher_id: req.body.teacher_id ?? current?.teacher_id,
        classroom_id: req.body.classroom_id ?? current?.classroom_id,
        group_id: Number(req.params.id),
        schedule: req.body.schedule,
      });
      if (conflicts.length) return res.status(409).json({ error: 'Schedule conflict', conflicts });
    }
    if (sets.length) {
      vals.push(Number(req.params.id));
      const { rows } = await query(`UPDATE groups SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $${i} RETURNING *`, vals);
      if (!rows[0]) return res.status(404).json({ error: 'Group not found' });
      await audit(req.tid, req.user.id, 'update', 'group', req.params.id, null, rows[0], req.ip);
    }
    if (Array.isArray(req.body.schedule)) {
      await query('DELETE FROM group_schedules WHERE group_id = $1 AND tenant_id = $2', [req.params.id, req.tid]);
      for (const s of req.body.schedule) {
        await query('INSERT INTO group_schedules (tenant_id, group_id, day_of_week, start_time, end_time) VALUES ($1,$2,$3,$4,$5)',
          [req.tid, Number(req.params.id), s.day_of_week, s.start_time, s.end_time]);
      }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Detect teacher/classroom double-booking */
async function detectConflicts(tenantId, { teacher_id, classroom_id, group_id, schedule }) {
  if (!schedule?.length) return [];
  const conflicts = [];
  for (const s of schedule) {
    if (teacher_id) {
      const { rows } = await query(
        `SELECT g.name, gs.start_time, gs.end_time FROM group_schedules gs
         JOIN groups g ON g.id = gs.group_id
         WHERE gs.tenant_id = $1 AND g.teacher_id = $2 AND gs.day_of_week = $3
           AND ($4 < gs.end_time AND $5 > gs.start_time)
           AND ($6::int IS NULL OR g.id != $6::int)`,
        [tenantId, teacher_id, s.day_of_week, s.start_time, s.end_time, group_id]
      );
      for (const r of rows) conflicts.push({ type: 'teacher', detail: `Teacher busy in "${r.name}" ${r.start_time}-${r.end_time}` });
    }
    if (classroom_id) {
      const { rows } = await query(
        `SELECT g.name, gs.start_time, gs.end_time FROM group_schedules gs
         JOIN groups g ON g.id = gs.group_id
         WHERE gs.tenant_id = $1 AND g.classroom_id = $2 AND gs.day_of_week = $3
           AND ($4 < gs.end_time AND $5 > gs.start_time)
           AND ($6::int IS NULL OR g.id != $6::int)`,
        [tenantId, classroom_id, s.day_of_week, s.start_time, s.end_time, group_id]
      );
      for (const r of rows) conflicts.push({ type: 'classroom', detail: `Classroom busy: "${r.name}" ${r.start_time}-${r.end_time}` });
    }
  }
  return conflicts;
}

module.exports = router;
