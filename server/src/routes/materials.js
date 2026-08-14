const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope } = require('../middleware/guards');
const { notifyUsers } = require('./notify');

router.use(tenantScope);

/** GET /api/materials?group_id= — list materials for group */
router.get('/', requireRole('teacher', 'owner', 'admin', 'branch_manager', 'reception', 'student', 'parent'), async (req, res, next) => {
  try {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });
    const { rows } = await query(
      'SELECT * FROM materials WHERE tenant_id = $1 AND group_id = $2 ORDER BY created_at DESC', [req.tid, group_id]);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/materials — upload/share material link */
router.post('/', requireRole('owner', 'admin', 'branch_manager', 'teacher'), async (req, res, next) => {
  try {
    const { group_id, title, type = 'pdf', url } = req.body;
    const { rows } = await query(
      `INSERT INTO materials (tenant_id, group_id, title, type, url, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.tid, group_id, title, type, url, req.user.id]
    );
    await notifyUsers(req, 'announcement', `New material: ${title}`, '', { group_id }, 'students_and_parents', group_id);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

/** DELETE /api/materials/:id */
router.delete('/:id', requireRole('owner', 'admin', 'branch_manager', 'teacher'), async (req, res, next) => {
  try {
    await query('DELETE FROM materials WHERE tenant_id = $1 AND id = $2', [req.tid, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
