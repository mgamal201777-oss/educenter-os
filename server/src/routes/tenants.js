const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');

router.use(tenantScope);

/** GET /api/tenants/me — current center profile + settings */
router.get('/me', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM tenants WHERE id = $1', [req.tid]);
    if (!rows[0]) return res.status(404).json({ error: 'Center not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** PATCH /api/tenants/me — update center settings (owner/admin) */
router.patch('/me', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const allowed = ['name', 'logo_url', 'contact_name', 'contact_phone', 'contact_email', 'settings'];
    const sets = [], vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = $${i++}`);
      vals.push(typeof v === 'object' ? JSON.stringify(v) : v);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.tid);
    const old = await query('SELECT * FROM tenants WHERE id = $1', [req.tid]);
    const { rows } = await query(`UPDATE tenants SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`);
    await audit(req.tid, req.user.id, 'update', 'tenant', req.tid, old.rows[0], rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
