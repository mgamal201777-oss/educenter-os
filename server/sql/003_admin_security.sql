-- =====================================================================
-- Migration 003: Admin security hardening
-- 1. Reset super admin password to a strong credential (Edu@a14ba1536f23!2026)
-- 2. Remove all seeded client/tenant owner accounts (clients will be created
--    manually from the super admin portal as a real-world test)
-- 3. Reset all remaining demo account passwords from "123456" to a stronger
--    demo credential (Edu@Demo-2026)
-- =====================================================================

-- 1. Super admin: strong password, ensure active
UPDATE users
   SET password_hash = '$2b$10$yukaKGhp4xztO41EEXkNzek51dYfYRQvj48buK7COmHTu3JXT3Zj2',
       status = 'active'
 WHERE role = 'super_admin';

-- 2. Delete client owner accounts (tenants themselves + their data are kept).
--    Nullable user references are cleared first (they point at demo staff rows).
UPDATE attendance  SET recorded_by = NULL WHERE recorded_by IN (SELECT id FROM users WHERE role = 'owner');
UPDATE attendance  SET edited_by   = NULL WHERE edited_by   IN (SELECT id FROM users WHERE role = 'owner');
UPDATE payments   SET recorded_by = NULL WHERE recorded_by IN (SELECT id FROM users WHERE role = 'owner');
UPDATE quizzes    SET created_by  = NULL WHERE created_by  IN (SELECT id FROM users WHERE role = 'owner');
UPDATE materials  SET uploaded_by = NULL WHERE uploaded_by IN (SELECT id FROM users WHERE role = 'owner');
UPDATE homework   SET created_by  = NULL WHERE created_by  IN (SELECT id FROM users WHERE role = 'owner');
UPDATE questions  SET created_by  = NULL WHERE created_by  IN (SELECT id FROM users WHERE role = 'owner');
UPDATE assessments SET created_by = NULL WHERE created_by  IN (SELECT id FROM users WHERE role = 'owner');
UPDATE leads      SET assigned_to = NULL WHERE assigned_to IN (SELECT id FROM users WHERE role = 'owner');
UPDATE announcements SET created_by = NULL WHERE created_by IN (SELECT id FROM users WHERE role = 'owner');
DELETE FROM notifications  WHERE user_id IN (SELECT id FROM users WHERE role = 'owner');
DELETE FROM crm_activities WHERE user_id IN (SELECT id FROM users WHERE role = 'owner');
DELETE FROM users WHERE role = 'owner';

-- 3. Every remaining seeded account gets the stronger demo password
UPDATE users
   SET password_hash = '$2b$10$LVJxaPLTSlgPJo7Rv0P7HO64xXBYqMedLT8ntJ9d.SdXjCbOexOXy'
 WHERE tenant_id IS NOT NULL;
