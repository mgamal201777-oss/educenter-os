/* EduCenter OS — PWA front-end (vanilla JS SPA, ar/en with RTL) */
const API = '';
const $ = (sel) => document.querySelector(sel);
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  lang: localStorage.getItem('lang') || 'ar',
  route: location.hash.slice(1) || 'home',
  data: {},
};

// ---------- i18n ----------
const STR = {
  ar: {
    login: 'تسجيل الدخول', identifier: 'اسم المستخدم أو البريد أو الموبايل', password: 'كلمة المرور',
    demoAccounts: 'حسابات تجريبية (كلمة المرور 123456)', dashboard: 'الرئيسية', students: 'الطلاب',
    attendance: 'الحضور', groups: 'المجموعات', finance: 'المالية', fees: 'الرسوم', payments: 'المدفوعات',
    leads: 'العملاء المحتملون', teachers: 'المعلمون', reports: 'التقارير', insights: 'التحليلات الذكية',
    logout: 'تسجيل الخروج', activeStudents: 'طلاب نشطون', newStudents: 'طلاب جدد (30 يوم)',
    expected: 'المتوقع', collected: 'المحصل', outstanding: 'المتبقي', overdue: 'المتأخر',
    collectionPct: 'نسبة التحصيل', todayClasses: 'حصص اليوم', riskStudents: 'طلاب في خطر',
    attendancePct30: 'نسبة الحضور (30 يوم)', leadsReg: 'تسجيلات من العملاء المحتملين',
    markAll: 'تحديد الكل حاضر', save: 'حفظ', present: 'حاضر', absent: 'غائب', late: 'متأخر', excused: 'بعذر',
    todayWork: 'عمل اليوم', homeworkPending: 'واجبات بانتظار التصحيح', myGroups: 'مجموعاتي',
    children: 'الأبناء', schedule: 'الجدول', grades: 'الدرجات', notes: 'ملاحظات المعلم',
    homework: 'الواجبات', quizzes: 'الاختبارات', materials: 'المواد التعليمية', announcements: 'الإعلانات',
    name: 'الاسم', code: 'الكود', grade: 'الصف', branch: 'الفرع', status: 'الحالة', amount: 'المبلغ',
    method: 'طريقة الدفع', date: 'التاريخ', parent: 'ولي الأمر', mobile: 'الموبايل', subject: 'المادة',
    teacher: 'المعلم', capacity: 'السعة', enrolled: 'المسجلون', available: 'المتاح',
    followup: 'متابعة الأهالي', riskEngine: 'محرك المخاطر', subjectPerformance: 'أداء المواد',
    weakTopics: 'الموضوعات الضعيفة', capacityInsights: 'إشغال المجموعات', fullGroups: 'مجموعات ممتلئة',
    noData: 'لا توجد بيانات بعد', takeAttendance: 'تسجيل الحضور', submit: 'إرسال', start: 'بدء',
    view: 'عرض', export: 'تصدير CSV', search: 'بحث...', total: 'الإجمالي', paid: 'مدفوع',
    due: 'مستحق', partial: 'جزئي', active: 'نشط', avgScore: 'متوسط الدرجات', utilization: 'نسبة الإشغال',
  },
  en: {
    login: 'Sign in', identifier: 'Username, email or mobile', password: 'Password',
    demoAccounts: 'Demo accounts (password 123456)', dashboard: 'Dashboard', students: 'Students',
    attendance: 'Attendance', groups: 'Groups', finance: 'Finance', fees: 'Fees', payments: 'Payments',
    leads: 'Leads', teachers: 'Teachers', reports: 'Reports', insights: 'Smart Insights',
    logout: 'Sign out', activeStudents: 'Active students', newStudents: 'New students (30d)',
    expected: 'Expected', collected: 'Collected', outstanding: 'Outstanding', overdue: 'Overdue',
    collectionPct: 'Collection %', todayClasses: "Today's classes", riskStudents: 'At-risk students',
    attendancePct30: 'Attendance % (30d)', leadsReg: 'Lead registrations',
    markAll: 'Mark all present', save: 'Save', present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused',
    todayWork: "Today's work", homeworkPending: 'Homework pending review', myGroups: 'My groups',
    children: 'Children', schedule: 'Schedule', grades: 'Grades', notes: 'Teacher notes',
    homework: 'Homework', quizzes: 'Quizzes', materials: 'Materials', announcements: 'Announcements',
    name: 'Name', code: 'Code', grade: 'Grade', branch: 'Branch', status: 'Status', amount: 'Amount',
    method: 'Method', date: 'Date', parent: 'Parent', mobile: 'Mobile', subject: 'Subject',
    teacher: 'Teacher', capacity: 'Capacity', enrolled: 'Enrolled', available: 'Available',
    followup: 'Parent follow-up', riskEngine: 'Risk engine', subjectPerformance: 'Subject performance',
    weakTopics: 'Weak topics', capacityInsights: 'Group utilization', fullGroups: 'Full groups',
    noData: 'No data yet', takeAttendance: 'Take attendance', submit: 'Submit', start: 'Start',
    view: 'View', export: 'Export CSV', search: 'Search...', total: 'Total', paid: 'Paid',
    due: 'Due', partial: 'Partial', active: 'Active', avgScore: 'Avg score', utilization: 'Utilization',
  },
};
const t = (k) => (STR[state.lang] || STR.ar)[k] || k;
const DAY_NAMES = { ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };

