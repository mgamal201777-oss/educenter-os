/* EduCenter OS — PWA front-end (vanilla JS SPA, ar/en with RTL) */
const API = '';
const $ = (sel) => document.querySelector(sel);
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  lang: localStorage.getItem('lang') || 'en',
  route: location.hash.slice(1) || 'home',
  data: {},
};

// ---------- i18n ----------
const STR = {
  ar: {
    login: 'تسجيل الدخول', identifier: 'اسم المستخدم أو البريد أو الموبايل', password: 'كلمة المرور',
    demoAccounts: 'حسابات تجريبية', dashboard: 'الرئيسية', students: 'الطلاب',
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
    overview: 'نظرة عامة على المنصة', tenantsM: 'المراكز', accounts: 'الحسابات والمستخدمون', billing: 'الفوترة والأسعار',
    logs: 'سجل النشاط', settings: 'الإعدادات', createTenant: 'إنشاء مركز جديد', createAccount: 'إنشاء حساب',
    suspend: 'إيقاف', activate: 'تنشيط', resetPassword: 'كلمة مرور جديدة', planLabel: 'الباقة',
    monthlyFee: 'الرسوم الشهرية', revenue: 'الإيرادات المحصلة', lastLogin: 'آخر دخول', contact: 'جهة الاتصال',
    branchesLabel: 'الفروع', ownerCt: 'مديرو المراكز', centerAccounts: 'حسابات المراكز', suspendedUsers: 'حسابات موقوفة',
    newStudents30: 'طلاب جدد (30 يوم)', platformRevenue: 'إيرادات المنصة (المحصلة)', mrr: 'الاشتراكات الشهرية (الباقات)',
    changeOwnPassword: 'تغيير كلمة المرور الخاصة بي', currentPassword: 'كلمة المرور الحالية',
    newPassword: 'كلمة المرور الجديدة', demoPass: 'كلمة مرور الحسابات التجريبية', maxStudents: 'حد الطلاب',
    maxBranches: 'حد الفروع', features: 'الميزات', collectedOn: 'محصل عبر المنصة',
    tenantData: 'بيانات المركز', selectTenant: 'اختر المركز', allTenants: 'جميع المراكز',
    role: 'الدور', action: 'الإجراء', entity: 'الكائن', ip: 'عنوان IP', platform: 'المنصة',
    upgradeDowngrade: 'ترقية/تخفيض الباقة', conversion: 'نسبة التحويل', source: 'المصدر', stage: 'المرحلة',
    severity: 'الخطورة', signals: 'المؤشرات', recommendedAction: 'الإجراء المقترح',
    username: 'اسم المستخدم', email: 'البريد الإلكتروني', slug: 'المعرّف (slug)',
    submitted: 'مُسلَّم', reviewed: 'تم التصحيح', type: 'النوع', questions: 'الأسئلة', attempts: 'المحاولات',
    suspended: 'موقوف', inactive: 'غير نشط', graduated: 'متخرج', new: 'جديد', contacted: 'تم التواصل',
    registered: 'مسجّل', converted: 'تم التحويل', lost: 'مفقود', draft: 'مسودة', published: 'منشور',
    closed: 'مغلق', assigned: 'مُكلَّف', viewed: 'تمت المشاهدة', create: 'إنشاء', update: 'تحديث', delete: 'حذف',
    super_admin: 'مدير المنصة', owner: 'مدير المركز', admin: 'مسؤول', branch_manager: 'مدير فرع',
    reception: 'استقبال', student: 'طالب', followupRequired: 'متابعة مطلوبة',
    // platform features
    signupTitle: 'سجّل مركزك', signupSub: 'ابدأ تجربتك المجانية — لا حاجة لبطاقة ائتمان',
    centerName: 'اسم المركز', ownerName: 'اسم المالك', signup: 'إنشاء الحساب',
    haveAccount: 'لديك حساب؟ سجّل الدخول', createAccountCenter: 'تسجيل مركز جديد',
    approvalPending: 'قيد المراجعة', trial: 'تجربة', trialEnds: 'تنتهي التجربة', daysLeft: 'يوم متبقٍ',
    approve: 'اعتماد', extendTrial: 'تمديد التجربة', platformSettings: 'إعدادات المنصة',
    signupModeLabel: 'وضع التسجيل', manualApproval: 'مراجعة يدوية', instantTrial: 'دخول فوري بتجربة',
    trialDaysLabel: 'أيام التجربة', notificationsCfg: 'قنوات الإشعارات', emailCfg: 'البريد الإلكتروني',
    smsCfg: 'الرسائل النصية', whatsappCfg: 'واتساب', remindersCfg: 'التذكيرات التلقائية',
    feeReminderDays: 'تذكير قبل الاستحقاق (أيام)', overdueReminders: 'تذكير المتأخرات',
    absenceAlerts: 'تنبيهات الغياب', paymentsCfg: 'الدفع الإلكتروني', gateway: 'بوابة الدفع',
    msgLog: 'سجل الرسائل', channel: 'القناة', recipient: 'المستلم', timetable: 'الجدول الأسبوعي',
    addSession: 'إضافة حصة', startTime: 'من', endTime: 'إلى', room: 'القاعة',
    conflictDetected: 'تعارض في الجدول', forceSave: 'حفظ رغم التعارض', payOnline: 'دفع إلكتروني',
    payInstructions: 'تعليمات الدفع', txnReference: 'رقم عملية التحويل', confirmPayment: 'تأكيد الدفع',
    onlineRequests: 'طلبات الدفع الإلكتروني', walletNumber: 'رقم المحفظة / إنستاباي',
    enabled: 'مفعّل', disabled: 'متوقف',
    // security & API console
    securityApi: 'الأمان و API', secOverview: 'نظرة عامة', rolesPerms: 'الأدوار والصلاحيات',
    auditTrail: 'سجل التدقيق', apiKeys: 'مفاتيح API', apiDocs: 'دليل API',
    adminAccounts: 'حسابات مديري المنصة', createKey: 'إنشاء مفتاح', keyName: 'اسم المفتاح',
    revoke: 'إلغاء', revoked: 'ملغى', copy: 'نسخ', copied: 'تم النسخ!', lastUsed: 'آخر استخدام',
    neverUsed: 'لم يُستخدم', keyOnceHint: '⚠️ انسخ المفتاح الآن — لن يظهر مرة أخرى',
    scope: 'النطاق', level: 'المستوى', activeAdmins: 'مديرون نشطون', auditEvents30: 'أحداث تدقيق (30 يوم)',
    addPlan: 'إضافة باقة', editPlan: 'تعديل', planCode: 'كود الباقة', nameEn: 'الاسم (EN)',
    nameAr: 'الاسم (AR)', monthlyEgp: 'السعر الشهري (EGP)', featuresHint: 'ميزة واحدة في كل سطر',
    subscribers: 'المشتركون', inUse: 'مستخدمة', inactivePlan: 'غير مفعّلة',
    adminUsername: 'اسم مستخدم المدير', autoGenerated: 'يُنشأ تلقائياً', centerSlug: 'المعرّف (slug)',
    authMethod: 'طريقة المصادقة', filter: 'تصفية', all: 'الكل',
  },
  en: {
    login: 'Sign in', identifier: 'Username, email or mobile', password: 'Password',
    demoAccounts: 'Demo accounts', dashboard: 'Dashboard', students: 'Students',
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
    overview: 'Platform Overview', tenantsM: 'Centers', accounts: 'Accounts & Users', billing: 'Billing & Pricing',
    logs: 'Activity Logs', settings: 'Settings', createTenant: 'Create new center', createAccount: 'Create account',
    suspend: 'Suspend', activate: 'Activate', resetPassword: 'New password', planLabel: 'Plan',
    monthlyFee: 'Monthly fee', revenue: 'Collected revenue', lastLogin: 'Last login', contact: 'Contact',
    branchesLabel: 'Branches', ownerCt: 'Client admins', centerAccounts: 'Center accounts', suspendedUsers: 'Suspended accounts',
    newStudents30: 'New students (30d)', platformRevenue: 'Platform revenue (collected)', mrr: 'Monthly recurring (plans)',
    changeOwnPassword: 'Change my password', currentPassword: 'Current password',
    newPassword: 'New password', demoPass: 'Demo accounts password', maxStudents: 'Max students',
    maxBranches: 'Max branches', features: 'Features', collectedOn: 'Collected via platform',
    tenantData: 'Center data', selectTenant: 'Select center', allTenants: 'All centers',
    role: 'Role', action: 'Action', entity: 'Entity', ip: 'IP', platform: 'Platform',
    upgradeDowngrade: 'Upgrade/Downgrade', conversion: 'Conversion', source: 'Source', stage: 'Stage',
    severity: 'Severity', signals: 'Signals', recommendedAction: 'Recommended action',
    username: 'Username', email: 'Email', slug: 'Slug',
    submitted: 'Submitted', reviewed: 'Reviewed', type: 'Type', questions: 'Questions', attempts: 'Attempts',
    suspended: 'Suspended', inactive: 'Inactive', graduated: 'Graduated', new: 'New', contacted: 'Contacted',
    registered: 'Registered', converted: 'Converted', lost: 'Lost', draft: 'Draft', published: 'Published',
    closed: 'Closed', assigned: 'Assigned', viewed: 'Viewed', create: 'Create', update: 'Update', delete: 'Delete',
    super_admin: 'Super admin', owner: 'Center owner', admin: 'Admin', branch_manager: 'Branch manager',
    reception: 'Reception', student: 'Student', followupRequired: 'follow-up required',
    // platform features
    signupTitle: 'Register your center', signupSub: 'Start your free trial — no credit card needed',
    centerName: 'Center name', ownerName: 'Owner name', signup: 'Create account',
    haveAccount: 'Already have an account? Sign in', createAccountCenter: 'Register a new center',
    approvalPending: 'Pending review', trial: 'Trial', trialEnds: 'Trial ends', daysLeft: 'days left',
    approve: 'Approve', extendTrial: 'Extend trial', platformSettings: 'Platform settings',
    signupModeLabel: 'Signup mode', manualApproval: 'Manual approval', instantTrial: 'Instant access (trial)',
    trialDaysLabel: 'Trial days', notificationsCfg: 'Notification channels', emailCfg: 'Email',
    smsCfg: 'SMS', whatsappCfg: 'WhatsApp', remindersCfg: 'Automated reminders',
    feeReminderDays: 'Remind before due (days)', overdueReminders: 'Overdue reminders',
    absenceAlerts: 'Absence alerts', paymentsCfg: 'Online payments', gateway: 'Payment gateway',
    msgLog: 'Message log', channel: 'Channel', recipient: 'Recipient', timetable: 'Weekly timetable',
    addSession: 'Add session', startTime: 'From', endTime: 'To', room: 'Room',
    conflictDetected: 'Schedule conflict', forceSave: 'Save anyway', payOnline: 'Pay online',
    payInstructions: 'Payment instructions', txnReference: 'Transaction reference', confirmPayment: 'Confirm payment',
    onlineRequests: 'Online payment requests', walletNumber: 'Wallet / InstaPay number',
    enabled: 'Enabled', disabled: 'Off',
    // security & API console
    securityApi: 'Security & API', secOverview: 'Overview', rolesPerms: 'Roles & Permissions',
    auditTrail: 'Audit Trail', apiKeys: 'API Keys', apiDocs: 'API Docs',
    adminAccounts: 'Platform admins', createKey: 'Create key', keyName: 'Key name',
    revoke: 'Revoke', revoked: 'Revoked', copy: 'Copy', copied: 'Copied!', lastUsed: 'Last used',
    neverUsed: 'Never used', keyOnceHint: '⚠️ Copy the key now — it will not be shown again',
    scope: 'Scope', level: 'Level', activeAdmins: 'Active admins', auditEvents30: 'Audit events (30d)',
    addPlan: 'Add plan', editPlan: 'Edit', planCode: 'Plan code', nameEn: 'Name (EN)',
    nameAr: 'Name (AR)', monthlyEgp: 'Monthly fee (EGP)', featuresHint: 'One feature per line',
    subscribers: 'Subscribers', inUse: 'In use', inactivePlan: 'Inactive',
    adminUsername: 'Admin username', autoGenerated: 'Auto-generated', centerSlug: 'Slug',
    authMethod: 'Authentication', filter: 'Filter', all: 'All',
  },
};
const t = (k) => (STR[state.lang] || STR.ar)[k] || k;

