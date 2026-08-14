const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');
const { notifyUser } = require('./notify');

router.use(tenantScope);
const canManage = requireRole('owner', 'admin', 'branch_manager', 'teacher');

/** POST /api/assessments — create periodic assessment */
router.post('/', canManage, async (req, res, next) => {
  try {
    const a = req.body;
    const { rows } = await query(
      `INSERT INTO assessments (tenant_id, student_id, group_id, academic_year_id, term_id, period,
         academic_level, participation, homework_commitment, behavior, strengths, weaknesses,
         recommendation, parent_followup, notes, parent_visible, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [req.tid, a.student_id, a.group_id, a.academic_year_id, a.term_id, a.period || null,
       a.academic_level || null, a.participation || null, a.homework_commitment || null, a.behavior || null,
       a.strengths || null, a.weaknesses || null, a.recommendation || null, a.parent_followup || false,
       a.notes || null, a.parent_visible !== false, req.user.id]
    );
    await audit(req.tid, req.user.id, 'create', 'assessment', rows[0].id, null, { student_id: a.student_id }, req.ip);
    // notify parents if visible
    const parents = await query(
      `SELECT p.user_id FROM student_guardians sg JOIN parents p ON p.id = sg.parent_id
       WHERE sg.student_id = $1 AND p.tenant_id = $2 AND p.user_id IS NOT NULL`, [a.student_id, req.tid]);
    for (const p of parents.rows) {
      if (p.user_id) await notifyUser(req.tid, p.user_id, 'assessment', 'New teacher assessment', 'Please review the latest assessment.', { student_id: a.student_id });
    }
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

/** GET /api/assessments?student_id= — staff view */
router.get('/', canManage, async (req, res, next) => {
  try {
    const { student_id } = req.query;
    if (!student_id) return res.status(400).json({ error: 'student_id required' });
    const { rows } = await query(`
      SELECT a.*, g.name AS group_name, sub.name AS subject_name
      FROM assessments a JOIN groups g ON g.id = a.group_id JOIN subjects sub ON sub.id = g.subject_id
      WHERE a.tenant_id = $1 AND a.student_id = $2 ORDER BY a.created_at DESC`, [req.tid, student_id]);
    res.json(rows);
  } catch (e) { next(e); }
});

/** PATCH /api/assessments/:id */
router.patch('/:id', canManage, async (req, res, next) => {
  try {
    const old = await query('SELECT * FROM assessments WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Assessment not found' });
    const allowed = ['academic_level', 'participation', 'homework_commitment', 'behavior', 'strengths',
      'weaknesses', 'recommendation', 'parent_followup', 'notes', 'parent_visible'];
    const sets = [], vals = [];
    let i = 2;
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = $${i++}`); vals.push(v);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(Number(req.params.id));
    const { rows } = await query(`UPDATE assessments SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $${i} RETURNING *`, vals);
    await audit(req.tid, req.user.id, 'update', 'assessment', req.params.id, old.rows[0], rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
