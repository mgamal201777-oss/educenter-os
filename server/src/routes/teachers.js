const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');

router.use(tenantScope);

/** GET /api/teachers — list with workload stats */
router.get('/', requireRole('owner', 'admin', 'branch_manager', 'finance', 'reception'), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT t.*,
        (SELECT count(*) FROM groups g WHERE g.teacher_id = t.id AND g.status = 'active') AS group_count,
        (SELECT count(*) FROM enrollments e JOIN groups g ON g.id = e.group_id
          WHERE g.teacher_id = t.id AND e.status = 'active') AS student_count,
        COALESCE((SELECT array_agg(DISTINCT s.name) FROM teacher_subjects ts
          JOIN subjects s ON s.id = ts.subject_id WHERE ts.teacher_id = t.id), '{}') AS subject_names
      FROM teachers t WHERE t.tenant_id = $1 ORDER BY t.name`, [req.tid]);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/teachers — create teacher (+ optional PWA login) */
router.post('/', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { name, mobile, email, notes, subject_ids = [], create_login, password } = req.body;
    let userId = null;
    if (create_login !== false) {
      const u = await query(
        `INSERT INTO users (tenant_id, role, full_name, mobile, email, username, password_hash, locale)
         VALUES ($1,'teacher',$2,$3,$4,$5,$6,'ar') RETURNING id`,
        [req.tid, name, mobile, email, `t_${crypto.randomBytes(4).toString('hex')}`,
         bcrypt.hashSync(password || 'teacher123', 10)]
      );
      userId = u.rows[0].id;
    }
    const t = await query(
      `INSERT INTO teachers (tenant_id, user_id, name, mobile, email, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.tid, userId, name, mobile, email, notes]
    );
    for (const sid of subject_ids) {
      await query('INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [t.rows[0].id, sid]);
    }
    await audit(req.tid, req.user.id, 'create', 'teacher', t.rows[0].id, null, { name }, req.ip);
    res.status(201).json(t.rows[0]);
  } catch (e) { next(e); }
});

/** PATCH /api/teachers/:id */
router.patch('/:id', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const allowed = ['name', 'mobile', 'email', 'notes', 'status'];
    const sets = [], vals = [];
    let i = 2;
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = $${i++}`); vals.push(v);
    }
    if (Array.isArray(req.body.subject_ids)) {
      await query('DELETE FROM teacher_subjects WHERE teacher_id = $1', [req.params.id]);
      for (const sid of req.body.subject_ids) {
        await query('INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [req.params.id, sid]);
      }
    }
    if (!sets.length) return res.json({ ok: true });
    vals.push(Number(req.params.id));
    const { rows } = await query(`UPDATE teachers SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $${i} RETURNING *`, vals);
    if (!rows[0]) return res.status(404).json({ error: 'Teacher not found' });
    await audit(req.tid, req.user.id, 'update', 'teacher', req.params.id, null, rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** GET /api/teachers/:id — profile + groups + schedule */
router.get('/:id', requireRole('owner', 'admin', 'branch_manager', 'reception', 'teacher'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM teachers WHERE tenant_id = $1 AND id = $2', [req.tid, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Teacher not found' });
    const [groups, subjects] = await Promise.all([
      query(`SELECT g.*, b.name AS branch_name, sub.name AS subject_name, gr.name AS grade_name,
              (SELECT count(*) FROM enrollments e WHERE e.group_id = g.id AND e.status = 'active') AS enrolled
             FROM groups g JOIN branches b ON b.id = g.branch_id JOIN subjects sub ON sub.id = g.subject_id
             JOIN grade_levels gr ON gr.id = g.grade_level_id
             WHERE g.teacher_id = $1 AND g.tenant_id = $2 ORDER BY g.name`, [req.params.id, req.tid]),
      query(`SELECT s.* FROM teacher_subjects ts JOIN subjects s ON s.id = ts.subject_id WHERE ts.teacher_id = $1`, [req.params.id]),
    ]);
    res.json({ ...rows[0], groups: groups.rows, subjects: subjects.rows });
  } catch (e) { next(e); }
});

module.exports = router;
