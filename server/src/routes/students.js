const router = require('express').Router();
const crypto = require('crypto');
const { query, withTransaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit, assertPlanLimit } = require('../middleware/guards');

router.use(tenantScope);
const bcrypt = require('bcryptjs');

const STUDENT_SELECT = `
  SELECT s.*, g.name AS grade_name, g.stage, c.name AS curriculum_name, b.name AS branch_name
  FROM students s
  LEFT JOIN grade_levels g ON g.id = s.grade_level_id
  LEFT JOIN curricula c ON c.id = s.curriculum_id
  LEFT JOIN branches b ON b.id = s.branch_id`;

/** GET /api/students — list with search & filters */
router.get('/', requireRole('owner', 'admin', 'branch_manager', 'finance', 'reception', 'teacher'), async (req, res, next) => {
  try {
    const { q, branch_id, grade_level_id, status, limit = 50, offset = 0 } = req.query;
    const where = ['s.tenant_id = $1'];
    const vals = [req.tid];
    let i = 2;
    if (q) { where.push(`(s.name ILIKE $${i} OR s.student_code ILIKE $${i})`); vals.push(`%${q}%`); i++; }
    if (branch_id) { where.push(`s.branch_id = $${i}`); vals.push(branch_id); i++; }
    if (grade_level_id) { where.push(`s.grade_level_id = $${i}`); vals.push(grade_level_id); i++; }
    if (status) { where.push(`s.status = $${i}`); vals.push(status); i++; }
    if (req.user.role === 'branch_manager' && req.user.branch_id) {
      where.push(`s.branch_id = $${i}`); vals.push(req.user.branch_id); i++;
    }
    const { rows } = await query(
      `${STUDENT_SELECT} WHERE ${where.join(' AND ')} ORDER BY s.name LIMIT $${i} OFFSET $${i + 1}`,
      [...vals, Number(limit), Number(offset)]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

/** GET /api/students/:id — full profile incl guardians & enrollments */
router.get('/:id', requireRole('owner', 'admin', 'branch_manager', 'finance', 'reception', 'teacher'), async (req, res, next) => {
  try {
    const { rows } = await query(`${STUDENT_SELECT} WHERE s.tenant_id = $1 AND s.id = $2`, [req.tid, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Student not found' });
    const student = rows[0];
    const [guardians, enrollments] = await Promise.all([
      query(`SELECT p.*, sg.is_primary FROM parents p JOIN student_guardians sg ON sg.parent_id = p.id
             WHERE sg.student_id = $1 AND p.tenant_id = $2`, [req.params.id, req.tid]),
      query(`SELECT e.*, gr.name AS group_name, sub.name AS subject_name, t.name AS teacher_name, b.name AS branch_name
             FROM enrollments e
             JOIN groups gr ON gr.id = e.group_id
             JOIN subjects sub ON sub.id = gr.subject_id
             LEFT JOIN teachers t ON t.id = gr.teacher_id
             LEFT JOIN branches b ON b.id = gr.branch_id
             WHERE e.student_id = $1 AND e.tenant_id = $2
             ORDER BY e.enrolled_at DESC`, [req.params.id, req.tid]),
    ]);
    delete student.qr_token; // don't leak token in list/profile views
    res.json({ ...student, guardians: guardians.rows, enrollments: enrollments.rows });
  } catch (e) { next(e); }
});

/** POST /api/students — register student (+ optional guardian creation & enrollments) */
router.post('/', requireRole('owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const { student, guardians = [], enrollments = [] } = req.body;
    if (!student || !student.name || !String(student.name).trim()) {
      return res.status(400).json({ error: 'Student name is required' });
    }
    await assertPlanLimit(req.tid, 'students');
    const code = student.student_code || `STU-${Date.now().toString(36).toUpperCase()}`;
    const qr = crypto.randomBytes(24).toString('hex');

    const created = await withTransaction(async (client) => {
      const generatedPasswords = []; // collects auto-generated parent passwords across all guardians
      const s = await client.query(
        `INSERT INTO students (tenant_id, student_code, name, date_of_birth, gender, school_name,
           grade_level_id, curriculum_id, branch_id, previous_level, notes, qr_token)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [req.tid, code, student.name, student.date_of_birth || null, student.gender || null,
         student.school_name || null, student.grade_level_id || null, student.curriculum_id || null,
         student.branch_id || null, student.previous_level || null, student.notes || null, qr]
      );
      const st = s.rows[0];

      for (const g of guardians) {
        // find or create parent by mobile within tenant
        let p = await client.query('SELECT id FROM parents WHERE tenant_id = $1 AND mobile = $2', [req.tid, g.mobile]);
        let parentId;
        if (p.rows[0]) {
          parentId = p.rows[0].id;
        } else {
          let userId = null;
          if (g.create_account !== false) {
            // SECURITY: never use a guessable default password — generate a strong random one
            // if the staff member did not supply one, and return it once so it can be shared with the parent.
            const accountPassword = g.password && String(g.password).length >= 8
              ? g.password
              : crypto.randomBytes(6).toString('base64url') + 'A1!';
            if (!g.password) generatedPasswords.push({ parent: g.name, mobile: g.mobile, temp_password: accountPassword });
            const u = await client.query(
              `INSERT INTO users (tenant_id, role, full_name, mobile, username, password_hash, locale)
               VALUES ($1,'parent',$2,$3,$4,$5,'ar') RETURNING id
               ON CONFLICT (mobile) DO UPDATE SET mobile = EXCLUDED.mobile RETURNING id`,
              [req.tid, g.name, g.mobile, `p_${crypto.randomBytes(4).toString('hex')}`,
               bcrypt.hashSync(accountPassword, 10)]
            );
            userId = u.rows[0].id;
          }
          const np = await client.query(
            `INSERT INTO parents (tenant_id, user_id, name, relationship, mobile, alt_mobile, email, emergency_contact)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [req.tid, userId, g.name, g.relationship || 'father', g.mobile, g.alt_mobile || null,
             g.email || null, g.emergency_contact || null]
          );
          parentId = np.rows[0].id;
        }
        await client.query(
          'INSERT INTO student_guardians (student_id, parent_id, is_primary) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [st.id, parentId, g.is_primary !== false]
        );
      }

      for (const e of enrollments) {
        const fee = e.fee_amount || null;
        const en = await client.query(
          `INSERT INTO enrollments (tenant_id, student_id, group_id, academic_year_id, term_id, status, fee_amount)
           VALUES ($1,$2,$3,$4,$5,'active',$6) RETURNING *`,
          [req.tid, st.id, e.group_id, e.academic_year_id, e.term_id, fee]
        );
        if (fee) {
          const f = await client.query(
            `INSERT INTO fees (tenant_id, student_id, enrollment_id, academic_year_id, fee_type, description, amount,
               total_after_discount, due_date)
             VALUES ($1,$2,$3,$4,'subject',$5,$6,$6,$7) RETURNING id`,
            [req.tid, st.id, en.rows[0].id, e.academic_year_id,
             `Subject fee — ${st.name}`, fee, e.due_date || null]
          );
          if (Array.isArray(e.installments) && e.installments.length) {
            let seq = 1;
            for (const inst of e.installments) {
              await client.query(
                'INSERT INTO installments (tenant_id, fee_id, seq, amount, due_date) VALUES ($1,$2,$3,$4,$5)',
                [req.tid, f.rows[0].id, seq++, inst.amount, inst.due_date || null]
              );
            }
          }
        }
      }
      return { student: st, generatedPasswords };
    });

    await audit(req.tid, req.user.id, 'create', 'student', created.student.id, null, { name: created.student.name }, req.ip);
    // One-time return of auto-generated parent passwords so staff can share them securely
    res.status(201).json({ ...created.student, ...(created.generatedPasswords.length ? { generated_parent_passwords: created.generatedPasswords } : {}) });
  } catch (e) { next(e); }
});

/** PATCH /api/students/:id */
router.patch('/:id', requireRole('owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const allowed = ['name', 'date_of_birth', 'gender', 'school_name', 'grade_level_id', 'curriculum_id',
      'branch_id', 'previous_level', 'notes', 'status'];
    const sets = [], vals = [];
    let i = 2;
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(Number(req.params.id));
    const old = await query('SELECT * FROM students WHERE tenant_id = $1 AND id = $2', [req.tid, req.params.id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Student not found' });
    const { rows } = await query(`UPDATE students SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $${i} RETURNING *`, vals);
    await audit(req.tid, req.user.id, 'update', 'student', req.params.id, old.rows[0], rows[0], req.ip);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** GET /api/students/:id/qr — staff can (re)fetch a student QR token */
router.get('/:id/qr', requireRole('owner', 'admin', 'branch_manager', 'reception', 'teacher'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT qr_token FROM students WHERE tenant_id = $1 AND id = $2', [req.tid, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Student not found' });
    res.json({ qr_token: rows[0].qr_token });
  } catch (e) { next(e); }
});

/** GET /api/students/:id/full-history — permanent CRM record across years */
router.get('/:id/full-history', requireRole('owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const sid = req.params.id;
    const [enr, att, pay, asm] = await Promise.all([
      query(`SELECT e.*, y.name AS year_name, t2.name AS term_name, g.name AS group_name, sub.name AS subject_name,
             tc.name AS teacher_name FROM enrollments e
             JOIN groups g ON g.id = e.group_id JOIN subjects sub ON sub.id = g.subject_id
             JOIN academic_years y ON y.id = e.academic_year_id JOIN terms t2 ON t2.id = e.term_id
             LEFT JOIN teachers tc ON tc.id = g.teacher_id
             WHERE e.student_id = $1 AND e.tenant_id = $2 ORDER BY y.start_date`, [sid, req.tid]),
      query(`SELECT a.session_date, a.status FROM attendance a WHERE a.student_id = $1 AND a.tenant_id = $2 ORDER BY a.session_date DESC LIMIT 100`, [sid, req.tid]),
      query(`SELECT p.amount, p.method, p.paid_at FROM payments p WHERE p.student_id = $1 AND p.tenant_id = $2 ORDER BY p.paid_at DESC LIMIT 50`, [sid, req.tid]),
      query(`SELECT * FROM assessments WHERE student_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`, [sid, req.tid]),
    ]);
    res.json({ enrollments: enr.rows, attendance: att.rows, payments: pay.rows, assessments: asm.rows });
  } catch (e) { next(e); }
});

module.exports = router;
