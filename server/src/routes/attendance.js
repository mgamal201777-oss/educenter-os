const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');

router.use(tenantScope);

/** Helper: resolve teacher id for the logged-in teacher user */
async function myTeacherId(req) {
  const { rows } = await query('SELECT id FROM teachers WHERE user_id = $1 AND tenant_id = $2', [req.user.id, req.tid]);
  return rows[0]?.id;
}

/** Helper: verify teacher owns a group */
async function teacherOwnsGroup(req, groupId) {
  const tid = await myTeacherId(req);
  if (!tid) return false;
  const { rows } = await query('SELECT 1 FROM groups WHERE id = $1 AND tenant_id = $2 AND teacher_id = $3', [groupId, req.tid, tid]);
  return !!rows[0];
}

/** GET /api/attendance/today — teacher: today's classes with attendance state */
router.get('/today', requireRole('teacher', 'owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    let where = 'g.tenant_id = $1';
    const vals = [req.tid];
    if (req.user.role === 'teacher') {
      const tid = await myTeacherId(req);
      if (!tid) return res.json([]);
      where += ' AND g.teacher_id = $2';
      vals.push(tid);
    }
    const dow = new Date().getDay(); // 0=Sunday (Egypt week starts Sunday)
    const { rows } = await query(`
      SELECT g.id, g.name, sub.name AS subject_name, b.name AS branch_name, t.name AS teacher_name,
        gs.start_time, gs.end_time,
        (SELECT count(*) FROM enrollments e WHERE e.group_id = g.id AND e.status = 'active') AS student_count,
        (SELECT count(*) FROM attendance a WHERE a.group_id = g.id AND a.session_date = CURRENT_DATE) AS attendance_taken
      FROM groups g
      JOIN group_schedules gs ON gs.group_id = g.id AND gs.day_of_week = $${vals.length + 1}
      JOIN subjects sub ON sub.id = g.subject_id
      JOIN branches b ON b.id = g.branch_id
      LEFT JOIN teachers t ON t.id = g.teacher_id
      WHERE ${where} AND g.status = 'active'
      ORDER BY gs.start_time`, [...vals, dow]);
    res.json(rows);
  } catch (e) { next(e); }
});

/** GET /api/attendance/group/:groupId/:date — roster with today's attendance for marking */
router.get('/group/:groupId/:date', requireRole('teacher', 'owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req, req.params.groupId))) {
      return res.status(403).json({ error: 'Not your group' });
    }
    const { rows } = await query(`
      SELECT s.id, s.name, s.student_code, e.status AS enrollment_status,
        a.id AS attendance_id, a.status AS attendance_status, a.method
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      LEFT JOIN attendance a ON a.student_id = s.id AND a.group_id = e.group_id AND a.session_date = $2
      WHERE e.group_id = $1 AND e.tenant_id = $3 AND e.status = 'active'
      ORDER BY s.name`, [req.params.groupId, req.params.date, req.tid]);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/attendance/mark — bulk mark from class list (upsert) */
router.post('/mark', requireRole('teacher', 'owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const { group_id, session_date, records = [], method = 'class_list' } = req.body;
    if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req, group_id))) {
      return res.status(403).json({ error: 'Not your group' });
    }
    let marked = 0, absentList = [];
    for (const r of records) {
      const { rows } = await query(
        `INSERT INTO attendance (tenant_id, group_id, student_id, session_date, status, method, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (group_id, student_id, session_date) DO NOTHING
         RETURNING id`, [req.tid, group_id, r.student_id, session_date, r.status, method, req.user.id]);
      if (rows[0]) {
        marked++;
        if (r.status === 'absent' || r.status === 'late') absentList.push(r.student_id);
      }
    }
    // notify parents of absent/late students
    for (const sid of absentList) {
      await notifyParentOfAbsence(req.tid, group_id, sid, session_date, req);
    }
    await audit(req.tid, req.user.id, 'create', 'attendance', group_id, null, { session_date, count: marked }, req.ip);
    res.json({ marked });
  } catch (e) { next(e); }
});

