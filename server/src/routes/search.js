const router = require('express').Router();
const { query } = require('../db');
const { tenantScope } = require('../middleware/guards');

router.use(tenantScope);

/** GET /api/search?q= — global search across entities (role-scoped) */
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ students: [], parents: [], teachers: [], groups: [] });
    const like = `%${q}%`;
    const staffOnly = ['owner', 'admin', 'branch_manager', 'reception', 'finance'].includes(req.user.role);
    if (!staffOnly) return res.json({ students: [], parents: [], teachers: [], groups: [] });

    const [students, parents, teachers, groups] = await Promise.all([
      query(`SELECT id, name, student_code FROM students WHERE tenant_id = $1
        AND (name ILIKE $2 OR student_code ILIKE $2) LIMIT 10`, [req.tid, like]),
      query(`SELECT id, name, mobile FROM parents WHERE tenant_id = $1
        AND (name ILIKE $2 OR mobile ILIKE $2) LIMIT 10`, [req.tid, like]),
      query(`SELECT id, name, mobile FROM teachers WHERE tenant_id = $1
        AND (name ILIKE $2 OR mobile ILIKE $2) LIMIT 10`, [req.tid, like]),
      query(`SELECT g.id, g.name, b.name AS branch FROM groups g JOIN branches b ON b.id = g.branch_id
        WHERE g.tenant_id = $1 AND g.name ILIKE $2 LIMIT 10`, [req.tid, like]),
    ]);
    res.json({ students: students.rows, parents: parents.rows, teachers: teachers.rows, groups: groups.rows });
  } catch (e) { next(e); }
});

module.exports = router;
