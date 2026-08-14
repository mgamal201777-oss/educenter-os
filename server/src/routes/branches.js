const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');

router.use(tenantScope);

/** GET /api/branches — list (staff) */
router.get('/', requireRole('owner', 'admin', 'branch_manager', 'finance', 'reception', 'teacher'), async (req, res, next) => {
  try {
    // branch managers & teachers only see their own branch
    if (['branch_manager', 'teacher'].includes(req.user.role) && req.user.branch_id) {
      const { rows } = await query('SELECT * FROM branches WHERE id = $1 AND tenant_id = $2', [req.user.branch_id, req.tid]);
      return res.json(rows);
    }
    const { rows } = await query('SELECT * FROM branches WHERE tenant_id = $1 ORDER BY id', [req.tid]);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/branches */
router.post('/', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { name, governorate, city, address, phone, opening_hours } = req.body;
    const { rows } = await query(
      `INSERT INTO branches (tenant_id, name, governorate, city, address, phone, opening_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.tid, name, governorate, city, address, phone, opening_hours]
    );
    await audit(req.tid, req.user.id, 'create', 'branch', rows[0].id, null, rows[0], req.ip);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

/** PATCH /api/branches/:id */
router.patch('/:id', requireRole('owner', 'admin', 'branch_manager'), async (req, res, next) => {
  try {
    if (req.user.role === 'branch_manager' && Number(req.params.id) !== req.user.branch_id) {
      return res.status(403).json({ error: 'Out of your branch scope' });
    }
    const allowed = ['name', 'governorate', 'city', 'address', 'phone', 'opening_hours', 'is_active'];
    const sets = [], vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = $${++i}`);
      vals.push(v);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.unshift(req.tid, Number(req.params.id));
    const { rows } = await query(`UPDATE branches SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`, vals);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    await audit(req.tid, req.user.id, 'update', 'branch', rows[0].id, null, rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