// ---------- API helper ----------
async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { logout(); throw new Error('unauthorized'); }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(json?.error || res.statusText), { data: json });
  return json;
}
const get = (p) => api('GET', p);
const post = (p, b) => api('POST', p, b);
const patch = (p, b) => api('PATCH', p, b);

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const egp = (n) => `EGP ${Number(n || 0).toLocaleString()}`;
const badge = (status) => {
  const map = { present: 'green', paid: 'green', active: 'green', absent: 'red', overdue: 'red', late: 'amber', partial: 'amber', due: 'amber', submitted: 'blue', reviewed: 'blue' };
  return `<span class="badge ${map[status] || 'gray'}">${esc(status || '-')}</span>`;
};

// ---------- auth ----------
function logout() {
  localStorage.removeItem('token'); localStorage.removeItem('user');
  state.token = null; state.user = null;
  render();
}
async function doLogin(e) {
  e.preventDefault();
  try {
    const r = await post('/api/auth/login', {
      identifier: $('#identifier').value.trim(), password: $('#password').value,
    });
    state.token = r.token; state.user = r.user;
    localStorage.setItem('token', r.token); localStorage.setItem('user', JSON.stringify(r.user));
    location.hash = 'home'; render();
  } catch (err) { toast(err.message); }
}

// ---------- shell & nav ----------
const STAFF = ['owner', 'admin', 'branch_manager', 'reception', 'finance'];
function navItems() {
  const role = state.user.role;
  if (role === 'super_admin') return [['tenants', '🏢', t('dashboard')]];
  if (STAFF.includes(role)) return [
    ['home', '📊', t('dashboard')], ['students', '👨‍🎓', t('students')], ['attendance', '✅', t('attendance')],
    ['groups', '👥', t('groups')], ['teachers', '👩‍🏫', t('teachers')], ['finance', '💰', t('finance')],
    ['leads', '📈', t('leads')], ['insights', '🧠', t('insights')], ['reports', '📄', t('reports')],
  ];
  if (role === 'teacher') return [
    ['home', '🏠', t('todayWork')], ['attendance', '✅', t('attendance')], ['groups', '👥', t('myGroups')],
    ['homework', '📝', t('homework')], ['quizzes', '🧪', t('quizzes')],
  ];
  if (role === 'parent') return [
    ['home', '👨‍👩‍👧', t('children')], ['announcements', '📣', t('announcements')],
  ];
  if (role === 'student') return [
    ['home', '🏠', t('dashboard')], ['homework', '📝', t('homework')], ['quizzes', '🧪', t('quizzes')],
    ['schedule', '🗓', t('schedule')], ['grades', '🎓', t('grades')],
  ];
  return [];
}

function render() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  const root = $('#root');
  if (!state.token) {
    root.innerHTML = `
    <div class="login-wrap">
      <button class="lang-switch" onclick="toggleLang()">${state.lang === 'ar' ? 'English' : 'العربية'}</button>
      <div class="login-card">
        <h1>EduCenter OS</h1>
        <p>${state.lang === 'ar' ? 'منصة إدارة مراكز التعليم الخاصة' : 'Private education center operating system'}</p>
        <form onsubmit="doLogin(event)">
          <label>${t('identifier')}</label><input id="identifier" autocomplete="username" required>
          <label>${t('password')}</label><input id="password" type="password" autocomplete="current-password" required>
          <button class="btn full" type="submit">${t('login')}</button>
        </form>
        <div class="demo-hint">💡 ${t('demoAccounts')}<br>
          elite-owner · elite-finance · elite-ahmed.samir<br>par_elite_1 · stu_elite_1 · fl-owner</div>
      </div>
    </div>`;
    return;
  }
  const nav = navItems().map(([r, icon, label]) =>
    `<a class="nav-item ${state.route === r ? 'active' : ''}" href="#${r}"><span class="icon">${icon}</span><span>${label}</span></a>`).join('');
  root.innerHTML = `
    <div class="app">
      <div class="topbar">
        <div class="t-logo">EduCenter OS</div>
        <button onclick="toggleLang()">${state.lang === 'ar' ? 'EN' : 'ع'}</button>
      </div>
      <div class="sidebar">
        <div class="logo">🎓 EduCenter OS<small>${esc(state.user.full_name)} · ${state.user.role}</small></div>
        ${nav}
        <div class="spacer"></div>
        <div class="whoami">
          ${esc(state.user.full_name)}<br>${state.user.role}
          <button class="out" onclick="logout()">${t('logout')}</button>
        </div>
      </div>
      <div class="main" id="view"></div>
    </div>`;
  routeView();
}
function toggleLang() {
  state.lang = state.lang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('lang', state.lang);
  render();
}
window.addEventListener('hashchange', () => { state.route = location.hash.slice(1) || 'home'; render(); });

