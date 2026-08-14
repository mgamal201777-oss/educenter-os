const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope } = require('../middleware/guards');

router.use(tenantScope);
const canManage = requireRole('owner', 'admin', 'branch_manager', 'teacher');

/** GET /api/questions — bank with filters */
router.get('/', canManage, async (req, res, next) => {
  try {
    const { subject_id, grade_level_id, topic, difficulty, type, q } = req.query;
    const where = ['tenant_id = $1'];
    const vals = [req.tid];
    let i = 2;
    if (subject_id) { where.push(`subject_id = $${i++}`); vals.push(subject_id); }
    if (grade_level_id) { where.push(`grade_level_id = $${i++}`); vals.push(grade_level_id); }
    if (topic) { where.push(`topic ILIKE $${i++}`); vals.push(`%${topic}%`); }
    if (difficulty) { where.push(`difficulty = $${i++}`); vals.push(difficulty); }
    if (type) { where.push(`type = $${i++}`); vals.push(type); }
    if (q) { where.push(`text ILIKE $${i++}`); vals.push(`%${q}%`); }
    const { rows } = await query(
      `SELECT * FROM questions WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 300`, vals);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/questions — add to bank */
router.post('/', canManage, async (req, res, next) => {
  try {
    const { subject_id, grade_level_id, chapter, topic, difficulty = 'medium', type, text,
      options, correct_answer, max_score = 1 } = req.body;
    const { rows } = await query(
      `INSERT INTO questions (tenant_id, subject_id, grade_level_id, chapter, topic, difficulty, type, text, options, correct_answer, max_score, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.tid, subject_id || null, grade_level_id || null, chapter || null, topic || null, difficulty, type, text,
       options ? JSON.stringify(options) : null,
       correct_answer === undefined ? null : JSON.stringify(correct_answer),
       max_score, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

/** PATCH /api/questions/:id */
router.patch('/:id', canManage, async (req, res, next) => {
  try {
    const allowed = ['subject_id', 'grade_level_id', 'chapter', 'topic', 'difficulty', 'type', 'text', 'options', 'correct_answer', 'max_score'];
    const sets = [], vals = [];
    let i = 2;
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = $${i++}`);
      vals.push((k === 'options' || k === 'correct_answer') && v !== null ? JSON.stringify(v) : v);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(Number(req.params.id));
    const { rows } = await query(`UPDATE questions SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $${i} RETURNING *`, vals);
    if (!rows[0]) return res.status(404).json({ error: 'Question not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** DELETE /api/questions/:id */
router.delete('/:id', canManage, async (req, res, next) => {
  try {
    await query('DELETE FROM questions WHERE tenant_id = $1 AND id = $2', [req.tid, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
