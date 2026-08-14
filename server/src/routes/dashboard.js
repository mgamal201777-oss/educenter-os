const router = require('express').Router();
const { query } = require('../db');
const { tenantScope } = require('../middleware/guards');

router.use(tenantScope);

/** GET /api/dashboard/owner — center-wide KPIs */
router.get('/owner', async (req, res, next) => {
  try {
    if (!['owner', 'admin', 'branch_manager'].includes(req.user.role) && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Management only' });
    }
    const [students, finance, attendance, todayClasses, riskCount, leads, groups] = await Promise.all([
      query(`SELECT
          count(*) FILTER (WHERE status = 'active') AS active_students,
          count(*) FILTER (WHERE created_at > now() - interval '30 days') AS new_students
        FROM students WHERE tenant_id = $1`, [req.tid]),
      query(`SELECT
          COALESCE(sum(f.total_after_discount),0) AS expected,
          COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.tenant_id = $1 AND p.status = 'paid'),0) AS collected,
          COALESCE(sum(f.total_after_discount) FILTER (WHERE f.status = 'overdue'),0) AS overdue
        FROM fees f WHERE f.tenant_id = $1`, [req.tid]),
      query(`SELECT round(count(*) FILTER (WHERE a.status = 'present') * 100.0 / NULLIF(count(*),0), 1) AS pct
        FROM attendance a WHERE a.tenant_id = $1 AND a.session_date > CURRENT_DATE - 30`, [req.tid]),
      query(`SELECT count(*) AS n FROM group_schedules gs JOIN groups g ON g.id = gs.group_id
        WHERE g.tenant_id = $1 AND gs.day_of_week = $2 AND g.status = 'active'`, [req.tid, new Date().getDay()]),
      query(`SELECT count(DISTINCT student_id) AS n FROM (
          SELECT student_id FROM attendance WHERE tenant_id = $1 AND session_date > CURRENT_DATE - 21
          GROUP BY student_id HAVING count(*) FILTER (WHERE status = 'absent') >= 3
        ) t`, [req.tid]),
      query(`SELECT count(*) AS leads,
          count(*) FILTER (WHERE stage NOT IN ('lead','contacted','lost')) AS registrations
        FROM leads WHERE tenant_id = $1`, [req.tid]),
      query(`SELECT count(*) AS total,
          sum(CASE WHEN (SELECT count(*) FROM enrollments e WHERE e.group_id = g.id AND e.status = 'active') >= g.max_capacity THEN 1 ELSE 0 END) AS full_groups
        FROM groups g WHERE g.tenant_id = $1 AND g.status = 'active'`, [req.tid]),
    ]);
    const expected = Number(finance.rows[0].expected);
    const collected = Number(finance.rows[0].collected);
    res.json({
      students: students.rows[0],
      finance: {
        expected, collected,
        outstanding: expected - collected,
        overdue: Number(finance.rows[0].overdue),
        collection_pct: expected > 0 ? Number(((collected / expected) * 100).toFixed(1)) : 0,
      },
      attendance_pct_30d: attendance.rows[0]?.pct ?? null,
      today_classes: Number(todayClasses.rows[0].n),
      attendance_risk_students: Number(riskCount.rows[0].n),
      commercial: leads.rows[0],
      groups: groups.rows[0],
    });
  } catch (e) { next(e); }
});

/** GET /api/dashboard/teacher — teacher PWA home screen */
router.get('/teacher', async (req, res, next) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only' });
    const teacher = (await query('SELECT id FROM teachers WHERE user_id = $1 AND tenant_id = $2', [req.user.id, req.tid])).rows[0];
    if (!teacher) return res.json({});

    const dow = new Date().getDay();
    const [today, pendingReview, groupsStats] = await Promise.all([
      query(`SELECT g.id, g.name, sub.name AS subject_name, gs.start_time, gs.end_time, b.name AS branch_name,
          (SELECT count(*) FROM enrollments e WHERE e.group_id = g.id AND e.status = 'active') AS student_count,
          (SELECT count(*) FROM attendance a WHERE a.group_id = g.id AND a.session_date = CURRENT_DATE) AS attendance_taken
        FROM groups g
        JOIN group_schedules gs ON gs.group_id = g.id AND gs.day_of_week = $3
        JOIN subjects sub ON sub.id = g.subject_id
        JOIN branches b ON b.id = g.branch_id
        WHERE g.teacher_id = $1 AND g.tenant_id = $2 AND g.status = 'active'
        ORDER BY gs.start_time`, [teacher.id, req.tid, dow]),
      query(`SELECT count(*) AS n FROM homework_submissions hs
        JOIN homework h ON h.id = hs.homework_id JOIN groups g ON g.id = h.group_id
        WHERE g.teacher_id = $1 AND g.tenant_id = $2 AND hs.status IN ('submitted','late')`, [teacher.id, req.tid]),
      query(`SELECT g.id, g.name,
          (SELECT count(*) FROM enrollments e WHERE e.group_id = g.id AND e.status = 'active') AS students,
          (SELECT round(avg(qa.score / NULLIF(q.total_score,0) * 100),1) FROM quiz_attempts qa
            JOIN quizzes q ON q.id = qa.quiz_id WHERE q.group_id = g.id AND qa.score IS NOT NULL) AS avg_score
        FROM groups g WHERE g.teacher_id = $1 AND g.tenant_id = $2 AND g.status = 'active'`, [teacher.id, req.tid]),
    ]);
    res.json({
      today_classes: today.rows,
      homework_pending_review: Number(pendingReview.rows[0].n),
      groups: groupsStats.rows,
    });
  } catch (e) { next(e); }
});

