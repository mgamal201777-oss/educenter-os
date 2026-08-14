const router = require('express').Router();
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { tenantScope } = require('../middleware/guards');

router.use(tenantScope);

/** GET /api/schedules — weekly timetable (staff view) */
router.get('/', requireRole('owner', 'admin', 'branch_manager', 'reception', 'finance'), async (req, res, next) => {
  try {
    const { branch_id, day } = req.query;
    const where = ['g.tenant_id = $1'];
    const vals = [req.tid];
    let i = 2;
    if (branch_id) { where.push(`g.branch_id = $${i++}`); vals.push(branch_id); }
    if (day !== undefined) { where.push(`gs.day_of_week = $${i++}`); vals.push(day); }
    if (req.user.role === 'branch_manager' && req.user.branch_id) {
      where.push(`g.branch_id = $${i++}`); vals.push(req.user.branch_id);
    }
    const { rows } = await query(`
      SELECT gs.id, gs.day_of_week, gs.start_time, gs.end_time,
        g.id AS group_id, g.name AS group_name, b.name AS branch_name,
        sub.name AS subject_name, t.name AS teacher_name, c.name AS classroom_name
      FROM group_schedules gs
      JOIN groups g ON g.id = gs.group_id
      JOIN branches b ON b.id = g.branch_id
      JOIN subjects sub ON sub.id = g.subject_id
      LEFT JOIN teachers t ON t.id = g.teacher_id
      LEFT JOIN classrooms c ON c.id = g.classroom_id
      WHERE ${where.join(' AND ')}
      ORDER BY gs.day_of_week, gs.start_time`, vals);
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
