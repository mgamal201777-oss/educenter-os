/**
 * Demo seed — realistic Egyptian education-center data.
 * 2 centers, multiple branches (Cairo areas), 200+ students, teachers, groups,
 * attendance history, homework, quizzes with topic-tagged questions, exams,
 * fees/installments/payments (incl. overdue), leads CRM, risk students.
 *
 * Deterministic PRNG so runs are reproducible.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('./db');

let seed = 42;
function rnd() { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; }
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const qr = () => crypto.randomBytes(24).toString('hex');

const BOYS = ['Ahmed', 'Mohamed', 'Omar', 'Youssef', 'Khaled', 'Mostafa', 'Karim', 'Tarek', 'Hassan', 'Ali',
  'Mahmoud', 'Amr', 'Ibrahim', 'Adel', 'Sherif', 'Hany', 'Sameh', 'Fady', 'Nader', 'Basel'];
const GIRLS = ['Sara', 'Mona', 'Nour', 'Farida', 'Mariam', 'Yasmin', 'Habiba', 'Salma', 'Jana', 'Laila',
  'Aya', 'Heba', 'Rana', 'Dina', 'Nada', 'Menna', 'Rawan', 'Sandra', 'Marwa', 'Amira'];
const FAMILY = ['Ibrahim', 'Hassan', 'Mostafa', 'Abdelrahman', 'El-Sayed', 'Fahmy', 'Zaki', 'Shokry',
  'Nabil', 'Kamel', 'Rashad', 'Fawzy', 'Selim', 'Habib', 'Louka', 'Wagdy', 'Botros', 'Girgis'];
const PARENT_M = ['Hassan', 'Ibrahim', 'Mohamed', 'Saeed', 'Fathy', 'Emad', 'Ragab', 'Sabry', 'Ezzat', 'Fouad'];
const SCHOOLS = ['El Nasr School', 'Manar El Eman', 'Future International School', 'Kobri El Qobba Prep',
  'Mostafa Kamel', 'El Orman School', 'Zahraa Nasr City', 'Abed El Moneim Riad'];

async function main() {
  // HARD GUARD: demo seed must NEVER run against production, no exceptions.
  if (process.env.NODE_ENV === 'production') {
    console.log('[seed] NODE_ENV=production — demo seed permanently disabled');
    await pool.end();
    process.exit(0);
  }
  // Local dev safety: never wipe a non-empty local DB unless explicitly forced
  const existing = await pool.query('SELECT 1 FROM users LIMIT 1').catch(() => null);
  if (existing && existing.rowCount > 0 && process.env.SEED_FORCE !== 'true') {
    console.log('[seed] data already present — skipping (set SEED_FORCE=true to reseed locally)');
    await pool.end();
    return;
  }
    console.log('[seed] resetting demo data...');
  await pool.query('TRUNCATE tenants CASCADE');

  // Strong platform credentials (super admin) — demo staff/student accounts use a separate demo password
  const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Edu@a14ba1536f23!2026';
  const H = bcrypt.hashSync('Edu@Demo-2026', 10);

  // ============ PLATFORM ============
  const superAdmin = await pool.query(
    `INSERT INTO users (role, full_name, email, username, password_hash, locale)
     VALUES ('super_admin','Platform Admin','admin@educenter.app','superadmin',$1,'en') RETURNING id`,
    [bcrypt.hashSync(SUPER_ADMIN_PASSWORD, 12)]);

  // ============ TENANT 1: النخبة التعليمية (Nasr City + Maadi) ============
  const t1 = (await pool.query(
    `INSERT INTO tenants (name, slug, plan, status, contact_name, contact_phone, contact_email, settings)
     VALUES ('مركز النخبة التعليمي','elite-academy','premium','active','Hany Ramzy','01001234567','info@elite.edu.eg',
       '{"currency":"EGP","locale":"ar","grading":{"homework":10,"quiz":20,"midterm":30,"final":40}}') RETURNING id`)).rows[0].id;

  // ============ TENANT 2: Future Leaders (Heliopolis + Shorouk) ============
  const t2 = (await pool.query(
    `INSERT INTO tenants (name, slug, plan, status, contact_name, contact_phone, contact_email, settings)
     VALUES ('Future Leaders Learning Center','future-leaders','standard','active','Nashwa Selim','01112223334','hello@futureleaders.edu.eg',
       '{"currency":"EGP","locale":"ar"}') RETURNING id`)).rows[0].id;
    global.t1 = t1; global.t2 = t2;

  // NOTE: no client/tenant owner accounts are seeded.
  // Client admins are created manually from the super admin portal
  // (Tenants -> Create center) as a real-world verification test.

  const staff = async (tenant, role, name, email, username, branchId) =>
    (await pool.query(
      `INSERT INTO users (tenant_id, role, full_name, email, username, password_hash, locale, branch_id)
       VALUES ($1,$2,$3,$4,$5,$6,'ar',$7) RETURNING id`,
      [tenant, role, name, email, username, H, branchId || null])).rows[0].id;
  await staff(t1, 'reception', 'سارة محمود', 'reception@elite.edu.eg', 'elite-reception', null);
  await staff(t1, 'finance', 'خالد سمير', 'finance@elite.edu.eg', 'elite-finance', null);
  await staff(t2, 'reception', 'Dina Adel', 'reception@futureleaders.edu.eg', 'fl-reception', null);

  for (const tid of [t1, t2]) {
    // academic structure
    const cur = (await pool.query(
      `INSERT INTO curricula (tenant_id, name) VALUES ($1,'اللغة العربية'),($1,'National'),($1,'International') RETURNING id`, [tid])).rows;
    const year = (await pool.query(
      `INSERT INTO academic_years (tenant_id, name, start_date, end_date, is_current)
       VALUES ($1,'2025/2026','2025-09-01','2026-06-30',true) RETURNING id`, [tid])).rows[0].id;
    const term1 = (await pool.query(
      `INSERT INTO terms (tenant_id, academic_year_id, name, start_date, end_date)
       VALUES ($1,$2,'Term 1','2025-09-01','2026-01-31') RETURNING id`, [tid, year])).rows[0].id;
    const term2 = (await pool.query(
      `INSERT INTO terms (tenant_id, academic_year_id, name, start_date, end_date, is_current)
       VALUES ($1,$2,'Term 2','2026-02-01','2026-06-30',true) RETURNING id`, [tid, year])).rows[0].id;

    const grades = [];
    const gradeDefs = [
      ['Grade 5', 'primary', 5], ['Grade 6', 'primary', 6], ['Preparatory 1', 'preparatory', 7],
      ['Preparatory 2', 'preparatory', 8], ['Preparatory 3', 'preparatory', 9],
      ['Secondary 1', 'secondary', 10], ['Secondary 2', 'secondary', 11],
    ];
    for (const [name, stage, order] of gradeDefs) {
      grades.push((await pool.query(
        `INSERT INTO grade_levels (tenant_id, name, stage, sort_order) VALUES ($1,$2,$3,$4) RETURNING id`,
        [tid, name, stage, order])).rows[0].id);
    }
    const subjects = [];
    for (const [name, nameEn] of [['الرياضيات', 'Mathematics'], ['اللغة العربية', 'Arabic'], ['اللغة الإنجليزية', 'English'],
      ['الفيزياء', 'Physics'], ['الكيمياء', 'Chemistry']]) {
      subjects.push((await pool.query(
        `INSERT INTO subjects (tenant_id, name, name_en) VALUES ($1,$2,$3) RETURNING id`, [tid, name, nameEn])).rows[0].id);
    }
    // grading weights
    await pool.query(`INSERT INTO grading_weights (tenant_id, component, weight)
      VALUES ($1,'homework',10),($1,'quiz',20),($1,'midterm',30),($1,'final',40)`, [tid]);
    // discounts
    await pool.query(`INSERT INTO discounts (tenant_id, name, type, value, scope)
      VALUES ($1,'Sibling discount','percent',10,'sibling'),($1,'Scholarship','percent',25,'scholarship')`, [tid]);

    if (tid === t1) {
      global.ctx1 = { year, term1, term2, grades, subjects };
    } else {
      global.ctx2 = { year, term1, term2, grades, subjects };
    }
  }

  // branches & classrooms
  const branchDefs = {
    [t1]: [['مدينة نصر', 'القاهرة', 'Nasr City', '12 Abbas El Akkad St.'], ['المعادي', 'القاهرة', 'Maadi', '9 Road 9, Maadi']],
    [t2]: [['مصر الجديدة', 'القاهرة', 'Heliopolis', '45 El-Mirghany St.'], ['الشروك', 'القاهرة', 'Shorouk', 'Villages Blvd, Shorouk']],
  };
  const branchIds = {};
  for (const [tidKey, defs] of Object.entries(branchDefs)) {
    const tid = Number(tidKey);
    branchIds[tid] = [];
    for (const [name, gov, city, address] of defs) {
      const b = (await pool.query(
        `INSERT INTO branches (tenant_id, name, governorate, city, address, phone, opening_hours)
         VALUES ($1,$2,$3,$4,$5,$6,'2PM-10PM') RETURNING id`,
        [tid, name, gov, city, address, `02${int(20000000, 29999999)}`])).rows[0].id;
      branchIds[tid].push(b);
      for (let cr = 1; cr <= 3; cr++) {
        await pool.query('INSERT INTO classrooms (tenant_id, branch_id, name, capacity) VALUES ($1,$2,$3,$4)',
          [tid, b, `Room ${cr}`, pick([20, 25, 30])]);
      }
    }
  }
  global.branchIds = branchIds;

  await buildTenantData(t1, 'elite', H);
  await buildTenantData(t2, 'future', H);

  const counts = await pool.query(`SELECT
    (SELECT count(*) FROM students) students,
    (SELECT count(*) FROM parents) parents,
    (SELECT count(*) FROM teachers) teachers,
    (SELECT count(*) FROM groups) groups,
    (SELECT count(*) FROM attendance) attendance,
    (SELECT count(*) FROM fees) fees,
    (SELECT count(*) FROM payments) payments,
    (SELECT count(*) FROM leads) leads`);
  console.log('[seed] done:', counts.rows[0]);
  await pool.end();
}

async function buildTenantData(tid, prefix, H) {
  const ctx = tid === global.t1 ? global.ctx1 : global.ctx2;
  const { year, term1, term2, grades, subjects } = ctx;
  const branches = global.branchIds[tid];

  // ---- teachers ----
  const teacherNames = [
    ['أحمد سمير', 'Math', 'ahmed.samir'], ['عمر حسن', 'Math', 'omar.hassan'], ['نهى عبد الله', 'Arabic', 'noha.abdallah'],
    ['منى كمال', 'English', 'mona.kamal'], ['طارق زكي', 'Physics', 'tarek.zaki'], ['هالة فهمي', 'Chemistry', 'hala.fahmy'],
  ];
  const teachers = [];
  for (const [name, sub, uname] of teacherNames) {
    const u = (await pool.query(
      `INSERT INTO users (tenant_id, role, full_name, email, username, password_hash, locale)
       VALUES ($1,'teacher',$2,$3,$4,$5,'ar') RETURNING id`,
      [tid, name, `${uname}@${prefix}.edu.eg`, `${prefix}-${uname}`, H])).rows[0].id;
    const t = (await pool.query(
      `INSERT INTO teachers (tenant_id, user_id, name, mobile, email) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [tid, u, name, `010${int(10000000, 99999999)}`, `${uname}@${prefix}.edu.eg`])).rows[0].id;
    // assign subject: find matching
    const subjIdx = ['Math', 'Arabic', 'English', 'Physics', 'Chemistry'].indexOf(sub);
    if (subjIdx >= 0) await pool.query('INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1,$2)', [t, subjects[subjIdx]]);
    teachers.push({ id: t, subjectIdx: subjIdx });
  }

  // ---- groups: for each subject, 1-2 groups across grades ----
  const groups = [];
  const subjectMeta = [['Mathematics Prep 3', 4, 0], ['Mathematics Sec 2', 6, 1], ['Arabic Prep 2', 3, 2],
    ['English Grade 6', 1, 3], ['Physics Sec 2', 6, 4], ['Chemistry Sec 1', 5, 5]];
  for (const [gname, gradeIdx, teacherIdx] of subjectMeta) {
    const branch = branches[groups.length % branches.length];
    const teacher = teachers[teacherIdx];
    const capacity = pick([25, 30, 30]);
    const g = (await pool.query(
      `INSERT INTO groups (tenant_id, branch_id, academic_year_id, term_id, grade_level_id, subject_id,
         teacher_id, name, max_capacity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [tid, branch, year, term2, grades[gradeIdx], subjects[teacher.subjectIdx], teacher.id, gname, capacity])).rows[0].id;
    const days = pick([[0, 3], [1, 4], [0, 2, 4]]); // Sun+Wed, Mon+Thu, ...
    for (const d of days) {
      const start = pick(['14:00', '16:00', '18:00', '20:00']);
      const [hh, mm] = start.split(':').map(Number);
      const end = `${String(hh + 2).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      await pool.query('INSERT INTO group_schedules (tenant_id, group_id, day_of_week, start_time, end_time) VALUES ($1,$2,$3,$4,$5)',
        [tid, g, d, start, end]);
    }
    groups.push({ id: g, name: gname, capacity, teacherId: teacher.id, subjectIdx: teacher.subjectIdx });
  }

  // ---- students + parents ----
  const N = tid === global.t1 ? 120 : 85;
  const studentIds = [];
  const parentRows = new Map(); // mobile -> {id, userId, children}
  for (let i = 0; i < N; i++) {
    const isBoy = rnd() > 0.5;
    const first = isBoy ? pick(BOYS) : pick(GIRLS);
    const last = pick(FAMILY);
    const name = `${first} ${last}`;
    const gradeIdx = int(1, grades.length - 1);
    const code = `${prefix.toUpperCase()}-${String(i + 1).padStart(4, '0')}`;

    // 60% chance this student belongs to an existing family (siblings)
    let parent = null;
    const famList = [...parentRows.values()];
    if (famList.length > 10 && rnd() < 0.6) {
      const candidate = pick(famList);
      if (candidate.children < 3) parent = candidate;
    }
    if (!parent) {
      const pmobile = `01${pick(['0','1','2','5'])}${int(10000000, 99999999)}`;
      const pname = `${pick(PARENT_M)} ${last}`;
      const puser = (await pool.query(
        `INSERT INTO users (tenant_id, role, full_name, mobile, username, password_hash, locale)
         VALUES ($1,'parent',$2,$3,$4,$5,'ar') RETURNING id`,
        [tid, pname, pmobile, `par_${prefix}_${parentRows.size + 1}`, H])).rows[0].id;
      const pid = (await pool.query(
        `INSERT INTO parents (tenant_id, user_id, name, relationship, mobile) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [tid, puser, pname, rnd() > 0.15 ? 'father' : 'mother', pmobile])).rows[0].id;
      parent = { id: pid, userId: puser, children: 0, mobile: pmobile };
      parentRows.set(pmobile, parent);
    }
    parent.children++;

    // student user account (login as student)
    const suser = (await pool.query(
      `INSERT INTO users (tenant_id, role, full_name, username, password_hash, locale)
       VALUES ($1,'student',$2,$3,$4,'ar') RETURNING id`,
      [tid, name, `stu_${prefix}_${i + 1}`, H])).rows[0].id;

    const sid = (await pool.query(
      `INSERT INTO students (tenant_id, student_code, name, date_of_birth, gender, school_name,
         grade_level_id, curriculum_id, branch_id, qr_token, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [tid, code, name, `${2010 - gradeIdx}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`,
        isBoy ? 'male' : 'female', pick(SCHOOLS), grades[gradeIdx], null, pick(branches), qr(), suser])).rows[0].id;
    await pool.query('INSERT INTO student_guardians (student_id, parent_id, is_primary) VALUES ($1,$2,true)', [sid, parent.id]);
    studentIds.push({ id: sid, gradeIdx, parent });
  }

  // ---- enrollments (each student: 1-3 groups matching approximate grade) ----
  const enrollments = [];
  for (const s of studentIds) {
    const nSubs = int(1, 3);
    const shuffled = [...groups].sort(() => rnd() - 0.5).slice(0, nSubs);
    for (const g of shuffled) {
      // capacity enforcement (soft — allow a couple over)
      const cur = enrollments.filter((e) => e.groupId === g.id).length;
      if (cur >= g.capacity + 2) continue;
      const feeAmount = pick([2400, 3000, 3600, 4800]);
      const e = (await pool.query(
        `INSERT INTO enrollments (tenant_id, student_id, group_id, academic_year_id, term_id, status, fee_amount)
         VALUES ($1,$2,$3,$4,$5,'active',$6) RETURNING id`,
        [tid, s.id, g.id, year, term2, feeAmount])).rows[0].id;
      // fee + 3 installments
      const f = (await pool.query(
        `INSERT INTO fees (tenant_id, student_id, enrollment_id, academic_year_id, fee_type, description,
           amount, total_after_discount, due_date, status)
         VALUES ($1,$2,$3,$4,'subject',$5,$6,$6,(CURRENT_DATE - 40)::date,'due') RETURNING id`,
        [tid, s.id, e, year, `Subject fee — ${g.name}`, feeAmount])).rows[0].id;
      const third = Math.round(feeAmount / 3);
      for (let k = 1; k <= 3; k++) {
        await pool.query('INSERT INTO installments (tenant_id, fee_id, seq, amount, due_date) VALUES ($1,$2,$3,$4,CURRENT_DATE - ($5::int))',
          [tid, f, k, k < 3 ? third : feeAmount - 2 * third, 40 - (k - 1) * 15]);
      }
      enrollments.push({ id: e, studentId: s.id, groupId: g.id, feeId: f, feeAmount, parent: s.parent });
    }
  }
  console.log(`[seed] tenant ${prefix}: ${studentIds.length} students, ${enrollments.length} enrollments`);

  // ---- payments: ~70% collection rate with variety ----
  const methods = ['cash', 'instapay', 'bank_transfer', 'wallet', 'pos'];
  for (const enr of enrollments) {
    const r = rnd();
    let payTotal = 0;
    if (r < 0.45) payTotal = enr.feeAmount;                       // fully paid
    else if (r < 0.7) payTotal = Math.round(enr.feeAmount / 3);   // first installment
    else if (r < 0.8) payTotal = Math.round(enr.feeAmount / 2);   // partial
    // else unpaid
    if (payTotal > 0) {
      const p = (await pool.query(
        `INSERT INTO payments (tenant_id, fee_id, student_id, amount, method, paid_at, reference, recorded_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,null,'paid') RETURNING id`,
        [tid, enr.feeId, enr.studentId, payTotal, pick(methods),
          new Date(Date.now() - int(5, 55) * 86400000).toISOString().slice(0, 10), `REF-${int(10000, 99999)}`])).rows[0];
      await pool.query('UPDATE fees SET status = $1 WHERE id = $2',
        [payTotal >= enr.feeAmount ? 'paid' : 'partial', enr.feeId]);
    } else {
      // ~half of unpaid become overdue
      if (rnd() < 0.5) await pool.query("UPDATE fees SET status = 'overdue' WHERE id = $1", [enr.feeId]);
    }
  }

  // ---- question bank ----
  const topicsBySubject = {
    0: [['Algebra', 'Equations'], ['Geometry', 'Triangles'], ['Fractions', 'Operations'], ['Problem Solving', 'Word problems']],
    1: [['النحو', 'الفاعل والمفعول'], ['القراءة', 'الفهم'], ['البلاغة', 'التشبيه']],
    2: [['Grammar', 'Tenses'], ['Reading', 'Comprehension'], ['Vocabulary', 'Synonyms']],
    3: [['Mechanics', 'Motion'], ['Electricity', 'Ohm law'], ['Optics', 'Lenses']],
    4: [['Organic', 'Hydrocarbons'], ['Acids & Bases', 'pH'], ['Periodic Table', 'Groups']],
  };
  const questionIds = { }; // subjectIdx -> [ids]
  for (const g of groups) {
    const topics = topicsBySubject[g.subjectIdx] || topicsBySubject[0];
    questionIds[g.subjectIdx] = questionIds[g.subjectIdx] || [];
    for (const [chapter, topic] of topics) {
      for (let qi = 0; qi < 4; qi++) {
        const qid = (await pool.query(
          `INSERT INTO questions (tenant_id, subject_id, grade_level_id, chapter, topic, difficulty, type, text, options, correct_answer, max_score)
           VALUES ($1,$2,$3,$4,$5,$6,'mcq',$7,$8,$9,$10) RETURNING id`,
          [tid, subjects[g.subjectIdx], null, chapter, topic, pick(['easy', 'medium', 'hard']),
            `${topic} — question ${qi + 1}: which answer is correct?`,
            JSON.stringify([{ key: 'A', text: 'Option A' }, { key: 'B', text: 'Option B' },
              { key: 'C', text: 'Option C' }, { key: 'D', text: 'Option D' }]),
            JSON.stringify(pick(['A', 'B', 'C', 'D'])), 2])).rows[0].id;
        questionIds[g.subjectIdx].push({ id: qid, topic, chapter });
      }
    }
  }

  // ---- quizzes + homework + attendance (past 8 weeks for the schedule) ----
  for (const g of groups) {
    const roster = (await pool.query(
      'SELECT student_id FROM enrollments WHERE group_id = $1 AND status = $2', [g.id, 'active'])).rows;

    // quizzes: 3 per group, published & closed
    for (let qi = 0; qi < 3; qi++) {
      const qids = (questionIds[g.subjectIdx] || []).sort(() => rnd() - 0.5).slice(0, 5);
      const totalScore = qids.length * 2;
      const quizType = qi === 2 ? (rnd() < 0.5 ? 'midterm' : 'final') : 'quiz';
      const q = (await pool.query(
        `INSERT INTO quizzes (tenant_id, group_id, title, type, start_at, deadline, duration_minutes,
           attempts_allowed, show_result, total_score, status, created_by)
         VALUES ($1,$2,$3,$4, now() - interval '50 days', now() - interval '48 days', 30, 1, true, $5, 'closed', null)
         RETURNING id`,
        [tid, g.id, `${quizType === 'quiz' ? 'Quiz' : quizType} ${qi + 1} — ${g.name}`, quizType, totalScore])).rows[0].id;
      let pos = 1;
      for (const qid2 of qids) {
        await pool.query('INSERT INTO quiz_questions (quiz_id, question_id, position, score) VALUES ($1,$2,$3,$4)',
          [q, qid2.id, pos++, 2]);
      }
      // student attempts — performance varies by "student ability"
      for (const r of roster) {
        if (rnd() < 0.15) continue; // some didn't attempt
        const ability = int(30, 95); // per-student-quiz score %
        const attempt = (await pool.query(
          `INSERT INTO quiz_attempts (tenant_id, quiz_id, student_id, attempt_no, submitted_at, status)
           VALUES ($1,$2,$3,1, now() - interval '48 days','graded') RETURNING id`,
          [tid, q, r.student_id])).rows[0].id;
        let score = 0;
        for (const qid2 of qids) {
          const correct = rnd() * 100 < ability;
          if (correct) score += 2;
          await pool.query(
            `INSERT INTO quiz_answers (attempt_id, question_id, answer, is_correct, score)
             VALUES ($1,$2,$3,$4,$5)`,
            [attempt, qid2.id, JSON.stringify(correct ? 'A' : 'B'), correct, correct ? 2 : 0]);
        }
        await pool.query('UPDATE quiz_attempts SET score = $1 WHERE id = $2', [score, attempt]);
      }
    }

    // homework: 4 per group
    for (let hw = 0; hw < 4; hw++) {
      const due = new Date(Date.now() - int(3, 25) * 86400000).toISOString().slice(0, 10);
      const hid = (await pool.query(
        `INSERT INTO homework (tenant_id, group_id, title, description, due_date, max_score, created_at)
         VALUES ($1,$2,$3,$4,$5,10, now() - interval '20 days') RETURNING id`,
        [tid, g.id, `Homework ${hw + 1}`, `Solve exercises chapter ${hw + 1}`, due])).rows[0].id;
      for (const r of roster) {
        const p = rnd();
        const status = p < 0.55 ? 'reviewed' : p < 0.75 ? 'submitted' : p < 0.85 ? 'late' : 'not_submitted';
        const score = status === 'reviewed' ? int(4, 10) : null;
        await pool.query(
          `INSERT INTO homework_submissions (tenant_id, homework_id, student_id, status, submitted_at, score)
           VALUES ($1,$2,$3,$4, $5, $6)`,
          [tid, hid, r.student_id, status, ['submitted', 'reviewed', 'late'].includes(status) ? new Date(Date.now() - 86400000 * int(2, 25)) : null, score]);
      }
    }

    // materials
    for (let m = 0; m < 2; m++) {
      await pool.query(
        `INSERT INTO materials (tenant_id, group_id, title, type, url) VALUES ($1,$2,$3,$4,$5)`,
        [tid, g.id, `Revision sheet ${m + 1}`, 'pdf', `https://example.com/materials/${prefix}-${g.id}-${m + 1}.pdf`]);
    }

    // attendance: Term 2 window (Feb–Jun 2026) on scheduled days
    const sched = (await pool.query('SELECT day_of_week FROM group_schedules WHERE group_id = $1', [g.id])).rows;
    const days = sched.map((s) => s.day_of_week);
    // pick a "risk" student to miss 3+ consecutive sessions
    const riskStudent = roster.length ? pick(roster).student_id : null;
    let consec = 0;
    for (let d = 60; d >= 0; d--) {
      const date = new Date(Date.now() - d * 86400000);
      if (!days.includes(date.getDay())) continue;
      const iso = date.toISOString().slice(0, 10);
      for (const r of roster) {
        let status;
        if (r.student_id === riskStudent && consec < 4 && d < 20) { status = 'absent'; consec++; }
        else { const p = rnd(); status = p < 0.82 ? 'present' : p < 0.92 ? 'absent' : p < 0.98 ? 'late' : 'excused'; }
        await pool.query(
          `INSERT INTO attendance (tenant_id, group_id, student_id, session_date, status, method)
           VALUES ($1,$2,$3,$4,$5,'class_list') ON CONFLICT DO NOTHING`,
          [tid, g.id, r.student_id, iso, status]);
      }
    }

    // assessments for a few students
    for (const r of roster.slice(0, 3)) {
      await pool.query(
        `INSERT INTO assessments (tenant_id, student_id, group_id, academic_year_id, term_id, period,
           academic_level, participation, homework_commitment, behavior, strengths, weaknesses,
           recommendation, parent_followup, parent_visible)
         VALUES ($1,$2,$3,$4,$5,'2026-07','good','active','committed','respectful',
           'Strong problem solving','Needs more revision at home','Continue current pace',true,true)`,
        [tid, r.student_id, g.id, year, term2]);
    }
  }

  // ---- leads CRM ----
  const sources = ['facebook', 'instagram', 'tiktok', 'whatsapp', 'referral', 'walkin', 'school_referral', 'website'];
  const stages = ['lead', 'contacted', 'trial', 'interested', 'registration_pending', 'registered', 'paid', 'active', 'lost'];
  for (let i = 0; i < 60; i++) {
    const r = rnd();
    const stage = r < 0.15 ? 'lead' : r < 0.3 ? 'contacted' : r < 0.45 ? 'trial' : r < 0.55 ? 'interested'
      : r < 0.65 ? 'registration_pending' : r < 0.78 ? 'registered' : r < 0.88 ? 'paid' : r < 0.94 ? 'active' : 'lost';
    await pool.query(
      `INSERT INTO leads (tenant_id, name, parent_name, mobile, source, stage, branch_id, grade_level_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [tid, `${pick(BOYS)} ${pick(FAMILY)}`, `${pick(PARENT_M)} ${pick(FAMILY)}`,
        `01${pick(['0', '1', '2', '5'])}${int(10000000, 99999999)}`, pick(sources), stage,
        pick(branches), pick(grades)]);
  }

  // ---- announcements ----
  await pool.query(
    `INSERT INTO announcements (tenant_id, title, body, audience)
     VALUES ($1,'بدء امتحانات منتصف الفصل','تبدأ امتحانات منتصف الفصل الدراسي الأول يوم الأحد القادم. بالتوفيق للجميع.','center')`, [tid]);
  await pool.query(
    `INSERT INTO announcements (tenant_id, title, body, audience)
     VALUES ($1,'Mid-term exams schedule','The mid-term exam schedule is now available. Good luck!','center')`, [tid]);
}

main().catch((e) => { console.error('[seed] FAILED:', e); process.exit(1); });



