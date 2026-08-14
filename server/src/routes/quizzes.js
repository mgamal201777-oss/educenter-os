const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');
const { notifyUsers } = require('./notify');

router.use(tenantScope);

async function myStudentId(req) {
  const { rows } = await query('SELECT id FROM students WHERE user_id = $1 AND tenant_id = $2', [req.user.id, req.tid]);
  return rows[0]?.id;
}
async function myTeacherId(req) {
  const { rows } = await query('SELECT id FROM teachers WHERE user_id = $1 AND tenant_id = $2', [req.user.id, req.tid]);
  return rows[0]?.id;
}
async function teacherOwnsGroup(req, groupId) {
  const tid = await myTeacherId(req);
  if (!tid) return false;
  const { rows } = await query('SELECT 1 FROM groups WHERE id = $1 AND tenant_id = $2 AND teacher_id = $3', [groupId, req.tid, tid]);
  return !!rows[0];
}

// ============ QUIZZES ============

/** GET /api/quizzes?group_id= */
router.get('/', requireRole('teacher', 'owner', 'admin', 'branch_manager', 'reception', 'student'), async (req, res, next) => {
  try {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });
    if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req, group_id))) {
      return res.status(403).json({ error: 'Not your group' });
    }
    const { rows } = await query(`
      SELECT q.*, (SELECT count(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count,
        (SELECT count(*) FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.status IN ('submitted','graded')) AS attempt_count,
        (SELECT round(avg(qa.score / NULLIF(q.total_score,0)) * 100, 1) FROM quiz_attempts qa
          WHERE qa.quiz_id = q.id AND qa.score IS NOT NULL) AS avg_percent
      FROM quizzes q WHERE q.tenant_id = $1 AND q.group_id = $2
      ORDER BY q.created_at DESC`, [req.tid, group_id]);
    // students only see published quizzes (without answers)
    if (req.user.role === 'student') {
      return res.json(rows.filter((r) => r.status === 'published'));
    }
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/quizzes — create with questions from bank */
router.post('/', requireRole('owner', 'admin', 'branch_manager', 'teacher'), async (req, res, next) => {
  try {
    const { group_id, title, type = 'quiz', start_at, deadline, duration_minutes, attempts_allowed = 1,
      random_order = false, show_result = true, question_ids = [] } = req.body;
    if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req, group_id))) {
      return res.status(403).json({ error: 'Not your group' });
    }
    const qs = question_ids.length
      ? await query('SELECT id, max_score FROM questions WHERE tenant_id = $1 AND id = ANY($2::int[])', [req.tid, question_ids])
      : { rows: [] };
    const total = qs.rows.reduce((sum, q) => sum + Number(q.max_score), 0);
    const q = await query(
      `INSERT INTO quizzes (tenant_id, group_id, title, type, start_at, deadline, duration_minutes,
         attempts_allowed, random_order, show_result, total_score, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.tid, group_id, title, type, start_at || null, deadline || null, duration_minutes || null,
       attempts_allowed, random_order, show_result, total, req.user.id]
    );
    let pos = 1;
    for (const row of qs.rows) {
      await query('INSERT INTO quiz_questions (quiz_id, question_id, position, score) VALUES ($1,$2,$3,$4)',
        [q.rows[0].id, row.id, pos++, row.max_score]);
    }
    res.status(201).json(q.rows[0]);
  } catch (e) { next(e); }
});

/** PATCH /api/quizzes/:id — publish/close/edit */
router.patch('/:id', requireRole('owner', 'admin', 'branch_manager', 'teacher'), async (req, res, next) => {
  try {
    const old = await query('SELECT * FROM quizzes WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Quiz not found' });
    if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req, old.rows[0].group_id))) {
      return res.status(403).json({ error: 'Not your group' });
    }
    const allowed = ['title', 'type', 'start_at', 'deadline', 'duration_minutes', 'attempts_allowed', 'random_order', 'show_result', 'status'];
    const sets = [], vals = [];
    let i = 2;
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = $${i++}`); vals.push(v);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(Number(req.params.id));
    const { rows } = await query(`UPDATE quizzes SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $${i} RETURNING *`, vals);
    if (req.body.status === 'published' && old.rows[0].status !== 'published') {
      await notifyUsers(req, 'quiz', `Quiz available: ${rows[0].title}`, 'A new quiz has been published.', { quiz_id: rows[0].id }, 'students_and_parents', rows[0].group_id);
    }
    await audit(req.tid, req.user.id, 'update', 'quiz', req.params.id, old.rows[0], rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** GET /api/quizzes/:id/questions — full questions (teacher) / safe questions (student) */
router.get('/:id/questions', requireRole('teacher', 'owner', 'admin', 'branch_manager', 'student'), async (req, res, next) => {
  try {
    const quiz = (await query('SELECT * FROM quizzes WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid])).rows[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req, quiz.group_id))) {
      return res.status(403).json({ error: 'Not your group' });
    }
    let sql = `SELECT qq.position, qq.score, qn.id, qn.type, qn.text, qn.options, qn.difficulty, qn.topic, qn.chapter`;
    if (req.user.role !== 'student') sql += `, qn.correct_answer`;
    sql += ` FROM quiz_questions qq JOIN questions qn ON qn.id = qq.question_id WHERE qq.quiz_id = $1 ORDER BY qq.position`;
    const { rows } = await query(sql, [req.params.id]);
    // students must also be enrolled in the group
    if (req.user.role === 'student') {
      const sid = await myStudentId(req);
      const enr = await query(
        'SELECT 1 FROM enrollments WHERE student_id = $1 AND group_id = $2 AND tenant_id = $3 AND status = $4',
        [sid, quiz.group_id, req.tid, 'active']);
      if (!enr.rows[0]) return res.status(403).json({ error: 'Not enrolled' });
      if (quiz.status !== 'published') return res.status(403).json({ error: 'Quiz not available' });
    }
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/quizzes/:id/attempts — student starts attempt */
router.post('/:id/attempts', requireRole('student'), async (req, res, next) => {
  try {
    const quiz = (await query('SELECT * FROM quizzes WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid])).rows[0];
    if (!quiz || quiz.status !== 'published') return res.status(403).json({ error: 'Quiz not available' });
    const sid = await myStudentId(req);
    const enr = await query('SELECT 1 FROM enrollments WHERE student_id = $1 AND group_id = $2 AND tenant_id = $3 AND status = $4',
      [sid, quiz.group_id, req.tid, 'active']);
    if (!enr.rows[0]) return res.status(403).json({ error: 'Not enrolled' });
    const prior = await query('SELECT count(*)::int AS n FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2', [req.params.id, sid]);
    if (prior.rows[0].n >= quiz.attempts_allowed) return res.status(409).json({ error: 'No attempts left' });
    const { rows } = await query(
      `INSERT INTO quiz_attempts (tenant_id, quiz_id, student_id, attempt_no) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.tid, req.params.id, sid, prior.rows[0].n + 1]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

/** POST /api/quizzes/attempts/:attemptId/submit — auto-grade objective types */
router.post('/attempts/:attemptId/submit', requireRole('student'), async (req, res, next) => {
  try {
    const attempt = (await query('SELECT * FROM quiz_attempts WHERE id = $1 AND tenant_id = $2', [req.params.attemptId, req.tid])).rows[0];
    if (!attempt || attempt.student_id !== (await myStudentId(req))) return res.status(403).json({ error: 'Not your attempt' });
    if (attempt.status !== 'in_progress') return res.status(409).json({ error: 'Already submitted' });
    const quiz = (await query('SELECT * FROM quizzes WHERE id = $1', [attempt.quiz_id])).rows[0];

    const questions = (await query(`
      SELECT qn.* FROM quiz_questions qq JOIN questions qn ON qn.id = qq.question_id
      WHERE qq.quiz_id = $1`, [attempt.quiz_id])).rows;

    let score = 0, needsManual = false;
    const answers = req.body.answers || {}; // {questionId: answerValue}

    for (const qn of questions) {
      const ans = answers[qn.id] ?? null;
      let isCorrect = null;
      if (qn.type === 'mcq' || qn.type === 'true_false') {
        isCorrect = ans !== null && String(ans) === String(qn.correct_answer);
        if (isCorrect) score += Number(qn.max_score);
      } else if (qn.type === 'multi_select') {
        const correct = JSON.stringify([].concat(qn.correct_answer).sort());
        const given = JSON.stringify([].concat(ans || []).sort());
        isCorrect = correct === given && ans;
        if (isCorrect) score += Number(qn.max_score);
      } else if (qn.type === 'numeric') {
        isCorrect = ans !== null && Number(ans) === Number(qn.correct_answer);
        if (isCorrect) score += Number(qn.max_score);
      } else {
        needsManual = true; // short_answer / essay
      }
      await query(
        `INSERT INTO quiz_answers (attempt_id, question_id, answer, is_correct, score, feedback)
         VALUES ($1,$2,$3,$4,$5,null)`,
        [attempt.id, qn.id, JSON.stringify(ans ?? null), isCorrect,
         isCorrect === true ? qn.max_score : isCorrect === false ? 0 : null]
      );
    }

    await query(
      `UPDATE quiz_attempts SET submitted_at = now(), score = $1, status = $2 WHERE id = $3`,
      [score, needsManual ? 'submitted' : 'graded', attempt.id]
    );
    await query('UPDATE quiz_attempts SET score = $1 WHERE id = $2', [score, attempt.id]);

    res.json({ score, total: Number(quiz.total_score), needs_manual_grading: needsManual,
      show_result: quiz.show_result && !needsManual ? { score, total: Number(quiz.total_score) } : null });
  } catch (e) { next(e); }
});

/** GET /api/quizzes/:id/results — teacher view of all attempts */
router.get('/:id/results', requireRole('teacher', 'owner', 'admin', 'branch_manager'), async (req, res, next) => {
  try {
    const quiz = (await query('SELECT * FROM quizzes WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid])).rows[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req, quiz.group_id))) {
      return res.status(403).json({ error: 'Not your group' });
    }
    const { rows } = await query(`
      SELECT qa.*, s.name AS student_name, s.student_code,
        round(qa.score / NULLIF($3,0) * 100, 1) AS percent
      FROM quiz_attempts qa JOIN students s ON s.id = qa.student_id
      WHERE qa.quiz_id = $1 AND qa.tenant_id = $2 ORDER BY s.name`, [req.params.id, req.tid, Number(quiz.total_score)]);
    res.json(rows);
  } catch (e) { next(e); }
});

/** PATCH /api/quizzes/attempts/:attemptId/grade — manual grading of essay/short answers */
router.patch('/attempts/:attemptId/grade', requireRole('teacher', 'owner', 'admin'), async (req, res, next) => {
  try {
    const { answers = [] } = req.body; // [{answer_id, score, feedback}]
    let total = 0;
    for (const a of answers) {
      const upd = await query(
        `UPDATE quiz_answers SET score = $1, feedback = $2, graded_by = $3
         WHERE id = $4 RETURNING score`, [a.score, a.feedback || null, req.user.id, a.answer_id]);
      if (upd.rows[0]) total += Number(upd.rows[0].score || 0);
    }
    await query(`UPDATE quiz_attempts SET score = $1, status = 'graded' WHERE id = $2`, [total, req.params.attemptId]);
    await audit(req.tid, req.user.id, 'grade_edit', 'quiz_attempt', req.params.attemptId, null, { total }, req.ip);
    res.json({ ok: true, total });
  } catch (e) { next(e); }
});

module.exports = router;
