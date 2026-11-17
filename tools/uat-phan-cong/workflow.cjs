/**
 * UAT of "Hồ sơ phân công Công an cấp phường/xã", through the real HTTP API, on a LOCAL stack only, in ENFORCE mode
 * (as production runs) with the two starter templates given to the teams.
 *
 *   E2E_DB=postgresql://postgres:postgres@127.0.0.1:5433/pc02_uat_phan_cong \
 *   E2E_BASE=http://127.0.0.1:3917/api/v1 node tools/uat-phan-cong/workflow.cjs
 *
 * The backend must run against that database with FEATURE_FLAG_CACHE_TTL_MS=1000.
 *
 * ORACLE: the owner's decisions of 16/11/2026 (statuses Trình duyệt → Đã duyệt / Trả về, the ward unit corrects and
 * submits again, the count of submissions, PC02 enters block 3 with defaults: due = received + 2 months, the real
 * completion day, a reason for every way back) and the plan's decisions (A3 segregation, A5 no leak outside the unit,
 * A14 conflicts, A15 what counts as a submission, R3, R6, C7). The calendar arithmetic below is this script's own.
 * Nothing expected is read back from the product.
 *
 * Direct SQL only for set-up the API cannot do: accounts, teams, the ward directory rows, the feature switch.
 * Every check prints PASS | FAIL | NOT RUN with its requirement id. A NOT RUN is never a pass. Exit 0 = no FAIL.
 */
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3917/api/v1';
const DB_URL = process.env.E2E_DB;
const BACKEND = path.join(__dirname, '../../backend');
const SWITCH_WAIT_MS = Number(process.env.UAT_SWITCH_WAIT_MS || 3_000);
const SWITCH = 'ward-assignments';
const MODE_KEY = 'QUYEN_THEO_TO_CHE_DO';

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
  console.error('REFUSED: the address is not local; this script writes data, flips a feature switch and the permission mode.');
  process.exit(2);
}

const bcrypt = require(path.join(BACKEND, 'node_modules/bcrypt'));
const { Client } = require(path.join(BACKEND, 'node_modules/pg'));

const RUN = randomUUID().slice(0, 8);
const TAG = `uat-pc-${RUN}`;
const PASSWORD = `Uat-${randomUUID()}!`;

