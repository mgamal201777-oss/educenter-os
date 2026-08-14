const { query } = require('../db');

/**
 * In-app notification helper.
 * audience: 'students_and_parents' | 'parents' | 'students' — resolved via group enrollments.
 */
async function notifyUsers(req, type, title, body, data, audience, groupId) {
  try {
    const roles = audience === 'parents' ? ['parents'] : audience === 'students' ? ['students'] : ['students', 'parents'];
    const students = await query(
      `SELECT s.id FROM enrollments e JOIN students s ON s.id = e.student_id
       WHERE e.group_id = $1 AND e.tenant_id = $2 AND e.status = 'active'`, [groupId, req.tid]);
    const sids = students.rows.map((r) => r.id);
    if (!sids.length) return;

    const targets = new Set();

    if (roles.includes('students')) {
      const su = await query(
        `SELECT u.id FROM users u JOIN students s ON s.user_id = u.id
         WHERE u.tenant_id = $1 AND s.id = ANY($2::int[]) AND u.status = 'active'`, [req.tid, sids]);
      su.rows.forEach((r) => targets.add(r.id));
    }
    if (roles.includes('parents')) {
      const pu = await query(
        `SELECT DISTINCT p.user_id FROM student_guardians sg
         JOIN parents p ON p.id = sg.parent_id
         WHERE p.tenant_id = $1 AND sg.student_id = ANY($2::int[]) AND p.user_id IS NOT NULL AND p.status = 'active'`,
        [req.tid, sids]).catch(async () => {
          // parents table has no status column — retry without it
          return query(
            `SELECT DISTINCT p.user_id FROM student_guardians sg
             JOIN parents p ON p.id = sg.parent_id
             WHERE p.tenant_id = $1 AND sg.student_id = ANY($2::int[]) AND p.user_id IS NOT NULL`,
            [req.tid, sids]);
        });
      pu.rows.forEach((r) => r.user_id && targets.add(r.user_id));
    }

    for (const uid of targets) {
      await query(
        `INSERT INTO notifications (tenant_id, user_id, type, title, body, data)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [req.tid, uid, type, title, body, JSON.stringify(data || {})]
      );
    }
  } catch (e) {
    console.error('[notify] failed:', e.message);
  }
}

/** Notify a single user directly. */
async function notifyUser(tenantId, userId, type, title, body, data) {
  await query(
    `INSERT INTO notifications (tenant_id, user_id, type, title, body, data)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [tenantId, userId, type, title, body, JSON.stringify(data || {})]
  ).catch(() => {});
}

module.exports = { notifyUsers, notifyUser };
