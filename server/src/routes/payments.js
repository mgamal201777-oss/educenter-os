const router = require('express').Router();
const crypto = require('crypto');
const { query, withTransaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');
const { notifyUser } = require('./notify');
const { getSettings } = require('../services/channels');

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

// ---------------------------------------------------------------- online payments (parents)

/** POST /api/payments/pay-request — parent initiates online payment for a fee */
router.post('/pay-request', async (req, res, next) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Parents only' });
    const { fee_id } = req.body || {};
    const fee = (await query('SELECT * FROM fees WHERE id = $1 AND tenant_id = $2', [fee_id, req.tid])).rows[0];
    if (!fee) return res.status(404).json({ error: 'Fee not found' });
    // parent must be a guardian of the student
    const pid = (await query('SELECT id FROM parents WHERE user_id = $1 AND tenant_id = $2', [req.user.id, req.tid])).rows[0]?.id;
    const owns = (await query('SELECT 1 FROM student_guardians WHERE parent_id = $1 AND student_id = $2', [pid, fee.student_id])).rows[0];
    if (!owns) return res.status(403).json({ error: 'Not your child' });

    const paid = (await query(`SELECT COALESCE(sum(amount),0) AS s FROM payments WHERE fee_id = $1 AND status = 'paid'`, [fee_id])).rows[0];
    const outstanding = Number(fee.total_after_discount) - Number(paid.s);
    if (outstanding <= 0) return res.status(400).json({ error: 'This fee is already fully paid' });

    const s = await getSettings();
    const token = crypto.randomBytes(24).toString('hex');
    const { rows } = await query(
      `INSERT INTO payment_requests (tenant_id, fee_id, student_id, parent_user_id, amount, provider, token)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.tid, fee_id, fee.student_id, req.user.id, outstanding, s.payment_gateway || 'manual', token]);

    let pay_url = null;
    if ((s.payment_gateway === 'paymob') && s.gateway_api_key && s.gateway_integration_id) {
      try {
        const auth = await fetch('https://accept.paymob.com/api/auth/tokens/', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: s.gateway_api_key }),
        }).then((r) => r.json());
        const order = await fetch('https://accept.paymob.com/api/ecommerce/orders/', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auth_token: auth.token, amount_cents: Math.round(outstanding * 100),
            currency: 'EGP', merchant_order_id: `req_${rows[0].id}`,
            items: [{ name: fee.fee_type || 'Tuition', amount_cents: Math.round(outstanding * 100), quantity: 1 }],
          }),
        }).then((r) => r.json());
        const bk = await fetch('https://accept.paymob.com/api/acceptance/payment_keys/paymob_pay/', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auth_token: auth.token, order_id: order.id, amount_cents: Math.round(outstanding * 100),
            currency: 'EGP', integration_id: Number(s.gateway_integration_id),
            billing_data: { first_name: req.user.full_name.split(' ')[0], last_name: req.user.full_name.split(' ').slice(-1)[0],
              email: req.user.email || 'parent@educenter.app', phone_number: req.user.mobile || '+201000000000',
              apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA', shipping_method: 'NA',
              postal_code: 'NA', city: 'NA', country: 'EG', state: 'NA' },
          }),
        }).then((r) => r.json());
        pay_url = `https://accept.paymob.com/api/acceptance/iframes/${s.gateway_integration_id}?payment_token=${bk.token}`;
        await query('UPDATE payment_requests SET provider_ref = $2 WHERE id = $1', [rows[0].id, String(order.id)]);
      } catch (e) {
        pay_url = null; // fall back to manual instructions
      }
    }
    res.status(201).json({
      request: rows[0], pay_url,
      track_url: `/api/pay/track/${token}`,
      instructions: s.payment_gateway === 'manual' || !pay_url,
      wallet_number: s.gateway_wallet_number || null,
    });
  } catch (e) { next(e); }
});

/** GET /api/payments/my-requests — parent's payment request history */
router.get('/my-requests', async (req, res, next) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Parents only' });
    const { rows } = await query(
      `SELECT pr.*, f.fee_type, st.name AS student_name
       FROM payment_requests pr JOIN fees f ON f.id = pr.fee_id JOIN students st ON st.id = pr.student_id
       WHERE pr.parent_user_id = $1 AND pr.tenant_id = $2 ORDER BY pr.created_at DESC LIMIT 50`,
      [req.user.id, req.tid]);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/payments/pay-request/:id/confirm — parent submits transfer/wallet reference (manual gateway) */
router.post('/pay-request/:id/confirm', async (req, res, next) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Parents only' });
    const pr = (await query('SELECT * FROM payment_requests WHERE id = $1 AND tenant_id = $2 AND parent_user_id = $3',
      [req.params.id, req.tid, req.user.id])).rows[0];
    if (!pr) return res.status(404).json({ error: 'Payment request not found' });
    if (pr.status !== 'pending') return res.status(400).json({ error: 'Request already ' + pr.status });
    const { reference } = req.body || {};
    if (!reference) return res.status(400).json({ error: 'Transaction reference is required' });
    const { rows } = await query(
      `UPDATE payment_requests SET reference = $3, status = 'paid', paid_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [pr.id, req.tid, reference]);
    // record as an online payment so finance sees it and can verify
    const p = await query(
      `INSERT INTO payments (tenant_id, fee_id, student_id, amount, method, reference, recorded_by, notes, status, paid_at)
       VALUES ($1,$2,$3,$4,'online',$5,$6,$7,'paid', now()) RETURNING *`,
      [req.tid, pr.fee_id, pr.student_id, pr.amount, reference, req.user.id,
       `Parent-submitted via portal. Pay request #${pr.id}`]);
    await recomputeFeeStatus(pr.fee_id, req.tid);
    res.json({ request: rows[0], payment: p.rows[0] });
  } catch (e) { next(e); }
});

/** GET /api/payments/requests — staff: all online pay requests (for verification) */
router.get('/requests', canRecord, async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = ['pr.tenant_id = $1'];
    const vals = [req.tid];
    if (status) { where.push('pr.status = $2'); vals.push(status); }
    const { rows } = await query(
      `SELECT pr.*, f.fee_type, st.name AS student_name, st.student_code, u.full_name AS parent_name
       FROM payment_requests pr
       JOIN fees f ON f.id = pr.fee_id JOIN students st ON st.id = pr.student_id
       LEFT JOIN users u ON u.id = pr.parent_user_id
       WHERE ${where.join(' AND ')} ORDER BY pr.created_at DESC LIMIT 200`, vals);
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
