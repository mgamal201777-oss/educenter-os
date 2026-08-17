const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

// SECURITY: refuse to boot in production with a default/weak JWT secret
if (process.env.NODE_ENV === 'production' && (JWT_SECRET === 'dev-secret-change-me' || JWT_SECRET.length < 32)) {
  console.error('[auth] FATAL: JWT_SECRET is missing or too short (<32 chars) in production. Set a strong secret.');
  process.exit(1);
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, tenantId: user.tenant_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Defensive: reject tokens whose subject no longer matches a known role shape
    if (!payload.sub || !payload.role) return res.status(401).json({ error: 'Invalid or expired session' });
    req.userId = payload.sub;
    req.role = payload.role;
    req.tenantId = payload.tenantId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/** Attach the full user row (id, role, tenant_id, branch_id, status). */
async function loadUser(req, res, next) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!rows[0] || rows[0].status !== 'active') {
    return res.status(401).json({ error: 'Account disabled' });
  }
  req.user = rows[0];
  next();
}

// ---- Role permission model ----
const ROLE_HIERARCHY = {
  super_admin: 100,
  owner: 90,
  admin: 80,
  branch_manager: 60,
  finance: 55,
  reception: 50,
  teacher: 30,
  parent: 20,
  student: 10,
};

/** Require one of the given roles (or higher management roles). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(500).json({ error: 'user not loaded' });
    if (req.user.role === 'super_admin') return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/** Staff = management portal users. */
const isStaff = (role) =>
  ['owner', 'admin', 'branch_manager', 'finance', 'reception'].includes(role);

/** X-Api-Key auth for the read-only platform API (Security & API console).
 *  Keys are stored as sha256 hashes; only ever shown once at creation. */
const crypto = require('crypto');
async function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || typeof key !== 'string' || key.length < 20 || key.length > 200) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const { rows } = await query(
    'SELECT id, created_by FROM api_keys WHERE key_hash = $1 AND revoked = false', [hash]);
  if (!rows[0]) return res.status(401).json({ error: 'Invalid or revoked API key' });
  query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [rows[0].id]).catch(() => {});
  // Synthetic platform identity — read-only (super.js blocks non-GET for API keys)
  req.user = { id: rows[0].created_by, role: 'super_admin', tenant_id: null, status: 'active' };
  req.apiKey = true;
  next();
}

module.exports = {
  signToken,
  authenticate,
  loadUser,
  requireRole,
  isStaff,
  apiKeyAuth,
  ROLE_HIERARCHY,
  hashPassword: (pw) => bcrypt.hashSync(pw, 10),
  comparePassword: (pw, hash) => bcrypt.compareSync(pw, hash),
  JWT_SECRET,
  JWT_EXPIRES_IN,
};
