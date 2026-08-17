const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { audit } = require('../middleware/guards');
const { getSettings } = require('../services/channels');
const { getPlans } = require('../services/plans');
const { uniqueSlug } = require('../services/tenant-utils');
const { notifyUser } = require('./notify');

function assertStrongPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8
    || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
    const err = new Error('Password must be 8+ chars with upper, lower and a number');
    err.status = 400;
    throw err;
  }
}

/** Turn a center name into a unique slug. */
// (moved to services/tenant-utils.js and shared with super.js)

/** GET /api/platform/public-config — what the public signup page needs */
router.get('/public-config', async (req, res, next) => {
  try {
    const [s, plans] = await Promise.all([getSettings(), getPlans({ activeOnly: true })]);
    res.json({
      signup_enabled: !!s.signup_enabled,
      signup_mode: s.signup_mode || 'manual',
      trial_days: s.trial_days ?? 14,
      payment_gateway: s.payment_gateway || 'manual',
      plans: plans.map(({ code, name_en, name_ar, monthly_egp, max_students, max_branches, features }) =>
        ({ plan: code, code, name_en, name_ar, monthly_egp, max_students, max_branches, features })),
    });
  } catch (e) { next(e); }
});

/** POST /api/platform/signup — center self-service registration */
router.post('/signup', async (req, res, next) => {
  try {
    const s = await getSettings();
    if (!s.signup_enabled) return res.status(403).json({ error: 'Self-service signup is currently disabled' });

    const { centerName, ownerName, email, mobile, password, plan } = req.body || {};
    if (!centerName || !ownerName || !password) {
      return res.status(400).json({ error: 'Center name, owner name and password are required' });
    }
    if (!email && !mobile) return res.status(400).json({ error: 'Email or mobile is required' });
    assertStrongPassword(password);
    if (email) {
      const dupe = await query('SELECT 1 FROM users WHERE email = $1', [email.trim().toLowerCase()]);
      if (dupe.rows[0]) return res.status(409).json({ error: 'This email is already registered' });
    }
    const plans = await getPlans({ activeOnly: true });
    const chosen = plans.find((p) => p.code === (plan || s.default_plan))
      || plans.find((p) => p.code === 'basic') || plans[0]
      || { code: 'basic' };

    const instant = (s.signup_mode === 'instant');
    const tenantStatus = instant ? 'active' : 'pending';
    const userStatus = instant ? 'active' : 'pending';
    const trialEndsAt = instant ? new Date(Date.now() + (s.trial_days ?? 14) * 86_400_000) : null;
    const slug = await uniqueSlug(centerName);

    const result = await withTransaction(async (client) => {
      const t = await client.query(
        `INSERT INTO tenants (name, slug, plan, status, contact_name, contact_email, contact_phone, source, trial_ends_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'signup',$8) RETURNING *`,
        [centerName.trim(), slug, chosen.code, tenantStatus, ownerName.trim(),
         email || null, mobile || null, trialEndsAt]);
      const tenant = t.rows[0];
      const u = await client.query(
        `INSERT INTO users (tenant_id, role, full_name, email, mobile, username, password_hash, locale, status)
         VALUES ($1,'owner',$2,$3,$4,$5,$6,$7,$8) RETURNING id, username`,
        [tenant.id, ownerName.trim(), email || null, mobile || null, `${slug}-owner`,
         bcrypt.hashSync(password, 12), 'ar', userStatus]);
      return { tenant, adminUsername: u.rows[0].username };
    });

    await audit(null, null, 'signup', 'tenant', result.tenant.id, null,
      { name: centerName, plan: chosen.code, mode: s.signup_mode, source: 'signup' }, req.ip);

    res.status(201).json({
      ok: true,
      status: result.tenant.status,
      mode: s.signup_mode,
      trial_days: instant ? s.trial_days : 0,
      admin_username: result.adminUsername,
      message: instant
        ? `Your center is ready! You have a ${s.trial_days}-day trial. Sign in with username "${result.adminUsername}" or your email.`
        : 'Registration received. Your account is pending approval — we will activate it shortly.',
    });
  } catch (e) { next(e); }
});

module.exports = router;
