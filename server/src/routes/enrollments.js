const router = require('express').Router();
const { query, withTransaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');

router.use(tenantScope);

/** GET /api/enrollments — list/filter */
router.get('/', requireRole('owner', 'admin', 'branch_manager', 'reception', 'finance'), async (req, res, next) => {
  try {
    const { student_id, group_id, status } = req.query;
    const where = ['e.tenant_id = $1'];
    const vals = [req.tid];
    let i = 2;
    if (student_id) { where.push(`e.student_id = $${i++}`); vals.push(student_id); }
    if (group_id) { where.push(`e.group_id = $${i++}`); vals.push(group_id); }
    if (status) { where.push(`e.status = $${i++}`); vals.push(status); }
    const { rows } = await query(`
      SELECT e.*, s.name AS student_name, s.student_code, g.name AS group_name, sub.name AS subject_name
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN groups g ON g.id = e.group_id
      JOIN subjects sub ON sub.id = g.subject_id
      WHERE ${where.join(' AND ')} ORDER BY e.enrolled_at DESC LIMIT 500`, vals);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/enrollments — enroll student in group (with capacity check + optional fee) */
router.post('/', requireRole('owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const { student_id, group_id, fee_amount, installments = [], due_date, override_capacity } = req.body;

    const g = await query('SELECT * FROM groups WHERE id = $1 AND tenant_id = $2', [group_id, req.tid]);
    if (!g.rows[0]) return res.status(404).json({ error: 'Group not found' });
    const count = await query(
      `SELECT count(*)::int AS n FROM enrollments WHERE group_id = $1 AND status = 'active'`, [group_id]);
    if (count.rows[0].n >= g.rows[0].max_capacity && !override_capacity) {
      return res.status(409).json({ error: 'Group is at full capacity', capacity: g.rows[0].max_capacity,
        can_override: ['owner', 'admin'].includes(req.user.role) });
    }

    const result = await withTransaction(async (client) => {
      const e = await client.query(
        `INSERT INTO enrollments (tenant_id, student_id, group_id, academic_year_id, term_id, status, fee_amount)
         VALUES ($1,$2,$3,$4,$5,'active',$6) RETURNING *`,
        [req.tid, student_id, group_id, g.rows[0].academic_year_id, g.rows[0].term_id, fee_amount || null]
      );
      if (fee_amount) {
        const f = await client.query(
          `INSERT INTO fees (tenant_id, student_id, enrollment_id, academic_year_id, fee_type, description, amount, total_after_discount, due_date)
           VALUES ($1,$2,$3,$4,'subject',$5,$6,$6,$7) RETURNING id`,
          [req.tid, student_id, e.rows[0].id, g.rows[0].academic_year_id, `Subject fee — group ${g.rows[0].name}`,
           fee_amount, due_date || null]
        );
        let seq = 1;
        if (installments.length) {
          for (const inst of installments) {
            await client.query('INSERT INTO installments (tenant_id, fee_id, seq, amount, due_date) VALUES ($1,$2,$3,$4,$5)',
              [req.tid, f.rows[0].id, seq++, inst.amount, inst.due_date || null]);
          }
        }
      }
      return e.rows[0];
    });

    await audit(req.tid, req.user.id, 'create', 'enrollment', result.id, null, result, req.ip);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

/** PATCH /api/enrollments/:id — status change */
router.patch('/:id', requireRole('owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const old = await query('SELECT * FROM enrollments WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tid]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Enrollment not found' });
    const { rows } = await query('UPDATE enrollments SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [req.body.status, req.params.id, req.tid]);
    await audit(req.tid, req.user.id, 'update', 'enrollment', req.params.id, old.rows[0], rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
