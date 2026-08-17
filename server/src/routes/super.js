const router = require('express').Router();
const crypto = require('crypto');
const { query } = require('../db');
const { requireRole, hashPassword, ROLE_HIERARCHY } = require('../middleware/auth');
const { tenantScope, audit } = require('../middleware/guards');
const { invalidateSettingsCache } = require('../services/channels');
const { getPlans, invalidatePlansCache, normalizePlan } = require('../services/plans');
const { uniqueSlug } = require('../services/tenant-utils');

// All routes: super admin only (JWT) — or read-only access via API key (see middleware/auth)
router.use(requireRole('super_admin'));
// API keys are strictly read-only
router.use((req, res, next) => {
  if (req.apiKey && req.method !== 'GET') {
    return res.status(403).json({ error: 'API keys are read-only' });
  }
  next();
});

function assertStrongPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8
    || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
    const err = new Error('Password must be 8+ chars with upper, lower and a number');
    err.status = 400;
    throw err;
  }
}

// ---------------------------------------------------------------- tenants
/** GET /api/super/tenants — list all centers with usage + revenue stats */
router.get('/tenants', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT t.*,
        (SELECT count(*) FROM branches b WHERE b.tenant_id = t.id) AS branch_count,
        (SELECT count(*) FROM students s WHERE s.tenant_id = t.id AND s.status = 'active') AS student_count,
        (SELECT count(*) FROM teachers tc WHERE tc.tenant_id = t.id) AS teacher_count,
        (SELECT count(*) FROM users u WHERE u.tenant_id = t.id) AS user_count,
        (SELECT COALESCE(SUM(p.amount),0) FROM payments p
           JOIN fees f ON f.id = p.fee_id WHERE f.tenant_id = t.id AND p.status = 'paid') AS revenue_collected
      FROM tenants t ORDER BY t.created_at DESC`);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/super/tenants — create a center + its first admin (owner) */
router.post('/tenants', async (req, res, next) => {
  try {
    const { name, slug, adminName, adminEmail, adminPassword, plan } = req.body;
    if (!name || !adminName || !adminPassword) {
      return res.status(400).json({ error: 'name, adminName and adminPassword are required' });
    }
    assertStrongPassword(adminPassword);
    const plans = await getPlans({ activeOnly: true });
    const chosen = plans.find((p) => p.code === plan) || plans.find((p) => p.code === 'basic') || plans[0];
    const finalSlug = slug
      ? String(slug).toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40)
      : await uniqueSlug(name);
    if (!finalSlug) return res.status(400).json({ error: 'Invalid slug' });
    const dupe = await query('SELECT 1 FROM tenants WHERE slug = $1', [finalSlug]);
    if (dupe.rows[0]) return res.status(409).json({ error: `Slug "${finalSlug}" is already taken` });
    const bcrypt = require('bcryptjs');
    const t = await query(
      `INSERT INTO tenants (name, slug, plan, contact_name, contact_email)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name.trim(), finalSlug, chosen?.code || 'basic', adminName, adminEmail || null]
    );
    const tenant = t.rows[0];
    const usernameBase = finalSlug + '-owner';
    let username = usernameBase, un = 1;
    while (true) {
      const d = await query('SELECT 1 FROM users WHERE username = $1', [username]);
      if (!d.rows[0]) break;
      username = `${usernameBase}${++un}`;
    }
    const u = await query(
      `INSERT INTO users (tenant_id, role, full_name, email, username, password_hash, locale)
       VALUES ($1,'owner',$2,$3,$4,$5,'ar') RETURNING id, username`,
      [tenant.id, adminName, adminEmail || null, username, bcrypt.hashSync(adminPassword, 12)]
    );
    await audit(null, req.user.id, 'create', 'tenant', tenant.id, null, { name, slug: finalSlug, plan: tenant.plan });
    res.status(201).json({ tenant, adminUserId: u.rows[0].id, adminUsername: u.rows[0].username });
  } catch (e) { next(e); }
});