// ── results ─────────────────────────────────────────────────────────────────────────────────────────────────────
const results = [];
let seq = 0;
const short = (v) => (typeof v === 'string' ? v : JSON.stringify(v) ?? String(v)).slice(0, 600);
function record(req, name, status, detail) {
  seq += 1;
  const id = `PC-${String(seq).padStart(3, '0')}`;
  results.push({ id, req, name, status });
  console.log(`${status.padEnd(7)} ${id} [${req}] ${name}${status === 'PASS' || detail === undefined ? '' : `\n          -> ${short(detail)}`}`);
}
const check = (req, name, ok, detail) => record(req, name, ok ? 'PASS' : 'FAIL', detail);
const notRun = (req, name, reason) => record(req, name, 'NOT RUN', reason);
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
  return { status: res.status, body: json, text };
}
/** A download: status, type and the first bytes (a .docx is a zip: "PK"). */
async function fetchFile(token, url) {
  const res = await fetch(`${BASE}${url}`, { headers: { Authorization: `Bearer ${token}` } });
  const bytes = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type') ?? '', bytes };
}
async function upload(token, url, name, type, bytes) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  const res = await fetch(`${BASE}${url}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body: json, text };
}
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const refused = (res, status, code) => res.status === status && JSON.stringify(res.body ?? '').includes(code);
const rowsOf = (body) => body?.data ?? body?.items ?? (Array.isArray(body) ? body : []);
const ymd = (v) => (v ? String(v).slice(0, 10) : null);

// ── the script's own calendar (Viet Nam = UTC+7, no daylight saving) ────────────────────────────────────────────
const VN = 7 * 3600 * 1000;
const todayVn = () => new Date(Date.now() + VN).toISOString().slice(0, 10);
function addMonths(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// ── set-up (SQL: only what the API cannot do) ───────────────────────────────────────────────────────────────────
const T = { WA: `${TAG}-wa`, WB: `${TAG}-wb`, P: `${TAG}-p` };
const U = { a1: `${TAG}-a1`, a2: `${TAG}-a2`, b1: `${TAG}-b1`, rev: `${TAG}-rev`, both: `${TAG}-both`, admin: `${TAG}-admin`, admin2: `${TAG}-admin2` };
let CRIME_ID = null;
async function seed(pg) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const admin = (await pg.query(`SELECT "id" FROM "roles" WHERE "name" = 'ADMIN'`)).rows[0]?.id;
  const officer = (await pg.query(`SELECT "id" FROM "roles" WHERE "name" = 'OFFICER'`)).rows[0]?.id;
  if (!admin || !officer) throw new Error('No ADMIN or OFFICER role: run the seeds first');
  await pg.query(`INSERT INTO "role_permissions" ("roleId","permissionId") SELECT $1, "id" FROM "permissions" ON CONFLICT DO NOTHING`, [admin]);
  for (const [team, key] of [[T.WA, 'a'], [T.WB, 'b']]) {
    const ward = `${TAG}-ward-${key}`;
    await pg.query(`INSERT INTO "directories" ("id","type","code","name","updatedAt") VALUES ($1,'WARD',$1,$2,now())`, [ward, `Phường UAT ${RUN} ${key.toUpperCase()}`]);
    await pg.query(`INSERT INTO "teams" ("id","name","code","wardId","updatedAt") VALUES ($1,$2,$1,$3,now())`, [team, `CA phường UAT ${RUN} ${key.toUpperCase()}`, ward]);
  }
  await pg.query(`INSERT INTO "teams" ("id","name","code","updatedAt") VALUES ($1,$2,$1,now())`, [T.P, `Đội UAT ${RUN} PC02`]);
  const people = [[U.a1, officer, [T.WA]], [U.a2, officer, [T.WA]], [U.b1, officer, [T.WB]], [U.rev, officer, [T.P]], [U.both, officer, [T.WA, T.P]], [U.admin, admin, []], [U.admin2, admin, []]];
  for (const [id, role, teams] of people) {
    await pg.query(`INSERT INTO "users" ("id","username","email","passwordHash","roleId","isActive","twoFaSetupRequired","phone","updatedAt") VALUES ($1,$1,$2,$3,$4,true,false,'0900000000',now())`, [id, `${id}@local.test`, hash, role]);
    for (const team of teams) await pg.query(`INSERT INTO "user_teams" ("userId","teamId","isLeader") VALUES ($1,$2,false)`, [id, team]);
  }
  CRIME_ID = (await pg.query(`SELECT "id" FROM "crimes" ORDER BY "id" LIMIT 1`)).rows[0]?.id ?? null;
  if (!CRIME_ID) throw new Error('No crime in the catalogue: run the seeds first');
}
async function setSwitch(pg, on) {
  await pg.query(`UPDATE "feature_flags" SET "enabled" = $1 WHERE "key" = $2`, [on, SWITCH]);
  await sleep(SWITCH_WAIT_MS);
}

// ── ENFORCE with the starter templates (as tools/uat-quy-trinh does: asked by one administrator, approved by another) ──
async function enforce(admin, admin2) {
  const starters = await call(admin, 'POST', '/authz/templates/starters');
  const templates = rowsOf((await call(admin, 'GET', '/authz/templates')).body);
  const submitT = templates.find((t) => t.code === 'STARTER_WARD_SUBMIT');
  const reviewT = templates.find((t) => t.code === 'STARTER_WARD_REVIEW');
  check('AUTHZ', 'hai mẫu quyền dựng sẵn "Phường/xã: trình phân công" và "PC02: thẩm định phân công" có trong các mẫu khởi đầu', !!submitT && !!reviewT, [starters.status, starters.body]);
  if (!submitT || !reviewT) return false;
  const sub = (await call(admin, 'GET', `/authz/templates/${submitT.id}`)).body?.entries ?? {};
  const rev = (await call(admin, 'GET', `/authz/templates/${reviewT.id}`)).body?.entries ?? {};
  check('AUTHZ', 'mẫu phường/xã: xem, thêm, sửa, xoá hồ sơ của đơn vị mình (Cả tổ), KHÔNG có quyền thẩm định', ['read', 'write', 'edit', 'delete'].every((a) => sub[`${a}:WardAssignment`] === 'TEAM_TREE') && !sub['review:WardAssignment'], sub);
  check('AUTHZ', 'mẫu PC02: xem và thẩm định Toàn bộ, KHÔNG sửa nội dung hồ sơ', rev['read:WardAssignment'] === 'ALL' && rev['review:WardAssignment'] === 'ALL' && !rev['edit:WardAssignment'] && !rev['write:WardAssignment'], rev);
  const given = [];
  for (const [team, tpl] of [[T.WA, submitT.id], [T.WB, submitT.id], [T.P, reviewT.id]]) given.push((await call(admin, 'PUT', `/authz/teams/${team}`, { mode: 'EXPLICIT', memberTemplateId: tpl, expectedRevision: 0, reason: 'UAT phân công phường/xã' })).status);
  check('AUTHZ', 'áp mẫu cho hai tổ phường/xã và tổ PC02', given.every((s) => s === 200), given);
  const fingerprint = async (token) => (await call(token, 'GET', '/authz/mode/comparison')).body?.fingerprint;
  const asked = await call(admin, 'POST', '/authz/mode/requests', { reason: 'UAT phân công phường/xã', acknowledge: await fingerprint(admin) });
  const approved = await call(admin2, 'POST', `/authz/mode/requests/${asked.body?.id}/approve`, { acknowledge: await fingerprint(admin2) });
  const mode = (await call(admin, 'GET', '/authz/mode')).body;
  check('AUTHZ', 'chế độ quyền theo tổ chuyển sang ENFORCE (như production)', mode?.mode === 'ENFORCE' && mode?.enforcing === true, [asked.status, approved.status, short(approved.body), mode]);
  return mode?.mode === 'ENFORCE';
}

// ── the workflow ────────────────────────────────────────────────────────────────────────────────────────────────
async function workflow(pg) {
  const tk = {};
  for (const [k, u] of Object.entries(U)) tk[k] = await login(u);
  check('SETUP', 'bảy tài khoản đăng nhập được', Object.values(tk).every(Boolean), Object.fromEntries(Object.entries(tk).map(([k, v]) => [k, !!v])));
  if (!tk.admin) return;

  // Switch (the feature is OFF on production until the owner checks it)
  const off = await call(tk.admin, 'GET', '/ward-assignments');
  check('FLAG', 'công tắc TẮT: route hồ sơ phân công không trả lời (404)', off.status === 404, [off.status, off.body]);
  await setSwitch(pg, true);
  const on = await call(tk.admin, 'GET', '/ward-assignments');
  check('FLAG', 'công tắc BẬT: quản trị mở được danh sách', on.status === 200, [on.status, on.body]);
  if (!(await enforce(tk.admin, tk.admin2))) return notRun('ALL', 'các ca theo quyền', 'NOT RUN: ENFORCE could not be switched on');
  try {
    await journeys(tk);
  } finally {
    const back = await call(tk.admin, 'POST', '/authz/mode', { mode: 'OFF', reason: 'UAT xong' });
    check('AUTHZ', 'chế độ quyền trả về OFF bằng một bước', back.status === 200 && back.body?.mode === 'OFF', [back.status, back.body]);
  }
}

async function journeys(tk) {
  const today = todayVn();
  // Return reasons catalogue (R1)
  const reasons = await call(tk.rev, 'GET', '/ward-assignments/return-reasons');
  const codes = rowsOf(reasons.body).map((r) => r.code);
  check('R1', 'danh mục lý do trả về có sẵn 5 lý do khởi đầu', ['THIEU_TAI_LIEU', 'SAI_THAM_QUYEN', 'THONG_TIN_CHUA_DU', 'DTV_KHONG_PHU_HOP', 'KHAC'].every((c) => codes.includes(c)), reasons.body);

  // Investigators of the ward unit ("ĐTV thừa uỷ quyền")
  const inv1 = await call(tk.a1, 'POST', '/ward-investigators', { teamId: T.WA, fullName: 'Lê Văn Cường', rank: 'Thượng úy', position: 'Phó Trưởng Công an phường', grade: 'Điều tra viên sơ cấp' });
  const inv2 = await call(tk.a1, 'POST', '/ward-investigators', { teamId: T.WA, fullName: 'Ngô Thị Dung', rank: 'Đại úy', position: 'Trưởng Công an phường', grade: 'Điều tra viên trung cấp' });
  check('INV', 'phường A thêm hai ĐTV vào danh bạ của đơn vị mình', inv1.status === 201 && inv2.status === 201, [inv1.status, inv1.body, inv2.status]);
  const I1 = inv1.body?.id, I2 = inv2.body?.id;
  const invB = await call(tk.b1, 'POST', '/ward-investigators', { teamId: T.WA, fullName: 'Người lạ' });
  check('INV', 'phường B KHÔNG thêm được ĐTV vào danh bạ phường A', invB.status >= 400 && invB.status < 500, [invB.status, invB.body]);
  const listB = await call(tk.b1, 'GET', `/ward-investigators?teamId=${T.WA}`);
  check('A5', 'phường B không đọc được danh bạ ĐTV phường A', listB.status >= 400 || rowsOf(listB.body).length === 0, [listB.status, listB.body]);

  // Draft, validation for submission
  const content = (over = {}) => ({
    caseType: 'CASE', kind: 'NEW', crimeId: CRIME_ID, summary: `UAT ${RUN} Nhóm đánh bạc tại hẻm 12`, content: 'Ngày 10/11 phát hiện nhóm đối tượng tổ chức đánh bạc.', discoveredOn: '2026-11-10', place: 'Hẻm 12 đường Vườn Lài',
    subjectsUnknown: false, subjects: [{ fullName: 'Nguyễn Văn An', birthYear: 1990, idNumber: '079090000001', address: 'Vườn Lài' }], proposedInvestigatorId: I1, entryOfficerName: 'Phạm Thị Hoa', entryOfficerPhone: '0901234567', ...over,
  });
  const incomplete = await call(tk.a1, 'POST', '/ward-assignments', content({ subjectsUnknown: false, subjects: [], proposedInvestigatorId: null }));
  check('DRAFT', 'lưu nháp được khi còn thiếu thông tin', incomplete.status === 201 && incomplete.body?.status === 'DRAFT' && incomplete.body?.assignedTeamId === T.WA, [incomplete.status, incomplete.body]);
  const subInc = await call(tk.a1, 'POST', `/ward-assignments/${incomplete.body?.id}/submit`, { expectedUpdatedAt: incomplete.body?.updatedAt });
  check('DRAFT', 'trình khi thiếu đối tượng và ĐTV đề xuất bị từ chối, nêu rõ ô thiếu', refused(subInc, 400, 'WARD_ASSIGNMENT_INCOMPLETE') && JSON.stringify(subInc.body).includes('subjects') && JSON.stringify(subInc.body).includes('proposedInvestigatorId'), [subInc.status, subInc.body]);
  const delDraft = await call(tk.a1, 'DELETE', `/ward-assignments/${incomplete.body?.id}?expectedUpdatedAt=${encodeURIComponent(incomplete.body?.updatedAt)}`);
  const delGone = await call(tk.a1, 'GET', `/ward-assignments/${incomplete.body?.id}`);
  check('CRUD', 'nháp chưa từng trình xoá hẳn được', delDraft.status === 200 && delGone.status === 404, [delDraft.status, delDraft.body, delGone.status]);

  const made = await call(tk.a1, 'POST', '/ward-assignments', content());
  const id = made.body?.id;
  check('DRAFT', 'phường A lập hồ sơ: đơn vị tự điền là tổ của mình, trạng thái Nháp, chưa có mã', made.status === 201 && made.body?.assignedTeamId === T.WA && made.body?.status === 'DRAFT' && !made.body?.code, [made.status, made.body]);
  if (!id) return;
  const get = (token) => call(token, 'GET', `/ward-assignments/${id}`);
  const stampOf = async () => (await get(tk.admin)).body?.updatedAt;

  // A5: another ward unit does not see it
  const bGet = await get(tk.b1);
  const bList = await call(tk.b1, 'GET', '/ward-assignments');
  check('A5', 'phường B không mở được hồ sơ phường A (404) và không thấy trong danh sách', bGet.status === 404 && !rowsOf(bList.body).some((r) => r.id === id), [bGet.status, bList.status]);
  const a2Get = await get(tk.a2);
  check('SCOPE', 'cán bộ khác cùng phường A mở được hồ sơ của đơn vị', a2Get.status === 200, [a2Get.status, a2Get.body]);

  // Submit, withdraw, submit again (A15)
  const sub1 = await call(tk.a1, 'POST', `/ward-assignments/${id}/submit`, { expectedUpdatedAt: made.body.updatedAt });
  check('SUBMIT', 'trình: trạng thái Đã trình, Lần trình = 1, có mã dạng năm-số', sub1.status === 200 && sub1.body?.status === 'SUBMITTED' && sub1.body?.submissionCount === 1 && /^\d{4}-\d+$/.test(sub1.body?.code ?? ''), [sub1.status, sub1.body]);
  const code = sub1.body?.code;
  check('SUBMIT', 'mã mang năm hiện tại', String(code).startsWith(today.slice(0, 4)), code);
  const twice = await call(tk.a1, 'POST', `/ward-assignments/${id}/submit`, { expectedUpdatedAt: made.body.updatedAt });
  check('A14', 'bấm Trình lần hai với bản cũ: 409, không sinh lượt thứ hai', twice.status === 409, [twice.status, twice.body]);
  const editSub = await call(tk.a1, 'PATCH', `/ward-assignments/${id}`, { ...content({ summary: 'sửa lúc chờ duyệt' }), expectedUpdatedAt: sub1.body.updatedAt });
  check('STATE', 'sửa khi đang chờ duyệt bị từ chối', refused(editSub, 409, 'WARD_ASSIGNMENT_NOT_EDITABLE'), [editSub.status, editSub.body]);
  const wd = await call(tk.a1, 'POST', `/ward-assignments/${id}/withdraw`, { expectedUpdatedAt: sub1.body.updatedAt });
  check('A15', 'rút lại khi PC02 chưa xử lý: về Nháp, lượt đó không tính (Lần trình = 0)', wd.status === 200 && wd.body?.status === 'DRAFT' && wd.body?.submissionCount === 0, [wd.status, wd.body]);
  const sub2 = await call(tk.a1, 'POST', `/ward-assignments/${id}/submit`, { expectedUpdatedAt: wd.body.updatedAt });
  check('A15', 'trình lại sau khi rút: Lần trình vẫn = 1, giữ nguyên mã', sub2.status === 200 && sub2.body?.submissionCount === 1 && sub2.body?.code === code, [sub2.status, sub2.body]);

  // The ward unit cannot review; somebody in both units cannot decide (A3)
  const wardApprove = await call(tk.a1, 'POST', `/ward-assignments/${id}/approve`, { expectedUpdatedAt: sub2.body.updatedAt, assignedInvestigatorId: I1 });
  check('A2', 'cán bộ phường/xã không thẩm định được (403)', wardApprove.status === 403, [wardApprove.status, wardApprove.body]);
  const bothApprove = await call(tk.both, 'POST', `/ward-assignments/${id}/approve`, { expectedUpdatedAt: sub2.body.updatedAt, assignedInvestigatorId: I1 });
  check('A3', 'người vừa ở phường A vừa ở PC02 không duyệt được hồ sơ của phường A', refused(bothApprove, 403, 'WARD_REVIEW_OWN_UNIT_FORBIDDEN'), [bothApprove.status, bothApprove.body]);
  const bothView = await get(tk.both);
  check('A3', '...và màn hình của người đó không hiện nút Duyệt / Trả về', bothView.status === 200 && bothView.body?.can?.approve === false && bothView.body?.can?.returnIt === false, bothView.body?.can);
  const revView = await get(tk.rev);
  check('UI-CAN', 'màn hình PC02 hiện nút Duyệt, Trả về; không hiện nút Sửa', revView.body?.can?.approve === true && revView.body?.can?.returnIt === true && revView.body?.can?.edit === false, revView.body?.can);

  // Three returns and resubmissions: the count is 1, 2, 3, 4 (owner: "đếm số lần trình duyệt lại")
  let stamp = sub2.body.updatedAt;
  const noReason = await call(tk.rev, 'POST', `/ward-assignments/${id}/return`, { expectedUpdatedAt: stamp, requirements: [] });
  check('RETURN', 'trả về không có lý do bị từ chối', refused(noReason, 400, 'WARD_RETURN_REASON_REQUIRED'), [noReason.status, noReason.body]);
  const blankReq = await call(tk.rev, 'POST', `/ward-assignments/${id}/return`, { expectedUpdatedAt: stamp, reasonCode: 'THIEU_TAI_LIEU', requirements: ['Ghi lời khai', '  '] });
  check('RETURN', 'yêu cầu để trống bị từ chối kèm số thứ tự của nó', refused(blankReq, 400, 'WARD_REQUIREMENT_EMPTY') && JSON.stringify(blankReq.body).includes('"position":2'), [blankReq.status, blankReq.body]);
  const requirements = ['Ghi lời khai bổ sung của người làm chứng', 'Trích xuất camera khu vực hẻm 12', 'Xác minh nhân thân đối tượng'];
  for (let round = 1; round <= 3; round += 1) {
    const back = await call(tk.rev, 'POST', `/ward-assignments/${id}/return`, { expectedUpdatedAt: stamp, reasonCode: 'THIEU_TAI_LIEU', reasonText: `Lần ${round}: thiếu tài liệu`, requirements });
    check('RETURN', `lượt ${round}: PC02 trả về kèm lý do và 3 yêu cầu → Trả về`, back.status === 200 && back.body?.status === 'RETURNED', [back.status, back.body]);
    const seen = (await get(tk.a1)).body;
    const last = seen?.rounds?.at(-1)?.decisions?.at(-1);
    check('RETURN', `lượt ${round}: phường A thấy lý do và đúng 3 yêu cầu theo thứ tự`, last?.kind === 'RETURN' && last?.reasonCode === 'THIEU_TAI_LIEU' && JSON.stringify(last?.requirements) === JSON.stringify(requirements), last);
    const blocked = await call(tk.a1, 'PATCH', `/ward-assignments/${id}/follow-up`, { expectedUpdatedAt: back.body?.updatedAt, resultText: 'x' });
    if (round === 1) check('A2', 'phường/xã không ghi được khối 3 (kết quả) qua HTTP (403 vì quyền, không phải route vắng)', blocked.status === 403, [blocked.status, blocked.body]);
    const edited = await call(tk.a1, 'PATCH', `/ward-assignments/${id}`, { ...content({ summary: `UAT ${RUN} đã bổ sung lần ${round}` }), expectedUpdatedAt: back.body?.updatedAt });
    check('EDIT', `lượt ${round}: phường A sửa được hồ sơ bị trả về`, edited.status === 200, [edited.status, edited.body]);
    const again = await call(tk.a1, 'POST', `/ward-assignments/${id}/submit`, { expectedUpdatedAt: edited.body?.updatedAt });
    check('COUNT', `lượt ${round}: trình lại → Đã trình, Lần trình = ${round + 1}`, again.status === 200 && again.body?.status === 'SUBMITTED' && again.body?.submissionCount === round + 1, [again.status, again.body]);
    stamp = again.body?.updatedAt;
  }
  const history = (await get(tk.rev)).body;
  check('Q1', 'lịch sử có 5 lượt (1 đã rút + 4 lượt trình), mỗi lượt giữ bản chụp nội dung lúc trình', history?.rounds?.length === 5 && history.rounds.filter((r) => r.status === 'WITHDRAWN').length === 1 && history.rounds.every((r) => r.snapshot && typeof r.snapshot === 'object'), history?.rounds?.map((r) => [r.sequence, r.submissionNo, r.status]));
  check('Q1', 'bản chụp lượt 2 giữ trích yếu cũ, lượt 4 giữ trích yếu đã sửa lần 2', String(JSON.stringify(history?.rounds?.[1]?.snapshot)).includes('Nhóm đánh bạc tại hẻm 12') && String(JSON.stringify(history?.rounds?.[3]?.snapshot)).includes('đã bổ sung lần 2'), [history?.rounds?.[1]?.snapshot?.summary, history?.rounds?.[3]?.snapshot?.summary]);

  // Approve and assign (owner: the ĐTV + the PC02 follower and unit; due = received + 2 months)
  const stale = await call(tk.rev, 'POST', `/ward-assignments/${id}/approve`, { expectedUpdatedAt: sub2.body.updatedAt, assignedInvestigatorId: I2 });
  check('A14', 'duyệt với bản cũ: 409 "hồ sơ đã thay đổi"', refused(stale, 409, 'WARD_ASSIGNMENT_CHANGED'), [stale.status, stale.body]);
  const ok = await call(tk.rev, 'POST', `/ward-assignments/${id}/approve`, { expectedUpdatedAt: stamp, assignedInvestigatorId: I2, requirements: ['Báo kết quả trước hạn'], pc02Note: 'Ưu tiên' });
  const due = addMonths(today, 2);
  check('APPROVE', 'PC02 duyệt, đổi ĐTV (người được phân công khác người đề xuất) → Đã duyệt', ok.status === 200 && ok.body?.status === 'APPROVED' && ok.body?.assignedInvestigatorId === I2, [ok.status, ok.body]);
  check('APPROVE', 'cán bộ theo dõi mặc định là người duyệt, tổ theo dõi là tổ PC02 của họ', ok.body?.followUpUserId === U.rev && ok.body?.followUpTeamId === T.P, [ok.body?.followUpUserId, ok.body?.followUpTeamId]);
  check('A11', `ngày nhận lại mặc định = hôm nay (${today}), hạn báo kết quả = nhận lại + 2 tháng (${due})`, ymd(ok.body?.receivedOn) === today && ymd(ok.body?.resultDueOn) === due, [ymd(ok.body?.receivedOn), ymd(ok.body?.resultDueOn)]);
  const wardAfter = (await get(tk.a1)).body;
  check('A2', 'sau duyệt, phường A thấy ĐTV được phân công nhưng không có nút ghi khối 2–3', wardAfter?.assignedInvestigatorId === I2 && wardAfter?.can?.followUp === false && wardAfter?.can?.extend === false && wardAfter?.can?.edit === false, wardAfter?.can);
  // Request slips (owner: printed both when returned and when approved; a reprint is the slip issued then)
  const decisionsNow = ((await get(tk.rev)).body?.rounds ?? []).flatMap((r) => r.decisions ?? []);
  const firstReturn = decisionsNow.find((d) => d.kind === 'RETURN');
  const approval = decisionsNow.find((d) => d.kind === 'APPROVE' && !d.revokedAt);
  const wardIssue = await call(tk.a1, 'POST', `/ward-assignments/${id}/decisions/${firstReturn?.id}/slip`, {});
  check('SLIP', 'cán bộ phường/xã không phát hành được phiếu yêu cầu', wardIssue.status === 403 || wardIssue.status === 404, [wardIssue.status, wardIssue.body]);
  const slip1 = await call(tk.rev, 'POST', `/ward-assignments/${id}/decisions/${firstReturn?.id}/slip`, {});
  check('SLIP', 'PC02 phát hành phiếu của lượt trả về đầu tiên: có số bốn chữ số theo chuẩn hệ thống (0001/PYC-PC02-Đ1)', slip1.status === 200 && /^\d{4}\/PYC-PC02-Đ1$/.test(slip1.body?.slipNumber ?? ''), [slip1.status, slip1.body?.slipNumber ?? slip1.body]);
  const slip1again = await call(tk.rev, 'POST', `/ward-assignments/${id}/decisions/${firstReturn?.id}/slip`, {});
  check('SLIP', 'phát hành lại lần nữa (bấm hai lần): cùng một số, không cấp số mới', slip1again.status === 200 && slip1again.body?.slipNumber === slip1.body?.slipNumber, [slip1again.status, slip1again.body?.slipNumber]);
  // A number written by hand, like "1949A" on the owner's Word slip (a new one each run: numbers are unique in the year).
  const manual = `${1000 + (parseInt(RUN.slice(0, 4), 16) % 9000)}A`;
  const slipA = await call(tk.rev, 'POST', `/ward-assignments/${id}/decisions/${approval?.id}/slip`, { slipNumber: manual });
  check('SLIP', `phiếu của lượt duyệt với số ghi tay "${manual}" → ${manual}/PYC-PC02-Đ1`, slipA.status === 200 && slipA.body?.slipNumber === `${manual}/PYC-PC02-Đ1`, [slipA.status, slipA.body?.slipNumber ?? slipA.body]);
  const otherReturn = decisionsNow.filter((d) => d.kind === 'RETURN')[1];
  const reused = await call(tk.rev, 'POST', `/ward-assignments/${id}/decisions/${otherReturn?.id}/slip`, { slipNumber: manual });
  check('A8', 'số phiếu ghi tay đã dùng trong năm thì bị từ chối', refused(reused, 409, 'WARD_SLIP_NUMBER_TAKEN'), [reused.status, reused.body]);
  const fileR = await fetchFile(tk.rev, `/ward-assignments/${id}/decisions/${firstReturn?.id}/slip`);
  const fileW = await fetchFile(tk.a1, `/ward-assignments/${id}/decisions/${firstReturn?.id}/slip`);
  check('SLIP', 'phiếu tải về là tệp Word; phường A tải được đúng tệp PC02 đã phát hành', fileR.status === 200 && fileR.bytes.subarray(0, 2).toString() === 'PK' && fileW.status === 200 && fileW.bytes.equals(fileR.bytes), [fileR.status, fileR.type, fileW.status, fileR.bytes.length, fileW.bytes.length]);
  const fileB = await fetchFile(tk.b1, `/ward-assignments/${id}/decisions/${firstReturn?.id}/slip`);
  check('A5', 'phường B không tải được phiếu của phường A (404)', fileB.status === 404, fileB.status);

  // Result files (owner: "nhiều tệp kết quả"; PC02 enters the result)
  const wardUp = await upload(tk.a1, `/ward-assignments/${id}/files`, 'ket-qua.pdf', 'application/pdf', PDF);
  check('FILES', 'cán bộ phường/xã không tải tệp kết quả lên được', wardUp.status === 403 || wardUp.status === 404, [wardUp.status, wardUp.body]);
  const up1 = await upload(tk.rev, `/ward-assignments/${id}/files`, 'Quyết định khởi tố.pdf', 'application/pdf', PDF);
  const up2 = await upload(tk.rev, `/ward-assignments/${id}/files`, 'Biên bản.pdf', 'application/pdf', PDF);
  const filesA = await call(tk.a1, 'GET', `/ward-assignments/${id}/files`);
  const names = rowsOf(filesA.body).map((f) => f.originalName ?? f.name);
  check('FILES', 'PC02 tải lên 2 tệp kết quả; phường A thấy đủ 2 tệp, tên tiếng Việt giữ nguyên', [200, 201].includes(up1.status) && [200, 201].includes(up2.status) && names.includes('Quyết định khởi tố.pdf') && names.includes('Biên bản.pdf'), [up1.status, up2.status, names]);
  const fileId = up1.body?.id;
  const dl = await fetchFile(tk.a1, `/ward-assignments/${id}/files/${fileId}/download`);
  check('FILES', 'phường A tải về được tệp kết quả, đúng nội dung', dl.status === 200 && dl.bytes.equals(PDF), [dl.status, dl.bytes.length]);
  const filesB = await call(tk.b1, 'GET', `/ward-assignments/${id}/files`);
  check('A5', 'phường B không xem được tệp kết quả của phường A', filesB.status === 404 || filesB.status === 403, filesB.status);
  const rm = await call(tk.rev, 'DELETE', `/ward-assignments/${id}/files/${up2.body?.id}`);
  const after2 = rowsOf((await call(tk.rev, 'GET', `/ward-assignments/${id}/files`)).body).length;
  check('FILES', 'PC02 gỡ một tệp: còn 1 tệp', rm.status === 200 && after2 === 1, [rm.status, after2]);
  const cancelWithFile = await call(tk.rev, 'POST', `/ward-assignments/${id}/approval/cancel`, { expectedUpdatedAt: (await get(tk.rev)).body?.updatedAt, reason: 'x' });
  check('C7', 'còn tệp kết quả thì không huỷ duyệt được; màn hình cũng không hiện nút Huỷ duyệt', refused(cancelWithFile, 409, 'WARD_APPROVAL_HAS_RESULT') && (await get(tk.rev)).body?.can?.cancelApproval === false, [cancelWithFile.status, cancelWithFile.body]);

  const wardExtend = await call(tk.a1, 'POST', `/ward-assignments/${id}/deadline/extend`, { expectedUpdatedAt: await stampOf(), newDueOn: addDays(due, 30), reason: 'x' });
  check('A2', 'phường A không gia hạn được (403)', wardExtend.status === 403, [wardExtend.status, wardExtend.body]);

  // Block 3: received, deadline follows it; extension with a reason (R6); result, completion, reopening (C7)
  const received = addDays(today, -3);
  const moved = await call(tk.rev, 'PATCH', `/ward-assignments/${id}/follow-up`, { expectedUpdatedAt: await stampOf(), receivedOn: received });
  check('A11', `đổi ngày nhận lại thành ${received}: hạn tự = ${addMonths(received, 2)}`, moved.status === 200 && ymd(moved.body?.resultDueOn) === addMonths(received, 2), [moved.status, ymd(moved.body?.resultDueOn)]);
  const noReasonExt = await call(tk.rev, 'POST', `/ward-assignments/${id}/deadline/extend`, { expectedUpdatedAt: moved.body?.updatedAt, newDueOn: addDays(addMonths(received, 2), 15), reason: '  ' });
  check('R6', 'gia hạn không lý do bị từ chối', refused(noReasonExt, 400, 'WARD_REASON_REQUIRED'), [noReasonExt.status, noReasonExt.body]);
  const earlier = await call(tk.rev, 'POST', `/ward-assignments/${id}/deadline/extend`, { expectedUpdatedAt: moved.body?.updatedAt, newDueOn: addDays(addMonths(received, 2), -1), reason: 'x' });
  check('R6', 'gia hạn sớm hơn hạn hiện tại bị từ chối', refused(earlier, 400, 'WARD_EXTEND_NOT_LATER'), [earlier.status, earlier.body]);
  const newDue = addDays(addMonths(received, 2), 15);
  const ext = await call(tk.rev, 'POST', `/ward-assignments/${id}/deadline/extend`, { expectedUpdatedAt: moved.body?.updatedAt, newDueOn: newDue, reason: 'Chờ kết luận giám định' });
  const extSeen = (await get(tk.rev)).body;
  check('R6', `gia hạn tới ${newDue} có lý do: lưu lịch sử (cũ, mới, lý do, người)`, ext.status === 200 && ymd(ext.body?.resultDueOn) === newDue && extSeen?.deadlineChanges?.length === 1 && extSeen.deadlineChanges[0].reason === 'Chờ kết luận giám định' && ymd(extSeen.deadlineChanges[0].oldDueOn) === addMonths(received, 2), [ext.status, extSeen?.deadlineChanges]);
  const after = await call(tk.rev, 'PATCH', `/ward-assignments/${id}/follow-up`, { expectedUpdatedAt: ext.body?.updatedAt, receivedOn: addDays(today, -1) });
  check('R6', 'đã gia hạn thì đổi ngày nhận lại không kéo hạn về +2 tháng', after.status === 200 && ymd(after.body?.resultDueOn) === newDue, [after.status, ymd(after.body?.resultDueOn)]);
  const noResult = await call(tk.rev, 'POST', `/ward-assignments/${id}/complete`, { expectedUpdatedAt: after.body?.updatedAt, completedOn: today });
  check('C7', 'ghi hoàn thành khi chưa có kết quả bị từ chối', refused(noResult, 400, 'WARD_RESULT_REQUIRED'), [noResult.status, noResult.body]);
  const result = await call(tk.rev, 'PATCH', `/ward-assignments/${id}/follow-up`, { expectedUpdatedAt: after.body?.updatedAt, resultText: 'Đã khởi tố vụ án, khởi tố bị can Nguyễn Văn An' });
  const cancelWithResult = await call(tk.rev, 'POST', `/ward-assignments/${id}/approval/cancel`, { expectedUpdatedAt: result.body?.updatedAt, reason: 'x' });
  check('C7', 'huỷ duyệt khi đã có kết quả bị từ chối (giữ kết quả)', refused(cancelWithResult, 409, 'WARD_APPROVAL_HAS_RESULT'), [cancelWithResult.status, cancelWithResult.body]);
  const future = await call(tk.rev, 'POST', `/ward-assignments/${id}/complete`, { expectedUpdatedAt: result.body?.updatedAt, completedOn: addDays(today, 1) });
  check('C7', 'ngày hoàn thành ở tương lai bị từ chối', refused(future, 400, 'WARD_COMPLETED_IN_FUTURE'), [future.status, future.body]);
  const done = await call(tk.rev, 'POST', `/ward-assignments/${id}/complete`, { expectedUpdatedAt: result.body?.updatedAt, completedOn: today });
  const doneSeen = (await get(tk.rev)).body;
  check('TIMELY', `hoàn thành ${today} trước hạn ${newDue}: "Đúng hạn"`, done.status === 200 && doneSeen?.timeliness?.onTime === true && doneSeen?.timeliness?.lateDays === 0, [done.status, doneSeen?.timeliness]);
  const rewrite = await call(tk.rev, 'PATCH', `/ward-assignments/${id}/follow-up`, { expectedUpdatedAt: done.body?.updatedAt, resultText: null });
  check('C7', 'đã hoàn thành thì không xoá / sửa được kết quả khi chưa Mở lại', refused(rewrite, 409, 'WARD_ALREADY_COMPLETED'), [rewrite.status, rewrite.body]);
  const reopenNo = await call(tk.rev, 'POST', `/ward-assignments/${id}/complete/reopen`, { expectedUpdatedAt: done.body?.updatedAt, reason: '' });
  check('R3', 'mở lại không có lý do bị từ chối', refused(reopenNo, 400, 'WARD_REASON_REQUIRED'), [reopenNo.status, reopenNo.body]);
  const reopen = await call(tk.rev, 'POST', `/ward-assignments/${id}/complete/reopen`, { expectedUpdatedAt: done.body?.updatedAt, reason: 'Bổ sung quyết định khởi tố' });
  const reopenSeen = (await get(tk.rev)).body;
  check('R3', 'mở lại có lý do: bỏ ngày hoàn thành, lý do lưu trong lịch sử', reopen.status === 200 && !reopen.body?.completedOn && reopenSeen?.reopenings?.length === 1 && reopenSeen.reopenings[0].reason === 'Bổ sung quyết định khởi tố', [reopen.status, reopenSeen?.reopenings]);

  // Second request: cancel approval and take a return back (every decision has its way back)
  const m2 = await call(tk.a2, 'POST', '/ward-assignments', content({ summary: `UAT ${RUN} hồ sơ thứ hai`, caseType: 'INCIDENT' }));
  const s2 = await call(tk.a2, 'POST', `/ward-assignments/${m2.body?.id}/submit`, { expectedUpdatedAt: m2.body?.updatedAt });
  const id2 = s2.body?.id;

  // Subject matching (owner's Sheet1 "dò trùng đối tượng"; plan A5, C4, R4): both requests name the same ID number
  const mA = await call(tk.a1, 'GET', `/ward-assignments/${id}/subject-matches`);
  check('R4', 'cùng CCCD trong hai hồ sơ của phường A: phường A thấy "Trùng chắc chắn" với hồ sơ thứ hai', mA.status === 200 && rowsOf(mA.body).some((m) => m.recordId === id2 && m.level === 'CERTAIN'), [mA.status, mA.body]);
  const mR = await call(tk.rev, 'GET', `/ward-assignments/${id}/subject-matches`);
  check('R4', 'PC02 thẩm định cũng thấy cặp trùng đó', mR.status === 200 && rowsOf(mR.body).some((m) => m.recordId === id2), [mR.status, mR.body]);
  const mB = await call(tk.b1, 'GET', `/ward-assignments/${id}/subject-matches`);
  check('A5', 'phường B hỏi trùng đối tượng của hồ sơ phường A: 404, không lộ con số nào', mB.status === 404, [mB.status, mB.body]);
  const concl = await call(tk.rev, 'POST', `/ward-assignments/${id}/subject-matches/conclusions`, { subjectPosition: rowsOf(mR.body).find((m) => m.recordId === id2)?.subjectPosition ?? 1, otherSource: 'WARD_ASSIGNMENT', otherRecordId: id2, samePerson: false });
  const mAfter = await call(tk.rev, 'GET', `/ward-assignments/${id}/subject-matches`);
  check('R4', 'PC02 kết luận "khác người": cặp đó không báo lại', [200, 201].includes(concl.status) && !rowsOf(mAfter.body).some((m) => m.recordId === id2), [concl.status, concl.body, mAfter.body]);

  // Bell notices (plan §6): the ward unit was told of the returns and of the approval of the first request
  const bell = await call(tk.a2, 'GET', '/notifications?limit=100');
  const kinds = rowsOf(bell.body).filter((n) => JSON.stringify(n).includes(id)).map((n) => n.type);
  check('NOTIFY', 'cán bộ khác của phường A nhận thông báo "bị trả về" (3 lượt) và "đã được duyệt" của hồ sơ', bell.status === 200 && kinds.filter((k) => k === 'WARD_ASSIGNMENT_RETURNED').length === 3 && kinds.includes('WARD_ASSIGNMENT_APPROVED'), [bell.status, kinds]);
  const bellB = await call(tk.b1, 'GET', '/notifications?limit=100');
  check('A12', 'phường B không nhận thông báo nào về hồ sơ phường A', bellB.status === 200 && !JSON.stringify(bellB.body).includes(id), bellB.status);
  const bellRev = await call(tk.rev, 'GET', '/notifications?limit=100');
  check('NOTIFY', 'PC02 thẩm định nhận thông báo hồ sơ mới trình và hồ sơ trình lại', rowsOf(bellRev.body).some((n) => n.type === 'WARD_ASSIGNMENT_SUBMITTED' && JSON.stringify(n).includes(id)) && rowsOf(bellRev.body).some((n) => n.type === 'WARD_ASSIGNMENT_RESUBMITTED' && JSON.stringify(n).includes(id)), rowsOf(bellRev.body).map((n) => n.type));
  const a2ok = await call(tk.rev, 'POST', `/ward-assignments/${id2}/approve`, { expectedUpdatedAt: s2.body?.updatedAt, assignedInvestigatorId: I1 });
  const cancelNo = await call(tk.rev, 'POST', `/ward-assignments/${id2}/approval/cancel`, { expectedUpdatedAt: a2ok.body?.updatedAt, reason: ' ' });
  check('R3', 'huỷ duyệt không lý do bị từ chối', refused(cancelNo, 400, 'WARD_REASON_REQUIRED'), [cancelNo.status, cancelNo.body]);
  const cancel = await call(tk.rev, 'POST', `/ward-assignments/${id2}/approval/cancel`, { expectedUpdatedAt: a2ok.body?.updatedAt, reason: 'Duyệt nhầm ĐTV' });
  check('C7', 'huỷ duyệt khi chưa có kết quả: về Đã trình, bỏ ĐTV, ngày nhận lại và hạn; Lần trình không đổi', cancel.status === 200 && cancel.body?.status === 'SUBMITTED' && !cancel.body?.assignedInvestigatorId && !cancel.body?.resultDueOn && cancel.body?.submissionCount === 1, [cancel.status, cancel.body]);
  const ret2 = await call(tk.rev, 'POST', `/ward-assignments/${id2}/return`, { expectedUpdatedAt: cancel.body?.updatedAt, reasonCode: 'SAI_THAM_QUYEN', requirements: [] });
  const revoke = await call(tk.rev, 'POST', `/ward-assignments/${id2}/return/revoke`, { expectedUpdatedAt: ret2.body?.updatedAt, reason: 'Trả về nhầm' });
  check('C7', 'thu hồi trả về khi phường chưa sửa: về Đã trình, Lần trình không đổi', revoke.status === 200 && revoke.body?.status === 'SUBMITTED' && revoke.body?.submissionCount === 1, [revoke.status, revoke.body]);
  const ret3 = await call(tk.rev, 'POST', `/ward-assignments/${id2}/return`, { expectedUpdatedAt: revoke.body?.updatedAt, reasonCode: 'KHAC', reasonText: 'Bổ sung', requirements: [] });
  const touched = await call(tk.a2, 'PATCH', `/ward-assignments/${id2}`, { ...content({ summary: `UAT ${RUN} hồ sơ thứ hai đã sửa`, caseType: 'INCIDENT' }), expectedUpdatedAt: ret3.body?.updatedAt });
  const revokeLate = await call(tk.rev, 'POST', `/ward-assignments/${id2}/return/revoke`, { expectedUpdatedAt: touched.body?.updatedAt, reason: 'x' });
  check('C7', 'phường đã sửa sau khi bị trả về thì không thu hồi được nữa', refused(revokeLate, 409, 'WARD_RETURN_NOT_REVOCABLE'), [revokeLate.status, revokeLate.body]);
  const delSub = await call(tk.a2, 'DELETE', `/ward-assignments/${id2}?expectedUpdatedAt=${encodeURIComponent(touched.body?.updatedAt)}`);
  check('CRUD', 'hồ sơ đã từng trình không xoá hẳn được (chỉ lưu trữ)', refused(delSub, 409, 'WARD_ASSIGNMENT_DELETE_SUBMITTED'), [delSub.status, delSub.body]);

  // Archive ⇄ restore (PC02)
  const arch = await call(tk.rev, 'POST', `/ward-assignments/${id2}/archive`, { expectedUpdatedAt: touched.body?.updatedAt });
  const listed = rowsOf((await call(tk.rev, 'GET', '/ward-assignments')).body).some((r) => r.id === id2);
  const listedArch = rowsOf((await call(tk.rev, 'GET', '/ward-assignments?archived=true')).body).some((r) => r.id === id2);
  check('ARCHIVE', 'PC02 lưu trữ: hồ sơ rời danh sách thường, có trong danh sách lưu trữ', arch.status === 200 && !listed && listedArch, [arch.status, listed, listedArch]);
  const wardArchEdit = await call(tk.a2, 'PATCH', `/ward-assignments/${id2}`, { ...content({ caseType: 'INCIDENT' }), expectedUpdatedAt: arch.body?.updatedAt });
  check('ARCHIVE', 'hồ sơ đã lưu trữ không sửa được', wardArchEdit.status === 409 || wardArchEdit.status === 403, [wardArchEdit.status, wardArchEdit.body]);
  const restore = await call(tk.rev, 'POST', `/ward-assignments/${id2}/restore`, { expectedUpdatedAt: arch.body?.updatedAt });
  check('ARCHIVE', 'khôi phục: hồ sơ trở lại danh sách', restore.status === 200 && rowsOf((await call(tk.rev, 'GET', '/ward-assignments')).body).some((r) => r.id === id2), [restore.status, restore.body]);

  // Reassignment links to the previous request (R5)
  const re = await call(tk.a1, 'POST', '/ward-assignments', content({ kind: 'REASSIGN', previousAssignmentId: null, reassignReason: null, summary: `UAT ${RUN} phân công lại` }));
  const reSub = await call(tk.a1, 'POST', `/ward-assignments/${re.body?.id}/submit`, { expectedUpdatedAt: re.body?.updatedAt });
  check('R5', 'phân công lại mà không chọn hồ sơ trước và lý do: không trình được', refused(reSub, 400, 'WARD_ASSIGNMENT_INCOMPLETE') && JSON.stringify(reSub.body).includes('previousAssignmentId') && JSON.stringify(reSub.body).includes('reassignReason'), [reSub.status, reSub.body]);
  const reFix = await call(tk.a1, 'PATCH', `/ward-assignments/${re.body?.id}`, { ...content({ kind: 'REASSIGN', previousAssignmentId: id, reassignReason: 'ĐTV chuyển công tác', summary: `UAT ${RUN} phân công lại` }), expectedUpdatedAt: re.body?.updatedAt });
  check('R5', 'chọn hồ sơ trước (đã duyệt, cùng đơn vị) và lý do: lưu được', reFix.status === 200 && reFix.body?.previousAssignmentId === id, [reFix.status, reFix.body]);
  const reWrong = await call(tk.a1, 'PATCH', `/ward-assignments/${re.body?.id}`, { ...content({ kind: 'REASSIGN', previousAssignmentId: id2, reassignReason: 'x' }), expectedUpdatedAt: reFix.body?.updatedAt });
  check('R5', 'hồ sơ trước chưa được duyệt thì không chọn được', refused(reWrong, 400, 'WARD_ASSIGNMENT_PREVIOUS_UNKNOWN'), [reWrong.status, reWrong.body]);

  // Delete with data: administrators only, repeating the code (project rule "tạo thì phải sửa và xoá")
  const impactRev = await call(tk.rev, 'GET', `/ward-assignments/${id2}/deletion-impact`);
  check('DELETE', 'người không phải quản trị không xem được màn xoá kèm dữ liệu', impactRev.status === 403, [impactRev.status, impactRev.body]);
  const impact = await call(tk.admin, 'GET', `/ward-assignments/${id2}/deletion-impact`);
  check('DELETE', 'quản trị thấy số bản ghi sẽ mất: 1 đối tượng, 1 lượt, 3 quyết định (duyệt đã huỷ, trả về đã thu hồi, trả về)', impact.status === 200 && impact.body?.code === s2.body?.code && impact.body?.subjects === 1 && impact.body?.rounds === 1 && impact.body?.decisions === 3, [impact.status, impact.body]);
  const cur2 = (await call(tk.admin, 'GET', `/ward-assignments/${id2}`)).body;
  const wrong = await call(tk.admin, 'DELETE', `/ward-assignments/${id2}/with-data`, { expectedUpdatedAt: cur2?.updatedAt, confirmCode: 'sai-ma' });
  check('DELETE', 'gõ sai mã xác nhận: không xoá', refused(wrong, 400, 'WARD_DELETE_CONFIRM_MISMATCH'), [wrong.status, wrong.body]);
  const revDel = await call(tk.rev, 'DELETE', `/ward-assignments/${id2}/with-data`, { expectedUpdatedAt: cur2?.updatedAt, confirmCode: s2.body?.code });
  check('DELETE', 'người không phải quản trị không xoá kèm dữ liệu được', revDel.status === 403, [revDel.status, revDel.body]);
  const gone = await call(tk.admin, 'DELETE', `/ward-assignments/${id2}/with-data`, { expectedUpdatedAt: cur2?.updatedAt, confirmCode: s2.body?.code });
  const goneGet = await call(tk.admin, 'GET', `/ward-assignments/${id2}`);
  check('DELETE', 'gõ đúng mã: hồ sơ và mọi dữ liệu của nó bị xoá, không còn tệp sót', [200, 201].includes(gone.status) && goneGet.status === 404 && Array.isArray(gone.body?.filesNotRemoved) && gone.body.filesNotRemoved.length === 0, [gone.status, gone.body, goneGet.status]);

  // Statistics (owner's "dashboard"): the numbers of this unit equal the rows they open
  const stats = await call(tk.rev, 'GET', `/ward-assignments/stats?teamId=${T.WA}`);
  const rowsAll = await call(tk.rev, 'GET', `/ward-assignments?submitted=true&teamId=${T.WA}&pageSize=200`);
  check('STATS', 'thống kê của phường A trả lời; tổng số = số dòng danh sách mở ra từ nó', stats.status === 200 && JSON.stringify(stats.body).length > 2 && rowsAll.status === 200 && (stats.body?.cards?.total ?? stats.body?.total) === rowsAll.body?.total, [stats.status, stats.body?.cards, rowsAll.body?.total]);
  const statsWard = await call(tk.b1, 'GET', `/ward-assignments/stats?teamId=${T.WA}`);
  check('A5', 'phường B xem thống kê của phường A: không thấy hồ sơ nào', statsWard.status === 403 || ((statsWard.body?.cards?.total ?? statsWard.body?.total) === 0), [statsWard.status, statsWard.body?.cards]);

  // Investigator stop ⇄ use again (project rule: every one-way action has its way back)
  const invNow = rowsOf((await call(tk.a1, 'GET', `/ward-investigators?teamId=${T.WA}`)).body).find((r) => r.id === I1);
  const stop = await call(tk.a1, 'POST', `/ward-investigators/${I1}/deactivate`, { expectedUpdatedAt: invNow?.updatedAt });
  const hidden = !rowsOf((await call(tk.a1, 'GET', `/ward-investigators?teamId=${T.WA}`)).body).some((r) => r.id === I1);
  const back = await call(tk.a1, 'POST', `/ward-investigators/${I1}/reactivate`, { expectedUpdatedAt: stop.body?.updatedAt });
  check('INV', 'ngừng dùng ĐTV ẩn khỏi danh bạ; dùng lại thì hiện lại', stop.status === 200 && hidden && back.status === 200 && back.body?.isActive === true, [stop.status, hidden, back.status]);
}

(async () => {
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  const before = (await pg.query(`SELECT "enabled" FROM "feature_flags" WHERE "key" = $1`, [SWITCH])).rows[0];
  const modeBefore = (await pg.query(`SELECT "value" FROM "system_settings" WHERE "key" = $1`, [MODE_KEY])).rows[0]?.value ?? null;
  try {
    if (!before) throw new Error(`the switch ${SWITCH} is not in feature_flags`);
    await setSwitch(pg, false);
    await seed(pg);
    await workflow(pg);
  } catch (err) {
    check('SCRIPT', 'the workflow ran to its end', false, err instanceof Error ? err.stack : String(err));
  } finally {
    await pg.query(`UPDATE "feature_flags" SET "enabled" = $1 WHERE "key" = $2`, [before?.enabled ?? false, SWITCH]).catch(() => {});
    if (modeBefore === null) await pg.query(`DELETE FROM "system_settings" WHERE "key" = $1`, [MODE_KEY]).catch(() => {});
    else await pg.query(`UPDATE "system_settings" SET "value" = $2 WHERE "key" = $1`, [MODE_KEY, modeBefore]).catch(() => {});
    await pg.query(`UPDATE "users" SET "isActive" = false WHERE "id" LIKE $1`, [`${TAG}-%`]).catch(() => {});
    await pg.end();
  }
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`\nPASS ${count('PASS')} | FAIL ${count('FAIL')} | NOT RUN ${count('NOT RUN')} | total ${results.length}`);
  for (const r of results.filter((x) => x.status !== 'PASS')) console.log(`  ${r.status} ${r.id} [${r.req}] ${r.name}`);
  process.exit(count('FAIL') ? 1 : 0);
})();
