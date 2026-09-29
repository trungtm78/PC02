import { test, expect } from '../e2e/support/isolated-session';

test('U-F13: delegation drafts are isolated and a delayed number preview never overwrites typed data', async ({ page }) => {
  test.setTimeout(120_000);
  const suffix = String(Date.now());
  const delegationTitle = `UAT delayed delegation draft ${suffix}`;
  const regularTitle = `UAT separate regular draft ${suffix}`;
  let intercepted = false;
  let releaseDraft!: () => void;
  const draftGate = new Promise<void>(resolve => { releaseDraft = resolve; });
  await page.route('**/api/v1/document-numbers/draft', async route => {
    intercepted = true;
    await draftGate;
    await route.continue();
  });

  await page.goto('/uy-thac-dieu-tra/new');
  await expect.poll(() => intercepted).toBe(true);
  await page.getByTestId('input-case-title').fill(delegationTitle);
  await page.getByTestId('btn-save-draft').click();
  const storedDelegation = await page.evaluate(() => localStorage.getItem('caseFormDraft:delegation'));
  expect(storedDelegation).toContain(delegationTitle);
  releaseDraft();
  await expect(page.getByTestId('docnum-preview-value')).toHaveText(/^\d{4}-\d+$/);
  await expect(page.getByTestId('input-case-title')).toHaveValue(delegationTitle);

  await page.unroute('**/api/v1/document-numbers/draft');
  await page.goto('/cases/new?caseProvenance=DIRECT_DISCOVERY');
  await expect(page.getByTestId('input-case-title')).toHaveValue('');
  await page.getByTestId('input-case-title').fill(regularTitle);
  await page.getByTestId('btn-save-draft').click();
  const draftKeys = await page.evaluate(() => ({
    delegation: localStorage.getItem('caseFormDraft:delegation'),
    regular: localStorage.getItem('caseFormDraft:regular'),
  }));
  expect(draftKeys.delegation).toContain(delegationTitle);
  expect(draftKeys.regular).toContain(regularTitle);

  await page.goto('/uy-thac-dieu-tra/new');
  await expect(page.getByTestId('input-case-title')).toHaveValue(delegationTitle);
  await expect(page.getByText(/Bản nháp được tìm thấy từ lần trước/)).toBeVisible();
});

test('U-F14: partial real-file failure retries only the failed file and never creates a second delegation', async ({ page, request, authToken }) => {
  test.setTimeout(180_000);
  const suffix = String(Date.now());
  let caseCreates = 0;
  let documentUploads = 0;
  let injectedFailure = false;
  page.on('request', req => {
    if (req.method() === 'POST' && req.url().endsWith('/api/v1/cases')) caseCreates += 1;
  });
  await page.route('**/api/v1/documents', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    documentUploads += 1;
    if (!injectedFailure) {
      injectedFailure = true;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Injected retryable failure' }) });
      return;
    }
    await route.continue();
  });

  await page.goto('/uy-thac-dieu-tra/new');
  await page.getByTestId('input-case-title').fill(`UAT upload retry ${suffix}`);
  await page.getByTestId('tab-list').getByTestId('tab-uy-thac').click();
  await page.getByRole('textbox', { name: /giao/i }).first().fill(`Upload unit ${suffix}`);
  await page.getByTestId('tab-list').getByTestId('tab-business-files').click();
  await page.getByTestId('stage-file-input').setInputFiles([
    { name: `first-${suffix}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`first-${suffix}`) },
    { name: `second-${suffix}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`second-${suffix}`) },
  ]);

  await page.getByTestId('btn-save').click();
  await expect(page.getByTestId('pre-save-summary-modal')).toBeVisible();
  const createdResponse = page.waitForResponse(response =>
    response.url().endsWith('/api/v1/cases') && response.request().method() === 'POST');
  await page.getByTestId('pre-save-confirm-btn').click();
  const created = await createdResponse;
  expect(created.status(), await created.text()).toBe(201);
  const id = ((await created.json()) as { data?: { id?: string } }).data?.id;
  expect(id).toBeTruthy();
  await expect(page.getByTestId('stage-retry')).toBeVisible();
  expect(caseCreates).toBe(1);
  expect(documentUploads).toBe(2);

  await page.getByTestId('stage-retry').click();
  await expect(page.getByTestId('stage-retry')).toHaveCount(0);
  expect(caseCreates).toBe(1);
  expect(documentUploads).toBe(3);

  const documents = await request.get(`http://localhost:3000/api/v1/documents?caseId=${id}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  expect(documents.ok(), await documents.text()).toBe(true);
  const rows = (await documents.json()) as { data?: { originalName?: string }[] };
  expect(rows.data?.map(row => row.originalName).sort()).toEqual([
    `first-${suffix}.txt`,
    `second-${suffix}.txt`,
  ]);
});