async function routeView() {
  const view = $('#view');
  if (!view) return;
  try {
    const role = state.user.role;
    if (state.route === 'home') {
      if (role === 'teacher') return pageTeacherHome(view);
      if (role === 'parent') return pageParentHome(view);
      if (role === 'student') return pageStudentHome(view);
      if (role === 'super_admin') return view.innerHTML = '<h2 class="page-title">Platform tenants</h2><div class="cards" id="cards"></div>';
      return pageOwnerHome(view);
    }
    const pages = {
      students: pageStudents, attendance: pageAttendance, groups: pageGroups, teachers: pageTeachers,
      finance: pageFinance, leads: pageLeads, insights: pageInsights, reports: pageReports,
      homework: pageHomework, quizzes: pageQuizzes, grades: pageStudentGrades, schedule: pageStudentSchedule,
      announcements: pageAnnouncements, tenants: pageTenants,
    };
    if (pages[state.route]) return pages[state.route](view);
    view.innerHTML = `<div class="empty">${t('noData')}</div>`;
  } catch (e) {
    view.innerHTML = `<div class="empty">⚠️ ${esc(e.message)}</div>`;
  }
}

// ---------- pages: management ----------
async function pageOwnerHome(view) {
  const d = await get('/api/dashboard/owner');
  view.innerHTML = `
    <h2 class="page-title">📊 ${t('dashboard')}</h2>
    <div class="cards">
      <div class="card kpi"><span class="v">${d.students.active_students}</span><span class="l">${t('activeStudents')}</span></div>
      <div class="card kpi"><span class="v">${d.students.new_students}</span><span class="l">${t('newStudents')}</span></div>
      <div class="card kpi"><span class="v">${d.attendance_pct_30d ?? '-'}%</span><span class="l">${t('attendancePct30')}</span></div>
      <div class="card kpi ${d.attendance_risk_students > 0 ? 'warn' : ''}"><span class="v">${d.attendance_risk_students}</span><span class="l">${t('riskStudents')}</span></div>
      <div class="card kpi"><span class="v">${d.today_classes}</span><span class="l">${t('todayClasses')}</span></div>
      <div class="card kpi"><span class="v">${egp(d.finance.expected)}</span><span class="l">${t('expected')}</span></div>
      <div class="card kpi ok"><span class="v">${egp(d.finance.collected)}</span><span class="l">${t('collected')}</span></div>
      <div class="card kpi warn"><span class="v">${egp(d.finance.outstanding)}</span><span class="l">${t('outstanding')}</span></div>
      <div class="card kpi warn"><span class="v">${egp(d.finance.overdue)}</span><span class="l">${t('overdue')}</span></div>
      <div class="card kpi"><span class="v">${d.finance.collection_pct}%</span><span class="l">${t('collectionPct')}</span></div>
      <div class="card kpi"><span class="v">${d.commercial.registrations}/${d.commercial.leads}</span><span class="l">${t('leadsReg')}</span></div>
    </div>`;
}

async function pageStudents(view) {
  view.innerHTML = `<h2 class="page-title">👨‍🎓 ${t('students')}</h2>
    <div class="toolbar"><input id="sq" placeholder="${t('search')}" class="grow" oninput="debouncedStudents()"></div>
    <div id="slist"></div>`;
  loadStudents();
}
let debounceTimer;
window.debouncedStudents = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(loadStudents, 350); };
async function loadStudents() {
  const q = $('#sq')?.value || '';
  const rows = await get(`/api/students?q=${encodeURIComponent(q)}&limit=100`);
  $('#slist').innerHTML = rows.length ? `<div class="table-wrap"><table>
    <tr><th>${t('code')}</th><th>${t('name')}</th><th>${t('grade')}</th><th>${t('branch')}</th><th>${t('status')}</th></tr>
    ${rows.map((s) => `<tr><td>${esc(s.student_code)}</td><td>${esc(s.name)}</td><td>${esc(s.grade_name || '-')}</td><td>${esc(s.branch_name || '-')}</td><td>${badge(s.status)}</td></tr>`).join('')}
  </table></div>` : `<div class="empty">${t('noData')}</div>`;
}

