const { query } = require('../db');

/**
 * Multi-tenant guard:
 * - super_admin may operate cross-tenant (req.query.tenantId or body)
 * - every other user is pinned to their own tenant_id
 * Sets req.tid (effective tenant id) or 403s.
 */
function tenantScope(req, res, next) {
  if (req.user.role === 'super_admin') {
    const tid = req.query.tenantId || req.body?.tenantId || req.params.tenantId;
    if (!tid) return res.status(400).json({ error: 'tenantId required for super admin' });
    req.tid = Number(tid);
    return next();
  }
  req.tid = req.user.tenant_id;
  if (!req.tid) return res.status(403).json({ error: 'User is not attached to a center' });
  next();
}

/** Append `AND tenant_id = $n` style safety to raw SQL helpers. */
async function audit(tenantId, userId, action, entity, entityId, oldValue, newValue, ip) {
  await query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, old_value, new_value, ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [tenantId, userId, action, entity, entityId,
     oldValue ? JSON.stringify(oldValue) : null,
     newValue ? JSON.stringify(newValue) : null,
     ip || null]
  ).catch(() => {}); // audit must never break the main operation
}

/** Fallback limits — used only if a plan row is missing from the DB (e.g. legacy plan code). */
const PLAN_LIMITS = {
  basic:    { max_students: 150,  max_branches: 1 },
  standard: { max_students: 500,  max_branches: 3 },
  premium:  { max_students: 2000, max_branches: 10 },
};

/**
 * Enforce subscription plan limits for a tenant.
 * Limits now come from the editable `plans` table (Billing & Pricing),
 * with PLAN_LIMITS as a fallback for unknown/legacy plan codes.
 * Usage: `assertPlanLimit(tid, 'students')` — throws {status:402, code:'PLAN_LIMIT'} when exceeded.
 */
async function assertPlanLimit(tenantId, resource) {
  const fallback = PLAN_LIMITS[resource];
  if (!fallback) return;
  const t = await query(`
    SELECT t.plan, p.max_students, p.max_branches
    FROM tenants t LEFT JOIN plans p ON p.code = t.plan
    WHERE t.id = $1`, [tenantId]);
  const row = t.rows[0];
  if (!row || !row.plan) return;
  const cap = row[`max_${resource}`]
    ?? (PLAN_LIMITS[row.plan] || PLAN_LIMITS.basic)[`max_${resource}`];
  if (cap == null) return;
  const table = resource === 'students'
    ? "SELECT count(*)::int AS n FROM students WHERE tenant_id = $1 AND status != 'transferred_out'"
    : 'SELECT count(*)::int AS n FROM branches WHERE tenant_id = $1';
  const { rows } = await query(table, [tenantId]);
  if (rows[0].n >= cap) {
    const e = new Error(`Plan limit reached: your ${row.plan} plan allows up to ${cap} ${resource}. Upgrade your subscription to add more.`);
    e.status = 402;
    e.code = 'PLAN_LIMIT';
    throw e;
  }
}

/** simple in-memory rate limiter (per IP+route) */
const buckets = new Map();
function rateLimit(max = 100, windowMs = 60_000) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const b = buckets.get(key) || { count: 0, reset: now + windowMs };
    if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
    b.count++;
    buckets.set(key, b);
    if (b.count > max) return res.status(429).json({ error: 'Too many requests' });
    next();
  };
}

module.exports = { tenantScope, audit, rateLimit, assertPlanLimit, PLAN_LIMITS };
