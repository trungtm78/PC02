const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium } = require('@playwright/test');

async function main() {
  const f = JSON.parse(fs.readFileSync(process.env.INCIDENT_BROWSER_FIXTURE, 'utf8'));
  const base = 'http://127.0.0.1:5179';
  const out = path.resolve('docs/test-evidence/incident-intake/continuation');
  const tag = randomUUID();
  const firstName = `first-uat-${tag}.txt`, secondName = `second-uat-${tag}.txt`;
  const fields = [
    ['info', 'description', 'Hồ sơ kiểm chứng mười tab ' + tag],
    ['info', 'ngayDeXuat', '2026-09-12'],
    ['incident', 'soQDPhanCongNguonTin', 'QD-PC-' + tag],
    ['case', 'legacyExtra.soQuyetDinhKhoiTo', 'QD-META-' + tag],
    ['subjects', 'legacyExtra.soKLDT', 'KLDT-' + tag],
    ['incident-tdc', 'soQuyetDinhTamDinhChiVV', 'TDC-VV-' + tag],
    ['case-tdc', 'legacyExtra.soQuyetDinhTamDinhChi', 'TDC-VA-' + tag],
    ['evidence', 'legacyExtra.vatChungMoTa', 'Vật chứng kiểm thử ' + tag],
    ['business-files', 'legacyExtra.soDangKyHoSo', 'HS-' + tag],
    ['statistics', 'legacyExtra.soTienBiThietHai', '123'],
    ['media', 'legacyExtra.tongSoBienBanGhiLoiKhai', '2'],
  ];
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const cases = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Ho_Chi_Minh' });
    await context.addInitScript(({ token, user }) => {
      if (location.origin === 'http://127.0.0.1:5179') { sessionStorage.setItem('accessToken', token); sessionStorage.setItem('authProfile', JSON.stringify(user)); }
    }, f.sender);
    const page = await context.newPage();
    const uploads = [];
    page.on('response', async response => {
      if (response.url().endsWith('/api/v1/documents') && response.request().method() === 'POST') {
        let message = ''; if (response.status() >= 400) { const body = await response.json().catch(() => ({})); message = JSON.stringify(body.message ?? body.error ?? {}); }
        uploads.push({ status: response.status(), message });
      }
    });
    let failedOnce = false;
    await page.route('**/api/v1/documents', route => {
      const request = route.request();
      if (request.method() === 'POST' && !failedOnce && request.postDataBuffer()?.includes(Buffer.from(secondName))) {
        failedOnce = true; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic upload failure for retry test' }) });
      }
      return route.continue();
    });
    const input = (key) => page.locator(`[data-testid="field-${key}"]:visible`);
    const visit = async (tab) => { await page.getByTestId('tab-nut-' + tab).click(); };
    const verify = async (id, action) => {
      try { await action(); cases.push({ id, result: 'PASS' }); }
      catch (e) { cases.push({ id, result: 'FAIL', message: e.message }); await page.screenshot({ path: path.join(out, id + '-failure.png'), fullPage: true }); }
    };
    const read = async (id) => {
      const response = await fetch(base + '/api/v1/incidents/' + id, { headers: { Authorization: 'Bearer ' + f.sender.token } });
      assert.equal(response.status, 200); return (await response.json()).data;
    };
    const readDocuments = async (id) => {
      const response = await fetch(base + '/api/v1/documents?incidentId=' + id, { headers: { Authorization: 'Bearer ' + f.sender.token } });
      assert.equal(response.status, 200); const body = await response.json(); return Array.isArray(body) ? body : body.data;
    };
    const mutate = async (actor, route, method, body) => {
      const response = await fetch(base + '/api/v1' + route, { method, headers: { Authorization: 'Bearer ' + f[actor].token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      assert.ok(response.status >= 200 && response.status < 300, JSON.stringify(data.message ?? data.error ?? route));
      return data.data;
    };
    let created;
    await verify('FORM-10-TABS-UPLOAD-RETRY', async () => {
      await page.goto(base + '/vu-viec/tiep-nhan/new'); await page.getByTestId('incident-form-page').waitFor();
      assert.equal(await page.locator('[data-testid^="tab-nut-"]').count(), 10);
      for (const [tab, key, value] of fields) { await visit(tab); await input(key).fill(value); }
      await page.getByTestId('stage-file-input').setInputFiles([
        { name: firstName, mimeType: 'text/plain', buffer: Buffer.from('Synthetic first attachment') },
        { name: secondName, mimeType: 'text/plain', buffer: Buffer.from('Synthetic second attachment') },
      ]);
      const saved = page.waitForResponse(r => r.url().endsWith('/incidents/intake') && r.request().method() === 'POST');
      await page.getByTestId('btn-save-top').click();
      const response = await saved; const savedBody = await response.json();
      assert.equal(response.status(), 201, JSON.stringify(savedBody.message ?? savedBody.error ?? 'Intake create'));
      created = savedBody.data;
      await page.getByTestId('stage-retry').waitFor(); assert.equal(failedOnce, true);
      assert.ok(page.url().includes('/tiep-nhan/new'), 'Partial failure keeps saved ID and staged files in form');
      const beforeRetry = await readDocuments(created.id); assert.equal(beforeRetry.length, 1, JSON.stringify(uploads));
      const retried = page.waitForResponse(r => r.url().endsWith('/api/v1/documents') && r.request().method() === 'POST');
      await page.getByTestId('stage-retry').click();
      assert.equal((await retried).status(), 201, 'Failed file retry must reach the real backend');
      await page.getByTestId('stage-retry').waitFor({ state: 'hidden' });
      const docs = await readDocuments(created.id); assert.equal(docs.length, 2);
      assert.equal(new Set(docs.map(d => d.id)).size, 2);
      assert.ok(docs.some(d => d.id === beforeRetry[0].id), 'The first successful upload must survive retry unchanged');
      // Original filename is separate from randomized storage name and the
      // display title (batch uploads append an ordinal to display titles).
      assert.deepEqual(docs.map(d => d.originalName).sort(), [firstName, secondName].sort());
      for (const doc of docs) {
        const downloaded = await fetch(base + '/api/v1/documents/' + doc.id + '/download', { headers: { Authorization: 'Bearer ' + f.sender.token } });
        assert.equal(downloaded.status, 200);
        assert.equal(await downloaded.text(), doc.originalName === firstName ? 'Synthetic first attachment' : 'Synthetic second attachment');
      }
      assert.equal((await read(created.id)).intakeStage, 'PHAN_LOAI');
      await page.screenshot({ path: path.join(out, 'form-upload-retry.png'), fullPage: true });
    });
    await verify('FORM-EDIT-RELOAD-10-TABS', async () => {
      assert.ok(created?.id, 'Creation is required');
      await page.goto(base + '/vu-viec/' + created.id + '/edit');
      await page.getByTestId('incident-form-page').waitFor();
      for (const [tab, key, value] of fields) { await visit(tab); assert.equal(await input(key).inputValue(), value, key); }
      await visit('info'); await input('description').fill(fields[0][2] + ' đã chỉnh sửa'); fields[0][2] += ' đã chỉnh sửa';
      const saved = page.waitForResponse(r => r.url().endsWith('/incidents/' + created.id) && r.request().method() === 'PUT');
      await page.getByTestId('btn-save-top').click(); assert.equal((await saved).status(), 200);
      await page.goto(base + '/vu-viec/' + created.id + '/edit'); await page.reload();
      await page.getByTestId('incident-form-page').waitFor();
      for (const [tab, key, value] of fields) { await visit(tab); assert.equal(await input(key).inputValue(), value, key); }
    });
    await verify('FORM-CLONE-IDENTITY-ATTACHMENTS', async () => {
      assert.ok(created?.id);
      const beforeLink = await read(created.id);
      const handoff = await mutate('sender', `/incidents/${created.id}/handoffs`, 'POST', { toTeamId: f.toTeamId, expectedUpdatedAt: beforeLink.updatedAt, requestKey: randomUUID() });
      const pending = await read(created.id);
      await mutate('admin', `/incidents/${created.id}/handoffs/${handoff.id}/accept`, 'POST', { expectedUpdatedAt: pending.updatedAt, expectedHandoffUpdatedAt: handoff.updatedAt });
      await mutate('admin', `/incidents/${created.id}/assign`, 'PATCH', { assignedTeamId: f.toTeamId, investigatorId: f.receiver.user.id });
      await mutate('admin', `/incidents/${created.id}/prosecute`, 'POST', { caseName: 'Vụ án nguồn kiểm chứng clone ' + tag, prosecutionDecision: 'QD-CLONE-' + tag, prosecutionDate: '2026-10-06' });
      const original = await read(created.id);
      assert.ok(original.linkedCaseId, 'Positive source link must exist before testing reset');
      await page.goto(base + '/vu-viec/' + created.id + '/edit');
      await page.getByTestId('incident-form-page').waitFor();
      await page.getByTestId('btn-clone-incident').click();
      await page.getByTestId('incident-clone-review').waitFor();
      for (const [tab, key, value] of fields) { await visit(tab); assert.equal(await input(key).inputValue(), value, key); }
      assert.equal(await page.getByTestId('stage-queued-list').count(), 0, 'Cloning resets attachments');
      await visit('info'); await input('description').fill('Bản sao vụ việc độc lập ' + randomUUID());
      const saved = page.waitForResponse(r => r.url().endsWith('/incidents') && r.request().method() === 'POST');
      await page.getByTestId('btn-save-top').click();
      const response = await saved; assert.equal(response.status(), 201);
      const clone = (await response.json()).data;
      assert.notEqual(clone.id, original.id); assert.notEqual(clone.code, original.code);
      assert.equal(clone.status, 'TIEP_NHAN'); assert.equal(clone.linkedCaseId, null);
      assert.equal(clone.ngayDeXuat, original.ngayDeXuat); assert.equal(clone.deadline, original.deadline);
      assert.equal((await readDocuments(clone.id)).length, 0);
      assert.deepEqual(clone.metadata, original.metadata);
      await page.screenshot({ path: path.join(out, 'form-clone-saved.png'), fullPage: true });
    });
    const verdict = cases.every(x => x.result === 'PASS') ? 'PASS' : 'FAIL';
    fs.writeFileSync(path.join(out, 'form-uat.json'), JSON.stringify({ timestamp: new Date().toISOString(), verdict, cases }, null, 2));
    console.log(`${verdict}: ${cases.filter(x => x.result === 'PASS').length}/${cases.length} form acceptance groups`);
    for (const x of cases.filter(x => x.result === 'FAIL')) console.error(x.id + ': ' + x.message);
    if (verdict === 'FAIL') process.exitCode = 1;
    await context.close();
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