async function pageAttendance(view) {
  const isTeacher = state.user.role === 'teacher';
  const url = isTeacher ? '/api/attendance/today' : '/api/attendance/today';
  const classes = await get(url);
  view.innerHTML = `<h2 class="page-title">✅ ${t('attendance')}</h2>` + (classes.length
    ? classes.map((c) => `<div class="list-item">
        <div><b>${esc(c.name)}</b><br><small style="color:var(--muted)">${esc(c.subject_name)} · ${esc(c.branch_name || '')} · ${esc(c.start_time || '')}</small></div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="badge ${Number(c.attendance_taken) > 0 ? 'green' : 'amber'}">${Number(c.attendance_taken) > 0 ? '✓ ' + t('attendance') : '—'}</span>
          <button class="btn sm accent" onclick="openRoster(${c.id}, '${esc(c.name)}')">${t('takeAttendance')}</button>
        </div></div>`).join('')
    : `<div class="empty">${t('noData')}</div><div id="roster"></div>`) + `<div id="roster"></div>`;
}
window.openRoster = async (groupId, name) => {
  const date = new Date().toISOString().slice(0, 10);
  const roster = await get(`/api/attendance/group/${groupId}/${date}`);
  const marks = {};
  roster.forEach((r) => { if (r.attendance_status) marks[r.id] = r.attendance_status; });
  window._marks = marks; window._roster = roster; window._attGroup = groupId; window._attDate = date;
  $('#roster').innerHTML = `
    <h3 class="section-title">${t('takeAttendance')} — ${esc(name)}</h3>
    <div class="toolbar"><button class="btn sm ghost" onclick="markAllPresent()">${t('markAll')}</button>
    <button class="btn sm" onclick="saveAttendance()">${t('save')}</button></div>
    <div class="table-wrap"><table><tr><th>${t('name')}</th><th>${t('code')}</th><th></th></tr>
    ${roster.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.student_code)}</td>
      <td><div class="att-btns" data-sid="${r.id}">
        ${['present', 'absent', 'late', 'excused'].map((s) =>
          `<button class="att-btn ${marks[r.id] === s ? 'sel-' + s : ''}" data-s="${s}" onclick="setMark(${r.id},'${s}',this)">${{ present: '✓', absent: '✗', late: '⏰', excused: '📝' }[s]}</button>`).join('')}
      </div></td></tr>`).join('')}
    </table></div>`;
  $('#roster').scrollIntoView({ behavior: 'smooth' });
};
window.setMark = (sid, s, btn) => {
  window._marks[sid] = s;
  btn.parentElement.querySelectorAll('.att-btn').forEach((b) => b.className = 'att-btn');
  btn.className = `att-btn sel-${s}`;
};
window.markAllPresent = () => {
  document.querySelectorAll('#roster .att-btns').forEach((row) => {
    const sid = Number(row.dataset.sid);
    window._marks[sid] = 'present';
    row.querySelectorAll('.att-btn').forEach((b) => { b.className = 'att-btn' + (b.dataset.s === 'present' ? ' sel-present' : ''); });
  });
};
window.saveAttendance = async () => {
  const records = Object.entries(window._marks).map(([sid, status]) => ({ student_id: Number(sid), status }));
  if (!records.length) return toast('—');
  const r = await post('/api/attendance/mark', { group_id: window._attGroup, session_date: window._attDate, records });
  toast(`✓ ${r.marked}`); routeView();
};

async function pageGroups(view) {
  const groups = await get('/api/groups');
  view.innerHTML = `<h2 class="page-title">👥 ${t('groups')}</h2>` + (groups.length
    ? `<div class="table-wrap"><table>
      <tr><th>${t('name')}</th><th>${t('subject')}</th><th>${t('teacher')}</th><th>${t('branch')}</th>
      <th>${t('enrolled')}/${t('capacity')}</th><th>${t('available')}</th><th>${t('status')}</th></tr>
      ${groups.map((g) => {
        const avail = Math.max(0, g.max_capacity - Number(g.enrolled));
        return `<tr><td>${esc(g.name)}</td><td>${esc(g.subject_name)}</td><td>${esc(g.teacher_name || '-')}</td>
        <td>${esc(g.branch_name)}</td><td>${g.enrolled}/${g.max_capacity}</td>
        <td>${avail === 0 ? '<span class="badge red">0</span>' : `<span class="badge green">${avail}</span>`}</td>
        <td>${badge(g.status)}</td></tr>`;
      }).join('')}</table></div>`
    : `<div class="empty">${t('noData')}</div>`);
}

async function pageTeachers(view) {
  const rows = await get('/api/teachers');
  view.innerHTML = `<h2 class="page-title">👩‍🏫 ${t('teachers')}</h2>
    <div class="table-wrap"><table><tr><th>${t('name')}</th><th>${t('mobile')}</th><th>${t('subject')}</th>
    <th>${t('groups')}</th><th>${t('students')}</th><th>${t('status')}</th></tr>
    ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.mobile || '-')}</td>
      <td>${(r.subject_names || []).map(esc).join(', ') || '-'}</td><td>${r.group_count}</td><td>${r.student_count}</td><td>${badge(r.status)}</td></tr>`).join('')}
    </table></div>`;
}

async function pageFinance(view) {
  const [summary, dims, outstanding] = await Promise.all([
    get('/api/fees/summary'), get('/api/fees/by-dimension'), get('/api/fees?status=overdue&limit=50'),
  ]);
  view.innerHTML = `<h2 class="page-title">💰 ${t('finance')}</h2>
    <div class="cards">
      <div class="card kpi"><span class="v">${egp(summary.expected)}</span><span class="l">${t('expected')}</span></div>
      <div class="card kpi ok"><span class="v">${egp(summary.collected)}</span><span class="l">${t('collected')}</span></div>
      <div class="card kpi warn"><span class="v">${egp(summary.outstanding)}</span><span class="l">${t('outstanding')}</span></div>
      <div class="card kpi warn"><span class="v">${egp(summary.overdue)}</span><span class="l">${t('overdue')}</span></div>
      <div class="card kpi"><span class="v">${summary.collection_pct}%</span><span class="l">${t('collectionPct')}</span></div>
    </div>
    <h3 class="section-title">${t('overdue')}</h3>
    <div class="table-wrap"><table><tr><th>${t('name')}</th><th>${t('code')}</th><th>${t('amount')}</th><th>${t('date')}</th></tr>
    ${outstanding.slice(0, 25).map((f) => `<tr><td>${esc(f.student_name)}</td><td>${esc(f.student_code)}</td>
      <td style="color:var(--red);font-weight:700">${egp(f.outstanding)}</td><td>${esc(f.due_date || '-')}</td></tr>`).join('')}
    </table></div>
    <h3 class="section-title">${t('method')}</h3>
    <div class="table-wrap"><table><tr><th>${t('method')}</th><th>${t('total')}</th></tr>
    ${dims.by_method.map((m) => `<tr><td>${esc(m.method)}</td><td>${egp(m.total)}</td></tr>`).join('')}
    </table></div>`;
}

