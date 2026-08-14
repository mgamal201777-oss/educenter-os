const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');
const { notifyUsers } = require('./notify');

router.use(tenantScope);

/** GET /api/announcements — visible to current user (role-aware) */
router.get('/', async (req, res, next) => {
  try {
    let rows;
    if (['owner', 'admin', 'branch_manager', 'reception', 'finance'].includes(req.user.role)) {
      const r = await query('SELECT * FROM announcements WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100', [req.tid]);
      rows = r.rows;
    } else if (req.user.role === 'teacher') {
      const r = await query(`
        SELECT DISTINCT a.* FROM announcements a
        LEFT JOIN groups g ON g.id = a.group_id
        LEFT JOIN teachers t ON t.id = g.teacher_id
        WHERE a.tenant_id = $1 AND (a.audience IN ('center','branch','grade','subject') OR t.user_id = $2)
        ORDER BY a.created_at DESC LIMIT 100`, [req.tid, req.user.id]);
      rows = r.rows;
    } else {
      // parent / student — match by group membership
      const ctx = req.user.role === 'parent'
        ? await query(`SELECT DISTINCT e.group_id FROM student_guardians sg
            JOIN enrollments e ON e.student_id = sg.student_id
            JOIN parents p ON p.id = sg.parent_id WHERE p.user_id = $1 AND p.tenant_id = $2`, [req.user.id, req.tid])
        : await query(`SELECT DISTINCT e.group_id FROM enrollments e
            JOIN students s ON s.id = e.student_id WHERE s.user_id = $1 AND s.tenant_id = $2`, [req.user.id, req.tid]);
      const gids = ctx.rows.map((r) => r.group_id);
      if (gids.length) {
        const r = await query(`
          SELECT * FROM announcements WHERE tenant_id = $1
          AND (audience IN ('center','branch','grade','subject') OR (audience = 'group' AND group_id = ANY($2::int[])))
          ORDER BY created_at DESC LIMIT 100`, [req.tid, gids]);
        rows = r.rows;
      } else {
        rows = [];
      }
    }
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/announcements — create + fan-out notifications */
router.post('/', requireRole('owner', 'admin', 'branch_manager', 'reception'), async (req, res, next) => {
  try {
    const { title, body, audience = 'center', branch_id, grade_level_id, subject_id, group_id } = req.body;
    const { rows } = await query(
      `INSERT INTO announcements (tenant_id, title, body, audience, branch_id, grade_level_id, subject_id, group_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.tid, title, body, audience, branch_id || null, grade_level_id || null, subject_id || null, group_id || null, req.user.id]
    );
    // fan out to group if targeted
    if (group_id) {
      await notifyUsers(req, 'announcement', title, body, { announcement_id: rows[0].id }, 'students_and_parents', group_id);
    }
    await audit(req.tid, req.user.id, 'create', 'announcement', rows[0].id, null, rows[0], req.ip);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
