const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope } = require('../middleware/guards');

router.use(tenantScope);
const mgmt = requireRole('owner', 'admin', 'branch_manager', 'reception', 'finance');

const REPORTS = {
  'students': {
    label: 'Student master list',
    sql: `SELECT s.student_code AS code, s.name, s.gender, s.date_of_birth AS dob, gl.name AS grade,
            b.name AS branch, s.school_name, s.status
          FROM students s LEFT JOIN grade_levels gl ON gl.id = s.grade_level_id
          LEFT JOIN branches b ON b.id = s.branch_id WHERE s.tenant_id = $1 ORDER BY s.name`,
  },
  'parents': {
    label: 'Parent list',
    sql: `SELECT p.name, p.relationship, p.mobile, p.alt_mobile, p.email,
            (SELECT string_agg(s.name, ', ') FROM student_guardians sg JOIN students s ON s.id = sg.student_id WHERE sg.parent_id = p.id) AS children
          FROM parents p WHERE p.tenant_id = $1 ORDER BY p.name`,
  },
  'enrollments': {
    label: 'Enrollments',
    sql: `SELECT s.name AS student, g.name AS group_name, sub.name AS subject, y.name AS year, tm.name AS term,
            e.status, e.enrolled_at
          FROM enrollments e JOIN students s ON s.id = e.student_id JOIN groups g ON g.id = e.group_id
          JOIN subjects sub ON sub.id = g.subject_id JOIN academic_years y ON y.id = e.academic_year_id
          JOIN terms tm ON tm.id = e.term_id
          WHERE e.tenant_id = $1 ORDER BY e.enrolled_at DESC`,
  },
  'attendance': {
    label: 'Attendance log',
    sql: `SELECT a.session_date AS date, s.name AS student, g.name AS group_name, a.status, a.method
          FROM attendance a JOIN students s ON s.id = a.student_id JOIN groups g ON g.id = a.group_id
          WHERE a.tenant_id = $1 ORDER BY a.session_date DESC LIMIT 5000`,
  },
  'payments': {
    label: 'Payments',
    sql: `SELECT p.paid_at AS date, s.name AS student, p.amount, p.method, p.reference, p.status,
            u.full_name AS recorded_by
          FROM payments p JOIN students s ON s.id = p.student_id LEFT JOIN users u ON u.id = p.recorded_by
          WHERE p.tenant_id = $1 ORDER BY p.paid_at DESC`,
  },
  'outstanding': {
    label: 'Outstanding fees',
    sql: `SELECT s.name AS student, s.student_code AS code, f.fee_type, f.total_after_discount,
            COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.fee_id = f.id AND p.status='paid'),0) AS paid,
            f.total_after_discount - COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.fee_id = f.id AND p.status='paid'),0) AS outstanding,
            f.status, f.due_date
          FROM fees f JOIN students s ON s.id = f.student_id
          WHERE f.tenant_id = $1 AND f.status IN ('due','partial','overdue') ORDER BY outstanding DESC`,
  },
  'quiz-results': {
    label: 'Quiz results',
    sql: `SELECT s.name AS student, q.title AS quiz, q.type, qa.score, q.total_score,
            round(qa.score / NULLIF(q.total_score,0) * 100, 1) AS percent, qa.status
          FROM quiz_attempts qa JOIN students s ON s.id = qa.student_id JOIN quizzes q ON q.id = qa.quiz_id
          WHERE qa.tenant_id = $1 AND qa.score IS NOT NULL ORDER BY s.name`,
  },
  'teacher-workload': {
    label: 'Teacher workload',
    sql: `SELECT t.name AS teacher,
            count(DISTINCT g.id) AS groups,
            COALESCE(sum((SELECT count(*) FROM enrollments e WHERE e.group_id = g.id AND e.status='active')),0) AS students
          FROM teachers t LEFT JOIN groups g ON g.teacher_id = t.id AND g.status='active'
          WHERE t.tenant_id = $1 GROUP BY t.name ORDER BY students DESC`,
  },
  'acquisition': {
    label: 'Lead acquisition',
    sql: `SELECT l.source, l.stage, l.name, l.parent_name, l.mobile, l.created_at
          FROM leads l WHERE l.tenant_id = $1 ORDER BY l.created_at DESC`,
  },
};

/** GET /api/reports — list available */
router.get('/', mgmt, async (req, res) => {
  res.json(Object.entries(REPORTS).map(([key, r]) => ({ key, label: r.label })));
});

/** GET /api/reports/:key?format=csv|json */
router.get('/:key', mgmt, async (req, res, next) => {
  try {
    const report = REPORTS[req.params.key];
    if (!report) return res.status(404).json({ error: 'Unknown report' });
    const { rows } = await query(report.sql, [req.tid]);

    if (req.query.format === 'csv') {
      const headers = rows.length ? Object.keys(rows[0]) : [];
      const esc = (v) => {
        if (v == null) return '';
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      };
      // BOM for Excel Arabic support
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.key}-${new Date().toISOString().slice(0,10)}.csv"`);
      return res.send(csv);
    }
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
