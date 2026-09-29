import { test, expect } from '../e2e/support/isolated-session';

test('U-F08: direct source opens identity fields, preserves them across source changes and reload', async ({ page, request, authToken }) => {
  test.setTimeout(120_000);
  const suffix = Date.now();
  const headers = { Authorization: `Bearer ${authToken}` };
  page.on('dialog', async dialog => { await dialog.accept(); });

  const openInfo = async () => {
    await page.getByTestId('tab-list').getByTestId('tab-info').click();
    const details = page.getByTestId('bo-sung-he-moi-info');
    if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
  };
  const chooseSource = async (name: string) => {
    await page.getByTestId('field-nguonDon-trigger').click();
    const search = page.getByTestId('field-nguonDon-search');
    await search.fill(name);
    const option = page.getByTestId('field-nguonDon-dropdown').getByRole('option', { name, exact: true });
    await expect(option).toBeVisible();
    await option.click();
    await expect(page.getByTestId('field-nguonDon-trigger')).toContainText(name);
  };

  await page.goto('/uy-thac-dieu-tra/new');
  await page.getByTestId('input-case-title').fill(`UAT direct identity ${suffix}`);
  await page.getByTestId('tab-list').getByTestId('tab-uy-thac').click();
  await page.getByRole('textbox', { name: /giao/i }).first().fill(`Handing unit ${suffix}`);
  await openInfo();

  const identityGroup = page.getByTestId('nhom-dinh-danh-nguyen-don');
  await expect(identityGroup).toBeVisible();
  await expect(page.getByTestId('nhom-dinh-danh-nguyen-don-nut')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('field-sdtCungCap')).toBeVisible();
  await expect(page.getByTestId('field-cccdCungCap')).toHaveCount(0);

  await chooseSource('Trực tiếp');
  await expect(page.getByTestId('nhom-dinh-danh-nguyen-don-nut')).toHaveAttribute('aria-expanded', 'true');
  const identity = {
    sinhNamCungCap: '1986',
    cccdCungCap: `079086${String(suffix).slice(-6)}`,
    ngayCapCccd: '2020-05-17',
    noiCapCccd: `Cục CSQLHC ${suffix}`,
  };
  for (const [field, value] of Object.entries(identity)) {
    await page.getByTestId(`field-${field}`).fill(value);
  }

  await chooseSource('Bưu điện');
  await expect(page.getByTestId('nhom-dinh-danh-nguyen-don-nut')).toHaveAttribute('aria-expanded', 'true');
  for (const [field, value] of Object.entries(identity)) {
    await expect(page.getByTestId(`field-${field}`)).toHaveValue(value);
  }
  await expect(page.getByTestId('field-sdtCungCap')).toBeVisible();

  await page.getByTestId('btn-save').click();
  await expect(page.getByTestId('pre-save-summary-modal')).toBeVisible();
  const createResponse = page.waitForResponse(response =>
    response.url().endsWith('/api/v1/cases') && response.request().method() === 'POST');
  await page.getByTestId('pre-save-confirm-btn').click();
  const created = await createResponse;
  expect(created.ok(), `direct identity create API: ${created.status()} ${await created.text()}`).toBe(true);
  const id = ((await created.json()) as { data?: { id?: string } }).data?.id;
  expect(id).toBeTruthy();

  const apiResponse = await request.get(`http://localhost:3000/api/v1/cases/${id}`, { headers });
  expect(apiResponse.ok()).toBe(true);
  const apiRecord = (await apiResponse.json()) as { data?: Record<string, unknown> };
  expect(apiRecord.data?.nguonDon).toBe('Bưu điện');
  for (const [field, value] of Object.entries(identity)) {
    const stored = apiRecord.data?.[field];
    expect(field === 'ngayCapCccd' && typeof stored === 'string' ? stored.slice(0, 10) : stored).toBe(value);
  }

  await page.goto(`/uy-thac-dieu-tra/${id}/edit`);
  await openInfo();
  await expect(page.getByTestId('field-nguonDon-trigger')).toContainText('Bưu điện');
  await expect(page.getByTestId('nhom-dinh-danh-nguyen-don-nut')).toHaveAttribute('aria-expanded', 'true');
  for (const [field, value] of Object.entries(identity)) {
    await expect(page.getByTestId(`field-${field}`)).toHaveValue(value);
  }
});

