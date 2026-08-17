-- ============================================================
-- 007: Database-driven subscription plans (manageable from
--      Billing & Pricing) + platform API keys for the
--      Security & API console.
-- ============================================================

-- 1. Subscription plan catalog (managed by super admin)
CREATE TABLE plans (
  code         TEXT PRIMARY KEY,                -- stable key stored in tenants.plan
  name_en      TEXT NOT NULL,
  name_ar      TEXT NOT NULL,
  monthly_egp  NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_students INTEGER NOT NULL DEFAULT 100,
  max_branches INTEGER NOT NULL DEFAULT 1,
  features     TEXT[] NOT NULL DEFAULT '{}',
  active       BOOLEAN NOT NULL DEFAULT true,   -- inactive: hidden from signup, existing tenants keep it
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with the previous hardcoded catalog
INSERT INTO plans (code, name_en, name_ar, monthly_egp, max_students, max_branches, features, sort_order) VALUES
  ('basic',    'Basic',    'الأساسية',  1500, 150,  1,
    ARRAY['Students & groups','Attendance','Fees & payments'], 1),
  ('standard', 'Standard', 'المعيارية', 3000, 500,  3,
    ARRAY['Everything in Basic','Quizzes & homework','Leads CRM','Parent portal'], 2),
  ('premium',  'Premium',  'المتقدمة',  5500, 2000, 10,
    ARRAY['Everything in Standard','Smart insights & risk engine','Multi-branch','Priority support'], 3);

-- 2. Platform API keys (Security & API console)
CREATE TABLE api_keys (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  prefix       TEXT NOT NULL,                   -- first chars shown in the UI, e.g. ec_live_9f2a
  key_hash     TEXT NOT NULL UNIQUE,            -- sha256 of the full key; the key itself is never stored
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  revoked      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE revoked = false;
