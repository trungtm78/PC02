import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { getAuthToken, loginToPage } from '../helpers/auth';

const API = process.env.UAT_API_URL || 'http://127.0.0.1:3000/api/v1';
const runId = `uat-${randomUUID()}`;
const uniqueDigits = String(Date.now()).slice(-9);
const idNumber = `079${uniqueDigits}`;
const phone = `09${uniqueDigits.slice(-8)}`;
const originalName = `Vụ việc đồng bộ ${runId}`;
const clonedName = `${originalName} bản sao`;
const resolvingUnit = `Đơn vị UAT ${runId}`;
const reporterName = `Người cung cấp ${runId}`;
const today = new Date().toISOString().slice(0, 10);
let originalId = '';
let clonedId = '';

function authHeaders(extra: Record<string, string> = {}) {
  const token = getAuthToken();
  expect(token, 'global setup phải tạo JWT quản trị').not.toBe('');
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function bodyData(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  const body = await response.json();
  return body.data?.data ?? body.data ?? body;
}

async function waitForIncidentForm(page: Page) {
  await expect(page.getByTestId('incident-form-page')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('tab-nut-info').click();
  const field = page.getByTestId('field-name');
  const details = field.locator('xpath=ancestor::details[1]');
  if (await details.count() && !(await details.getAttribute('open'))) {
    await details.locator('summary').click();
  }
  await expect(field).toBeVisible();
}

test.describe.serial('Incident parity real UAT', () => {
  test('API creates exactly one incident for retries and rejects key reuse with another payload', async ({ request }) => {
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
    const idempotencyKey = `incident-${runId}`;
    const create = await request.post(`${API}/incidents`, {
      headers: authHeaders({ 'Idempotency-Key': idempotencyKey }),
      data: payload,
    });
    expect(create.ok(), await create.text()).toBe(true);
    originalId = (await bodyData(create)).id;
    expect(originalId).toBeTruthy();

    const retry = await request.post(`${API}/incidents`, {
      headers: authHeaders({ 'Idempotency-Key': idempotencyKey }),
      data: payload,
    });
    expect(retry.ok(), await retry.text()).toBe(true);
    expect((await bodyData(retry)).id).toBe(originalId);

    const conflictingRetry = await request.post(`${API}/incidents`, {
      headers: authHeaders({ 'Idempotency-Key': idempotencyKey }),
      data: { ...payload, name: `${originalName} thay đổi` },
      failOnStatusCode: false,
    });
    expect(conflictingRetry.status()).toBe(409);
  });

  test('web edits source and quick-created resolving unit, then clones all user data through duplicate review', async ({ page }) => {
    await loginToPage(page, `/vu-viec/${originalId}/edit`);
    await waitForIncidentForm(page);

    await expect(page.getByTestId('field-nguonDon-trigger')).toContainText('Trực tiếp');
    await expect(page.getByTestId('nhom-dinh-danh-nguoi-cung-cap')).toBeVisible();
    await expect(page.getByTestId('field-cmndNguoiToGiac')).toHaveValue(idNumber);

    const actions = page.getByTestId('form-action-bar-actions');
    const positions = await actions.locator('button').evaluateAll((buttons) =>
      buttons.map((button) => ({
        id: button.getAttribute('data-testid'),
        text: button.textContent?.trim() ?? '',
      })),
    );
    const indexOf = (id: string) => positions.findIndex((item) => item.id === id);
    expect(indexOf('btn-cancel-top')).toBeLessThan(indexOf('btn-clone-incident'));
    expect(indexOf('btn-clone-incident')).toBeLessThan(indexOf('btn-print-docs'));
    expect(indexOf('btn-print-docs')).toBeLessThan(positions.findIndex((item) => item.id?.startsWith('btn-save-top')));

    await page.getByTestId('field-supervisingUnit-trigger').click();
    await page.getByTestId('field-supervisingUnit-search').fill(resolvingUnit);
    await page.getByTestId('field-supervisingUnit-create-new').click();
    await expect(page.getByTestId('quick-create-directory-modal')).toBeVisible();
    await expect(page.getByTestId('quick-create-directory-name')).toHaveValue(resolvingUnit);
    await page.getByTestId('quick-create-directory-save').click();
    await expect(page.getByTestId('quick-create-directory-modal')).toBeHidden();
    await expect(page.getByTestId('field-supervisingUnit-trigger')).toContainText(resolvingUnit);

    const updateResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/v1/incidents/${originalId}`) && response.request().method() === 'PUT',
    );
    await page.getByTestId('btn-save-top').click();
    expect((await updateResponse).ok()).toBe(true);
    await expect(page).toHaveURL(/\/vu-viec(?:\?|$)/, { timeout: 20_000 });

    await loginToPage(page, `/vu-viec/${originalId}/edit`);
    await waitForIncidentForm(page);
    await page.getByTestId('btn-clone-incident').click();
    await expect(page).toHaveURL(/\/vu-viec\/new$/);
    await expect(page.getByTestId('incident-clone-review')).toBeVisible();
    await waitForIncidentForm(page);
    await expect(page.getByTestId('field-name')).toHaveValue(originalName);
    await expect(page.getByTestId('field-benVu')).toHaveValue(reporterName);
    await expect(page.getByTestId('field-cmndNguoiToGiac')).toHaveValue(idNumber);
    await expect(page.getByTestId('field-supervisingUnit-trigger')).toContainText(resolvingUnit);

    await page.getByTestId('field-name').fill(clonedName);
    await page.getByTestId('btn-save-top').click();
    const acknowledge = page.getByRole('button', { name: 'Đã rà soát các hồ sơ trùng' });
    await expect(acknowledge).toBeVisible({ timeout: 20_000 });
    await acknowledge.click();

    const cloneResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/v1/incidents') && response.request().method() === 'POST',
    );
    await page.getByTestId('btn-save-top').click();
    const response = await cloneResponse;
    expect(response.ok(), await response.text()).toBe(true);
    clonedId = (await response.json()).data.id;
    await expect(page).toHaveURL(/\/vu-viec(?:\?|$)/, { timeout: 20_000 });
  });

  test('API reload, search and current-view Excel all observe the same persisted clone', async ({ request, page }) => {
    const recordResponse = await request.get(`${API}/incidents/${clonedId}`, { headers: authHeaders() });
    expect(recordResponse.ok(), await recordResponse.text()).toBe(true);
    const record = await bodyData(recordResponse);
    expect(record).toMatchObject({
      id: clonedId,
      name: clonedName,
      benVu: reporterName,
      cmndNguoiToGiac: idNumber,
      donViGiaiQuyet: resolvingUnit,
      ngayVietDon: expect.stringContaining('2026-09-20'),
      nhanXet: `Nhận xét ${runId}`,
      status: 'TIEP_NHAN',
    });

    const listResponse = await request.get(`${API}/incidents`, {
      headers: authHeaders(),
      params: { search: clonedName, limit: '20' },
    });
    expect(listResponse.ok(), await listResponse.text()).toBe(true);
    const list = await bodyData(listResponse);
    expect(list.some((item: { id: string }) => item.id === clonedId)).toBe(true);

    const exportResponse = await request.get(`${API}/incidents/export/danh-sach`, {
      headers: authHeaders(),
      params: { search: clonedName },
    });
    expect(exportResponse.ok(), await exportResponse.text()).toBe(true);
    expect(exportResponse.headers()['content-type']).toContain('spreadsheetml');

    await loginToPage(page, '/vu-viec');
    const listSearch = page.getByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await listSearch.fill(clonedName);
    await listSearch.press('Enter');
    await expect(page.getByText(clonedName).first()).toBeVisible({ timeout: 30_000 });
  });
});