test('U-F03fk/U-F04fk: directory and geography selections survive create and update', async ({ page, request, authToken }) => {
  test.setTimeout(120_000);
  const suffix = Date.now();
  const headers = { Authorization: `Bearer ${authToken}` };
  page.on('dialog', async dialog => { await dialog.accept(); });

  const openInfo = async () => {
    await page.getByTestId('tab-list').getByTestId('tab-info').click();
    const details = page.getByTestId('bo-sung-he-moi-info');
    if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
  };
  const choose = async (id: string, index: number) => {
    await page.getByTestId(`${id}-trigger`).click();
    const option = page.getByTestId(`${id}-dropdown`).getByRole('option').nth(index);
    await expect(option).toBeVisible();
    const label = (await option.innerText()).trim();
    await option.click();
    await expect(page.getByTestId(`${id}-trigger`)).toContainText(label);
    return label;
  };

  await page.goto('/uy-thac-dieu-tra/new');
  await page.getByTestId('input-case-title').fill(`UAT FK geography ${suffix}`);
  await page.getByTestId('tab-list').getByTestId('tab-uy-thac').click();
  await page.getByRole('textbox', { name: /giao/i }).first().fill(`Handing unit ${suffix}`);
  await openInfo();
  const createdValues = new Map<string, string>();
  for (const id of ['fk-handler', 'case-address-province', 'case-address-ward', 'fk-prosecution-assigned']) {
    createdValues.set(id, await choose(id, 0));
  }

  await page.getByTestId('btn-save').click();
  await expect(page.getByTestId('pre-save-summary-modal')).toBeVisible();
  const createResponse = page.waitForResponse(response =>
    response.url().endsWith('/api/v1/cases') && response.request().method() === 'POST');
  await page.getByTestId('pre-save-confirm-btn').click();
  const created = await createResponse;
  expect(created.ok(), `FK create API: ${created.status()} ${await created.text()}`).toBe(true);
  const id = ((await created.json()) as { data?: { id?: string } }).data?.id;
  expect(id).toBeTruthy();
  const firstLoad = await request.get(`http://localhost:3000/api/v1/cases/${id}`, { headers });
  expect(firstLoad.ok()).toBe(true);
  const firstRecord = (await firstLoad.json()) as { data?: { investigatorId?: string; metadata?: Record<string, unknown> } };
  expect(firstRecord.data?.investigatorId).toBeTruthy();
  expect(firstRecord.data?.metadata?.ward).toBe(createdValues.get('case-address-ward'));
  expect(firstRecord.data?.metadata?.prosecutionOfficeAssigned).toBe(createdValues.get('fk-prosecution-assigned'));
  expect(firstRecord.data?.metadata?.province).toBeTruthy();

  await page.goto(`/uy-thac-dieu-tra/${id}/edit`);
  await openInfo();
  for (const [key, value] of createdValues) {
    await expect(page.getByTestId(`${key}-trigger`)).toContainText(value);
  }

  const changedValues = new Map<string, string>();
  changedValues.set('case-address-province', await choose('case-address-province', 1));
  await expect(page.getByTestId('case-address-ward-trigger')).not.toContainText(createdValues.get('case-address-ward') ?? '');
  changedValues.set('fk-handler', await choose('fk-handler', 1));
  changedValues.set('fk-prosecution-assigned', await choose('fk-prosecution-assigned', 1));
  const updateResponse = page.waitForResponse(response =>
    response.url().endsWith(`/api/v1/cases/${id}`) && response.request().method() === 'PUT');
  await page.getByTestId('btn-save').click();
  const updated = await updateResponse;
  expect(updated.ok(), `FK update API: ${updated.status()} ${await updated.text()}`).toBe(true);
  const finalLoad = await request.get(`http://localhost:3000/api/v1/cases/${id}`, { headers });
  expect(finalLoad.ok()).toBe(true);
  const finalRecord = (await finalLoad.json()) as { data?: { investigatorId?: string; metadata?: Record<string, unknown> } };
  expect(finalRecord.data?.investigatorId).toBeTruthy();
  expect(finalRecord.data?.investigatorId).not.toBe(firstRecord.data?.investigatorId);
  expect(finalRecord.data?.metadata?.province).toBeTruthy();
  expect(finalRecord.data?.metadata?.province).not.toBe(firstRecord.data?.metadata?.province);
  expect(finalRecord.data?.metadata?.ward).toBe('');
  expect(finalRecord.data?.metadata?.prosecutionOfficeAssigned).toBe(changedValues.get('fk-prosecution-assigned'));
  await page.goto(`/uy-thac-dieu-tra/${id}/edit`);
  await openInfo();
  for (const [key, value] of changedValues) {
    await expect(page.getByTestId(`${key}-trigger`)).toContainText(value);
  }
  await expect(page.getByTestId('case-address-ward-trigger')).not.toContainText(createdValues.get('case-address-ward') ?? '');
});

