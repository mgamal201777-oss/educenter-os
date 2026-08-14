const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope } = require('../middleware/guards');

router.use(tenantScope);
const mgmt = requireRole('owner', 'admin', 'branch_manager', 'reception');

/**
 * Rule-based risk engine — no AI, pure SQL rules:
 *  1. 3+ consecutive absences
 *  2. Attendance decline (last 30d vs previous 30d, -10pp+)
 *  3. Declining grades (last 3 quizzes below 60% or downward trend)
 *  4. Low homework completion (< 50%)
 *  5. Overdue fees
 */
router.get('/risk', mgmt, async (req, res, next) => {
  try {
    const [consecAbs, attDecline, lowQuiz, lowHw, overdue] = await Promise.all([
      query(`SELECT student_id, group_id, max(streak) AS streak FROM (
          SELECT student_id, group_id,
            count(*) FILTER (WHERE status = 'absent') AS streak
          FROM attendance WHERE tenant_id = $1 AND session_date > CURRENT_DATE - 30
          GROUP BY student_id, group_id HAVING count(*) FILTER (WHERE status = 'absent') >= 3
        ) t GROUP BY student_id, group_id`, [req.tid]),
      query(`SELECT recent.student_id,
          recent.pct AS recent_pct, prior.pct AS prior_pct,
          round(prior.pct - recent.pct, 1) AS drop
        FROM
          (SELECT student_id, round(count(*) FILTER (WHERE status='present')*100.0/count(*),1) AS pct
            FROM attendance WHERE tenant_id=$1 AND session_date > CURRENT_DATE - 30 GROUP BY student_id) recent
          JOIN
          (SELECT student_id, round(count(*) FILTER (WHERE status='present')*100.0/count(*),1) AS pct
            FROM attendance WHERE tenant_id=$1 AND session_date BETWEEN CURRENT_DATE - 60 AND CURRENT_DATE - 30
            GROUP BY student_id) prior ON prior.student_id = recent.student_id
        WHERE prior.pct - recent.pct >= 10 AND recent.pct < 80`, [req.tid]),
      query(`SELECT qa.student_id,
          round(avg(qa.score / NULLIF(q.total_score,0) * 100),1) AS avg_pct, count(*) AS n
        FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
        WHERE qa.tenant_id = $1 AND qa.status = 'graded' AND qa.score IS NOT NULL
          AND qa.submitted_at > now() - interval '60 days'
        GROUP BY qa.student_id HAVING avg(qa.score / NULLIF(q.total_score,0) * 100) < 60 AND count(*) >= 3`, [req.tid]),
      query(`SELECT hs.student_id,
          round(count(*) FILTER (WHERE hs.status IN ('submitted','late','reviewed')) * 100.0 / count(*), 1) AS pct
        FROM homework_submissions hs JOIN homework h ON h.id = hs.homework_id
        WHERE hs.tenant_id = $1 AND h.due_date > CURRENT_DATE - 30
        GROUP BY hs.student_id HAVING count(*) FILTER (WHERE hs.status IN ('submitted','late','reviewed')) * 100.0 / count(*) < 50`, [req.tid]),
      query(`SELECT f.student_id, COALESCE(sum(f.total_after_discount),0) - COALESCE(
          (SELECT sum(p.amount) FROM payments p WHERE p.fee_id IN (SELECT id FROM fees WHERE student_id = f.student_id) AND p.status='paid'),0) AS overdue_amt
        FROM fees f WHERE f.tenant_id = $1 AND f.status = 'overdue' GROUP BY f.student_id`, [req.tid]),
    ]);

    // merge by student
    const byStudent = new Map();
    const ensure = (sid) => {
      if (!byStudent.has(sid)) byStudent.set(sid, { student_id: sid, signals: [] });
      return byStudent.get(sid);
    };
    for (const r of consecAbs.rows) { ensure(r.student_id).signals.push({ type: 'consecutive_absence', detail: `${r.streak}+ absences in last 30 days` }); }
    for (const r of attDecline.rows) { ensure(r.student_id).signals.push({ type: 'attendance_decline', detail: `attendance ${r.prior_pct}% → ${r.recent_pct}%` }); }
    for (const r of lowQuiz.rows) { ensure(r.student_id).signals.push({ type: 'low_quiz_avg', detail: `quiz avg ${r.avg_pct}% over ${r.n} attempts` }); }
    for (const r of lowHw.rows) { ensure(r.student_id).signals.push({ type: 'low_homework', detail: `homework completion ${r.pct}%` }); }
    for (const r of overdue.rows) { if (Number(r.overdue_amt) > 0) ensure(r.student_id).signals.push({ type: 'overdue_fees', detail: `EGP ${Math.round(Number(r.overdue_amt))} overdue` }); }

    const ids = [...byStudent.keys()];
    if (!ids.length) return res.json([]);
    const names = await query('SELECT id, name, student_code FROM students WHERE tenant_id = $1 AND id = ANY($2::int[])', [req.tid, ids]);
    const nameMap = new Map(names.rows.map((r) => [r.id, r]));
    const result = [...byStudent.values()].map((r) => ({
      ...r,
      name: nameMap.get(r.student_id)?.name,
      student_code: nameMap.get(r.student_id)?.student_code,
      severity: r.signals.length >= 3 ? 'high' : r.signals.length === 2 ? 'medium' : 'low',
      recommended_action: r.signals.some((s) => s.type === 'overdue_fees') && r.signals.length === 1
        ? 'payment_reminder' : 'parent_followup',
    })).sort((a, b) => b.signals.length - a.signals.length);
    res.json(result);
  } catch (e) { next(e); }
});

