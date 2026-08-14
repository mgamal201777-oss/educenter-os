const router = require('express').Router();
const { query, withTransaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');
const { notifyUser } = require('./notify');

router.use(tenantScope);
const canRecord = requireRole('owner', 'admin', 'branch_manager', 'reception', 'finance');

/** GET /api/payments — list */
router.get('/', requireRole('owner', 'admin', 'branch_manager', 'reception', 'finance'), async (req, res, next) => {
  try {
    const { student_id, method, from, to } = req.query;
    const where = ['p.tenant_id = $1'];
    const vals = [req.tid];
    let i = 2;
    if (student_id) { where.push(`p.student_id = $${i++}`); vals.push(student_id); }
    if (method) { where.push(`p.method = $${i++}`); vals.push(method); }
    if (from) { where.push(`p.paid_at >= $${i++}`); vals.push(from); }
    if (to) { where.push(`p.paid_at <= $${i++}`); vals.push(to); }
    const { rows } = await query(`
      SELECT p.*, s.name AS student_name, s.student_code, u.full_name AS recorded_by_name
      FROM payments p JOIN students s ON s.id = p.student_id
      LEFT JOIN users u ON u.id = p.recorded_by
      WHERE ${where.join(' AND ')} ORDER BY p.paid_at DESC, p.id DESC LIMIT 500`, vals);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/payments — record payment (cash/instapay/transfer/wallet/pos/online) */
router.post('/', canRecord, async (req, res, next) => {
  try {
    const { fee_id, installment_id, amount, method, paid_at, reference, receipt_no, notes } = req.body;
    const fee = (await query('SELECT * FROM fees WHERE id = $1 AND tenant_id = $2', [fee_id, req.tid])).rows[0];
    if (!fee) return res.status(404).json({ error: 'Fee not found' });

    const p = await query(
      `INSERT INTO payments (tenant_id, fee_id, student_id, installment_id, amount, method, paid_at, reference, receipt_no, recorded_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.tid, fee_id, fee.student_id, installment_id || null, amount, method, paid_at || new Date(),
       reference || null, receipt_no || null, req.user.id, notes || null]
    );

    // recompute fee & installment status
    await recomputeFeeStatus(fee_id, req.tid);
    if (installment_id) {
      const inst = (await query('SELECT * FROM installments WHERE id = $1', [installment_id])).rows[0];
      if (inst) {
        const paidOnInst = await query(
          `SELECT COALESCE(sum(amount),0) AS s FROM payments WHERE installment_id = $1 AND status = 'paid'`, [installment_id]);
        const newStatus = Number(paidOnInst.rows[0].s) >= Number(inst.amount) ? 'paid' : 'partial';
        await query('UPDATE installments SET status = $1 WHERE id = $2', [newStatus, installment_id]);
      }
    }

    // notify parents
    const parents = await query(
      `SELECT p2.user_id FROM student_guardians sg JOIN parents p2 ON p2.id = sg.parent_id
       WHERE sg.student_id = $1 AND p2.tenant_id = $2 AND p2.user_id IS NOT NULL`, [fee.student_id, req.tid]);
    for (const par of parents.rows) {
      if (par.user_id) await notifyUser(req.tid, par.user_id, 'payment',
        `Payment recorded: EGP ${amount}`, `Method: ${method}. Thank you.`, { fee_id });
    }

    await audit(req.tid, req.user.id, 'create', 'payment', p.rows[0].id, null, p.rows[0], req.ip);
    res.status(201).json(p.rows[0]);
  } catch (e) { next(e); }
});

/** PATCH /api/payments/:id — refund/cancel (audited, owner/admin/finance only) */
router.patch('/:id', requireRole('owner', 'admin', 'finance'), async (req, res, next) => {
  try {
    const old = await query('SELECT * FROM payments WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Payment not found' });
    const { rows } = await query('UPDATE payments SET status = $1, notes = COALESCE($2, notes) WHERE id = $3 AND tenant_id = $4 RETURNING *',
      [req.body.status, req.body.notes || null, req.params.id, req.tid]);
    await recomputeFeeStatus(old.rows[0].fee_id, req.tid);
    await audit(req.tid, req.user.id, 'payment_edit', 'payment', req.params.id, old.rows[0], rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

async function recomputeFeeStatus(feeId, tenantId) {
  const fee = (await query('SELECT * FROM fees WHERE id = $1', [feeId])).rows[0];
  if (!fee) return;
  const paid = (await query(`SELECT COALESCE(sum(amount),0) AS s FROM payments WHERE fee_id = $1 AND status = 'paid'`, [feeId])).rows[0];
  const total = Number(fee.total_after_discount);
  const p = Number(paid.s);
  let status = 'due';
  if (p >= total && total > 0) status = 'paid';
  else if (p > 0) status = 'partial';
  else if (fee.due_date && new Date(fee.due_date) < new Date()) status = 'overdue';
  await query('UPDATE fees SET status = $1 WHERE id = $2', [status, feeId]);
}

module.exports = router;
