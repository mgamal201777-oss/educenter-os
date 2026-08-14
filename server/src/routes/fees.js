const router = require('express').Router();
const { query, withTransaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');
const { notifyUser } = require('./notify');

router.use(tenantScope);
const canView = requireRole('owner', 'admin', 'branch_manager', 'finance', 'reception');

/** GET /api/fees — list with filters; overdue auto-flag */
router.get('/', canView, async (req, res, next) => {
  try {
    const { student_id, status } = req.query;
    const where = ['f.tenant_id = $1'];
    const vals = [req.tid];
    let i = 2;
    if (student_id) { where.push(`f.student_id = $${i++}`); vals.push(student_id); }
    if (status) { where.push(`f.status = $${i++}`); vals.push(status); }
    const { rows } = await query(`
      SELECT f.*, s.name AS student_name, s.student_code,
        (SELECT COALESCE(sum(p.amount),0) FROM payments p WHERE p.fee_id = f.id AND p.status = 'paid') AS paid_amount
      FROM fees f JOIN students s ON s.id = f.student_id
      WHERE ${where.join(' AND ')}
      ORDER BY f.created_at DESC LIMIT 500`, vals);
    res.json(rows.map((r) => ({
      ...r,
      outstanding: Number(r.total_after_discount) - Number(r.paid_amount),
    })));
  } catch (e) { next(e); }
});

/** GET /api/fees/summary — finance dashboard numbers */
router.get('/summary', canView, async (req, res, next) => {
  try {
    const { branch_id } = req.query;
    let extra = '';
    const vals = [req.tid];
    if (branch_id) { extra = ' AND s.branch_id = $2'; vals.push(branch_id); }
    const { rows } = await query(`
      SELECT
        COALESCE(sum(f.total_after_discount),0) AS expected,
        COALESCE((SELECT sum(p.amount) FROM payments p JOIN fees f2 ON f2.id = p.fee_id
          JOIN students s2 ON s2.id = f2.student_id
          WHERE p.tenant_id = $1 AND p.status = 'paid' ${extra.replace(/s\.branch_id|s2\.branch_id/g, 's2.branch_id')}),0) AS collected,
        COALESCE(sum(f.total_after_discount) FILTER (WHERE f.status = 'overdue'),0) AS overdue
      FROM fees f JOIN students s ON s.id = f.student_id
      WHERE 1=1 ${extra}`, vals);
    const expected = Number(rows[0].expected);
    const collected = Number(rows[0].collected);
    res.json({
      expected, collected,
      outstanding: expected - collected,
      overdue: Number(rows[0].overdue),
      collection_pct: expected > 0 ? Number(((collected / expected) * 100).toFixed(1)) : 0,
    });
  } catch (e) { next(e); }
});

/** GET /api/fees/by-dimension — revenue by branch / grade / subject / method */
router.get('/by-dimension', canView, async (req, res, next) => {
  try {
    const [byBranch, byGrade, bySubject, byMethod] = await Promise.all([
      query(`SELECT b.name, COALESCE(sum(p.amount),0) AS total FROM payments p
        JOIN students s ON s.id = p.student_id JOIN branches b ON b.id = s.branch_id
        WHERE p.tenant_id = $1 AND p.status = 'paid' GROUP BY b.name ORDER BY total DESC`, [req.tid]),
      query(`SELECT g.name, COALESCE(sum(p.amount),0) AS total FROM payments p
        JOIN students s ON s.id = p.student_id JOIN grade_levels g ON g.id = s.grade_level_id
        WHERE p.tenant_id = $1 AND p.status = 'paid' GROUP BY g.name ORDER BY total DESC`, [req.tid]),
      query(`SELECT sub.name, COALESCE(sum(p.amount),0) AS total FROM payments p
        JOIN fees f ON f.id = p.fee_id JOIN enrollments e ON e.id = f.enrollment_id
        JOIN groups gr ON gr.id = e.group_id JOIN subjects sub ON sub.id = gr.subject_id
        WHERE p.tenant_id = $1 AND p.status = 'paid' GROUP BY sub.name ORDER BY total DESC`, [req.tid]),
      query(`SELECT method, COALESCE(sum(amount),0) AS total, count(*) AS n FROM payments
        WHERE tenant_id = $1 AND status = 'paid' GROUP BY method ORDER BY total DESC`, [req.tid]),
    ]);
    res.json({ by_branch: byBranch.rows, by_grade: byGrade.rows, by_subject: bySubject.rows, by_method: byMethod.rows });
  } catch (e) { next(e); }
});

/** POST /api/fees — create fee with optional installments */
router.post('/', canView, async (req, res, next) => {
  try {
    const { student_id, enrollment_id, academic_year_id, fee_type, description, amount,
      discount_id, discount_amount = 0, due_date, installments = [] } = req.body;
    const total = Number(amount) - Number(discount_amount);
    const f = await query(
      `INSERT INTO fees (tenant_id, student_id, enrollment_id, academic_year_id, fee_type, description,
         amount, discount_id, discount_amount, total_after_discount, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.tid, student_id, enrollment_id || null, academic_year_id || null, fee_type, description,
       amount, discount_id || null, discount_amount, total, due_date || null]
    );
    let seq = 1;
    for (const inst of installments) {
      await query('INSERT INTO installments (tenant_id, fee_id, seq, amount, due_date) VALUES ($1,$2,$3,$4,$5)',
        [req.tid, f.rows[0].id, seq++, inst.amount, inst.due_date || null]);
    }
    await audit(req.tid, req.user.id, 'create', 'fee', f.rows[0].id, null, f.rows[0], req.ip);
    res.status(201).json(f.rows[0]);
  } catch (e) { next(e); }
});

/** GET /api/fees/:id — fee + installments + payments */
router.get('/:id', canView, async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT f.*, s.name AS student_name, s.student_code FROM fees f JOIN students s ON s.id = f.student_id
      WHERE f.tenant_id = $1 AND f.id = $2`, [req.tid, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Fee not found' });
    const [insts, pays] = await Promise.all([
      query('SELECT * FROM installments WHERE fee_id = $1 ORDER BY seq', [req.params.id]),
      query(`SELECT p.*, u.full_name AS recorded_by_name FROM payments p LEFT JOIN users u ON u.id = p.recorded_by
             WHERE p.fee_id = $1 ORDER BY p.paid_at DESC`, [req.params.id]),
    ]);
    const paid = pays.rows.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
    res.json({ ...rows[0], installments: insts.rows, payments: pays.rows,
      paid_amount: paid, outstanding: Number(rows[0].total_after_discount) - paid });
  } catch (e) { next(e); }
});

/** PATCH /api/fees/:id — mark overdue / cancel */
router.patch('/:id', requireRole('owner', 'admin', 'finance'), async (req, res, next) => {
  try {
    const old = await query('SELECT * FROM fees WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Fee not found' });
    const { rows } = await query('UPDATE fees SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [req.body.status, req.params.id, req.tid]);
    await audit(req.tid, req.user.id, 'payment_edit', 'fee', req.params.id, old.rows[0], rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
