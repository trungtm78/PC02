const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium, expect } = require('@playwright/test');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { PrismaPg } = require('../backend/node_modules/@prisma/adapter-pg');

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55441'); assert.equal(url.pathname, '/pc02_incident_release_uat');
  const f = JSON.parse(fs.readFileSync(process.env.INCIDENT_BROWSER_FIXTURE, 'utf8'));
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const browser = await chromium.launch({ headless: true });
  const base = 'http://127.0.0.1:5179'; const tag = randomUUID();
  const out = path.resolve('docs/test-evidence/incident-intake/continuation');
  const cases = [];
  try {
    await db.featureFlag.upsert({ where: { key: 'TIM_KIEM_THE' }, create: { key: 'TIM_KIEM_THE', label: 'Synthetic search UAT', enabled: true }, update: { enabled: true } });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Ho_Chi_Minh' });
    await context.addInitScript(({ token, user }) => { if (location.origin === 'http://127.0.0.1:5179') { sessionStorage.setItem('accessToken', token); sessionStorage.setItem('authProfile', JSON.stringify(user)); } }, f.admin);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const check = async (id, action) => { try { await action(); cases.push({ id, result: 'PASS' }); } catch (error) { cases.push({ id, result: 'FAIL', message: error.message }); await page.screenshot({ path: path.join(out, id + '-failure.png'), fullPage: true }); } };
    const record = await db.case.create({ data: { name: 'Synthetic proposal ' + tag, caseCode: 'UAT-CASE-' + tag, caseProvenance: 'DIRECT_DISCOVERY', assignedTeamId: f.toTeamId, investigatorId: f.editorTarget.user.id, createdById: f.admin.user.id, ngayDeXuat: new Date(), ngayTiepNhan: new Date(), metadata: { receiveDate: '2026-10-06' }, deXuat: 'Original proposal' } });
    await check('A01-BROWSER-PROPOSAL-SAVE-RELOAD', async () => {
      await page.goto(base + `/cases/${record.id}/edit`);
      await page.getByTestId('case-form-page').waitFor();
      await page.getByTestId('bo-sung-he-moi-info').locator('summary').click();
      const input = page.getByLabel('Đề xuất xử lý', { exact: true });
      await expect(input).toHaveValue('Original proposal');
      await input.fill('Đề xuất cập nhật ' + tag);
      assert.equal(await page.getByTestId('parity-field-deXuat').count(), 0, 'No second proposal input');
      const saved = page.waitForResponse(r => r.url().endsWith(`/cases/${record.id}`) && r.request().method() === 'PUT');
      // Existing edit contract saves directly; the summary gate belongs to creation.
      await page.getByTestId('btn-save').click(); const savedResponse = await saved; assert.equal(savedResponse.status(), 200);
      assert.equal(savedResponse.request().postDataJSON().deXuat, 'Đề xuất cập nhật ' + tag, 'Edit payload must carry proposal');
      assert.equal((await db.case.findUniqueOrThrow({ where: { id: record.id } })).deXuat, 'Đề xuất cập nhật ' + tag);
      await page.goto(base + `/cases/${record.id}/edit`);
      await page.getByTestId('bo-sung-he-moi-info').locator('summary').click();
      await expect(input).toHaveValue('Đề xuất cập nhật ' + tag);
      await page.screenshot({ path: path.join(out, 'amendment-proposal-reload.png'), fullPage: true });
    });
    const searchToken = 'zz' + tag.replaceAll('-', '');
    const utdt = await db.case.create({ data: { caseCode: 'UAT-UTDT-' + tag, name: 'Synthetic search ' + tag, caseProvenance: 'UY_THAC_DIEU_TRA', caseType: 'UY_THAC_DIEU_TRA', assignedTeamId: f.toTeamId, ngayDeXuat: new Date(), ketQuaUyThac: 'Đã xác minh ' + searchToken, ngayTraKetQua: new Date() } });
    await check('A02-BROWSER-SEARCH-REGISTERED-COLUMN', async () => {
      await page.goto(base + '/uy-thac-dieu-tra');
      await page.getByRole('combobox', { name: 'Tìm kiếm trong danh sách' }).fill('da xac minh ' + searchToken);
      const option = page.getByRole('option').filter({ hasText: /Kết quả ủy thác:/ }); await option.click();
      await page.locator('[data-testid="the-tim-kiem"][data-khoa="ketQuaUyThac"][data-hop-le="true"]').waitFor();
      await page.getByText(utdt.caseCode, { exact: true }).waitFor();
      await page.reload(); await page.getByText(utdt.caseCode, { exact: true }).waitFor();
      await page.screenshot({ path: path.join(out, 'amendment-search-reload.png'), fullPage: true });
    });
    const source = suffix => db.incident.create({ data: { code: 'UAT-' + suffix + '-' + tag, name: 'Synthetic restored ' + suffix + ' ' + tag, status: 'PHUC_HOI_NGUON_TIN', intakeStage: 'DA_NHAN', assignedTeamId: f.toTeamId, ngayDeXuat: new Date(), createdById: f.admin.user.id } });
    const transfer = await source('transfer');
    await check('A03-BROWSER-DIRECT-TRANSFER', async () => {
      await page.goto(base + '/vu-viec?incidents_q=' + encodeURIComponent(transfer.code));
      await page.getByTestId(`btn-action-menu-${transfer.id}`).click(); await page.getByTestId(`btn-transition-${transfer.id}`).click();
      const modal = page.getByTestId('status-transition-modal');
      await modal.getByTestId('status-transition-select').selectOption('DA_CHUYEN_DON_VI');
      assert.equal(await modal.getByTestId('btn-confirm-transition').isDisabled(), true);
      await modal.getByTestId('transition-transfer-unit').fill('Đơn vị nhận kiểm thử');
      const response = page.waitForResponse(r => r.url().endsWith(`/incidents/${transfer.id}/transfer`) && r.request().method() === 'PATCH');
      await modal.getByTestId('btn-confirm-transition').click(); assert.equal((await response).status(), 200);
      await page.goto(base + '/vu-viec/' + transfer.id); await page.getByText('Đã chuyển đơn vị', { exact: true }).waitFor();
      assert.equal((await db.incident.findUniqueOrThrow({ where: { id: transfer.id } })).chuyenDenDonVi, 'Đơn vị nhận kiểm thử');
      await page.screenshot({ path: path.join(out, 'amendment-restored-transfer.png'), fullPage: true });
    });
    const prosecution = await source('prosecute');
    await check('A03-BROWSER-RESTORED-PROSECUTION-ENTRYPOINTS', async () => {
      await page.goto(base + '/vu-viec/' + prosecution.id); await page.getByTestId('incident-detail-prosecute-btn').waitFor();
      await page.goto(base + '/vu-viec/' + prosecution.id + '/edit');
      // Existing Case entry from Incident form remains available after restoring.
      await page.getByTestId('tab-nut-info').click();
      const extra = page.getByTestId('bo-sung-he-moi-info');
      if (await extra.count()) await extra.locator('summary').click();
      await page.getByTestId('section-ket-qua').getByRole('button', { name: 'Kết quả xử lý vụ việc' }).click();
      await page.getByTestId('incident-form-prosecute-btn').waitFor();
      await page.goto(base + '/vu-viec?incidents_q=' + encodeURIComponent(prosecution.code));
      await page.getByTestId(`btn-action-menu-${prosecution.id}`).click(); await page.getByTestId(`btn-prosecute-${prosecution.id}`).click();
      const modal = page.getByTestId('prosecute-modal');
      await modal.getByTestId('field-case-name').fill('Synthetic restored Case ' + tag);
      await modal.getByTestId('field-prosecution-decision').fill('UAT-QD-' + tag);
      await modal.getByTestId('field-prosecution-date').fill('2026-10-06');
      const response = page.waitForResponse(r => r.url().endsWith(`/incidents/${prosecution.id}/prosecute`) && r.request().method() === 'POST');
      await modal.getByTestId('btn-confirm-prosecute').click(); assert.equal((await response).status(), 201);
      await page.goto(base + '/vu-viec/' + prosecution.id); await page.getByText('Đã chuyển vụ án', { exact: true }).waitFor();
      const result = await db.incident.findUniqueOrThrow({ where: { id: prosecution.id } }); assert.ok(result.linkedCaseId);
      assert.equal(await db.case.count({ where: { linkedIncidentId: prosecution.id } }), 1);
      await page.screenshot({ path: path.join(out, 'amendment-restored-prosecution.png'), fullPage: true });
    });
    await check('A-BROWSER-NO-CRASH', async () => assert.deepEqual(errors, []));
  } finally {
    const verdict = cases.length && cases.every(x => x.result === 'PASS') ? 'PASS' : 'FAIL';
    fs.writeFileSync(path.join(out, 'amendment-browser-uat.json'), JSON.stringify({ timestamp: new Date().toISOString(), target: base, verdict, cases }, null, 2));
    console.log(`${verdict}: ${cases.filter(x => x.result === 'PASS').length}/${cases.length} browser amendment groups`);
    for (const item of cases.filter(x => x.result === 'FAIL')) console.error(item.id + ': ' + item.message);
    if (verdict !== 'PASS') process.exitCode = 1;
    await browser.close(); await db.$disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
