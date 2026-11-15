/**
 * UAT of the epic "Quy trinh & han xu ly theo Loai thong tin", through the real HTTP API, on a LOCAL stack only.
 *
 *   E2E_DB=postgresql://postgres:postgres@127.0.0.1:5433/pc02_uat_quy_trinh \
 *   E2E_BASE=http://127.0.0.1:3916/api/v1 node tools/uat-quy-trinh/workflow.cjs
 *
 * The backend must run against that same database with FEATURE_FLAG_CACHE_TTL_MS=1000 (the switch contract is
 * checked by flipping the three switches; with the default 30 s cache the waits below are too short).
 *
 * ORACLE: every expected value comes from the plan (decisions C1-C16, R3-R11, the owner's rules) or is computed here
 * (the calendar arithmetic below is this script's own). Nothing expected is read back from the product.
 *
 * Direct SQL is used only for set-up the API cannot do: accounts, teams, the information-type entries, the three
 * feature switches, marking one case RESTRICTED, and reading row counts around the CLI dry run. REFUSES any address that is not local.
 * NEEDS A FRESH DATABASE: the run creates the default flows of the incident and case kinds and leaves its records
 * behind, so a second run on the same database would judge the leftovers. It stops at once when it finds them.
 * Build order: db push, `node tools/uat-quy-trinh/install-triggers.cjs`, the seeds, then the backend.
 * Every check prints PASS | FAIL | NOT RUN with its requirement id. A NOT RUN is never a pass. Exit 0 = no FAIL.
 */
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3916/api/v1';
const DB_URL = process.env.E2E_DB;
const BACKEND = path.join(__dirname, '../../backend');
const SWITCH_WAIT_MS = Number(process.env.UAT_SWITCH_WAIT_MS || 13_000);

function isLocal(url) {
  try {
    const h = new URL(url).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
  } catch {
    return false;
  }
}
if (!DB_URL) {
  console.error('Set E2E_DB (see the header of this file).');
  process.exit(2);
}
if (!isLocal(BASE) || !isLocal(DB_URL)) {
  console.error('REFUSED: the address is not local; this script writes data and flips feature switches.');
  process.exit(2);
}

const bcrypt = require(path.join(BACKEND, 'node_modules/bcrypt'));
const { Client } = require(path.join(BACKEND, 'node_modules/pg'));

const RUN = randomUUID().slice(0, 8);
const TAG = `uat-qt-${RUN}`;
const PASSWORD = `Uat-${randomUUID()}!`;
const SWITCHES = ['processing_flow', 'processing_flow_records', 'processing_flow_reminders'];
const MODE_KEY = 'QUYEN_THEO_TO_CHE_DO';
// The list screens apply the default statistics period (the current month) unless the page sends its own: the UI's period picker.
const PERIOD = '&fromDate=2026-01-01&toDate=2026-12-31';
const OFFICER_KEYS = [
  'read:Petition', 'write:Petition', 'edit:Petition', 'read:Incident', 'write:Incident', 'edit:Incident', 'read:Case', 'write:Case', 'edit:Case',
  'read:ProcessingStep', 'report:ProcessingStep', 'opine:ProcessingStep', 'complete:ProcessingStep',
];

