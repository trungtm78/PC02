import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '../e2e/support/isolated-session';

const apiBase = 'http://localhost:3000/api/v1';

type CreatedCase = { data?: { id?: string; caseCode?: string } };
type Candidate = {
  id: string;
  name: string;
  caseCode?: string;
  confidence: 'HIGH' | 'MEDIUM';
  reasons: string[];
};

async function createDelegation(
  request: APIRequestContext,
  token: string,
  name: string,
  suffix: string,
  acknowledgedDuplicateIds: string[] = [],
  decisionNumber?: string,
) {
  const response = await request.post(`${apiBase}/cases`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name,
      caseType: 'UY_THAC_DIEU_TRA',
      caseProvenance: 'UY_THAC_DIEU_TRA',
      donViGiao: `Review fixture unit ${suffix}`,
      acknowledgedDuplicateIds,
      ...(decisionNumber ? { soQuyetDinhUyThac: decisionNumber } : {}),
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = await response.json() as CreatedCase;
  expect(body.data?.id).toBeTruthy();
  return { id: body.data!.id!, caseCode: body.data?.caseCode ?? '' };
}

test('U-F10/U-F11: suggestions stay in delegation type and exact decision duplicates show reasons and acknowledgement', async ({ page, request, authToken }) => {
  test.setTimeout(120_000);
  const suffix = String(Date.now());
  const suggestedName = `UAT delegation suggestion ${suffix}`;
  const regularName = `${suggestedName} regular only`;
  const decisionNumber = `58-REVIEW-${suffix}`;
  const exactDecision = await createDelegation(request, authToken, suggestedName, suffix, [], decisionNumber);
  const regular = await request.post(`${apiBase}/cases`, {
    headers: { Authorization: `Bearer ${authToken}` },
    data: {
      name: regularName,
      caseType: 'REGULAR',
      caseProvenance: 'DIRECT_DISCOVERY',
    },
  });
  expect(regular.status(), await regular.text()).toBe(201);

  const suggestions = await request.get(`${apiBase}/cases/name-suggestions`, {
    headers: { Authorization: `Bearer ${authToken}` },
    params: { q: `suggestion ${suffix}`, caseType: 'UY_THAC_DIEU_TRA' },
  });
  expect(suggestions.ok(), await suggestions.text()).toBe(true);
  const suggestionRows = await suggestions.json() as { name: string; count: number }[];
  expect(suggestionRows).toEqual(expect.arrayContaining([expect.objectContaining({ name: suggestedName, count: 1 })]));
  expect(suggestionRows.some(row => row.name === regularName)).toBe(false);

  await page.goto('/uy-thac-dieu-tra/new');
  const title = page.getByTestId('input-case-title');
  await title.fill(`suggestion ${suffix}`);
  const suggestionBox = page.getByTestId('input-case-title-goi-y');
  await expect(suggestionBox).toBeVisible();
  await expect(suggestionBox.getByText(suggestedName, { exact: true })).toBeVisible();
  await expect(suggestionBox.getByText(regularName, { exact: true })).toHaveCount(0);

  await title.fill(`Different title ${suffix}`);
  await page.getByTestId('tab-list').getByTestId('tab-uy-thac').click();
  await page.getByRole('textbox', { name: /giao/i }).first().fill(`Review UI unit ${suffix}`);
  await page.getByRole('textbox', { name: /58/ }).fill(decisionNumber);
  await page.getByRole('button', { name: 'Rà soát trùng' }).click();
  const review = page.getByRole('region', { name: 'Rà soát hồ sơ có thể trùng' });
  await expect(review.getByText(exactDecision.caseCode, { exact: true })).toBeVisible();
  await expect(review.getByText(suggestedName, { exact: true })).toBeVisible();
  await expect(review.getByText('Trùng số quyết định', { exact: true })).toBeVisible();
  await expect(review.getByText('Khả năng trùng cao', { exact: true })).toBeVisible();
  await review.getByRole('button', { name: 'Đã rà soát các hồ sơ trùng' }).click();
  await expect(review.getByText('Đã xác nhận rà soát.', { exact: true })).toBeVisible();
});

test('U-F12: more than twenty exact matches, a new candidate at save time, and acknowledgement audit', async ({ page, request, authToken }) => {
  test.setTimeout(240_000);
  const suffix = String(Date.now());
  const sharedName = `UAT twenty-two duplicates ${suffix}`;
  const knownIds: string[] = [];
  for (let index = 0; index < 21; index += 1) {
    const created = await createDelegation(request, authToken, sharedName, `${suffix}-${index}`, knownIds);
    knownIds.push(created.id);
  }

  const reviewBeforeRace = await request.get(`${apiBase}/cases/duplicate-review`, {
    headers: { Authorization: `Bearer ${authToken}` },
    params: { name: sharedName, caseType: 'UY_THAC_DIEU_TRA' },
  });
  expect(reviewBeforeRace.ok(), await reviewBeforeRace.text()).toBe(true);
  const initialCandidates = await reviewBeforeRace.json() as Candidate[];
  expect(initialCandidates).toHaveLength(21);
  expect(initialCandidates.every(candidate => candidate.confidence === 'HIGH')).toBe(true);

  const lateCandidate = await createDelegation(request, authToken, sharedName, `${suffix}-late`, initialCandidates.map(row => row.id));
  const staleAcknowledgement = await request.post(`${apiBase}/cases`, {
    headers: { Authorization: `Bearer ${authToken}` },
    data: {
      name: sharedName,
      caseType: 'UY_THAC_DIEU_TRA',
      caseProvenance: 'UY_THAC_DIEU_TRA',
      donViGiao: `Stale acknowledgement ${suffix}`,
      acknowledgedDuplicateIds: initialCandidates.map(row => row.id),
    },
  });
  expect(staleAcknowledgement.status()).toBe(409);
  const staleBody = await staleAcknowledgement.json() as { code?: string; candidateIds?: string[] };
  expect(staleBody.code).toBe('DUPLICATE_REVIEW_REQUIRED');
  expect(staleBody.candidateIds).toContain(lateCandidate.id);

  await page.goto('/uy-thac-dieu-tra/new');
  await page.getByTestId('input-case-title').fill(sharedName);
  await page.getByTestId('tab-list').getByTestId('tab-uy-thac').click();
  await page.getByRole('textbox', { name: /giao/i }).first().fill(`Browser acknowledgement ${suffix}`);
  await page.getByRole('button', { name: 'Rà soát trùng' }).click();
  const review = page.getByRole('region', { name: 'Rà soát hồ sơ có thể trùng' });
  await expect(review.getByText(sharedName, { exact: true })).toHaveCount(22);
  await review.getByRole('button', { name: 'Đã rà soát các hồ sơ trùng' }).click();

  await page.getByTestId('btn-save').click();
  await expect(page.getByTestId('pre-save-summary-modal')).toBeVisible();
  const createResponse = page.waitForResponse(response =>
    response.url().endsWith('/api/v1/cases') && response.request().method() === 'POST');
  await page.getByTestId('pre-save-confirm-btn').click();
  const saved = await createResponse;
  expect(saved.status(), await saved.text()).toBe(201);
  const savedId = ((await saved.json()) as CreatedCase).data?.id;
  expect(savedId).toBeTruthy();

  const auditResponse = await request.get(`${apiBase}/audit-logs`, {
    headers: { Authorization: `Bearer ${authToken}` },
    params: { action: 'CASE_CREATED', subject: 'Case', subjectId: savedId, limit: 10 },
  });
  expect(auditResponse.ok(), await auditResponse.text()).toBe(true);
  const audit = await auditResponse.json() as { data?: { metadata?: { duplicateAcknowledgedIds?: string[] } }[] };
  expect(audit.data?.[0]?.metadata?.duplicateAcknowledgedIds).toHaveLength(22);
});