async function pageLeads(view) {
  const [stats, leads] = await Promise.all([get('/api/leads/stats'), get('/api/leads')]);
  const conv = stats.totals.total_leads ? Math.round(stats.totals.total_registrations / stats.totals.total_leads * 100) : 0;
  view.innerHTML = `<h2 class="page-title">📈 ${t('leads')}</h2>
    <div class="cards">
      <div class="card kpi"><span class="v">${stats.totals.total_leads}</span><span class="l">${t('leads')}</span></div>
      <div class="card kpi ok"><span class="v">${stats.totals.total_registrations}</span><span class="l">${t('leadsReg')}</span></div>
      <div class="card kpi"><span class="v">${conv}%</span><span class="l">conversion</span></div>
    </div>
    <h3 class="section-title">${t('name')} / ${t('status')}</h3>
    <div class="table-wrap" style="max-height:420px;overflow:auto"><table>
    <tr><th>${t('name')}</th><th>${t('mobile')}</th><th>source</th><th>stage</th></tr>
    ${leads.slice(0, 60).map((l) => `<tr><td>${esc(l.name)}</td><td>${esc(l.mobile)}</td>
      <td><span class="badge blue">${esc(l.source)}</span></td><td>${badge(l.stage)}</td></tr>`).join('')}
    </table></div>`;
}

async function pageInsights(view) {
  const [risk, followup, capacity, perf] = await Promise.all([
    get('/api/insights/risk'), get('/api/insights/followup-list'),
    get('/api/insights/capacity'), get('/api/insights/subject-performance'),
  ]);
  view.innerHTML = `<h2 class="page-title">🧠 ${t('insights')}</h2>
    <h3 class="section-title">⚠️ ${t('riskEngine')}</h3>
    ${risk.length ? `<div class="table-wrap"><table><tr><th>${t('name')}</th><th>severity</th><th>signals</th><th>action</th></tr>
      ${risk.slice(0, 20).map((r) => `<tr><td>${esc(r.name)}</td>
        <td>${badge(r.severity === 'high' ? 'overdue' : r.severity === 'medium' ? 'late' : 'due')}</td>
        <td>${r.signals.map((s) => `<span class="badge gray" style="margin:1px">${esc(s.detail)}</span>`).join(' ')}</td>
        <td>${esc(r.recommended_action)}</td></tr>`).join('')}</table></div>` : `<div class="empty">${t('noData')}</div>`}
    <h3 class="section-title">📞 ${t('followup')}</h3>
    ${followup.length ? followup.slice(0, 15).map((f) =>
      `<div class="list-item"><div><b>${esc(f.name)}</b></div><div>${badge(f.reason.includes('EGP') ? 'overdue' : 'late')} ${esc(f.reason)}</div></div>`).join('')
      : `<div class="empty">${t('noData')}</div>`}
    <h3 class="section-title">📊 ${t('subjectPerformance')}</h3>
    <div class="cards">${perf.by_subject.map((s) =>
      `<div class="card kpi ${Number(s.avg_pct) < 65 ? 'warn' : 'ok'}"><span class="v">${s.avg_pct}%</span><span class="l">${esc(s.name)} (${s.attempts})</span></div>`).join('')}</div>
    <h3 class="section-title">📉 ${t('weakTopics')}</h3>
    <div class="cards">${perf.weak_topics.map((s) =>
      `<div class="card kpi ${Number(s.pct) < 60 ? 'warn' : ''}"><span class="v">${s.pct}%</span><span class="l">${esc(s.topic || s.chapter)} (${s.n})</span></div>`).join('')}</div>
    <h3 class="section-title">👥 ${t('capacityInsights')} — ${t('fullGroups')}: ${capacity.full_groups}</h3>
    <div class="table-wrap"><table><tr><th>${t('groups')}</th><th>${t('utilization')}</th></tr>
      ${capacity.groups.map((g) => `<tr><td>${esc(g.name)}</td>
        <td style="min-width:160px"><div style="display:flex;gap:8px;align-items:center">
          <div class="progress-bar" style="flex:1"><div style="width:${Math.min(100, g.utilization_pct)}%;background:${g.utilization_pct >= 100 ? 'var(--red)' : g.utilization_pct >= 70 ? 'var(--green)' : 'var(--amber)'}"></div></div>
          <small>${g.utilization_pct}%</small></div></td></tr>`).join('')}
    </table></div>`;
}

