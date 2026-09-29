import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { petitionSearchCases } from '../petition-search-cases';

const fixture = JSON.parse(readFileSync('test-results/petition-local/runtime.json', 'utf8'));
let headers: Record<string, string>;

test.beforeAll(async ({ request }) => {
  const response = await request.post('/api/v1/auth/login', { data: { username: fixture.username, password: fixture.password } });
  expect(response.ok()).toBe(true);
  const body = await response.json();
  const data = body.data ?? body;
  expect(data.accessToken).toEqual(expect.any(String));
  headers = { Authorization: `Bearer ${data.accessToken}` };
});

for (const item of petitionSearchCases) {
  test(`global search: ${item.key}`, async ({ request }) => {
    const response = await request.get('/api/v1/petitions', { headers, params: { tk: `*~${item.query}` } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.map((record: { id: string }) => record.id)).toContain(fixture.id);
    expect(body.total).toBe(1);
    expect(body.data[0]).not.toHaveProperty('loaiThongTinBd');
  });
}

test('information-type chip, legacy search, month and year searches', async ({ request }) => {
  for (const params of [{ tk: 'loaiThongTin~to giac searchtype' }, { search: 'searchtype' }, { tk: '*~02/2030' }, { tk: '*~2020' }]) {
    const response = await request.get('/api/v1/petitions', { headers, params });
    expect(response.ok()).toBe(true);
    expect((await response.json()).total).toBe(1);
  }
});

test('statistics and no-match agree with the list', async ({ request }) => {
  const stats = await request.get('/api/v1/petitions/stats', { headers, params: { tk: '*~searchtype' } });
  expect(stats.ok()).toBe(true);
  expect(JSON.stringify(await stats.json())).toContain('"total":1');
  const response = await request.get('/api/v1/petitions', { headers, params: { tk: '*~no-match-unique', limit: 1, offset: 0 } });
  expect(response.ok()).toBe(true);
  expect((await response.json()).total).toBe(0);
  const unauthorized = await request.get('/api/v1/petitions', { params: { tk: '*~searchtype' } });
  expect(unauthorized.status()).toBe(401);
});

test('pagination preserves the matched set and intersects status filters', async ({ request }) => {
  const ids: string[] = [];
  for (const offset of [0, 1]) {
    const response = await request.get('/api/v1/petitions', { headers, params: { tk: '*~paginationprobe', limit: 1, offset } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(2);
    expect(body.data).toHaveLength(1);
    ids.push(body.data[0].id);
  }
  expect(new Set(ids).size).toBe(2);
  const response = await request.get('/api/v1/petitions', { headers, params: { tk: '*~paginationprobe', status: 'MOI_TIEP_NHAN' } });
  expect(response.status()).toBe(200);
  expect((await response.json()).total).toBe(0);
});

test('restricted users cannot find matching records outside their scope', async ({ request }) => {
  const login = await request.post('/api/v1/auth/login', { data: { username: fixture.officerUsername, password: fixture.password } });
  expect(login.status()).toBe(200);
  const body = await login.json();
  const scopedHeaders = { Authorization: `Bearer ${(body.data ?? body).accessToken}` };
  for (const endpoint of ['/api/v1/petitions', '/api/v1/petitions/stats']) {
    const response = await request.get(endpoint, { headers: scopedHeaders, params: { tk: '*~searchtype' } });
    expect(response.status()).toBe(200);
    expect((await response.json()).total).toBe(0);
  }
});

test('export contains the same searched petition as the list', async ({ request }) => {
  const response = await request.get('/api/v1/petitions/export', { headers, params: { tk: '*~searchtype' } });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('spreadsheetml');
  const { createRequire } = await import('node:module');
  const requireBackend = createRequire(`${process.cwd()}/backend/package.json`);
  const { Workbook } = requireBackend('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(await response.body());
  const values = workbook.worksheets.flatMap((sheet: { getSheetValues(): unknown[] }) => sheet.getSheetValues());
  expect(JSON.stringify(values)).toContain('Searchsender');
  expect(JSON.stringify(values)).not.toContain('Paginationprobe');
});
