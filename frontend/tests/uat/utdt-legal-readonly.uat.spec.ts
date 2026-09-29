import { test, expect } from '../e2e/support/isolated-session';

const apiBase = 'http://localhost:3000/api/v1';

test('U-F07/U-F15: delegation provenance is fixed, legal errors navigate, and read-only mode blocks editing', async ({ page, request, authToken }) => {
  test.setTimeout(120_000);
  const suffix = String(Date.now());
  const headers = { Authorization: `Bearer ${authToken}` };

  const missingGrantingUnit = await request.post(`${apiBase}/cases`, {
    headers,
    data: {
      name: `UAT missing granting unit ${suffix}`,
      caseType: 'UY_THAC_DIEU_TRA',
      caseProvenance: 'UY_THAC_DIEU_TRA',
    },
  });
  expect(missingGrantingUnit.status()).toBe(400);
  expect(await missingGrantingUnit.text()).toContain('Đơn vị giao');

  await page.goto('/uy-thac-dieu-tra/new');
  await expect(page.getByTestId('select-case-provenance')).toHaveValue('UY_THAC_DIEU_TRA');
  await expect(page.getByTestId('select-case-provenance')).toBeDisabled();
  await page.getByTestId('input-case-title').fill(`UAT legal navigation ${suffix}`);
  const infoDetails = page.getByTestId('bo-sung-he-moi-info');
  if (await infoDetails.getAttribute('open') === null) await infoDetails.locator(':scope > summary').click();
  await expect(page.getByTestId('fk-handler-trigger')).toBeVisible();
  await page.getByTestId('fk-handler-trigger').click();
  const handler = page.getByTestId('fk-handler-dropdown').getByRole('option').first();
  await expect(handler).toBeVisible();
  await handler.click();
  await page.getByTestId('btn-save').click();
  await expect(page.getByTestId('form-error-summary')).toContainText('Đơn vị giao ủy thác');
  await expect(page.getByTestId('tab-uy-thac')).toHaveAttribute('aria-selected', 'true');
  const grantingUnit = page.getByTestId('field-utdt_donViGiao');
  await expect(grantingUnit).toBeFocused();
  await expect(grantingUnit).toHaveAttribute('aria-required', 'true');
  await expect(grantingUnit).toHaveAttribute('aria-invalid', 'true');

  const created = await request.post(`${apiBase}/cases`, {
    headers,
    data: {
      name: `UAT read-only delegation ${suffix}`,
      caseType: 'UY_THAC_DIEU_TRA',
      caseProvenance: 'UY_THAC_DIEU_TRA',
      donViGiao: `Read-only fixture unit ${suffix}`,
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const id = ((await created.json()) as { data?: { id?: string } }).data?.id;
  expect(id).toBeTruthy();
  const storedResponse = await request.get(`${apiBase}/cases/${id}`, { headers });
  expect(storedResponse.ok()).toBe(true);
  const stored = (await storedResponse.json()) as { data?: Record<string, unknown> };
  expect(stored.data).toMatchObject({
    caseType: 'UY_THAC_DIEU_TRA',
    caseProvenance: 'UY_THAC_DIEU_TRA',
    linkedPetitionId: null,
    linkedIncidentId: null,
  });

  await page.route(`**/api/v1/cases/${id}`, async route => {
    const response = await route.fetch();
    const body = await response.json() as { data?: Record<string, unknown> };
    if (body.data) body.data.quyenGhi = false;
    await route.fulfill({ response, json: body });
  });
  await page.goto(`/uy-thac-dieu-tra/${id}/edit`);
  await expect(page.getByTestId('bang-chi-xem')).toBeVisible();
  await expect(page.getByTestId('btn-save')).toHaveCount(0);
  await expect(page.getByTestId('btn-save-draft')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rà soát trùng' })).toHaveCount(0);
  await expect(page.getByTestId('input-case-title')).toBeDisabled();
});