// ---------- CSP-safe event delegation (NO inline handlers in templates) ----------
// Production CSP is script-src 'self' (no unsafe-inline/eval), so every
// interactive element uses data-act / data-change / data-input / data-submit
// and this delegation layer dispatches to the ACTIONS registry.
const ACTIONS = {};
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { ev.preventDefault(); fn(el, ev); }
});
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-change]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.change];
  if (fn) fn(el, ev);
});
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-input]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.input];
  if (fn) fn(el, ev);
});
document.addEventListener('submit', (ev) => {
  const el = ev.target.closest('[data-submit]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.submit];
  if (fn) { ev.preventDefault(); fn(el, ev); }
});
const DAY_NAMES = { ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };

// ---------- API helper ----------
async function api(method, path, body) {
  // Super admin operating on tenant-scoped endpoints: inject selected tenant context
  if (method === 'GET' && state.user?.role === 'super_admin' && window._superTenant
    && !path.startsWith('/api/super/') && !path.startsWith('/api/auth') && !path.startsWith('/api/portal')) {
    path += (path.includes('?') ? '&' : '?') + 'tenantId=' + window._superTenant;
  }
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
  const map = { present: 'green', paid: 'green', active: 'green', registered: 'green', published: 'green', absent: 'red', overdue: 'red', suspended: 'red', lost: 'red', late: 'amber', partial: 'amber', due: 'amber', contacted: 'amber', viewed: 'amber', submitted: 'blue', reviewed: 'blue', new: 'blue', converted: 'blue' };
  return `<span class="badge ${map[status] || 'gray'}">${esc(t(status) || '-')}</span>`;
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

ACTIONS.doLogin = (el, ev) => doLogin(ev);

// ---------- shell & nav ----------
const STAFF = ['owner', 'admin', 'branch_manager', 'reception', 'finance'];
function navItems() {
  const role = state.user.role;
  if (role === 'super_admin') return [
    ['home', '📊', t('overview')],
    ['tenants', '🏢', t('tenantsM')],
    ['accounts', '👥', t('accounts')],
    ['billing', '💳', t('billing')],
    ['tstudents', '👨‍🎓', t('students')],
    ['tteachers', '👩‍🏫', t('teachers')],
    ['tfinance', '💰', t('finance')],
    ['tinsights', '🧠', t('insights')],
    ['logs', '📜', t('logs')],
    ['messages', '📨', t('msgLog')],
    ['settings', '⚙️', t('settings')],
  ];
  if (STAFF.includes(role)) return [
    ['home', '📊', t('dashboard')], ['students', '👨‍🎓', t('students')], ['attendance', '✅', t('attendance')],
    ['groups', '👥', t('groups')], ['timetable', '🗓', t('timetable')], ['teachers', '👩‍🏫', t('teachers')], ['finance', '💰', t('finance')],
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
    if (state.route === 'signup') { root.innerHTML = signupPageHtml(); loadSignupForm(); return; }
    root.innerHTML = `
    <div class="login-wrap">
      <button class="lang-switch" data-act="toggleLang">${state.lang === 'ar' ? 'English' : 'العربية'}</button>
      <div class="login-card">
        <h1>EduCenter OS</h1>
        <p>${state.lang === 'ar' ? 'منصة إدارة مراكز التعليم الخاصة' : 'Private education center operating system'}</p>
        <form data-submit="doLogin">
          <label>${t('identifier')}</label><input id="identifier" autocomplete="username" required>
          <label>${t('password')}</label><input id="password" type="password" autocomplete="current-password" required>
          <button class="btn full" type="submit">${t('login')}</button>
        </form>
        <div class="demo-hint">💡 ${t('demoPass')}: Edu@Demo-2026<br>
          elite-reception · elite-finance · elite-ahmed.samir<br>par_elite_1 · stu_elite_1</div>
        <p style="margin-top:14px"><a href="#signup" style="color:var(--accent);font-weight:600">🏢 ${t('createAccountCenter')}</a></p>
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
        <button class="lang-switch-top" data-act="toggleLang">🌐 ${state.lang === 'ar' ? 'EN' : 'ع'}</button>
      </div>
      <div class="sidebar">
        <div class="logo">🎓 EduCenter OS<small>${esc(state.user.full_name)} · ${esc(t(state.user.role))}</small></div>
        ${nav}
        <div class="spacer"></div>
        <div class="whoami">
          ${esc(state.user.full_name)}<br>${esc(t(state.user.role))}
          <button class="out" data-act="toggleLang" title="Language">🌐 ${state.lang === 'ar' ? 'English' : 'العربية'}</button>
          <button class="out" data-act="logout">${t('logout')}</button>
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
ACTIONS.toggleLang = toggleLang;
ACTIONS.logout = logout;
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
      if (role === 'super_admin') return pageSuperHome(view);
      return pageOwnerHome(view);
    }
    const pages = {
      students: pageStudents, attendance: pageAttendance, groups: pageGroups, teachers: pageTeachers,
      finance: pageFinance, leads: pageLeads, insights: pageInsights, reports: pageReports,
      homework: pageHomework, quizzes: pageQuizzes, grades: pageStudentGrades, schedule: pageStudentSchedule,
      announcements: pageAnnouncements, tenants: pageTenants,
      accounts: pageAccounts, billing: pageBilling, logs: pageLogs, settings: pageSettings,
      messages: pageMessages, timetable: pageTimetable,
      tstudents: (v) => pageTenantData(v, pageStudents), tteachers: (v) => pageTenantData(v, pageTeachers),
      tfinance: (v) => pageTenantData(v, pageFinance), tinsights: (v) => pageTenantData(v, pageInsights),
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
    <div class="toolbar"><input id="sq" placeholder="${t('search')}" class="grow" data-input="debouncedStudents"></div>
    <div id="slist"></div>`;
  loadStudents();
}
let debounceTimer;
function debouncedStudents() { clearTimeout(debounceTimer); debounceTimer = setTimeout(loadStudents, 350); }
ACTIONS.debouncedStudents = debouncedStudents;
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
          <button class="btn sm accent" data-act="openRoster" data-gid="${c.id}" data-name="${esc(c.name)}">${t('takeAttendance')}</button>
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
    <div class="toolbar"><button class="btn sm ghost" data-act="markAllPresent">${t('markAll')}</button>
    <button class="btn sm" data-act="saveAttendance">${t('save')}</button></div>
    <div class="table-wrap"><table><tr><th>${t('name')}</th><th>${t('code')}</th><th></th></tr>
    ${roster.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.student_code)}</td>
      <td><div class="att-btns" data-sid="${r.id}">
        ${['present', 'absent', 'late', 'excused'].map((s) =>
          `<button class="att-btn ${marks[r.id] === s ? 'sel-' + s : ''}" data-act="setMark" data-s="${s}">${{ present: '✓', absent: '✗', late: '⏰', excused: '📝' }[s]}</button>`).join('')}
      </div></td></tr>`).join('')}
    </table></div>`;
  $('#roster').scrollIntoView({ behavior: 'smooth' });
};
window.setMark = (sid, s, btn) => {
  window._marks[sid] = s;
  btn.parentElement.querySelectorAll('.att-btn').forEach((b) => b.className = 'att-btn');
  btn.className = `att-btn sel-${s}`;
};
ACTIONS.setMark = (el) => window.setMark(Number(el.closest('.att-btns').dataset.sid), el.dataset.s, el);
ACTIONS.markAllPresent = markAllPresent;
ACTIONS.saveAttendance = saveAttendance;
ACTIONS.openRoster = (el) => window.openRoster(Number(el.dataset.gid), el.dataset.name);
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
  const [summary, dims, outstanding, payReqs] = await Promise.all([
    get('/api/fees/summary'), get('/api/fees/by-dimension'), get('/api/fees?status=overdue&limit=50'),
    get('/api/payments/requests').catch(() => []),
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
    <h3 class="section-title">🌐 ${t('onlineRequests')}</h3>
    ${payReqs.length ? `<div class="table-wrap"><table>
    <tr><th>${t('date')}</th><th>${t('name')}</th><th>${t('amount')}</th><th>${t('txnReference')}</th><th>${t('status')}</th></tr>
    ${payReqs.slice(0, 25).map((r) => `<tr><td><small>${esc(String(r.created_at).slice(0, 10))}</small></td>
      <td>${esc(r.student_name || '-')}<br><small style="color:var(--muted)">${esc(r.parent_name || '')}</small></td>
      <td>${egp(r.amount)}</td><td><code>${esc(r.reference || r.provider_ref || '—')}</code></td>
      <td>${badge(r.status === 'paid' ? 'paid' : r.status === 'cancelled' ? 'lost' : 'due')}</td></tr>`).join('')}
    </table></div>` : `<div class="empty">${t('noData')}</div>`}
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
      <div class="card kpi"><span class="v">${conv}%</span><span class="l">${t('conversion')}</span></div>
    </div>
    <h3 class="section-title">${t('name')} / ${t('status')}</h3>
    <div class="table-wrap" style="max-height:420px;overflow:auto"><table>
    <tr><th>${t('name')}</th><th>${t('mobile')}</th><th>${t('source')}</th><th>${t('stage')}</th></tr>
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
    ${risk.length ? `<div class="table-wrap"><table><tr><th>${t('name')}</th><th>${t('severity')}</th><th>${t('signals')}</th><th>${t('recommendedAction')}</th></tr>
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
        <button class="btn sm" data-act="runReport" data-key="${r.key}">${t('view')}</button>
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
ACTIONS.runReport = (el) => window.runReport(el.dataset.key);

// ---------- pages: super admin platform portal ----------
const PLANS = [['basic', 'Basic'], ['standard', 'Standard'], ['premium', 'Premium']]; // fallback until loaded
async function loadPlans() {
  try {
    const plans = await get('/api/super/plans');
    if (plans.length) {
      const opts = plans.filter((p) => p.active).map((p) => [p.code, state.lang === 'ar' ? p.name_ar : p.name_en]);
      PLANS.length = 0; PLANS.push(...(opts.length ? opts : plans.map((p) => [p.code, p.name_en])));
    }
  } catch { /* keep fallback */ }
  return PLANS;
}

async function pageSuperHome(view) {
  const [stats, billing, tenants] = await Promise.all([
    get('/api/super/platform-stats'), get('/api/super/billing'), get('/api/super/tenants')]);
  view.innerHTML = `
    <h2 class="page-title">📊 ${t('overview')}</h2>
    <div class="cards">
      <div class="card kpi ok"><span class="v">${stats.active_tenants}/${stats.total_tenants}</span><span class="l">${t('tenantsM')}</span></div>
      <div class="card kpi"><span class="v">${stats.total_students}</span><span class="l">${t('activeStudents')}</span></div>
      <div class="card kpi"><span class="v">${stats.total_teachers}</span><span class="l">${t('teachers')}</span></div>
      <div class="card kpi"><span class="v">${stats.new_students_30d}</span><span class="l">${t('newStudents30')}</span></div>
      <div class="card kpi"><span class="v">${stats.owner_accounts}</span><span class="l">${t('ownerCt')}</span></div>
      <div class="card kpi warn"><span class="v">${stats.suspended_users}</span><span class="l">${t('suspendedUsers')}</span></div>
      <div class="card kpi ok"><span class="v">${egp(billing.total_collected_egp)}</span><span class="l">${t('platformRevenue')}</span></div>
      <div class="card kpi"><span class="v">${egp(billing.total_mrr_egp)}</span><span class="l">${t('mrr')}</span></div>
    </div>
    <h3 class="section-title">🏢 ${t('tenantsM')}</h3>
    <div class="table-wrap"><table>
      <tr><th>${t('name')}</th><th>${t('planLabel')}</th><th>${t('status')}</th><th>${t('branchesLabel')}</th>
      <th>${t('students')}</th><th>${t('teachers')}</th><th>${t('revenue')}</th></tr>
      ${tenants.map((r) => `<tr>
        <td><a href="#tstudents" data-act="viewTenant" data-id="${r.id}">${esc(r.name)}</a></td><td>${esc(r.plan)}</td><td>${badge(r.status)}</td>
        <td>${r.branch_count}</td><td>${r.student_count}</td><td>${r.teacher_count}</td>
        <td>${egp(r.revenue_collected)}</td></tr>`).join('')}
    </table></div>`;
}

async function pageTenantData(view, innerPage) {
  const tenants = await get('/api/super/tenants');
  if (!tenants.length) return view.innerHTML = `<div class="empty">${t('noData')}</div>`;
  if (!window._superTenant || !tenants.some((x) => x.id === window._superTenant)) window._superTenant = tenants[0].id;
  view.innerHTML = `<h2 class="page-title">🏫 ${t('tenantData')}</h2>
    <div class="toolbar"><label style="margin:0 8px 0 0">${t('selectTenant')}</label>
      <select id="tsel" data-change="superTenantSelect">
        ${tenants.map((x) => `<option value="${x.id}" ${x.id === window._superTenant ? 'selected' : ''}>${esc(x.name)} (${esc(x.plan)})</option>`).join('')}
      </select></div>
    <div id="tview"></div>`;
  await innerPage($('#tview'));
}

ACTIONS.superTenantSelect = (el) => { window._superTenant = Number(el.value); routeView(); };

async function pageTenants(view) {
  const [rows] = await Promise.all([get('/api/super/tenants'), loadPlans()]);
  view.innerHTML = `
    <h2 class="page-title">🏢 ${t('tenantsM')}</h2>
    <div class="toolbar">
      <button class="btn sm accent" data-act="openCreateTenant">＋ ${t('createTenant')}</button>
    </div>
    <div id="create-tenant"></div>
    <div class="table-wrap"><table>
      <tr><th>${t('name')}</th><th>${t('planLabel')}</th><th>${t('status')}</th><th>${t('trial')}</th><th>${t('branchesLabel')}</th>
      <th>${t('students')}</th><th>${t('teachers')}</th><th>${t('accounts')}</th><th>${t('revenue')}</th><th></th></tr>
      ${rows.map((r) => {
        const trialLeft = r.trial_ends_at ? Math.max(0, Math.ceil((new Date(r.trial_ends_at) - Date.now()) / 86400000)) : null;
        return `<tr>
        <td>${esc(r.name)}${r.source === 'signup' ? ` <span class="badge blue">${t('signup')}</span>` : ''}<br><small style="color:var(--muted)">${esc(r.contact_name || '')} · ${esc(r.contact_phone || r.contact_email || '')}</small></td>
        <td><select data-change="changePlan" data-id="${r.id}">${PLANS.map(([v, l]) => `<option value="${v}" ${r.plan === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        <td>${r.status === 'pending' ? `<span class="badge amber">⏳ ${t('approvalPending')}</span>` : badge(r.status)}</td>
        <td>${trialLeft !== null ? `<span class="badge ${trialLeft > 3 ? 'blue' : 'amber'}">${trialLeft} ${t('daysLeft')}</span>` : '-'}</td>
        <td>${r.branch_count}</td><td>${r.student_count}</td><td>${r.teacher_count}</td><td>${r.user_count}</td>
        <td>${egp(r.revenue_collected)}</td>
        <td><div style="display:flex;gap:6px">
          ${r.status === 'pending'
            ? `<button class="btn sm accent" data-act="setTenantStatus" data-id="${r.id}" data-status="active">✓ ${t('approve')}</button>`
            : r.status === 'active'
              ? `<button class="btn sm danger" data-act="setTenantStatus" data-id="${r.id}" data-status="suspended">${t('suspend')}</button>`
              : `<button class="btn sm" data-act="setTenantStatus" data-id="${r.id}" data-status="active">${t('activate')}</button>`}
          <button class="btn sm ghost" data-act="extendTrial" data-id="${r.id}">⏳+ ${t('extendTrial')}</button>
          <button class="btn sm ghost" data-act="viewTenant" data-id="${r.id}">${t('view')}</button>
          <button class="btn sm danger" data-act="deleteTenant" data-id="${r.id}" data-name="${esc(r.name)}">🗑</button>
        </div></td></tr>`;
      }).join('')}
    </table></div>`;
}
window.extendTrial = async (id) => {
  const days = prompt(`${t('extendTrial')} — ${t('trialDaysLabel')}:`, '14');
  if (!days) return;
  try { await post(`/api/super/tenants/${id}/extend-trial`, { days: Number(days) }); toast('✓'); routeView(); }
  catch (e) { toast('⚠ ' + e.message); }
};
window.deleteTenant = async (id, name) => {
  if (!confirm(`${t('delete')}: ${name}? — ALL data will be removed`)) return;
  try { const r = await api('DELETE', `/api/super/tenants/${id}`); toast('✓ ' + (r.deleted || '')); routeView(); }
  catch (e) { toast('⚠ ' + e.message); }
};
window.toggleCreateTenant = () => {
  const el = $('#create-tenant');
  el.innerHTML = `<div class="modal-backdrop" data-act="closeCreateTenant">
    <div class="modal card" data-act="stopClick">
      <h3 style="margin-top:0">🏢 ${t('createTenant')}</h3>
      <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">
        <div><label>${t('name')} *</label><input id="nt-name"></div>
        <div><label>${t('centerSlug')} (${t('autoGenerated').toLowerCase()})</label><input id="nt-slug" placeholder="my-center"></div>
        <div><label>${t('planLabel')}</label><select id="nt-plan">${PLANS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></div>
        <div><label>${t('contact')} (${t('owner')}) *</label><input id="nt-contact"></div>
        <div><label>${t('email')}</label><input id="nt-email" type="email"></div>
        <div><label>${t('password')} (admin) *</label><input id="nt-pass" type="text" placeholder="8+ Aa1"></div>
      </div>
      <div class="demo-hint">💡 ${t('adminUsername')}: <b>${t('autoGenerated')}</b> (<code>&lt;slug&gt;-owner</code>)</div>
      <div style="display:flex;gap:8px">
        <button class="btn accent full" data-act="createTenant">✓ ${t('createTenant')}</button>
        <button class="btn ghost" data-act="closeCreateTenant">✕</button>
      </div>
    </div>
  </div>`;
  $('#nt-name').focus();
};
ACTIONS.closeCreateTenant = () => { const el = $('#create-tenant'); if (el) el.innerHTML = ''; };
ACTIONS.openCreateTenant = () => window.toggleCreateTenant();
ACTIONS.createTenant = () => window.createTenant();
ACTIONS.extendTrial = (el) => window.extendTrial(Number(el.dataset.id));
ACTIONS.deleteTenant = (el) => window.deleteTenant(Number(el.dataset.id), el.dataset.name);
ACTIONS.changePlan = async (el) => {
  try { await patch(`/api/super/tenants/${el.dataset.id}`, { plan: el.value }); toast('✓'); }
  catch (e) { toast('⚠ ' + e.message); }
};
ACTIONS.setTenantStatus = (el) => window.setTenantStatus(Number(el.dataset.id), el.dataset.status);
ACTIONS.viewTenant = (el) => { window._superTenant = Number(el.dataset.id); location.hash = 'tstudents'; };
window.createTenant = async () => {
  try {
    const r = await post('/api/super/tenants', {
      name: $('#nt-name').value.trim(), slug: $('#nt-slug').value.trim(), plan: $('#nt-plan').value,
      adminName: $('#nt-contact').value.trim(), adminEmail: $('#nt-email').value.trim() || undefined,
      adminPassword: $('#nt-pass').value,
    });
    toast('✓ ' + (r.tenant?.name || '')); routeView();
  } catch (e) { toast('⚠ ' + e.message); }
};
window.changePlan = async (id, plan) => {
  try { await patch(`/api/super/tenants/${id}`, { plan }); toast('✓'); }
  catch (e) { toast('⚠ ' + e.message); }
};
window.setTenantStatus = async (id, status) => {
  try { await patch(`/api/super/tenants/${id}`, { status }); toast('✓'); routeView(); }
  catch (e) { toast('⚠ ' + e.message); }
};
window.viewTenant = (id) => { window._superTenant = id; location.hash = 'tstudents'; };

async function pageAccounts(view) {
  const [tenants, users] = await Promise.all([
    get('/api/super/tenants'),
    get(`/api/super/users?q=${encodeURIComponent(window._acctQ || '')}&tenantId=${window._acctTenant || ''}&limit=300`),
  ]);
  view.innerHTML = `
    <h2 class="page-title">👥 ${t('accounts')}</h2>
    <div class="toolbar">
      <input class="grow" placeholder="${t('search')}" value="${esc(window._acctQ || '')}" data-input="acctSearch">
      <select data-change="acctTenant">
        <option value="">${t('allTenants')}</option>
        ${tenants.map((x) => `<option value="${x.id}" ${String(window._acctTenant) === String(x.id) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
      </select>
      <button class="btn sm accent" data-act="toggleCreateAccount">＋ ${t('createAccount')}</button>
    </div>
    <div id="create-account"></div>
    <div class="table-wrap" style="max-height:560px;overflow:auto"><table>
      <tr><th>${t('name')}</th><th>${t('role')}</th><th>${t('tenantsM')}</th><th>${t('username')}</th><th>${t('status')}</th><th>${t('lastLogin')}</th><th></th></tr>
      ${users.map((u) => `<tr>
        <td>${esc(u.full_name)}${u.email ? `<br><small style="color:var(--muted)">${esc(u.email)}</small>` : ''}</td>
        <td><span class="badge blue">${esc(t(u.role))}</span></td>
        <td>${u.tenant_name ? esc(u.tenant_name) : `<b>${t('platform')}</b>`}</td>
        <td>${esc(u.username || '-')}</td>
        <td>${badge(u.status)}</td>
        <td><small>${u.last_login_at ? esc(String(u.last_login_at).slice(0, 16).replace('T', ' ')) : '—'}</small></td>
        <td><div style="display:flex;gap:6px">
          <button class="btn sm ghost" data-act="resetUserPassword" data-id="${u.id}">🔑 ${t('resetPassword')}</button>
          ${u.status === 'active'
            ? `<button class="btn sm danger" data-act="setUserStatus" data-id="${u.id}" data-status="suspended">${t('suspend')}</button>`
            : `<button class="btn sm" data-act="setUserStatus" data-id="${u.id}" data-status="active">${t('activate')}</button>`}
        </div></td></tr>`).join('')}
    </table></div>`;
  window.tenantsData = tenants;
}
window.toggleCreateAccount = () => {
  const el = $('#create-account');
  if (el.innerHTML) return el.innerHTML = '';
  const tenants = window.tenantsData || [];
  el.innerHTML = `<div class="card" style="margin-bottom:16px">
    <h3 class="section-title" style="margin-top:0">${t('createAccount')}</h3>
    <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">
      <div><label>${t('tenantsM')}</label><select id="na-tenant">
        ${tenants.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>
      <div><label>${t('role')}</label><select id="na-role">
        ${['owner', 'admin', 'branch_manager', 'reception', 'finance', 'teacher', 'parent', 'student'].map((r) => `<option value="${r}">${esc(t(r))}</option>`).join('')}</select></div>
      <div><label>${t('name')}</label><input id="na-name"></div>
      <div><label>${t('username')}</label><input id="na-username"></div>
      <div><label>${t('email')}</label><input id="na-email" type="email"></div>
      <div><label>${t('mobile')}</label><input id="na-mobile"></div>
      <div><label>${t('password')}</label><input id="na-pass" type="text" placeholder="8+ Aa1"></div>
    </div>
    <button class="btn full" data-act="createAccount">${t('createAccount')}</button>
  </div>`;
};
window.createAccount = async () => {
  try {
    await post('/api/super/users', {
      tenantId: Number($('#na-tenant').value), role: $('#na-role').value,
      fullName: $('#na-name').value.trim(), username: $('#na-username').value.trim(),
      email: $('#na-email').value.trim() || undefined, mobile: $('#na-mobile').value.trim() || undefined,
      password: $('#na-pass').value,
    });
    toast('✓'); routeView();
  } catch (e) { toast('⚠ ' + e.message); }
};
window.resetUserPassword = async (id) => {
  const pw = prompt(`${t('resetPassword')} (8+ chars, Aa1):`);
  if (!pw) return;
  try { await patch(`/api/super/users/${id}`, { password: pw }); toast('✓'); }
  catch (e) { toast('⚠ ' + e.message); }
};
window.setUserStatus = async (id, status) => {
  try { await patch(`/api/super/users/${id}`, { status }); toast('✓'); routeView(); }
  catch (e) { toast('⚠ ' + e.message); }
};

ACTIONS.toggleCreateAccount = () => window.toggleCreateAccount();
ACTIONS.createAccount = () => window.createAccount();
ACTIONS.acctSearch = (el) => {
  window._acctQ = el.value;
  clearTimeout(window._aq);
  window._aq = setTimeout(routeView, 350);
};
ACTIONS.acctTenant = (el) => { window._acctTenant = el.value; routeView(); };
ACTIONS.resetUserPassword = (el) => window.resetUserPassword(Number(el.dataset.id));
ACTIONS.setUserStatus = (el) => window.setUserStatus(Number(el.dataset.id), el.dataset.status);

async function pageBilling(view) {
  const b = await get('/api/super/billing');
  const subs = {};
  b.tenants.forEach((r) => { subs[r.plan] = (subs[r.plan] || 0) + 1; });
  view.innerHTML = `
    <h2 class="page-title">💳 ${t('billing')}</h2>
    <div class="cards">
      <div class="card kpi"><span class="v">${egp(b.total_mrr_egp)}</span><span class="l">${t('mrr')}</span></div>
      <div class="card kpi ok"><span class="v">${egp(b.total_collected_egp)}</span><span class="l">${t('collectedOn')}</span></div>
    </div>
    <div class="toolbar" style="margin-top:14px">
      <button class="btn sm accent" data-act="openPlanModal">＋ ${t('addPlan')}</button>
    </div>
    <h3 class="section-title">${t('planLabel')}</h3>
    <div class="cards">${b.plans.map((p) => `
      <div class="card" style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="font-size:16px">${state.lang === 'ar' ? esc(p.name_ar) : esc(p.name_en)}</b>
          ${p.active ? '' : `<span class="badge gray">${t('inactivePlan')}</span>`}
        </div>
        <div><code style="font-size:12px;background:#f1f5f9;padding:2px 8px;border-radius:6px">${esc(p.code)}</code></div>
        <div class="kpi"><span class="v">${egp(p.monthly_egp)}</span><span class="l">${t('monthlyFee')}</span></div>
        <small style="color:var(--muted)">👥 ${t('maxStudents')}: ${p.max_students} · 🏛 ${t('maxBranches')}: ${p.max_branches} · 👥 ${t('subscribers')}: ${subs[p.code] || 0}</small>
        <div>${p.features.map((f) => `<span class="badge gray" style="margin:2px">${esc(f)}</span>`).join('')}</div>
        <div style="display:flex;gap:6px;margin-top:auto">
          <button class="btn sm" data-act="openPlanModal" data-code="${esc(p.code)}">✏️ ${t('editPlan')}</button>
          <button class="btn sm danger" data-act="deletePlan" data-code="${esc(p.code)}">🗑 ${t('delete')}</button>
        </div>
      </div>`).join('')}</div>
    <div id="plan-modal"></div>
    <h3 class="section-title">🏢 ${t('tenantsM')}</h3>
    <div class="table-wrap"><table>
      <tr><th>${t('name')}</th><th>${t('planLabel')}</th><th>${t('monthlyFee')}</th><th>${t('students')}</th><th>${t('revenue')}</th><th>${t('upgradeDowngrade')}</th></tr>
    ${b.tenants.map((r) => {
      const p = b.plans.find((x) => x.code === r.plan);
        return `<tr><td>${esc(r.name)}</td><td>${esc(r.plan)}</td><td>${egp(p?.monthly_egp || 0)}</td>
          <td>${r.student_count}</td><td>${egp(r.collected_revenue)}</td>
          <td><select data-change="changePlan" data-id="${r.id}">${b.plans.map((x) => `<option value="${x.code}" ${r.plan === x.code ? 'selected' : ''}>${x.code}</option>`).join('')}</select></td></tr>`;
      }).join('')}
    </table></div>`;
}

// ---- plan editor modal ----
function planModalHtml(plan) {
  const isNew = !plan;
  const p = plan || { code: '', name_en: '', name_ar: '', monthly_egp: 1500, max_students: 100, max_branches: 1, features: [], active: true };
  return `<div class="modal-backdrop" data-act="closePlanModal">
    <div class="modal card" data-act="stopClick">
      <h3 style="margin-top:0">${isNew ? '＋ ' + t('addPlan') : '✏️ ' + esc(p.name_en)}</h3>
      <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">
        ${isNew ? `<div><label>${t('planCode')} *</label><input id="pm-code" placeholder="starter"></div>` : ''}
        <div><label>${t('nameEn')} *</label><input id="pm-en" value="${esc(p.name_en)}"></div>
        <div><label>${t('nameAr')}</label><input id="pm-ar" value="${esc(p.name_ar)}" dir="rtl"></div>
        <div><label>${t('monthlyEgp')}</label><input id="pm-fee" type="number" min="0" value="${p.monthly_egp}"></div>
        <div><label>${t('maxStudents')}</label><input id="pm-stu" type="number" min="1" value="${p.max_students}"></div>
        <div><label>${t('maxBranches')}</label><input id="pm-br" type="number" min="1" value="${p.max_branches}"></div>
      </div>
      <label>${t('features')} — ${t('featuresHint')}</label>
      <textarea id="pm-features" rows="4">${esc(p.features.join('\n'))}</textarea>
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px">
        <input type="checkbox" id="pm-active" style="width:auto" ${p.active ? 'checked' : ''}> ${t('enabled')} (${t('signup')})</label>
      <div style="display:flex;gap:8px">
        <button class="btn accent full" data-act="savePlan" data-code="${isNew ? '' : esc(p.code)}">💾 ${t('save')}</button>
        <button class="btn ghost" data-act="closePlanModal">✕</button>
      </div>
    </div>
  </div>`;
}
ACTIONS.stopClick = () => {}; // inner clicks stop here — backdrop click closes the modal
ACTIONS.openPlanModal = async (el) => {
  const code = el.dataset.code;
  const plan = code ? (await get('/api/super/plans')).find((p) => p.code === code) : null;
  let host = $('#plan-modal');
  if (!host) { host = document.createElement('div'); host.id = 'plan-modal'; $('.main').appendChild(host); }
  host.innerHTML = planModalHtml(plan);
};
ACTIONS.closePlanModal = () => { const h = $('#plan-modal'); if (h) h.innerHTML = ''; };
ACTIONS.savePlan = async (el) => {
  const body = {
    name_en: $('#pm-en').value.trim(),
    name_ar: $('#pm-ar').value.trim() || undefined,
    monthly_egp: Number($('#pm-fee').value) || 0,
    max_students: Number($('#pm-stu').value) || 1,
    max_branches: Number($('#pm-br').value) || 1,
    features: $('#pm-features').value.split('\n'),
    active: $('#pm-active').checked,
  };
  try {
    if (el.dataset.code) await patch(`/api/super/plans/${el.dataset.code}`, body);
    else await post('/api/super/plans', { ...body, code: $('#pm-code').value.trim() });
    toast('✓'); routeView();
  } catch (e) { toast('⚠ ' + e.message); }
};
ACTIONS.deletePlan = async (el) => {
  if (!confirm(`${t('delete')}: ${el.dataset.code}?`)) return;
  try { await api('DELETE', `/api/super/plans/${el.dataset.code}`); toast('✓'); routeView(); }
  catch (e) { toast('⚠ ' + e.message); }
};

// ---------- pages: super admin — Security & API console ----------
const SEC_TABS = [['overview', '🛡️'], ['roles', '👥'], ['audit', '📜'], ['keys', '🔑'], ['docs', '📘']];
async function pageSecurity(view) {
  if (!window._secTab) window._secTab = 'overview';
  view.innerHTML = `
    <h2 class="page-title">🛡️ ${t('securityApi')}</h2>
    <div class="toolbar" style="gap:6px">
      ${SEC_TABS.map(([id, icon]) => {
        const labels = { overview: t('secOverview'), roles: t('rolesPerms'), audit: t('auditTrail'), keys: t('apiKeys'), docs: t('apiDocs') };
        return `<button class="btn sm ${window._secTab === id ? 'accent' : 'ghost'}" data-act="secTab" data-tab="${id}">${icon} ${labels[id]}</button>`;
      }).join('')}
    </div>
    <div id="sec-body"><div class="empty">…</div></div>`;
  const body = $('#sec-body');
  try {
    if (window._secTab === 'overview') await secOverviewTab(body);
    else if (window._secTab === 'roles') await secRolesTab(body);
    else if (window._secTab === 'audit') await secAuditTab(body);
    else if (window._secTab === 'keys') await secKeysTab(body);
    else secDocsTab(body);
  } catch (e) { body.innerHTML = `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
}
ACTIONS.secTab = (el) => { window._secTab = el.dataset.tab; routeView(); };

async function secOverviewTab(body) {
  const [stats, admins] = await Promise.all([
    get('/api/super/security-overview'), get('/api/super/admins')]);
  body.innerHTML = `
    <div class="cards">
      <div class="card kpi"><span class="v">${stats.active_admins}</span><span class="l">${t('activeAdmins')}</span></div>
      <div class="card kpi"><span class="v">${stats.active_api_keys}</span><span class="l">${t('apiKeys')}</span></div>
      <div class="card kpi"><span class="v">${stats.audit_events_30d}</span><span class="l">${t('auditEvents30')}</span></div>
      <div class="card kpi warn"><span class="v">${stats.suspended_users}</span><span class="l">${t('suspendedUsers')}</span></div>
      <div class="card kpi ${stats.pending_tenants > 0 ? 'warn' : ''}"><span class="v">${stats.pending_tenants}</span><span class="l">${t('approvalPending')}</span></div>
    </div>
    <h3 class="section-title">🔐 ${t('adminAccounts')}</h3>
    <div class="table-wrap"><table>
      <tr><th>${t('name')}</th><th>${t('username')}</th><th>${t('email')}</th><th>${t('status')}</th><th>${t('lastLogin')}</th></tr>
      ${admins.map((a) => `<tr>
        <td><b>${esc(a.full_name)}</b></td><td><code>${esc(a.username)}</code></td>
        <td>${esc(a.email || '-')}</td><td>${badge(a.status)}</td>
        <td><small>${a.last_login_at ? esc(String(a.last_login_at).slice(0, 16).replace('T', ' ')) : '—'}</small></td>
      </tr>`).join('')}
    </table></div>
    <div class="demo-hint" style="margin-top:14px">🔐 ${state.lang === 'ar'
      ? 'حسابات مدير المنصة منفصلة عن حسابات العملاء — تُدار من هنا فقط. لتغيير كلمة مرورك استخدم الإعدادات.'
      : 'Platform admin accounts are separate from customer accounts — managed here only. To change your own password use Settings.'}</div>`;
}

async function secRolesTab(body) {
  const roles = await get('/api/super/roles');
  body.innerHTML = `<div class="table-wrap"><table>
    <tr><th>${t('role')}</th><th>${t('level')}</th><th>${t('scope')}</th><th>${t('name')}</th></tr>
    ${roles.map((r) => `<tr>
      <td><span class="badge blue">${esc(t(r.role))}</span></td>
      <td>${r.level}</td>
      <td><code>${esc(r.scope)}</code></td>
      <td style="white-space:normal;min-width:300px">${esc(state.lang === 'ar' ? r.desc_ar : r.desc_en)}</td>
    </tr>`).join('')}
  </table></div>`;
}

async function secAuditTab(body) {
  const rows = await get(`/api/super/audit-logs?limit=200&entity=${encodeURIComponent(window._secEntity || '')}&action=${encodeURIComponent(window._secAction || '')}`);
  const entities = [...new Set(rows.map((r) => r.entity))].sort();
  body.innerHTML = `
    <div class="toolbar">
      <select data-change="secEntityFilter">
        <option value="">${t('entity')} — ${t('all')}</option>
        ${entities.map((e) => `<option value="${esc(e)}" ${window._secEntity === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}
      </select>
    </div>
    ${rows.length ? `<div class="table-wrap" style="max-height:560px;overflow:auto"><table>
      <tr><th>${t('date')}</th><th>${t('name')}</th><th>${t('role')}</th><th>${t('tenantsM')}</th><th>${t('action')}</th><th>${t('entity')}</th><th>${t('ip')}</th></tr>
      ${rows.map((a) => `<tr>
        <td><small>${esc(String(a.created_at).slice(0, 16).replace('T', ' '))}</small></td>
        <td>${esc(a.user_name || '-')}</td>
        <td><span class="badge blue">${esc(a.user_role ? t(a.user_role) : '-')}</span></td>
        <td>${esc(a.tenant_name || t('platform'))}</td>
        <td>${badge(a.action === 'create' ? 'active' : a.action === 'delete' || a.action === 'revoke' ? 'overdue' : 'submitted')}</td>
        <td>${esc(a.entity)}${a.entity_id != null ? ' #' + a.entity_id : ''}</td>
        <td><small>${esc(a.ip || '-')}</small></td></tr>`).join('')}
    </table></div>` : `<div class="empty">${t('noData')}</div>`}`;
}
ACTIONS.secEntityFilter = (el) => { window._secEntity = el.value; routeView(); };

async function secKeysTab(body) {
  const keys = await get('/api/super/api-keys');
  body.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <h3 class="section-title" style="margin-top:0">＋ ${t('createKey')}</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="ak-name" placeholder="${t('keyName')}" style="flex:1;min-width:200px">
        <button class="btn accent" data-act="createApiKey">🔑 ${t('createKey')}</button>
      </div>
    </div>
    <div id="ak-newkey"></div>
    ${keys.length ? `<div class="table-wrap"><table>
      <tr><th>${t('name')}</th><th>Key</th><th>${t('status')}</th><th>${t('lastUsed')}</th><th>${t('date')}</th><th></th></tr>
      ${keys.map((k) => `<tr>
        <td><b>${esc(k.name)}</b><br><small style="color:var(--muted)">${esc(k.created_by_name || '-')}</small></td>
        <td><code>${esc(k.prefix)}••••••••</code></td>
        <td>${k.revoked ? `<span class="badge red">${t('revoked')}</span>` : '<span class="badge green">' + t('active') + '</span>'}</td>
        <td><small>${k.last_used_at ? esc(String(k.last_used_at).slice(0, 16).replace('T', ' ')) : t('neverUsed')}</small></td>
        <td><small>${esc(String(k.created_at).slice(0, 10))}</small></td>
        <td>${k.revoked ? '' : `<button class="btn sm danger" data-act="revokeApiKey" data-id="${k.id}">${t('revoke')}</button>`}</td>
      </tr>`).join('')}
    </table></div>` : `<div class="empty">${t('noData')}</div>`}`;
}
ACTIONS.createApiKey = async () => {
  const name = $('#ak-name')?.value.trim();
  if (!name) return toast('⚠ ' + t('keyName'));
  try {
    const r = await post('/api/super/api-keys', { name });
    $('#ak-newkey').innerHTML = `<div class="card" style="border-left:4px solid var(--green);margin-bottom:14px">
      <b>✓ ${esc(r.name)}</b> — <code style="user-select:all">${esc(r.key)}</code><br>
      <small style="color:var(--red)">${t('keyOnceHint')}</small><br>
      <button class="btn sm" style="margin-top:8px" data-act="copyKey" data-key="${esc(r.key)}">📋 ${t('copy')}</button>
    </div>`;
    $('#ak-name').value = '';
  } catch (e) { toast('⚠ ' + e.message); }
};
ACTIONS.copyKey = async (el) => {
  try { await navigator.clipboard.writeText(el.dataset.key); toast('📋 ' + t('copied')); }
  catch { toast(el.dataset.key); }
};
ACTIONS.revokeApiKey = async (el) => {
  if (!confirm(`${t('revoke')}: #${el.dataset.id}?`)) return;
  try { await api('DELETE', `/api/super/api-keys/${el.dataset.id}`); toast('✓'); routeView(); }
  catch (e) { toast('⚠ ' + e.message); }
};

function secDocsTab(body) {
  body.innerHTML = `
    <div class="card">
      <h3 class="section-title" style="margin-top:0">📘 EduCenter OS API</h3>
      <p style="font-size:14px;color:var(--muted)">${t('authMethod')}:
      <code>Authorization: Bearer &lt;JWT&gt;</code> ${state.lang === 'ar' ? 'أو' : 'or'} <code>X-Api-Key: &lt;key&gt;</code></p>
      <div class="table-wrap"><table>
        <tr><th>Method</th><th>Endpoint</th><th>${t('role')}</th><th>Description</th></tr>
        ${[
          ['GET', '/api/health', 'public', 'Service + database health check'],
          ['POST', '/api/auth/login', 'public', 'Login with identifier (username/email/mobile) + password → JWT'],
          ['GET', '/api/platform/public-config', 'public', 'Public signup config + active plan catalog'],
          ['POST', '/api/platform/signup', 'public', 'Self-service center registration'],
          ['GET', '/api/super/platform-stats', 'super_admin', 'Platform-wide KPI counters'],
          ['GET', '/api/super/tenants', 'super_admin', 'List all centers with usage + revenue'],
          ['POST', '/api/super/tenants', 'super_admin', 'Create a center + its first owner account'],
          ['GET', '/api/super/users', 'super_admin', 'List customer accounts (platform admins excluded)'],
          ['GET', '/api/super/plans', 'super_admin', 'Plan catalog'],
          ['GET', '/api/super/billing', 'super_admin', 'MRR + per-center billing overview'],
          ['GET', '/api/super/audit-logs', 'super_admin', 'Audit trail (filter: tenantId, entity, action)'],
          ['GET', '/api/super/api-keys', 'super_admin', 'List API keys (prefix only)'],
          ['GET', '/api/students?q=&limit=', 'staff', 'Search students (tenant-scoped)'],
          ['GET', '/api/fees/summary', 'staff', 'Expected / collected / outstanding finance summary'],
          ['GET', '/api/reports/{key}?format=csv', 'staff', 'Export a report as CSV'],
        ].map(([m, ep, role, desc]) => `<tr>
          <td><span class="badge ${m === 'GET' ? 'blue' : 'green'}">${m}</span></td>
          <td><code>${esc(ep)}</code></td>
          <td><small>${esc(role)}</small></td>
          <td style="white-space:normal">${esc(desc)}</td>
        </tr>`).join('')}
      </table></div>
      <div class="demo-hint" style="margin-top:14px">💡 ${state.lang === 'ar'
        ? 'مفاتيح API للقراءة فقط حالياً. أنشئ مفتاحاً من تبويب مفاتيح API واستخدمه في ترويسة X-Api-Key.'
        : 'API keys are read-only for now. Create one in the API Keys tab and send it in the X-Api-Key header.'}</div>
    </div>`;
}

async function pageLogs(view) {
  const rows = await get('/api/super/audit-logs?limit=150');
  view.innerHTML = `
    <h2 class="page-title">📜 ${t('logs')}</h2>` + (rows.length
      ? `<div class="table-wrap" style="max-height:600px;overflow:auto"><table>
      <tr><th>${t('date')}</th><th>${t('name')}</th><th>${t('role')}</th><th>${t('tenantsM')}</th><th>${t('action')}</th><th>${t('entity')}</th><th>${t('ip')}</th></tr>
      ${rows.map((a) => `<tr>
        <td><small>${esc(String(a.created_at).slice(0, 16).replace('T', ' '))}</small></td>
        <td>${esc(a.user_name || '-')}</td>
        <td><span class="badge blue">${esc(a.user_role ? t(a.user_role) : '-')}</span></td>
        <td>${esc(a.tenant_name || t('platform'))}</td>
        <td>${badge(a.action)}</td>
        <td>${esc(a.entity)}${a.entity_id != null ? ' #' + a.entity_id : ''}</td>
        <td><small>${esc(a.ip || '-')}</small></td></tr>`).join('')}
    </table></div>`
      : `<div class="empty">${t('noData')}</div>`);
}

async function pageSettings(view) {
  view.innerHTML = `
    <h2 class="page-title">⚙️ ${t('settings')}</h2>
    <div class="card" style="max-width:460px">
      <h3 class="section-title" style="margin-top:0">🔐 ${t('changeOwnPassword')}</h3>
      <label>${t('currentPassword')}</label><input id="cp-cur" type="password" autocomplete="current-password">
      <label>${t('newPassword')}</label><input id="cp-new" type="password" autocomplete="new-password" placeholder="8+ chars, Aa1">
      <button class="btn full" data-act="changeMyPassword">${t('save')}</button>
    </div>
    <div class="card" style="max-width:460px;margin-top:14px">
      <h3 class="section-title" style="margin-top:0">ℹ️ ${t('platform')}</h3>
      <p style="font-size:14px;color:var(--muted)">EduCenter OS — multi-tenant SaaS<br>
      ${t('demoPass')}: <code>Edu@Demo-2026</code></p>
    </div>`;
}
window.changeMyPassword = async () => {
  try {
    await post('/api/auth/change-password', { currentPassword: $('#cp-cur').value, newPassword: $('#cp-new').value });
    toast('✓'); $('#cp-cur').value = ''; $('#cp-new').value = '';
  } catch (e) { toast('⚠ ' + e.message); }
};
ACTIONS.changeMyPassword = () => window.changeMyPassword();
ACTIONS.savePlatformSettings = () => window.savePlatformSettings();

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
      <button class="btn sm accent" data-act="openRoster" data-gid="${c.id}" data-name="${esc(c.name)}">${t('takeAttendance')}</button>
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
          ${['assigned', 'viewed'].includes(h.status) ? `<button class="btn sm" data-act="submitHw" data-id="${h.id}">✓ ${t('submit')}</button>` : ''}
          ${h.score != null ? `<b>${h.score}/10</b>` : ''}</div></div>`).join('')
      : `<div class="empty">${t('noData')}</div>`);
    return;
  }
  // teacher: pick a group
  const groups = await get('/api/groups');
  if (!groups.length) return view.innerHTML = `<div class="empty">${t('noData')}</div>`;
  window._hwGroup = window._hwGroup || groups[0].id;
  view.innerHTML = `<h2 class="page-title">📝 ${t('homework')}</h2>
    <div class="toolbar"><select data-change="hwGroup">
      ${groups.map((g) => `<option value="${g.id}" ${g.id === window._hwGroup ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
    </select></div><div id="hwlist"></div>`;
  const hw = await get(`/api/homework?group_id=${window._hwGroup}`);
  $('#hwlist').innerHTML = hw.length ? `<div class="table-wrap"><table>
    <tr><th>${t('name')}</th><th>${t('date')}</th><th>${t('submitted')}</th><th>${t('reviewed')}</th></tr>
    ${hw.map((h) => `<tr><td>${esc(h.title)}</td><td>${esc(h.due_date)}</td>
      <td>${h.submitted_count}</td><td>${h.reviewed_count}</td></tr>`).join('')}</table></div>`
    : `<div class="empty">${t('noData')}</div>`;
}
window.submitHw = async (id) => { await patch(`/api/portal/student/homework/${id}/submit`, {}); toast('✓'); routeView(); };
ACTIONS.submitHw = (el) => window.submitHw(Number(el.dataset.id));
ACTIONS.hwGroup = (el) => { window._hwGroup = el.value; routeView(); };
ACTIONS.qzGroup = (el) => { window._qzGroup = el.value; routeView(); };
ACTIONS.startQuiz = (el) => window.startQuiz(Number(el.dataset.id));
ACTIONS.submitQuiz = (el) => window.submitQuiz(Number(el.dataset.id));
ACTIONS.quizAnswer = (el) => { window._answers[el.dataset.qid] = el.dataset.key; };

async function pageQuizzes(view) {
  const isStudent = state.user.role === 'student';
  if (isStudent) {
    const d = await get('/api/dashboard/student');
    view.innerHTML = `<h2 class="page-title">🧪 ${t('quizzes')}</h2>` + (d.available_quizzes.length
      ? d.available_quizzes.map((q) => `<div class="list-item"><div><b>${esc(q.title)}</b><br>
        <small style="color:var(--muted)">${esc(q.type)} · ⏰ ${esc((q.deadline || '').slice(0, 16).replace('T', ' '))}</small></div>
        <button class="btn sm accent" data-act="startQuiz" data-id="${q.id}">${t('start')}</button></div>`).join('')
      : `<div class="empty">${t('noData')}</div><div id="quiz-area"></div>`) + `<div id="quiz-area"></div>`;
    return;
  }
  const groups = await get('/api/groups');
  if (!groups.length) return view.innerHTML = `<div class="empty">${t('noData')}</div>`;
  window._qzGroup = window._qzGroup || groups[0].id;
  view.innerHTML = `<h2 class="page-title">🧪 ${t('quizzes')}</h2>
    <div class="toolbar"><select data-change="qzGroup">
      ${groups.map((g) => `<option value="${g.id}" ${g.id === window._qzGroup ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
    </select></div><div id="qzlist"></div>`;
  const rows = await get(`/api/quizzes?group_id=${window._qzGroup}`);
  $('#qzlist').innerHTML = rows.length ? `<div class="table-wrap"><table>
    <tr><th>${t('name')}</th><th>${t('type')}</th><th>${t('questions')}</th><th>${t('attempts')}</th><th>${t('avgScore')}</th><th>${t('status')}</th></tr>
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
        data-change="quizAnswer" data-qid="${q.id}" data-key="${esc(o.key)}"> ${esc(o.key)}. ${esc(o.text)}</label>`).join('')}
    </div>`).join('')}
    <button class="btn accent full" data-act="submitQuiz" data-id="${attempt.id}">${t('submit')}</button>`;
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
      data-act="pickKid" data-id="${c.id}">${esc(c.name)}</span>`).join('')}</div>
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
      ${a.parent_followup ? '<br><span class="badge amber">📞 ' + t('followupRequired') + '</span>' : ''}</div>`).join('')
      : `<div class="empty">${t('noData')}</div>`}
    <h3 class="section-title">💰 ${t('fees')}</h3>
    ${c.fees?.length ? `<div class="table-wrap"><table><tr><th>${t('name')}</th><th>${t('total')}</th><th>${t('paid')}</th><th>${t('outstanding')}</th><th>${t('status')}</th><th></th></tr>
      ${c.fees.map((f) => `<tr><td>${esc(f.description || f.fee_type)}</td><td>${egp(f.total_after_discount)}</td>
        <td>${egp(f.paid)}</td><td style="font-weight:700;color:${f.outstanding > 0 ? 'var(--red)' : 'var(--green)'}">${egp(f.outstanding)}</td>
        <td>${badge(f.status)}</td>
        <td>${f.outstanding > 0 ? `<button class="btn sm accent" data-act="startPay" data-id="${f.id}" data-amount="${f.outstanding}">💳 ${t('payOnline')}</button>` : ''}</td></tr>`).join('')}</table></div>
      <div id="pay-box" style="margin-top:12px"></div>` : `<div class="empty">${t('noData')}</div>`}`;
}
window.startPay = async (feeId, amount) => {
  if (!confirm(`${t('payOnline')} — ${egp(amount)}?`)) return;
  try {
    const r = await post('/api/payments/pay-request', { fee_id: feeId });
    const box = $('#pay-box');
    if (r.pay_url) {
      box.innerHTML = `<div class="card" style="border-left:4px solid var(--accent)">
        <b>${t('payInstructions')}</b>
        <p><a class="btn accent" href="${esc(r.pay_url)}" target="_blank" rel="noopener">${t('payOnline')} — ${egp(amount)}</a></p></div>`;
      window.open(r.pay_url, '_blank');
    } else {
      box.innerHTML = `<div class="card" style="border-left:4px solid var(--accent)">
        <b>${t('payInstructions')}</b>
        ${r.wallet_number ? `<p>${t('walletNumber')}: <code>${esc(r.wallet_number)}</code></p>` : ''}
        <label>${t('txnReference')}</label><input id="pay-ref" placeholder="123456789">
        <button class="btn accent" data-act="confirmPay" data-id="${r.request.id}">${t('confirmPayment')}</button></div>`;
    }
  } catch (e) { toast('⚠ ' + e.message); }
};
window.confirmPay = async (reqId) => {
  const ref = $('#pay-ref')?.value.trim();
  if (!ref) return toast('⚠ ' + t('txnReference'));
  try {
    await post(`/api/payments/pay-request/${reqId}/confirm`, { reference: ref });
    toast('✓'); routeView();
  } catch (e) { toast('⚠ ' + e.message); }
};

ACTIONS.pickKid = (el) => { window._activeKid = Number(el.dataset.id); routeView(); };
ACTIONS.startPay = (el) => window.startPay(Number(el.dataset.id), Number(el.dataset.amount));
ACTIONS.confirmPay = (el) => window.confirmPay(Number(el.dataset.id));

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

// ---------- pages: public signup ----------
function signupPageHtml() {
  return `
  <div class="login-wrap">
    <button class="lang-switch" data-act="toggleLang">${state.lang === 'ar' ? 'English' : 'العربية'}</button>
    <div class="login-card" style="max-width:560px">
      <h1>🏢 ${t('signupTitle')}</h1>
      <p>${t('signupSub')}</p>
      <div id="signup-form"><div class="empty">…</div></div>
      <div id="signup-result"></div>
      <p style="margin-top:14px"><a href="#home" style="color:var(--accent);font-weight:600">${t('haveAccount')}</a></p>
    </div>
  </div>`;
}
async function loadSignupForm() {
  const el = $('#signup-form');
  if (!el) return;
  try {
    const cfg = await fetch('/api/platform/public-config').then((r) => r.json());
    if (!cfg.signup_enabled) { el.innerHTML = `<div class="empty">${t('noData')}</div>`; return; }
    el.innerHTML = `
      <form data-submit="doSignup">
        <label>${t('centerName')}</label><input id="su-center" required>
        <label>${t('ownerName')}</label><input id="su-owner" required>
        <label>${t('email')}</label><input id="su-email" type="email">
        <label>${t('mobile')}</label><input id="su-mobile" placeholder="+2010...">
        <label>${t('password')}</label><input id="su-pass" type="password" placeholder="8+ Aa1" required>
        <label>${t('planLabel')}</label>
        <select id="su-plan">${cfg.plans.map((p) => `<option value="${p.plan}">${esc(state.lang === 'ar' ? p.name_ar : p.name_en)} — ${egp(p.monthly_egp)}/mo</option>`).join('')}</select>
        ${cfg.signup_mode === 'manual' ? `<div class="demo-hint">ℹ️ ${t('manualApproval')}</div>` : `<div class="demo-hint">🚀 ${t('instantTrial')} — ${cfg.trial_days} ${t('daysLeft')}</div>`}
        <button class="btn full" type="submit">${t('signup')}</button>
      </form>`;
  } catch (e) { el.innerHTML = `<div class="empty">⚠️ ${esc(e.message)}</div>`; }
}
window.doSignup = async (e) => {
  e.preventDefault();
  try {
    const r = await post('/api/platform/signup', {
      centerName: $('#su-center').value.trim(), ownerName: $('#su-owner').value.trim(),
      email: $('#su-email').value.trim() || undefined, mobile: $('#su-mobile').value.trim() || undefined,
      password: $('#su-pass').value, plan: $('#su-plan').value,
    });
    $('#signup-form').style.display = 'none';
    $('#signup-result').innerHTML = `<div class="card" style="border-left:4px solid var(--green)">
      <h3>✓ ${t('signup')}</h3>
      <p>${esc(r.message)}</p>
      ${r.admin_username ? `<p><b>${t('username')}:</b> <code>${esc(r.admin_username)}</code></p>` : ''}
    </div>`;
  } catch (err) { toast('⚠ ' + err.message); }
};

ACTIONS.doSignup = (el, ev) => window.doSignup(ev);
async function pageTimetable(view) {
  const [sessions, groups, cfg, teachers] = await Promise.all([
    get('/api/schedules'), get('/api/groups'), get('/api/config'), get('/api/teachers'),
  ]);
  const days = [0, 1, 2, 3, 4, 5, 6];
  view.innerHTML = `
    <h2 class="page-title">🗓 ${t('timetable')}</h2>
    <div class="card" style="margin-bottom:14px">
      <h3 class="section-title" style="margin-top:0">＋ ${t('addSession')}</h3>
      <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">
        <div><label>${t('groups')}</label><select id="tt-group">
          ${groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></div>
        <div><label>${state.lang === 'ar' ? 'اليوم' : 'Day'}</label><select id="tt-day">
          ${days.map((d) => `<option value="${d}">${DAY_NAMES[state.lang][d]}</option>`).join('')}</select></div>
        <div><label>${t('startTime')}</label><input id="tt-start" type="time" value="16:00"></div>
        <div><label>${t('endTime')}</label><input id="tt-end" type="time" value="17:30"></div>
        <div><label>${t('teacher')}</label><select id="tt-teacher"><option value="">—</option>
          ${(teachers || []).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>
        <div><label>${t('room')}</label><select id="tt-room"><option value="">—</option>
          ${(cfg.classrooms || []).map((c) => `<option value="${c.id}">${esc(c.name)} (${esc(c.branch_name || '')})</option>`).join('')}</select></div>
      </div>
      <button class="btn accent" data-act="addSession">${t('addSession')}</button>
    </div>
    <div class="table-wrap"><table>
      <tr>${days.map((d) => `<th>${DAY_NAMES[state.lang][d]}</th>`).join('')}</tr>
      <tr valign="top">${days.map((d) => {
        const list = sessions.filter((s) => Number(s.day_of_week) === d);
        return `<td style="min-width:150px">${list.map((s) => `<div class="card" style="margin:4px 0;padding:8px;font-size:13px">
          <b>${esc(String(s.start_time).slice(0, 5))}–${esc(String(s.end_time).slice(0, 5))}</b><br>
          ${esc(s.group_name)}<br>
          <small style="color:var(--muted)">${esc(s.teacher_name || '—')} · ${esc(s.classroom_name || '—')}</small><br>
          <button class="btn sm danger" style="margin-top:4px" data-act="delSession" data-id="${s.id}">✕</button>
        </div>`).join('') || '<small style="color:var(--muted)">—</small>'}</td>`;
      }).join('')}</tr>
    </table></div>`;
}
window.addSession = async (force) => {
  try {
    await post('/api/schedules', {
      group_id: Number($('#tt-group').value), day_of_week: Number($('#tt-day').value),
      start_time: $('#tt-start').value, end_time: $('#tt-end').value,
      teacher_id: $('#tt-teacher').value ? Number($('#tt-teacher').value) : undefined,
      classroom_id: $('#tt-room').value ? Number($('#tt-room').value) : undefined,
      force: !!force,
    });
    toast('✓'); routeView();
  } catch (e) {
    if (e.data?.conflicts) {
      const msgs = e.data.conflicts.map((c) => `${c.type}: ${esc(c.detail)}`).join('\n');
      if (confirm(`${t('conflictDetected')}\n${msgs}\n\n${t('forceSave')}?`)) return window.addSession(true);
      return;
    }
    toast('⚠ ' + e.message);
  }
};
ACTIONS.addSession = () => window.addSession(false);
ACTIONS.delSession = (el) => window.delSession(Number(el.dataset.id));
window.delSession = async (id) => {
  if (!confirm(t('delete') + '?')) return;
  try { await api('DELETE', `/api/schedules/${id}`); toast('✓'); routeView(); }
  catch (e) { toast('⚠ ' + e.message); }
};

// ---------- pages: super admin — message log ----------
async function pageMessages(view) {
  const rows = await get('/api/super/message-log?limit=200');
  view.innerHTML = `
    <h2 class="page-title">📨 ${t('msgLog')}</h2>` + (rows.length
      ? `<div class="table-wrap" style="max-height:600px;overflow:auto"><table>
      <tr><th>${t('date')}</th><th>${t('channel')}</th><th>${t('recipient')}</th><th>${t('status')}</th><th>${t('tenantsM')}</th><th>${t('name')}</th></tr>
      ${rows.map((m) => `<tr>
        <td><small>${esc(String(m.created_at).slice(0, 16).replace('T', ' '))}</small></td>
        <td><span class="badge blue">${esc(m.channel)}</span></td>
        <td>${esc(m.recipient)}</td>
        <td>${badge(m.status === 'sent' ? 'paid' : m.status === 'failed' ? 'overdue' : 'due')}</td>
        <td>${esc(m.tenant_name || '-')}</td>
        <td><small>${esc(String(m.body || m.subject || '').slice(0, 60))}</small></td></tr>`).join('')}
    </table></div>` : `<div class="empty">${t('noData')}</div>`);
}

// ---------- pages: super admin — settings (platform config) ----------
async function pageSettings(view) {
  view.innerHTML = `<h2 class="page-title">⚙️ ${t('settings')}</h2><div id="pf-settings"><div class="empty">…</div></div>`;
  const s = await get('/api/super/settings');
  const sw = (id, label, on) => `<div><label>${label}</label>
    <select id="${id}"><option value="true" ${on ? 'selected' : ''}>${t('enabled')}</option>
    <option value="false" ${!on ? 'selected' : ''}>${t('disabled')}</option></select></div>`;
  const inp = (id, label, val, type = 'text') => `<div><label>${label}</label><input id="${id}" type="${type}" value="${val === '__SET__' ? '' : esc(val ?? '')}" placeholder="${val === '__SET__' ? '•••• (saved)' : ''}"></div>`;
  $('#pf-settings').innerHTML = `
    <div class="card">
      <h3 class="section-title" style="margin-top:0">🏢 ${t('signupTitle')}</h3>
      <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
        ${sw('st-signup-enabled', t('enabled'), s.signup_enabled)}
        <div><label>${t('signupModeLabel')}</label><select id="st-signup-mode">
          <option value="manual" ${s.signup_mode === 'manual' ? 'selected' : ''}>${t('manualApproval')}</option>
          <option value="instant" ${s.signup_mode === 'instant' ? 'selected' : ''}>${t('instantTrial')}</option>
        </select></div>
        ${inp('st-trial-days', t('trialDaysLabel'), s.trial_days, 'number')}
        <div><label>${t('planLabel')}</label><select id="st-default-plan">
          ${['basic', 'standard', 'premium'].map((p) => `<option value="${p}" ${s.default_plan === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select></div>
      </div>
    </div>
    <div class="card" style="margin-top:12px">
      <h3 class="section-title" style="margin-top:0">💳 ${t('paymentsCfg')}</h3>
      <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
        <div><label>${t('gateway')}</label><select id="st-gateway">
          <option value="manual" ${s.payment_gateway === 'manual' ? 'selected' : ''}>Manual (wallet/transfer)</option>
          <option value="paymob" ${s.payment_gateway === 'paymob' ? 'selected' : ''}>Paymob</option>
          <option value="stripe" ${s.payment_gateway === 'stripe' ? 'selected' : ''}>Stripe</option>
        </select></div>
        ${inp('st-gw-key', 'API key', s.gateway_api_key)}
        ${inp('st-gw-int', 'Integration ID (Paymob)', s.gateway_integration_id)}
        ${inp('st-gw-wallet', t('walletNumber'), s.gateway_wallet_number)}
      </div>
    </div>
    <div class="card" style="margin-top:12px">
      <h3 class="section-title" style="margin-top:0">📨 ${t('notificationsCfg')}</h3>
      <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
        ${sw('st-email-enabled', t('emailCfg'), s.email_enabled)}
        ${inp('st-smtp-host', 'SMTP host', s.smtp_host)}
        ${inp('st-smtp-port', 'SMTP port', s.smtp_port, 'number')}
        ${inp('st-smtp-user', 'SMTP user', s.smtp_user)}
        ${inp('st-smtp-pass', 'SMTP password', s.smtp_pass)}
        ${inp('st-email-from', 'From address', s.email_from)}
        ${sw('st-sms-enabled', t('smsCfg'), s.sms_enabled)}
        <div><label>SMS provider</label><select id="st-sms-provider">
          <option value="konnecthub" ${s.sms_provider === 'konnecthub' ? 'selected' : ''}>KonnectHub</option>
          <option value="twilio" ${s.sms_provider === 'twilio' ? 'selected' : ''}>Twilio</option>
        </select></div>
        ${inp('st-sms-key', 'SMS API key', s.sms_api_key)}
        ${inp('st-sms-sender', 'Sender ID', s.sms_sender_id)}
        ${sw('st-wa-enabled', t('whatsappCfg'), s.whatsapp_enabled)}
        ${inp('st-wa-token', 'WhatsApp token', s.whatsapp_token)}
        ${inp('st-wa-phone', 'WhatsApp phone ID', s.whatsapp_phone_id)}
      </div>
    </div>
    <div class="card" style="margin-top:12px">
      <h3 class="section-title" style="margin-top:0">⏰ ${t('remindersCfg')}</h3>
      <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
        ${inp('st-rem-days', t('feeReminderDays'), s.reminder_fee_days, 'number')}
        ${sw('st-rem-overdue', t('overdueReminders'), s.reminder_overdue)}
        ${sw('st-rem-absence', t('absenceAlerts'), s.reminder_absence)}
        ${inp('st-rem-hour', 'Send hour (UTC)', s.reminder_hour_utc, 'number')}
      </div>
      <button class="btn full accent" data-act="savePlatformSettings">💾 ${t('save')}</button>
    </div>
    <div class="card" style="margin-top:16px;max-width:460px">
      <h3 class="section-title" style="margin-top:0">🔐 ${t('changeOwnPassword')}</h3>
      <label>${t('currentPassword')}</label><input id="cp-cur" type="password" autocomplete="current-password">
      <label>${t('newPassword')}</label><input id="cp-new" type="password" autocomplete="new-password" placeholder="8+ chars, Aa1">
      <button class="btn full" data-act="changeMyPassword">${t('save')}</button>
    </div>`;
}
window.savePlatformSettings = async () => {
  const g = (id) => { const el = $(id); return el ? el.value.trim() : undefined; };
  const body = {
    signup_enabled: g('#st-signup-enabled') === 'true',
    signup_mode: g('#st-signup-mode'),
    trial_days: Number(g('#st-trial-days')) || 14,
    default_plan: g('#st-default-plan'),
    payment_gateway: g('#st-gateway'),
    gateway_integration_id: g('#st-gw-int') || null,
    gateway_wallet_number: g('#st-gw-wallet') || null,
    email_enabled: g('#st-email-enabled') === 'true',
    smtp_host: g('#st-smtp-host') || null, smtp_port: Number(g('#st-smtp-port')) || 587,
    smtp_user: g('#st-smtp-user') || null,
    email_from: g('#st-email-from') || null,
    sms_enabled: g('#st-sms-enabled') === 'true',
    sms_provider: g('#st-sms-provider'),
    sms_sender_id: g('#st-sms-sender') || null,
    whatsapp_enabled: g('#st-wa-enabled') === 'true',
    whatsapp_phone_id: g('#st-wa-phone') || null,
    reminder_fee_days: Number(g('#st-rem-days')) || 0,
    reminder_overdue: g('#st-rem-overdue') === 'true',
    reminder_absence: g('#st-rem-absence') === 'true',
    reminder_hour_utc: Number(g('#st-rem-hour')) || 8,
  };
  // secrets: only send when the admin typed something new
  for (const [k, id] of [['gateway_api_key', '#st-gw-key'], ['smtp_pass', '#st-smtp-pass'],
    ['sms_api_key', '#st-sms-key'], ['whatsapp_token', '#st-wa-token']]) {
    const v = g(id);
    if (v) body[k] = v;
  }
  try { await patch('/api/super/settings', body); toast('✓'); }
  catch (e) { toast('⚠ ' + e.message); }
};

render();
