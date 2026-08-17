/**
 * Outbound messaging channels: Email (SMTP), SMS (KonnectHub/Twilio),
 * WhatsApp (Meta Cloud API). Every attempt is recorded in message_log.
 * Channels that are not configured are logged as 'skipped' — never crash.
 */
const { query } = require('../db');

let _cached = null;
let _cachedAt = 0;

async function getSettings() {
  if (_cached && Date.now() - _cachedAt < 30_000) return _cached;
  const { rows } = await query('SELECT * FROM platform_settings WHERE id = 1');
  _cached = rows[0] || {};
  _cachedAt = Date.now();
  return _cached;
}
function invalidateSettingsCache() { _cached = null; _cachedAt = 0; }

async function log(tenantId, channel, recipient, subject, body, status, error, relatedType, relatedId) {
  await query(
    `INSERT INTO message_log (tenant_id, channel, recipient, subject, body, status, error, related_type, related_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [tenantId, channel, recipient, subject, body, status, error || null, relatedType || null, relatedId || null]
  ).catch(() => {});
}

// ---------------------------------------------------------------- email
async function sendEmail(tenantId, to, subject, body, meta = {}) {
  const s = await getSettings();
  if (!s.email_enabled || !s.smtp_host || !to) {
    await log(tenantId, 'email', to || '-', subject, body, 'skipped',
      s.email_enabled ? 'no recipient or SMTP not configured' : 'email disabled', meta.type, meta.id);
    return { ok: false, skipped: true };
  }
  try {
    // nodemailer is optional — lazy require so the app runs without it
    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport({
      host: s.smtp_host, port: s.smtp_port || 587, secure: (s.smtp_port || 587) === 465,
      auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
    });
    await transport.sendMail({ from: s.email_from, to, subject, text: body, html: body.replace(/\n/g, '<br>') });
    await log(tenantId, 'email', to, subject, body, 'sent', null, meta.type, meta.id);
    return { ok: true };
  } catch (e) {
    await log(tenantId, 'email', to, subject, body, 'failed', e.message, meta.type, meta.id);
    return { ok: false, error: e.message };
  }
}

// ---------------------------------------------------------------- sms
async function sendSms(tenantId, mobile, body, meta = {}) {
  const s = await getSettings();
  if (!s.sms_enabled || !s.sms_api_key || !mobile) {
    await log(tenantId, 'sms', mobile || '-', null, body, 'skipped',
      s.sms_enabled ? 'no mobile or SMS not configured' : 'sms disabled', meta.type, meta.id);
    return { ok: false, skipped: true };
  }
  try {
    let url, headers = { 'Content-Type': 'application/json' }, payload;
    if (s.sms_provider === 'twilio') {
      url = `https://api.twilio.com/2010-04-01/Accounts/${s.sms_user || s.sms_api_key}/Messages.json`;
      headers['Authorization'] = 'Basic ' + Buffer.from(`${s.sms_user || s.sms_api_key}:${s.sms_pass || s.sms_api_key}`).toString('base64');
      payload = new URLSearchParams({ To: mobile, From: s.sms_sender_id || '', Body: body });
    } else { // konnecthub (popular in Egypt)
      url = `https://api.konnecthub.com/v1/messages/send`;
      headers['Authorization'] = `Bearer ${s.sms_api_key}`;
      payload = JSON.stringify({ mobile: mobile.replace(/^\+/, ''), message: body, senderId: s.sms_sender_id || null });
    }
    const res = await fetch(url, { method: 'POST', headers, body: payload });
    if (!res.ok) throw new Error(`SMS provider HTTP ${res.status}`);
    await log(tenantId, 'sms', mobile, null, body, 'sent', null, meta.type, meta.id);
    return { ok: true };
  } catch (e) {
    await log(tenantId, 'sms', mobile, null, body, 'failed', e.message, meta.type, meta.id);
    return { ok: false, error: e.message };
  }
}

// ---------------------------------------------------------------- whatsapp
async function sendWhatsapp(tenantId, mobile, body, meta = {}) {
  const s = await getSettings();
  if (!s.whatsapp_enabled || !s.whatsapp_token || !mobile) {
    await log(tenantId, 'whatsapp', mobile || '-', null, body, 'skipped',
      s.whatsapp_enabled ? 'no mobile or WhatsApp not configured' : 'whatsapp disabled', meta.type, meta.id);
    return { ok: false, skipped: true };
  }
  try {
    // Meta WhatsApp Cloud API (text messages)
    const url = `https://graph.facebook.com/v20.0/${s.whatsapp_phone_id}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.whatsapp_token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: mobile.replace(/[^\d]/g, ''),
        type: 'text', text: { body },
      }),
    });
    if (!res.ok) throw new Error(`WhatsApp HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    await log(tenantId, 'whatsapp', mobile, null, body, 'sent', null, meta.type, meta.id);
    return { ok: true };
  } catch (e) {
    await log(tenantId, 'whatsapp', mobile, null, body, 'failed', e.message, meta.type, meta.id);
    return { ok: false, error: e.message };
  }
}

/** Convenience: send to a parent's contacts (email + sms + whatsapp) per settings. */
async function notifyParentContacts(tenantId, parentRow, subject, body, meta = {}) {
  const results = [];
  if (parentRow.email) results.push(sendEmail(tenantId, parentRow.email, subject, body, meta));
  if (parentRow.mobile) results.push(sendSms(tenantId, parentRow.mobile, body, meta));
  if (parentRow.mobile) results.push(sendWhatsapp(tenantId, parentRow.mobile, body, meta));
  return Promise.all(results);
}

/** WhatsApp click-to-chat link (works with zero configuration). */
const waLink = (mobile, text) =>
  `https://wa.me/${String(mobile || '').replace(/[^\d]/g, '')}?text=${encodeURIComponent(text || '')}`;

module.exports = { getSettings, invalidateSettingsCache, sendEmail, sendSms, sendWhatsapp, notifyParentContacts, waLink };
