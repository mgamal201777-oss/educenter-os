-- 005: Update superadmin credentials to professional email identifier
UPDATE users
SET email = 'admin.educatorpghait@gmail.com',
    username = 'admin',
    full_name = 'Platform Admin',
    password_hash = '$2b$10$9B0Go.hr08asX9pQDtiWluMflOVSF0z7fIjeQV2lY4kGhX6tf9CLu'
WHERE role = 'super_admin' AND tenant_id IS NULL;
