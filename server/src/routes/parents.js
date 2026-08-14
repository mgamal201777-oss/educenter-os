const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');

router.use(tenantScope);

/** GET /api/parents — list with children count */
router.get('/', requireRole('owner', 'admin', 'branch_manager', 'finance', 'reception'), async (req, res, next) => {
  try {
    const { q } = req.query;
    let sql = `SELECT p.*,
        (SELECT count(*) FROM student_guardians sg WHERE sg.parent_id = p.id) AS children_count
      FROM parents p WHERE p.tenant_id = $1`;
    const vals = [req.tid];
    if (q) { sql += ' AND (p.name ILIKE $2 OR p.mobile ILIKE $2)'; vals.push(`%${q}%`); }
    sql += ' ORDER BY p.name';
    const { rows } = await query(sql, vals);
    res.json(rows);
  } catch (e) { next(e); }
});

/** GET /api/parents/:id — parent + children */
router.get('/:id', requireRole('owner', 'admin', 'branch_manager', 'finance', 'reception'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM parents WHERE tenant_id = $1 AND id = $2', [req.tid, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Parent not found' });
    const kids = await query(
      `SELECT s.id, s.name, s.student_code, g.name AS grade_name FROM students s
       JOIN student_guardians sg ON sg.student_id = s.id
       LEFT JOIN grade_levels g ON g.id = s.grade_level_id
       WHERE sg.parent_id = $1 AND s.tenant_id = $2`, [req.params.id, req.tid]);
    res.json({ ...rows[0], children: kids.rows });
  } catch (e) { next(e); }
});

/** PATCH /api/parents/:id */
router.patch('/:id', requireRole('owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const allowed = ['name', 'relationship', 'mobile', 'alt_mobile', 'email', 'emergency_contact'];
    const sets = [], vals = [];
    let i = 2;
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = $${i++}`); vals.push(v);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(Number(req.params.id));
    const { rows } = await query(`UPDATE parents SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $${i} RETURNING *`, vals);
    if (!rows[0]) return res.status(404).json({ error: 'Parent not found' });
    await audit(req.tid, req.user.id, 'update', 'parent', req.params.id, null, rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
