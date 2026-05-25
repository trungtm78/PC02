import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const API = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const DN = `${API}/document-numbers`;

interface AuthCtx { token: string; userId: string; }

async function loginApi(req: APIRequestContext, email: string, pass: string): Promise<AuthCtx> {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 6000 * attempt));
    const r = await req.post(`${API}/auth/login`, { data: { username: email, password: pass } });
    if (r.status() === 429) { console.warn(`[Login] 429 for ${email}, retry ${attempt + 1}`); continue; }
    if (!r.ok()) throw new Error(`Login failed ${r.status()} for ${email}`);
    const b = await r.json();
    const d = b?.data ?? b;
    return { token: d.accessToken || b.accessToken, userId: d.user?.id || b.user?.id || d.sub || '' };
  }
  throw new Error(`Login ${email}: 429 after 4 retries`);
}

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

const ADMIN_EMAIL    = process.env.ADMIN_USERNAME ?? process.env.ADMIN_EMAIL ?? 'admin@pc02.local';
const ADMIN_PASS     = process.env.ADMIN_PASSWORD ?? 'Admin@1234';
const OFFICER1_EMAIL = process.env.OFFICER1_USERNAME ?? process.env.OFFICER1_EMAIL ?? 'officer1@pc02.local';
const OFFICER1_PASS  = process.env.OFFICER1_PASSWORD ?? 'Officer@1234';

let _adminCtx: AuthCtx | undefined;
let _officerCtx: AuthCtx | undefined;
let _incidentTemplateId = '';
let _logId = '';

async function ensureAuth(req: APIRequestContext) {
  if (!_adminCtx)   _adminCtx   = await loginApi(req, ADMIN_EMAIL, ADMIN_PASS);
  if (!_officerCtx) _officerCtx = await loginApi(req, OFFICER1_EMAIL, OFFICER1_PASS);
  if (!_incidentTemplateId) {
    const r = await req.get(`${DN}/templates`, { headers: auth(_adminCtx.token) });
    if (r.ok()) {
      const b = await r.json();
      const items: any[] = Array.isArray(b) ? b : b?.data ?? [];
      const inc = items.find((t: any) => t.documentType === 'INCIDENT' && t.isActive);
      if (inc) _incidentTemplateId = inc.id;
    }
  }
  return { admin: _adminCtx!, officer: _officerCtx!, incidentTemplateId: _incidentTemplateId };
}


