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
const os = require('node:os');
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

const T = { W: `${TAG}-w`, P: `${TAG}-p`, D: `${TAG}-d` };
const U = { ward: `${TAG}-ward`, rev: `${TAG}-rev`, admin: `${TAG}-admin`, admin2: `${TAG}-admin2`, desk: `${TAG}-desk` };

async function seed(pg) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const admin = (await pg.query(`SELECT id FROM roles WHERE name = 'ADMIN'`)).rows[0].id;
  const officer = (await pg.query(`SELECT id FROM roles WHERE name = 'OFFICER'`)).rows[0].id;
  await pg.query(`INSERT INTO directories (id,type,code,name,"updatedAt") VALUES ($1,'WARD',$1,$2,now())`, [`${TAG}-ward-dir`, `Phường UAT ${RUN}`]);
  await pg.query(`INSERT INTO teams (id,name,code,"wardId","updatedAt") VALUES ($1,$2,$1,$3,now())`, [T.W, `CA phường Vườn Lài (UAT ${RUN})`, `${TAG}-ward-dir`]);
  await pg.query(`INSERT INTO teams (id,name,code,"updatedAt") VALUES ($1,$2,$1,now())`, [T.P, `Đội 1 PC02 (UAT ${RUN})`]);
  await pg.query(`INSERT INTO teams (id,name,code,"updatedAt") VALUES ($1,$2,$1,now())`, [T.D, `Bàn nhập (UAT ${RUN})`]);
  for (const [id, role, team, first] of [[U.desk, officer, T.D, 'Bàn nhập'], [U.ward, officer, T.W, 'Hoa'], [U.rev, officer, T.P, 'Thẩm'], [U.admin, admin, null, 'Quản trị'], [U.admin2, admin, null, 'Quản trị 2']]) {
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
  const desk = templates.find((t) => t.code === 'STARTER_WARD_INTAKE');
  for (const [team, tpl] of [[T.W, sub.id], [T.P, rev.id], [T.D, desk.id]]) await call(admin, 'PUT', `/authz/teams/${team}`, { mode: 'EXPLICIT', memberTemplateId: tpl, expectedRevision: 0, reason: 'UAT trình duyệt' });
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
    // The review's choices are type-to-find fields; the reason and the assigned investigator may be created from them.
    await rev.page.getByTestId('ward-return-reason-trigger').click();
    await rev.page.getByTestId('ward-return-reason-search').waitFor({ timeout: 8000 });
    const options = await rev.page.locator('[data-testid^="ward-return-reason-option-"]').allInnerTexts();
    check('ô lý do trả về liệt kê danh mục (5 lý do)', options.filter((o) => o.trim()).length >= 5, options);
    const newReasonName = `Thiếu sơ đồ hiện trường ${RUN}`;
    await rev.page.getByTestId('ward-return-reason-search').fill(newReasonName);
    await rev.page.waitForTimeout(300);
    await rev.page.keyboard.press('Enter');
    check('gõ lý do chưa có + Enter: popup tạo lý do, chữ đã điền sẵn', (await rev.page.getByTestId('ward-new-reason-name').inputValue({ timeout: 8000 }).catch(() => '')) === newReasonName);
    await rev.page.getByTestId('ward-new-reason-save').click();
    await rev.page.getByTestId('ward-new-reason').waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined);
    await rev.page.waitForTimeout(600);
    const reasonShown = await rev.page.getByTestId('ward-return-reason-trigger').innerText();
    check('tạo xong: ô lý do trả về tự chọn lý do vừa tạo', reasonShown.includes(newReasonName), reasonShown);
    for (const field of ['ward-assigned-investigator', 'ward-follow-up-user', 'ward-follow-up-team']) {
      check(`ô ${field} là ô gõ-để-tìm (combobox), không phải danh sách thả`, (await rev.page.getByTestId(`${field}-trigger`).getAttribute('role')) === 'combobox' && (await rev.page.getByTestId(field).locator('select').count()) === 0);
    }
    await rev.page.getByTestId('ward-assigned-investigator-trigger').click();
    check('ô ĐTV được phân công có nút Tạo mới', (await rev.page.getByTestId('ward-assigned-investigator-create-new').count()) === 1);
    await rev.page.keyboard.press('Escape');
    await rev.page.getByTestId('ward-follow-up-user-trigger').click();
    await rev.page.getByTestId('ward-follow-up-user-search').fill('tham');
    await rev.page.waitForTimeout(300);
    check('ô Cán bộ theo dõi: gõ không dấu "tham" tìm ra cán bộ PC02; không có nút tạo tài khoản', (await rev.page.locator('[data-testid^="ward-follow-up-user-option-"]').count()) >= 1 && (await rev.page.getByTestId('ward-follow-up-user-create-new').count()) === 0);
    await rev.page.keyboard.press('Escape');
    await rev.page.getByTestId('ward-return-reason-text').fill('Thiếu biên bản ghi lời khai');
    await rev.page.getByTestId('ward-return').click();
    await rev.page.waitForTimeout(1500);
    const after = await call(r.token, 'GET', `/ward-assignments/${id}`);
    check('bấm Trả về trên giao diện: hồ sơ ở trạng thái Trả về', after.body?.status === 'RETURNED', after.body?.status);
    await rev.page.screenshot({ path: path.join(OUT, '03-pc02-da-tra-ve.png'), fullPage: true });

    // ── the request slip: the dialog opens by itself after the return; one click issues the slip and saves the file ──
    const slipDialog = rev.page.getByTestId('ward-slip-dialog');
    await slipDialog.waitFor({ timeout: 10000 }).catch(() => undefined);
    check('sau khi Trả về, popup "In phiếu yêu cầu" tự mở', await slipDialog.isVisible().catch(() => false));
    await rev.page.waitForFunction(() => (document.querySelector('[data-testid="ward-slip-signer-canBoThamDinh"]')?.value ?? '') !== '', null, { timeout: 10000 }).catch(() => undefined);
    const signer = await rev.page.getByTestId('ward-slip-signer-canBoThamDinh').inputValue().catch(() => '');
    check('popup in phiếu: ô Cán bộ thẩm định đã điền sẵn', signer.trim() !== '', signer);
    const [slipFile] = await Promise.all([rev.page.waitForEvent('download', { timeout: 30000 }).catch(() => null), rev.page.getByTestId('ward-slip-print').click()]);
    const savedSlip = path.join(os.tmpdir(), `${TAG}-phieu.docx`);
    if (slipFile) await slipFile.saveAs(savedSlip);
    check('bấm "In phiếu" MỘT lần: tệp .docx tải về', !!slipFile && /\.docx$/i.test(slipFile.suggestedFilename()) && fs.statSync(savedSlip).size > 2000, slipFile ? slipFile.suggestedFilename() : 'không có tệp');
    const slipMessage = await rev.page.getByTestId('ward-slip-message').innerText().catch(() => '');
    check('popup báo số phiếu đã phát hành', /phiếu số\s+\S+/i.test(slipMessage), slipMessage);
    check('đã phát hành: popup không còn nút phát hành lần hai, có Tải phiếu', (await rev.page.getByTestId('ward-slip-print').count()) === 0 && (await rev.page.getByTestId('ward-slip-download').count()) === 1);
    await rev.page.screenshot({ path: path.join(OUT, '03b-pc02-in-phieu.png'), fullPage: true });
    await rev.page.getByTestId('ward-slip-close').click();

    // ── the list: the buttons of the row ──
    await rev.page.goto(`${WEB}/ho-so-phan-cong`);
    await rev.page.getByTestId(`btn-view-${id}`).waitFor({ timeout: 15000 }).catch(() => undefined);
    check('danh sách (PC02): dòng có nút Xem và In phiếu', (await rev.page.getByTestId(`btn-view-${id}`).count()) === 1 && (await rev.page.getByTestId(`btn-print-${id}`).count()) === 1);
    // PC02 has no delete on the ward unit's request; "Sửa" opens it for PC02's own part (the review, the follow-up).
    check('danh sách (PC02): không có nút Xoá trên hồ sơ của phường; nút Sửa bấm được', (await rev.page.getByTestId(`btn-delete-${id}`).count()) === 0 && (await rev.page.getByTestId(`btn-edit-${id}`).isEnabled()));
    await rev.page.getByTestId(`btn-edit-${id}`).click();
    await rev.page.getByTestId('ward-edit-scope').waitFor({ timeout: 10000 }).catch(() => undefined);
    const editHeading = await rev.page.getByTestId('ward-assignment-form-page').locator('h1').first().innerText().catch(() => '');
    check('bấm Sửa (PC02): mở hồ sơ ở chế độ sửa, tiêu đề "Cập nhật", nói rõ PC02 sửa ở khối 2 và 3', rev.page.url().endsWith(`/ho-so-phan-cong/${id}/edit`) && editHeading.includes('Cập nhật') && (await rev.page.getByTestId('ward-edit-scope').innerText().catch(() => '')).includes('PC02'), { url: rev.page.url(), editHeading });
    await rev.page.goto(`${WEB}/ho-so-phan-cong`);
    await rev.page.getByTestId(`btn-print-${id}`).waitFor({ timeout: 15000 }).catch(() => undefined);
    await rev.page.getByTestId(`btn-print-${id}`).click();
    await rev.page.getByTestId('ward-slip-download').waitFor({ timeout: 10000 }).catch(() => undefined);
    const [slipAgain] = await Promise.all([rev.page.waitForEvent('download', { timeout: 30000 }).catch(() => null), rev.page.getByTestId('ward-slip-download').click()]);
    check('danh sách (PC02): In phiếu trên dòng tải đúng phiếu đã phát hành', !!slipAgain, slipAgain ? slipAgain.suggestedFilename() : 'không có tệp');
    await rev.page.screenshot({ path: path.join(OUT, '03c-pc02-danh-sach-thao-tac.png'), fullPage: true });
    await rev.page.getByTestId('ward-slip-close').click();
    // ── the list as the petition list: tags over every column, order, filter panel, cards, Excel ──
    const listOf = async (page, query) => {
      await page.goto(`${WEB}/ho-so-phan-cong${query}`);
      await page.getByTestId('ward-assignment-list-page').waitFor({ timeout: 20000 });
      await page.waitForTimeout(1800);
    };
    await listOf(rev.page, `?hspc_tk=${encodeURIComponent('*~nhom danh bac tai hem 12')}`);
    check('thẻ "mọi cột" gõ KHÔNG DẤU ("nhom danh bac") tìm ra hồ sơ có trích yếu có dấu', (await rev.page.getByTestId(`btn-view-${id}`).count()) === 1);
    await listOf(rev.page, `?hspc_tk=${encodeURIComponent('noiXayRa~hem 12 duong vuon lai')}&hspc_tk=${encodeURIComponent(`trichYeu~${RUN}`)}`);
    check('thẻ theo cột Nơi xảy ra + Trích yếu (hai thẻ, AND): vẫn ra đúng hồ sơ', (await rev.page.getByTestId(`btn-view-${id}`).count()) === 1);
    check('cột Nơi xảy ra (đang ẩn) vẫn tìm được; ô tìm dạng thẻ hiện trên thanh công cụ', (await rev.page.getByTestId('list-page-shell-toolbar').getByRole('combobox').count()) >= 1);
    await listOf(rev.page, `?hspc_tk=${encodeURIComponent(`trichYeu~khong co ho so nao ten nhu the ${RUN}`)}`);
    const emptyText = await rev.page.getByTestId('ward-assignment-list-page').innerText();
    check('thẻ không khớp gì: bảng báo "không tìm thấy" kèm thẻ đang lọc, không màn trắng', /Không tìm thấy/.test(emptyText), emptyText.slice(0, 300));
    await rev.page.getByTestId('list-page-shell-reset-filters').click();
    await rev.page.getByTestId(`btn-view-${id}`).waitFor({ timeout: 10000 }).catch(() => undefined);
    check('"Xóa lọc" bỏ hết thẻ: hồ sơ hiện lại, địa chỉ sạch', (await rev.page.getByTestId(`btn-view-${id}`).count()) === 1 && !rev.page.url().includes('hspc_tk'), rev.page.url());
    // The pinned actions column does not cover the next column (measured: the person here has no tick column).
    const boxActions = await rev.page.getByRole('columnheader', { name: 'Thao tác' }).boundingBox();
    const boxCode = await rev.page.getByTestId('sort-code').boundingBox();
    check('cột Thao tác (ghim trái) không đè lên cột Mã: mép trái tiêu đề "Mã" nằm sau mép phải cột Thao tác', !!boxActions && !!boxCode && boxCode.x >= boxActions.x + boxActions.width - 1, { actions: boxActions, code: boxCode });
    // order
    await rev.page.getByTestId('sort-code').click();
    await rev.page.waitForTimeout(1500);
    check('bấm tiêu đề cột Mã: địa chỉ mang cột sắp xếp, bảng vẫn có dòng', rev.page.url().includes('hspc_sort=code') && (await rev.page.locator('[data-testid^="ward-row-"]').count()) > 0, rev.page.url());
    const codesShown = async () => (await rev.page.locator('[data-testid^="ward-row-"] a').allInnerTexts()).filter((t) => /^\d{2,4}-\d+$/.test(t.trim())).map((t) => Number(t.trim().split('-')[1]));
    const firstWay = await codesShown();
    await rev.page.getByTestId('sort-code').click();
    await rev.page.waitForTimeout(1500);
    const otherWay = await codesShown();
    const sorted = (xs, dir) => xs.every((x, i) => i === 0 || (dir > 0 ? xs[i - 1] <= x : xs[i - 1] >= x));
    check('sắp theo Mã: một chiều tăng, chiều kia giảm (đo trên số mã đang hiện)', firstWay.length > 1 && otherWay.length > 1 && ((sorted(firstWay, 1) && sorted(otherWay, -1)) || (sorted(firstWay, -1) && sorted(otherWay, 1))), { firstWay: firstWay.slice(0, 6), otherWay: otherWay.slice(0, 6) });
    // cards: one request, numbers that match the rows
    await listOf(rev.page, '');
    const cardNumber = async (key) => Number(((await rev.page.getByTestId(`ward-card-${key}`).innerText()).match(/\d[\d.]*/) ?? ['-1'])[0].replace(/\./g, ''));
    const returned = await cardNumber('RETURNED');
    await rev.page.getByTestId('ward-card-RETURNED').click();
    await rev.page.waitForTimeout(1500);
    const pager = await rev.page.getByTestId('ward-assignment-list-page').innerText();
    const rowsReturned = await rev.page.locator('[data-testid^="ward-row-"]').count();
    check('thẻ Trả về: số trên thẻ = số dòng danh sách hiện dưới thẻ đó', returned >= 1 && (returned <= 20 ? rowsReturned === returned : rowsReturned === 20), { returned, rowsReturned, pager: pager.slice(-120) });
    check('bấm thẻ ghi vào địa chỉ (hspc_the=RETURNED)', rev.page.url().includes('hspc_the=RETURNED'), rev.page.url());
    // filter panel + Excel
    await listOf(rev.page, '');
    // The panel opens from the "Bộ lọc" button, as on the petition list.
    if ((await rev.page.getByTestId('list-page-shell-filter-toggle').getAttribute('aria-expanded')) !== 'true') await rev.page.getByTestId('list-page-shell-filter-toggle').click();
    await rev.page.getByTestId('btn-apply-filters').waitFor({ state: 'visible', timeout: 8000 }).catch(() => undefined);
    check('bấm "Bộ lọc" mở khung lọc: có ô Đơn vị, Loại hồ sơ, Phân công, Hạn báo kết quả, hai ô ngày và hai nút Xuất Excel', (await Promise.all(['filter-don-vi', 'filter-loai-ho-so', 'filter-phan-cong', 'filter-canh-bao', 'filter-from-date', 'filter-to-date', 'btn-xuat-dang-xem', 'btn-xuat-day-du'].map((t) => rev.page.getByTestId(t).isVisible()))).every(Boolean));
    await rev.page.getByTestId('filter-loai-ho-so').selectOption('CASE');
    const unitOptions = await rev.page.getByTestId('filter-don-vi').locator('option').allInnerTexts();
    check('ô lọc Đơn vị liệt kê các đơn vị có hồ sơ', unitOptions.some((o) => o.includes(`UAT ${RUN}`)), unitOptions.slice(0, 6));
    await rev.page.getByTestId('btn-apply-filters').click();
    await rev.page.waitForTimeout(1500);
    check('Áp dụng bộ lọc Loại hồ sơ = Vụ án: địa chỉ mang bộ lọc, đếm 1 bộ lọc đang áp', rev.page.url().includes('hspc_loai_ho_so=CASE') && (await rev.page.getByTestId('list-page-shell-filter-count').innerText()).trim() === '1', rev.page.url());
    check('có bộ chọn mật độ dòng cạnh nút Cột', (await rev.page.getByTestId('chon-mat-do').count()) === 1);
    const [xlsx] = await Promise.all([rev.page.waitForEvent('download', { timeout: 30000 }).catch(() => null), rev.page.getByTestId('btn-xuat-dang-xem').click()]);
    const savedXlsx = path.join(os.tmpdir(), `${TAG}-danh-sach.xlsx`);
    if (xlsx) await xlsx.saveAs(savedXlsx);
    check('Xuất Excel (đang xem): tệp .xlsx tải về', !!xlsx && /\.xlsx$/i.test(xlsx.suggestedFilename()) && fs.statSync(savedXlsx).size > 3000, xlsx ? xlsx.suggestedFilename() : 'không có tệp');
    if (xlsx) {
      const ExcelJS = require(path.join(BACKEND, 'node_modules/exceljs'));
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(savedXlsx);
      const cells = [];
      wb.worksheets[0].eachRow((row) => row.eachCell((c) => cells.push(String(c.value ?? ''))));
      check('tệp Excel có hồ sơ vừa trình, đúng chữ của màn hình (Vụ án), và không có dòng Vụ việc nào khi đang lọc Vụ án', cells.some((c) => c.includes(`UAT ${RUN}`)) && cells.includes('Vụ án') && !cells.includes('Vụ việc'), cells.filter((c) => c.includes('Vụ')).slice(0, 5));
    }
    await rev.page.screenshot({ path: path.join(OUT, '03d-pc02-danh-sach-loc.png'), fullPage: true });

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
    check('phường mở form Tạo mới: có ô Trích yếu và ĐTV đề xuất', form.includes('Trích yếu') && form.includes('ĐTV'), form.slice(0, 300));
    await ward.page.screenshot({ path: path.join(OUT, '06-phuong-trinh-moi.png'), fullPage: true });

    // ── the form, as the petition form ──
    const heading = await ward.page.getByTestId('ward-assignment-form-page').locator('h1').first().innerText().catch(() => '');
    check('form mới có tiêu đề "Thêm mới Hồ sơ phân công"', heading.trim() === 'Thêm mới Hồ sơ phân công', heading);
    check('form có hai thanh nút (trên và dưới)', (await ward.page.getByTestId('ward-save-draft').count()) === 1 && (await ward.page.getByTestId('ward-save-draft-bottom').count()) === 1);
    // "ĐTV đề xuất": type to find, without accents.
    await ward.page.getByTestId('ward-proposed-investigator-trigger').click();
    await ward.page.getByTestId('ward-proposed-investigator-search').fill('le van cuong');
    await ward.page.waitForTimeout(400);
    check('ĐTV đề xuất: gõ không dấu "le van cuong" tìm ra Lê Văn Cường', (await ward.page.getByTestId(`ward-proposed-investigator-option-${inv.body?.id}`).count()) === 1);
    const newName = `Trần Minh Mới ${RUN}`;
    await ward.page.getByTestId('ward-proposed-investigator-search').fill(newName);
    await ward.page.waitForTimeout(400);
    await ward.page.keyboard.press('Enter');
    await ward.page.getByTestId('ward-inv-quick').waitFor({ timeout: 8000 }).catch(() => undefined);
    check('không ai tên đó: Enter mở popup tạo ĐTV, họ tên đã điền sẵn', (await ward.page.getByTestId('ward-inv-quick-fullName').inputValue().catch(() => '')) === newName);
    const quickText = await ward.page.getByTestId('ward-inv-quick').innerText().catch(() => '');
    check('popup có đủ Họ tên, Cấp bậc, Chức vụ, Ngạch ĐTV, Tình trạng', ['Họ tên', 'Cấp bậc', 'Chức vụ', 'Ngạch ĐTV', 'Tình trạng'].every((l) => quickText.includes(l)), quickText);
    await ward.page.getByTestId('ward-inv-quick-rank').fill('Đại úy');
    await ward.page.getByTestId('ward-inv-quick-position').fill('Cán bộ');
    await ward.page.getByTestId('ward-inv-quick-grade').fill('Điều tra viên sơ cấp');
    await ward.page.screenshot({ path: path.join(OUT, '07-phuong-tao-dtv.png'), fullPage: true });
    await ward.page.getByTestId('ward-inv-quick-save').click();
    await ward.page.getByTestId('ward-inv-quick').waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined);
    const chosen = await ward.page.getByTestId('ward-proposed-investigator-trigger').innerText().catch(() => '');
    check('tạo xong: ô ĐTV đề xuất tự chọn người vừa tạo, hiện "Cấp bậc – Chức vụ – Họ tên"', chosen.includes(newName) && chosen.includes('Đại úy'), chosen);
    // The same name again: not doubled silently.
    await ward.page.getByTestId('ward-proposed-investigator-trigger').click();
    await ward.page.getByTestId('ward-proposed-investigator-search').fill(newName.toLowerCase());
    await ward.page.getByTestId('ward-proposed-investigator-create-new').click();
    await ward.page.getByTestId('ward-inv-quick-save').click();
    await ward.page.getByTestId('ward-inv-quick-duplicate').waitFor({ timeout: 8000 }).catch(() => undefined);
    check('tạo trùng tên: popup báo danh bạ đã có và mời dùng người đã có', (await ward.page.getByTestId('ward-inv-quick-duplicate').count()) === 1 && (await ward.page.getByTestId('ward-inv-quick-use-existing').count()) === 1);
    await ward.page.getByTestId('ward-inv-quick-use-existing').click();
    await ward.page.getByTestId('ward-inv-quick').waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined);
    // The pencil corrects the one chosen.
    await ward.page.getByTestId('ward-edit-investigator').click();
    check('nút bút chì mở popup chỉnh sửa ĐTV đang chọn', (await ward.page.getByTestId('ward-inv-quick-fullName').inputValue().catch(() => '')) === newName);
    await ward.page.getByTestId('ward-inv-quick-cancel').click();
    // "Trình duyệt" on an incomplete form: said on the screen, nothing sent.
    await ward.page.getByTestId('ward-submit').click();
    const problems = await ward.page.getByTestId('validation-errors').innerText({ timeout: 5000 }).catch(() => '');
    check('Trình duyệt khi còn thiếu: liệt kê ô còn thiếu, không gửi', problems.includes('Vui lòng kiểm tra các lỗi sau') && problems.includes('Trích yếu'), problems);
    await ward.page.screenshot({ path: path.join(OUT, '08-phuong-thieu-thong-tin.png'), fullPage: true });
    // "Hủy" asks before what was typed is lost.
    let asked = '';
    ward.page.once('dialog', (d) => { asked = d.message(); void d.accept(); });
    await ward.page.getByTestId('form-action-cancel').click();
    await ward.page.getByTestId('ward-assignment-list-page').waitFor({ timeout: 10000 }).catch(() => undefined);
    check('Hủy khi đã nhập dở: hỏi lại rồi về danh sách', asked.includes('Dữ liệu chưa lưu sẽ bị mất') && ward.page.url().endsWith('/ho-so-phan-cong'), { asked, url: ward.page.url() });

    // ── the list, for the ward officer ──
    const createText = await ward.page.getByTestId('ward-create').innerText().catch(() => '');
    check('danh sách: nút "Tạo mới" kèm phím tắt Alt+N', /Tạo mới/.test(createText) && /Alt\s*\+?\s*N/i.test(createText) && !/Trình mới/.test(createText), createText);
    await ward.page.getByTestId(`btn-view-${id}`).waitFor({ timeout: 15000 }).catch(() => undefined);
    // The same four buttons in the same order on every row, as the petition list: Xem · Sửa · Xoá · In.
    const rowButtons = await ward.page.getByTestId(`ward-row-${id}`).locator('button[data-testid^="btn-"]').evaluateAll((bs) => bs.map((x) => x.getAttribute('data-testid').split('-').slice(0, 2).join('-')));
    check('danh sách (phường): mỗi dòng đủ bốn nút theo thứ tự Xem · Sửa · Xoá · In như danh sách Đơn thư', JSON.stringify(rowButtons) === JSON.stringify(['btn-view', 'btn-edit', 'btn-delete', 'btn-print']), rowButtons);
    const del = ward.page.getByTestId(`btn-delete-${id}`);
    check('hồ sơ đã trình: nút Xoá bị khoá và nói lý do (không ẩn đi làm lệch hàng nút)', (await del.isDisabled()) && ((await del.getAttribute('title')) ?? '').includes('bản nháp'), await del.getAttribute('title'));
    check('hồ sơ bị trả về: Sửa và In phiếu bấm được', (await ward.page.getByTestId(`btn-edit-${id}`).isEnabled()) && (await ward.page.getByTestId(`btn-print-${id}`).isEnabled()));
    const boxAct = await ward.page.getByRole('columnheader', { name: 'Thao tác' }).boundingBox();
    const boxPrint = await ward.page.getByTestId(`btn-print-${id}`).boundingBox();
    check('cột Thao tác thu gọn (≤ 10rem có ô tick) mà bốn nút vẫn nằm trọn trong cột', !!boxAct && !!boxPrint && boxAct.width <= 162 && boxPrint.x + boxPrint.width <= boxAct.x + boxAct.width + 1, { column: boxAct, print: boxPrint });
    await ward.page.getByTestId(`btn-print-${id}`).click();
    await ward.page.getByTestId('ward-slip-download').waitFor({ timeout: 10000 }).catch(() => undefined);
    check('phường: popup in phiếu chỉ cho tải phiếu đã phát hành (không phát hành)', (await ward.page.getByTestId('ward-slip-print').count()) === 0 && (await ward.page.getByTestId('ward-slip-reissue').count()) === 0);
    const [wardSlip] = await Promise.all([ward.page.waitForEvent('download', { timeout: 30000 }).catch(() => null), ward.page.getByTestId('ward-slip-download').click()]);
    check('phường tải được phiếu PC02 đã phát hành', !!wardSlip, wardSlip ? wardSlip.suggestedFilename() : 'không có tệp');
    await ward.page.screenshot({ path: path.join(OUT, '09-phuong-danh-sach.png'), fullPage: true });
    await ward.page.getByTestId('ward-slip-close').click();
    // ── several drafts at once ──
    const drafts = [];
    for (const n of [1, 2]) {
      const d = await call(w.token, 'POST', '/ward-assignments', { caseType: 'INCIDENT', kind: 'NEW', crimeId: null, crimeOther: 'Trộm cắp', summary: `Bản nháp xoá hàng loạt ${n} (UAT ${RUN})`, content: 'x', subjectsUnknown: true, subjects: [], proposedInvestigatorId: null, entryOfficerName: 'Phạm Thị Hoa' });
      drafts.push(d.body?.id);
    }
    await ward.page.goto(`${WEB}/ho-so-phan-cong?hspc_tk=${encodeURIComponent('trichYeu~ban nhap xoa hang loat')}`);
    await ward.page.getByTestId(`ward-row-${drafts[0]}`).waitFor({ timeout: 15000 }).catch(() => undefined);
    check('phường: hai bản nháp vừa lập hiện trong danh sách (tìm theo thẻ)', drafts.every(Boolean) && (await ward.page.locator('[data-testid^="ward-row-"]').count()) === 2, drafts);
    for (const d of drafts) await ward.page.getByTestId(`ward-row-${d}`).locator('input[type="checkbox"]').check();
    await ward.page.getByText('Xóa', { exact: true }).last().click();
    await ward.page.getByRole('button', { name: 'Xác nhận' }).click();
    const bulkNotice = await ward.page.getByTestId('ward-list-notice').innerText({ timeout: 15000 }).catch(() => '');
    check('chọn hai bản nháp → Xóa → Xác nhận: báo "Đã xoá 2 bản nháp"', bulkNotice.includes('Đã xoá 2 bản nháp'), bulkNotice);
    const gone = await Promise.all(drafts.map((d) => call(w.token, 'GET', `/ward-assignments/${d}`)));
    check('hai bản nháp không còn trên máy chủ', gone.every((g) => g.status === 404), gone.map((g) => g.status));
    await ward.page.goto(`${WEB}/ho-so-phan-cong`);
    await ward.page.getByTestId('ward-assignment-list-page').waitFor({ timeout: 15000 });
    await ward.page.waitForTimeout(1200);
    await ward.page.keyboard.press('Alt+n');
    await ward.page.waitForURL('**/ho-so-phan-cong/new', { timeout: 8000 }).catch(() => undefined);
    check('Alt+N mở form tạo mới', ward.page.url().endsWith('/ho-so-phan-cong/new'), ward.page.url());

    // ── The shared desk at PC02 (owner's request of 18/11/2026): one account, gone once "Trình duyệt" is pressed ──
    const d = { ...(await login(U.desk)), label: 'ban-nhap' };
    check('tài khoản bàn nhập đăng nhập được', !!d.token);
    const desk = await asPerson(browser, d, watch);
    await desk.page.goto(`${WEB}/ho-so-phan-cong/new`);
    await desk.page.getByTestId('ward-intake-notice').waitFor({ timeout: 15000 }).catch(() => undefined);
    check('bàn nhập, form Thêm mới: có dòng nhắc "trình xong không còn hiện"; ô Cán bộ nhập và SĐT để TRỐNG (không lấy tên tài khoản chung)',
      (await desk.page.getByTestId('ward-intake-notice').innerText().catch(() => '')).includes('Trình duyệt') && (await desk.page.getByTestId('ward-entry-officer').inputValue()) === '' && (await desk.page.getByTestId('ward-entry-phone').inputValue()) === '');
    await desk.page.screenshot({ path: path.join(OUT, 'desk-01-form-moi.png'), fullPage: true });
    // A draft saved by the desk for the ward unit (through the API), then finished and submitted on the screen.
    const deskDraft = await call(d.token, 'POST', '/ward-assignments', {
      assignedTeamId: T.W, caseType: 'CASE', kind: 'NEW', crimeId: crime, summary: `Trộm xe tại chợ (bàn nhập, UAT ${RUN})`, content: 'Ngày 12/11 mất một xe máy tại bãi giữ xe.',
      discoveredOn: '2026-11-12', place: 'Chợ Vườn Lài', subjectsUnknown: true, subjects: [], proposedInvestigatorId: inv.body?.id, entryOfficerName: '', entryOfficerPhone: null,
    });
    check('bàn nhập lưu tạm một hồ sơ cho phường (API)', deskDraft.status === 201 && deskDraft.body?.enteredOnBehalf === true, [deskDraft.status, deskDraft.body]);
    const deskId = deskDraft.body?.id;
    await desk.page.goto(`${WEB}/ho-so-phan-cong`);
    await desk.page.getByTestId(`ward-row-${deskId}`).waitFor({ timeout: 15000 }).catch(() => undefined);
    check('bàn nhập, danh sách: thấy bản lưu tạm; có dòng nhắc; KHÔNG có thẻ trạng thái, nút Xuất Excel, nút In phiếu',
      (await desk.page.getByTestId(`ward-row-${deskId}`).count()) === 1 && (await desk.page.getByTestId('ward-intake-list-notice').count()) === 1 &&
      (await desk.page.locator('[data-testid^="ward-card-"]').count()) === 0 && (await desk.page.getByTestId('btn-xuat-dang-xem').count()) === 0 && (await desk.page.locator('[data-testid^="btn-print-"]').count()) === 0);
    check('bàn nhập, danh sách: không thấy hồ sơ phường đã tự trình', (await desk.page.getByTestId(`ward-row-${id}`).count()) === 0);
    await desk.page.screenshot({ path: path.join(OUT, 'desk-02-danh-sach.png'), fullPage: true });
    await desk.page.getByTestId(`btn-edit-${deskId}`).click();
    await desk.page.getByTestId('ward-entry-officer').waitFor({ timeout: 15000 });
    await desk.page.getByRole('button', { name: /Trình duyệt/ }).first().click();
    await desk.page.waitForTimeout(800);
    check('bấm Trình duyệt khi chưa ghi Cán bộ nhập và SĐT: không trình, vẫn ở hồ sơ', desk.page.url().includes(deskId) && (await call(a.token, 'GET', `/ward-assignments/${deskId}`)).body?.status === 'DRAFT', desk.page.url());
    await desk.page.getByTestId('ward-entry-officer').fill('Trần Văn Phường');
    await desk.page.getByTestId('ward-entry-phone').fill('0907654321');
    await desk.page.getByRole('button', { name: /Trình duyệt/ }).first().click();
    await desk.page.waitForURL('**/ho-so-phan-cong/new', { timeout: 15000 }).catch(() => undefined);
    const deskBanner = await desk.page.getByTestId('ward-banner').innerText({ timeout: 8000 }).catch(() => '');
    const stored = (await call(a.token, 'GET', `/ward-assignments/${deskId}`)).body;
    check('ghi đủ rồi bấm Trình duyệt: hồ sơ Đã trình; màn hình về form Thêm mới TRỐNG và báo "Đã trình hồ sơ <mã>"',
      stored?.status === 'SUBMITTED' && desk.page.url().endsWith('/ho-so-phan-cong/new') && deskBanner.includes(`Đã trình hồ sơ ${stored?.code}`) &&
      (await desk.page.getByTestId('ward-summary').inputValue()) === '' && (await desk.page.getByTestId('ward-entry-officer').inputValue()) === '', [stored?.status, desk.page.url(), deskBanner]);
    await desk.page.screenshot({ path: path.join(OUT, 'desk-03-sau-khi-trinh.png'), fullPage: true });
    await desk.page.goto(`${WEB}/ho-so-phan-cong`);
    await desk.page.getByTestId('ward-intake-list-notice').waitFor({ timeout: 15000 }).catch(() => undefined);
    await desk.page.waitForTimeout(800);
    check('trình xong: danh sách của bàn nhập không còn hồ sơ đó ("Không có hồ sơ đang nhập dở")',
      (await desk.page.getByTestId(`ward-row-${deskId}`).count()) === 0 && (await desk.page.getByText('Không có hồ sơ đang nhập dở').count()) > 0);
    await desk.page.screenshot({ path: path.join(OUT, 'desk-04-danh-sach-sau-trinh.png'), fullPage: true });
    // Opening the old address is refused by the server (404): expected here, not a broken screen.
    const before404 = watch.length;
    await desk.page.goto(`${WEB}/ho-so-phan-cong/${deskId}`);
    await desk.page.waitForTimeout(1500);
    const text404 = await desk.page.locator('body').innerText();
    check('mở lại đường dẫn hồ sơ đã trình: báo không tìm thấy, không lộ trích yếu', text404.includes('Không tìm thấy hồ sơ') && !text404.includes('Trộm xe tại chợ'), text404.slice(0, 300));
    watch.length = before404;
    await desk.context.close();
    // PC02 still sees and decides what the desk submitted.
    await rev.page.goto(`${WEB}/ho-so-phan-cong/${deskId}`);
    await rev.page.getByTestId('ward-assignment-form-page').waitFor({ timeout: 15000 });
    check('PC02 mở được hồ sơ bàn nhập đã trình, thấy tên cán bộ phường đã nhập', (await rev.page.getByTestId('ward-entry-officer').inputValue().catch(() => '')) === 'Trần Văn Phường');
    await ward.context.close();
    await rev.context.close();
  } catch (err) {
    console.log(err instanceof Error ? err.stack : String(err));
    check('the browser pass ran to its end', false, err instanceof Error ? err.stack : String(err));
  } finally {
    check('không lỗi trang, lỗi console, 403 hay 5xx trong lượt', watch.length === 0, [...new Set(watch)].slice(0, 20));
    if (admin) await call(admin, 'POST', '/authz/mode', { mode: 'OFF', reason: 'UAT trình duyệt xong' }).catch(() => undefined);
    if (modeBefore === null) await pg.query(`DELETE FROM system_settings WHERE key = 'QUYEN_THEO_TO_CHE_DO'`).catch(() => undefined);
    else await pg.query(`UPDATE system_settings SET value = $1 WHERE key = 'QUYEN_THEO_TO_CHE_DO'`, [modeBefore]).catch(() => undefined);
    await pg.query(`UPDATE feature_flags SET enabled = $1 WHERE key = 'ward-assignments'`, [flagBefore]).catch(() => undefined);
    await pg.query(`UPDATE users SET "isActive" = false WHERE id LIKE $1`, [`${TAG}-%`]).catch(() => undefined);
    // The reason this run added to the catalogue (a return of this run carries it: switched off, not deleted).
    await pg.query(`UPDATE directories SET "isActive" = false WHERE type = 'LY_DO_TRA_VE' AND name LIKE $1`, [`%${RUN}`]).catch(() => undefined);
    await browser.close();
    await pg.end();
  }
  const failed = results.filter((x) => !x.ok).length;
  console.log(`\nPASS ${results.length - failed} | FAIL ${failed} | total ${results.length}`);
  process.exit(failed ? 1 : 0);
})();