/** GET /api/dashboard/parent — parent PWA home (children summary) */
router.get('/parent', async (req, res, next) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Parents only' });
    const parent = (await query('SELECT id FROM parents WHERE user_id = $1 AND tenant_id = $2', [req.user.id, req.tid])).rows[0];
    if (!parent) return res.json({ children: [] });

    const children = await query(`
      SELECT s.id, s.name, s.student_code, gl.name AS grade_name,
        (SELECT round(count(*) FILTER (WHERE a.status = 'present') * 100.0 / NULLIF(count(*),0), 1)
          FROM attendance a WHERE a.student_id = s.id AND a.session_date > CURRENT_DATE - 30) AS attendance_pct,
        (SELECT COALESCE(sum(f.total_after_discount),0) - COALESCE((SELECT sum(p.amount) FROM payments p
            WHERE p.fee_id IN (SELECT id FROM fees WHERE student_id = s.id) AND p.status = 'paid'),0)
          FROM fees f WHERE f.student_id = s.id) AS outstanding
      FROM students s
      JOIN student_guardians sg ON sg.student_id = s.id
      LEFT JOIN grade_levels gl ON gl.id = s.grade_level_id
      WHERE sg.parent_id = $1 AND s.tenant_id = $2 AND s.status = 'active'
      ORDER BY s.name`, [parent.id, req.tid]);

    // per child: today's classes + recent grades
    for (const c of children.rows) {
      const dow = new Date().getDay();
      c.today_classes = (await query(`
        SELECT g.name, gs.start_time, gs.end_time, sub.name AS subject
        FROM enrollments e JOIN groups g ON g.id = e.group_id
        JOIN group_schedules gs ON gs.group_id = g.id AND gs.day_of_week = $3
        JOIN subjects sub ON sub.id = g.subject_id
        WHERE e.student_id = $1 AND e.tenant_id = $2 AND e.status = 'active' ORDER BY gs.start_time`,
        [c.id, req.tid, dow])).rows;
      c.recent_grades = (await query(`
        SELECT q.title, qa.score, q.total_score, q.type, q.show_result
        FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
        JOIN enrollments e ON e.student_id = qa.student_id AND e.group_id = q.group_id
        WHERE qa.student_id = $1 AND qa.tenant_id = $2 AND qa.status = 'graded'
        ORDER BY qa.submitted_at DESC LIMIT 5`, [c.id, req.tid])).rows
        .filter((r) => r.show_result);
    }
    res.json({ children: children.rows });
  } catch (e) { next(e); }
});

/** GET /api/dashboard/student — student PWA home */
router.get('/student', async (req, res, next) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
    const me = (await query('SELECT id, name FROM students WHERE user_id = $1 AND tenant_id = $2', [req.user.id, req.tid])).rows[0];
    if (!me) return res.json({});
    const dow = new Date().getDay();
    const [today, homeworkDue, openQuizzes, recentGrades] = await Promise.all([
      query(`SELECT g.name, gs.start_time, gs.end_time, sub.name AS subject, t.name AS teacher
        FROM enrollments e JOIN groups g ON g.id = e.group_id
        JOIN group_schedules gs ON gs.group_id = g.id AND gs.day_of_week = $3
        JOIN subjects sub ON sub.id = g.subject_id LEFT JOIN teachers t ON t.id = g.teacher_id
        WHERE e.student_id = $1 AND e.tenant_id = $2 AND e.status = 'active' ORDER BY gs.start_time`, [me.id, req.tid, dow]),
      query(`SELECT h.id, h.title, h.due_date, hs.status FROM homework h
        JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = $1
        JOIN enrollments e ON e.group_id = h.group_id AND e.student_id = $1
        WHERE h.tenant_id = $2 AND h.due_date >= CURRENT_DATE AND hs.status IN ('assigned','viewed')
        ORDER BY h.due_date LIMIT 10`, [me.id, req.tid]),
      query(`SELECT q.id, q.title, q.deadline, q.type FROM quizzes q
        JOIN enrollments e ON e.group_id = q.group_id AND e.student_id = $1
        WHERE q.tenant_id = $2 AND q.status = 'published'
          AND (q.deadline IS NULL OR q.deadline > now())
          AND NOT EXISTS (SELECT 1 FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.student_id = $1 AND qa.attempt_no >= q.attempts_allowed)
        ORDER BY q.deadline NULLS LAST LIMIT 10`, [me.id, req.tid]),
      query(`SELECT q.title, qa.score, q.total_score, q.type FROM quiz_attempts qa
        JOIN quizzes q ON q.id = qa.quiz_id
        WHERE qa.student_id = $1 AND qa.tenant_id = $2 AND qa.status = 'graded' AND q.show_result
        ORDER BY qa.submitted_at DESC LIMIT 5`, [me.id, req.tid]),
    ]);
    res.json({ today_classes: today.rows, homework_due: homeworkDue.rows,
      available_quizzes: openQuizzes.rows, recent_grades: recentGrades.rows });
  } catch (e) { next(e); }
});

module.exports = router;
