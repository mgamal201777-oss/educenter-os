const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');

router.use(tenantScope);
const canManage = requireRole('owner', 'admin', 'branch_manager', 'reception');
const canView = requireRole('owner', 'admin', 'branch_manager', 'reception', 'finance', 'teacher');

/** GET /api/schedules — weekly timetable (staff view) */
router.get('/', canView, async (req, res, next) => {
  try {
    const { branch_id, day, group_id } = req.query;
    const where = ['g.tenant_id = $1'];
    const vals = [req.tid];
    let i = 2;
    if (branch_id) { where.push(`g.branch_id = $${i++}`); vals.push(branch_id); }
    if (day !== undefined) { where.push(`gs.day_of_week = $${i++}`); vals.push(day); }
    if (group_id) { where.push(`gs.group_id = $${i++}`); vals.push(group_id); }
    if (req.user.role === 'branch_manager' && req.user.branch_id) {
      where.push(`g.branch_id = $${i++}`); vals.push(req.user.branch_id);
    }
    const { rows } = await query(`
      SELECT gs.id, gs.day_of_week, gs.start_time, gs.end_time,
        g.id AS group_id, g.name AS group_name, g.teacher_id, g.classroom_id,
        b.id AS branch_id, b.name AS branch_name,
        sub.name AS subject_name, t.name AS teacher_name, c.name AS classroom_name
      FROM group_schedules gs
      JOIN groups g ON g.id = gs.group_id
      JOIN branches b ON b.id = g.branch_id
      JOIN subjects sub ON sub.id = g.subject_id
      LEFT JOIN teachers t ON t.id = g.teacher_id
      LEFT JOIN classrooms c ON c.id = g.classroom_id
      WHERE ${where.join(' AND ')}
      ORDER BY gs.day_of_week, gs.start_time`, vals);
    res.json(rows);
  } catch (e) { next(e); }
});

/** Detect clashes for a session (teacher, room, group) — same day & overlapping time. */
async function findConflicts(tid, day, start, end, { teacherId, classroomId, groupId, excludeId }) {
  const rows = (await query(`
    SELECT gs.id, gs.start_time, gs.end_time,
      g.id AS group_id, g.name AS group_name, g.teacher_id, g.classroom_id,
      t.name AS teacher_name, c.name AS classroom_name
    FROM group_schedules gs
    JOIN groups g ON g.id = gs.group_id
    LEFT JOIN teachers t ON t.id = g.teacher_id
    LEFT JOIN classrooms c ON c.id = g.classroom_id
    WHERE gs.tenant_id = $1 AND gs.day_of_week = $2
      AND gs.start_time < $4::time AND gs.end_time > $3::time
      AND ($5::int IS NULL OR gs.id != $5)`,
    [tid, day, start, end, excludeId || null])).rows;
  const clashes = [];
  for (const r of rows) {
    if (teacherId && r.teacher_id === Number(teacherId)) {
      clashes.push({ type: 'teacher', with: r.group_name, detail: `Teacher busy ${r.start_time}-${r.end_time}` });
    }
    if (classroomId && r.classroom_id === Number(classroomId)) {
      clashes.push({ type: 'room', with: r.group_name, detail: `Room busy ${r.start_time}-${r.end_time}` });
    }
    if (groupId && r.group_id === Number(groupId)) {
      clashes.push({ type: 'group', with: r.subject_name || r.group_name, detail: `Group already has a session ${r.start_time}-${r.end_time}` });
    }
  }
  return clashes;
}

/** GET /api/schedules/conflicts?day=&start=&end=&teacher_id=&classroom_id=&group_id= */
router.get('/conflicts', canView, async (req, res, next) => {
  try {
    const { day, start, end, teacher_id, classroom_id, group_id, exclude } = req.query;
    if (day === undefined || !start || !end) return res.status(400).json({ error: 'day, start and end are required' });
    res.json(await findConflicts(req.tid, day, start, end, {
      teacherId: teacher_id, classroomId: classroom_id, groupId: group_id, excludeId: exclude,
    }));
  } catch (e) { next(e); }
});

