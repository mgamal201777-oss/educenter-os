/**
 * Automated reminder scheduler.
 * Runs hourly; triggers the reminder sweep once per day at the configured
 * UTC hour. Sends fee-due, overdue and absence reminders to parents via
 * in-app notifications + email/SMS/WhatsApp (per platform settings).
 * Dedup: skips if a reminder of the same type for the same fee/student
 * was already sent within the last 5 days.
 */
const { query } = require('./db');
const { getSettings, notifyParentContacts } = require('./services/channels');
const { notifyUser } = require('./routes/notify');

let timer = null;
let lastRunDate = null;

async function alreadyReminded(tenantId, type, relatedId, channel) {
  const { rows } = await query(
    `SELECT 1 FROM message_log
     WHERE tenant_id = $1 AND related_type = $2 AND related_id = $3 AND channel = $4
       AND status = 'sent' AND created_at > now() - interval '5 days'`,
    [tenantId, type, relatedId, channel]);
  return rows.length > 0;
}

async function sweep() {
  const s = await getSettings();

  // ---------- 1. Fee due reminders (N days before due date) ----------
  if (s.reminder_fee_days > 0) {
    const { rows } = await query(
      `SELECT f.id, f.tenant_id, f.student_id, f.due_date, f.total_after_discount, f.fee_type,
              st.name AS student_name, st.tenant_id AS t_id
       FROM fees f JOIN students st ON st.id = f.student_id
       WHERE f.status IN ('due','partial')
         AND f.due_date BETWEEN current_date AND current_date + ($1 || ' days')::interval`,
      [s.reminder_fee_days]);
    for (const f of rows) {
      const parents = await query(
        `SELECT p.* FROM student_guardians sg JOIN parents p ON p.id = sg.parent_id
         WHERE sg.student_id = $1 AND p.tenant_id = $2`, [f.student_id, f.tenant_id]);
      const text = `Reminder: ${f.fee_type || 'Tuition fee'} for ${f.student_name} (EGP ${f.total_after_discount}) is due on ${String(f.due_date).slice(0, 10)}. Please arrange payment.`;
      for (const p of parents.rows) {
        if (p.user_id) await notifyUser(f.tenant_id, p.user_id, 'fee_due',
          `Fee due ${String(f.due_date).slice(0, 10)}`, text, { fee_id: f.id });
        if (!(await alreadyReminded(f.tenant_id, 'fee_due', f.id, 'sms'))) {
          await notifyParentContacts(f.tenant_id, p, `Fee reminder — ${f.student_name}`, text, { type: 'fee_due', id: f.id });
        }
      }
    }
  }

  // ---------- 2. Overdue fees ----------
  if (s.reminder_overdue) {
    const { rows } = await query(
      `SELECT f.id, f.tenant_id, f.student_id, f.due_date, f.total_after_discount, f.fee_type,
              st.name AS student_name
       FROM fees f JOIN students st ON st.id = f.student_id
       WHERE f.status IN ('due','partial','overdue')
         AND f.due_date < current_date
         AND f.due_date > current_date - 30`); // don't spam ancient debts
    for (const f of rows) {
      const parents = await query(
        `SELECT p.* FROM student_guardians sg JOIN parents p ON p.id = sg.parent_id
         WHERE sg.student_id = $1 AND p.tenant_id = $2`, [f.student_id, f.tenant_id]);
      const text = `Overdue notice: ${f.fee_type || 'Tuition fee'} for ${f.student_name} (EGP ${f.total_after_discount}) was due on ${String(f.due_date).slice(0, 10)} and is still unpaid.`;
      for (const p of parents.rows) {
        if (p.user_id) await notifyUser(f.tenant_id, p.user_id, 'fee_overdue',
          `Fee overdue`, text, { fee_id: f.id });
        if (!(await alreadyReminded(f.tenant_id, 'fee_overdue', f.id, 'sms'))) {
          await notifyParentContacts(f.tenant_id, p, `Overdue fee — ${f.student_name}`, text, { type: 'fee_overdue', id: f.id });
        }
      }
    }
  }

  // ---------- 3. Absence alerts (yesterday's absences) ----------
  if (s.reminder_absence) {
    const { rows } = await query(
      `SELECT a.student_id, a.tenant_id, g.name AS group_name, st.name AS student_name
       FROM attendance a JOIN groups g ON g.id = a.group_id JOIN students st ON st.id = a.student_id
       WHERE a.status = 'absent' AND a.session_date = current_date - 1`);
    for (const a of rows) {
      const parents = await query(
        `SELECT p.* FROM student_guardians sg JOIN parents p ON p.id = sg.parent_id
         WHERE sg.student_id = $1 AND p.tenant_id = $2`, [a.student_id, a.tenant_id]);
      const text = `Absence notice: ${a.student_name} was absent from ${a.group_name} yesterday.`;
      for (const p of parents.rows) {
        if (p.user_id) await notifyUser(a.tenant_id, p.user_id, 'absent', `Absence — ${a.group_name}`, text, { group: a.group_name });
      }
    }
  }
}

async function tick() {
  try {
    const s = await getSettings();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentHour = now.getUTCHours();
    if (lastRunDate !== today && currentHour >= (s.reminder_hour_utc ?? 8)) {
      lastRunDate = today;
      await sweep();
      console.log('[scheduler] reminder sweep complete');
    }
  } catch (e) {
    console.error('[scheduler] error:', e.message);
  }
}

function startScheduler() {
  if (timer) return;
  timer = setInterval(tick, 60 * 60 * 1000); // hourly check
  setTimeout(tick, 30_000); // first run shortly after boot
  console.log('[scheduler] started (hourly check)');
}

module.exports = { startScheduler, sweep };
