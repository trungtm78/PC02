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
 * feature switches, and removing the rows this run tagged. REFUSES any address that is not local.
 * Every check prints PASS | FAIL | NOT RUN with its requirement id. A NOT RUN is never a pass. Exit 0 = no FAIL.
 */
const path = require('node:path');
const { randomUUID } = require('node:crypto');

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
const TEAMS = ['x', 'y', 'c', 'i', 'z'].map((k) => `${TAG}-team-${k}`);
const [TX, TY, TC, TI, TZ] = TEAMS;
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
  const people = [[`${TAG}-admin`, admin, null], [`${TAG}-ux`, `${TAG}-officer-role`, TX], [`${TAG}-uy`, `${TAG}-officer-role`, TY], [`${TAG}-uz`, `${TAG}-officer-role`, TZ]];
  for (const [id, role, team] of people) {
    await pg.query(`INSERT INTO "users" ("id","username","email","passwordHash","roleId","isActive","twoFaSetupRequired","updatedAt") VALUES ($1,$1,$2,$3,$4,true,false,now())`, [id, `${id}@local.test`, hash, role]);
    if (team) await pg.query(`INSERT INTO "user_teams" ("userId","teamId","isLeader") VALUES ($1,$2,true)`, [id, team]);
  }
  CRIME_ID = (await pg.query(`SELECT "id" FROM "crimes" ORDER BY "id" LIMIT 1`)).rows[0]?.id ?? null;
  await pg.query(`INSERT INTO "directories" ("id","type","code","name","updatedAt") VALUES ($1,'LOAI_THONG_TIN',$1,$2,now())`, [`${TAG}-type`, TYPE_BOUND]);
}
async function setSwitches(pg, on) {
  await pg.query(`UPDATE "feature_flags" SET "enabled" = $1 WHERE "key" = ANY($2)`, [on, SWITCHES]);
  await sleep(SWITCH_WAIT_MS); // the server re-reads its switches on a short interval
}
async function cleanUp(pg, before) {
  const like = `${TAG}-%`;
  const tryQuery = (sql, args) => pg.query(sql, args).catch((err) => console.log(`clean-up skipped: ${String(err.message).slice(0, 120)}`));
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
  { name: 'B4 kết luận (tháng)', durationValue: 2, durationUnit: 'MONTH', anchor: 'RECEIVED', rollToWorkingDay: false, redDays: 2, yellowDays: 5, greenDays: 10, setsRecordDeadline: true, requiresApproval: true, maxExtensions: 1, extensionValue: 1, extensionUnit: 'MONTH', parties: [party(TX, 'MAIN')] },
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
  const newPetition = (extra = {}) => call(admin, 'POST', '/petitions', { receivedDate: RECEIVED, gioTiepNhan: '09:30', senderName: `UAT ${RUN} người gửi`, loaiThongTin: TYPE_BOUND, assignedTeamId: TX, crimeChinhId: CRIME_ID, ...extra });
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
  check('C6', `hạn chung của hồ sơ = hạn quy định của bước hạn chung (ngày ${monthDue})`, !!recDeadline && [monthDue, addDays(monthDue, 1)].includes(vnDayOf(Date.parse(recDeadline))) && vnDayOf(Date.parse(recDeadline) - 1) === monthDue || String(recDeadline).slice(0, 10) === monthDue, recDeadline);

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
  const listAt = async (asOf, extra = '') => call(admin, 'GET', `/petitions?limit=50&alertAsOf=${encodeURIComponent(asOf)}${extra}`);
  const rowOf = (res) => rowsOf(res.body).find((r) => r.id === petId);
  const onBase = !!rowOf(await call(admin, 'GET', '/petitions?limit=50'));
  check('LIST-BASE', 'hồ sơ vừa tạo có mặt trên danh sách Đơn thư của quản trị (điều kiện để kiểm cột Cảnh báo)', onBase, 'GET /petitions?limit=50 does not return the petition that GET /petitions/:id returns');
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
  const reportId = result.body?.report?.id ?? result.body?.reportId ?? (await call(admin, 'GET', `${rec}/steps/${keys[3]}/results`)).body?.reports?.[0]?.id;
  const edited = await cmd(ux, `/steps/${keys[3]}/reports/${reportId}/edit`, { doneWork: 'Đã kết luận (sửa sau khi lãnh đạo đã mở)' });
  check('C8-APPROVE', 'người báo cáo sửa được báo cáo kết quả khi bước đang chờ duyệt (phiên bản báo cáo tăng)', edited.status === 200, [edited.status, edited.body?.code, reportId]);
  if (edited.status !== 200) await cmd(admin, `/steps/${keys[2]}/due`, { date: addDays(wdDue, -1), reason: 'UAT: another write after the leader read' });
  const staleAgree = await call(admin, 'POST', `${rec}/steps/${keys[3]}/decision`, { verdict: 'AGREE', expectedRevision: seenByLeader });
  rf = (await getFlow()).body;
  check('C8-APPROVE', 'lãnh đạo đồng ý trên trạng thái đã cũ (báo cáo / hồ sơ đã đổi sau khi đọc) → 409, bước chưa xong', staleAgree.status === 409 && step(rf, 3).status === 'REPORTED', [staleAgree.status, staleAgree.body?.code, step(rf, 3).status]);
  const rework = await cmd(admin, `/steps/${keys[3]}/decision`, { verdict: 'DISAGREE', content: 'Yêu cầu bổ sung, làm lại' });
  rf = (await getFlow()).body;
  check('C8-REWORK', '"Yêu cầu bổ sung" mở lại bước (OPEN)', rework.status === 200 && step(rf, 3).status === 'OPEN', [rework.status, rework.body, step(rf, 3).status]);
  const result2 = await cmd(ux, `/steps/${keys[3]}/reports`, { kind: 'RESULT', doneWork: 'Đã bổ sung và kết luận' });
  const agree = await cmd(admin, `/steps/${keys[3]}/decision`, { verdict: 'AGREE' });
  rf = (await getFlow()).body;
  check('C8-APPROVE', 'lãnh đạo đồng ý đúng phiên bản báo cáo mới nhất → bước DONE', result2.status === 200 && agree.status === 200 && step(rf, 3).status === 'DONE', [result2.status, agree.status, agree.body, step(rf, 3).status]);
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
  const kase = await call(admin, 'POST', '/cases', { name: `UAT ${RUN} vụ án`, loaiThongTin: TYPE_BOUND, assignedTeamId: TX });
  const caseId = kase.body?.id ?? kase.body?.data?.id;
  if (kase.status !== 201) notRun('R11', 'Vụ án không có quy trình cho loại hồ sơ đó: không tự có quy trình, không tự tính hạn', `NOT RUN: the script could not create a case over HTTP (${kase.status} ${short(kase.body)})`);
  else {
    await sleep(4000);
    const cflow = await call(admin, 'GET', `/processing/records/CASE/${caseId}`);
    const crow = await call(admin, 'GET', `/cases/${caseId}`);
    check('R11', 'Vụ án khi không có quy trình nào cho Vụ án: không có quy trình, hạn không tự tính', cflow.status === 404 && (crow.body?.deadline ?? crow.body?.data?.deadline ?? null) === null, [cflow.status, cflow.body, crow.body?.deadline]);
  }

  // ── not drivable or not built ─────────────────────────────────────────────────────────────────────────────────
  notRun('R3', 'tạm đình chỉ dừng đồng hồ, phục hồi dời hạn đúng bằng thời gian dừng', 'NOT RUN: the pause is settled by a 60 s server interval on the real clock; no HTTP route drives it and no frozen clock exists');
  notRun('C1', 'Vụ án HẠN CHẾ không lộ qua bước', 'NOT RUN: not built in the time box (needs a restricted case and a step party on it)');
  notRun('C3', 'mẫu Lãnh đạo: đọc toàn bộ, không sửa; người thuộc hai tổ', 'NOT RUN: not built in the time box (needs ENFORCE with team templates and a second administrator)');
  notRun('PERM-ENFORCE', 'các ca quyền chạy ở chế độ ENFORCE như production', 'NOT RUN: the permission checks above ran with role permissions + data scope (mode OFF), not ENFORCE');

  // ── PENDING-MERGE ─────────────────────────────────────────────────────────────────────────────────────────────
  const asOfQ = `asOf=${encodeURIComponent(late)}`;
  const units = await call(admin, 'GET', `/processing/backlog/units?${asOfQ}`);
  pending('BACKLOG', 'bảng Tồn đọng theo đơn vị trả lời, có dòng của tổ X', units, (r) => r.status === 200 && JSON.stringify(r.body).includes(TX));
  if (units.status === 200) {
    const rows = rowsOf(units.body?.units ?? units.body);
    const row = rows.find((u) => (u.teamId ?? u.id) === TX);
    const mismatches = [];
    for (const [cell, band] of [['overdue', 'OVERDUE'], ['red', 'RED'], ['yellow', 'YELLOW'], ['green', 'GREEN']]) {
      const drill = await call(admin, 'GET', `/processing/tracking/items?band=${band}&teamId=${TX}&${asOfQ}&pageSize=100`);
      const shown = row?.[cell] ?? row?.counts?.[band];
      if (shown !== drill.body?.total) mismatches.push([band, shown, drill.body?.total]);
    }
    check('BACKLOG', 'số trong ô của tổ X = tổng số dòng khi mở ra, cùng một đồng hồ', !!row && mismatches.length === 0, [row, mismatches]);
  } else notRun('BACKLOG', 'PENDING-MERGE số trong ô = tổng số dòng khi mở ra', 'NOT RUN: route absent');
  pending('R5', 'tỷ lệ đúng hạn theo đơn vị trả lời', await call(admin, 'GET', `/processing/backlog/on-time?${asOfQ}`), (r) => r.status === 200);
  const xlsx = await call(admin, 'GET', `/processing/backlog/units/export?${asOfQ}`);
  pending('BACKLOG-XLSX', 'xuất Excel bảng tồn đọng mở được (tệp zip "PK")', xlsx, (r) => r.status === 200 && r.text.startsWith('PK'));
  if (xlsx.status === 200) notRun('BACKLOG-XLSX', 'số trong tệp Excel = số trên bảng', 'NOT RUN: reading the cells needs a spreadsheet parser; not written');
  const nudge = await cmd(admin, `/steps/${keys[2]}/nudge`, { message: 'UAT đôn đốc' });
  pending('R4', 'nút Đôn đốc kèm lời nhắn được nhận', nudge, (r) => r.status === 200 || r.status === 201);
  const hasReminders = (await pg.query(`SELECT to_regclass('public.proc_reminders') AS t`)).rows[0]?.t;
  notRun('C12', 'PENDING-MERGE nhắc đúng một lần mỗi mức, không dồn, quá hạn mỗi ngày, nhắc lại sau đổi hạn', hasReminders ? 'NOT RUN: ProcessingReminderService.tick(now) has no HTTP trigger; needs an in-process harness' : 'NOT RUN: table proc_reminders absent (code not merged)');
  const pkg = require(path.join(BACKEND, 'package.json'));
  notRun('R6', 'PENDING-MERGE CLI áp quy trình: chạy thử không ghi gì', pkg.scripts?.['proc:apply-flows'] ? 'NOT RUN: the script exists but the dry-run check is not written' : 'NOT RUN: npm script proc:apply-flows absent (code not merged)');

  // ── C16: on -> written -> off -> on ───────────────────────────────────────────────────────────────────────────
  const before = (await getFlow()).body;
  const onList = await call(admin, 'GET', '/petitions?limit=50');
  listCheck('R9', 'công tắc BẬT: mỗi dòng danh sách mang trường alert', rowsOf(onList.body).length > 0 && rowsOf(onList.body).every((r) => 'alert' in r), rowsOf(onList.body)[0]);
  await setSwitches(pg, false);
  const offRec = await getFlow();
  const offTrack = await call(admin, 'GET', '/processing/tracking/summary');
  check('C16', 'TẮT sau khi đã ghi: route bước và route theo dõi trả 404', offRec.status === 404 && offTrack.status === 404, [offRec.status, offTrack.status]);
  const plain = await call(admin, 'GET', '/petitions?limit=50');
  const withParams = await call(admin, 'GET', `/petitions?limit=50&alertBand=OVERDUE&sortBy=alert&alertAsOf=${encodeURIComponent(late)}`);
  const ids = (res) => rowsOf(res.body).map((r) => r.id).join(',');
  listCheck('C16', 'TẮT: danh sách không có trường alert', plain.status === 200 && rowsOf(plain.body).length > 0 && rowsOf(plain.body).every((r) => !('alert' in r)), rowsOf(plain.body)[0]?.alert);
  listCheck('C16', 'TẮT: tham số alertBand / sortBy=alert không đổi gì (cùng các dòng, cùng thứ tự)', withParams.status === 200 && ids(withParams) === ids(plain) && ids(plain) === ids(onList), [withParams.status, ids(withParams), ids(plain)]);
  const yOff = await call(uy, 'GET', `/petitions/${petId}`);
  check('C16', 'TẮT: quyền đọc theo bước không còn tác dụng', [403, 404].includes(yOff.status), yOff.status);
  await setSwitches(pg, true);
  const back = (await getFlow()).body;
  check('C16', 'BẬT lại: dữ liệu các bước còn nguyên', !!back && back.revision === before.revision && JSON.stringify(back.steps.map((s) => [s.stepKey, s.status, s.regulatoryDueAt])) === JSON.stringify(before.steps.map((s) => [s.stepKey, s.status, s.regulatoryDueAt])), [before?.revision, back?.revision]);
}

(async () => {
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  const before = (await pg.query(`SELECT "key", "enabled" FROM "feature_flags" WHERE "key" = ANY($1)`, [SWITCHES])).rows;
  try {
    if (before.length !== SWITCHES.length) throw new Error(`the three switches are not in feature_flags (found ${before.length}); run npm run db:seed:features`);
    await pg.query(`UPDATE "feature_flags" SET "enabled" = false WHERE "key" = ANY($1)`, [SWITCHES]);
    await sleep(SWITCH_WAIT_MS);
    await seed(pg);
    await workflow(pg);
  } catch (err) {
    check('SCRIPT', 'the workflow ran to its end', false, err instanceof Error ? err.stack : String(err));
  } finally {
    await cleanUp(pg, before);
    await pg.end();
  }
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`\nPASS ${count('PASS')} | FAIL ${count('FAIL')} | NOT RUN ${count('NOT RUN')} | total ${results.length}`);
  for (const r of results.filter((x) => x.status !== 'PASS')) console.log(`  ${r.status} ${r.id} [${r.req}] ${r.name}`);
  process.exit(count('FAIL') ? 1 : 0);
})();