async function pageReports(view) {
  const reports = await get('/api/reports');
  view.innerHTML = `<h2 class="page-title">📄 ${t('reports')}</h2>
    <div class="cards">${reports.map((r) => `
      <div class="card" style="display:flex;flex-direction:column;gap:10px">
        <b>${esc(r.label)}</b>
        <button class="btn sm" onclick="runReport('${r.key}')">${t('view')}</button>
        <a class="btn sm ghost" href="/api/reports/${r.key}?format=csv" download>${t('export')}</a>
      </div>`).join('')}</div>
    <div id="report-out" style="margin-top:18px"></div>`;
}
window.runReport = async (key) => {
  const rows = await get(`/api/reports/${key}`);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  $('#report-out').innerHTML = rows.length ? `<div class="table-wrap" style="max-height:500px;overflow:auto"><table>
    <tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>
    ${rows.slice(0, 200).map((r) => `<tr>${headers.map((h) => `<td>${esc(r[h])}</td>`).join('')}</tr>`).join('')}
  </table></div>` : `<div class="empty">${t('noData')}</div>`;
};

async function pageTenants(view) {
  const rows = await get('/api/super/tenants');
  view.innerHTML = `<h2 class="page-title">🏢 Platform</h2>
    <div class="table-wrap"><table><tr><th>${t('name')}</th><th>plan</th><th>${t('status')}</th>
    <th>branches</th><th>${t('students')}</th><th>${t('teachers')}</th></tr>
    ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.plan)}</td><td>${badge(r.status)}</td>
      <td>${r.branch_count}</td><td>${r.student_count}</td><td>${r.teacher_count}</td></tr>`).join('')}
    </table></div>`;
}

// ---------- pages: teacher ----------
async function pageTeacherHome(view) {
  const d = await get('/api/dashboard/teacher');
  view.innerHTML = `<h2 class="page-title">🏠 ${t('todayWork')}</h2>
    <div class="cards">
      <div class="card kpi"><span class="v">${d.today_classes.length}</span><span class="l">${t('todayClasses')}</span></div>
      <div class="card kpi warn"><span class="v">${d.homework_pending_review}</span><span class="l">${t('homeworkPending')}</span></div>
    </div>
    <h3 class="section-title">✅ ${t('todayClasses')}</h3>
    ${d.today_classes.map((c) => `<div class="list-item">
      <div><b>${esc(c.name)}</b><br><small style="color:var(--muted)">${esc(c.start_time)}–${esc(c.end_time)} · ${esc(c.branch_name || '')} · ${c.student_count} 👤</small></div>
      <button class="btn sm accent" onclick="openRoster(${c.id},'${esc(c.name)}')">${t('takeAttendance')}</button>
    </div>`).join('') || `<div class="empty">${t('noData')}</div>`}
    <h3 class="section-title">👥 ${t('myGroups')}</h3>
    ${d.groups.map((g) => `<div class="list-item"><div><b>${esc(g.name)}</b> · ${g.students} 👤</div>
      <div>${g.avg_score != null ? `${t('avgScore')}: <b>${g.avg_score}%</b>` : ''}</div></div>`).join('')}
    <div id="roster"></div>`;
}

async function pageHomework(view) {
  const isStudent = state.user.role === 'student';
  if (isStudent) {
    const rows = await get('/api/portal/student/homework');
    view.innerHTML = `<h2 class="page-title">📝 ${t('homework')}</h2>` + (rows.length
      ? rows.map((h) => `<div class="list-item">
          <div><b>${esc(h.title)}</b><br><small style="color:var(--muted)">${esc(h.subject)} · ${t('date')}: ${esc(h.due_date)}</small></div>
          <div style="display:flex;gap:8px;align-items:center">${badge(h.status)}
          ${['assigned', 'viewed'].includes(h.status) ? `<button class="btn sm" onclick="submitHw(${h.id})">✓ ${t('submit')}</button>` : ''}
          ${h.score != null ? `<b>${h.score}/10</b>` : ''}</div></div>`).join('')
      : `<div class="empty">${t('noData')}</div>`);
    return;
  }
  // teacher: pick a group
  const groups = await get('/api/groups');
  if (!groups.length) return view.innerHTML = `<div class="empty">${t('noData')}</div>`;
  window._hwGroup = window._hwGroup || groups[0].id;
  view.innerHTML = `<h2 class="page-title">📝 ${t('homework')}</h2>
    <div class="toolbar"><select onchange="window._hwGroup=this.value;routeView()">
      ${groups.map((g) => `<option value="${g.id}" ${g.id === window._hwGroup ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
    </select></div><div id="hwlist"></div>`;
  const hw = await get(`/api/homework?group_id=${window._hwGroup}`);
  $('#hwlist').innerHTML = hw.length ? `<div class="table-wrap"><table>
    <tr><th>${t('name')}</th><th>${t('date')}</th><th>submitted</th><th>reviewed</th></tr>
    ${hw.map((h) => `<tr><td>${esc(h.title)}</td><td>${esc(h.due_date)}</td>
      <td>${h.submitted_count}</td><td>${h.reviewed_count}</td></tr>`).join('')}</table></div>`
    : `<div class="empty">${t('noData')}</div>`;
}
window.submitHw = async (id) => { await patch(`/api/portal/student/homework/${id}/submit`, {}); toast('✓'); routeView(); };

async function pageQuizzes(view) {
  const isStudent = state.user.role === 'student';
  if (isStudent) {
    const d = await get('/api/dashboard/student');
    view.innerHTML = `<h2 class="page-title">🧪 ${t('quizzes')}</h2>` + (d.available_quizzes.length
      ? d.available_quizzes.map((q) => `<div class="list-item"><div><b>${esc(q.title)}</b><br>
        <small style="color:var(--muted)">${esc(q.type)} · ⏰ ${esc((q.deadline || '').slice(0, 16).replace('T', ' '))}</small></div>
        <button class="btn sm accent" onclick="startQuiz(${q.id})">${t('start')}</button></div>`).join('')
      : `<div class="empty">${t('noData')}</div><div id="quiz-area"></div>`) + `<div id="quiz-area"></div>`;
    return;
  }
  const groups = await get('/api/groups');
  if (!groups.length) return view.innerHTML = `<div class="empty">${t('noData')}</div>`;
  window._qzGroup = window._qzGroup || groups[0].id;
  view.innerHTML = `<h2 class="page-title">🧪 ${t('quizzes')}</h2>
    <div class="toolbar"><select onchange="window._qzGroup=this.value;routeView()">
      ${groups.map((g) => `<option value="${g.id}" ${g.id === window._qzGroup ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
    </select></div><div id="qzlist"></div>`;
  const rows = await get(`/api/quizzes?group_id=${window._qzGroup}`);
  $('#qzlist').innerHTML = rows.length ? `<div class="table-wrap"><table>
    <tr><th>${t('name')}</th><th>type</th><th>questions</th><th>attempts</th><th>${t('avgScore')}</th><th>${t('status')}</th></tr>
    ${rows.map((q) => `<tr><td>${esc(q.title)}</td><td>${esc(q.type)}</td><td>${q.question_count}</td>
      <td>${q.attempt_count}</td><td>${q.avg_percent ?? '-'}%</td><td>${badge(q.status)}</td></tr>`).join('')}
    </table></div>` : `<div class="empty">${t('noData')}</div>`;
}
window.startQuiz = async (quizId) => {
  const attempt = await post(`/api/quizzes/${quizId}/attempts`, {});
  const questions = await get(`/api/quizzes/${quizId}/questions`);
  window._answers = {};
  $('#quiz-area').innerHTML = `<h3 class="section-title">🧪 ${questions.length} ❓</h3>
    ${questions.map((q, qi) => `<div class="quiz-q"><div class="q-text">${qi + 1}. ${esc(q.text)}</div>
      ${(q.options || []).map((o) => `<label class="opt"><input type="radio" name="q${q.id}" value="${esc(o.key)}"
        onchange="window._answers[${q.id}]='${esc(o.key)}'"> ${esc(o.key)}. ${esc(o.text)}</label>`).join('')}
    </div>`).join('')}
    <button class="btn accent full" onclick="submitQuiz(${attempt.id})">${t('submit')}</button>`;
  $('#quiz-area').scrollIntoView({ behavior: 'smooth' });
};
window.submitQuiz = async (attemptId) => {
  const r = await post(`/api/quizzes/attempts/${attemptId}/submit`, { answers: window._answers });
  $('#quiz-area').innerHTML = r.show_result
    ? `<div class="card" style="text-align:center;padding:40px"><div style="font-size:48px">🎓</div>
       <h2>${r.score} / ${r.total}</h2></div>`
    : `<div class="empty">✓ ${t('submit')}</div>`;
  toast('✓');
};

// ---------- pages: parent ----------
async function pageParentHome(view) {
  const d = await get('/api/dashboard/parent');
  window._kids = d.children || [];
  window._activeKid = window._activeKid ?? (window._kids[0]?.id ?? null);
  view.innerHTML = `<h2 class="page-title">👨‍👩‍👧 ${t('children')}</h2>
    <div>${window._kids.map((c) => `<span class="child-tab ${c.id === window._activeKid ? 'active' : ''}"
      onclick="window._activeKid=${c.id};routeView()">${esc(c.name)}</span>`).join('')}</div>
    <div id="kiddetail"></div>`;
  if (!window._kids.length) return $('#kiddetail').innerHTML = `<div class="empty">${t('noData')}</div>`;
  const c = await get(`/api/portal/parent/children/${window._activeKid}`);
  $('#kiddetail').innerHTML = `
    <div class="cards" style="margin-top:12px">
      <div class="card kpi"><span class="v">${esc(c.profile.grade_name || '-')}</span><span class="l">${t('grade')}</span></div>
      <div class="card kpi ${Number(c.attendance_pct) < 80 ? 'warn' : 'ok'}"><span class="v">${c.attendance_pct ?? '-'}%</span><span class="l">${t('attendance')}</span></div>
      <div class="card kpi ${Number(c.outstanding) > 0 ? 'warn' : 'ok'}"><span class="v">${egp(c.outstanding)}</span><span class="l">${t('outstanding')}</span></div>
    </div>
    <h3 class="section-title">🗓 ${t('todayClasses')}</h3>
    ${c.today_classes?.length ? c.today_classes.map((cl) => `<div class="list-item">
      <div><b>${esc(cl.subject)}</b> · ${esc(cl.group_name)}</div><div>${esc(cl.start_time)}–${esc(cl.end_time)}</div></div>`).join('')
      : `<div class="empty">${t('noData')}</div>`}
    <h3 class="section-title">🎓 ${t('grades')}</h3>
    ${c.grades?.length ? `<div class="table-wrap"><table><tr><th>${t('name')}</th><th>${t('total')}</th><th>%</th></tr>
      ${c.grades.map((g) => `<tr><td>${esc(g.title)}</td><td>${g.score}/${g.total_score}</td>
        <td><b>${Math.round(g.score / g.total_score * 100)}%</b></td></tr>`).join('')}</table></div>`
      : `<div class="empty">${t('noData')}</div>`}
    <h3 class="section-title">💬 ${t('notes')}</h3>
    ${c.assessments?.length ? c.assessments.map((a) => `<div class="card" style="margin-bottom:10px">
      <b>${esc(a.period)}</b> · ${esc(a.academic_level || '')}<br>
      <small>💪 ${esc(a.strengths || '-')} · 📉 ${esc(a.weaknesses || '-')}</small>
      ${a.parent_followup ? '<br><span class="badge amber">📞 ' + (state.lang === 'ar' ? 'متابعة مطلوبة' : 'follow-up required') + '</span>' : ''}</div>`).join('')
      : `<div class="empty">${t('noData')}</div>`}
    <h3 class="section-title">💰 ${t('fees')}</h3>
    ${c.fees?.length ? `<div class="table-wrap"><table><tr><th>${t('name')}</th><th>${t('total')}</th><th>${t('paid')}</th><th>${t('outstanding')}</th><th>${t('status')}</th></tr>
      ${c.fees.map((f) => `<tr><td>${esc(f.description || f.fee_type)}</td><td>${egp(f.total_after_discount)}</td>
        <td>${egp(f.paid)}</td><td style="font-weight:700;color:${f.outstanding > 0 ? 'var(--red)' : 'var(--green)'}">${egp(f.outstanding)}</td>
        <td>${badge(f.status)}</td></tr>`).join('')}</table></div>` : `<div class="empty">${t('noData')}</div>`}`;
}

// ---------- pages: student ----------
async function pageStudentHome(view) {
  const d = await get('/api/dashboard/student');
  view.innerHTML = `<h2 class="page-title">🏠 ${t('dashboard')}</h2>
    <div class="cards">
      <div class="card kpi"><span class="v">${d.today_classes.length}</span><span class="l">${t('todayClasses')}</span></div>
      <div class="card kpi warn"><span class="v">${d.homework_due.length}</span><span class="l">${t('homework')}</span></div>
      <div class="card kpi ok"><span class="v">${d.available_quizzes.length}</span><span class="l">${t('quizzes')}</span></div>
    </div>
    <h3 class="section-title">🗓 ${t('todayClasses')}</h3>
    ${d.today_classes.map((c) => `<div class="list-item"><div><b>${esc(c.subject)}</b> · ${esc(c.teacher || '')}</div>
      <div>${esc(c.start_time)}–${esc(c.end_time)}</div></div>`).join('') || `<div class="empty">${t('noData')}</div>`}
    <h3 class="section-title">🎓 ${t('grades')}</h3>
    ${d.recent_grades.map((g) => `<div class="list-item"><div><b>${esc(g.title)}</b></div>
      <div><b>${g.score}/${g.total_score}</b> · ${Math.round(g.score / g.total_score * 100)}%</div></div>`).join('') || `<div class="empty">${t('noData')}</div>`}`;
}
async function pageStudentGrades(view) {
  const rows = await get('/api/portal/student/grades');
  view.innerHTML = `<h2 class="page-title">🎓 ${t('grades')}</h2>` + (rows.length
    ? `<div class="table-wrap"><table><tr><th>${t('name')}</th><th>${t('total')}</th><th>%</th><th>${t('date')}</th></tr>
      ${rows.map((g) => `<tr><td>${esc(g.title)}</td><td>${g.score}/${g.total_score}</td>
        <td><b>${Math.round(g.score / g.total_score * 100)}%</b></td><td>${esc((g.submitted_at || '').slice(0, 10))}</td></tr>`).join('')}</table></div>`
    : `<div class="empty">${t('noData')}</div>`);
}
async function pageStudentSchedule(view) {
  const me = await get('/api/portal/student/me');
  view.innerHTML = `<h2 class="page-title">🗓 ${t('schedule')}</h2>` + (me.enrollments?.length
    ? me.enrollments.map((e) => `<div class="list-item"><div><b>${esc(e.subject)}</b> · ${esc(e.group_name)}<br>
      <small style="color:var(--muted)">${esc(e.teacher || '')}</small></div></div>`).join('')
    : `<div class="empty">${t('noData')}</div>`);
}

async function pageAnnouncements(view) {
  const rows = await get('/api/announcements');
  view.innerHTML = `<h2 class="page-title">📣 ${t('announcements')}</h2>` + (rows.length
    ? rows.map((a) => `<div class="card" style="margin-bottom:10px"><b>${esc(a.title)}</b>
      <p style="margin-top:6px;font-size:14px;color:var(--muted)">${esc(a.body)}</p>
      <small style="color:var(--muted)">${esc((a.created_at || '').slice(0, 10))}</small></div>`).join('')
    : `<div class="empty">${t('noData')}</div>`);
}

render();