/** GET /api/insights/followup-list — daily/weekly parent follow-up action list */
router.get('/followup-list', mgmt, async (req, res, next) => {
  try {
    const risk = (await query(`SELECT * FROM (
        SELECT student_id, group_id, count(*) FILTER (WHERE status='absent') AS absences
        FROM attendance WHERE tenant_id = $1 AND session_date > CURRENT_DATE - 21
        GROUP BY student_id, group_id HAVING count(*) FILTER (WHERE status='absent') >= 3) t`, [req.tid])).rows;
    const overdue = (await query(`
      SELECT f.student_id, COALESCE(sum(f.total_after_discount),0) - COALESCE(
        (SELECT sum(p.amount) FROM payments p WHERE p.status='paid' AND p.fee_id IN
          (SELECT id FROM fees WHERE student_id = f.student_id)),0) AS amount
      FROM fees f WHERE f.tenant_id = $1 AND f.status = 'overdue' GROUP BY f.student_id`, [req.tid])).rows
      .filter((r) => Number(r.amount) > 0);
    const renewal = (await query(`
      SELECT DISTINCT e.student_id FROM enrollments e
      WHERE e.tenant_id = $1 AND e.status = 'expired'`, [req.tid])).rows;

    const items = [];
    const idset = new Set();
    const add = (sid, reason, priority) => { items.push({ student_id: sid, reason, priority }); idset.add(sid); };
    risk.forEach((r) => add(r.student_id, `${r.absences} absences in 3 weeks`, 1));
    overdue.forEach((r) => add(r.student_id, `EGP ${Math.round(Number(r.amount))} overdue`, 2));
    renewal.forEach((r) => add(r.student_id, 'Enrollment renewal pending', 3));
    if (!idset.size) return res.json([]);
    const names = await query('SELECT id, name, student_code FROM students WHERE tenant_id = $1 AND id = ANY($2::int[])', [req.tid, [...idset]]);
    const nm = new Map(names.rows.map((r) => [r.id, r]));
    res.json(items.filter((i) => nm.has(i.student_id)).map((i) => ({ ...i, name: nm.get(i.student_id).name, student_code: nm.get(i.student_id).student_code }))
      .sort((a, b) => a.priority - b.priority));
  } catch (e) { next(e); }
});

/** GET /api/insights/capacity — group utilization + redirect advice */
router.get('/capacity', mgmt, async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT g.id, g.name, g.max_capacity, b.name AS branch_name, sub.name AS subject_name,
        (SELECT count(*) FROM enrollments e WHERE e.group_id = g.id AND e.status = 'active') AS enrolled
      FROM groups g JOIN branches b ON b.id = g.branch_id JOIN subjects sub ON sub.id = g.subject_id
      WHERE g.tenant_id = $1 AND g.status = 'active' ORDER BY g.name`, [req.tid]);
    const withPct = rows.map((r) => ({ ...r, utilization_pct: Number(((Number(r.enrolled) / r.max_capacity) * 100).toFixed(0)) }));
    const full = withPct.filter((r) => r.utilization_pct >= 100);
    const spare = withPct.filter((r) => r.utilization_pct < 60);
    res.json({ groups: withPct, full_groups: full.length, recommendations: spare.slice(0, 5) });
  } catch (e) { next(e); }
});

/** GET /api/insights/subject-performance — avg score by subject + weak topics */
router.get('/subject-performance', mgmt, async (req, res, next) => {
  try {
    const [bySubject, weakTopics] = await Promise.all([
      query(`SELECT sub.name, round(avg(qa.score / NULLIF(q.total_score,0) * 100),1) AS avg_pct, count(*) AS attempts
        FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
        JOIN groups g ON g.id = q.group_id JOIN subjects sub ON sub.id = g.subject_id
        WHERE qa.tenant_id = $1 AND qa.status = 'graded' GROUP BY sub.name ORDER BY avg_pct`, [req.tid]),
      query(`SELECT qn.topic, qn.chapter, round(avg(CASE WHEN qans.is_correct THEN 100 ELSE 0 END),1) AS pct, count(*) AS n
        FROM quiz_answers qans JOIN quiz_attempts qat ON qat.id = qans.attempt_id
        JOIN questions qn ON qn.id = qans.question_id
        WHERE qat.tenant_id = $1 AND qans.is_correct IS NOT NULL AND qn.topic IS NOT NULL
        GROUP BY qn.topic, qn.chapter HAVING count(*) >= 5
        ORDER BY pct ASC LIMIT 15`, [req.tid]),
    ]);
    res.json({ by_subject: bySubject.rows, weak_topics: weakTopics.rows });
  } catch (e) { next(e); }
});

module.exports = router;
