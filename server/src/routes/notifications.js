const router = require('express').Router();
const { query } = require('../db');

// personal notifications for the logged-in user (any role)

/** GET /api/notifications — my notifications */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/notifications/read — mark read (single or all) */
router.post('/read', async (req, res, next) => {
  try {
    if (req.body.id) {
      await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.body.id, req.user.id]);
    } else {
      await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
