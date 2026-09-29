import { test, expect } from '../e2e/support/isolated-session';

test('U-F03children/U-F04children: subject and evidence rows persist on create and subsequent update', async ({ page, request, authToken }) => {
  test.setTimeout(120_000);
  const suffix = Date.now();
  const headers = { Authorization: `Bearer ${authToken}` };
  page.on('dialog', async dialog => { await dialog.accept(); });

  const addSubject = async (name: string, idNumber: string) => {
    await page.getByTestId('tab-list').getByTestId('tab-subjects').click();
    const details = page.getByTestId('bo-sung-he-moi-subjects');
    if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
    await page.getByTestId('btn-add-subject').click();
    const modal = page.getByTestId('modal-container');
    await expect(modal).toBeVisible();
    await modal.getByTestId('input-subject-name').fill(name);
    await modal.getByTestId('input-subject-id').fill(idNumber);
    await modal.locator('input[type="date"]').fill('1989-04-12');
    await modal.getByTestId('modal-save-btn').click();
    await expect(modal).toBeHidden();
    await expect(page.getByTestId('tab-subjects-bo-sung')).toContainText(name);
  };
  const addEvidence = async (code: string, name: string) => {
    await page.getByTestId('tab-list').getByTestId('tab-evidence').click();
    const details = page.getByTestId('bo-sung-he-moi-evidence');
    if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
    await page.getByTestId('btn-add-evidence').click();
    const modal = page.getByTestId('modal-container');
    await expect(modal).toBeVisible();
    await modal.getByTestId('input-evidence-code').fill(code);
    await modal.getByTestId('input-evidence-name').fill(name);
    await modal.getByTestId('modal-save-btn').click();
    await expect(modal).toBeHidden();
    await expect(page.getByTestId('tab-evidence-bo-sung')).toContainText(name);
  };
  const verifyRows = async (id: string, expectedSubjectNames: string[], expectedEvidenceNames: string[]) => {
    const [subjectsResponse, evidencesResponse] = await Promise.all([
      request.get(`http://localhost:3000/api/v1/cases/${id}/subjects`, { headers }),
      request.get(`http://localhost:3000/api/v1/cases/${id}/evidences`, { headers }),
    ]);
    expect(subjectsResponse.ok()).toBe(true);
    expect(evidencesResponse.ok()).toBe(true);
    const subjects = (await subjectsResponse.json()) as { data?: { fullName: string; idNumber: string }[] };
    const evidences = (await evidencesResponse.json()) as { data?: { name: string; code: string }[] };
    for (const name of expectedSubjectNames) expect(subjects.data?.some(row => row.fullName === name)).toBe(true);
    for (const name of expectedEvidenceNames) expect(evidences.data?.some(row => row.name === name)).toBe(true);
  };

  await page.goto('/uy-thac-dieu-tra/new');
  await page.getByTestId('input-case-title').fill(`UAT children ${suffix}`);
  await page.getByTestId('tab-list').getByTestId('tab-uy-thac').click();
  await page.getByRole('textbox', { name: /giao/i }).first().fill(`Handing unit ${suffix}`);
  const firstSubject = `Subject ${suffix}`;
  const firstEvidence = `Evidence ${suffix}`;
  await addSubject(firstSubject, `079089${String(suffix).slice(-6)}`);
  await addEvidence(`VC-${suffix}`, firstEvidence);

  await page.getByTestId('btn-save').click();
  await expect(page.getByTestId('pre-save-summary-modal')).toBeVisible();
  const createResponse = page.waitForResponse(response =>
    response.url().endsWith('/api/v1/cases') && response.request().method() === 'POST');
  await page.getByTestId('pre-save-confirm-btn').click();
  const created = await createResponse;
  expect(created.ok(), `child create API: ${created.status()} ${await created.text()}`).toBe(true);
  const id = ((await created.json()) as { data?: { id?: string } }).data?.id;
  expect(id).toBeTruthy();
  await verifyRows(id!, [firstSubject], [firstEvidence]);

  await page.goto(`/uy-thac-dieu-tra/${id}/edit`);
  await page.getByTestId('tab-list').getByTestId('tab-subjects').click();
  await page.getByTestId('bo-sung-he-moi-subjects').locator(':scope > summary').click();
  await expect(page.getByTestId('tab-subjects-bo-sung')).toContainText(firstSubject);
  await page.getByTestId('tab-list').getByTestId('tab-evidence').click();
  await page.getByTestId('bo-sung-he-moi-evidence').locator(':scope > summary').click();
  await expect(page.getByTestId('tab-evidence-bo-sung')).toContainText(firstEvidence);
  const nextSubject = `Additional subject ${suffix}`;
  const nextEvidence = `Additional evidence ${suffix}`;
  await addSubject(nextSubject, `079090${String(suffix).slice(-6)}`);
  await addEvidence(`VC-ADDED-${suffix}`, nextEvidence);
  const updateResponse = page.waitForResponse(response =>
    response.url().endsWith(`/api/v1/cases/${id}`) && response.request().method() === 'PUT');
  await page.getByTestId('btn-save').click();
  const updated = await updateResponse;
  expect(updated.ok(), `child update API: ${updated.status()} ${await updated.text()}`).toBe(true);
  await verifyRows(id!, [firstSubject, nextSubject], [firstEvidence, nextEvidence]);
  await page.goto(`/uy-thac-dieu-tra/${id}/edit`);
  await page.getByTestId('tab-list').getByTestId('tab-subjects').click();
  await page.getByTestId('bo-sung-he-moi-subjects').locator(':scope > summary').click();
  await expect(page.getByTestId('tab-subjects-bo-sung')).toContainText(firstSubject);
  await expect(page.getByTestId('tab-subjects-bo-sung')).toContainText(nextSubject);
  await page.getByTestId('tab-list').getByTestId('tab-evidence').click();
  await page.getByTestId('bo-sung-he-moi-evidence').locator(':scope > summary').click();
  await expect(page.getByTestId('tab-evidence-bo-sung')).toContainText(firstEvidence);
  await expect(page.getByTestId('tab-evidence-bo-sung')).toContainText(nextEvidence);
});
