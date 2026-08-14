const router = require('express').Router();
const { query } = require('../db');
const { tenantScope } = require('../middleware/guards');

router.use(tenantScope);

async function myStudentId(req) {
  const { rows } = await query('SELECT id FROM students WHERE user_id = $1 AND tenant_id = $2', [req.user.id, req.tid]);
  return rows[0]?.id;
}
async function myParentId(req) {
  const { rows } = await query('SELECT id FROM parents WHERE user_id = $1 AND tenant_id = $2', [req.user.id, req.tid]);
  return rows[0]?.id;
}
/** parent must be a guardian of studentId */
async function parentOwns(req, studentId) {
  const pid = await myParentId(req);
  const { rows } = await query(
    'SELECT 1 FROM student_guardians WHERE parent_id = $1 AND student_id = $2', [pid, studentId]);
  return !!rows[0];
}

// ============ PARENT PORTAL ============

/** GET /api/portal/parent/children/:id — full child view (attendance, schedule, grades, fees, notes) */
router.get('/parent/children/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Parents only' });
    if (!(await parentOwns(req, req.params.id))) return res.status(403).json({ error: 'Not your child' });
    const sid = req.params.id;

    const [profile, schedule, attendance, grades, notes, fees] = await Promise.all([
      query(`SELECT s.id, s.name, s.student_code, gl.name AS grade_name FROM students s
        LEFT JOIN grade_levels gl ON gl.id = s.grade_level_id WHERE s.id = $1 AND s.tenant_id = $2`, [sid, req.tid]),
      query(`SELECT g.name AS group_name, sub.name AS subject, t.name AS teacher, gs.day_of_week, gs.start_time, gs.end_time
        FROM enrollments e JOIN groups g ON g.id = e.group_id
        JOIN group_schedules gs ON gs.group_id = g.id
        JOIN subjects sub ON sub.id = g.subject_id LEFT JOIN teachers t ON t.id = g.teacher_id
        WHERE e.student_id = $1 AND e.tenant_id = $2 AND e.status = 'active'
        ORDER BY gs.day_of_week, gs.start_time`, [sid, req.tid]),
      query(`SELECT a.session_date, a.status, g.name AS group_name FROM attendance a
        JOIN groups g ON g.id = a.group_id WHERE a.student_id = $1 AND a.tenant_id = $2
        ORDER BY a.session_date DESC LIMIT 60`, [sid, req.tid]),
      query(`SELECT q.title, q.type, qa.score, q.total_score, q.show_result, qa.submitted_at
        FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
        WHERE qa.student_id = $1 AND qa.tenant_id = $2 AND qa.status = 'graded'
        ORDER BY qa.submitted_at DESC LIMIT 30`, [sid, req.tid]),
      query(`SELECT a.period, a.academic_level, a.strengths, a.weaknesses, a.recommendation, a.notes, a.parent_followup
        FROM assessments a WHERE a.student_id = $1 AND a.tenant_id = $2 AND a.parent_visible
        ORDER BY a.created_at DESC LIMIT 10`, [sid, req.tid]),
      query(`SELECT f.id, f.fee_type, f.description, f.total_after_discount, f.status, f.due_date,
          COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.fee_id = f.id AND p.status='paid'),0) AS paid
        FROM fees f WHERE f.student_id = $1 AND f.tenant_id = $2 ORDER BY f.created_at DESC`, [sid, req.tid]),
    ]);

    const attRows = attendance.rows;
    const presentCount = attRows.filter((a) => a.status === 'present').length;
    res.json({
      profile: profile.rows[0],
      weekly_schedule: schedule.rows,
      attendance: attRows,
      attendance_pct: attRows.length ? Number(((presentCount / attRows.length) * 100).toFixed(1)) : null,
      grades: grades.rows.filter((g) => g.show_result),
      assessments: notes.rows,
      fees: fees.rows.map((f) => ({ ...f, outstanding: Number(f.total_after_discount) - Number(f.paid) })),
    });
  } catch (e) { next(e); }
});

