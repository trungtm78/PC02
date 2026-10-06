const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const PizZip = require('../backend/node_modules/pizzip');

async function main() {
  const f = JSON.parse(fs.readFileSync(process.env.INCIDENT_BROWSER_FIXTURE, 'utf8'));
  const base = 'http://127.0.0.1:5179';
  const out = path.resolve('docs/test-evidence/incident-intake/continuation');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const cases = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Ho_Chi_Minh' });
    await context.addInitScript(({ token, user }) => {
      if (location.origin === 'http://127.0.0.1:5179') { sessionStorage.setItem('accessToken', token); sessionStorage.setItem('authProfile', JSON.stringify(user)); }
    }, f.receiver);
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const verify = async (id, action) => {
      try { await action(); cases.push({ id, result: 'PASS' }); }
      catch (e) { cases.push({ id, result: 'FAIL', message: e.message }); await page.screenshot({ path: path.join(out, id + '-failure.png'), fullPage: true }); }
    };
    const api = async (resource) => {
      const response = await fetch(base + '/api/v1' + resource, { headers: { Authorization: 'Bearer ' + f.receiver.token } });
      assert.equal(response.status, 200, resource); return response.json();
    };
    let created;
    await verify('BROWSER-PROSECUTION-RELOAD', async () => {
      await page.goto(base + '/vu-viec');
      await page.getByTestId(`btn-action-menu-${f.uat.prosecution.id}`).waitFor();
      await page.getByTestId(`btn-action-menu-${f.uat.prosecution.id}`).click();
      await page.getByTestId(`btn-prosecute-${f.uat.prosecution.id}`).click();
      const modal = page.getByTestId('prosecute-modal'); await modal.waitFor();
      await modal.getByTestId('field-case-name').fill('Vụ án UAT khởi tố trên giao diện ' + f.uatTag);
      await modal.getByTestId('field-prosecution-decision').fill('QD-UAT-BROWSER-' + f.uatTag);
      await modal.getByTestId('field-prosecution-date').fill('');
      assert.equal(await modal.getByTestId('btn-confirm-prosecute').isDisabled(), true, 'Decision date required in UI');
      await modal.getByTestId('field-prosecution-date').fill('2026-10-06');
      await page.screenshot({ path: path.join(out, 'prosecution-decision.png'), fullPage: true });
      const response = page.waitForResponse(r => r.url().endsWith(`/incidents/${f.uat.prosecution.id}/prosecute`) && r.request().method() === 'POST');
      await modal.getByTestId('btn-confirm-prosecute').click();
      const http = await response; assert.equal(http.status(), 201);
      created = (await http.json()).data.case;
      assert.ok(created.id);
      await page.goto(base + '/vu-viec/' + f.uat.prosecution.id);
      await page.getByTestId('incident-form-page').waitFor();
      await page.getByTestId('incident-current-status').waitFor();
      await page.getByTestId('tab-nut-info').click();
      await page.getByTestId('bo-sung-he-moi-info').locator('summary').click();
      for (const group of await page.locator('[data-testid^="nhom-"][data-testid$="-nut"][aria-expanded="false"]').all()) await group.click();
      await page.getByTestId('field-name').waitFor();
      assert.equal(await page.getByTestId('field-name').inputValue(), f.uat.prosecution.name);
      await page.reload();
      await page.getByTestId('incident-current-status').getByText('Đã chuyển vụ án', { exact: true }).waitFor();
      const source = (await api('/incidents/' + f.uat.prosecution.id)).data;
      const destination = (await api('/cases/' + created.id)).data;
      assert.equal(source.linkedCaseId, created.id); assert.equal(destination.linkedIncidentId, source.id);
      assert.equal(destination.soQuyetDinhKhoiTo, 'QD-UAT-BROWSER-' + f.uatTag);
      assert.equal(destination.ngayKhoiTo.slice(0, 10), '2026-10-06');
      assert.equal(destination.moTaChiTiet, f.uat.prosecution.description);
      assert.equal(destination.tenCungCap, f.uat.prosecution.benVu);
      assert.equal(destination.metadata.incidentSourceSnapshot.id, source.id);
      assert.notEqual(destination.deadline, f.uat.prosecution.deadline);
      await page.screenshot({ path: path.join(out, 'prosecution-after-reload.png'), fullPage: true });
    });
    await verify('WORD-PERSISTED-DECISION', async () => {
      assert.ok(created?.id, 'Browser prosecution must succeed first');
      const response = await fetch(base + `/api/v1/cases/${created.id}/export-documents`, { method: 'POST', headers: { Authorization: 'Bearer ' + f.receiver.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ templateIds: [f.uat.templateId], mode: 'merged' }) });
      assert.equal(response.status, 201, 'Existing POST export contract; no manual decision override');
      const bytes = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(path.join(out, 'persisted-prosecution.docx'), bytes);
      const zip = new PizZip(bytes); const xml = zip.file('word/document.xml').asText();
      const text = xml.replace(/<[^>]+>/g, '');
      assert.ok(text.includes('QD-UAT-BROWSER-' + f.uatTag));
      assert.match(text, /ngày\s+06\s+tháng\s+10\s+năm\s+2026/);
      assert.ok(!text.includes('{soQuyetDinhKhoiTo}') && !text.includes('{ngayKhoiTo}'));
    });
    await verify('BROWSER-HISTORY-URL-BACK', async () => {
      const url = base + '/vu-viec?incidents_history_status=TAM_DINH_CHI';
      await page.goto(url);
      await page.getByText(/Lịch sử hồ sơ cũ chưa xác minh/).waitFor();
      await page.goto(base + '/vu-viec/' + f.uat.history.id);
      await page.getByTestId('incident-form-page').waitFor();
      await page.getByTestId('incident-current-status').waitFor();
      await page.getByTestId('tab-nut-info').click();
      await page.getByTestId('bo-sung-he-moi-info').locator('summary').click();
      for (const group of await page.locator('[data-testid^="nhom-"][data-testid$="-nut"][aria-expanded="false"]').all()) await group.click();
      await page.getByTestId('field-name').waitFor();
      assert.equal(await page.getByTestId('field-name').inputValue(), f.uat.history.name);
      await page.goBack();
      assert.ok(page.url().includes('incidents_history_status=TAM_DINH_CHI'));
      await page.getByText(/Lịch sử hồ sơ cũ chưa xác minh/).waitFor();
      assert.deepEqual(errors, [], 'No page crashes across tested journeys');
      await page.screenshot({ path: path.join(out, 'history-url-restored.png'), fullPage: true });
    });
    const verdict = cases.every(x => x.result === 'PASS') ? 'PASS' : 'FAIL';
    fs.writeFileSync(path.join(out, 'browser-uat.json'), JSON.stringify({ timestamp: new Date().toISOString(), verdict, cases }, null, 2));
    console.log(`${verdict}: ${cases.filter(x => x.result === 'PASS').length}/${cases.length} browser/Word acceptance groups`);
    for (const x of cases.filter(x => x.result === 'FAIL')) console.error(x.id + ': ' + x.message);
    if (verdict === 'FAIL') process.exitCode = 1;
    await context.close();
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