/** PATCH /api/super/tenants/:id — activate/suspend/plan */
router.patch('/tenants/:id', async (req, res, next) => {
  try {
    const allowed = ['status', 'plan', 'name', 'contact_name', 'contact_phone', 'contact_email'];
    const sets = [], vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(Number(req.params.id));
    const old = await query('SELECT * FROM tenants WHERE id = $1', [req.params.id]);
    const { rows } = await query(`UPDATE tenants SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
    if (!rows[0]) return res.status(404).json({ error: 'Tenant not found' });
    // suspend/activate cascades to users (approval also activates the owner + pending staff)
    if (req.body.status) {
      const goingActive = req.body.status === 'active';
      const wasPending = old.rows[0]?.status === 'pending';
      await query(
        wasPending && goingActive
          ? `UPDATE users SET status = 'active' WHERE tenant_id = $1 AND status = 'pending'`
          : `UPDATE users SET status = $1 WHERE tenant_id = $2 AND role != 'owner'`,
        wasPending && goingActive ? [rows[0].id] : [goingActive ? 'active' : 'suspended', rows[0].id]);
      if (goingActive) {
        await query('UPDATE tenants SET trial_ends_at = NULL WHERE id = $1', [rows[0].id]);
      }
    }
    await audit(null, req.user.id, 'update', 'tenant', rows[0].id, old.rows[0], rows[0]);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** DELETE /api/super/tenants/:id — permanently remove a tenant and all its data */
router.delete('/tenants/:id', async (req, res, next) => {
  try {
    const old = await query('SELECT * FROM tenants WHERE id = $1', [req.params.id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Tenant not found' });
    await query('DELETE FROM tenants WHERE id = $1', [req.params.id]); // cascades to all tenant data
    await audit(null, req.user.id, 'delete', 'tenant', Number(req.params.id), old.rows[0], null);
    res.json({ ok: true, deleted: old.rows[0].name });
  } catch (e) { next(e); }
});

/** POST /api/super/tenants/:id/extend-trial — add N more trial days */
router.post('/tenants/:id/extend-trial', async (req, res, next) => {
  try {
    const days = Math.min(Number(req.body?.days) || 14, 90);
    const t = await query('SELECT * FROM tenants WHERE id = $1', [req.params.id]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Tenant not found' });
    const from = t.rows[0].trial_ends_at && new Date(t.rows[0].trial_ends_at) > new Date()
      ? new Date(t.rows[0].trial_ends_at) : new Date();
    const newEnd = new Date(from.getTime() + days * 86_400_000);
    const { rows } = await query(
      `UPDATE tenants SET trial_ends_at = $2, status = 'active' WHERE id = $1 RETURNING *`,
      [Number(req.params.id), newEnd]);
    // re-activate tenant users that trial-expiry may have suspended
    await query(`UPDATE users SET status = 'active' WHERE tenant_id = $1 AND status = 'suspended' AND role != 'owner'`, [rows[0].id]);
    await audit(null, req.user.id, 'extend_trial', 'tenant', rows[0].id, t.rows[0], rows[0]);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------- platform settings
const SETTING_COLS = [
  'signup_enabled', 'signup_mode', 'trial_days', 'default_plan',
  'payment_gateway', 'gateway_api_key', 'gateway_integration_id', 'gateway_wallet_number',
  'email_enabled', 'email_from', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass',
  'sms_enabled', 'sms_provider', 'sms_api_key', 'sms_sender_id',
  'whatsapp_enabled', 'whatsapp_provider', 'whatsapp_token', 'whatsapp_phone_id',
  'reminder_fee_days', 'reminder_overdue', 'reminder_absence', 'reminder_hour_utc',
];

/** GET /api/super/settings — platform settings (secrets masked) */
router.get('/settings', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM platform_settings WHERE id = 1');
    const s = { ...rows[0] };
    for (const k of ['gateway_api_key', 'smtp_pass', 'sms_api_key', 'whatsapp_token']) {
      if (s[k]) s[k] = '__SET__';
    }
    res.json(s);
  } catch (e) { next(e); }
});

/** PATCH /api/super/settings — update platform settings */
router.patch('/settings', async (req, res, next) => {
  try {
    const sets = [], vals = [];
    let i = 1;
    for (const k of SETTING_COLS) {
      let v = req.body[k];
      if (v === undefined) continue;
      if (typeof v === 'string' && v === '__SET__') continue; // masked secret — keep existing
      if (v === '') v = null;
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
    if (sets.length) {
      sets.push(`updated_at = now()`);
      await query(`UPDATE platform_settings SET ${sets.join(', ')} WHERE id = 1`, vals);
      invalidateSettingsCache();
      await audit(null, req.user.id, 'update', 'platform_settings', 1, null, { keys: Object.keys(req.body) });
    }
    const { rows } = await query('SELECT * FROM platform_settings WHERE id = 1');
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** GET /api/super/message-log — outbound email/SMS/WhatsApp log */
router.get('/message-log', async (req, res, next) => {
  try {
    const { limit = 100, tenantId, channel, status } = req.query;
    const params = [];
    const where = [];
    if (tenantId) { params.push(Number(tenantId)); where.push(`m.tenant_id = $${params.length}`); }
    if (channel) { params.push(channel); where.push(`m.channel = $${params.length}`); }
    if (status) { params.push(status); where.push(`m.status = $${params.length}`); }
    params.push(Math.min(Number(limit) || 100, 500));
    const { rows } = await query(`
      SELECT m.*, t.name AS tenant_name FROM message_log m
      LEFT JOIN tenants t ON t.id = m.tenant_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY m.created_at DESC LIMIT $${params.length}`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------- platform stats
/** GET /api/super/platform-stats */
router.get('/platform-stats', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        (SELECT count(*) FROM tenants WHERE status = 'active') AS active_tenants,
        (SELECT count(*) FROM tenants) AS total_tenants,
        (SELECT count(*) FROM students WHERE status = 'active') AS total_students,
        (SELECT count(*) FROM teachers) AS total_teachers,
        (SELECT count(*) FROM users WHERE role = 'parent') AS parent_accounts,
        (SELECT count(*) FROM payments WHERE status = 'paid') AS total_payments,
        (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.status = 'paid') AS platform_revenue,
        (SELECT count(*) FROM users WHERE role = 'owner') AS owner_accounts,
        (SELECT count(*) FROM users WHERE status = 'suspended') AS suspended_users,
        (SELECT count(*) FROM students WHERE created_at > now() - interval '30 days') AS new_students_30d,
        (SELECT count(*) FROM leads) AS total_leads`);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------- accounts (users)
/** GET /api/super/users — list all accounts across tenants.
 *  Platform super-admin accounts are EXCLUDED by default: they are managed
 *  in the Security & API console, not in the customer accounts list. */
router.get('/users', async (req, res, next) => {
  try {
    const { q = '', tenantId, role, includePlatformAdmins = '', limit = 200 } = req.query;
    const params = [];
    const where = [];
    if (role) { params.push(role); where.push(`u.role = $${params.length}`); }
    else if (includePlatformAdmins !== 'true') where.push(`u.tenant_id IS NOT NULL AND u.role != 'super_admin'`);
    if (q) { params.push(`%${q}%`); where.push(`(u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
    if (tenantId) { params.push(Number(tenantId)); where.push(`u.tenant_id = $${params.length}`); }
    params.push(Math.min(Number(limit) || 200, 500));
    const { rows } = await query(`
      SELECT u.id, u.tenant_id, u.role, u.full_name, u.email, u.username, u.mobile,
             u.status, u.last_login_at, u.created_at, t.name AS tenant_name
      FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY u.tenant_id NULLS FIRST, u.created_at DESC
      LIMIT $${params.length}`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/super/users — create a user inside a tenant (any role) */
router.post('/users', async (req, res, next) => {
  try {
    const { tenantId, role, fullName, email, username, password, mobile } = req.body;
    if (!tenantId || !role || !fullName || !username || !password) {
      return res.status(400).json({ error: 'tenantId, role, fullName, username and password are required' });
    }
    assertStrongPassword(password);
    const validRoles = ['owner', 'admin', 'branch_manager', 'reception', 'finance', 'teacher', 'parent', 'student'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const { rows } = await query(
      `INSERT INTO users (tenant_id, role, full_name, email, mobile, username, password_hash, locale)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'ar') RETURNING id, username, role, full_name`,
      [Number(tenantId), role, fullName, email || null, mobile || null, username, hashPassword(password)]);
    await audit(Number(tenantId), req.user.id, 'create', 'user', rows[0].id, null, { role, username });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

/** PATCH /api/super/users/:id — suspend/activate, reset password */
router.patch('/users/:id', async (req, res, next) => {
  try {
    const { status, password, role } = req.body;
    const id = Number(req.params.id);
    const old = await query('SELECT id, tenant_id, role, status, username FROM users WHERE id = $1', [id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'User not found' });
    if (old.rows[0].role === 'super_admin') {
      return res.status(400).json({ error: 'Cannot modify the platform super admin here' });
    }
    if (status) {
      if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
      await query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
    }
    if (role) {
      const validRoles = ['owner', 'admin', 'branch_manager', 'reception', 'finance', 'teacher', 'parent', 'student'];
      if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
      await query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    }
    if (password) {
      assertStrongPassword(password);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(password), id]);
    }
    const updated = await query('SELECT id, tenant_id, role, full_name, username, status FROM users WHERE id = $1', [id]);
    await audit(old.rows[0].tenant_id, req.user.id, 'update', 'user', id, old.rows[0], updated.rows[0]);
    res.json(updated.rows[0]);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------- billing
/** GET /api/super/plans — the plan catalog from the database */
router.get('/plans', async (req, res, next) => {
  try { res.json(await getPlans()); } catch (e) { next(e); }
});

/** POST /api/super/plans — create a plan */
router.post('/plans', async (req, res, next) => {
  try {
    const p = normalizePlan(req.body, { requireCode: true });
    const dupe = await query('SELECT 1 FROM plans WHERE code = $1', [p.code]);
    if (dupe.rows[0]) return res.status(409).json({ error: `Plan "${p.code}" already exists` });
    const { rows } = await query(
      `INSERT INTO plans (code, name_en, name_ar, monthly_egp, max_students, max_branches, features, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [p.code, p.name_en, p.name_ar, p.monthly_egp ?? 0, p.max_students ?? 100,
       p.max_branches ?? 1, p.features || [], p.active ?? true, p.sort_order ?? 99]);
    invalidatePlansCache();
    await audit(null, req.user.id, 'create', 'plan', null, null, rows[0]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

/** PATCH /api/super/plans/:code — update a plan */
router.patch('/plans/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code).toLowerCase();
    const p = normalizePlan(req.body, { requireCode: false });
    delete p.code; // code is immutable — keeps tenants.plan references stable
    const keys = Object.keys(p);
    if (!keys.length) return res.status(400).json({ error: 'Nothing to update' });
    const sets = keys.map((k, idx) => `${k} = $${idx + 2}`);
    const vals = keys.map((k) => p[k]);
    const { rows } = await query(
      `UPDATE plans SET ${sets.join(', ')}, updated_at = now() WHERE code = $1 RETURNING *`,
      [code, ...vals]);
    if (!rows[0]) return res.status(404).json({ error: 'Plan not found' });
    invalidatePlansCache();
    await audit(null, req.user.id, 'update', 'plan', null, null, rows[0]);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** DELETE /api/super/plans/:code — remove a plan (only if no tenant uses it) */
router.delete('/plans/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code).toLowerCase();
    const inUse = await query('SELECT count(*)::int AS n FROM tenants WHERE plan = $1', [code]);
    if (inUse.rows[0].n > 0) {
      return res.status(409).json({ error: `Cannot delete: ${inUse.rows[0].n} center(s) are on this plan. Move them to another plan first.` });
    }
    const old = await query('SELECT * FROM plans WHERE code = $1', [code]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Plan not found' });
    await query('DELETE FROM plans WHERE code = $1', [code]);
    invalidatePlansCache();
    await audit(null, req.user.id, 'delete', 'plan', null, old.rows[0], null);
    res.json({ ok: true, deleted: code });
  } catch (e) { next(e); }
});

/** GET /api/super/billing — plan catalog + per-tenant billing overview */
router.get('/billing', async (req, res, next) => {
  try {
    const plans = await getPlans();
    const { rows } = await query(`
      SELECT t.id, t.name, t.plan, t.status,
        (SELECT count(*) FROM students s WHERE s.tenant_id = t.id AND s.status = 'active') AS student_count,
        (SELECT COALESCE(SUM(p.amount),0) FROM payments p
           JOIN fees f ON f.id = p.fee_id WHERE f.tenant_id = t.id AND p.status = 'paid') AS collected_revenue,
        (SELECT max(p.paid_at) FROM payments p
           JOIN fees f ON f.id = p.fee_id WHERE f.tenant_id = t.id AND p.status = 'paid') AS last_payment_at
      FROM tenants t ORDER BY t.created_at ASC`);
    const monthlyValue = rows.reduce((sum, r) => {
      const p = plans.find((c) => c.code === r.plan);
      return sum + (p ? Number(p.monthly_egp) : 0);
    }, 0);
    res.json({
      plans,
      total_mrr_egp: monthlyValue,
      total_collected_egp: rows.reduce((s, r) => s + Number(r.collected_revenue), 0),
      tenants: rows,
    });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------- activity logs
/** GET /api/super/audit-logs — recent platform activity */
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { limit = 100, tenantId, entity, action, q } = req.query;
    const params = [];
    const where = [];
    if (tenantId) { params.push(Number(tenantId)); where.push(`a.tenant_id = $${params.length}`); }
    if (entity) { params.push(entity); where.push(`a.entity = $${params.length}`); }
    if (action) { params.push(action); where.push(`a.action = $${params.length}`); }
    if (q) { params.push(`%${q}%`); where.push(`(a.entity ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`); }
    params.push(Math.min(Number(limit) || 100, 500));
    const { rows } = await query(`
      SELECT a.id, a.action, a.entity, a.entity_id, a.ip, a.created_at,
             u.full_name AS user_name, u.role AS user_role, t.name AS tenant_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN tenants t ON t.id = a.tenant_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY a.created_at DESC
      LIMIT $${params.length}`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------- security & API console
/** GET /api/super/admins — platform-level super admin accounts (Security console only) */
router.get('/admins', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT id, full_name, username, email, status, last_login_at, created_at
      FROM users WHERE role = 'super_admin' ORDER BY created_at ASC`);
    res.json(rows);
  } catch (e) { next(e); }
});

/** GET /api/super/roles — role hierarchy used by the permission model */
router.get('/roles', async (req, res, next) => {
  try {
    const descriptions = {
      super_admin: { scope: 'platform', desc_en: 'Full platform control: centers, plans, billing, security. Managed in Security & API only.', desc_ar: 'تحكم كامل بالمنصة: المراكز والباقات والفوترة والأمان. تُدار من قسم الأمان وواجهة API فقط.' },
      owner: { scope: 'center', desc_en: 'Full control of one center: settings, finance, staff, all data.', desc_ar: 'تحكم كامل بمركز واحد: الإعدادات والمالية والموظفين وجميع البيانات.' },
      admin: { scope: 'center', desc_en: 'Center administration: students, groups, finance, staff management.', desc_ar: 'إدارة المركز: الطلاب والمجموعات والمالية وإدارة الموظفين.' },
      branch_manager: { scope: 'branch', desc_en: 'Manages one branch: its students, groups and schedules.', desc_ar: 'إدارة فرع واحد: طلبته ومجموعاته وجداوله.' },
      finance: { scope: 'center', desc_en: 'Fees, payments and financial reports. No student data editing.', desc_ar: 'الرسوم والمدفوعات والتقارير المالية دون تعديل بيانات الطلاب.' },
      reception: { scope: 'center', desc_en: 'Front desk: enrollments, attendance, leads follow-up.', desc_ar: 'الاستقبال: التسجيلات والحضور ومتابعة العملاء المحتملين.' },
      teacher: { scope: 'group', desc_en: 'Own groups: attendance, homework, quizzes, materials.', desc_ar: 'مجموعاته: الحضور والواجبات والاختبارات والمواد.' },
      parent: { scope: 'read-only', desc_en: 'Read-only portal for own children: grades, fees, payments.', desc_ar: 'بوابة قراءة فقط للأبناء: الدرجات والرسوم والمدفوعات.' },
      student: { scope: 'read-only', desc_en: 'Read-only portal: own homework, quizzes, grades, schedule.', desc_ar: 'بوابة قراءة فقط: الواجبات والاختبارات والدرجات والجدول.' },
    };
    res.json(Object.entries(ROLE_HIERARCHY)
      .sort((a, b) => b[1] - a[1])
      .map(([role, level]) => ({ role, level, ...descriptions[role] })));
  } catch (e) { next(e); }
});

/** GET /api/super/security-overview — counters for the Security & API overview tab */
router.get('/security-overview', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        (SELECT count(*) FROM users WHERE role = 'super_admin' AND status = 'active') AS active_admins,
        (SELECT count(*) FROM api_keys WHERE revoked = false) AS active_api_keys,
        (SELECT count(*) FROM audit_logs WHERE created_at > now() - interval '30 days') AS audit_events_30d,
        (SELECT count(*) FROM users WHERE status = 'suspended') AS suspended_users,
        (SELECT count(*) FROM tenants WHERE status = 'pending') AS pending_tenants,
        (SELECT count(*) FROM message_log WHERE status = 'failed') AS failed_messages`);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/** GET /api/super/api-keys — list API keys (full keys are never stored or returned) */
router.get('/api-keys', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT k.id, k.name, k.prefix, k.revoked, k.last_used_at, k.created_at,
             u.full_name AS created_by_name
      FROM api_keys k LEFT JOIN users u ON u.id = k.created_by
      ORDER BY k.created_at DESC`);
    res.json(rows);
  } catch (e) { next(e); }
});

/** POST /api/super/api-keys — create an API key; the full key is returned ONCE */
router.post('/api-keys', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Key name is required' });
    const secret = crypto.randomBytes(24).toString('hex');
    const fullKey = `ec_live_${secret}`;
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    const prefix = fullKey.slice(0, 16);
    const { rows } = await query(
      `INSERT INTO api_keys (name, prefix, key_hash, created_by) VALUES ($1,$2,$3,$4)
       RETURNING id, name, prefix, created_at`,
      [name.slice(0, 60), prefix, keyHash, req.user.id]);
    await audit(null, req.user.id, 'create', 'api_key', rows[0].id, null, { name });
    res.status(201).json({ ...rows[0], key: fullKey }); // shown once in the UI
  } catch (e) { next(e); }
});

/** DELETE /api/super/api-keys/:id — revoke an API key */
router.delete('/api-keys/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const old = await query('SELECT * FROM api_keys WHERE id = $1', [id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'API key not found' });
    await query('UPDATE api_keys SET revoked = true WHERE id = $1', [id]);
    await audit(null, req.user.id, 'revoke', 'api_key', id, old.rows[0], null);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
