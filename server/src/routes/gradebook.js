const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope } = require('../middleware/guards');

router.use(tenantScope);
const canView = requireRole('owner', 'admin', 'branch_manager', 'finance', 'reception', 'teacher', 'student', 'parent');

/**
 * GET /api/gradebook?student_id=&term_id=
 * Weighted averages by component + attendance % + topic-level performance.
 */
router.get('/', canView, async (req, res, next) => {
  try {
    const { student_id, term_id } = req.query;
    if (!student_id || !term_id) return res.status(400).json({ error: 'student_id and term_id required' });

    // parents/students: only own data
    if (['parent', 'student'].includes(req.user.role)) {
      const allowed = await canSeeStudent(req, student_id);
      if (!allowed) return res.status(403).json({ error: 'Not permitted for this student' });
    }

    const weights = await query(
      `SELECT component, weight FROM grading_weights WHERE tenant_id = $1 AND grade_level_id IS NULL`, [req.tid]);
    const wmap = Object.fromEntries(weights.rows.map((r) => [r.component, Number(r.weight)]));

    const [hw, quizzes, att] = await Promise.all([
      // homework average as percent
      query(`SELECT round(avg(hs.score / NULLIF(h.max_score,0) * 100), 1) AS avg, count(*) AS n
             FROM homework_submissions hs JOIN homework h ON h.id = hs.homework_id
             JOIN groups g ON g.id = h.group_id
             WHERE hs.student_id = $1 AND hs.tenant_id = $2 AND g.term_id = $3 AND hs.score IS NOT NULL`,
        [student_id, req.tid, term_id]),
      // quiz/exam averages by type (percent)
      query(`SELECT q.type, round(avg(qa.score / NULLIF(q.total_score,0) * 100), 1) AS avg, count(*) AS n
             FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
             JOIN groups g ON g.id = q.group_id
             WHERE qa.student_id = $1 AND qa.tenant_id = $2 AND g.term_id = $3 AND qa.score IS NOT NULL AND qa.status = 'graded'
             GROUP BY q.type`,
        [student_id, req.tid, term_id]),
      // attendance %
      query(`SELECT round(count(*) FILTER (WHERE a.status = 'present') * 100.0 / NULLIF(count(*),0), 1) AS pct
             FROM attendance a JOIN groups g ON g.id = a.group_id
             WHERE a.student_id = $1 AND a.tenant_id = $2 AND g.term_id = $3`,
        [student_id, req.tid, term_id]),
    ]);

    const qByType = Object.fromEntries(quizzes.rows.map((r) => [r.type, r.avg]));

    // weighted final average using configured weights (fallback defaults)
    const defaults = { homework: 10, quiz: 20, midterm: 30, final: 40, weekly_test: 0, monthly_test: 0 };
    const eff = { ...defaults, ...wmap };
    let total = 0, used = 0;
    const pick = (val, w) => { if (val != null && w > 0) { total += val * w; used += w; } };
    pick(hw.rows[0]?.avg, eff.homework);
    pick(qByType.quiz, eff.quiz);
    pick(qByType.weekly_test, eff.weekly_test);
    pick(qByType.monthly_test, eff.monthly_test);
    pick(qByType.midterm, eff.midterm);
    pick(qByType.final, eff.final);
    const finalAvg = used ? Number((total / used).toFixed(1)) : null;

    // topic-level performance (from auto-graded answers)
    const topics = await query(`
      SELECT qn.topic, qn.chapter,
        round(avg(CASE WHEN qans.is_correct THEN 100 ELSE 0 END), 1) AS pct, count(*) AS n
      FROM quiz_answers qans
      JOIN quiz_attempts qat ON qat.id = qans.attempt_id
      JOIN questions qn ON qn.id = qans.question_id
      JOIN quizzes q ON q.id = qat.quiz_id
      JOIN groups g ON g.id = q.group_id
      WHERE qat.student_id = $1 AND qat.tenant_id = $2 AND g.term_id = $3
        AND qans.is_correct IS NOT NULL AND qn.topic IS NOT NULL
      GROUP BY qn.topic, qn.chapter ORDER BY pct`, [student_id, req.tid, term_id]);

    res.json({
      homework_avg: hw.rows[0]?.avg ?? null,
      quiz_avg: qByType.quiz ?? null,
      exam_averages: qByType,
      attendance_pct: att.rows[0]?.pct ?? null,
      weights_used: eff,
      final_average: finalAvg,
      topics: topics.rows,
    });
  } catch (e) { next(e); }
});

async function canSeeStudent(req, studentId) {
  if (req.user.role === 'student') {
    const { rows } = await query('SELECT 1 FROM students WHERE id = $1 AND tenant_id = $2 AND user_id = $3',
      [studentId, req.tid, req.user.id]);
    return !!rows[0];
  }
  if (req.user.role === 'parent') {
    const { rows } = await query(`
      SELECT 1 FROM student_guardians sg JOIN parents p ON p.id = sg.parent_id
      WHERE sg.student_id = $1 AND p.tenant_id = $2 AND p.user_id = $3`,
      [studentId, req.tid, req.user.id]);
    return !!rows[0];
  }
  return true;
}

module.exports = router;