test('U-F02type/U-F03type/U-F04type: delegation type loads from existing data and survives create and update', async ({ page, request, authToken }) => {
  const suffix = Date.now();
  const headers = { Authorization: `Bearer ${authToken}` };
  page.on('dialog', async dialog => { await dialog.accept(); });
  const openType = async () => {
    await page.getByTestId('tab-list').getByTestId('tab-uy-thac').click();
    return page.getByRole('combobox', { name: 'Loại ủy thác' });
  };
  await page.goto('/uy-thac-dieu-tra/new');
  await page.getByTestId('input-case-title').fill(`UAT delegation type ${suffix}`);
  let type = await openType();
  const choices = await type.locator('option:not([value=""])').evaluateAll(options =>
    options.map(option => (option as HTMLOptionElement).value));
  expect(choices.length).toBeGreaterThan(1);
  await type.selectOption(choices[0]);
  await page.getByRole('textbox', { name: /giao/i }).first().fill(`Handing unit ${suffix}`);
  await page.getByTestId('btn-save').click();
  await expect(page.getByTestId('pre-save-summary-modal')).toBeVisible();
  const createResponse = page.waitForResponse(response =>
    response.url().endsWith('/api/v1/cases') && response.request().method() === 'POST');
  await page.getByTestId('pre-save-confirm-btn').click();
  const created = await createResponse;
  expect(created.ok(), `delegation type create API: ${created.status()} ${await created.text()}`).toBe(true);
  const id = ((await created.json()) as { data?: { id?: string } }).data?.id;
  expect(id).toBeTruthy();
  const read = async () => {
    const response = await request.get(`http://localhost:3000/api/v1/cases/${id}`, { headers });
    expect(response.ok()).toBe(true);
    return ((await response.json()) as { data?: { loaiUyThac?: string } }).data?.loaiUyThac;
  };
  expect(await read()).toBe(choices[0]);
  await page.goto(`/uy-thac-dieu-tra/${id}/edit`);
  type = await openType();
  await expect(type).toHaveValue(choices[0]);
  await type.selectOption(choices[1]);
  const updateResponse = page.waitForResponse(response =>
    response.url().endsWith(`/api/v1/cases/${id}`) && response.request().method() === 'PUT');
  await page.getByTestId('btn-save').click();
  const updated = await updateResponse;
  expect(updated.ok(), `delegation type update API: ${updated.status()} ${await updated.text()}`).toBe(true);
  expect(await read()).toBe(choices[1]);
  await page.goto(`/uy-thac-dieu-tra/${id}/edit`);
  await expect(await openType()).toHaveValue(choices[1]);
});