// ── results ─────────────────────────────────────────────────────────────────────────────────────────────────────
const results = [];
let seq = 0;
const short = (v) => (typeof v === 'string' ? v : JSON.stringify(v) ?? String(v)).slice(0, 700);
function record(req, name, status, detail) {
  seq += 1;
  const id = `QT-${String(seq).padStart(3, '0')}`;
  results.push({ id, req, name, status });
  console.log(`${status.padEnd(7)} ${id} [${req}] ${name}${status === 'PASS' || detail === undefined ? '' : `\n          -> ${short(detail)}`}`);
}
const check = (req, name, ok, detail) => record(req, name, ok ? 'PASS' : 'FAIL', detail);
const notRun = (req, name, reason) => record(req, name, 'NOT RUN', reason);
/** A check of a route that may not be merged yet: 404 on the route itself = NOT RUN, never a pass. */
function pending(req, name, res, judge) {
  if (res.status === 404 && !res.body?.code) return notRun(req, `PENDING-MERGE ${name}`, `NOT RUN: route absent (HTTP 404 ${short(res.body?.message ?? '')})`);
  return check(req, name, judge(res), [res.status, res.body]);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── HTTP ────────────────────────────────────────────────────────────────────────────────────────────────────────
async function login(username) {
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: PASSWORD }) });
  const body = await res.json().catch(() => null);
  return body?.accessToken ?? body?.data?.accessToken ?? '';
}
async function call(token, method, url, body) {
  const res = await fetch(`${BASE}${url}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body: json, text, headers: res.headers };
}
const refused = (res, code) => res.status >= 400 && res.status < 500 && JSON.stringify(res.body ?? '').includes(code);
const rowsOf = (body) => body?.data ?? body?.items ?? body?.rows ?? (Array.isArray(body) ? body : []);

// ── the script's own calendar arithmetic (Vietnam = UTC+7, no daylight saving) ──────────────────────────────────
const VN = 7 * 3600 * 1000;
const DAY = 24 * 3600 * 1000;
const dayNo = (ymd) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / DAY);
const ymdOf = (n) => new Date(n * DAY).toISOString().slice(0, 10);
const vnMidnight = (ymd) => dayNo(ymd) * DAY - VN; // the instant 00:00 Vietnam time of that civil day
const vnDayOf = (instant) => ymdOf(Math.floor((instant + VN) / DAY));
const addDays = (ymd, n) => ymdOf(dayNo(ymd) + n);
const HOLIDAYS = ['2026-04-30', '2026-05-01']; // entered below through the calendar API
const isWorking = (ymd) => { const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay(); return dow !== 0 && dow !== 6 && !HOLIDAYS.includes(ymd); };
function addWorkingDays(ymd, n) { let d = ymd; for (let left = n; left > 0; ) { d = addDays(d, 1); if (isWorking(d)) left -= 1; } return d; }
function addMonths(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
/** "The end of that civil day in Vietnam": the last second of the day, or the midnight that closes it. */
const endsDay = (iso, ymd) => { if (!iso) return false; const t = Date.parse(iso); const end = vnMidnight(addDays(ymd, 1)); return t > end - 1000 - 1 && t <= end; };
const iso = (ms) => new Date(ms).toISOString();
/** Owner's rule: remaining > green: none; green >= remaining > yellow: GREEN; yellow >= remaining > red: YELLOW; remaining <= red: RED; past the deadline: OVERDUE. */
function expectedBand(asOfMs, dueMs, dueDay, t) {
  if (asOfMs > dueMs) return 'OVERDUE';
  const remaining = dayNo(dueDay) - dayNo(vnDayOf(asOfMs));
  if (remaining <= t.redDays) return 'RED';
  if (remaining <= t.yellowDays) return 'YELLOW';
  if (remaining <= t.greenDays) return 'GREEN';
  return 'NONE';
}

// ── set-up and clean-up (SQL: only what the API cannot do) ──────────────────────────────────────────────────────
const TEAMS = ['x', 'y', 'c', 'i', 'z', 'l'].map((k) => `${TAG}-team-${k}`);
const [TX, TY, TC, TI, TZ, TL] = TEAMS;
const TYPE_BOUND = `UAT ${RUN} loại có quy trình`;
let CRIME_ID = null; // an entry of the seeded crime catalogue: the petition form requires one
async function seed(pg) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const admin = (await pg.query(`SELECT "id" FROM "roles" WHERE "name" = 'ADMIN'`)).rows[0]?.id;
  if (!admin) throw new Error('No ADMIN role: run the seed first');
  // The administrator of a fresh local database holds every permission the application knows.
  await pg.query(`INSERT INTO "role_permissions" ("roleId","permissionId") SELECT $1, "id" FROM "permissions" ON CONFLICT DO NOTHING`, [admin]);
  await pg.query(`INSERT INTO "roles" ("id","name","updatedAt") VALUES ($1,$2,now())`, [`${TAG}-officer-role`, `${TAG}-OFFICER`]);
  await pg.query(`INSERT INTO "role_permissions" ("roleId","permissionId") SELECT $1, "id" FROM "permissions" WHERE "action" || ':' || "subject" = ANY($2)`, [`${TAG}-officer-role`, OFFICER_KEYS]);
  for (const id of TEAMS) await pg.query(`INSERT INTO "teams" ("id","name","code","updatedAt") VALUES ($1,$2,$1,now())`, [id, `UAT ${RUN} ${id.slice(-1).toUpperCase()}`]);
  const people = [[`${TAG}-admin`, admin, null], [`${TAG}-admin2`, admin, null], [`${TAG}-ul`, `${TAG}-officer-role`, TL], [`${TAG}-ui`, `${TAG}-officer-role`, TI], [`${TAG}-ux`, `${TAG}-officer-role`, TX], [`${TAG}-uy`, `${TAG}-officer-role`, TY], [`${TAG}-uz`, `${TAG}-officer-role`, TZ]];
  for (const [id, role, team] of people) {
    await pg.query(`INSERT INTO "users" ("id","username","email","passwordHash","roleId","isActive","twoFaSetupRequired","updatedAt") VALUES ($1,$1,$2,$3,$4,true,false,now())`, [id, `${id}@local.test`, hash, role]);
    if (team) await pg.query(`INSERT INTO "user_teams" ("userId","teamId","isLeader") VALUES ($1,$2,true)`, [id, team]);
  }
  // The leadership person also belongs to an ordinary team (decision C3: rights are the union of the teams).
  await pg.query(`INSERT INTO "user_teams" ("userId","teamId","isLeader") VALUES ($1,$2,false)`, [`${TAG}-ul`, TZ]);
  CRIME_ID = (await pg.query(`SELECT "id" FROM "crimes" ORDER BY "id" LIMIT 1`)).rows[0]?.id ?? null;
  await pg.query(`INSERT INTO "directories" ("id","type","code","name","updatedAt") VALUES ($1,'LOAI_THONG_TIN',$1,$2,now())`, [`${TAG}-type`, TYPE_BOUND]);
}
async function setSwitches(pg, on) {
  await pg.query(`UPDATE "feature_flags" SET "enabled" = $1 WHERE "key" = ANY($2)`, [on, SWITCHES]);
  await sleep(SWITCH_WAIT_MS); // the server re-reads its switches on a short interval
}
async function cleanUp(pg, before, modeBefore) {
  const like = `${TAG}-%`;
  const tryQuery = (sql, args) => pg.query(sql, args).catch((err) => console.log(`clean-up skipped: ${String(err.message).slice(0, 120)}`));
  if (modeBefore === null) await tryQuery(`DELETE FROM "system_settings" WHERE "key" = $1`, [MODE_KEY]);
  else await tryQuery(`UPDATE "system_settings" SET "value" = $2 WHERE "key" = $1`, [MODE_KEY, modeBefore]);
  for (const row of before) await tryQuery(`UPDATE "feature_flags" SET "enabled" = $2 WHERE "key" = $1`, [row.key, row.enabled]);
  // The records and flows of this run stay in the scratch database (they are tagged with the run id); the accounts
  // are switched off so nothing can log in with them. The database is dropped and recreated by the next set-up.
  await tryQuery(`UPDATE "users" SET "isActive" = false WHERE "id" LIKE $1`, [like]);
}

// ── the workflow ────────────────────────────────────────────────────────────────────────────────────────────────
const party = (teamId, role) => ({ partyKind: 'TEAM', teamId, role });
const T2 = { redDays: 1, yellowDays: 3, greenDays: 5 };
const RECEIVED = '2026-04-27'; // a Monday; 30/4 and 1/5 are holidays, 2-3/5 a weekend
const stepsOf = () => [
  { name: 'B1 phân loại (giờ)', durationValue: 48, durationUnit: 'HOUR', anchor: 'RECEIVED', redDays: 0, yellowDays: 1, greenDays: 2, parties: [party(TX, 'MAIN')] },
  { name: 'B2 xác minh (ngày)', durationValue: 10, durationUnit: 'DAY', anchor: 'RECEIVED', rollToWorkingDay: false, ...T2, legalBasis: 'Luật Tố cáo Điều 30', legalDocNumber: '25/2018/QH14', legalDocUrl: 'https://example.test/luat', parties: [party(TX, 'MAIN'), party(TY, 'COORDINATE'), party(TC, 'CHECK'), party(TI, 'INFORM')] },
  { name: 'B3 phối hợp (ngày làm việc)', durationValue: 5, durationUnit: 'WORKING_DAY', anchor: 'RECEIVED', redDays: 1, yellowDays: 2, greenDays: 3, parties: [party(TX, 'MAIN')] },
  { name: 'B4 kết luận (tháng)', durationValue: 2, durationUnit: 'MONTH', anchor: 'RECEIVED', rollToWorkingDay: false, redDays: 2, yellowDays: 5, greenDays: 10, setsRecordDeadline: true, requiresApproval: true, maxExtensions: 1, extensionValue: 1, extensionUnit: 'MONTH', legalBasis: 'Luật Tố cáo Điều 30 (UAT)', legalDocNumber: '25/2018/QH14', parties: [party(TX, 'MAIN')] },
  { name: 'B5 lưu hồ sơ (sau bước trước)', durationValue: 3, durationUnit: 'DAY', anchor: 'PREVIOUS_STEP_DONE', rollToWorkingDay: false, redDays: 0, yellowDays: 1, greenDays: 2, parties: [party(TX, 'MAIN')] },
];

async function workflow(pg) {
  const admin = await login(`${TAG}-admin`);
  const ux = await login(`${TAG}-ux`);
  const uy = await login(`${TAG}-uy`);
  const uz = await login(`${TAG}-uz`);
  check('SETUP', 'quản trị và ba cán bộ của ba tổ đăng nhập được', admin && ux && uy && uz, [!!admin, !!ux, !!uy, !!uz]);
  if (!admin) return;

  // ── C16 (first half): everything off ──────────────────────────────────────────────────────────────────────────
  const offFlows = await call(admin, 'GET', '/processing-flows');
  check('C16', 'công tắc TẮT: route cài quy trình trả 404', offFlows.status === 404, [offFlows.status, offFlows.body]);
  const offList = await call(admin, 'GET', '/petitions?limit=5');
  check('C16', 'công tắc TẮT: danh sách đơn thư vẫn trả lời', offList.status === 200, [offList.status, offList.body]);
  await setSwitches(pg, true);

  // ── working calendar (C11) ────────────────────────────────────────────────────────────────────────────────────
  const year = await call(admin, 'GET', '/processing-calendar/years/2026');
  const stored = year.body?.stored ?? null;
  const days = [...(stored?.days ?? []).filter((d) => !HOLIDAYS.includes(d.date)).map((d) => ({ date: d.date, kind: d.kind, label: d.label ?? null })), ...HOLIDAYS.map((date) => ({ date, kind: 'OFF', label: 'UAT' }))];
  const saved = await call(admin, 'PUT', '/processing-calendar/years/2026', { weekendDays: stored?.weekendDays ?? [0, 6], days, note: 'UAT', expected: stored ? { id: stored.id, revision: stored.revision } : null });
  check('C11', 'quản trị nhập ngày nghỉ 30/4 và 1/5 vào lịch làm việc 2026', saved.status === 200, [saved.status, saved.body]);
  const yearNow = (await call(admin, 'GET', '/processing-calendar/years/2026')).body?.stored;
  if (yearNow && yearNow.status !== 'CONFIRMED') {
    const confirmed = await call(admin, 'POST', '/processing-calendar/years/2026/confirm', { expected: { id: yearNow.id, revision: yearNow.revision } });
    check('C11', 'người có quyền xác nhận lịch năm 2026', confirmed.status === 200, [confirmed.status, confirmed.body]);
  }

  // ── configuration (design 1, D09) ─────────────────────────────────────────────────────────────────────────────
  const created = await call(admin, 'POST', '/processing-flows', { name: `UAT ${RUN} tố cáo`, recordKind: 'PETITION' });
  const flowId = created.body?.id ?? created.body?.flow?.id;
  check('CFG-CREATE', 'tạo một quy trình cho Đơn thư', created.status === 201 && !!flowId, [created.status, created.body]);
  if (!flowId) return;
  const flow = async () => (await call(admin, 'GET', `/processing-flows/${flowId}`)).body;
  const versionsOf = (f) => f?.versions ?? [];
  const draftOf = (f) => f?.draft ?? null;
  let f = await flow();
  let draft = draftOf(f);
  check('CFG-CREATE', 'quy trình mới có một bản nháp để sửa', !!draft, f);
  if (!draft) return;
  const put = async (steps) => { f = await flow(); draft = draftOf(f); return call(admin, 'PUT', `/processing-flows/${flowId}/versions/${draft.id}/steps`, { steps, expectedRevision: draft.revision }); };
  const publish = async () => { f = await flow(); draft = draftOf(f); return call(admin, 'POST', `/processing-flows/${flowId}/versions/${draft.id}/publish`, { expectedRevision: draft.revision }); };
  const refusedAtSaveOrPublish = async (steps, code) => {
    const s = await put(steps);
    if (refused(s, code)) return { ok: true, at: 'save', res: s };
    const p = await publish();
    return { ok: refused(p, code), at: 'publish', res: p, save: [s.status, s.body] };
  };
  const mutate = (fn) => { const steps = stepsOf(); fn(steps); return steps; };

  let bad = await refusedAtSaveOrPublish(mutate((s) => { s[1].parties.push(party(TZ, 'MAIN')); }), 'STEP_NEEDS_ONE_MAIN');
  check('CFG-PUBLISH', 'xuất bản bị từ chối: một bước có HAI đơn vị xử lý chính', bad.ok, bad);
  bad = await refusedAtSaveOrPublish(mutate((s) => { s[1].parties = [party(TY, 'COORDINATE')]; }), 'STEP_NEEDS_ONE_MAIN');
  check('CFG-PUBLISH', 'xuất bản bị từ chối: một bước KHÔNG có đơn vị xử lý chính', bad.ok, bad);
  bad = await refusedAtSaveOrPublish(mutate((s) => { Object.assign(s[1], { redDays: 5, yellowDays: 3, greenDays: 1 }); }), 'THRESHOLDS');
  check('CFG-PUBLISH', 'xuất bản bị từ chối: ngưỡng không giảm dần (Xanh < Vàng < Đỏ)', bad.ok, bad);
  bad = await refusedAtSaveOrPublish(mutate((s) => { s[0].anchor = 'PROPOSED'; }), 'HOUR_ANCHOR_HAS_NO_TIME');
  check('CFG-PUBLISH', 'xuất bản bị từ chối: bước tính theo giờ với mốc ngày đề xuất (không có giờ)', bad.ok, bad);
  bad = await refusedAtSaveOrPublish(mutate((s) => { s[2].setsRecordDeadline = true; }), 'MULTIPLE_RECORD_DEADLINE_STEPS');
  check('CFG-PUBLISH', 'xuất bản bị từ chối: hai bước cùng là hạn chung của hồ sơ', bad.ok, bad);

  const goodSave = await put(stepsOf());
  check('CFG-STEPS', 'lưu 5 bước: 4 đơn vị tính, 4 vai trò, ngưỡng, căn cứ pháp lý, mốc', goodSave.status === 200, [goodSave.status, goodSave.body]);
  const published = await publish();
  check('CFG-PUBLISH', 'xuất bản bản hợp lệ', published.status === 200, [published.status, published.body]);
  f = await flow();
  const live = f?.published ?? null;
  const liveSteps = live?.steps ?? [];
  check('CFG-STEPS', 'bản đã xuất bản giữ đủ 5 bước, đủ 4 vai trò ở bước 2 và căn cứ pháp lý', liveSteps.length === 5 && ['MAIN', 'COORDINATE', 'CHECK', 'INFORM'].every((r) => liveSteps[1]?.parties?.some((p) => p.role === r)) && liveSteps[1]?.legalDocNumber === '25/2018/QH14', live);
  const keys = liveSteps.map((s) => s.stepKey);
  if (live) {
    const edit = await call(admin, 'PUT', `/processing-flows/${flowId}/versions/${live.id}/steps`, { steps: stepsOf().slice(0, 2), expectedRevision: live.revision });
    check('D09', 'bản đã xuất bản không sửa được', refused(edit, 'VERSION_IMMUTABLE'), [edit.status, edit.body]);
    const newDraft = await call(admin, 'POST', `/processing-flows/${flowId}/versions`);
    f = await flow();
    check('D09', 'sửa = tạo bản nháp mới, bản đang chạy vẫn nguyên', (newDraft.status === 201 || newDraft.status === 200) && !!draftOf(f) && versionsOf(f).some((v) => v.id === live.id && v.status === 'PUBLISHED'), [newDraft.status, newDraft.body]);
    const d = draftOf(f);
    if (d) {
      const gone = await call(admin, 'DELETE', `/processing-flows/${flowId}/versions/${d.id}?expectedRevision=${d.revision}`);
      check('TAO-SUA-XOA', 'bản nháp vừa tạo xoá được', gone.status === 200, [gone.status, gone.body]);
    }
  }
  f = await flow();
  const bound = await call(admin, 'PUT', `/processing-flows/${flowId}/bindings`, { directoryIds: [`${TAG}-type`], deadlineGroups: [], expectedRevision: f.revision });
  check('CFG-BIND', 'gắn quy trình với một Loại thông tin', bound.status === 200, [bound.status, bound.body]);
  f = await flow();
  const archived = await call(admin, 'POST', `/processing-flows/${flowId}/archive`, { expectedRevision: f.revision });
  f = await flow();
  const restored = await call(admin, 'POST', `/processing-flows/${flowId}/restore`, { expectedRevision: f?.revision });
  f = await flow();
  check('CFG-ARCHIVE', 'lưu trữ ⇄ khôi phục', archived.status === 200 && restored.status === 200 && f?.status === 'ACTIVE', [archived.status, archived.body, restored.status, restored.body]);

  // a default flow for incidents (C10 needs one to propose)
  const inc = await call(admin, 'POST', '/processing-flows', { name: `UAT ${RUN} vụ việc mặc định`, recordKind: 'INCIDENT', isDefault: true });
  // A scratch database that an earlier run used already has its default: use that one.
  const incFlowId = inc.body?.id ?? inc.body?.flow?.id ?? rowsOf((await call(admin, 'GET', '/processing-flows?recordKind=INCIDENT')).body).find((x) => x.isDefault)?.id;
  const g = incFlowId ? (await call(admin, 'GET', `/processing-flows/${incFlowId}`)).body : null;
  if (g?.published) check('CFG-CREATE', 'quy trình mặc định cho Vụ việc được tạo và xuất bản', true);
  else if (incFlowId) {
    const d = draftOf(g);
    await call(admin, 'PUT', `/processing-flows/${incFlowId}/versions/${d?.id}/steps`, { steps: [{ name: 'Giải quyết tin báo', durationValue: 20, durationUnit: 'DAY', anchor: 'PROPOSED', redDays: 1, yellowDays: 3, greenDays: 5, setsRecordDeadline: true, parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }] }], expectedRevision: d?.revision });
    const g2 = (await call(admin, 'GET', `/processing-flows/${incFlowId}`)).body;
    const p = await call(admin, 'POST', `/processing-flows/${incFlowId}/versions/${d?.id}/publish`, { expectedRevision: g2.draft?.revision });
    check('CFG-CREATE', 'quy trình mặc định cho Vụ việc được tạo và xuất bản', p.status === 200, [inc.status, p.status, p.body]);
  } else check('CFG-CREATE', 'quy trình mặc định cho Vụ việc được tạo và xuất bản', false, [inc.status, inc.body]);

  // ── a petition with a bound information type: the flow appears by itself (C14) ────────────────────────────────
  const newPetition = (extra = {}) => call(admin, 'POST', '/petitions', { receivedDate: RECEIVED, gioTiepNhan: '09:30', senderName: `UAT ${RUN} người gửi`, loaiThongTin: TYPE_BOUND, assignedTeamId: TX, crimeChinhId: CRIME_ID, ngayDeXuat: RECEIVED, ...extra });
  const waitFlow = async (kind, id) => { for (let i = 0; i < 40; i++) { const r = await call(admin, 'GET', `/processing/records/${kind}/${id}`); if (r.status === 200) return r.body; await sleep(500); } return null; };
  const idOf = (res) => res.body?.id ?? res.body?.data?.id;
  const deadlineOf = async (kind, id) => { const r = await call(admin, 'GET', `/${kind}/${id}`); return r.body?.deadline ?? r.body?.data?.deadline ?? null; };
  const monthDue0 = addMonths(RECEIVED, 2);
  const onDay = (deadline, ymd) => !!deadline && (String(deadline).slice(0, 10) === ymd || vnDayOf(Date.parse(deadline) - 1) === ymd);
  // C11b: while the figures of the deadline step are not verified against the source text, the flow does not write the record's deadline.
  const p0 = await newPetition({ senderName: `UAT ${RUN} trước khi đối chiếu` });
  const p0flow = idOf(p0) ? await waitFlow('PETITION', idOf(p0)) : null;
  const p0deadline = idOf(p0) ? await deadlineOf('petitions', idOf(p0)) : null;
  check('C11b', `bước hạn chung CHƯA đối chiếu văn bản gốc: quy trình không ghi hạn chung của hồ sơ (không phải ${monthDue0})`, !!p0flow && endsDay(p0flow.steps[3]?.regulatoryDueAt, monthDue0) && !onDay(p0deadline, monthDue0), [p0.status, p0flow?.steps?.[3]?.regulatoryDueAt, p0deadline]);
  f = await flow();
  const verified = await call(admin, 'POST', `/processing-flows/${flowId}/versions/${f.published?.id}/steps/${keys[3]}/verify-legal`, { expectedRevision: f.published?.revision });
  check('C11b', 'người có quyền xác nhận đã đối chiếu căn cứ pháp lý của bước hạn chung', verified.status === 200, [verified.status, verified.body]);
  const pet = await newPetition();
  const petId = pet.body?.id ?? pet.body?.data?.id;
  check('C14', 'tạo Đơn thư có Loại thông tin đã gắn quy trình', pet.status === 201 && !!petId, [pet.status, pet.body]);
  if (!petId) return;
  const rec = `/processing/records/PETITION/${petId}`;
  const getFlow = async (token = admin) => call(token, 'GET', rec);
  let rf = null;
  for (let i = 0; i < 40 && !rf; i++) { const r = await getFlow(); if (r.status === 200) rf = r.body; else await sleep(500); }
  check('C14', 'quy trình tự xuất hiện trên hồ sơ (không ai bấm áp dụng)', !!rf && rf.steps?.length === 5, rf);
  if (!rf) return;
  check('C9', 'hồ sơ ghi lại khớp theo LOẠI và đã xác nhận', rf.match === 'TYPE' && rf.confirmed === true, [rf.match, rf.confirmed]);
  const step = (flowDto, n) => flowDto.steps.find((s) => s.stepKey === keys[n]) ?? flowDto.steps[n];
  const hourDue = vnMidnight(RECEIVED) + 9.5 * 3600 * 1000 + 48 * 3600 * 1000;
  check('DUE-HOUR', `hạn bước tính giờ = tiếp nhận 27/04 09:30 + 48 giờ = ${iso(hourDue)}`, Date.parse(step(rf, 0).regulatoryDueAt) === hourDue, step(rf, 0).regulatoryDueAt);
  const dayDue = addDays(RECEIVED, 10);
  check('DUE-DAY', `hạn bước 10 ngày = hết ngày ${dayDue} (giờ Việt Nam)`, endsDay(step(rf, 1).regulatoryDueAt, dayDue), step(rf, 1).regulatoryDueAt);
  const wdDue = addWorkingDays(RECEIVED, 5);
  check('DUE-WORKING', `hạn bước 5 ngày làm việc qua 30/4, 1/5 và cuối tuần = hết ngày ${wdDue}`, wdDue === '2026-05-06' && endsDay(step(rf, 2).regulatoryDueAt, wdDue), step(rf, 2).regulatoryDueAt);
  const monthDue = addMonths(RECEIVED, 2);
  check('DUE-MONTH', `hạn bước 2 tháng = hết ngày ${monthDue}`, endsDay(step(rf, 3).regulatoryDueAt, monthDue), step(rf, 3).regulatoryDueAt);
  check('C8', 'bước chờ bước trước ở trạng thái WAITING_ANCHOR và chưa có hạn', step(rf, 4).status === 'WAITING_ANCHOR' && step(rf, 4).regulatoryDueAt === null, step(rf, 4));
  check('HAN-XU-LY', 'hạn xử lý mặc định = hạn quy định ở mọi bước đang mở', [0, 1, 2, 3].every((n) => step(rf, n).internalDueAt === step(rf, n).regulatoryDueAt), rf.steps.map((s) => [s.internalDueAt, s.regulatoryDueAt]));
  const petRow = await call(admin, 'GET', `/petitions/${petId}`);
  const recDeadline = petRow.body?.deadline ?? petRow.body?.data?.deadline;
  check('C6', `bước đã đối chiếu + quy trình đã xác nhận: hạn chung của hồ sơ = hạn quy định của bước hạn chung (ngày ${monthDue})`, onDay(recDeadline, monthDue), recDeadline);

  // ── C5: one writer of the record's deadline ───────────────────────────────────────────────────────────────────
  const oldForm = await call(admin, 'PUT', `/petitions/${petId}`, { deadline: addDays(monthDue, 5) });
  check('C5', 'form cũ gửi một hạn KHÁC khi quy trình giữ hạn → 409 DEADLINE_MANAGED_BY_FLOW', oldForm.status === 409 && JSON.stringify(oldForm.body).includes('DEADLINE_MANAGED_BY_FLOW'), [oldForm.status, oldForm.body]);
  const sameDay = await call(admin, 'PUT', `/petitions/${petId}`, { deadline: monthDue });
  check('C5', 'form cũ gửi lại ĐÚNG ngày hạn đang có thì được nhận, hạn không đổi', sameDay.status === 200 && onDay(await deadlineOf('petitions', petId), monthDue), [sameDay.status, sameDay.body?.error ?? null]);

  // ── bands at chosen instants, with the tracking clock (owner's rule; C15) ─────────────────────────────────────
  const due2 = Date.parse(step(rf, 1).regulatoryDueAt);
  const instants = [
    ['giữa ngày 01/05 (còn 6 ngày)', vnMidnight('2026-05-01') + 12 * 3600 * 1000],
    ['01/05 23:59:59 VN', vnMidnight('2026-05-02') - 1000],
    ['02/05 00:00:00 VN (còn 5 ngày)', vnMidnight('2026-05-02')],
    ['03/05 23:59:59 VN', vnMidnight('2026-05-04') - 1000],
    ['04/05 00:00:00 VN (còn 3 ngày)', vnMidnight('2026-05-04')],
    ['05/05 23:59:59 VN', vnMidnight('2026-05-06') - 1000],
    ['06/05 00:00:00 VN (còn 1 ngày)', vnMidnight('2026-05-06')],
    ['đúng thời điểm hết hạn', due2],
    ['1 mili giây sau hạn', due2 + 1],
  ];
  const mineIn = (items, n) => rowsOf(items).some((it) => it.recordId === petId && it.stepKey === keys[n]);
  for (const [label, at] of instants) {
    const want = expectedBand(at, due2, dayDue, T2);
    const where = [];
    for (const band of ['OVERDUE', 'RED', 'YELLOW', 'GREEN']) {
      const items = await call(admin, 'GET', `/processing/tracking/items?band=${band}&asOf=${encodeURIComponent(iso(at))}&pageSize=100`);
      if (mineIn(items.body, 1)) where.push(band);
    }
    check('BAND', `mức màu của bước 2 lúc ${label} = ${want}`, want === 'NONE' ? where.length === 0 : where.length === 1 && where[0] === want, where);
  }
  for (const [label, at] of [instants[3], instants[6], instants[8]]) {
    const q = `asOf=${encodeURIComponent(iso(at))}`;
    const summary = await call(admin, 'GET', `/processing/tracking/summary?${q}`);
    const totals = {};
    for (const band of ['OVERDUE', 'RED', 'YELLOW', 'GREEN']) totals[band] = (await call(admin, 'GET', `/processing/tracking/items?band=${band}&${q}&pageSize=100`)).body?.total;
    check('C15', `số trên thẻ = tổng số dòng ở cả bốn mức, cùng đồng hồ ${label}`, summary.status === 200 && ['OVERDUE', 'RED', 'YELLOW', 'GREEN'].every((b) => summary.body?.counts?.[b] === totals[b]), [summary.body, totals]);
  }
  const atRed = `asOf=${encodeURIComponent(iso(instants[6][1]))}&pageSize=100`;
  const mineX = await call(ux, 'GET', `/processing/tracking/items?mine=true&${atRed}`);
  check('TRACK-MINE', '"Việc của tôi" của tổ trưởng tổ xử lý chính có bước 2', mineX.status === 200 && mineIn(mineX.body, 1), [mineX.status, mineX.body]);
  const mineY = await call(uy, 'GET', `/processing/tracking/items?mine=true&${atRed}`);
  check('C15', '"Việc của tôi" của đơn vị phối hợp KHÔNG có việc (màn Theo dõi đếm bước × đơn vị xử lý chính)', mineY.status === 200 && !rowsOf(mineY.body).some((it) => it.recordId === petId), [mineY.status, mineY.body]);
  const outside = await call(uz, 'GET', `/processing/tracking/items?${atRed}`);
  const outsideSummary = await call(uz, 'GET', `/processing/tracking/summary?asOf=${encodeURIComponent(iso(instants[6][1]))}`);
  check('TRACK-SCOPE', 'cán bộ tổ không liên quan không thấy việc của tổ khác (danh sách và thẻ đều 0)', outside.status === 200 && !rowsOf(outside.body).some((it) => it.recordId === petId) && Object.values(outsideSummary.body?.counts ?? { x: 1 }).every((n) => n === 0), [outside.body, outsideSummary.body]);

  // ── the alert on the list (R9) ────────────────────────────────────────────────────────────────────────────────
  const early = iso(vnMidnight(RECEIVED) + 10 * 3600 * 1000); // 27/04 10:00: step 1 has 2 days left -> GREEN, the others no band
  const late = iso(vnMidnight('2026-05-06') + 12 * 3600 * 1000); // step 1 (due 29/04 09:30) is overdue
  const listAt = async (asOf, extra = '') => call(admin, 'GET', `/petitions?limit=50${PERIOD}&alertAsOf=${encodeURIComponent(asOf)}${extra}`);
  const rowOf = (res) => rowsOf(res.body).find((r) => r.id === petId);
  const onBase = !!rowOf(await call(admin, 'GET', `/petitions?limit=50${PERIOD}`));
  check('LIST-BASE', 'hồ sơ vừa tạo có mặt trên danh sách Đơn thư của quản trị (điều kiện để kiểm cột Cảnh báo)', onBase, 'the list with the period 2026 does not return the petition that GET /petitions/:id returns');
  const sorted = await listAt(late, '&sortBy=alert&sortOrder=asc');
  const dues = rowsOf(sorted.body).map((r) => r.alert?.dueAt).filter(Boolean).map((d) => Date.parse(d));
  const lastWithAlert = rowsOf(sorted.body).map((r) => !!r.alert).lastIndexOf(true);
  if (!onBase) notRun('LIST-SORT', 'sortBy=alert', 'NOT RUN: the list does not return the record (see LIST-BASE)');
  else check('LIST-SORT', 'sortBy=alert tăng dần: hạn cảnh báo không giảm từ dòng trên xuống, dòng không có cảnh báo nằm cuối', sorted.status === 200 && dues.length >= 2 && dues.every((d, i) => i === 0 || dues[i - 1] <= d) && lastWithAlert === dues.length - 1, [sorted.status, dues.map(iso)]);
  const a1 = rowOf(await listAt(early))?.alert;
  const listCheck = (req, name, ok, detail) => (onBase ? check(req, name, ok, detail) : notRun(req, name, 'NOT RUN: the list does not return the record at all (see LIST-BASE)'));
  listCheck('R9', 'cột Cảnh báo lúc 27/04 10:00 = XANH, bước 1 (mức nặng nhất trong các bước đang mở)', a1?.band === 'GREEN' && a1?.stepName === stepsOf()[0].name, a1);
  const a2 = rowOf(await listAt(late))?.alert;
  listCheck('R9', 'cột Cảnh báo lúc 06/05 12:00 = QUÁ HẠN, bước 1', a2?.band === 'OVERDUE' && a2?.stepName === stepsOf()[0].name, a2);
  const inOverdue = await listAt(late, '&alertBand=OVERDUE');
  const inGreen = await listAt(late, '&alertBand=GREEN');
  listCheck('LIST-FILTER', 'lọc alertBand: hồ sơ nằm trong QUÁ HẠN và không nằm trong XANH', !!rowOf(inOverdue) && !rowOf(inGreen) && rowsOf(inOverdue.body).every((r) => r.alert?.band === 'OVERDUE'), [rowsOf(inOverdue.body).length, rowsOf(inGreen.body).length]);

  // ── C6: the two deadlines ─────────────────────────────────────────────────────────────────────────────────────
  const cmd = async (token, pathTail, body) => { const now = (await getFlow()).body; return call(token, 'POST', `${rec}${pathTail}`, { expectedRevision: now.revision, ...body }); };
  const laterDue = await cmd(admin, `/steps/${keys[1]}/due`, { date: addDays(dayDue, 1), reason: 'UAT' });
  check('C6', 'hạn xử lý nội bộ MUỘN hơn hạn quy định bị từ chối', refused(laterDue, 'INTERNAL_DUE_AFTER_REGULATORY'), [laterDue.status, laterDue.body]);
  const earlierDay = addDays(dayDue, -2);
  const earlierDue = await cmd(admin, `/steps/${keys[1]}/due`, { date: earlierDay, reason: 'UAT' });
  rf = (await getFlow()).body;
  check('C6', `hạn xử lý nội bộ sớm hơn được nhận (hết ngày ${earlierDay}); hạn quy định không đổi`, earlierDue.status === 200 && endsDay(step(rf, 1).internalDueAt, earlierDay) && endsDay(step(rf, 1).regulatoryDueAt, dayDue), [earlierDue.status, earlierDue.body?.code, step(rf, 1).internalDueAt, step(rf, 1).regulatoryDueAt]);
  const noExt = await cmd(admin, `/steps/${keys[1]}/extend`, { reason: 'UAT' });
  check('C6', 'gia hạn bước không cài gia hạn bị từ chối', refused(noExt, 'EXTENSION_NOT_ALLOWED'), [noExt.status, noExt.body]);
  const ext = await cmd(admin, `/steps/${keys[3]}/extend`, { reason: 'UAT căn cứ gia hạn' });
  rf = (await getFlow()).body;
  const extDay = addMonths(monthDue, 1);
  check('C6', `gia hạn 1 lần × 1 tháng: hạn quy định bước 4 = hết ngày ${extDay}`, ext.status === 200 && endsDay(step(rf, 3).regulatoryDueAt, extDay), [ext.status, ext.body?.code, step(rf, 3).regulatoryDueAt]);
  const ext2 = await cmd(admin, `/steps/${keys[3]}/extend`, { reason: 'UAT lần hai' });
  check('C6', 'gia hạn lần thứ hai vượt giới hạn số lần bị từ chối', refused(ext2, 'EXTENSION_NOT_ALLOWED'), [ext2.status, ext2.body]);

  // ── permissions through a step (owner's rule, C1) ─────────────────────────────────────────────────────────────
  const yOpens = await call(uy, 'GET', `/petitions/${petId}`);
  check('PERM-READ', 'cán bộ đơn vị phối hợp ở bước đang mở mở được hồ sơ', yOpens.status === 200, [yOpens.status, yOpens.body]);
  const yFlow = await getFlow(uy);
  check('PERM-READ', '...và đọc được các bước của hồ sơ', yFlow.status === 200, [yFlow.status, yFlow.body]);
  const yEdits = await call(uy, 'PUT', `/petitions/${petId}`, { senderName: 'bị sửa bởi đơn vị phối hợp' });
  check('PERM-NO-EDIT', 'cán bộ đơn vị phối hợp KHÔNG sửa được hồ sơ', yEdits.status === 403 || yEdits.status === 404, [yEdits.status, yEdits.body]);
  const yReport = await cmd(uy, `/steps/${keys[1]}/reports`, { kind: 'PROGRESS', doneWork: 'Đã phối hợp xác minh' });
  check('PERM-REPORT', 'cán bộ đơn vị phối hợp ghi được báo cáo ở bước của mình', yReport.status === 200, [yReport.status, yReport.body]);
  const yOther = await cmd(uy, `/steps/${keys[2]}/reports`, { kind: 'PROGRESS', doneWork: 'Bước không phải của mình' });
  check('PERM-REPORT', '...nhưng không ghi được báo cáo ở bước mình không được giao', yOther.status === 403, [yOther.status, yOther.body]);
  const zOpens = await call(uz, 'GET', `/petitions/${petId}`);
  const zFlow = await getFlow(uz);
  check('PERM-OUTSIDE', 'cán bộ tổ không liên quan bị từ chối (403/404) ở hồ sơ và ở các bước', [403, 404].includes(zOpens.status) && [403, 404].includes(zFlow.status), [zOpens.status, zFlow.status]);

  // ── R7: the unit that is only informed ────────────────────────────────────────────────────────────────────────
  const ui = await login(`${TAG}-ui`);
  const iRead = await call(ui, 'GET', `/petitions/${petId}`);
  const iFlow = await getFlow(ui);
  const iMine = await call(ui, 'GET', `/processing/tracking/items?mine=true&${atRed}`);
  const iTeam = await call(admin, 'GET', `/processing/tracking/items?teamId=${TI}&${atRed}`);
  check('R7', 'đơn vị "Xem để biết" mở được hồ sơ và các bước', iRead.status === 200 && iFlow.status === 200, [iRead.status, iFlow.status]);
  check('R7', '...nhưng không có việc, không có hạn riêng: "Việc của tôi" trống và đơn vị đó không được đếm', iMine.status === 200 && rowsOf(iMine.body).length === 0 && iTeam.body?.total === 0, [iMine.body?.total, iTeam.body?.total]);
  const iReport = await cmd(ui, `/steps/${keys[1]}/reports`, { kind: 'PROGRESS', doneWork: 'Đơn vị chỉ được báo' });
  check('R7', '...và không ghi được báo cáo của bước', iReport.status === 403, [iReport.status, iReport.body]);

  // ── C2: one permission per action ─────────────────────────────────────────────────────────────────────────────
  // The officer of the handling unit holds read, report, opine, complete on ProcessingStep and none of the others.
  const lacking = [['reopen', `/steps/${keys[1]}/reopen`, { reason: 'x' }], ['skip', `/steps/${keys[2]}/skip`, { reason: 'x' }], ['adjustDue', `/steps/${keys[1]}/due`, { date: addDays(dayDue, -1) }], ['extend', `/steps/${keys[3]}/extend`, { reason: 'x' }], ['approve', `/steps/${keys[3]}/decision`, { verdict: 'AGREE' }], ['assign', '/confirm', {}]];
  for (const [action, tail, body] of lacking) {
    const r = await cmd(ux, tail, body);
    check('C2', `không có quyền ${action}:ProcessingStep → 403 (dù là cán bộ của chính đơn vị xử lý)`, r.status === 403, [r.status, r.body?.code ?? r.body]);
  }
  const xNudge = await call(ux, 'POST', `${rec}/steps/${keys[1]}/nudge`, { message: 'x' });
  if (xNudge.status === 404 && !xNudge.body?.code) notRun('C2', 'không có quyền nudge:ProcessingStep → 403', 'NOT RUN: route absent');
  else check('C2', 'không có quyền nudge:ProcessingStep → 403', xNudge.status === 403, [xNudge.status, xNudge.body]);
  const xProgress = await cmd(ux, `/steps/${keys[1]}/reports`, { kind: 'PROGRESS', doneWork: 'Tiến độ của đơn vị xử lý chính' });
  check('C2', 'có quyền report:ProcessingStep → không bị từ chối vì quyền', xProgress.status === 200, [xProgress.status, xProgress.body]);
  const xComplete = await cmd(ux, `/steps/${keys[2]}/complete`, {});
  const xUndo = await cmd(admin, `/steps/${keys[2]}/reopen`, { reason: 'UAT: trả bước về OPEN cho các ca sau' });
  check('C2', 'có quyền complete:ProcessingStep → hoàn thành được (rồi quản trị, người có quyền reopen, mở lại)', xComplete.status === 200 && xUndo.status === 200, [xComplete.status, xComplete.body?.code, xUndo.status]);

  // ── state machine, idempotency, revision (C8) ─────────────────────────────────────────────────────────────────
  rf = (await getFlow()).body;
  const stale = rf.revision;
  const key = `uat-${RUN}-complete-1`;
  const first = await call(admin, 'POST', `${rec}/steps/${keys[0]}/complete`, { expectedRevision: stale, idempotencyKey: key });
  const afterFirst = (await getFlow()).body;
  const again = await call(admin, 'POST', `${rec}/steps/${keys[0]}/complete`, { expectedRevision: stale, idempotencyKey: key });
  const afterAgain = (await getFlow()).body;
  check('C8', 'hoàn thành bước 1', first.status === 200 && step(afterFirst, 0).status === 'DONE', [first.status, first.body]);
  check('C8-IDEM', 'thiết bị thứ hai gửi lại cùng khoá idempotency: trả lời như lần đầu, không ghi lần hai', again.status === 200 && afterAgain.revision === afterFirst.revision && afterFirst.revision > stale, [again.status, again.body?.code, stale, afterFirst.revision, afterAgain.revision]);
  const conflict = await call(admin, 'POST', `${rec}/steps/${keys[2]}/complete`, { expectedRevision: stale });
  check('C8-REV', 'expectedRevision cũ → 409 REVISION_CONFLICT', conflict.status === 409 && conflict.body?.code === 'REVISION_CONFLICT', [conflict.status, conflict.body]);
  const reopened = await cmd(admin, `/steps/${keys[0]}/reopen`, { reason: 'UAT mở lại' });
  rf = (await getFlow()).body;
  check('C8', 'mở lại bước 1', reopened.status === 200 && step(rf, 0).status === 'OPEN', [reopened.status, reopened.body]);
  const noReason = await cmd(admin, `/steps/${keys[2]}/skip`, {});
  check('C8', 'bỏ qua một bước mà không nêu lý do bị từ chối', refused(noReason, 'STEP_REASON_REQUIRED'), [noReason.status, noReason.body]);
  const skipped = await cmd(admin, `/steps/${keys[2]}/skip`, { reason: 'UAT bỏ qua' });
  rf = (await getFlow()).body;
  const wasSkipped = step(rf, 2).status === 'SKIPPED';
  const unskipped = await cmd(admin, `/steps/${keys[2]}/unskip`, {});
  rf = (await getFlow()).body;
  check('C8', 'bỏ qua ⇄ bỏ bỏ qua', skipped.status === 200 && wasSkipped && unskipped.status === 200 && step(rf, 2).status === 'OPEN', [skipped.status, wasSkipped, unskipped.status, step(rf, 2).status]);

  // ── a step that needs approval (C8, design 2) ─────────────────────────────────────────────────────────────────
  const direct = await cmd(admin, `/steps/${keys[3]}/complete`, {});
  check('C8-APPROVE', 'bước cần duyệt không hoàn thành trực tiếp được', refused(direct, 'STEP_NEEDS_APPROVAL'), [direct.status, direct.body]);
  const result = await cmd(ux, `/steps/${keys[3]}/reports`, { kind: 'RESULT', doneWork: 'Đã kết luận', proposalKind: 'REPLY', proposalContent: 'Trả lời đơn' });
  rf = (await getFlow()).body;
  check('C8-APPROVE', 'đơn vị xử lý chính gửi báo cáo kết quả: bước sang REPORTED, chưa xong', result.status === 200 && step(rf, 3).status === 'REPORTED', [result.status, result.body, step(rf, 3).status]);
  const seenByLeader = rf.revision;
  const standing = async () => ((await call(admin, 'GET', `${rec}/steps/${keys[3]}/results`)).body?.reports ?? []).filter((r) => r.kind === 'RESULT' && !r.withdrawnAt && !r.supersededAt).pop();
  const report1 = await standing();
  const edited = await cmd(ux, `/steps/${keys[3]}/reports/${report1?.id}/edit`, { doneWork: 'Sửa sau khi đã gửi' });
  check('C8-APPROVE', 'báo cáo kết quả chỉ sửa được khi bước còn OPEN: sửa lúc đang chờ duyệt bị từ chối (STEP_NOT_OPEN)', !!report1 && refused(edited, 'STEP_NOT_OPEN'), [report1?.id, edited.status, edited.body]);
  const withdrawn = await cmd(ux, `/steps/${keys[3]}/reports/${report1?.id}/withdraw`, {});
  rf = (await getFlow()).body;
  check('C8-APPROVE', 'tác giả rút báo cáo kết quả trước khi lãnh đạo trả lời: bước về OPEN', withdrawn.status === 200 && step(rf, 3).status === 'OPEN', [withdrawn.status, withdrawn.body?.code, step(rf, 3).status]);
  const staleAgree = await call(admin, 'POST', `${rec}/steps/${keys[3]}/decision`, { verdict: 'AGREE', expectedRevision: seenByLeader });
  const lateAgree = await cmd(admin, `/steps/${keys[3]}/decision`, { verdict: 'AGREE' });
  rf = (await getFlow()).body;
  check('C8-APPROVE', 'lãnh đạo đồng ý trên báo cáo đã bị rút (màn hình cũ) → 409; đồng ý khi không còn báo cáo chờ duyệt → từ chối; bước chưa xong', staleAgree.status === 409 && refused(lateAgree, 'STEP_NOT_REPORTED') && step(rf, 3).status === 'OPEN', [staleAgree.status, staleAgree.body?.code, lateAgree.status, lateAgree.body?.code, step(rf, 3).status]);
  const resultB = await cmd(ux, `/steps/${keys[3]}/reports`, { kind: 'RESULT', doneWork: 'Đã kết luận (gửi lại)' });
  const rework = await cmd(admin, `/steps/${keys[3]}/decision`, { verdict: 'DISAGREE', content: 'Yêu cầu bổ sung, làm lại' });
  rf = (await getFlow()).body;
  check('C8-REWORK', '"Yêu cầu bổ sung" mở lại bước (OPEN)', resultB.status === 200 && rework.status === 200 && step(rf, 3).status === 'OPEN', [resultB.status, rework.status, rework.body, step(rf, 3).status]);
  const result2 = await cmd(ux, `/steps/${keys[3]}/reports`, { kind: 'RESULT', doneWork: 'Đã bổ sung và kết luận' });
  const report2 = await standing();
  const agree = await cmd(admin, `/steps/${keys[3]}/decision`, { verdict: 'AGREE' });
  rf = (await getFlow()).body;
  check('C8-APPROVE', 'lãnh đạo đồng ý báo cáo mới nhất → bước DONE', result2.status === 200 && agree.status === 200 && step(rf, 3).status === 'DONE', [result2.status, agree.status, agree.body, step(rf, 3).status]);
  const book = (await call(admin, 'GET', `${rec}/steps/${keys[3]}/results`)).body;
  const approval = (book?.opinions ?? []).filter((o) => o.kind === 'APPROVAL' && o.verdict === 'AGREE').pop();
  check('C8-APPROVE', 'ý kiến phê duyệt ghi đúng MÃ và PHIÊN BẢN của báo cáo được duyệt', !!report2 && approval?.reportId === report2.id && approval?.reportRevision === report2.revision, [report2?.id, report2?.revision, approval]);
  const petAfter = await call(admin, 'GET', `/petitions/${petId}`);
  check('C7', 'duyệt báo cáo KHÔNG tự kết thúc hồ sơ (ngày giải quyết vẫn trống)', (petAfter.body?.ngayGiaiQuyet ?? petAfter.body?.data?.ngayGiaiQuyet ?? null) === null, petAfter.body?.ngayGiaiQuyet);
  check('C8', 'bước sau nhận mốc khi bước trước xong: OPEN và có hạn', step(rf, 4).status === 'OPEN' && !!step(rf, 4).regulatoryDueAt, step(rf, 4));

  // ── the reach ends when the step is done ──────────────────────────────────────────────────────────────────────
  const done2 = await cmd(admin, `/steps/${keys[1]}/complete`, {});
  const yAfter = await call(uy, 'GET', `/petitions/${petId}`);
  check('PERM-ENDS', 'bước xong thì cán bộ đơn vị phối hợp hết quyền mở hồ sơ', done2.status === 200 && [403, 404].includes(yAfter.status), [done2.status, done2.body?.code, yAfter.status]);
  const gone = await call(admin, 'GET', `/processing/tracking/items?${atRed}`);
  check('TRACK-LEAVES', 'bước đã xong rời khỏi danh sách theo dõi ngay', gone.status === 200 && !mineIn(gone.body, 1), rowsOf(gone.body).map((it) => it.stepKey));

  // ── a deleted record leaves the counts ────────────────────────────────────────────────────────────────────────
  const pet2 = await newPetition({ senderName: `UAT ${RUN} sẽ bị xoá` });
  const pet2Id = pet2.body?.id ?? pet2.body?.data?.id;
  let has2 = false;
  for (let i = 0; i < 40 && pet2Id && !has2; i++) { has2 = (await call(admin, 'GET', `/processing/records/PETITION/${pet2Id}`)).status === 200; if (!has2) await sleep(500); }
  const inBefore = rowsOf((await call(admin, 'GET', `/processing/tracking/items?${atRed}`)).body).some((it) => it.recordId === pet2Id);
  const del = await call(admin, 'DELETE', `/petitions/${pet2Id}`, { reason: 'UAT xoá hồ sơ thử', lyDoXoa: 'UAT xoá hồ sơ thử' });
  const inAfter = rowsOf((await call(admin, 'GET', `/processing/tracking/items?${atRed}`)).body).some((it) => it.recordId === pet2Id);
  if (del.status >= 400) notRun('TRACK-LEAVES', 'hồ sơ bị xoá rời khỏi số đếm ngay', `NOT RUN: the script could not delete the petition over HTTP (${del.status} ${short(del.body)})`);
  else check('TRACK-LEAVES', 'hồ sơ bị xoá rời khỏi số đếm ngay', has2 && inBefore && !inAfter, [has2, inBefore, inAfter]);

  // ── delete refused while in use (design 1) ────────────────────────────────────────────────────────────────────
  f = await flow();
  const removal = await call(admin, 'DELETE', `/processing-flows/${flowId}?expectedRevision=${f.revision}&confirmName=${encodeURIComponent(f.name)}`);
  check('CFG-DELETE', 'xoá quy trình đang được hồ sơ dùng bị từ chối (FLOW_IN_USE)', refused(removal, 'FLOW_IN_USE'), [removal.status, removal.body]);

  // ── unknown information type: a proposal (C10) ────────────────────────────────────────────────────────────────
  const incident = await call(admin, 'POST', '/incidents', { name: `UAT ${RUN} vụ việc loại lạ`, loaiThongTin: `Loại không có trong danh mục ${RUN}`, ngayDeXuat: RECEIVED, assignedTeamId: TX });
  const incId = incident.body?.id ?? incident.body?.data?.id;
  check('C14', 'tạo Vụ việc qua API', incident.status === 201 && !!incId, [incident.status, incident.body]);
  if (incId) {
    const irec = `/processing/records/INCIDENT/${incId}`;
    let iflow = null;
    for (let i = 0; i < 40 && !iflow; i++) { const r = await call(admin, 'GET', irec); if (r.status === 200) iflow = r.body; else await sleep(500); }
    check('C10', 'Loại thông tin không nhận diện được → ĐỀ XUẤT (UNKNOWN_TYPE, chưa xác nhận)', !!iflow && iflow.match === 'UNKNOWN_TYPE' && iflow.confirmed === false, iflow);
    if (iflow) {
      const irow = await call(admin, 'GET', `/incidents/${incId}`);
      let want = addDays(RECEIVED, 20); // 17/05/2026 is a Sunday: the step rolls to the next working day (the default)
      while (!isWorking(want)) want = addDays(want, 1);
      const ideadline = irow.body?.deadline ?? irow.body?.data?.deadline ?? null;
      check('C10', 'đề xuất chưa xác nhận không được đếm ở màn Theo dõi (thống kê đếm riêng)', !rowsOf((await call(admin, 'GET', `/processing/tracking/items?pageSize=100`)).body).some((it) => it.recordId === incId), ideadline);
      check('C10', 'đề xuất chưa xác nhận KHÔNG khẳng định hạn pháp lý: không bước nào mang màu / quá hạn', iflow.steps.every((s) => s.band === 'NONE'), iflow.steps.map((s) => [s.band, s.regulatoryDueAt]));
      const confirmed = await call(admin, 'POST', `${irec}/confirm`, { expectedRevision: iflow.revision });
      const inow = (await call(admin, 'GET', irec)).body;
      check('C10', `người giữ hồ sơ xác nhận một lần bấm → có hạn (hết ngày ${want})`, confirmed.status === 200 && inow?.confirmed === true && endsDay(inow.steps[0].regulatoryDueAt, want), [confirmed.status, confirmed.body?.code, inow?.steps?.[0]?.regulatoryDueAt]);
      const twice = await call(admin, 'POST', `${irec}/confirm`, { expectedRevision: inow?.revision });
      check('C10', 'xác nhận lần hai bị từ chối (FLOW_ALREADY_CONFIRMED)', refused(twice, 'FLOW_ALREADY_CONFIRMED'), [twice.status, twice.body]);
    }
  }
  const newCase = (extra = {}) => call(admin, 'POST', '/cases', { name: `UAT ${RUN} vụ án`, caseProvenance: 'DIRECT_DISCOVERY', assignedTeamId: TX, receiveDate: RECEIVED, ...extra });
  const kase = await newCase();
  const caseId = idOf(kase);
  if (kase.status !== 201) notRun('R11', 'Vụ án khi không có quy trình nào cho Vụ án: không có quy trình, hạn không tự tính', `NOT RUN: the script could not create a case over HTTP (${kase.status} ${short(kase.body)})`);
  else {
    await sleep(4000);
    const cflow = await call(admin, 'GET', `/processing/records/CASE/${caseId}`);
    check('R11', 'Vụ án khi không có quy trình nào cho Vụ án: không có quy trình, hạn không tự tính', cflow.status === 404 && (await deadlineOf('cases', caseId)) === null, [cflow.status, cflow.body]);
  }

  // ── R6 (CLI): the dry run writes nothing ──────────────────────────────────────────────────────────────────────
  const caseFlow = await call(admin, 'POST', '/processing-flows', { name: `UAT ${RUN} vụ án mặc định`, recordKind: 'CASE', isDefault: true });
  const caseFlowId = idOf(caseFlow) ?? rowsOf((await call(admin, 'GET', '/processing-flows?recordKind=CASE')).body).find((x) => x.isDefault)?.id;
  let caseFlowLive = false;
  if (caseFlowId) {
    let g = (await call(admin, 'GET', `/processing-flows/${caseFlowId}`)).body;
    if (!g?.published) {
      await call(admin, 'PUT', `/processing-flows/${caseFlowId}/versions/${g.draft?.id}/steps`, { steps: [{ name: 'Điều tra', durationValue: 30, durationUnit: 'DAY', anchor: 'RECEIVED', rollToWorkingDay: false, redDays: 1, yellowDays: 3, greenDays: 5, parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }, party(TY, 'COORDINATE')] }], expectedRevision: g.draft?.revision });
      g = (await call(admin, 'GET', `/processing-flows/${caseFlowId}`)).body;
      await call(admin, 'POST', `/processing-flows/${caseFlowId}/versions/${g.draft?.id}/publish`, { expectedRevision: g.draft?.revision });
      g = (await call(admin, 'GET', `/processing-flows/${caseFlowId}`)).body;
    }
    caseFlowLive = !!g?.published;
  }
  const pkg = require(path.join(BACKEND, 'package.json'));
  if (!pkg.scripts?.['proc:apply-flows']) notRun('R6', 'PENDING-MERGE CLI áp quy trình: chạy thử không ghi gì', 'NOT RUN: npm script proc:apply-flows absent (code not merged)');
  else if (!caseId || !caseFlowLive) notRun('R6', 'CLI áp quy trình: chạy thử không ghi gì', 'NOT RUN: no open record without a flow to be a candidate (the case or its default flow could not be made)');
  else {
    const counts = async () => (await pg.query(`SELECT (SELECT count(*) FROM "proc_record_flows") AS flows, (SELECT count(*) FROM "proc_record_steps") AS steps, (SELECT count(*) FROM "proc_outbox") AS outbox, (SELECT count(*) FROM "proc_step_changes") AS changes`)).rows[0];
    const beforeRun = await counts();
    const dry = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'proc:apply-flows', '--', '--kind', 'CASE'], { cwd: BACKEND, env: { ...process.env, DATABASE_URL: DB_URL }, encoding: 'utf8', shell: process.platform === 'win32', timeout: 180_000 });
    const afterRun = await counts();
    const still = await call(admin, 'GET', `/processing/records/CASE/${caseId}`);
    const out = `${dry.stdout ?? ''}${dry.stderr ?? ''}`;
    check('R6', 'CLI chạy thử (mặc định): kết thúc bình thường, có nêu hồ sơ ứng viên, và KHÔNG ghi gì (số dòng proc_* không đổi, Vụ án vẫn chưa có quy trình)', dry.status === 0 && JSON.stringify(beforeRun) === JSON.stringify(afterRun) && still.status === 404 && /\b[1-9]\d*\b/.test(out), [dry.status, beforeRun, afterRun, still.status, out.slice(-400)]);
  }

  if (pkg.scripts?.['proc:apply-flows'] && caseId && caseFlowLive) {
    const run = () => spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'proc:apply-flows', '--', '--that', '--actor', `${TAG}-admin`, '--kind', 'CASE'], { cwd: BACKEND, env: { ...process.env, DATABASE_URL: DB_URL }, encoding: 'utf8', shell: process.platform === 'win32', timeout: 180_000 });
    const flows = async () => (await pg.query(`SELECT count(*)::int AS n FROM "proc_record_flows"`)).rows[0].n;
    const n0 = await flows();
    const real = run();
    const n1 = await flows();
    const applied = await call(admin, 'GET', `/processing/records/CASE/${caseId}`);
    check('R6', 'CLI chạy thật (--that): Vụ án đang mở chưa có quy trình nay có quy trình', real.status === 0 && applied.status === 200 && n1 > n0, [real.status, n0, n1, applied.status, `${real.stdout ?? ''}${real.stderr ?? ''}`.slice(-300)]);
    const second = run();
    check('R6', 'CLI chạy thật lần hai: không còn gì để áp, không ghi thêm', second.status === 0 && (await flows()) === n1, [second.status, n1, await flows(), `${second.stdout ?? ''}`.slice(-200)]);
  }

  // ── C1: a RESTRICTED case is not revealed through a step ──────────────────────────────────────────────────────
  const openCase = caseFlowLive ? await newCase({ name: `UAT ${RUN} vụ án thường` }) : null;
  const secretCase = caseFlowLive ? await newCase({ name: `UAT ${RUN} vụ án hạn chế` }) : null;
  const openFlow = openCase && idOf(openCase) ? await waitFlow('CASE', idOf(openCase)) : null;
  const secretFlow = secretCase && idOf(secretCase) ? await waitFlow('CASE', idOf(secretCase)) : null;
  if (!openFlow || !secretFlow) notRun('C1', 'Vụ án HẠN CHẾ không lộ qua bước', `NOT RUN: the script could not get two cases with a flow (${openCase?.status} ${secretCase?.status} ${short(openCase?.body ?? '')})`);
  else {
    const control = await call(uy, 'GET', `/processing/records/CASE/${idOf(openCase)}`);
    check('C1', 'đối chứng: đơn vị phối hợp đọc được các bước của Vụ án THƯỜNG', control.status === 200, [control.status, control.body]);
    // Set-up by SQL: no route of the API marks a case restricted for a test.
    await pg.query(`UPDATE "cases" SET "sensitivity" = 'RESTRICTED' WHERE "id" = $1`, [idOf(secretCase)]);
    const viaStep = await call(uy, 'GET', `/processing/records/CASE/${idOf(secretCase)}`);
    const viaRecord = await call(uy, 'GET', `/cases/${idOf(secretCase)}`);
    const viaResults = await call(uy, 'GET', `/processing/records/CASE/${idOf(secretCase)}/steps/${secretFlow.steps[0].stepKey}/results`);
    const viaTracking = await call(uy, 'GET', '/processing/tracking/items?pageSize=100');
    check('C1', 'Vụ án HẠN CHẾ: đơn vị phối hợp của bước KHÔNG đọc được bước, kết quả, hồ sơ, và không thấy ở màn Theo dõi', [403, 404].includes(viaStep.status) && [403, 404].includes(viaRecord.status) && [403, 404].includes(viaResults.status) && !rowsOf(viaTracking.body).some((it) => it.recordId === idOf(secretCase)), [viaStep.status, viaRecord.status, viaResults.status]);
  }

  // ── C14: a conversion closes the source flow and opens the target one ─────────────────────────────────────────
  const src = await newPetition({ senderName: `UAT ${RUN} chuyển vụ việc` });
  const srcId = idOf(src);
  const srcFlow = srcId ? await waitFlow('PETITION', srcId) : null;
  const srcRow = srcId ? await call(admin, 'GET', `/petitions/${srcId}`) : null;
  const conv = srcId ? await call(admin, 'POST', `/petitions/${srcId}/convert-incident`, { incidentName: `UAT ${RUN} vụ việc từ đơn`, incidentType: 'Khác', expectedUpdatedAt: srcRow.body?.updatedAt ?? srcRow.body?.data?.updatedAt }) : null;
  const newIncId = conv?.body?.incident?.id ?? conv?.body?.data?.incident?.id ?? conv?.body?.incidentId ?? conv?.body?.data?.id ?? conv?.body?.id;
  if (!srcFlow || !conv || conv.status >= 400 || !newIncId) notRun('C14', 'chuyển Đơn thư → Vụ việc: quy trình nguồn đóng, quy trình đích mở', `NOT RUN: the script could not convert over HTTP (${conv?.status} ${short(conv?.body ?? '')})`);
  else {
    const target = await waitFlow('INCIDENT', newIncId);
    const srcWork = rowsOf((await call(admin, 'GET', '/processing/tracking/items?pageSize=100&kind=PETITION')).body).some((it) => it.recordId === srcId);
    const srcNow = (await call(admin, 'GET', `/processing/records/PETITION/${srcId}`)).body;
    check('C14', 'chuyển Đơn thư → Vụ việc: Vụ việc mới tự có quy trình; việc của Đơn thư nguồn rời màn Theo dõi (không bước nào còn mang màu)', !!target && !srcWork && (srcNow?.steps ?? []).every((x) => x.band === 'NONE'), [!!target, srcWork, (srcNow?.steps ?? []).map((x) => [x.status, x.band])]);
  }

  // ── suspended / finished: leave the counts at once; the clock stops and the deadlines move by the pause (R3) ──
  // The proposal date is the real today, so that the deadline lies after the real "now" (a pause only moves a deadline it began before).
  const today = vnDayOf(Date.now());
  const inc2 = await call(admin, 'POST', '/incidents', { name: `UAT ${RUN} vụ việc tạm đình chỉ`, ngayDeXuat: today, assignedTeamId: TX });
  const inc2Id = idOf(inc2);
  const inc2Flow = inc2Id ? await waitFlow('INCIDENT', inc2Id) : null;
  const tracked = async (id) => rowsOf((await call(admin, 'GET', '/processing/tracking/items?band=NONE&pageSize=100&kind=INCIDENT')).body).some((it) => it.recordId === id) || rowsOf((await call(admin, 'GET', '/processing/tracking/items?pageSize=100&kind=INCIDENT')).body).some((it) => it.recordId === id);
  const moveTo = (id, status, extra = {}) => call(admin, 'PATCH', `/incidents/${id}/status`, { status, note: 'UAT', ...extra });
  const decision = { decisionNumber: `UAT-${RUN}`, decisionDate: today };
  const working = inc2Id ? await moveTo(inc2Id, 'DANG_XAC_MINH') : null;
  const wasTracked = inc2Id ? await tracked(inc2Id) : false;
  const suspend = inc2Id ? await moveTo(inc2Id, 'TAM_DINH_CHI', { ...decision, canCu: 'UAT', lyDoTamDinhChiVuViec: ['CAN_CU_KHAC'] }) : null;
  const tSuspendSent = Date.now();
  if (!inc2Flow || !wasTracked || !suspend || suspend.status >= 400) {
    notRun('TRACK-SUSPENDED', 'hồ sơ tạm đình chỉ rời số đếm ngay', `NOT RUN: the script could not suspend an incident over HTTP (flow ${!!inc2Flow}, tracked ${wasTracked}, ${working?.status} ${suspend?.status} ${short(suspend?.body ?? working?.body ?? '')})`);
    notRun('R3', 'tạm đình chỉ dừng đồng hồ, phục hồi dời hạn đúng bằng thời gian dừng', 'NOT RUN: no suspended record (see the line above)');
  } else {
    check('TRACK-SUSPENDED', 'hồ sơ tạm đình chỉ rời số đếm ngay (trước cả khi bộ dừng đồng hồ chạy)', !(await tracked(inc2Id)), 'still listed');
    const dueBefore = Date.parse(inc2Flow.steps[0].regulatoryDueAt);
    const poll = async (want) => { for (let i = 0; i < 45; i++) { const now = (await call(admin, 'GET', `/processing/records/INCIDENT/${inc2Id}`)).body; if (want(now)) return now; await sleep(2000); } return null; };
    const paused = await poll((x) => !!x?.pausedSince);
    check('R3', 'trong vòng 90 giây hồ sơ tạm đình chỉ được ghi nhận dừng đồng hồ, và mốc dừng không sớm hơn lúc tạm đình chỉ', !!paused && Date.parse(paused.pausedSince) >= tSuspendSent - 5000, paused?.pausedSince ?? 'pausedSince never appeared');
    const tResumeSent = Date.now();
    const resume = await moveTo(inc2Id, 'PHUC_HOI_NGUON_TIN', decision);
    if (!paused || resume.status >= 400) notRun('R3', 'phục hồi dời hạn đúng bằng thời gian dừng', `NOT RUN: the script could not resume the incident over HTTP (${resume.status} ${short(resume.body)})`);
    else {
      const resumed = await poll((x) => x && !x.pausedSince);
      const tResumedSeen = Date.now();
      const shift = resumed ? Date.parse(resumed.steps[0].regulatoryDueAt) - dueBefore : null;
      const from = Date.parse(paused.pausedSince);
      // The pause began at the instant the server reported (`pausedSince`); it ended between the resumption the script sent and the first answer that showed the clock running.
      check('R3', 'phục hồi: hạn quy định dời đúng bằng thời gian dừng (từ mốc dừng máy chủ báo tới lúc đồng hồ chạy lại)', resumed !== null && shift >= tResumeSent - from && shift <= tResumedSeen - from, [shift, tResumeSent - from, tResumedSeen - from]);
      check('R3', '...hạn xử lý nội bộ dời cùng một lượng', resumed !== null && Date.parse(resumed.steps[0].internalDueAt) - Date.parse(inc2Flow.steps[0].internalDueAt) === shift, [resumed?.steps?.[0]?.internalDueAt, shift]);
    }
  }
  const inc3 = await call(admin, 'POST', '/incidents', { name: `UAT ${RUN} vụ việc kết thúc`, ngayDeXuat: today, assignedTeamId: TX });
  const inc3Id = idOf(inc3);
  const inc3Flow = inc3Id ? await waitFlow('INCIDENT', inc3Id) : null;
  if (inc3Id) await moveTo(inc3Id, 'DANG_XAC_MINH');
  const tracked3 = inc3Id ? await tracked(inc3Id) : false;
  const finish = inc3Id ? await moveTo(inc3Id, 'DA_GIAI_QUYET') : null;
  if (!inc3Flow || !tracked3 || !finish || finish.status >= 400) notRun('TRACK-FINISHED', 'hồ sơ đã kết thúc rời số đếm ngay', `NOT RUN: the script could not finish an incident over HTTP (flow ${!!inc3Flow}, tracked ${tracked3}, ${finish?.status} ${short(finish?.body ?? '')})`);
  else check('TRACK-FINISHED', 'hồ sơ đã kết thúc rời số đếm ngay', !(await tracked(inc3Id)), 'still listed');

  // ── the alert column on the incident and case lists (R9) ──────────────────────────────────────────────────────
  for (const [kind, url, id, asOf] of [['Vụ việc', 'incidents', incId, '2026-05-20T05:00:00.000Z'], ['Vụ án', 'cases', openCase ? idOf(openCase) : null, '2026-05-28T05:00:00.000Z']]) {
    const res = id ? await call(admin, 'GET', `/${url}?limit=100${PERIOD}&alertAsOf=${encodeURIComponent(asOf)}`) : null;
    const row = res ? rowsOf(res.body).find((r) => r.id === id) : null;
    if (!row) notRun('R9', `cột Cảnh báo trên danh sách ${kind}`, `NOT RUN: the script's record is not on the list it asked for (${res?.status} total ${res?.body?.total})`);
    else check('R9', `cột Cảnh báo trên danh sách ${kind}: QUÁ HẠN theo quy trình, sau hạn do script tính`, row.alert?.band === 'OVERDUE' && row.alert?.source === 'FLOW', row.alert);
  }

  // ── templates by law and copying a flow (design 1) ────────────────────────────────────────────────────────────
  const tpls = await call(admin, 'GET', '/processing-flows/templates');
  const tplList = rowsOf(tpls.body?.templates ?? tpls.body);
  check('CFG-TEMPLATES', 'có sẵn bộ quy trình mẫu theo pháp luật', tpls.status === 200 && tplList.length >= 5, [tpls.status, tplList.map((t) => t.key ?? t.templateKey)]);
  const tpl = tplList.find((t) => (t.recordKind ?? 'PETITION') === 'PETITION') ?? tplList[0];
  if (tpl) {
    const fromTpl = await call(admin, 'POST', '/processing-flows', { name: `UAT ${RUN} từ mẫu`, recordKind: tpl.recordKind ?? 'PETITION', templateKey: tpl.key ?? tpl.templateKey });
    const made = idOf(fromTpl) ? (await call(admin, 'GET', `/processing-flows/${idOf(fromTpl)}`)).body : null;
    const tSteps = made?.draft?.steps ?? [];
    check('CFG-TEMPLATES', 'quy trình tạo từ mẫu: có bước, mọi bước ở trạng thái "chưa đối chiếu văn bản gốc"', fromTpl.status === 201 && tSteps.length > 0 && tSteps.every((x) => (x.legalVerifiedAt ?? null) === null && x.legalVerified !== true), [fromTpl.status, fromTpl.body?.code, tSteps.map((x) => [x.name, x.legalVerifiedAt, x.legalVerified])]);
  }
  const copy = await call(admin, 'POST', '/processing-flows', { name: `UAT ${RUN} bản sao`, recordKind: 'PETITION', copyFromFlowId: flowId });
  const copied = idOf(copy) ? (await call(admin, 'GET', `/processing-flows/${idOf(copy)}`)).body : null;
  check('CFG-COPY', 'sao chép từ quy trình khác: bản nháp mới mang đủ 5 bước, chưa gắn Loại thông tin nào', copy.status === 201 && copied?.draft?.steps?.length === 5 && (copied?.boundTypes ?? []).length === 0, [copy.status, copy.body?.code, copied?.draft?.steps?.length]);
  if (copied) {
    const gone = await call(admin, 'DELETE', `/processing-flows/${copied.id}?expectedRevision=${copied.revision}&confirmName=${encodeURIComponent(copied.name)}`);
    check('TAO-SUA-XOA', 'quy trình chưa được dùng xoá cứng được khi gõ đúng tên', gone.status === 200, [gone.status, gone.body]);
  }

  // ── R10: the values the API answered are the values of the shared contract files ──────────────────────────────
  const contracts = ['frontend/src/shared/processing/processing-codes.generated.json', 'mobile/assets/contract/processing-codes.json'].map((file) => JSON.parse(require('node:fs').readFileSync(path.join(__dirname, '../..', file), 'utf8')));
  const seen = { bands: new Set(), stepStatuses: new Set(), partyRoles: new Set(), partyKinds: new Set(), flowMatches: new Set() };
  for (const [kind, id] of [['PETITION', petId], ['INCIDENT', incId], ['INCIDENT', inc2Id], ['CASE', openCase ? idOf(openCase) : null]]) {
    const dto = id ? (await call(admin, 'GET', `/processing/records/${kind}/${id}`)).body : null;
    if (!dto?.steps) continue;
    seen.flowMatches.add(dto.match);
    for (const st of dto.steps) { seen.bands.add(st.band); seen.stepStatuses.add(st.status); for (const pt of st.parties) { seen.partyRoles.add(pt.role); seen.partyKinds.add(pt.partyKind); } }
  }
  for (const band of ['OVERDUE', 'RED', 'YELLOW', 'GREEN']) seen.bands.add(band); // every one of them was answered by the tracking list above
  const unknown = [];
  for (const [list, values] of Object.entries(seen)) for (const v of values) for (const [n, contract] of contracts.entries()) if (!(contract[list] ?? []).includes(v)) unknown.push([n === 0 ? 'web' : 'flutter', list, v]);
  const strip = (c) => JSON.stringify({ ...c, _generated: undefined });
  check('R10', 'mọi mã mức màu / trạng thái bước / vai trò / cách khớp mà API đã trả đều có trong tệp hợp đồng của web và của Flutter; hai tệp cùng nội dung', unknown.length === 0 && strip(contracts[0]) === strip(contracts[1]) && seen.stepStatuses.size >= 2, [unknown, [...seen.stepStatuses]]);

  // ── ENFORCE: the same reach through a step, and the leadership template (C3) ──────────────────────────────────
  await enforceSection({ pg, admin, call, check, notRun, newPetition, waitFlow, idOf, cmdOn: async (token, base, tail, body) => { const now = (await call(admin, 'GET', base)).body; return call(token, 'POST', `${base}${tail}`, { expectedRevision: now.revision, ...body }); } });

  // ── PENDING-MERGE ─────────────────────────────────────────────────────────────────────────────────────────────
  const asOfQ = `asOf=${encodeURIComponent(late)}`;
  const units = await call(admin, 'GET', `/processing/backlog/units?${asOfQ}`);
  pending('BACKLOG', 'bảng Tồn đọng theo đơn vị trả lời, có dòng của tổ X', units, (r) => r.status === 200 && (r.body?.rows ?? []).some((u) => u.teamId === TX));
  const COLOURS = ['OVERDUE', 'RED', 'YELLOW', 'GREEN', 'NONE'];
  if (units.status === 200) {
    const mismatches = [];
    for (const row of units.body.rows ?? []) {
      for (const band of COLOURS) {
        const drill = await call(admin, 'GET', `/processing/tracking/items?band=${band}&teamId=${row.teamId}&${asOfQ}&pageSize=100`);
        if (row[band] !== drill.body?.total) mismatches.push([row.teamId, band, row[band], drill.status, drill.body?.total]);
      }
    }
    check('BACKLOG', 'mọi ô màu của mọi đơn vị = tổng số dòng khi mở ô đó ra, cùng một đồng hồ', (units.body.rows ?? []).length > 0 && mismatches.length === 0, mismatches);
    const sum = (k) => (units.body.rows ?? []).filter((r) => !r.parentTeamId).reduce((n, r) => n + (r[k] ?? 0), 0);
    check('C15', 'dòng tổng của bảng = tổng các đơn vị gốc (không đếm trùng)', COLOURS.every((k) => units.body.totals?.[k] === sum(k)), [units.body.totals, COLOURS.map(sum)]);
    const outsideUnits = await call(uz, 'GET', `/processing/backlog/units?${asOfQ}`);
    check('BACKLOG', 'người ngoài nhóm lãnh đạo không thấy đơn vị ngoài phạm vi của mình', outsideUnits.status === 200 && !(outsideUnits.body?.rows ?? []).some((u) => u.teamId === TX), outsideUnits.body?.rows?.map((u) => u.teamId));
  } else notRun('BACKLOG', 'PENDING-MERGE số trong ô = tổng số dòng khi mở ra', 'NOT RUN: route absent');
  if (units.status === 200) {
    for (const filter of ['kind=INCIDENT', 'kind=PETITION', 'role=COORDINATE', 'from=2026-04-01&to=2026-04-30', 'from=2026-06-01']) {
      const table = await call(admin, 'GET', `/processing/backlog/units?${asOfQ}&${filter}`);
      const off = [];
      for (const row of table.body?.rows ?? []) for (const band of COLOURS) {
        const drill = await call(admin, 'GET', `/processing/tracking/items?band=${band}&teamId=${row.teamId}&${asOfQ}&${filter}&pageSize=100`);
        if (row[band] !== drill.body?.total) off.push([row.teamId, band, row[band], drill.status, drill.body?.total]);
      }
      check('BACKLOG-FILTER', `bộ lọc ${filter}: mọi ô vẫn bằng số dòng mở ra với cùng bộ lọc`, table.status === 200 && off.length === 0, [table.status, off]);
    }
    const byRole = await call(admin, 'GET', `/processing/backlog/units?${asOfQ}&role=COORDINATE`);
    const sumOf = (row) => (row ? COLOURS.reduce((n, k) => n + row[k], 0) : 0);
    check('BACKLOG-FILTER', 'lọc vai trò Phối hợp: tổ Y (phối hợp ở bước 2 của các đơn) có việc, tổ X (chỉ xử lý chính) không có', sumOf((byRole.body?.rows ?? []).find((r) => r.teamId === TY)) > 0 && sumOf((byRole.body?.rows ?? []).find((r) => r.teamId === TX)) === 0, byRole.body?.rows);
    const later = await call(admin, 'GET', `/processing/backlog/units?${asOfQ}&from=2026-06-01`);
    check('BACKLOG-FILTER', 'lọc từ 01/06/2026: việc của các đơn bắt đầu 27/04 không còn trong bảng của tổ Y', sumOf((await call(admin, 'GET', `/processing/backlog/units?${asOfQ}&role=COORDINATE&from=2026-06-01`)).body?.rows?.find((r) => r.teamId === TY)) === 0, later.body?.rows);
  }
  const onTime = await call(admin, 'GET', `/processing/backlog/on-time?${asOfQ}`);
  pending('R5', 'báo cáo tỷ lệ đúng hạn theo đơn vị trả lời', onTime, (r) => r.status === 200 && Array.isArray(r.body?.rows));
  if (onTime.status === 200) {
    const wrong = [];
    for (const row of [...(onTime.body.rows ?? []), onTime.body.totals ?? {}]) {
      const base = row.doneOnTime + row.doneLate + row.openOverdue;
      const want = base > 0 ? row.doneOnTime / base : null;
      const ok = want === null ? row.onTimeRate === null : row.onTimeRate !== null && (Math.abs(row.onTimeRate - want) < 0.0051 || Math.abs(row.onTimeRate - want * 100) < 0.051);
      if (!ok) wrong.push([row.teamId ?? 'totals', row.doneOnTime, row.doneLate, row.openOverdue, row.onTimeRate, want]);
    }
    check('R5', 'tỷ lệ đúng hạn = đúng hạn / (đúng hạn + chậm + đang quá hạn) ở mọi dòng', (onTime.body.rows ?? []).length > 0 && wrong.length === 0, wrong);
    // The script knows what it did to team X at this clock (06/05/2026): no step was done by then (doneAt is the real "now").
    const x = (onTime.body.rows ?? []).find((r) => r.teamId === TX);
    check('R5', 'tổ X có mặt trong báo cáo và có việc đang quá hạn tính vào mẫu số', !!x && x.openOverdue > 0, x);
  }
  const xlsxRes = await fetch(`${BASE}/processing/backlog/units/export?${asOfQ}`, { headers: { Authorization: `Bearer ${admin}` } });
  if (xlsxRes.status === 404) notRun('BACKLOG-XLSX', 'PENDING-MERGE xuất Excel bảng tồn đọng', 'NOT RUN: route absent (HTTP 404)');
  else {
    const bytes = Buffer.from(await xlsxRes.arrayBuffer());
    let sheetRows = null;
    try {
      const ExcelJS = require(path.join(BACKEND, 'node_modules/exceljs'));
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(bytes);
      sheetRows = [];
      book.worksheets[0].eachRow((row) => sheetRows.push(row.values.slice(1).map((v) => (v && typeof v === 'object' && 'result' in v ? v.result : v))));
    } catch (err) { sheetRows = null; }
    check('BACKLOG-XLSX', 'tệp Excel mở được bằng ExcelJS', xlsxRes.status === 200 && Array.isArray(sheetRows) && sheetRows.length > 1, [xlsxRes.status, bytes.length]);
    if (sheetRows && units.status === 200) {
      const missing = [];
      for (const row of units.body.rows ?? []) {
        const want = [row.holding, row.OVERDUE, row.RED, row.YELLOW, row.GREEN, row.NONE];
        const line = sheetRows.find((cells) => cells.some((c) => typeof c === 'string' && c.trim() === row.teamName.trim()));
        const numbers = (line ?? []).filter((c) => typeof c === 'number');
        if (!line || !want.every((n, i) => numbers[i] === n)) missing.push([row.teamName, want, line]);
      }
      check('BACKLOG-XLSX', 'mỗi đơn vị trong tệp Excel mang đúng các số của bảng (đang giữ, quá hạn, đỏ, vàng, xanh, chưa tới ngưỡng)', missing.length === 0, missing);
    }
  }
  const openStep = (await getFlow()).body.steps.find((x) => x.status === 'OPEN');
  const nudgeBody = { message: 'UAT đôn đốc', idempotencyKey: `uat-${RUN}-nudge-1` };
  const nudge = await call(admin, 'POST', `${rec}/steps/${openStep?.stepKey}/nudge`, nudgeBody);
  pending('R4', 'nút Đôn đốc kèm lời nhắn được nhận', nudge, (r) => r.status === 200);
  if (nudge.status !== 404 || nudge.body?.code) {
    const same = await call(admin, 'POST', `${rec}/steps/${openStep?.stepKey}/nudge`, nudgeBody);
    check('R4', 'gửi lại cùng khoá idempotency: trả lời như lần đầu, không đôn đốc lần hai', same.status === 200, [same.status, same.body]);
    const soon = await call(admin, 'POST', `${rec}/steps/${openStep?.stepKey}/nudge`, { message: 'UAT đôn đốc lần hai', idempotencyKey: `uat-${RUN}-nudge-2` });
    check('R4', 'đôn đốc lần hai trong 30 phút → 429 NUDGE_TOO_SOON', soon.status === 429 && soon.body?.code === 'NUDGE_TOO_SOON', [soon.status, soon.body]);
    const book = (await call(admin, 'GET', `${rec}/steps/${openStep?.stepKey}/results`)).body;
    check('R4', 'lời đôn đốc được ghi vào sổ ý kiến của bước, đúng một lần', (JSON.stringify(book).match(/UAT đôn đốc/g) ?? []).length === 1, book?.opinions);
  }
  const hasReminders = (await pg.query(`SELECT to_regclass('public.proc_reminders') AS t`)).rows[0]?.t;
  notRun('C12', 'nhắc đúng một lần mỗi mức, không dồn, quá hạn mỗi ngày, nhắc lại sau đổi hạn', hasReminders ? 'NOT RUN: ProcessingReminderService.tick(now) runs on a 15-minute server interval at the real clock; no HTTP route and no CLI drives it with a chosen "now", and the in-process runner (wiring the service by hand as the CLI does) was not written in the time box' : 'NOT RUN: table proc_reminders absent (code not merged)');

  // ── C16: on -> written -> off -> on ───────────────────────────────────────────────────────────────────────────
  const before = (await getFlow()).body;
  const onList = await call(admin, 'GET', `/petitions?limit=50${PERIOD}`);
  listCheck('R9', 'công tắc BẬT: mỗi dòng danh sách mang trường alert', rowsOf(onList.body).length > 0 && rowsOf(onList.body).every((r) => 'alert' in r), rowsOf(onList.body)[0]);
  await setSwitches(pg, false);
  const offRec = await getFlow();
  const offTrack = await call(admin, 'GET', '/processing/tracking/summary');
  check('C16', 'TẮT sau khi đã ghi: route bước và route theo dõi trả 404', offRec.status === 404 && offTrack.status === 404, [offRec.status, offTrack.status]);
  const offNudge = await call(admin, 'POST', `${rec}/steps/${keys[2]}/nudge`, { message: 'UAT khi tắt' });
  check('C16', 'TẮT công tắc nhắc việc: route Đôn đốc trả 404', offNudge.status === 404, [offNudge.status, offNudge.body]);
  const plain = await call(admin, 'GET', `/petitions?limit=50${PERIOD}`);
  const withParams = await call(admin, 'GET', `/petitions?limit=50${PERIOD}&alertBand=OVERDUE&sortBy=alert&alertAsOf=${encodeURIComponent(late)}`);
  const ids = (res) => rowsOf(res.body).map((r) => r.id).join(',');
  listCheck('C16', 'TẮT: danh sách không có trường alert', plain.status === 200 && rowsOf(plain.body).length > 0 && rowsOf(plain.body).every((r) => !('alert' in r)), rowsOf(plain.body)[0]?.alert);
  listCheck('C16', 'TẮT: tham số alertBand / sortBy=alert không đổi gì (cùng các dòng, cùng thứ tự)', withParams.status === 200 && ids(withParams) === ids(plain) && ids(plain) === ids(onList), [withParams.status, ids(withParams), ids(plain)]);
  const yOff = await call(uy, 'GET', `/petitions/${petId}`);
  check('C16', 'TẮT: quyền đọc theo bước không còn tác dụng', [403, 404].includes(yOff.status), yOff.status);
  await setSwitches(pg, true);
  const back = (await getFlow()).body;
  check('C16', 'BẬT lại: dữ liệu các bước còn nguyên', !!back && back.revision === before.revision && JSON.stringify(back.steps.map((s) => [s.stepKey, s.status, s.regulatoryDueAt])) === JSON.stringify(before.steps.map((s) => [s.stepKey, s.status, s.regulatoryDueAt])), [before?.revision, back?.revision]);
}

