/**
 * QA smoke test suite — exercises key flows & security checks.
 * Run with server up: node server/src/smoke.js
 */
const BASE = process.env.API_URL || 'http://localhost:3000';

let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
};

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function main() {
  const DEMO_PW = process.env.DEMO_PW || 'Edu@Demo-2026';
  console.log('== Auth ==');
  // Client owner accounts are no longer seeded — use finance staff for tenant-scoped checks.
  // (Create a client admin via the super admin portal to test the owner role.)
  const staff = await api('POST', '/api/auth/login', { identifier: 'elite-finance', password: DEMO_PW });
  ok('staff login', staff.status === 200 && staff.json.token);
  const ownerT = staff.json?.token;
  const staff2 = await api('POST', '/api/auth/login', { identifier: 'fl-reception', password: DEMO_PW });
  ok('second tenant staff login', staff2.status === 200);
  const flT = staff2.json?.token;
  const bad = await api('POST', '/api/auth/login', { identifier: 'elite-finance', password: 'wrong' });
  ok('wrong password rejected', bad.status === 401);

  // find teacher / parent / student users via DB-ish API (use search as staff)
  console.log('== Teacher role ==');
  const teacherLogin = await api('POST', '/api/auth/login', { identifier: 'elite-ahmed.samir', password: DEMO_PW });
  ok('teacher login', teacherLogin.status === 200);
  const teacherT = teacherLogin.json?.token;
  const tToday = await api('GET', '/api/attendance/today', null, teacherT);
  ok('teacher today classes', tToday.status === 200 && Array.isArray(tToday.json), `got ${tToday.status}`);
  const tStudentsAll = await api('GET', '/api/students', null, teacherT);
  ok('teacher can list students (staff)', tStudentsAll.status === 200);

  console.log('== Parent isolation ==');
  // parent usernames: par_elite_N
  let parentT = null, parentId = null;
  for (let i = 1; i <= 15; i++) {
    const r = await api('POST', '/api/auth/login', { identifier: `par_elite_${i}`, password: DEMO_PW });
    if (r.status === 200) { parentT = r.json.token; break; }
  }
  ok('parent login', !!parentT);
  if (parentT) {
    const dash = await api('GET', '/api/dashboard/parent', null, parentT);
    ok('parent dashboard', dash.status === 200 && Array.isArray(dash.json.children));
    const kids = dash.json.children;
    if (kids.length) {
      const child = await api('GET', `/api/portal/parent/children/${kids[0].id}`, null, parentT);
      ok('parent sees own child detail', child.status === 200 && child.json.profile);
      // cross-tenant isolation: try to view a student from tenant 2
      const foreign = await api('GET', '/api/portal/parent/children/999999', null, parentT);
      ok('parent cannot view unknown child', foreign.status === 403 || foreign.status === 404, `got ${foreign.status}`);
      // parent cannot access staff endpoints
      const fin = await api('GET', '/api/fees/summary', null, parentT);
      ok('parent blocked from finance API', fin.status === 403, `got ${fin.status}`);
    }
  }

  console.log('== Student role ==');
  let studentT = null;
  for (let i = 1; i <= 20; i++) {
    const r = await api('POST', '/api/auth/login', { identifier: `stu_elite_${i}`, password: DEMO_PW });
    if (r.status === 200) { studentT = r.json.token; break; }
  }
  ok('student login', !!studentT);
  if (studentT) {
    const dash = await api('GET', '/api/dashboard/student', null, studentT);
    ok('student dashboard', dash.status === 200);
    const hw = await api('GET', '/api/portal/student/homework', null, studentT);
    ok('student homework list', hw.status === 200 && Array.isArray(hw.json));
    const stu = await api('GET', '/api/students', null, studentT);
    ok('student blocked from staff list', stu.status === 403, `got ${stu.status}`);
  }

  console.log('== Tenant isolation ==');
  const e1 = (await api('GET', '/api/students?limit=1000', null, ownerT)).json;
  const e2 = (await api('GET', '/api/students?limit=1000', null, flT)).json;
  const s1 = new Set(e1.map((s) => s.id));
  const overlap = e2.filter((s) => s1.has(s.id));
  ok('no student overlap between tenants', overlap.length === 0, `${overlap.length} leaked`);
  const cross = await api('GET', `/api/students/${e1[0].id}`, null, flT);
  ok('tenant2 cannot fetch tenant1 student', cross.status === 404, `got ${cross.status}`);

  console.log('== Management data ==');
  const cfg = await api('GET', '/api/config', null, ownerT);
  ok('config loads', cfg.status === 200 && cfg.json.subjects?.length > 0);
  const groups = await api('GET', '/api/groups', null, ownerT);
  ok('groups list with capacity', groups.status === 200 && groups.json[0]?.enrolled >= 0);
  const g1 = groups.json[0];
  const roster = await api('GET', `/api/attendance/group/${g1.id}/2026-08-10`, null, ownerT);
  ok('attendance roster', roster.status === 200 && roster.json.length > 0);

  // mark attendance for a unique past date (idempotent re-runs)
  const markDate = new Date(Date.now() - Math.floor(Math.random() * 100) * 86400000 - 86400000).toISOString().slice(0, 10);
  const recs = roster.json.slice(0, 5).map((r, i) => ({ student_id: r.id, status: i === 1 ? 'absent' : i === 2 ? 'late' : 'present' }));
  const mark = await api('POST', '/api/attendance/mark', { group_id: g1.id, session_date: markDate, records: recs }, ownerT);
  ok('attendance marking', mark.status === 200 && mark.json.marked === 5, JSON.stringify(mark.json));
  const dup = await api('POST', '/api/attendance/mark', { group_id: g1.id, session_date: markDate, records: recs }, ownerT);
  ok('duplicate attendance ignored', dup.status === 200 && dup.json.marked === 0, JSON.stringify(dup.json));

  const insights = await api('GET', '/api/insights/risk', null, ownerT);
  ok('risk engine returns data', insights.status === 200 && Array.isArray(insights.json), `got ${insights.status}`);
  const followup = await api('GET', '/api/insights/followup-list', null, ownerT);
  ok('follow-up list', followup.status === 200);
  const finSum = await api('GET', '/api/fees/summary', null, ownerT);
  ok('finance summary', finSum.status === 200 && finSum.json.expected > 0, JSON.stringify(finSum.json));
  const leadsStats = await api('GET', '/api/leads/stats', null, ownerT);
  ok('lead stats', leadsStats.status === 200 && leadsStats.json.totals?.total_leads > 0);
  const report = await api('GET', '/api/reports/outstanding', null, ownerT);
  ok('outstanding report', report.status === 200 && Array.isArray(report.json));
  const csv = await fetch(BASE + '/api/reports/students?format=csv', { headers: { Authorization: `Bearer ${ownerT}` } });
  ok('CSV export', csv.status === 200 && (await csv.text()).includes('name'));
  const search = await api('GET', '/api/search?q=ahmed', null, ownerT);
  ok('global search', search.status === 200);

  console.log('== Gradebook ==');
  const grades = (await api('GET', '/api/portal/student/grades', null, studentT)).json;
  ok('student grades visible', Array.isArray(grades));

  const term = cfg.json.terms.find((t) => t.is_current) || cfg.json.terms[0];
  if (studentT) {
    const me = (await api('GET', '/api/portal/student/me', null, studentT)).json;
    const gb = await api('GET', `/api/gradebook?student_id=${me.id}&term_id=${term.id}`, null, studentT);
    ok('gradebook for own student', gb.status === 200 && typeof gb.json.final_average !== 'undefined', JSON.stringify(gb.json).slice(0, 200));
  }

  console.log(`\n== RESULT: ${passed} passed, ${failed} failed ==`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('smoke crashed:', e); process.exit(1); });