// ============ STUDENT PORTAL ============

/** GET /api/portal/student/me — my profile + enrollments */
router.get('/student/me', async (req, res, next) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
    const sid = await myStudentId(req);
    if (!sid) return res.status(404).json({ error: 'Student profile not found' });
    const { rows } = await query(`
      SELECT s.id, s.name, s.student_code, gl.name AS grade_name FROM students s
      LEFT JOIN grade_levels gl ON gl.id = s.grade_level_id WHERE s.id = $1`, [sid]);
    const enr = await query(`
      SELECT e.id, g.id AS group_id, g.name AS group_name, sub.name AS subject, t.name AS teacher
      FROM enrollments e JOIN groups g ON g.id = e.group_id
      JOIN subjects sub ON sub.id = g.subject_id LEFT JOIN teachers t ON t.id = g.teacher_id
      WHERE e.student_id = $1 AND e.tenant_id = $2 AND e.status = 'active'`, [sid, req.tid]);
    res.json({ ...rows[0], enrollments: enr.rows });
  } catch (e) { next(e); }
});

/** GET /api/portal/student/homework — my homework list */
router.get('/student/homework', async (req, res, next) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
    const sid = await myStudentId(req);
    const { rows } = await query(`
      SELECT h.id, h.title, h.description, h.due_date, h.link_url, h.attachment_url, h.max_score,
        g.name AS group_name, sub.name AS subject, hs.status, hs.submitted_at, hs.score, hs.feedback
      FROM homework_submissions hs JOIN homework h ON h.id = hs.homework_id
      JOIN groups g ON g.id = h.group_id JOIN subjects sub ON sub.id = g.subject_id
      WHERE hs.student_id = $1 AND hs.tenant_id = $2
      ORDER BY h.due_date DESC LIMIT 100`, [sid, req.tid]);
    res.json(rows);
  } catch (e) { next(e); }
});

/** PATCH /api/portal/student/homework/:id/submit — mark as submitted */
router.patch('/student/homework/:id/submit', async (req, res, next) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
    const sid = await myStudentId(req);
    const hw = (await query('SELECT due_date FROM homework WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid])).rows[0];
    if (!hw) return res.status(404).json({ error: 'Homework not found' });
    const status = new Date() > new Date(hw.due_date + 'T23:59:59') ? 'late' : 'submitted';
    const { rows } = await query(
      `UPDATE homework_submissions SET status = $1, submitted_at = now()
       WHERE homework_id = $2 AND student_id = $3 AND tenant_id = $4 RETURNING *`,
      [status, req.params.id, sid, req.tid]);
    if (!rows[0]) return res.status(404).json({ error: 'Not assigned to you' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** GET /api/portal/student/attendance — my attendance */
router.get('/student/attendance', async (req, res, next) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
    const sid = await myStudentId(req);
    const { rows } = await query(`
      SELECT a.session_date, a.status, g.name AS group_name FROM attendance a
      JOIN groups g ON g.id = a.group_id WHERE a.student_id = $1 AND a.tenant_id = $2
      ORDER BY a.session_date DESC LIMIT 100`, [sid, req.tid]);
    res.json(rows);
  } catch (e) { next(e); }
});

/** GET /api/portal/student/grades — my graded results */
router.get('/student/grades', async (req, res, next) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
    const sid = await myStudentId(req);
    const { rows } = await query(`
      SELECT q.title, q.type, qa.score, q.total_score, qa.submitted_at, q.show_result, g.name AS group_name
      FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
      JOIN groups g ON g.id = q.group_id
      WHERE qa.student_id = $1 AND qa.tenant_id = $2 AND qa.status = 'graded'
      ORDER BY qa.submitted_at DESC`, [sid, req.tid]);
    res.json(rows.filter((r) => r.show_result));
  } catch (e) { next(e); }
});

module.exports = router;