/** Production runs ENFORCE: the mode is switched the way tools/uat-phan-quyen/workflow.cjs does (asked by one administrator, approved by another) and switched off again. */
async function enforceSection({ pg, admin, call, check, notRun, newPetition, waitFlow, idOf, cmdOn }) {
  const admin2 = await login(`${TAG}-admin2`);
  const uy = await login(`${TAG}-uy`);
  const uz = await login(`${TAG}-uz`);
  const ul = await login(`${TAG}-ul`);
  const skipAll = (reason) => { for (const [req, name] of [['PERM-ENFORCE', 'các ca quyền theo bước ở chế độ ENFORCE'], ['C3', 'mẫu Lãnh đạo: đọc toàn bộ, không cấp quyền sửa; người thuộc hai tổ']]) notRun(req, name, `NOT RUN: ${reason}`); };
  // The accounts of this run were inserted by SQL; the server's permission snapshot is re-read when its revision changes,
  // which the first write through the API causes. So the run's own template is created before anything else.
  const officerEntries = (reach) => Object.fromEntries(OFFICER_KEYS.map((k) => [k, /:(Petition|Incident|Case)$/.test(k) ? reach : 'ALL']));
  let own = await call(admin, 'POST', '/authz/templates', { code: `UAT-QT-${RUN}-OFFICER`, name: `UAT ${RUN} cán bộ`, entries: officerEntries('TEAM_TREE') });
  if (own.status !== 201) own = await call(admin, 'POST', '/authz/templates', { code: `UAT-QT-${RUN}-OFFICER`, name: `UAT ${RUN} cán bộ`, entries: Object.fromEntries(OFFICER_KEYS.map((k) => [k, 'TEAM_TREE'])) });
  // (created first: see the note on the snapshot above)
  if (own.status !== 201) return skipAll(`the officer template could not be created (${own.status} ${short(own.body)})`);
  const starters = await call(admin, 'POST', '/authz/templates/starters');
  const templates = await call(admin, 'GET', '/authz/templates');
  const leadership = rowsOf(templates.body).find((t) => t.code === 'STARTER_LEADERSHIP');
  check('C3', 'mẫu dựng sẵn "Lãnh đạo: xem toàn bộ, không sửa" có trong các mẫu khởi đầu', !!leadership, [starters.status, starters.body, templates.status]);
  if (!leadership) return skipAll('the leadership starter template is not there');
  const detail = (await call(admin, 'GET', `/authz/templates/${leadership.id}`)).body;
  const entries = detail?.entries ?? leadership.entries ?? {};
  const held = Object.keys(entries);
  check('C3', 'mẫu Lãnh đạo: xem Đơn thư, Vụ việc, Vụ án và các bước ở phạm vi TOÀN BỘ; không có quyền thêm / sửa / xoá nào', ['read:Petition', 'read:Incident', 'read:Case', 'read:ProcessingStep'].every((k) => entries[k] === 'ALL') && !held.some((k) => /^(write|edit|delete|create):/.test(k)), entries);
  const given = [];
  for (const [team, tpl] of [[TX, own.body.id], [TY, own.body.id], [TZ, own.body.id], [TL, leadership.id]]) given.push((await call(admin, 'PUT', `/authz/teams/${team}`, { mode: 'EXPLICIT', memberTemplateId: tpl, expectedRevision: 0 })).status);
  if (!given.every((st) => st === 200)) return skipAll(`a team could not be given its template (${given})`);
  const fingerprint = async (token) => (await call(token, 'GET', '/authz/mode/comparison')).body?.fingerprint;
  const asked = await call(admin, 'POST', '/authz/mode/requests', { reason: 'UAT quy trình', acknowledge: await fingerprint(admin) });
  const approved = await call(admin2, 'POST', `/authz/mode/requests/${asked.body?.id}/approve`, { acknowledge: await fingerprint(admin2) });
  const mode = (await call(admin, 'GET', '/authz/mode')).body;
  if (mode?.mode !== 'ENFORCE' || mode?.enforcing !== true) return skipAll(`the mode did not become ENFORCE (${asked.status} ${approved.status} ${short(approved.body)})`);
  try {
    const pet = await newPetition({ senderName: `UAT ${RUN} ENFORCE` });
    const id = idOf(pet);
    const flow = id ? await waitFlow('PETITION', id) : null;
    if (!flow) { skipAll(`no petition with a flow under ENFORCE (${pet.status} ${short(pet.body)})`); return; }
    const base = `/processing/records/PETITION/${id}`;
    const key2 = flow.steps[1].stepKey;
    const yRead = await call(uy, 'GET', `/petitions/${id}`);
    const yFlow = await call(uy, 'GET', base);
    check('PERM-ENFORCE', 'ENFORCE: cán bộ đơn vị phối hợp của bước đang mở mở được hồ sơ và các bước', yRead.status === 200 && yFlow.status === 200, [yRead.status, yFlow.status, yRead.body?.error ?? yFlow.body]);
    const yEdit = await call(uy, 'PUT', `/petitions/${id}`, { senderName: 'bị sửa' });
    check('PERM-ENFORCE', 'ENFORCE: ...nhưng KHÔNG sửa được hồ sơ', [403, 404].includes(yEdit.status), [yEdit.status, yEdit.body]);
    const yReport = await cmdOn(uy, base, `/steps/${key2}/reports`, { kind: 'PROGRESS', doneWork: 'Phối hợp (ENFORCE)' });
    check('PERM-ENFORCE', 'ENFORCE: ...và ghi được báo cáo ở bước của mình', yReport.status === 200, [yReport.status, yReport.body]);
    const zRead = await call(uz, 'GET', `/petitions/${id}`);
    const zFlow = await call(uz, 'GET', base);
    check('PERM-ENFORCE', 'ENFORCE: cán bộ tổ không liên quan bị từ chối (403/404)', [403, 404].includes(zRead.status) && [403, 404].includes(zFlow.status), [zRead.status, zFlow.status]);
    const lRead = await call(ul, 'GET', `/petitions/${id}`);
    const lFlow = await call(ul, 'GET', base);
    check('C3', 'người thuộc tổ Lãnh đạo (và một tổ thường khác) đọc được hồ sơ và các bước của đơn vị khác', lRead.status === 200 && lFlow.status === 200, [lRead.status, lFlow.status, lRead.body?.error ?? lFlow.body]);
    const lEdit = await call(ul, 'PUT', `/petitions/${id}`, { senderName: 'bị lãnh đạo sửa' });
    const after = await call(admin, 'GET', `/petitions/${id}`);
    check('C3', '...nhưng không sửa được hồ sơ ngoài tổ thường của mình: mẫu Lãnh đạo không cấp thêm quyền sửa', [403, 404].includes(lEdit.status) && !JSON.stringify(after.body).includes('bị lãnh đạo sửa'), [lEdit.status, lEdit.body]);
    const done = await cmdOn(admin, base, `/steps/${key2}/complete`, {});
    const yAfter = await call(uy, 'GET', `/petitions/${id}`);
    check('PERM-ENFORCE', 'ENFORCE: bước xong thì đơn vị phối hợp hết quyền mở hồ sơ', done.status === 200 && [403, 404].includes(yAfter.status), [done.status, yAfter.status]);
  } finally {
    const off = await call(admin, 'POST', '/authz/mode', { mode: 'OFF', reason: 'UAT xong' });
    check('PERM-ENFORCE', 'chế độ được trả về OFF bằng một bước', off.status === 200 && off.body?.mode === 'OFF', [off.status, off.body]);
  }
}

