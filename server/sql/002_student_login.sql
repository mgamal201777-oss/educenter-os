-- Migration 002: student login accounts
ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id);

-- link existing demo student users (best effort; seed creates fresh data anyway)
