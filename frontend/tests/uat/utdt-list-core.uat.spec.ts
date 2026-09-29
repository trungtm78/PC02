import type { APIRequestContext, Page } from '@playwright/test';
import { expect, readonlyTest, test } from '../e2e/support/isolated-session';

const apiBase = 'http://localhost:3000/api/v1';

type CreatedDelegation = {
  id: string;
  caseCode: string;
  name: string;
  ngayTiepNhan: string;
};

async function createDelegation(
  request: APIRequestContext,
  token: string,
  suffix: string,
  index: number,
  overrides: Record<string, unknown> = {},
): Promise<CreatedDelegation> {
  const day = String(index + 1).padStart(2, '0');
  const name = `UAT UL ${suffix} record ${String(index).padStart(2, '0')}`;
  const ngayTiepNhan = `2026-09-${day}T00:00:00.000Z`;
  const response = await request.post(`${apiBase}/cases`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name,
      caseType: 'UY_THAC_DIEU_TRA',
      caseProvenance: 'UY_THAC_DIEU_TRA',
      donViGiao: `UL-fixture-${suffix}`,
      ngayTiepNhan,
      ngayDeXuat: ngayTiepNhan,
      soQuyetDinhUyThac: `UL-${suffix}-${index}`,
      ...overrides,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = await response.json() as { data?: { id?: string; caseCode?: string } };
  expect(body.data?.id).toBeTruthy();
  return {
    id: body.data!.id!,
    caseCode: body.data?.caseCode ?? '',
    name,
    ngayTiepNhan,
  };
}

async function seedListMatrix(request: APIRequestContext, token: string, suffix: string) {
  const overrides: Record<number, Record<string, unknown>> = {
    0: { ketQuaUyThac: `Result ${suffix}`, ngayTraKetQua: '2026-09-01T00:00:00.000Z' },
    1: { metadata: { lyDoKhongThucHienDuoc: `Blocked ${suffix}` } },
    2: { thoiHanUyThac: '2020-01-01T00:00:00.000Z' },
    3: { thoiHanUyThac: '2035-01-01T00:00:00.000Z' },
  };
  const rows: CreatedDelegation[] = [];
  for (let index = 0; index < 21; index += 1) {
    rows.push(await createDelegation(request, token, suffix, index, overrides[index]));
  }
  return rows;
}

function listUrl(suffix: string, extra = '') {
  const token = encodeURIComponent(`donViGiao~UL-fixture-${suffix}`);
  return `/uy-thac-dieu-tra?utdt_tk=${token}${extra}`;
}

async function waitForList(page: Page, expectedCode: string) {
  await expect(page.getByText(expectedCode, { exact: true })).toBeVisible({ timeout: 20_000 });
}

test.describe.serial('UTDT list parity core', () => {
  const suffix = String(Date.now());
  let rows: CreatedDelegation[] = [];

  test.beforeAll(async ({ request, authToken }) => {
    test.setTimeout(180_000);
    rows = await seedListMatrix(request, authToken, suffix);
  });

  test('U-L01/U-L03/U-L04: hidden-column token search, dates and statistics use one scoped row set', async ({ page, request, authToken }) => {
    test.setTimeout(120_000);
    const headers = { Authorization: `Bearer ${authToken}` };
    const tk = `donViGiao~UL-fixture-${suffix}`;

    const tokenSearch = await request.get(`${apiBase}/cases`, {
      headers,
      params: { caseType: 'UY_THAC_DIEU_TRA', tk, limit: 50 },
    });
    expect(tokenSearch.ok(), await tokenSearch.text()).toBe(true);
    const tokenBody = await tokenSearch.json() as { data: Array<{ id: string; caseType: string }>; total: number };
    expect(tokenBody.total).toBe(21);
    expect(tokenBody.data.every(row => row.caseType === 'UY_THAC_DIEU_TRA')).toBe(true);

    const dated = await request.get(`${apiBase}/cases`, {
      headers,
      params: {
        caseType: 'UY_THAC_DIEU_TRA',
        tk,
        ngayTiepNhanFrom: '2026-09-10',
        ngayTiepNhanTo: '2026-09-12',
        limit: 50,
      },
    });
    expect(dated.ok(), await dated.text()).toBe(true);
    const datedBody = await dated.json() as { data: Array<{ id: string }>; total: number };
    expect(datedBody.total).toBe(3);
    expect(datedBody.data.map(row => row.id).sort()).toEqual(rows.slice(9, 12).map(row => row.id).sort());

    const stats = await request.get(`${apiBase}/cases/utdt-stats`, { headers, params: { tk } });
    expect(stats.ok(), await stats.text()).toBe(true);
    expect(await stats.json()).toMatchObject({
      total: 21,
      byTrangThai: {
        DA_PHAN_HOI: 1,
        KHONG_THUC_HIEN_DUOC: 1,
        QUA_HAN: 1,
        CHUA_PHAN_HOI: 18,
      },
    });

    await page.goto(listUrl(suffix, '&utdt_tnf=2026-09-10&utdt_tnt=2026-09-12'));
    await waitForList(page, rows[11].caseCode);
    await expect(page.getByText(rows[8].caseCode, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Tất cả/ })).toContainText('3');

    await page.getByTestId('btn-column-picker').click();
    await page.getByTestId('column-toggle-donViGiao').locator('input').uncheck();
    await expect(page.getByTestId('column-picker-hidden-count')).toBeVisible();
    await page.reload();
    await waitForList(page, rows[11].caseCode);
    await expect(page.getByRole('columnheader', { name: /Đơn vị giao/ })).toHaveCount(0);
    await page.getByTestId('btn-column-picker').click();
    await page.getByTestId('btn-column-reset').click();
  });

  test('U-L02: response chips keep filters in URL and browser Back restores the previous state', async ({ page }) => {
    await page.goto(listUrl(suffix));
    await waitForList(page, rows[20].caseCode);

    await page.getByRole('tab', { name: /Quá hạn/ }).click();
    await expect(page).toHaveURL(/utdt_status=QUA_HAN/);
    await waitForList(page, rows[2].caseCode);
    await expect(page.getByText(rows[0].caseCode, { exact: true })).toHaveCount(0);

    await page.getByRole('tab', { name: /Đã phản hồi/ }).click();
    await expect(page).toHaveURL(/utdt_status=DA_PHAN_HOI/);
    await waitForList(page, rows[0].caseCode);

    await page.goBack();
    await expect(page).toHaveURL(/utdt_status=QUA_HAN/);
    await waitForList(page, rows[2].caseCode);
    await expect(page.getByRole('tab', { name: /Quá hạn/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('U-L05: API sorting/pagination is stable and browser sort sends the same contract', async ({ page, request, authToken }) => {
    const headers = { Authorization: `Bearer ${authToken}` };
    const tk = `donViGiao~UL-fixture-${suffix}`;
    const load = async (offset: number, sortOrder: 'asc' | 'desc') => {
      const response = await request.get(`${apiBase}/cases`, {
        headers,
        params: { caseType: 'UY_THAC_DIEU_TRA', tk, limit: 5, offset, sortBy: 'ngayTiepNhan', sortOrder },
      });
      expect(response.ok(), await response.text()).toBe(true);
      return await response.json() as { data: Array<{ id: string; ngayTiepNhan: string }> };
    };
    const first = await load(0, 'asc');
    const second = await load(5, 'asc');
    expect(first.data.map(row => row.id).some(id => second.data.some(row => row.id === id))).toBe(false);
    expect(first.data.map(row => row.ngayTiepNhan)).toEqual([...first.data.map(row => row.ngayTiepNhan)].sort());
    const repeated = await load(0, 'asc');
    expect(repeated.data.map(row => row.id)).toEqual(first.data.map(row => row.id));

    const sortedRequest = page.waitForRequest(request =>
      request.url().includes('/api/v1/cases?') && request.url().includes('sortBy=ngayTiepNhan'));
    await page.goto(listUrl(suffix));
    await waitForList(page, rows[20].caseCode);
    await page.getByTestId('sort-ngayTiepNhan').click();
    const requestSeen = await sortedRequest;
    expect(requestSeen.url()).toContain('sortOrder=desc');
    await expect(page.getByTestId('list-page-shell-pagination')).toBeVisible();
  });

  test('U-L06: column order and row density persist after reload', async ({ page }) => {
    await page.goto(listUrl(suffix));
    await waitForList(page, rows[20].caseCode);
    const density = page.getByTestId('chon-mat-do');
    await density.locator('button').first().click();
    await expect(density.locator('button').first()).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('btn-column-picker').click();
    const before = await page.getByTestId('column-picker-menu').locator('label').allTextContents();
    await page.getByTestId('doi-cho-xuong-ngayTiepNhan').click();
    await page.reload();
    await waitForList(page, rows[20].caseCode);
    await expect(page.getByTestId('chon-mat-do').locator('button').first()).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('btn-column-picker').click();
    const after = await page.getByTestId('column-picker-menu').locator('label').allTextContents();
    expect(after).not.toEqual(before);
    await page.getByTestId('btn-column-reset').click();
    await page.getByTestId('chon-mat-do').locator('button').nth(1).click();
  });

  test('U-L07: loading, server error, empty and filtered-empty states are distinct', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/cases?**', async route => {
      await gate;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) });
    });
    await page.goto('/uy-thac-dieu-tra');
    await expect(page.getByTestId('list-page-shell-table-loading')).toBeVisible();
    release();
    await expect(page.getByTestId('list-page-shell-table-empty')).toBeVisible();

    await page.unroute('**/api/v1/cases?**');
    await page.route('**/api/v1/cases?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'UAT forced outage' }) }));
    await page.reload();
    await expect(page.getByTestId('list-page-shell-table-error')).toContainText('Lỗi máy chủ');

    await page.unroute('**/api/v1/cases?**');
    await page.route('**/api/v1/cases?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) }));
    await page.goto('/uy-thac-dieu-tra?utdt_tk=donViGiao~missing-value');
    await expect(page.getByTestId('list-page-shell-table-empty-filtered')).toBeVisible();
  });

  test('U-L08: writable rows expose view/edit/delete and API returns the write-scope decision', async ({ page, request, authToken }) => {
    const response = await request.get(`${apiBase}/cases`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { caseType: 'UY_THAC_DIEU_TRA', tk: `donViGiao~UL-fixture-${suffix}`, limit: 1 },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const body = await response.json() as { data: Array<{ id: string; quyenGhi?: boolean }> };
    expect(body.data[0]?.quyenGhi).toBe(true);

    await page.goto(listUrl(suffix));
    await waitForList(page, rows[20].caseCode);
    await expect(page.getByTitle('Xem chi tiết').first()).toBeVisible();
    await expect(page.getByTitle('Sửa ủy thác').first()).toBeVisible();
    await expect(page.getByTitle('Xóa ủy thác').first()).toBeVisible();
  });
  test('U-L15: inline result update sends only result fields and derives the legal reply state', async ({ page, request, authToken }) => {
    const target = rows[20];
    await page.goto(listUrl(suffix));
    await waitForList(page, target.caseCode);

    const editor = page.getByTestId(`o-ket-qua-${target.id}`);
    await expect(editor).toBeVisible();
    await editor.click();
    await expect(page.getByTestId('modal-ket-qua-uy-thac')).toBeVisible();

    const result = `UAT verified result ${suffix}`;
    await page.getByRole('textbox', { name: 'Kết quả ủy thác' }).fill(result);
    await page.getByLabel('Ngày trả kết quả').fill('2026-09-29');
    const updateRequest = page.waitForRequest(candidate =>
      candidate.method() === 'PUT' && candidate.url().endsWith(`/api/v1/cases/${target.id}`));
    await page.getByTestId('btn-luu-ket-qua-uy-thac').click();

    const captured = await updateRequest;
    const payload = captured.postDataJSON() as Record<string, unknown>;
    expect(payload).toMatchObject({
      ketQuaUyThac: result,
      ngayTraKetQua: '2026-09-29',
    });
    expect(payload.status).toBeUndefined();
    expect(payload.metadata).toBeUndefined();

    await expect(page.getByTestId('modal-ket-qua-uy-thac')).toHaveCount(0);
    await expect(page.getByText(result, { exact: true })).toBeVisible();

    const detail = await request.get(`${apiBase}/cases/${target.id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(detail.ok(), await detail.text()).toBe(true);
    const detailBody = await detail.json() as {
      data: { ketQuaUyThac: string; ngayTraKetQua: string };
    };
    expect(detailBody.data.ketQuaUyThac).toBe(result);
    expect(detailBody.data.ngayTraKetQua.slice(0, 10)).toBe('2026-09-29');

    const list = await request.get(`${apiBase}/cases`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: {
        caseType: 'UY_THAC_DIEU_TRA',
        tk: `donViGiao~UL-fixture-${suffix}`,
        trangThaiPhanHoi: 'DA_PHAN_HOI',
        limit: 50,
      },
    });
    expect(list.ok(), await list.text()).toBe(true);
    const listBody = await list.json() as {
      data: Array<{ id: string; trangThaiPhanHoi: string }>;
    };
    expect(listBody.data).toContainEqual(
      expect.objectContaining({ id: target.id, trangThaiPhanHoi: 'DA_PHAN_HOI' }),
    );
  });
});

readonlyTest('U-L08: read-only data scope keeps the row view-only while role-level create remains available', async ({ page }) => {
  const row = {
    id: 'readonly-utdt-row',
    name: 'Readonly delegation',
    caseCode: 'READONLY-UTDT-001',
    caseType: 'UY_THAC_DIEU_TRA',
    status: 'TIEP_NHAN',
    donViGiao: 'Readonly unit',
    createdAt: new Date().toISOString(),
    quyenGhi: false,
  };
  await page.route('**/api/v1/cases?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [row], total: 1 }),
  }));
  await page.route('**/api/v1/cases/utdt-stats?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ total: 1, byTrangThai: { DA_PHAN_HOI: 0, KHONG_THUC_HIEN_DUOC: 0, QUA_HAN: 0, CHUA_PHAN_HOI: 1 } }),
  }));
  await page.goto('/uy-thac-dieu-tra');
  await expect(page.getByText('READONLY-UTDT-001')).toBeVisible();
  await expect(page.getByTitle('Xem chi tiết')).toBeVisible();
  await expect(page.getByTitle('Sửa ủy thác')).toHaveCount(0);
  await expect(page.getByTitle('Xóa ủy thác')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Nhập ủy thác/ })).toBeVisible();
});