/** POST /api/schedules — add a weekly session */
router.post('/', canManage, async (req, res, next) => {
  try {
    const { group_id, day_of_week, start_time, end_time, teacher_id, classroom_id, check_conflicts = true } = req.body;
    if (!group_id || day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ error: 'group_id, day_of_week, start_time and end_time are required' });
    }
    if (end_time <= start_time) return res.status(400).json({ error: 'end_time must be after start_time' });
    const grp = (await query('SELECT * FROM groups WHERE id = $1 AND tenant_id = $2', [group_id, req.tid])).rows[0];
    if (!grp) return res.status(404).json({ error: 'Group not found' });

    // optional teacher/room override for this group
    if (teacher_id !== undefined || classroom_id !== undefined) {
      await query(
        `UPDATE groups SET teacher_id = COALESCE($2, teacher_id), classroom_id = $3 WHERE id = $1 AND tenant_id = $4`,
        [group_id, teacher_id || null, classroom_id || null, req.tid]);
    }
    const effTeacher = teacher_id !== undefined ? teacher_id : grp.teacher_id;
    const effRoom = classroom_id !== undefined ? classroom_id : grp.classroom_id;

    let conflicts = [];
    if (check_conflicts) {
      conflicts = await findConflicts(req.tid, day_of_week, start_time, end_time, {
        teacherId: effTeacher, classroomId: effRoom, groupId: group_id,
      });
      if (conflicts.length && !req.body.force) {
        return res.status(409).json({ error: 'Schedule conflict detected', conflicts });
      }
    }
    const { rows } = await query(
      `INSERT INTO group_schedules (tenant_id, group_id, day_of_week, start_time, end_time)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.tid, group_id, day_of_week, start_time, end_time]);
    await audit(req.tid, req.user.id, 'create', 'group_schedule', rows[0].id, null, rows[0], req.ip);
    res.status(201).json({ ...rows[0], _conflicts_overridden: conflicts.length > 0 ? conflicts : undefined });
  } catch (e) { next(e); }
});

/** PATCH /api/schedules/:id — move/resize a session */
router.patch('/:id', canManage, async (req, res, next) => {
  try {
    const old = (await query(
      `SELECT gs.*, g.teacher_id, g.classroom_id FROM group_schedules gs
       JOIN groups g ON g.id = gs.group_id WHERE gs.id = $1 AND gs.tenant_id = $2`,
      [req.params.id, req.tid])).rows[0];
    if (!old) return res.status(404).json({ error: 'Session not found' });
    const { day_of_week, start_time, end_time, teacher_id, classroom_id } = req.body;
    const day = day_of_week ?? old.day_of_week;
    const start = start_time || old.start_time;
    const end = end_time || old.end_time;
    if (end <= start) return res.status(400).json({ error: 'end_time must be after start_time' });

    if (teacher_id !== undefined || classroom_id !== undefined) {
      await query(
        `UPDATE groups SET teacher_id = COALESCE($2, teacher_id), classroom_id = $3 WHERE id = $1 AND tenant_id = $4`,
        [old.group_id, teacher_id || null, classroom_id || null, req.tid]);
    }

    if (!req.body.force) {
      const conflicts = await findConflicts(req.tid, day, start, end, {
        teacherId: teacher_id !== undefined ? teacher_id : old.teacher_id,
        classroomId: classroom_id !== undefined ? classroom_id : old.classroom_id,
        groupId: old.group_id, excludeId: old.id,
      });
      if (conflicts.length) return res.status(409).json({ error: 'Schedule conflict detected', conflicts });
    }
    const { rows } = await query(
      `UPDATE group_schedules SET day_of_week = $2, start_time = $3, end_time = $4
       WHERE id = $1 AND tenant_id = $5 RETURNING *`,
      [old.id, day, start, end, req.tid]);
    await audit(req.tid, req.user.id, 'update', 'group_schedule', old.id, old, rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** DELETE /api/schedules/:id — remove a session */
router.delete('/:id', canManage, async (req, res, next) => {
  try {
    const old = (await query('SELECT * FROM group_schedules WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid])).rows[0];
    if (!old) return res.status(404).json({ error: 'Session not found' });
    await query('DELETE FROM group_schedules WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid]);
    await audit(req.tid, req.user.id, 'delete', 'group_schedule', old.id, old, null, req.ip);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
