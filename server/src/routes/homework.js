const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');
const { notifyUsers } = require('./notify');

router.use(tenantScope);

async function teacherOwnsGroup(req, groupId) {
  const tid = (await query('SELECT id FROM teachers WHERE user_id = $1 AND tenant_id = $2', [req.user.id, req.tid])).rows[0]?.id;
  if (!tid) return false;
  const { rows } = await query('SELECT 1 FROM groups WHERE id = $1 AND tenant_id = $2 AND teacher_id = $3', [groupId, req.tid, tid]);
  return !!rows[0];
}

const canManage = requireRole('owner', 'admin', 'branch_manager', 'teacher', 'reception');

/** GET /api/homework?group_id= — list for group */
router.get('/', canManage, async (req, res, next) => {
  try {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });
    const { rows } = await query(`
      SELECT h.*,
        (SELECT count(*) FROM homework_submissions hs WHERE hs.homework_id = h.id AND hs.status IN ('submitted','late','reviewed')) AS submitted_count,
        (SELECT count(*) FROM homework_submissions hs WHERE hs.homework_id = h.id AND hs.status = 'reviewed') AS reviewed_count
      FROM homework h WHERE h.tenant_id = $1 AND h.group_id = $2 ORDER BY h.due_date DESC`, [req.tid, group_id]);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/homework — assign homework (creates submissions + parent notifications) */
router.post('/', requireRole('owner', 'admin', 'branch_manager', 'teacher'), async (req, res, next) => {
  try {
    const { group_id, title, description, due_date, attachment_url, link_url, max_score } = req.body;
    if (req.user.role === 'teacher' && !(await teacherOwnsGroup(req, group_id))) {
      return res.status(403).json({ error: 'Not your group' });
    }
    const h = await query(
      `INSERT INTO homework (tenant_id, group_id, title, description, due_date, attachment_url, link_url, max_score, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.tid, group_id, title, description, due_date, attachment_url || null, link_url || null, max_score || null, req.user.id]
    );
    // create "assigned" submission rows for every active student
    const roster = await query(
      `SELECT s.id FROM enrollments e JOIN students s ON s.id = e.student_id
       WHERE e.group_id = $1 AND e.tenant_id = $2 AND e.status = 'active'`, [group_id, req.tid]);
    for (const r of roster.rows) {
      await query('INSERT INTO homework_submissions (tenant_id, homework_id, student_id) VALUES ($1,$2,$3)',
        [req.tid, h.rows[0].id, r.id]);
    }
    await notifyUsers(req, 'homework', `Homework: ${title}`, `Due ${due_date}`, { group_id, homework_id: h.rows[0].id },
      'students_and_parents', group_id);
    res.status(201).json(h.rows[0]);
  } catch (e) { next(e); }
});

/** GET /api/homework/:id — detail + submissions (teacher review screen) */
router.get('/:id', canManage, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM homework WHERE tenant_id = $1 AND id = $2', [req.tid, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Homework not found' });
    const subs = await query(`
      SELECT hs.*, s.name AS student_name, s.student_code
      FROM homework_submissions hs JOIN students s ON s.id = hs.student_id
      WHERE hs.homework_id = $1 ORDER BY s.name`, [req.params.id]);
    res.json({ ...rows[0], submissions: subs.rows });
  } catch (e) { next(e); }
});

/** PATCH /api/homework/submissions/:id — review/score */
router.patch('/submissions/:id', requireRole('owner', 'admin', 'branch_manager', 'teacher'), async (req, res, next) => {
  try {
    const old = await query('SELECT * FROM homework_submissions WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Submission not found' });
    const { rows } = await query(
      `UPDATE homework_submissions SET status = $1, score = $2, feedback = $3, updated_at = now()
       WHERE id = $4 AND tenant_id = $5 RETURNING *`,
      [req.body.status || 'reviewed', req.body.score ?? null, req.body.feedback || null, req.params.id, req.tid]
    );
    await audit(req.tid, req.user.id, 'update', 'homework_submission', req.params.id, old.rows[0], rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
