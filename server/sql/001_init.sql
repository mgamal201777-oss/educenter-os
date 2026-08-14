-- =====================================================================
-- EduCenter OS — Multi-tenant SaaS for private education centers (Egypt)
-- Migration 001: core schema
-- Every tenant-owned table carries tenant_id for row-level isolation.
-- =====================================================================

CREATE TABLE IF NOT EXISTS _migrations (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ PLATFORM / TENANTS ============
CREATE TABLE tenants (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  plan          TEXT NOT NULL DEFAULT 'basic',        -- basic | standard | premium
  status        TEXT NOT NULL DEFAULT 'active',       -- active | suspended | deactivated
  contact_name  TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  logo_url      TEXT,
  settings      JSONB NOT NULL DEFAULT '{}',          -- currency, locale defaults, grading rules...
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ USERS / AUTH ============
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = platform super admin
  role          TEXT NOT NULL,  -- super_admin|owner|admin|branch_manager|reception|finance|teacher|parent|student
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE,    -- globally unique for unambiguous login
  mobile        TEXT,
  username      TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  locale        TEXT NOT NULL DEFAULT 'ar',
  status        TEXT NOT NULL DEFAULT 'active',
  branch_id     INTEGER,        -- for branch-scoped staff (FK added after branches)
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- ============ CENTER STRUCTURE ============
CREATE TABLE branches (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  governorate   TEXT NOT NULL,
  city          TEXT,
  address       TEXT,
  phone         TEXT,
  opening_hours TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_branches_tenant ON branches(tenant_id);
ALTER TABLE users ADD CONSTRAINT fk_users_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

CREATE TABLE curricula (
  id        SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,           -- National, International (IG/IB/American), Language School...
  UNIQUE (tenant_id, name)
);

CREATE TABLE academic_years (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,          -- e.g. 2026/2027
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (tenant_id, name)
);

CREATE TABLE terms (
  id                SERIAL PRIMARY KEY,
  tenant_id         INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  academic_year_id  INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,   -- Term 1 / Term 2
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  is_current        BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_terms_year ON terms(academic_year_id);

CREATE TABLE grade_levels (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,          -- Grade 6, Preparatory 3, Secondary 2...
  stage      TEXT NOT NULL,          -- primary | preparatory | secondary | other
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_grade_levels_tenant ON grade_levels(tenant_id);

CREATE TABLE subjects (
  id        SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,           -- Mathematics / الرياضيات
  name_en   TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (tenant_id, name)
);

CREATE TABLE classrooms (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id  INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  capacity   INTEGER NOT NULL DEFAULT 30
);
CREATE INDEX idx_classrooms_branch ON classrooms(branch_id);

-- ============ PEOPLE ============
CREATE TABLE teachers (
  id        SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id   INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name      TEXT NOT NULL,
  mobile    TEXT,
  email     TEXT,
  notes     TEXT,
  status    TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_teachers_tenant ON teachers(tenant_id);

CREATE TABLE teacher_subjects (
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, subject_id)
);

CREATE TABLE parents (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'father',  -- father|mother|guardian
  mobile      TEXT NOT NULL,
  alt_mobile  TEXT,
  email       TEXT,
  emergency_contact TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_parents_tenant ON parents(tenant_id);
CREATE INDEX idx_parents_mobile ON parents(tenant_id, mobile);

CREATE TABLE students (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_code   TEXT NOT NULL,
  name           TEXT NOT NULL,
  date_of_birth  DATE,
  gender         TEXT,                -- male|female
  school_name    TEXT,
  grade_level_id INTEGER REFERENCES grade_levels(id) ON DELETE SET NULL,
  curriculum_id  INTEGER REFERENCES curricula(id) ON DELETE SET NULL,
  branch_id      INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  previous_level TEXT,
  notes          TEXT,
  qr_token       TEXT NOT NULL UNIQUE,   -- secure token used in QR attendance
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_code)
);
CREATE INDEX idx_students_tenant ON students(tenant_id);
CREATE INDEX idx_students_grade ON students(tenant_id, grade_level_id);
CREATE INDEX idx_students_name ON students USING gin (to_tsvector('simple', name));

CREATE TABLE student_guardians (
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id   INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (student_id, parent_id)
);
CREATE INDEX idx_guardians_parent ON student_guardians(parent_id);

-- ============ ACADEMIC GROUPS & SCHEDULE ============
CREATE TABLE groups (
  id                SERIAL PRIMARY KEY,
  tenant_id         INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         INTEGER NOT NULL REFERENCES branches(id),
  academic_year_id  INTEGER NOT NULL REFERENCES academic_years(id),
  term_id           INTEGER NOT NULL REFERENCES terms(id),
  grade_level_id    INTEGER NOT NULL REFERENCES grade_levels(id),
  subject_id        INTEGER NOT NULL REFERENCES subjects(id),
  teacher_id        INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  classroom_id      INTEGER REFERENCES classrooms(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,    -- Mathematics Prep 3 — Group A
  max_capacity      INTEGER NOT NULL DEFAULT 30,
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name, term_id)
);
CREATE INDEX idx_groups_tenant ON groups(tenant_id);
CREATE INDEX idx_groups_teacher ON groups(teacher_id);
CREATE INDEX idx_groups_term ON groups(term_id);

CREATE TABLE group_schedules (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL
);
CREATE INDEX idx_schedules_group ON group_schedules(group_id);
CREATE INDEX idx_schedules_conflict ON group_schedules(tenant_id, day_of_week);

CREATE TABLE enrollments (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id         INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  academic_year_id INTEGER NOT NULL REFERENCES academic_years(id),
  term_id          INTEGER NOT NULL REFERENCES terms(id),
  enrolled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status           TEXT NOT NULL DEFAULT 'active',  -- pending|active|paused|completed|cancelled|dropped|expired
  fee_amount       NUMERIC(12,2),
  UNIQUE (student_id, group_id)
);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_group ON enrollments(group_id);
CREATE INDEX idx_enrollments_tenant ON enrollments(tenant_id);

-- ============ ATTENDANCE ============
CREATE TABLE attendance (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  method       TEXT NOT NULL DEFAULT 'class_list', -- class_list|search|qr
  recorded_by  INTEGER REFERENCES users(id),
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_by    INTEGER REFERENCES users(id),
  edited_at    TIMESTAMPTZ,
  UNIQUE (group_id, student_id, session_date)
);
CREATE INDEX idx_attendance_student ON attendance(student_id, session_date);
CREATE INDEX idx_attendance_group_date ON attendance(group_id, session_date);
CREATE INDEX idx_attendance_tenant_date ON attendance(tenant_id, session_date);

-- ============ HOMEWORK & MATERIALS ============
CREATE TABLE homework (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id       INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  due_date       DATE NOT NULL,
  attachment_url TEXT,
  link_url       TEXT,
  max_score      NUMERIC(6,2),
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_homework_group ON homework(group_id);

CREATE TABLE homework_submissions (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  homework_id  INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'assigned', -- assigned|viewed|submitted|late|reviewed|not_submitted
  submitted_at TIMESTAMPTZ,
  score        NUMERIC(6,2),
  feedback     TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (homework_id, student_id)
);
CREATE INDEX idx_hwsub_student ON homework_submissions(student_id);

CREATE TABLE materials (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'pdf',   -- pdf|worksheet|image|link|video|other
  url         TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_materials_group ON materials(group_id);

-- ============ QUESTION BANK & QUIZZES ============
CREATE TABLE questions (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_id     INTEGER REFERENCES subjects(id),
  grade_level_id INTEGER REFERENCES grade_levels(id),
  chapter        TEXT,
  topic          TEXT,
  difficulty     TEXT NOT NULL DEFAULT 'medium',   -- easy|medium|hard
  type           TEXT NOT NULL,  -- mcq|true_false|multi_select|short_answer|numeric|essay
  text           TEXT NOT NULL,
  options        JSONB,          -- for mcq/multi_select: [{key:'A', text:'...'}]
  correct_answer JSONB,          -- mcq:'A' | multi:['A','C'] | tf:true | numeric:42 | short/essay:reference text
  max_score      NUMERIC(6,2) NOT NULL DEFAULT 1,
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_tenant ON questions(tenant_id, subject_id, grade_level_id);

CREATE TABLE quizzes (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id         INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'quiz', -- quiz|weekly_test|monthly_test|midterm|final|placement|custom
  start_at         TIMESTAMPTZ,
  deadline         TIMESTAMPTZ,
  duration_minutes INTEGER,
  attempts_allowed INTEGER NOT NULL DEFAULT 1,
  random_order     BOOLEAN NOT NULL DEFAULT false,
  show_result      BOOLEAN NOT NULL DEFAULT true,
  total_score      NUMERIC(8,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'draft', -- draft|published|closed
  created_by       INTEGER REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quizzes_group ON quizzes(group_id);
CREATE INDEX idx_quizzes_tenant ON quizzes(tenant_id, status);

CREATE TABLE quiz_questions (
  id          SERIAL PRIMARY KEY,
  quiz_id     INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  score       NUMERIC(6,2) NOT NULL DEFAULT 1
);
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id);

CREATE TABLE quiz_attempts (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quiz_id      INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attempt_no   INTEGER NOT NULL DEFAULT 1,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score        NUMERIC(8,2),
  status       TEXT NOT NULL DEFAULT 'in_progress', -- in_progress|submitted|graded
  UNIQUE (quiz_id, student_id, attempt_no)
);
CREATE INDEX idx_attempts_student ON quiz_attempts(student_id);

CREATE TABLE quiz_answers (
  id          SERIAL PRIMARY KEY,
  attempt_id  INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  answer      JSONB,
  is_correct  BOOLEAN,
  score       NUMERIC(6,2),
  graded_by   INTEGER REFERENCES users(id),  -- non-null for manual grading
  feedback    TEXT
);
CREATE INDEX idx_answers_attempt ON quiz_answers(attempt_id);

-- ============ ASSESSMENTS & GRADEBOOK ============
CREATE TABLE assessments (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id            INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id              INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  academic_year_id      INTEGER NOT NULL REFERENCES academic_years(id),
  term_id               INTEGER NOT NULL REFERENCES terms(id),
  period                TEXT,             -- e.g. 2026-10 / Term 1 report
  academic_level        TEXT,             -- excellent|good|average|below_average
  participation         TEXT,
  homework_commitment   TEXT,
  behavior              TEXT,
  strengths             TEXT,
  weaknesses            TEXT,
  recommendation        TEXT,
  parent_followup      BOOLEAN NOT NULL DEFAULT false,
  notes                 TEXT,
  parent_visible        BOOLEAN NOT NULL DEFAULT true,
  created_by            INTEGER REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assessments_student ON assessments(student_id);

-- configurable gradebook weights (tenant-level defaults, overridable per grade)
CREATE TABLE grading_weights (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  grade_level_id  INTEGER REFERENCES grade_levels(id),  -- NULL = tenant default
  component       TEXT NOT NULL,   -- homework|quiz|weekly_test|monthly_test|midterm|final|attendance
  weight          NUMERIC(5,2) NOT NULL,               -- percentage e.g. 20.00
  UNIQUE (tenant_id, grade_level_id, component)
);

-- ============ FEES & PAYMENTS ============
CREATE TABLE discounts (
  id        SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  type      TEXT NOT NULL DEFAULT 'percent',  -- percent|fixed
  value     NUMERIC(12,2) NOT NULL,
  scope     TEXT NOT NULL DEFAULT 'custom',   -- sibling|scholarship|custom
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE fees (
  id                 SERIAL PRIMARY KEY,
  tenant_id          INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id         INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id      INTEGER REFERENCES enrollments(id) ON DELETE SET NULL,
  academic_year_id   INTEGER REFERENCES academic_years(id),
  fee_type           TEXT NOT NULL,   -- registration|subject|monthly|course|term|book|exam|other
  description        TEXT,
  amount             NUMERIC(12,2) NOT NULL,
  discount_id        INTEGER REFERENCES discounts(id),
  discount_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_after_discount NUMERIC(12,2) NOT NULL,
  due_date           DATE,
  status             TEXT NOT NULL DEFAULT 'due',  -- paid|partial|due|overdue|refunded|cancelled
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fees_student ON fees(student_id);
CREATE INDEX idx_fees_tenant_status ON fees(tenant_id, status);

CREATE TABLE installments (
  id        SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fee_id    INTEGER NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  seq       INTEGER NOT NULL,
  amount    NUMERIC(12,2) NOT NULL,
  due_date  DATE,
  status    TEXT NOT NULL DEFAULT 'due',  -- paid|partial|due|overdue
  UNIQUE (fee_id, seq)
);

CREATE TABLE payments (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fee_id       INTEGER NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES students(id),
  installment_id INTEGER REFERENCES installments(id) ON DELETE SET NULL,
  amount       NUMERIC(12,2) NOT NULL,
  method       TEXT NOT NULL,   -- cash|bank_transfer|pos|wallet|instapay|online|other
  paid_at      DATE NOT NULL,
  reference    TEXT,
  receipt_no   TEXT,
  recorded_by  INTEGER REFERENCES users(id),
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'paid',  -- paid|refunded|cancelled
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_tenant_date ON payments(tenant_id, paid_at);
CREATE INDEX idx_payments_fee ON payments(fee_id);

-- ============ LEADS / ADMISSIONS CRM ============
CREATE TABLE leads (
  id                 SERIAL PRIMARY KEY,
  tenant_id          INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  parent_name        TEXT,
  mobile             TEXT NOT NULL,
  source             TEXT NOT NULL DEFAULT 'walkin', -- facebook|instagram|tiktok|whatsapp|referral|walkin|school_referral|website|other
  stage              TEXT NOT NULL DEFAULT 'lead',   -- lead|contacted|trial|interested|registration_pending|registered|paid|active|lost
  branch_id          INTEGER REFERENCES branches(id),
  grade_level_id     INTEGER REFERENCES grade_levels(id),
  subject_interest   TEXT,
  notes              TEXT,
  assigned_to        INTEGER REFERENCES users(id),
  converted_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_tenant_stage ON leads(tenant_id, stage);

CREATE TABLE crm_activities (
  id        SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id   INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id   INTEGER REFERENCES users(id),
  type      TEXT NOT NULL,    -- call|whatsapp|visit|note|status_change
  content   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_lead ON crm_activities(lead_id);

-- ============ NOTIFICATIONS & ANNOUNCEMENTS ============
CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- target user
  type       TEXT NOT NULL,   -- absent|late|homework|quiz|exam|assessment|fee_due|fee_overdue|payment|schedule_change|announcement
  title      TEXT NOT NULL,
  body       TEXT,
  data       JSONB,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE announcements (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  audience   TEXT NOT NULL DEFAULT 'center',  -- center|branch|grade|subject|group|student
  branch_id  INTEGER REFERENCES branches(id),
  grade_level_id INTEGER REFERENCES grade_levels(id),
  subject_id INTEGER REFERENCES subjects(id),
  group_id   INTEGER REFERENCES groups(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcements_tenant ON announcements(tenant_id, created_at DESC);

-- ============ AUDIT TRAIL ============
CREATE TABLE audit_logs (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER,
  user_id    INTEGER,
  action     TEXT NOT NULL,       -- create|update|delete|login|attendance_edit|grade_edit|payment_edit...
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  old_value  JSONB,
  new_value  JSONB,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
