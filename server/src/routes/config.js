const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');

router.use(tenantScope);

// Academic configuration: curricula, academic_years, terms, grade_levels, subjects, classrooms, grading_weights, discounts

/** GET /api/config — everything needed for setup screens in one call */
router.get('/', async (req, res, next) => {
  try {
    const [curricula, years, terms, grades, subjects, classrooms, weights, discounts] = await Promise.all([
      query('SELECT * FROM curricula WHERE tenant_id = $1 ORDER BY id', [req.tid]),
      query('SELECT * FROM academic_years WHERE tenant_id = $1 ORDER BY start_date DESC', [req.tid]),
      query('SELECT t.* FROM terms t JOIN academic_years y ON y.id = t.academic_year_id WHERE y.tenant_id = $1 ORDER BY t.start_date', [req.tid]),
      query('SELECT * FROM grade_levels WHERE tenant_id = $1 ORDER BY sort_order', [req.tid]),
      query('SELECT * FROM subjects WHERE tenant_id = $1 ORDER BY id', [req.tid]),
      query(`SELECT c.*, b.name AS branch_name FROM classrooms c JOIN branches b ON b.id = c.branch_id
             WHERE c.tenant_id = $1 ORDER BY c.branch_id, c.name`, [req.tid]),
      query('SELECT * FROM grading_weights WHERE tenant_id = $1', [req.tid]),
      query('SELECT * FROM discounts WHERE tenant_id = $1 ORDER BY id', [req.tid]),
    ]);
    res.json({
      curricula: curricula.rows,
      academic_years: years.rows,
      terms: terms.rows,
      grade_levels: grades.rows,
      subjects: subjects.rows,
      classrooms: classrooms.rows,
      grading_weights: weights.rows,
      discounts: discounts.rows,
    });
  } catch (e) { next(e); }
});

// ---- generic CRUD helper for simple config tables ----
const TABLES = {
  curricula: { cols: ['name'], roles: ['owner', 'admin'] },
  'academic-years': { table: 'academic_years', cols: ['name', 'start_date', 'end_date', 'is_current'], roles: ['owner', 'admin'] },
  terms: { cols: ['academic_year_id', 'name', 'start_date', 'end_date', 'is_current'], roles: ['owner', 'admin'] },
  'grade-levels': { table: 'grade_levels', cols: ['name', 'stage', 'sort_order'], roles: ['owner', 'admin'] },
  subjects: { cols: ['name', 'name_en', 'is_active'], roles: ['owner', 'admin'] },
  classrooms: { cols: ['branch_id', 'name', 'capacity'], roles: ['owner', 'admin', 'branch_manager'] },
  'grading-weights': { table: 'grading_weights', cols: ['grade_level_id', 'component', 'weight'], roles: ['owner', 'admin'] },
  discounts: { cols: ['name', 'type', 'value', 'scope', 'is_active'], roles: ['owner', 'admin', 'finance'] },
};

for (const [path, cfg] of Object.entries(TABLES)) {
  const table = cfg.table || path.replace(/-/g, '_');

  router.post(`/${path}`, requireRole(...cfg.roles), async (req, res, next) => {
    try {
      const cols = cfg.cols.filter((c) => req.body[c] !== undefined);
      if (!cols.length) return res.status(400).json({ error: 'No valid fields' });
      const vals = cols.map((c) => {
        const v = req.body[c];
        return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
      });
      const ph = cols.map((_, i) => `$${i + 2}`).join(', ');
      const { rows } = await query(
        `INSERT INTO ${table} (tenant_id, ${cols.join(', ')}) VALUES ($1, ${ph}) RETURNING *`,
        [req.tid, ...vals]
      );
      await audit(req.tid, req.user.id, 'create', table, rows[0].id, null, rows[0], req.ip);
      res.status(201).json(rows[0]);
    } catch (e) { next(e); }
  });

  router.patch(`/${path}/:id`, requireRole(...cfg.roles), async (req, res, next) => {
    try {
      const cols = cfg.cols.filter((c) => req.body[c] !== undefined);
      if (!cols.length) return res.status(400).json({ error: 'No valid fields' });
      const sets = cols.map((c, i) => `${c} = $${i + 3}`).join(', ');
      const vals = cols.map((c) => {
        const v = req.body[c];
        return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
      });
      const old = await query(`SELECT * FROM ${table} WHERE id = $1 AND tenant_id = $2`, [req.params.id, req.tid]);
      if (!old.rows[0]) return res.status(404).json({ error: 'Not found' });
      const { rows } = await query(
        `UPDATE ${table} SET ${sets} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        [req.params.id, req.tid, ...vals]
      );
      await audit(req.tid, req.user.id, 'update', table, req.params.id, old.rows[0], rows[0], req.ip);
      res.json(rows[0]);
    } catch (e) { next(e); }
  });

  router.delete(`/${path}/:id`, requireRole(...cfg.roles), async (req, res, next) => {
    try {
      const old = await query(`SELECT * FROM ${table} WHERE id = $1 AND tenant_id = $2`, [req.params.id, req.tid]);
      if (!old.rows[0]) return res.status(404).json({ error: 'Not found' });
      await query(`DELETE FROM ${table} WHERE id = $1 AND tenant_id = $2`, [req.params.id, req.tid]);
      await audit(req.tid, req.user.id, 'delete', table, req.params.id, old.rows[0], null, req.ip);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
}

module.exports = router;
