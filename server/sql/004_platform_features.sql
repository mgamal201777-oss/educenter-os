-- ============================================================
-- 004: Platform features — self-service signup, settings,
--      notification channels (email/SMS/WhatsApp), online
--      payment requests for parents.
-- ============================================================

-- 1. Platform-wide settings (single row, id = 1) managed by super admin
CREATE TABLE platform_settings (
  id                     SERIAL PRIMARY KEY,
  -- Self-service signup
  signup_enabled         BOOLEAN NOT NULL DEFAULT true,
  signup_mode            TEXT NOT NULL DEFAULT 'manual',   -- manual (approval) | instant (trial)
  trial_days             INTEGER NOT NULL DEFAULT 14,
  default_plan           TEXT NOT NULL DEFAULT 'basic',
  -- Online payments for parents
  payment_gateway        TEXT NOT NULL DEFAULT 'manual',   -- manual | paymob | stripe
  gateway_api_key        TEXT,
  gateway_integration_id TEXT,
  gateway_wallet_number  TEXT,                              -- e.g. InstaPay number shown to parents
  -- Notification channels
  email_enabled          BOOLEAN NOT NULL DEFAULT false,
  email_from             TEXT DEFAULT 'noreply@educenter.app',
  smtp_host              TEXT,
  smtp_port              INTEGER DEFAULT 587,
  smtp_user              TEXT,
  smtp_pass              TEXT,
  sms_enabled            BOOLEAN NOT NULL DEFAULT false,
  sms_provider           TEXT DEFAULT 'konnecthub',        -- konnecthub | twilio
  sms_api_key            TEXT,
  sms_sender_id          TEXT,
  whatsapp_enabled       BOOLEAN NOT NULL DEFAULT false,
  whatsapp_provider      TEXT DEFAULT 'meta_cloud',        -- meta_cloud | twilio
  whatsapp_token         TEXT,
  whatsapp_phone_id      TEXT,
  -- Automated reminders
  reminder_fee_days      INTEGER NOT NULL DEFAULT 3,       -- days before due date to remind
  reminder_overdue       BOOLEAN NOT NULL DEFAULT true,
  reminder_absence       BOOLEAN NOT NULL DEFAULT true,
  reminder_hour_utc      INTEGER NOT NULL DEFAULT 8,       -- hour of day to run reminders
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (id) VALUES (1);

-- 2. Tenants: trial + signup provenance
ALTER TABLE tenants ADD COLUMN trial_ends_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'; -- manual | signup

-- 3. Message log — every outbound email/SMS/WhatsApp attempt
CREATE TABLE message_log (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL,            -- email | sms | whatsapp
  recipient    TEXT NOT NULL,
  subject      TEXT,
  body         TEXT,
  status       TEXT NOT NULL,            -- sent | failed | skipped
  error        TEXT,
  related_type TEXT,                     -- fee | attendance | payment | signup | broadcast
  related_id   INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_log_tenant ON message_log(tenant_id, created_at DESC);

-- 4. Online payment requests (parent-initiated)
CREATE TABLE payment_requests (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fee_id         INTEGER NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL,
  method         TEXT NOT NULL DEFAULT 'online',           -- online
  provider       TEXT NOT NULL DEFAULT 'manual',           -- manual | paymob | stripe
  provider_ref   TEXT,                                      -- gateway order/txn id
  reference      TEXT,                                      -- txn ref entered by parent
  token          TEXT NOT NULL UNIQUE,                      -- public tracking token
  status         TEXT NOT NULL DEFAULT 'pending',           -- pending | paid | cancelled
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at        TIMESTAMPTZ
);
CREATE INDEX idx_payment_requests_tenant ON payment_requests(tenant_id, status);
