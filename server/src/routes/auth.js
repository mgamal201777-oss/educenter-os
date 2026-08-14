const router = require('express').Router();
const { query } = require('../db');
const { signToken, comparePassword } = require('../middleware/auth');
const { audit } = require('../middleware/guards');

/**
 * POST /api/auth/login
 * body: { identifier, password }  — identifier = email or username
 */
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) return res.status(400).json({ error: 'Identifier and password required' });

    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1 OR username = $1 OR mobile = $1',
      [identifier.trim()]
    );
    const user = rows[0];
    if (!user || !comparePassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.status !== 'active') return res.status(403).json({ error: 'Account is suspended' });

    // tenant must be active (except super admin)
    if (user.tenant_id) {
      const t = await query('SELECT status FROM tenants WHERE id = $1', [user.tenant_id]);
      if (t.rows[0]?.status !== 'active') return res.status(403).json({ error: 'Center account is suspended' });
    }

    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    await audit(user.tenant_id, user.id, 'login', 'user', user.id, null, { at: new Date().toISOString() }, req.ip);

    res.json({
      token: signToken(user),
      user: {
        id: user.id, role: user.role, full_name: user.full_name, tenant_id: user.tenant_id,
        locale: user.locale, branch_id: user.branch_id,
      },
    });
  } catch (e) { next(e); }
});

/** POST /api/auth/change-password */
router.post('/change-password', async (req, res, next) => {
  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify((req.headers.authorization || '').slice(7), process.env.JWT_SECRET || 'dev-secret-change-me');
    const { currentPassword, newPassword } = req.body || {};
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [payload.sub]);
    if (!rows[0] || !comparePassword(currentPassword, rows[0].password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const bcrypt = require('bcryptjs');
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(newPassword, 10), payload.sub]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
