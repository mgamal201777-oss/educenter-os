const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');

// All routes: super admin only
router.use(requireRole('super_admin'));

/** GET /api/super/tenants — list all centers with usage stats */
router.get('/tenants', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT t.*,
        (SELECT count(*) FROM branches b WHERE b.tenant_id = t.id) AS branch_count,
        (SELECT count(*) FROM students s WHERE s.tenant_id = t.id AND s.status = 'active') AS student_count,
        (SELECT count(*) FROM teachers tc WHERE tc.tenant_id = t.id) AS teacher_count
      FROM tenants t ORDER BY t.created_at DESC`);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/super/tenants — create a center + its first admin */
router.post('/tenants', async (req, res, next) => {
  try {
    const { name, slug, adminName, adminEmail, adminPassword, plan } = req.body;
    const bcrypt = require('bcryptjs');
    const t = await query(
      `INSERT INTO tenants (name, slug, plan, contact_name, contact_email)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, slug, plan || 'basic', adminName, adminEmail]
    );
    const tenant = t.rows[0];
    const u = await query(
      `INSERT INTO users (tenant_id, role, full_name, email, username, password_hash, locale)
       VALUES ($1,'owner',$2,$3,$4,$5,'ar') RETURNING id`,
      [tenant.id, adminName, adminEmail, slug + '-owner', bcrypt.hashSync(adminPassword, 10)]
    );
    await audit(null, req.user.id, 'create', 'tenant', tenant.id, null, { name, slug });
    res.status(201).json({ tenant, adminUserId: u.rows[0].id });
  } catch (e) { next(e); }
});

/** PATCH /api/super/tenants/:id — activate/suspend/plan */
router.patch('/tenants/:id', async (req, res, next) => {
  try {
    const allowed = ['status', 'plan', 'name', 'contact_name', 'contact_phone', 'contact_email'];
    const sets = [], vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(Number(req.params.id));
    const old = await query('SELECT * FROM tenants WHERE id = $1', [req.params.id]);
    const { rows } = await query(`UPDATE tenants SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`);
    if (!rows[0]) return res.status(404).json({ error: 'Tenant not found' });
    // suspend/activate cascades to users
    if (req.body.status) {
      await query(`UPDATE users SET status = $1 WHERE tenant_id = $2 AND role != 'owner'`,
        [req.body.status === 'active' ? 'active' : 'suspended', rows[0].id]);
    }
    await audit(null, req.user.id, 'update', 'tenant', rows[0].id, old.rows[0], rows[0]);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** GET /api/super/platform-stats */
router.get('/platform-stats', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        (SELECT count(*) FROM tenants WHERE status = 'active') AS active_tenants,
        (SELECT count(*) FROM tenants) AS total_tenants,
        (SELECT count(*) FROM students WHERE status = 'active') AS total_students,
        (SELECT count(*) FROM teachers) AS total_teachers,
        (SELECT count(*) FROM users WHERE role = 'parent') AS parent_accounts,
        (SELECT count(*) FROM payments WHERE status = 'paid') AS total_payments`);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
