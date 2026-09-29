import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium, request } from 'playwright';
import dotenv from 'dotenv';

const apiBase = `${(process.env.UAT_API_URL || 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '')}/`;
const webBase = process.env.UAT_WEB_URL || 'http://localhost:5179';
dotenv.config({ path: 'tests/.env.test', quiet: true });
const loginApi = await request.newContext({ baseURL: apiBase });
const login = await loginApi.post('auth/login', {
  data: {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
  },
});
if (!login.ok()) throw new Error(`Local UAT login failed: ${login.status()}`);
const loginBody = await login.json();
const token = (loginBody.data ?? loginBody).accessToken;
if (!token) throw new Error('Local UAT login response did not contain an access token');
await loginApi.dispose();

const runId = `uat-${randomUUID()}`;
const uniqueDigits = String(Date.now()).slice(-9);
const idNumber = `079${uniqueDigits}`;
const phone = `09${uniqueDigits.slice(-8)}`;
const originalName = `Vụ việc đồng bộ ${runId}`;
const clonedName = `${originalName} bản sao`;
const resolvingUnit = `Đơn vị UAT ${runId}`;
const reporterName = `Người cung cấp ${runId}`;
const today = new Date().toISOString().slice(0, 10);
const payload = {
  name: originalName,
  benVu: reporterName,
  chuyenTuDonVi: 'Trực tiếp',
  donViGiaiQuyet: 'PC02 - UAT',
  sdtNguoiToGiac: phone,
  cmndNguoiToGiac: idNumber,
  sinhNamNguoiToGiac: '1988',
  ngayCapCccd: '2021-04-30',
  noiCapCccd: 'Cục C06',
  ngayVietDon: '2026-09-20',
  ngayDeXuat: today,
  nhanXet: `Nhận xét ${runId}`,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function revealField(page, testId) {
  const field = page.getByTestId(testId);
  const details = field.locator('xpath=ancestor::details[1]');
  if (await details.count() && !(await details.getAttribute('open'))) {
    await details.locator('summary').click();
  }
  await field.waitFor();
  return field;
}

async function jsonData(response) {
  const body = await response.json();
  return body.data?.data ?? body.data ?? body;
}

const headers = { Authorization: `Bearer ${token}` };
const api = await request.newContext({ baseURL: apiBase, extraHTTPHeaders: headers });
const idempotencyKey = `incident-${runId}`;
const created = await api.post('incidents', {
  headers: { 'Idempotency-Key': idempotencyKey },
  data: payload,
});
assert(created.ok(), `Create failed: ${created.status()} ${await created.text()}`);
const originalId = (await jsonData(created)).id;
assert(originalId, 'Create response did not contain an incident id');

const retried = await api.post('incidents', {
  headers: { 'Idempotency-Key': idempotencyKey },
  data: payload,
});
assert(retried.ok(), `Idempotent retry failed: ${retried.status()}`);
assert((await jsonData(retried)).id === originalId, 'Idempotent retry created another incident');

const conflict = await api.post('incidents', {
  headers: { 'Idempotency-Key': idempotencyKey },
  data: { ...payload, name: `${originalName} changed` },
});
assert(conflict.status() === 409, `Changed payload should return 409, got ${conflict.status()}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: webBase });
await context.addInitScript((jwt) => {
  sessionStorage.setItem('accessToken', jwt);
  localStorage.setItem('refreshToken', jwt);
}, token);
const page = await context.newPage();
page.setDefaultTimeout(30_000);
await page.goto(`/vu-viec/${originalId}/edit`, { waitUntil: 'domcontentloaded' });
await page.getByTestId('incident-form-page').waitFor();
await page.getByTestId('tab-nut-info').click();
await revealField(page, 'field-name');
assert((await page.getByTestId('field-nguonDon-trigger').textContent())?.includes('Trực tiếp'), 'Direct source was not restored');
await page.getByTestId('nhom-dinh-danh-nguoi-cung-cap').waitFor();
assert(await page.getByTestId('field-cmndNguoiToGiac').inputValue() === idNumber, 'CCCD was not restored');

const positions = await page.getByTestId('form-action-bar-actions').locator('button').evaluateAll((buttons) =>
  buttons.map((button) => button.getAttribute('data-testid')),
);
const cancelIndex = positions.indexOf('btn-cancel-top');
const cloneIndex = positions.indexOf('btn-clone-incident');
const printIndex = positions.indexOf('btn-print-docs');
const saveIndex = positions.findIndex((id) => id?.startsWith('btn-save-top'));
assert(cancelIndex >= 0 && cancelIndex < cloneIndex && cloneIndex < printIndex && printIndex < saveIndex, `Wrong action order: ${positions.join(',')}`);

await page.getByTestId('field-supervisingUnit-trigger').click();
await page.getByTestId('field-supervisingUnit-search').fill(resolvingUnit);
await page.getByTestId('field-supervisingUnit-create-new').click();
await page.getByTestId('quick-create-directory-modal').waitFor();
assert(await page.getByTestId('quick-create-directory-name').inputValue() === resolvingUnit, 'Quick create lost the suggested unit name');
await page.getByTestId('quick-create-directory-save').click();
await page.getByTestId('quick-create-directory-modal').waitFor({ state: 'hidden' });
assert((await page.getByTestId('field-supervisingUnit-trigger').textContent())?.includes(resolvingUnit), 'Created unit was not selected');

const updateResponse = page.waitForResponse((response) =>
  response.url().includes(`/api/v1/incidents/${originalId}`) && response.request().method() === 'PUT',
  { timeout: 10_000 },
).catch(() => null);
await page.getByTestId('btn-save-top').click();
const updated = await updateResponse;
if (!updated) {
  const messages = await page.locator('[role="alert"], [role="status"]').allTextContents();
  throw new Error(`Web update did not issue PUT. Messages: ${messages.join(' | ')}`);
}
assert(updated.ok(), `Web update failed: ${updated.status()} ${await updated.text()}`);
await page.waitForURL(/\/vu-viec(?:\?|$)/);

await page.goto(`/vu-viec/${originalId}/edit`, { waitUntil: 'domcontentloaded' });
await page.getByTestId('incident-form-page').waitFor();
await page.getByTestId('tab-nut-info').click();
await revealField(page, 'field-name');
await page.getByTestId('btn-clone-incident').click();
await page.waitForURL(/\/vu-viec\/new$/);
await page.getByTestId('incident-clone-review').waitFor();
await page.getByTestId('tab-nut-info').click();
await revealField(page, 'field-name');
assert(await page.getByTestId('field-name').inputValue() === originalName, 'Clone lost the title');
assert(await page.getByTestId('field-benVu').inputValue() === reporterName, 'Clone lost reporter');
assert(await page.getByTestId('field-cmndNguoiToGiac').inputValue() === idNumber, 'Clone lost CCCD');
assert((await page.getByTestId('field-supervisingUnit-trigger').textContent())?.includes(resolvingUnit), 'Clone lost resolving unit');

await page.getByTestId('field-name').fill(clonedName);
await page.getByTestId('btn-save-top').click();
const acknowledge = page.getByRole('button', { name: 'Đã rà soát các hồ sơ trùng' });
await acknowledge.waitFor();
await acknowledge.click();
const cloneResponsePromise = page.waitForResponse((response) =>
  response.url().endsWith('/api/v1/incidents') && response.request().method() === 'POST',
);
await page.getByTestId('btn-save-top').click();
const cloneResponse = await cloneResponsePromise;
assert(cloneResponse.ok(), `Clone save failed: ${cloneResponse.status()} ${await cloneResponse.text()}`);
const clonedId = (await cloneResponse.json()).data.id;
await page.waitForURL(/\/vu-viec(?:\?|$)/);

const reloaded = await api.get(`incidents/${clonedId}`);
assert(reloaded.ok(), `Reload failed: ${reloaded.status()}`);
const record = await jsonData(reloaded);
for (const [key, value] of Object.entries({
  name: clonedName,
  benVu: reporterName,
  cmndNguoiToGiac: idNumber,
  donViGiaiQuyet: resolvingUnit,
  nhanXet: `Nhận xét ${runId}`,
  status: 'TIEP_NHAN',
})) {
  assert(record[key] === value, `Reloaded ${key} mismatch: ${record[key]}`);
}
assert(String(record.ngayVietDon).includes('2026-09-20'), `Reloaded ngayVietDon mismatch: ${record.ngayVietDon}`);

const listed = await api.get('incidents', { params: { search: clonedName, limit: '20' } });
assert(listed.ok(), `Search failed: ${listed.status()}`);
assert((await jsonData(listed)).some((item) => item.id === clonedId), 'Search did not return the clone');
const exported = await api.get('incidents/export/danh-sach', { params: { search: clonedName } });
assert(exported.ok(), `Excel export failed: ${exported.status()} ${await exported.text()}`);
assert((exported.headers()['content-type'] || '').includes('spreadsheetml'), 'Excel export returned the wrong content type');

await page.goto('/vu-viec', { waitUntil: 'domcontentloaded' });
const listSearch = page.getByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
await listSearch.fill(clonedName);
await listSearch.press('Enter');
await page.getByText(clonedName).first().waitFor();
fs.mkdirSync('test-results/incident-parity', { recursive: true });
await page.screenshot({ path: 'test-results/incident-parity/incident-list-real-uat.png', fullPage: true });
await browser.close();
await api.dispose();
console.log(JSON.stringify({ ok: true, originalId, clonedId, runId }));
