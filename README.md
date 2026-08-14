# EduCenter OS — منصة إدارة مراكز التعليم الخاص

Multi-tenant SaaS platform for private education centers (Egypt-first). Digitizes registration, attendance, homework, quizzes, gradebook, fees/payments, CRM admissions, and provides role-based PWAs for management, teachers, parents, and students.

> العربية أولاً (RTL) مع تبديل اللغة الإنجليزية — Arabic-first RTL with an English toggle.

---

## ✨ Features

### 🏢 Multi-Tenancy
- Full row-level isolation: every table carries `tenant_id`, every query is tenant-scoped.
- One deployment serves many centers; a platform super-admin manages tenants.
- Verified tenant isolation by automated smoke tests.

### 👥 Roles & Access (RBAC)
`super_admin`, `owner`, `admin`, `branch_manager`, `reception`, `finance`, `teacher`, `parent`, `student`

| Portal | Highlights |
|---|---|
| **Management** | 11-KPI dashboard, students/teachers/groups CRUD, finance, CRM pipeline, insights & risk, 9 reports with CSV export |
| **Teacher** | Today's schedule, mark attendance (3 methods), homework + submissions review, quiz builder from question bank, auto-grading, assessments |
| **Parent** | Children summary, attendance history, grades & topic performance, fees & payment status, announcements |
| **Student** | Today's classes, homework, quizzes (take + instant score), grades, materials |

### 📝 Registration & Students
- Full student file: guardian(s), branch, grade level, enrollment into groups (with capacity checks/override).
- QR token per student for scan attendance; CSV export with UTF-8 BOM (Arabic-Excel-safe).

### ✅ Attendance — 3 Methods
1. **Class list bulk mark** — teacher opens group, marks present/absent/late/excused.
2. **QR scan** — student QR token scanned at entry.
3. **Staff search** — reception searches a name and marks manually.
- Mark-all-present shortcut, edits recorded in audit log, parents auto-notified of absences.

### 📚 Academics
- **Homework**: assign to full roster automatically, submissions review & scoring.
- **Question bank**: tag by subject/grade/chapter/topic/difficulty.
- **Quiz/Exam engine**: build from bank, publish, timed attempts, **auto-grading** (MCQ / True-False / multi-select / numeric) + manual essay grading, topic-level analytics.
- **Gradebook**: configurable weighted averages per tenant (homework/quiz/midterm/final), attendance %, topic mastery from actual quiz answers.
- **Assessments**: periodic teacher evaluations with parent notification.

### 💰 Finance
- Fees with **installments**, discounts, payments; statuses auto-recomputed on payment.
- Refund/cancel with audit trail. Collection dashboards by branch/grade/group.

### 📞 CRM Admissions
- Lead pipeline: `new → contacted → visit → trial → negotiation → enrolled/lost`.
- Activities log, conversion stats.

### 🚨 Risk Engine (pure SQL, no AI)
Five deterministic rules flag at-risk students: absence rate, overdue payments, falling quiz average, missing homework, behavioral assessments. Follow-up list for staff.

### 🔒 Platform
- JWT auth (email/username/mobile login), bcrypt passwords.
- Audit log on sensitive mutations.
- Rate limiting, helmet-style headers.
- Notifications per user; role/group-aware announcements.

---

## 🧱 Tech Stack

| Layer | Choice | Why |
|---|---|---|
| DB | PostgreSQL | via `embedded-postgres` for zero-dependency local dev (no Docker, no admin) |
| API | Node.js + Express | REST, JWT, modular routers |
| Frontend | Vanilla JS SPA + PWA | no build step, no npm for web — runs from `/web/public` |
| i18n | Built-in STR dictionary | ar (RTL, default) ⇄ en |

---

## 🚀 Quick Start (localhost)

```bash
cd educenter-os
npm install
npm run db:start     # boot embedded PostgreSQL (first run initializes cluster)
npm run migrate      # create schema
npm run seed         # realistic Egyptian demo data (2 centers, 205 students)
npm run dev          # http://localhost:3000
```

Run QA any time: `npm run smoke` — 31 automated tests (auth, RBAC, tenant & parent isolation, attendance, finance, risk engine, gradebook).

### Demo Accounts (seeded)

| Role | Login | Password |
|---|---|---|
| Platform Super Admin | `super@educenter.eg` | `Super@123` |
| Owner (Al-Noor Academy) | `owner@alnoor.edu.eg` | `Owner@123` |
| Teacher | `t.mona@alnoor.edu.eg` | `Teacher@123` |
| Parent | `p.father1@alnoor.edu.eg` | `Parent@123` |
| Student | `s.student1@alnoor.edu.eg` | `Student@123` |

(Tenant 2 — Future International School — uses `@future.edu.eg` equivalents to demo isolation.)

### PWA Install
Open the app in a browser → install as app (standalone display, RTL, Arabic name). Manifest at `web/public/manifest.json`.

---

## ☁️ Deployment (Railway-ready)

1. Provision **PostgreSQL** (Railway plugin or any URL).
2. Set env vars:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/educenter
   JWT_SECRET=<long-random-string>
   PORT=3000
   ```
3. `npm start` (runs migrations then server — see `server/src/index.js`).
4. Static frontend is served by Express from `web/public`.

`.env.example` documents all variables. Local dev uses embedded Postgres; production points `DATABASE_URL` at the hosted DB.

---

## 📁 Structure

```
educenter-os/
├─ package.json            # scripts: db:start/stop, migrate, seed, dev, smoke
├─ scripts/local-db.js     # embedded PostgreSQL lifecycle
├─ server/
│  ├─ sql/                 # 001_init.sql, 002_student_login.sql
│  ├─ src/
│  │  ├─ index.js          # Express app entry
│  │  ├─ db.js  migrate.js  seed.js  smoke.js
│  │  ├─ middleware/       # auth (JWT/RBAC), guards (tenant scope, audit, rate limit)
│  │  └─ routes/           # 25+ routers: auth, students, attendance, quizzes,
│  │                       # gradebook, fees, payments, leads, insights, reports…
└─ web/public/             # PWA SPA: index.html, app.js, manifest.json, icon.svg
```

## 🇪🇬 Egypt-First
Arabic-first RTL UI, Egyptian naming/demo data (Cairo branches), EGP fees & installments, hijri-friendly term/academic-year config, Arabic CSV exports that open correctly in Excel.