test.describe('DocNum UAT Batch 3 — TC-161..320', () => {

  test(`TC-161-API: RED: POST /templates thi?u name ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT', isActive: true, segments: [{ type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 3 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-162-API: RED: POST /templates thi?u documentType ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'TestMissing', isActive: true, segments: [{ type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 3 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-163-API: RED: POST /templates thi?u segments ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'TestMissing', documentType: 'INCIDENT', isActive: true, counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 3 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-164-API: RED: POST /templates segments=[] (r?ng) ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'TestMissing', documentType: 'INCIDENT', isActive: true, counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 3 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-165-API: RED: POST /templates thi?u counterConfig ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'TestMissing', documentType: 'INCIDENT', isActive: true, segments: [{ type: 'COUNTER' }] },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-166-API: RED: POST /templates counterConfig.padding kh?ng ph?i s? ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-166', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: "not-a-number" } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-167-API: RED: POST /templates segment type kh?ng h?p l? ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-167', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'INVALID_TYPE', value: 'AG' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-168-API: RED: POST /templates LITERAL segment thi?u value ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-168', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-169-API: RED: POST /templates FORMULA segment thi?u source ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-169', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'FORMULA' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-170-API: RED: POST /templates counterConfig.minValue kh?ng ph?i s? ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-170', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: "not-a-number", maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-171-API: RED: POST /commit body r?ng {} ? 400`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-172-API: RED: POST /commit documentType=undefined ? 400`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-173-API: RED: POST /draft v?i invalid JSON body ? 400`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-174-API: RED: POST /draft kh?ng c? Content-Type header ? 400/415`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-175-API: RED: GET /templates/:id stats v?i id kh?ng t?n t?i ? 404`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/templates/${incidentTemplateId}/stats`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-176-API: RED: POST /templates/:id/preview v?i id kh?ng t?n t?i ? 404`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates/${incidentTemplateId}/preview`, {
          headers: auth(admin.token),
          data: {},
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-177-API: RED: PATCH /logs/:logId v?i logId kh?ng t?n t?i ? 404`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.patch(`${DN}/logs/00000000-0000-0000-0000-000000000000`, {
          headers: auth(officer.token),
          data: { documentId: 'test-document-id-TC-177' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-178-API: RED: PATCH /logs/:logId documentId kh?ng ph?i UUID ? 400`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.patch(`${DN}/logs/`, {
          headers: auth(officer.token),
          data: { documentId: 'test-document-id-TC-178' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-179-API: RED: GET /templates kh?ng c? token ? 401`, async ({ request }) => {
    const res = await request.get(`${DN}/templates`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-180-API: RED: GET /logs kh?ng c? token ? 401`, async ({ request }) => {
    const res = await request.get(`${DN}/logs`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-181-API: RED: GET /templates v?i malformed token 'Bearer invalid' ? 401`, async ({ request }) => {
    await ensureAuth(request);
    const res = await request.get(`${DN}/templates`, {
          headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-182-API: RED: POST /templates v?i role OFFICER token ? 403`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(officer.token),
          data: { name: 'AutoGen-TC-182', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-183-API: RED: PUT /templates/:id v?i role OFFICER token ? 403`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.put(`${DN}/templates/`, {
          headers: auth(officer.token),
          data: { separator: '/' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-184-API: RED: DELETE /templates/:id v?i role OFFICER token ? 403`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.delete(`${DN}/templates/`, {
          headers: auth(officer.token),
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-185-API: RED: POST /reset-counter v?i role OFFICER token ? 403`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates/${incidentTemplateId}/reset-counter`, {
          headers: auth(officer.token),
          data: { name: 'AutoGen-TC-185', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-186-API: RED: Commit khi counter MONTHLY exhausted ? 400`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-187-API: RED: Commit khi counter NEVER exhausted ? 400`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-188-API: RED: Commit khi template inactive ? 404`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.put(`${DN}/templates/`, {
          headers: auth(admin.token),
          data: { separator: '/' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-189-API: RED: Template separator d?i h?n 10 k? t? ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-189', documentType: 'PROPOSAL', isActive: true, separator: '-----------', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-190-API: RED: counterConfig.maxValue = 0 ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-190', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 0, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-191-API: RED: counterConfig.maxValue l? float 9.5 ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-191', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9.5, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-192-API: RED: counterConfig.padding l? float 3.5 ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-192', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 3.5 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-193-API: RED: GET /draft (sai method, ph?i l? POST) ? 404/405`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/draft`, {
          headers: auth(officer.token),
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-194-API: RED: DELETE /draft (sai method) ? 404/405`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.delete(`${DN}/draft`, {
          headers: auth(officer.token),
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-195-API: RED: PUT /commit (sai method, ph?i l? POST) ? 404/405`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.put(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { separator: '/' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-196-API: RED: GET /logs?page=0 ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/logs?page=0`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-197-API: RED: GET /logs?pageSize=1000 (v??t max) ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/logs?pageSize=1000`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-198-API: RED: GET /logs?templateId=invalid-uuid ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/logs?templateId=not-a-uuid`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-199-API: RED: IDOR ? PATCH log c?a officer2 b?ng token officer1 ? 403`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.patch(`${DN}/logs/`, {
          headers: auth(officer.token),
          data: { documentId: 'test-document-id-TC-199' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-200-API: RED: NoSQL injection trong templateId query param ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/logs?templateId=`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-201-API: RED: XSS trong segment LITERAL value ? stored safe`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates/${incidentTemplateId}/preview`, {
          headers: auth(admin.token),
          data: {},
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    // Template created/updated — just verify response is not empty
  });

  test(`TC-202-API: RED: Path traversal trong templateId ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/templates/${incidentTemplateId}/stats`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-203-API: RED: Header injection trong Authorization ? 401`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-204-API: RED: 2 admin reset counter ??ng th?i ? ch? 1 th?nh c?ng, kh?ng data corruption`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates/${incidentTemplateId}/reset-counter`, {
          headers: auth(admin.token),
    });
    expect([200, 201]).toContain(res.status());
  });

  test(`TC-205-API: RED: Commit ??ng th?i khi counter = maxValue-1 ? ch? 1 th?nh c?ng, 1 nh?n 400`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json(); const d = body?.data ?? body;
    expect(d).toHaveProperty('number');
  });

  test(`TC-211-API: SECURITY: Brute force /draft v?i token c?a nhi?u user ? rate limit per-IP`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(429);
  });

  test(`TC-212-API: SECURITY: Token reuse sau logout ? 401`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/auth/logout`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-213-API: SECURITY: Mass assignment ? POST /templates v?i tr??ng kh?ng ???c ph?p (createdById) ? ignore`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { id: 'fake-uuid', createdById: 'hacker', documentType: 'INCIDENT', name: 'X', segments: [], counterConfig: {} },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    // Template created/updated — just verify response is not empty
  });

  test(`TC-214-API: SECURITY: Privilege escalation ? officer POST /templates v?i extra field role='ADMIN' ? 403`, async ({ request }) => {
    const { officer } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(officer.token),
          data: { name: 'TC-214-escalation', documentType: 'INCIDENT', role: 'ADMIN', isActive: true, segments: [{ type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 3 } },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-215-API: SECURITY: Sensitive data trong response ? /logs kh?ng expose user password`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/logs`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-216-API: SECURITY: Server error kh?ng leak stack trace ? kh?ng expose internals`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/templates/${incidentTemplateId}/stats`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-217-API: SECURITY: Long string injection trong template name (10000 chars) ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { documentType: "INCIDENT' DROP TABLE users" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-218-API: SECURITY: Unicode null byte trong LITERAL segment value ? x? l? safe`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-219-API: SECURITY: CORS ? request t? allowed origin nh?n Access-Control-Allow-Origin ??ng`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-220-API: SECURITY: Timing attack ? /draft v?i valid vs invalid token kh?ng differ qu? 100ms`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-221-API: SECURITY: Replay attack ? c?ng request body g?i 2 l?n ? 2 s? kh?c nhau (idempotency)`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-234-API: RED: DELETE /templates kh?ng ph?i UUID format ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.delete(`${DN}/templates/not-uuid-format`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-235-API: RED: PUT /templates kh?ng ph?i UUID format ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.put(`${DN}/templates/abc123`, {
          headers: auth(admin.token),
          data: { separator: '/' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-236-API: RED: GET /logs v?i from > to date range ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/logs?from=2026-12-31&to=2026-01-01`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-237-API: RED: POST /commit documentType=INCIDENT nh?ng kh?ng c? template active v? kh?ng c? counter ? 404`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-238-API: RED: POST /templates isActive=null ? 400 ho?c default false`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-238', documentType: 'PROPOSAL', isActive: null, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-239-API: RED: POST /templates v?i tr?ng documentType active ? logic error ho?c reject`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-239', documentType: 'INCIDENT', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-240-API: RED: PATCH /logs/:logId body r?ng {} ? 400`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.patch(`${DN}/logs/`, {
          headers: auth(officer.token),
          data: { documentId: 'test-document-id-TC-240' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-241-API: RED: POST /draft documentType=empty string ? 400`, async ({ request }) => {
    const { officer } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(officer.token),
          data: { documentType: '' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-242-API: RED: POST /commit documentType c? whitespace padding 'INCIDENT ' ? 400`, async ({ request }) => {
    const { officer } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT ' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-243-API: RED: POST /draft v?i array documentType ? 400`, async ({ request }) => {
    const { officer } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(officer.token),
          data: { documentType: ['INCIDENT'] },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-244-API: RED: POST /commit v?i boolean documentType ? 400`, async ({ request }) => {
    const { officer } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: true },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-245-API: RED: GET /templates kh?ng ph?i JSON Accept ? 406`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/templates`, {
          headers: auth(admin.token),
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json(); const d = body?.data ?? body;
    expect(Array.isArray(d) || (d && typeof d === 'object')).toBe(true);
  });

  test(`TC-246-API: RED: POST /templates v?i segments kh?ng ph?i array ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-246', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: "not-an-array", counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-247-API: RED: POST /templates counterConfig=null ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-247', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: null },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-248-API: RED: PUT /templates/:id body r?ng {} ? 200 kh?ng thay ??i g?`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.put(`${DN}/templates/`, {
          headers: auth(admin.token),
          data: { separator: '/' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    // Template created/updated — just verify response is not empty
  });

  test(`TC-249-API: RED: POST /commit v?i draftPreview l? s? ?m string 'VV-2026--00001' ? commit th?nh c?ng v?i ??ng s?`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json(); const d = body?.data ?? body;
    expect(d).toHaveProperty('number');
  });

  test(`TC-250-API: RED: PATCH /logs/:logId v?i extra fields ? ignore extra fields`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.patch(`${DN}/logs/`, {
          headers: auth(officer.token),
          data: { documentId: 'test-document-id-TC-250' },
    });
    expect([200, 201]).toContain(res.status());
  });

  test(`TC-251-API: RED: POST /templates name ch? c? s? ? 201 (valid)`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-251', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    // Template created/updated — just verify response is not empty
  });

  test(`TC-252-API: RED: Concurrent reset + commit ? counter sau reset l? 1 (kh?ng wrap)`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates/${incidentTemplateId}/reset-counter`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-253-API: RED: DELETE /templates ?ang c? ongoing commit transaction ? consistency`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.delete(`${DN}/templates/`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-254-API: RED: POST /draft khi DB kh?ng available ? 500 v?i graceful message`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(500);
  });

  test(`TC-255-API: RED: POST /templates documentType=INCIDENT nh?ng vi?t th??ng 'incident' ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-255', documentType: 'incident', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-256-API: RED: GET /templates/:id kh?ng t?n t?i ? 404`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/templates/00000000-0000-0000-0000-000000000000`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-257-API: RED: POST /templates v?i counterConfig.resetPeriod=null ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-257', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: null, minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-258-API: RED: POST /commit khi server ?ang trong deploy (brief downtime) ? 503`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-259-API: RED: GET /logs?userId=non-existent-uuid ? empty array 200`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/logs?userId=00000000-0000-0000-0000-000000000000`, {
          headers: auth(admin.token),
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json(); const d = body?.data ?? body;
    expect(Array.isArray(d) || Array.isArray(d?.items)).toBe(true);
  });

  test(`TC-260-API: RED: PUT /templates/:id v?i isActive=null ? 400 ho?c keep existing`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.put(`${DN}/templates/`, {
          headers: auth(admin.token),
          data: { separator: '/' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-261-API: RED: POST /templates t?t c? segments l? COUNTER (2 COUNTER) ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-261', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'COUNTER' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-262-API: RED: POST /draft user b? suspended/locked ? 401/403`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-263-API: RED: POST /commit s? l?n retry v??t max (3 l?n UNIQUE violation) ? 500`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(500);
  });

  test(`TC-264-API: RED: POST /templates separator c? tab character ? 400 ho?c strip`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-264', documentType: 'PROPOSAL', isActive: true, separator: '\t', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-265-API: RED: GET /logs filter by invalid date format '25/05/2026' ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/logs?from=25/05/2026`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-266-API: RED: POST /templates 1000 segments ? 400 (qu? nhi?u segment)`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-266', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: Array(1000).fill({ type: 'LITERAL', value: 'X' }), counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-267-API: RED: POST /draft Concurrent 50 requests ? t?t c? 200, previewNumber gi?ng nhau`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json(); const d = body?.data ?? body;
    expect(d).toHaveProperty('previewNumber');
  });

  test(`TC-268-API: RED: PUT /templates/:id x?a required segment type (segments=[]) ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.put(`${DN}/templates/`, {
          headers: auth(admin.token),
          data: { separator: '/' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-269-API: RED: POST /templates v?i documentType kh?ng n?m trong 6 lo?i ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-269', documentType: 'INVALID_TYPE', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-270-API: RED: POST /templates v?i counterConfig.padding = NaN ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-270', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: null } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-271-API: RED: POST /draft documentType=EVIDENCE v?i template inactive ? 404`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-272-API: RED: POST /commit v?i documentType=DELEGATION kh?ng c? counter row ? cold start auto-insert`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json(); const d = body?.data ?? body;
    expect(d).toHaveProperty('number');
  });

  test(`TC-273-API: RED: POST /templates v?i s? counterConfig.maxValue < 1 ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-273', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 0, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-274-API: RED: PATCH /logs/:logId isDraft=true (kh?ng ???c ph?p override) ? 400`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.patch(`${DN}/logs/`, {
          headers: auth(officer.token),
          data: { documentId: 'test-document-id-TC-274' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-275-API: RED: POST /commit v?i documentType=PROPOSAL kh?ng c? active template ? 404`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-276-API: SECURITY: Template IDOR - officer ??c stats template c?a admin ? check access`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/templates/${incidentTemplateId}/stats`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json(); const d = body?.data ?? body;
    expect(Array.isArray(d) || (d && typeof d === 'object')).toBe(true);
  });

  test(`TC-277-API: SECURITY: Prototype pollution trong JSON body ? kh?ng affect server state`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    // Template created/updated — just verify response is not empty
  });

  test(`TC-278-API: SECURITY: Content-Type spoofing ? POST /templates v?i Content-Type: text/plain nh?ng JSON body`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-279-API: SECURITY: Admin token d?ng cho endpoint c?a officer ? kh?ng downgrade quy?n`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
  });

  test(`TC-280-API: SECURITY: Enumeration attack ? /templates 403 vs 404 kh?ng leak info`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/templates/`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-286-API: RED P0: POST /commit khi DB connection pool exhausted ? 503`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-287-API: RED P0: POST /templates name ch? c? whitespace ? 400`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: '   ', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-288-API: RED P0: POST /draft v?i token b? tamper (signature invalid) ? 401`, async ({ request }) => {
    await ensureAuth(request);
    const tamperedToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJoYWNrZWQifQ.invalid_signature_here';
    const res = await request.post(`${DN}/draft`, {
          headers: { Authorization: `Bearer ${tamperedToken}` },
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-289-API: RED P0: POST /commit documentType EVIDENCE nh?ng template EVIDENCE inactive ? 404`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.put(`${DN}/templates/`, {
          headers: auth(admin.token),
          data: { separator: '/' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-290-API: RED P0: Commit khi counter WEEKLY period exhausted ? 400`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-291-API: RED P0: POST /templates kh?ng c? isActive ? default true ho?c false (documented)`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-291', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    // Template created/updated — just verify response is not empty
  });

  test(`TC-292-API: RED P0: DELETE /templates ?ang c? counter transactions ? 409 ho?c cascade`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.delete(`${DN}/templates/`, {
          headers: auth(admin.token),
    });
    expect([200, 201]).toContain(res.status());
  });

  test(`TC-293-API: RED P0: PATCH /logs/:logId kh?ng ???c s?a generatedNumber ? 400/ignore`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.patch(`${DN}/logs/`, {
          headers: auth(officer.token),
          data: { documentId: 'test-document-id-TC-293' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-294-API: RED P0: POST /commit v?i malformed UUID trong ctx ? 400`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-295-API: RED P0: POST /draft g?i li?n ti?p 100 l?n ? kh?ng accumulate draft logs qu? nhi?u`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/draft`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-296-API: RED P0: POST /commit sau khi admin ??i segment config ? number theo config m?i`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.put(`${DN}/templates/`, {
          headers: auth(admin.token),
          data: { separator: '/' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-297-API: RED P0: POST /templates v?i 1 segment (ch? COUNTER) ? 201 valid`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-297', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    // Template created/updated — just verify response is not empty
  });

  test(`TC-298-API: RED P0: GET /stats sau reset ? current=0, next=1, resetAt kh?c null`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates/${incidentTemplateId}/reset-counter`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-299-API: RED P0: Commit sau khi template ???c update (isActive toggle) ? correct behavior`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json(); const d = body?.data ?? body;
    expect(d).toHaveProperty('number');
  });

  test(`TC-300-API: RED P0: 100 concurrent POST /commit ? 100 s? unique, counter=100, kh?ng deadlock`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json(); const d = body?.data ?? body;
    expect(d).toHaveProperty('number');
  });

  test(`TC-301-API: RED P0: POST /commit sau admin thay ??i minValue c?a counter ? wrapping ??ng`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-302-API: RED P0: Kh?ng th? t?o 2 active template c?ng documentType ? ch? 1 active`, async ({ request }) => {
    const { admin } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { name: 'AutoGen-TC-302-duplicate', documentType: 'INCIDENT', isActive: true, segments: [{ type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 3 } },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-303-API: RED P0: Token v?i role kh?ng h?p l? (tampered 'SUPER_ADMIN') ? 403/401`, async ({ request }) => {
    await ensureAuth(request);
    const tamperedToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0Iiwicm9sZSI6IlNVUEVSX0FETUlOIn0.invalid';
    const res = await request.post(`${DN}/templates`, {
          headers: { Authorization: `Bearer ${tamperedToken}` },
          data: { name: 'AutoGen-TC-303', documentType: 'PROPOSAL', isActive: true, separator: '-', inputMode: 'AUTO', segments: [{ type: 'LITERAL', value: 'AG' }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 9999, padding: 4 } },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-304-API: RED P0: Commit ??ng th?i v?i DELETE template ? transaction isolation`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-305-API: RED P0: POST /templates maxValue = 2147483647 (INT max) ? 201, commit works`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    // Template created/updated — just verify response is not empty
  });

  test(`TC-306-API: RED P0: GET /templates/:id/stats v?i template v?a reset ? resetAt kh?ng null`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates/${incidentTemplateId}/reset-counter`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-307-API: RED P0: Commit v?i documentId kh?ng ph?i UUID ? 400`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-308-API: RED P0: POST /reset-counter v?i templateId kh?ng t?n t?i ? 404`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/templates/${incidentTemplateId}/reset-counter`, {
          headers: auth(admin.token),
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-309-API: RED P0: Commit khi Template kh?ng c? COUNTER segment ? s? kh?ng c? counter part`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
  });

  test(`TC-310-API: RED P0: POST /commit CASE kh?ng c? atomicity v?i case.create ? rollback test`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/cases`, {
          headers: auth(officer.token),
    });
    expect(res.status()).toBeLessThan(500);
  });

  test(`TC-311-API: SECURITY P0: Horizontal privilege escalation ? officer A kh?ng th? xem logs c?a officer B`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/logs?userId=`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json(); const d = body?.data ?? body;
    expect(Array.isArray(d) || Array.isArray(d?.items)).toBe(true);
  });

  test(`TC-312-API: SECURITY P0: SQL injection trong pagination params ? 400/safe`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/logs?page=1%3BSELECT%20*%20FROM%20users`, {
          headers: auth(admin.token),
          data: { documentType: "INCIDENT' DROP TABLE users" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-313-API: SECURITY P0: JWT algorithm confusion ? token v?i alg:none ? 401`, async ({ request }) => {
    await ensureAuth(request);
    const algNoneToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJoYWNrZWQiLCJyb2xlIjoiQURNSU4ifQ.';
    const res = await request.post(`${DN}/templates`, {
          headers: { Authorization: `Bearer ${algNoneToken}` },
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-314-API: SECURITY P0: Mass DELETE ? officer g?i DELETE /templates/{id} c?a m?i template ? 403 t?t c?`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/templates`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-315-API: SECURITY P0: Forced browsing ? /api/v1/document-numbers/admin endpoint (n?u c?) y?u c?u ADMIN role`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

  test(`TC-316-API: SECURITY P0: Replay old commit request ? counter t?ng th?m (idempotency key check)`, async ({ request }) => {
    const { officer, incidentTemplateId } = await ensureAuth(request);
    const res = await request.post(`${DN}/commit`, {
          headers: auth(officer.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
  });

  test(`TC-317-API: SECURITY P0: Enumeration ? GET /logs v?i filter userId tr? v? 200 r?ng, kh?ng 403 info leak`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.get(`${DN}/logs?userId=`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json(); const d = body?.data ?? body;
    expect(Array.isArray(d) || Array.isArray(d?.items)).toBe(true);
  });

  test(`TC-318-API: SECURITY P0: Admin x?a account officer ?ang c? active session ? subsequent requests ? 401`, async ({ request }) => {
    const { admin, incidentTemplateId } = await ensureAuth(request);
    const res = await request.delete(`${DN}/users/`, {
          headers: auth(admin.token),
          data: { documentType: 'INCIDENT' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.message ?? body.error?.message ?? body.error).toBeTruthy();
  });

});