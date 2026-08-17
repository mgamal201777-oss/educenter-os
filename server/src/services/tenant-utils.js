const { query } = require('../db');

/** Turn a center name into a unique slug. */
async function uniqueSlug(name) {
  const base = String(name).toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '').slice(0, 40) || 'center';
  let slug = base, i = 1;
  while (true) {
    const { rows } = await query('SELECT 1 FROM tenants WHERE slug = $1', [slug]);
    if (!rows[0]) return slug;
    slug = `${base}-${++i}`;
  }
}

module.exports = { uniqueSlug };
