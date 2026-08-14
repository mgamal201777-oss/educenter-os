const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');

router.use(tenantScope);

const PIPELINE = ['lead', 'contacted', 'trial', 'interested', 'registration_pending', 'registered', 'paid', 'active', 'lost'];

/** GET /api/leads — pipeline list + conversion stats */
router.get('/', requireRole('owner', 'admin', 'branch_manager', 'reception', 'finance'), async (req, res, next) => {
  try {
    const { stage, source } = req.query;
    const where = ['l.tenant_id = $1'];
    const vals = [req.tid];
    let i = 2;
    if (stage) { where.push(`l.stage = $${i++}`); vals.push(stage); }
    if (source) { where.push(`l.source = $${i++}`); vals.push(source); }
    const { rows } = await query(`
      SELECT l.*, g.name AS grade_name, b.name AS branch_name,
        (SELECT count(*) FROM crm_activities ca WHERE ca.lead_id = l.id) AS activity_count
      FROM leads l
      LEFT JOIN grade_levels g ON g.id = l.grade_level_id
      LEFT JOIN branches b ON b.id = l.branch_id
      WHERE ${where.join(' AND ')}
      ORDER BY l.created_at DESC LIMIT 500`, vals);
    res.json(rows);
  } catch (e) { next(e); }
});

/** GET /api/leads/stats — acquisition & conversion dashboard data */
router.get('/stats', requireRole('owner', 'admin', 'branch_manager', 'reception', 'finance'), async (req, res, next) => {
  try {
    const bySource = await query(`
      SELECT source,
        count(*) AS leads,
        count(*) FILTER (WHERE stage NOT IN ('lead','contacted','lost')) AS registrations
      FROM leads WHERE tenant_id = $1 GROUP BY source`, [req.tid]);
    const byStage = await query(
      'SELECT stage, count(*) AS n FROM leads WHERE tenant_id = $1 GROUP BY stage', [req.tid]);
    const totals = await query(`
      SELECT count(*) AS total_leads,
        count(*) FILTER (WHERE stage NOT IN ('lead','contacted','lost')) AS total_registrations
      FROM leads WHERE tenant_id = $1`, [req.tid]);
    res.json({ by_source: bySource.rows, by_stage: byStage.rows, totals: totals.rows[0], pipeline: PIPELINE });
  } catch (e) { next(e); }
});

/** POST /api/leads — create lead */
router.post('/', requireRole('owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const { name, parent_name, mobile, source, branch_id, grade_level_id, subject_interest, notes } = req.body;
    const { rows } = await query(
      `INSERT INTO leads (tenant_id, name, parent_name, mobile, source, branch_id, grade_level_id, subject_interest, notes, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.tid, name, parent_name, mobile, source || 'walkin', branch_id, grade_level_id, subject_interest, notes, req.user.id]
    );
    await audit(req.tid, req.user.id, 'create', 'lead', rows[0].id, null, rows[0], req.ip);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

/** PATCH /api/leads/:id — move stage (logged as CRM activity) */
router.patch('/:id', requireRole('owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const old = await query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Lead not found' });
    const allowed = ['name', 'parent_name', 'mobile', 'source', 'branch_id', 'grade_level_id', 'subject_interest', 'notes', 'stage', 'assigned_to'];
    const sets = [], vals = [];
    let i = 2;
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = $${i++}`); vals.push(v);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    sets.push('updated_at = now()');
    vals.push(Number(req.params.id));
    const { rows } = await query(`UPDATE leads SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $${i} RETURNING *`, vals);
    if (req.body.stage && req.body.stage !== old.rows[0].stage) {
      await query('INSERT INTO crm_activities (tenant_id, lead_id, user_id, type, content) VALUES ($1,$2,$3,$4,$4)',
        [req.tid, req.params.id, req.user.id, `stage: ${old.rows[0].stage} → ${req.body.stage}`]);
    }
    await audit(req.tid, req.user.id, 'update', 'lead', req.params.id, old.rows[0], rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** POST /api/leads/:id/activities — call/whatsapp/visit log */
router.post('/:id/activities', requireRole('owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const { type, content } = req.body;
    const { rows } = await query(
      'INSERT INTO crm_activities (tenant_id, lead_id, user_id, type, content) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.tid, req.params.id, req.user.id, type, content]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

/** GET /api/leads/:id — lead + activities */
router.get('/:id', requireRole('owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid]);
    if (!rows[0]) return res.status(404).json({ error: 'Lead not found' });
    const acts = await query('SELECT * FROM crm_activities WHERE lead_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json({ ...rows[0], activities: acts.rows });
  } catch (e) { next(e); }
});

module.exports = router;
