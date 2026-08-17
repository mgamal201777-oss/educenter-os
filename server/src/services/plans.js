const { query } = require('../db');

/** Plan catalog cache (invalidated on any plan write). */
let cache = null;

/** All active+inactive plans, ordered for display. */
async function getPlans({ activeOnly = false } = {}) {
  if (!cache) {
    const { rows } = await query(
      'SELECT code, name_en, name_ar, monthly_egp, max_students, max_branches, features, active, sort_order FROM plans ORDER BY sort_order, code');
    cache = rows;
  }
  return activeOnly ? cache.filter((p) => p.active) : cache;
}

async function invalidatePlansCache() { cache = null; }

/** Normalize a plan payload coming from the admin UI. Throws {status:400} on bad input. */
function normalizePlan(body, { requireCode = true, existing = null } = {}) {
  const out = {};
  if (body.code !== undefined || requireCode) {
    const code = String(body.code || '').toLowerCase().trim()
      .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
    if (requireCode && !code) {
      const e = new Error('Plan code is required (letters, numbers, - or _)');
      e.status = 400; throw e;
    }
    if (code) out.code = code;
  }
  if (body.name_en !== undefined) {
    if (!String(body.name_en).trim()) { const e = new Error('English name is required'); e.status = 400; throw e; }
    out.name_en = String(body.name_en).trim().slice(0, 60);
  } else if (requireCode) out.name_en = code;
  if (body.name_ar !== undefined) {
    out.name_ar = String(body.name_ar).trim().slice(0, 60) || out.name_en || code;
  } else if (requireCode) out.name_ar = out.name_en;
  if (body.monthly_egp !== undefined) {
    const v = Number(body.monthly_egp);
    if (!Number.isFinite(v) || v < 0) { const e = new Error('Monthly fee must be a non-negative number'); e.status = 400; throw e; }
    out.monthly_egp = Math.round(v * 100) / 100;
  }
  if (body.max_students !== undefined) {
    const v = Number(body.max_students);
    if (!Number.isInteger(v) || v < 1) { const e = new Error('Max students must be a positive integer'); e.status = 400; throw e; }
    out.max_students = v;
  }
  if (body.max_branches !== undefined) {
    const v = Number(body.max_branches);
    if (!Number.isInteger(v) || v < 1) { const e = new Error('Max branches must be a positive integer'); e.status = 400; throw e; }
    out.max_branches = v;
  }
  if (body.features !== undefined) {
    out.features = (Array.isArray(body.features) ? body.features : String(body.features).split(/\r?\n|,/))
      .map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  } else if (requireCode) out.features = [];
  if (body.active !== undefined) out.active = !!body.active;
  if (body.sort_order !== undefined) out.sort_order = Number(body.sort_order) || 0;
  return out;
}

module.exports = { getPlans, invalidatePlansCache, normalizePlan };