(async () => {
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  const before = (await pg.query(`SELECT "key", "enabled" FROM "feature_flags" WHERE "key" = ANY($1)`, [SWITCHES])).rows;
  const modeBefore = (await pg.query(`SELECT "value" FROM "system_settings" WHERE "key" = $1`, [MODE_KEY])).rows[0]?.value ?? null;
  try {
    const leftovers = (await pg.query(`SELECT count(*)::int AS n FROM "proc_flows"`)).rows[0].n;
    if (leftovers > 0) {
      console.error(`REFUSED: this database already holds ${leftovers} processing flow(s). The UAT needs a FRESH database (drop and recreate it, db push, install-triggers, seeds).`);
      await pg.end();
      process.exit(2);
    }
    if (before.length !== SWITCHES.length) throw new Error(`the three switches are not in feature_flags (found ${before.length}); run npm run db:seed:features`);
    await pg.query(`UPDATE "feature_flags" SET "enabled" = false WHERE "key" = ANY($1)`, [SWITCHES]);
    await sleep(SWITCH_WAIT_MS);
    await seed(pg);
    await workflow(pg);
  } catch (err) {
    check('SCRIPT', 'the workflow ran to its end', false, err instanceof Error ? err.stack : String(err));
  } finally {
    await cleanUp(pg, before, modeBefore);
    await pg.end();
  }
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`\nPASS ${count('PASS')} | FAIL ${count('FAIL')} | NOT RUN ${count('NOT RUN')} | total ${results.length}`);
  for (const r of results.filter((x) => x.status !== 'PASS')) console.log(`  ${r.status} ${r.id} [${r.req}] ${r.name}`);
  process.exit(count('FAIL') ? 1 : 0);
})();