/** POST /api/attendance/mark-all-present */
router.post('/mark-all-present', requireRole('teacher', 'owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const { group_id, session_date } = req.body;
    if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req, group_id))) {
      return res.status(403).json({ error: 'Not your group' });
    }
    const roster = await query(
      `SELECT s.id FROM enrollments e JOIN students s ON s.id = e.student_id
       WHERE e.group_id = $1 AND e.tenant_id = $2 AND e.status = 'active'`, [group_id, req.tid]);
    let marked = 0;
    for (const r of roster.rows) {
      const ins = await query(
        `INSERT INTO attendance (tenant_id, group_id, student_id, session_date, status, method, recorded_by)
         VALUES ($1,$2,$3,$4,'present','class_list',$5)
         ON CONFLICT (group_id, student_id, session_date) DO NOTHING RETURNING id`,
        [req.tid, group_id, r.id, session_date, req.user.id]);
      if (ins.rows[0]) marked++;
    }
    await audit(req.tid, req.user.id, 'create', 'attendance', group_id, null, { session_date, count: marked, all_present: true }, req.ip);
    res.json({ marked });
  } catch (e) { next(e); }
});

/** PATCH /api/attendance/:id — edit a record (audited, permission required) */
router.patch('/:id', requireRole('owner', 'admin', 'branch_manager', 'teacher'), async (req, res, next) => {
  try {
    const old = await query('SELECT * FROM attendance WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Record not found' });
    if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req, old.rows[0].group_id))) {
      return res.status(403).json({ error: 'Not your group' });
    }
    const { rows } = await query(
      `UPDATE attendance SET status = $1, edited_by = $2, edited_at = now(), method = method || '+edit'
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [req.body.status, req.user.id, req.params.id, req.tid]);
    await audit(req.tid, req.user.id, 'attendance_edit', 'attendance', req.params.id, old.rows[0], rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** POST /api/attendance/qr — scan student QR token */
router.post('/qr', requireRole('teacher', 'owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const { token, group_id, session_date } = req.body;
    const { rows } = await query(
      'SELECT s.*, e.status AS enrollment_status FROM students s JOIN enrollments e ON e.student_id = s.id AND e.group_id = $2 WHERE s.qr_token = $1 AND s.tenant_id = $3',
      [token, group_id, req.tid]
    );
    if (!rows[0]) return res.status(404).json({ error: 'QR not recognized for this group' });
    const marked = await query(
      `INSERT INTO attendance (tenant_id, group_id, student_id, session_date, status, method, recorded_by)
       VALUES ($1,$2,$3,$4,'present','qr',$5)
       ON CONFLICT (group_id, student_id, session_date) DO NOTHING RETURNING id`,
      [req.tid, group_id, rows[0].id, session_date, req.user.id]
    );
    if (!marked.rows[0]) return res.status(409).json({ error: 'Already recorded', student: rows[0].name });
    res.json({ ok: true, student: { id: rows[0].id, name: rows[0].name, student_code: rows[0].student_code } });
  } catch (e) { next(e); }
});

/** POST /api/attendance/search — staff manual attendance by student search */
router.post('/search', requireRole('owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const { q, group_id, session_date, status } = req.body;
    const { rows } = await query(
      `SELECT s.id, s.name, s.student_code FROM students s
       JOIN enrollments e ON e.student_id = s.id AND e.group_id = $2 AND e.status = 'active'
       WHERE s.tenant_id = $1 AND (s.name ILIKE $3 OR s.student_code ILIKE $3)
       LIMIT 20`, [req.tid, group_id, `%${q}%`]);
    if (!rows[0]) return res.status(404).json({ error: 'No matching student in this group' });
    await query(
      `INSERT INTO attendance (tenant_id, group_id, student_id, session_date, status, method, recorded_by)
       VALUES ($1,$2,$3,$4,$5,'search',$6)
       ON CONFLICT (group_id, student_id, session_date) DO NOTHING`,
      [req.tid, group_id, rows[0].id, session_date, status || 'present', req.user.id]);
    res.json({ ok: true, student: rows[0] });
  } catch (e) { next(e); }
});

async function notifyParentOfAbsence(tenantId, groupId, studentId, sessionDate, req) {
  const parents = await query(
    `SELECT p.user_id FROM student_guardians sg JOIN parents p ON p.id = sg.parent_id
     WHERE sg.student_id = $1 AND p.tenant_id = $2 AND p.user_id IS NOT NULL`, [studentId, tenantId]);
  const st = await query('SELECT name FROM students WHERE id = $1', [studentId]);
  for (const p of parents.rows) {
    await query(
      `INSERT INTO notifications (tenant_id, user_id, type, title, body, data)
       VALUES ($1,$2,'absent',$3,$4,$5)`,
      [tenantId, p.user_id,
       st.rows[0].name, `${st.rows[0].name} was absent on ${sessionDate}`,
       JSON.stringify({ student_id: studentId, group_id: groupId, session_date: sessionDate })]
    );
  }
}

module.exports = router;
