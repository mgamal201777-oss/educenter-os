-- 006: Go-live cleanup — remove ALL demo/seed data from the platform.
-- Keeps: platform super admin (tenant_id IS NULL) and platform_settings row.
-- Deletes every tenant-scoped table explicitly, in reverse FK dependency order,
-- because several FKs are NO ACTION (not CASCADE) — e.g. quiz_answers -> questions.
DELETE FROM quiz_answers;
DELETE FROM quiz_attempts;
DELETE FROM quiz_questions;
DELETE FROM quizzes;
DELETE FROM questions;
DELETE FROM payment_requests;
DELETE FROM message_log;
DELETE FROM crm_activities;
DELETE FROM leads;
DELETE FROM payments;
DELETE FROM installments;
DELETE FROM fees;
DELETE FROM discounts;
DELETE FROM grading_weights;
DELETE FROM assessments;
DELETE FROM materials;
DELETE FROM homework_submissions;
DELETE FROM homework;
DELETE FROM attendance;
DELETE FROM enrollments;
DELETE FROM group_schedules;
DELETE FROM groups;
DELETE FROM student_guardians;
DELETE FROM students;
DELETE FROM parents;
DELETE FROM teacher_subjects;
DELETE FROM teachers;
DELETE FROM classrooms;
DELETE FROM subjects;
DELETE FROM grade_levels;
DELETE FROM terms;
DELETE FROM academic_years;
DELETE FROM curricula;
DELETE FROM branches;
DELETE FROM announcements;
DELETE FROM notifications;
DELETE FROM audit_logs; -- all existing audit entries are demo activity
DELETE FROM users WHERE tenant_id IS NOT NULL; -- keep platform super admin only
DELETE FROM tenants;

-- Reset identity sequences so real tenants start from clean ids
SELECT setval(pg_get_serial_sequence('tenants', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('users', 'id'),
  COALESCE((SELECT MAX(id) FROM users), 1),
  (SELECT COUNT(*) FROM users) > 0);
