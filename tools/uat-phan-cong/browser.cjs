/**
 * Browser pass of "Hồ sơ phân công phường/xã" in Chromium, on a LOCAL stack only, ENFORCE mode with the starter
 * templates (as tools/uat-phan-cong/workflow.cjs). Two roles: a ward officer and a PC02 reviewer.
 *
 *   E2E_DB=postgresql://postgres:postgres@127.0.0.1:5433/pc02_uat_phan_cong E2E_WEB=http://127.0.0.1:5173 \
 *   node tools/uat-phan-cong/browser.cjs
 *
 * The web dev server proxies /api to the backend. Screenshots go to docs/test-evidence/ward-assignments/.
 * Every check prints PASS | FAIL; page errors, console errors and 5xx answers are collected and fail the run.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const WEB = process.env.E2E_WEB || 'http://127.0.0.1:5173';
const BASE = `${WEB}/api/v1`;
const DB_URL = process.env.E2E_DB;
const BACKEND = path.join(__dirname, '../../backend');
const local = (u) => { try { return ['localhost', '127.0.0.1', '::1'].includes(new URL(u).hostname); } catch { return false; } };
if (!DB_URL || !local(DB_URL) || !local(WEB)) {
  console.error('REFUSED: set E2E_DB and E2E_WEB to local addresses.');
  process.exit(2);
}
const { chromium } = require(path.join(__dirname, '../monkey-test/node_modules/playwright'));
const bcrypt = require(path.join(BACKEND, 'node_modules/bcrypt'));
const { Client } = require(path.join(BACKEND, 'node_modules/pg'));

const RUN = randomUUID().slice(0, 8);
const TAG = `uat-pcb-${RUN}`;
const PASSWORD = `Uat-${randomUUID()}!`;
const OUT = path.join(__dirname, '../../docs/test-evidence/ward-assignments');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}    ${name}${ok || detail === undefined ? '' : `\n          -> ${String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 500)}`}`);
};
async function call(token, method, url, body) {
  const res = await fetch(`${BASE}${url}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body: json };
}
async function login(username) {
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: PASSWORD }) });
  const body = await res.json().catch(() => null);
  return { token: body?.accessToken ?? body?.data?.accessToken ?? '', user: body?.user ?? body?.data?.user ?? null };
}
const rowsOf = (b) => b?.data ?? (Array.isArray(b) ? b : []);

const T = { W: `${TAG}-w`, P: `${TAG}-p` };
const U = { ward: `${TAG}-ward`, rev: `${TAG}-rev`, admin: `${TAG}-admin`, admin2: `${TAG}-admin2` };

async function seed(pg) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const admin = (await pg.query(`SELECT id FROM roles WHERE name = 'ADMIN'`)).rows[0].id;
  const officer = (await pg.query(`SELECT id FROM roles WHERE name = 'OFFICER'`)).rows[0].id;
  await pg.query(`INSERT INTO directories (id,type,code,name,"updatedAt") VALUES ($1,'WARD',$1,$2,now())`, [`${TAG}-ward-dir`, `Phường UAT ${RUN}`]);
  await pg.query(`INSERT INTO teams (id,name,code,"wardId","updatedAt") VALUES ($1,$2,$1,$3,now())`, [T.W, `CA phường Vườn Lài (UAT ${RUN})`, `${TAG}-ward-dir`]);
  await pg.query(`INSERT INTO teams (id,name,code,"updatedAt") VALUES ($1,$2,$1,now())`, [T.P, `Đội 1 PC02 (UAT ${RUN})`]);
  for (const [id, role, team, first] of [[U.ward, officer, T.W, 'Hoa'], [U.rev, officer, T.P, 'Thẩm'], [U.admin, admin, null, 'Quản trị'], [U.admin2, admin, null, 'Quản trị 2']]) {
    await pg.query(`INSERT INTO users (id,username,email,"passwordHash","roleId","isActive","twoFaSetupRequired","firstName","lastName",phone,"updatedAt") VALUES ($1,$1,$2,$3,$4,true,false,$5,'UAT','0901234567',now())`, [id, `${id}@local.test`, hash, role, first]);
    if (team) await pg.query(`INSERT INTO user_teams ("userId","teamId","isLeader") VALUES ($1,$2,false)`, [id, team]);
  }
  await pg.query(`UPDATE feature_flags SET enabled = true WHERE key = 'ward-assignments'`);
}

async function enforce(admin, admin2) {
  await call(admin, 'POST', '/authz/templates/starters');
  const templates = rowsOf((await call(admin, 'GET', '/authz/templates')).body);
  const sub = templates.find((t) => t.code === 'STARTER_WARD_SUBMIT');
  const rev = templates.find((t) => t.code === 'STARTER_WARD_REVIEW');
  for (const [team, tpl] of [[T.W, sub.id], [T.P, rev.id]]) await call(admin, 'PUT', `/authz/teams/${team}`, { mode: 'EXPLICIT', memberTemplateId: tpl, expectedRevision: 0, reason: 'UAT trình duyệt' });
  const fp = async (t) => (await call(t, 'GET', '/authz/mode/comparison')).body?.fingerprint;
  const asked = await call(admin, 'POST', '/authz/mode/requests', { reason: 'UAT trình duyệt', acknowledge: await fp(admin) });
  await call(admin2, 'POST', `/authz/mode/requests/${asked.body?.id}/approve`, { acknowledge: await fp(admin2) });
  return (await call(admin, 'GET', '/authz/mode')).body?.mode === 'ENFORCE';
}

async function asPerson(browser, who, watch) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, timezoneId: 'Asia/Ho_Chi_Minh', locale: 'vi-VN' });
  await context.addInitScript(({ token, user, origin }) => {
    if (location.origin === origin) {
      sessionStorage.setItem('accessToken', token);
      sessionStorage.setItem('authProfile', JSON.stringify(user));
    }
  }, { token: who.token, user: who.user, origin: new URL(WEB).origin });
  const page = await context.newPage();
  page.on('pageerror', (e) => watch.push(`pageerror: ${e.message}`));
  // The browser's own "Failed to load resource" line repeats the answer logged below with its address.
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) watch.push(`console: ${m.text().slice(0, 200)}`); });
  // A refused call is a screen asking for what the person may not have: blanks on the screen, never a pass.
  page.on('response', (r) => { if (r.status() >= 500 || r.status() === 403) watch.push(`${who.label} HTTP ${r.status()} ${r.request().method()} ${r.url().replace(WEB, '')}`); });
  return { context, page };
}

(async () => {
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  const modeBefore = (await pg.query(`SELECT value FROM system_settings WHERE key = 'QUYEN_THEO_TO_CHE_DO'`)).rows[0]?.value ?? null;
  const flagBefore = (await pg.query(`SELECT enabled FROM feature_flags WHERE key = 'ward-assignments'`)).rows[0]?.enabled ?? false;
  const browser = await chromium.launch({ headless: true });
  const watch = [];
  let admin = null;
  try {
    await seed(pg);
    await new Promise((r) => setTimeout(r, 2500));
    const w = { ...(await login(U.ward)), label: 'phuong' }, r = { ...(await login(U.rev)), label: 'pc02' }, a = await login(U.admin), a2 = await login(U.admin2);
    admin = a.token;
    check('bốn tài khoản đăng nhập được', !!(w.token && r.token && a.token && a2.token));
    check('chế độ quyền ENFORCE với hai mẫu dựng sẵn', await enforce(a.token, a2.token));
    // A request entered and submitted by the ward unit (through the API: the form itself is exercised below by opening it)
    const inv = await call(w.token, 'POST', '/ward-investigators', { teamId: T.W, fullName: 'Lê Văn Cường', rank: 'Thượng úy', position: 'Phó Trưởng Công an phường', grade: 'Điều tra viên sơ cấp' });
    const crime = (await pg.query(`SELECT id FROM crimes ORDER BY id LIMIT 1`)).rows[0].id;
    const made = await call(w.token, 'POST', '/ward-assignments', {
      caseType: 'CASE', kind: 'NEW', crimeId: crime, summary: `Nhóm đánh bạc tại hẻm 12 (UAT ${RUN})`, content: 'Ngày 10/11 phát hiện nhóm đối tượng tổ chức đánh bạc.',
      discoveredOn: '2026-11-10', place: 'Hẻm 12 đường Vườn Lài', subjectsUnknown: false, subjects: [{ fullName: 'Nguyễn Văn An', birthYear: 1990, idNumber: '079090000001', address: 'Vườn Lài' }],
      proposedInvestigatorId: inv.body?.id, entryOfficerName: 'Phạm Thị Hoa', entryOfficerPhone: '0901234567',
    });
    const sent = await call(w.token, 'POST', `/ward-assignments/${made.body?.id}/submit`, { expectedUpdatedAt: made.body?.updatedAt });
    check('phường lập và trình một hồ sơ (API)', sent.status === 200, [made.status, sent.status, sent.body]);
    const id = sent.body?.id;
    const code = sent.body?.code;

    // ── PC02 reviewer ──
    const rev = await asPerson(browser, r, watch);
    await rev.page.goto(`${WEB}/ho-so-phan-cong`);
    await rev.page.getByTestId('ward-assignment-list-page').waitFor({ timeout: 20000 });
    const menuText = await rev.page.locator('nav').first().innerText().catch(() => '');
    check('menu có mục "Hồ sơ phân công phường/xã"', menuText.includes('Hồ sơ phân công phường/xã'), menuText.slice(0, 300));
    const iDon = menuText.indexOf('Đơn thư'), iWard = menuText.indexOf('Hồ sơ phân công phường/xã'), iUt = menuText.indexOf('Ủy thác điều tra');
    check('mục nằm dưới Đơn thư, trên Ủy thác điều tra (nếu hai mục kia hiện với người này)', iWard >= 0 && (iDon < 0 || iDon < iWard) && (iUt < 0 || iWard < iUt), { iDon, iWard, iUt });
    await rev.page.getByText(code, { exact: true }).waitFor({ timeout: 15000 });
    check('PC02 thấy hồ sơ vừa trình trong danh sách', true);
    await rev.page.screenshot({ path: path.join(OUT, '01-pc02-danh-sach.png'), fullPage: true });
    await rev.page.getByText(code, { exact: true }).click();
    await rev.page.getByTestId('ward-block-review').waitFor({ timeout: 15000 });
    check('mở hồ sơ: PC02 thấy khối thẩm định với nút Trả về và Duyệt', (await rev.page.getByTestId('ward-return').isVisible()) && (await rev.page.getByTestId('ward-approve').isVisible()));
    await rev.page.screenshot({ path: path.join(OUT, '02-pc02-tham-dinh.png'), fullPage: true });
    const reasonBox = rev.page.getByTestId('ward-return-reason');
    const options = await reasonBox.locator('option').allTextContents().catch(() => []);
    check('ô lý do trả về liệt kê danh mục (5 lý do)', options.filter((o) => o.trim()).length >= 5, options);
    await reasonBox.selectOption({ index: 1 }).catch(() => undefined);
    await rev.page.getByTestId('ward-return-reason-text').fill('Thiếu biên bản ghi lời khai');
    await rev.page.getByTestId('ward-return').click();
    await rev.page.waitForTimeout(1500);
    const after = await call(r.token, 'GET', `/ward-assignments/${id}`);
    check('bấm Trả về trên giao diện: hồ sơ ở trạng thái Trả về', after.body?.status === 'RETURNED', after.body?.status);
    await rev.page.screenshot({ path: path.join(OUT, '03-pc02-da-tra-ve.png'), fullPage: true });
    await rev.page.goto(`${WEB}/ho-so-phan-cong/thong-ke`);
    await rev.page.waitForLoadState('domcontentloaded');
    await rev.page.waitForTimeout(2500);
    check('trang Thống kê mở được, không màn trắng', (await rev.page.locator('body').innerText()).length > 50);
    await rev.page.screenshot({ path: path.join(OUT, '04-pc02-thong-ke.png'), fullPage: true });

    // ── the ward officer ──
    const ward = await asPerson(browser, w, watch);
    await ward.page.goto(`${WEB}/ho-so-phan-cong/${id}`);
    await ward.page.waitForTimeout(3000);
    const text = await ward.page.locator('body').innerText();
    check('phường mở hồ sơ bị trả về: thấy lý do PC02 ghi', text.includes('Thiếu biên bản ghi lời khai'), text.slice(0, 400));
    check('phường không thấy nút Duyệt / Trả về', (await ward.page.getByTestId('ward-approve').count()) === 0 && (await ward.page.getByTestId('ward-return').count()) === 0);
    await ward.page.screenshot({ path: path.join(OUT, '05-phuong-bi-tra-ve.png'), fullPage: true });
    await ward.page.goto(`${WEB}/ho-so-phan-cong/new`);
    await ward.page.waitForTimeout(3000);
    const form = await ward.page.locator('body').innerText();
    check('phường mở form Trình mới: có ô Trích yếu và ĐTV đề xuất', form.includes('Trích yếu') && form.includes('ĐTV'), form.slice(0, 300));
    await ward.page.screenshot({ path: path.join(OUT, '06-phuong-trinh-moi.png'), fullPage: true });
    await ward.context.close();
    await rev.context.close();
  } catch (err) {
    check('the browser pass ran to its end', false, err instanceof Error ? err.stack : String(err));
  } finally {
    check('không lỗi trang, lỗi console, 403 hay 5xx trong lượt', watch.length === 0, [...new Set(watch)].slice(0, 20));
    if (admin) await call(admin, 'POST', '/authz/mode', { mode: 'OFF', reason: 'UAT trình duyệt xong' }).catch(() => undefined);
    if (modeBefore === null) await pg.query(`DELETE FROM system_settings WHERE key = 'QUYEN_THEO_TO_CHE_DO'`).catch(() => undefined);
    else await pg.query(`UPDATE system_settings SET value = $1 WHERE key = 'QUYEN_THEO_TO_CHE_DO'`, [modeBefore]).catch(() => undefined);
    await pg.query(`UPDATE feature_flags SET enabled = $1 WHERE key = 'ward-assignments'`, [flagBefore]).catch(() => undefined);
    await pg.query(`UPDATE users SET "isActive" = false WHERE id LIKE $1`, [`${TAG}-%`]).catch(() => undefined);
    await browser.close();
    await pg.end();
  }
  const failed = results.filter((x) => !x.ok).length;
  console.log(`\nPASS ${results.length - failed} | FAIL ${failed} | total ${results.length}`);
  process.exit(failed ? 1 : 0);
})();
