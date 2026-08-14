const router = require('express').Router();
const crypto = require('crypto');
const { query } = require('../db');

/**
 * Public registration endpoints (no auth).
 * Center is identified by ?center=<slug>.
 */

/** GET /api/public/centers — list active centers (for registration link chooser) */
router.get('/centers', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, name, slug FROM tenants WHERE status = $1 ORDER BY name', ['active']);
    res.json(rows);
  } catch (e) { next(e); }
});

/** GET /api/public/centers/:slug — registration form metadata */
router.get('/centers/:slug', async (req, res, next) => {
  try {
    const t = await query('SELECT id, name, slug FROM tenants WHERE slug = $1 AND status = $2', [req.params.slug, 'active']);
    if (!t.rows[0]) return res.status(404).json({ error: 'Center not found' });
    const [grades, subjects, branches] = await Promise.all([
      query('SELECT id, name FROM grade_levels WHERE tenant_id = $1 ORDER BY sort_order', [t.rows[0].id]),
      query('SELECT id, name FROM subjects WHERE tenant_id = $1 AND is_active', [t.rows[0].id]),
      query('SELECT id, name FROM branches WHERE tenant_id = $1 AND is_active', [t.rows[0].id]),
    ]);
    res.json({ center: t.rows[0], grade_levels: grades.rows, subjects: subjects.rows, branches: branches.rows });
  } catch (e) { next(e); }
});

/** POST /api/public/register — public/QR registration (creates lead + student pre-record) */
router.post('/register', async (req, res, next) => {
  try {
    if (process.env.PUBLIC_REGISTRATION_ENABLED === 'false') {
      return res.status(403).json({ error: 'Public registration is disabled' });
    }
    const { center: slug, student, guardian, branch_id, grade_level_id, subject_ids = [], source = 'website' } = req.body;
    const t = await query('SELECT id FROM tenants WHERE slug = $1 AND status = $2', [slug, 'active']);
    if (!t.rows[0]) return res.status(404).json({ error: 'Center not found' });
    const tid = t.rows[0].id;

    if (!student?.name || !guardian?.mobile) {
      return res.status(400).json({ error: 'Student name and guardian mobile are required' });
    }

    // create as LEAD (staff convert to student on confirmation)
    const { rows } = await query(
      `INSERT INTO leads (tenant_id, name, parent_name, mobile, source, branch_id, grade_level_id,
         subject_interest, stage, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'lead',$9) RETURNING *`,
      [tid, student.name, guardian.name || null, guardian.mobile, source, branch_id || null,
       grade_level_id || null, subject_ids.join(','), `Public registration. School: ${student.school_name || '-'}. DOB: ${student.date_of_birth || '-'}`]
    );
    res.status(201).json({ ok: true, reference: rows[0].id, message: 'Registration request received — the center will contact you.' });
  } catch (e) { next(e); }
});

module.exports = router;
