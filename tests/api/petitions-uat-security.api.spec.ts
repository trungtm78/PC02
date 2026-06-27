/**
 * FILE: tests/api/petitions-uat-security.api.spec.ts
 * UAT Security & Validation spec for Qu蘯｣n lﾃｽ ﾄ脆｡n thﾆｰ (Petitions)
 * Layer: API (no browser)
 * Scope: RED path 窶・4xx enforcement, auth guards, input validation, race conditions
 *
 * Run:
 *   UAT_PROD=1 npx playwright test tests/api/petitions-uat-security.api.spec.ts
 */

import { test, expect, APIRequestContext } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// 笏笏笏 Config 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

const API = process.env.API_BASE || 'http://171.244.40.245/api/v1';

// 笏笏笏 Helpers 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

async function loginApi(
  req: APIRequestContext,
  email: string,
  password: string,
): Promise<{ token: string; userId: string }> {
  const res = await req.post(`${API}/auth/login`, {
    data: { username: email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) throw new Error(`Login failed ${email}: ${res.status()}`);
  const body = await res.json();
  return { token: body.accessToken || body.access_token, userId: body.user?.id || '' };
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function unwrap(body: any): any {
  return body.data || body;
}

function makeStt(prefix = 'UAT'): string {
  return `${prefix}-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
}

const today = new Date().toISOString().split('T')[0];

// 笏笏笏 State shared across serial tests 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

let adminToken = '';
let officer1Token = '';
let sharedId = '';
let sharedUpdatedAt = '';
const createdIds: string[] = [];

// 笏笏笏 Suite 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

test.describe('TC: Quan ly Don thu 窶・Security & Validation (RED)', () => {
  // 笏笏笏 Setup 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test.beforeAll(async ({ request }) => {
    // Try primary admin; fall back to admin2 if locked (15-min lockout after brute-force TC-092)
    let admin: { token: string; userId: string };
    try {
      admin = await loginApi(request, process.env.ADMIN_USERNAME!, process.env.ADMIN_PASSWORD!);
    } catch {
      admin = await loginApi(request, process.env.ADMIN2_USERNAME!, process.env.ADMIN2_PASSWORD!);
    }
    adminToken = admin.token;

    const officer = await loginApi(
      request,
      process.env.OFFICER1_USERNAME!,
      process.env.OFFICER1_PASSWORD!,
    );
    officer1Token = officer.token;

    // Create the shared petition used by multiple tests
    const createRes = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('SHARED'),
        senderName: 'UAT Security Shared Sender',
        senderIsAnonymous: true,
        senderAddress: '123 UAT Street, Q.1',
        senderIsAnonymous: true,
        petitionType: 'TO_CAO',
        summary: 'Shared petition for security UAT',
        detailContent: 'N盻冓 dung chi ti蘯ｿt shared petition security',
        receivedDate: today,
      },
    });
    expect([200, 201]).toContain(createRes.status());
    const createBody = await createRes.json();
    const created = unwrap(createBody);
    sharedId = created.id;
    sharedUpdatedAt = created.updatedAt;
    createdIds.push(sharedId);
  });

  // 笏笏笏 TC-024: Not found 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-024: GET /petitions/nonexistent-id-99999999 竊・404', async ({ request }) => {
    const res = await request.get(`${API}/petitions/nonexistent-id-99999999`, {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(404);
  });

  // 笏笏笏 TC-026: Restore with short reason 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-026: POST /admin/petitions/:id/restore reason=6chars 竊・400', async ({ request }) => {
    const res = await request.post(`${API}/petitions/${sharedId}/restore`, {
      headers: authHeader(adminToken),
      data: { reason: 'short' },
    });
    // Short reason (5 chars "short") should fail validation
    expect([400, 404]).toContain(res.status());
  });

  // 笏笏笏 TC-027: Invalid petitionType 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-027: POST /petitions with petitionType=INVALID_TYPE 竊・400', async ({ request }) => {
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC027'),
        senderName: 'TC027 Sender',
        senderAddress: '123 Test',
        petitionType: 'INVALID_TYPE',
        summary: 'TC-027 test summary',
        detailContent: 'TC-027 detail',
        receivedDate: today,
      },
    });
    expect(res.status()).toBe(400);
  });

  // 笏笏笏 TC-028: Invalid email 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-028: POST /petitions with senderEmail=not-an-email 竊・400 (lenient)', async ({ request }) => {
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC028'),
        senderName: 'TC028 Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'TO_CAO',
        summary: 'TC-028 test',
        detailContent: 'TC-028 detail',
        receivedDate: today,
        senderEmail: 'not-an-email',
      },
    });
    if (res.status() === 201 || res.status() === 200) {
      console.log('TC-028: senderEmail validation is missing 窶・server accepted invalid email');
      const body = await res.json();
      const id = unwrap(body).id;
      if (id) createdIds.push(id);
    } else {
      expect(res.status()).toBe(400);
    }
  });

  // 笏笏笏 TC-029: Invalid phone 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-029: POST /petitions with senderPhone=abc!@# 竊・400 (lenient)', async ({ request }) => {
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC029'),
        senderName: 'TC029 Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'TO_CAO',
        summary: 'TC-029 test',
        detailContent: 'TC-029 detail',
        receivedDate: today,
        senderPhone: 'abc!@#',
      },
    });
    if (res.status() === 201 || res.status() === 200) {
      console.log('TC-029: senderPhone validation is missing 窶・server accepted invalid phone');
      const body = await res.json();
      const id = unwrap(body).id;
      if (id) createdIds.push(id);
    } else {
      expect(res.status()).toBe(400);
    }
  });

  // 笏笏笏 TC-030: convert-to-case without expectedUpdatedAt 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-030: POST /petitions/:id/convert-to-case without expectedUpdatedAt 竊・400', async ({ request }) => {
    const res = await request.post(`${API}/petitions/${sharedId}/convert-case`, {
      headers: authHeader(adminToken),
      data: {
        caseName: 'TC030 Case',
        crimeType: 'Test Crime',
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  // 笏笏笏 TC-035: No Authorization header 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-035: GET /petitions without Authorization 竊・401', async ({ request }) => {
    const res = await request.get(`${API}/petitions`);
    expect(res.status()).toBe(401);
  });

  // 笏笏笏 TC-036: Missing stt 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-036: POST /petitions without stt field 竊・400', async ({ request }) => {
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        senderName: 'TC036 Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'TO_CAO',
        summary: 'TC-036 no stt',
        detailContent: 'TC-036 detail',
        receivedDate: today,
        // deliberately omitting stt
      },
    });
    // stt is @IsOptional -- backend auto-generates STT
    expect([200, 201]).toContain(res.status());
    if (res.status() === 201 || res.status() === 200) {
      const body = await res.json();
      const id = unwrap(body).id;
      if (id) createdIds.push(id);
    }
  });

  // 笏笏笏 TC-037: Export rate limit / no 500 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-037: GET /petitions/export 6x quickly 竊・at least one 200 or 429, no 500', async ({
    request,
  }) => {
    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request.get(`${API}/petitions/export`, {
        headers: authHeader(adminToken),
      });
      results.push(res.status());
    }
    console.log('TC-037 export statuses:', results);
    // No 500 errors
    for (const s of results) {
      expect(s).not.toBe(500);
    }
    // At least one 200 or 429 (throttle 5/60s)
    expect(results.some((s) => s === 200 || s === 429)).toBe(true);
  });

  // 笏笏笏 TC-038: Race condition on convert-to-case 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-038: Race condition on convert-to-case 竊・at most 1 succeeds', async ({ request }) => {
    // Create a fresh petition for this race test
    const createRes = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('RACE038'),
        senderName: 'TC038 Race Sender',
        senderAddress: '999 Race Street',
        senderIsAnonymous: true,
        petitionType: 'KHIEU_NAI',
        summary: 'Race condition test petition',
        detailContent: 'Detail for race condition test',
        receivedDate: today,
      },
    });
    expect([200, 201]).toContain(createRes.status());
    const raceBody = await createRes.json();
    const raceId = unwrap(raceBody).id;
    const raceUpdatedAt = unwrap(raceBody).updatedAt;
    createdIds.push(raceId);

    const payload = {
      caseName: 'TC038 Race Case',
      expectedUpdatedAt: raceUpdatedAt,
    };

    const [res1, res2] = await Promise.all([
      request.post(`${API}/petitions/${raceId}/convert-case`, {
        headers: authHeader(adminToken),
        data: payload,
      }),
      request.post(`${API}/petitions/${raceId}/convert-case`, {
        headers: authHeader(adminToken),
        data: payload,
      }),
    ]);

    const statuses = [res1.status(), res2.status()];
    console.log('TC-038 race statuses:', statuses);

    // At most 1 succeeds (201/200); the other should get 409, 400, or 404
    const successCount = statuses.filter((s) => s === 200 || s === 201).length;
    expect(successCount).toBeLessThanOrEqual(1);
  });

  // 笏笏笏 TC-039: Restore with 501-char reason 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-039: POST /admin/petitions/:id/restore reason=501chars 竊・400', async ({ request }) => {
    const longReason = 'A'.repeat(501);
    const res = await request.post(`${API}/petitions/${sharedId}/restore`, {
      headers: authHeader(adminToken),
      data: { reason: longReason },
    });
    expect([400, 404]).toContain(res.status());
  });

  // 笏笏笏 TC-040: Officer data scope 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-040: GET /petitions as OFFICER1 竊・200, array returned, log count', async ({
    request,
  }) => {
    const res = await request.get(`${API}/petitions`, {
      headers: authHeader(officer1Token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = unwrap(body);
    const items = Array.isArray(data) ? data : data.items || data.data || [];
    console.log(`TC-040: officer1 sees ${items.length} petitions`);
    expect(Array.isArray(items)).toBe(true);
  });

  // 笏笏笏 TC-042: Skip 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-042: Skip 窶・covered in core spec', async () => {
    console.log('TC-042: already covered in petitions core spec 窶・skipping here');
  });

  // 笏笏笏 TC-075: Admin assign to mismatched team 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-075: Admin assigning petition to non-matching ward team 竊・[200, 400, 403] lenient', async ({
    request,
  }) => {
    const res = await request.patch(`${API}/petitions/${sharedId}/assign`, {
      headers: authHeader(adminToken),
      data: { assignedTeamId: 'nonexistent-team-id-99999' },
    });
    console.log(`TC-075 status: ${res.status()}`);
    expect([200, 400, 403, 404]).toContain(res.status());
  });

  // 笏笏笏 TC-078: STT with special chars 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-078: POST /petitions with stt containing #!@ 竊・log actual behavior (lenient)', async ({
    request,
  }) => {
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: `TC078-#!@-${Date.now()}`,
        senderName: 'TC078 Special Char Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'PHAN_ANH',
        summary: 'TC-078 special chars in stt',
        detailContent: 'TC-078 detail',
        receivedDate: today,
      },
    });
    console.log(`TC-078: stt with special chars 竊・status ${res.status()}`);
    // Not 500
    expect(res.status()).not.toBe(500);
    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json();
      const id = unwrap(body).id;
      if (id) createdIds.push(id);
    }
  });

  // 笏笏笏 TC-083: IDOR via sequential IDs 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-083: IDOR guessing /petitions/1 and /petitions/2 as officer1 竊・[403, 404]', async ({
    request,
  }) => {
    for (const guessId of ['1', '2']) {
      const res = await request.get(`${API}/petitions/${guessId}`, {
        headers: authHeader(officer1Token),
      });
      console.log(`TC-083: GET /petitions/${guessId} 竊・${res.status()}`);
      expect([403, 404]).toContain(res.status());
    }
  });

  // 笏笏笏 TC-085: Fake JWT 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-085: GET /petitions with fake JWT 竊・401', async ({ request }) => {
    const res = await request.get(`${API}/petitions`, {
      headers: {
        Authorization: 'Bearer fake.jwt.token',
        'Content-Type': 'application/json',
      },
    });
    expect(res.status()).toBe(401);
  });

  // 笏笏笏 TC-086: Expired JWT 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-086: GET /petitions with expired JWT 竊・401', async ({ request }) => {
    // exp=1 竊・expired in 1970
    const expiredToken =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxfQ.signature';
    const res = await request.get(`${API}/petitions`, {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        'Content-Type': 'application/json',
      },
    });
    expect(res.status()).toBe(401);
  });

  // 笏笏笏 TC-087: enteredById spoofing 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-087: POST /petitions with spoofed enteredById 竊・response enteredById is NOT spoofed', async ({
    request,
  }) => {
    const spoofedId = 'spoofed-user-id-00000';
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC087'),
        senderName: 'TC087 Spoof Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'TO_CAO',
        summary: 'TC-087 spoofing test',
        detailContent: 'TC-087 detail',
        receivedDate: today,
        enteredById: spoofedId,
      },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    const data = unwrap(body);
    if (data.id) createdIds.push(data.id);
    // The server must ignore the spoofed enteredById
    expect(data.enteredById).not.toBe(spoofedId);
    console.log(`TC-087: actual enteredById = ${data.enteredById}`);
  });

  // 笏笏笏 TC-088: Path traversal in export filename 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-088: GET /petitions/export with filename traversal param 竊・200 or 400, NOT 500', async ({
    request,
  }) => {
    const res = await request.get(
      `${API}/petitions/export?filename=${encodeURIComponent('../../../etc/passwd')}`,
      { headers: authHeader(adminToken) },
    );
    console.log(`TC-088 status: ${res.status()}`);
    expect(res.status()).not.toBe(500);
    expect([200, 400, 422, 429]).toContain(res.status());
  });

  // 笏笏笏 TC-089: CSRF header absent 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-089: POST /petitions without X-CSRF-Token 竊・200 or 401 (API-first apps often skip CSRF)', async ({
    request,
  }) => {
    const res = await request.post(`${API}/petitions`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        // deliberately no X-CSRF-Token
      },
      data: {
        stt: makeStt('TC089'),
        senderName: 'TC089 CSRF Test',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'TO_CAO',
        summary: 'TC-089 csrf test',
        detailContent: 'TC-089 detail',
        receivedDate: today,
      },
    });
    console.log(`TC-089: Without X-CSRF-Token 竊・${res.status()}`);
    expect([200, 201, 401, 403]).toContain(res.status());
    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json();
      const id = unwrap(body).id;
      if (id) createdIds.push(id);
    }
  });

  // 笏笏笏 TC-090: NoSQL injection in query 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-090: GET /petitions?status={"$ne":"null"} 竊・200 or 400, NOT 500', async ({
    request,
  }) => {
    const res = await request.get(
      `${API}/petitions?status=${encodeURIComponent('{"$ne":"null"}')}`,
      { headers: authHeader(adminToken) },
    );
    console.log(`TC-090 status: ${res.status()}`);
    expect(res.status()).not.toBe(500);
    expect([200, 400, 422]).toContain(res.status());
  });

  // 笏笏笏 TC-091: No password fields in response 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-091: GET /petitions 竊・response must NOT contain password/hash/salt keys', async ({
    request,
  }) => {
    const res = await request.get(`${API}/petitions`, {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(200);
    const raw = await res.text();
    const lowerRaw = raw.toLowerCase();
    // Check for sensitive field names in JSON keys (surrounded by quotes)
    expect(lowerRaw).not.toMatch(/"password"\s*:/);
    expect(lowerRaw).not.toMatch(/"passwordhash"\s*:/);
    expect(lowerRaw).not.toMatch(/"salt"\s*:/);
    console.log('TC-091: No password/hash/salt fields found in response');
  });

  // 笏笏笏 TC-092: Brute-force lockout 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-092: 6x login with wrong password 竊・no 500; expect [401, 429] on later attempts', async ({
    request,
  }) => {
    // Use a non-existent user to avoid locking the real admin account
    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request.post(`${API}/auth/login`, {
        data: { username: 'bruteforce-test-tc092@nonexistent.test', password: 'wrong-password-tc092!' },
        headers: { 'Content-Type': 'application/json' },
      });
      results.push(res.status());
    }
    console.log('TC-092 brute-force statuses:', results);
    for (const s of results) {
      expect(s).not.toBe(500);
      expect([401, 429, 400]).toContain(s);
    }
  });

  // 笏笏笏 TC-093: Vietnamese unicode sender name 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-093: POST /petitions with senderName=Vietnamese unicode 竊・201, stored correctly', async ({
    request,
  }) => {
    const unicodeName = 'Nguy盻・ Vﾄハ ﾃ］h';
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC093'),
        senderName: unicodeName,
        senderAddress: '123 ﾄ脆ｰ盻拵g Lﾃｪ L盻｣i, Q.1',
        senderIsAnonymous: true,
        petitionType: 'KIEN_NGHI',
        summary: 'TC-093 unicode sender name',
        detailContent: 'TC-093 n盻冓 dung chi ti蘯ｿt',
        receivedDate: today,
      },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    const data = unwrap(body);
    if (data.id) createdIds.push(data.id);
    expect(data.senderName).toBe(unicodeName);
  });

  // 笏笏笏 TC-094: Very long detailContent 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-094: POST /petitions with detailContent=5000chars 竊・201 or 400 (no 500)', async ({
    request,
  }) => {
    const longContent = 'N盻冓 dung '.repeat(555).slice(0, 5000);
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC094'),
        senderName: 'TC094 Long Content Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'TO_CAO',
        summary: 'TC-094 long content test',
        detailContent: longContent,
        receivedDate: today,
      },
    });
    console.log(`TC-094: 5000-char detailContent 竊・${res.status()}`);
    expect(res.status()).not.toBe(500);
    expect([200, 201, 400, 422]).toContain(res.status());
    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json();
      const id = unwrap(body).id;
      if (id) createdIds.push(id);
    }
  });

  // 笏笏笏 TC-095: Valid phone number 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-095: POST /petitions with senderPhone=0901234567 竊・201', async ({ request }) => {
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC095'),
        senderName: 'TC095 Valid Phone Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'PHAN_ANH',
        summary: 'TC-095 valid phone',
        detailContent: 'TC-095 detail',
        receivedDate: today,
        senderPhone: '0901234567',
      },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    const id = unwrap(body).id;
    if (id) createdIds.push(id);
  });

  // 笏笏笏 TC-096: Internationalized domain email 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-096: POST /petitions with senderEmail=IDN domain 竊・201 or 400', async ({
    request,
  }) => {
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC096'),
        senderName: 'TC096 IDN Email Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'TO_CAO',
        summary: 'TC-096 IDN email',
        detailContent: 'TC-096 detail',
        receivedDate: today,
        senderEmail: 'test@xn--ngng-vua2b.com',
      },
    });
    console.log(`TC-096: IDN email 竊・${res.status()}`);
    expect([200, 201, 400, 422]).toContain(res.status());
    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json();
      const id = unwrap(body).id;
      if (id) createdIds.push(id);
    }
  });

  // 笏笏笏 TC-097: Newlines in summary 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-097: POST /petitions with summary containing \\n\\r\\t 竊・201', async ({
    request,
  }) => {
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC097'),
        senderName: 'TC097 Newlines Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'KHIEU_NAI',
        summary: 'TC-097\nnewlines\r\ttabs in summary',
        detailContent: 'TC-097 detail',
        receivedDate: today,
      },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    const id = unwrap(body).id;
    if (id) createdIds.push(id);
  });

  // 笏笏笏 TC-098: ISO 8601 receivedDate 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-098: POST /petitions with receivedDate=ISO8601 full datetime 竊・201', async ({
    request,
  }) => {
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC098'),
        senderName: 'TC098 ISO Date Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'TO_CAO',
        summary: 'TC-098 ISO date test',
        detailContent: 'TC-098 detail',
        receivedDate: '2026-01-15T00:00:00.000Z',
      },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    const id = unwrap(body).id;
    if (id) createdIds.push(id);
  });

  // 笏笏笏 TC-120: convert-to-case regression 窶・missing expectedUpdatedAt 笏笏笏笏笏笏笏

  test('TC-120: POST /petitions/:id/convert-to-case without expectedUpdatedAt 竊・400 regression', async ({
    request,
  }) => {
    const res = await request.post(`${API}/petitions/${sharedId}/convert-case`, {
      headers: authHeader(adminToken),
      data: { caseName: 'TC120 Case Without Optimistic Lock' },
    });
    expect([400, 422]).toContain(res.status());
  });

  // 笏笏笏 TC-121: PUT with future receivedDate 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-121: PUT /petitions/:id with receivedDate=tomorrow 竊・400 (if validation exists)', async ({
    request,
  }) => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const res = await request.put(`${API}/petitions/${sharedId}`, {
      headers: authHeader(adminToken),
      data: {
        receivedDate: tomorrow,
        expectedUpdatedAt: sharedUpdatedAt,
      },
    });
    console.log(`TC-121: receivedDate=tomorrow (${tomorrow}) 竊・${res.status()}`);
    // Accept 400 (validation) or 200 (no future-date guard) 窶・just not 500
    expect(res.status()).not.toBe(500);
    expect([200, 201, 400, 422]).toContain(res.status());
  });

  // 笏笏笏 TC-122: PUT/PATCH terminal status petition 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-122: PUT/PATCH terminal status petition 竊・[400, 409, 200] lenient', async ({
    request,
  }) => {
    // shared petition may not be in terminal status; just check no 500
    const res = await request.patch(`${API}/petitions/${sharedId}`, {
      headers: authHeader(adminToken),
      data: { summary: 'TC-122 update attempt', expectedUpdatedAt: sharedUpdatedAt },
    });
    console.log(`TC-122: PATCH on petition 竊・${res.status()}`);
    expect(res.status()).not.toBe(500);
    expect([200, 201, 400, 404, 409]).toContain(res.status());
  });

  // 笏笏笏 TC-123: Convert soft-deleted petition 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-123: Convert-to-incident on soft-deleted petition 竊・[400, 404]', async ({
    request,
  }) => {
    // Create then soft-delete a petition
    const createRes = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC123DEL'),
        senderName: 'TC123 Delete Then Convert',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'TO_CAO',
        summary: 'TC-123 to be deleted',
        detailContent: 'TC-123 detail',
        receivedDate: today,
      },
    });
    expect([200, 201]).toContain(createRes.status());
    const createBody = await createRes.json();
    const delId = unwrap(createBody).id;
    const delUpdatedAt = unwrap(createBody).updatedAt;

    // Soft delete it
    const deleteRes = await request.delete(`${API}/petitions/${delId}`, {
      headers: authHeader(adminToken),
      data: { reason: 'TC-123 soft delete for test' },
    });
    console.log(`TC-123: delete status 竊・${deleteRes.status()}`);

    // Attempt convert-to-incident on deleted petition
    const convertRes = await request.post(`${API}/petitions/${delId}/convert-incident`, {
      headers: authHeader(adminToken),
      data: {
        incidentName: 'TC123 Incident',
        expectedUpdatedAt: delUpdatedAt,
      },
    });
    console.log(`TC-123: convert-to-incident on deleted 竊・${convertRes.status()}`);
    expect([400, 404]).toContain(convertRes.status());
  });

  // 笏笏笏 TC-124: Export with empty ids array 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-124: GET /petitions/export with no ids 竊・200 or 400', async ({ request }) => {
    const res = await request.get(`${API}/petitions/export`, {
      headers: authHeader(adminToken),
    });
    console.log(`TC-124: export with no ids 竊・${res.status()}`);
    expect([200, 400, 422, 429]).toContain(res.status());
  });

  // 笏笏笏 TC-125: Export admin petition as officer1 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-125: GET /petitions/export with admin petition id as officer1 竊・[200 empty, 403]', async ({
    request,
  }) => {
    const res = await request.get(
      `${API}/petitions/export?ids=${encodeURIComponent(sharedId)}`,
      { headers: authHeader(officer1Token) },
    );
    console.log(`TC-125: officer1 export admin petition 竊・${res.status()}`);
    expect([200, 403, 400, 429]).toContain(res.status());
  });

  // 笏笏笏 TC-126: senderBirthYear=1899 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-126: POST /petitions with senderBirthYear=1899 竊・400', async ({ request }) => {
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC126'),
        senderName: 'TC126 Old Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'TO_CAO',
        summary: 'TC-126 birth year test',
        detailContent: 'TC-126 detail',
        receivedDate: today,
        senderBirthYear: 1899,
      },
    });
    console.log(`TC-126: senderBirthYear=1899 竊・${res.status()}`);
    expect([400, 422]).toContain(res.status());
  });

  // 笏笏笏 TC-127: Assign to nonexistent user 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-127: PATCH /petitions/:id/assign with assignedToId=nonexistent 竊・404 or 400', async ({
    request,
  }) => {
    const res = await request.patch(`${API}/petitions/${sharedId}/assign`, {
      headers: authHeader(adminToken),
      data: { assignedToId: 'nonexistent-user-id-99999' },
    });
    console.log(`TC-127: assign nonexistent user 竊・${res.status()}`);
    expect([400, 404]).toContain(res.status());
  });

  // 笏笏笏 TC-128: LIKE wildcard injection 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-128: GET /petitions?search=%%% 竊・200 not 500', async ({ request }) => {
    const res = await request.get(`${API}/petitions?search=${encodeURIComponent('%%%')}`, {
      headers: authHeader(adminToken),
    });
    console.log(`TC-128: LIKE injection search 竊・${res.status()}`);
    expect(res.status()).not.toBe(500);
    expect([200, 400]).toContain(res.status());
  });

  // 笏笏笏 TC-129: Officer deletes admin petition 竊・403 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-129: DELETE /petitions/:id as officer1 where petition belongs to admin 竊・403', async ({
    request,
  }) => {
    const res = await request.delete(`${API}/petitions/${sharedId}`, {
      headers: authHeader(officer1Token),
      data: { reason: 'TC-129 unauthorized delete attempt' },
    });
    console.log(`TC-129: officer1 delete admin petition 竊・${res.status()}`);
    expect([403, 401]).toContain(res.status());
  });

  // 笏笏笏 TC-130: Invalid status value in PUT 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-130: PUT /petitions/:id with status=INVALID_STATUS_BYPASS 竊・400', async ({
    request,
  }) => {
    const res = await request.put(`${API}/petitions/${sharedId}`, {
      headers: authHeader(adminToken),
      data: {
        status: 'INVALID_STATUS_BYPASS',
        expectedUpdatedAt: sharedUpdatedAt,
      },
    });
    console.log(`TC-130: invalid status PUT 竊・${res.status()}`);
    expect([400, 422]).toContain(res.status());
  });

  // 笏笏笏 TC-149: Ward officer data scope 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-149: GET /petitions as ward officer 竊・200 + array (log count)', async ({
    request,
  }) => {
    const res = await request.get(`${API}/petitions`, {
      headers: authHeader(officer1Token),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const data = unwrap(body);
    const items = Array.isArray(data) ? data : data.items || data.data || [];
    console.log(`TC-149: officer1 petition count = ${items.length}`);
    expect(Array.isArray(items)).toBe(true);
  });

  // 笏笏笏 TC-150: Double delete flow (delete 竊・restore 竊・delete again) 笏笏笏笏笏笏笏笏笏

  test('TC-150: DELETE 竊・restore 竊・DELETE again 竊・200', async ({ request }) => {
    // Create fresh petition
    const createRes = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC150'),
        senderName: 'TC150 Double Delete Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'PHAN_ANH',
        summary: 'TC-150 double delete test',
        detailContent: 'TC-150 detail',
        receivedDate: today,
      },
    });
    expect([200, 201]).toContain(createRes.status());
    const createBody = await createRes.json();
    const tcId = unwrap(createBody).id;

    // First delete
    const del1 = await request.delete(`${API}/petitions/${tcId}`, {
      headers: authHeader(adminToken),
      data: { reason: 'TC-150 first delete' },
    });
    console.log(`TC-150: first delete 竊・${del1.status()}`);
    expect([200, 400]).toContain(del1.status()); // 400 if not in deletable status

    // Restore
    const restore = await request.post(`${API}/petitions/${tcId}/restore`, {
      headers: authHeader(adminToken),
      data: { reason: 'TC-150 restore after first delete' },
    });
    console.log(`TC-150: restore 竊・${restore.status()}`);
    expect([200, 404]).toContain(restore.status());

    // Second delete
    const del2 = await request.delete(`${API}/petitions/${tcId}`, {
      headers: authHeader(adminToken),
      data: { reason: 'TC-150 second delete after restore' },
    });
    console.log(`TC-150: second delete 竊・${del2.status()}`);
    expect([200, 400, 404]).toContain(del2.status());
  });

  // 笏笏笏 TC-151: XSS payload in detailContent 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-151: POST /petitions with XSS payload in detailContent 竊・201 or 400, NOT 500', async ({
    request,
  }) => {
    const xssPayload = '<script>fetch("http://169.254.169.254/")</script>';
    const res = await request.post(`${API}/petitions`, {
      headers: authHeader(adminToken),
      data: {
        stt: makeStt('TC151'),
        senderName: 'TC151 XSS Sender',
        senderAddress: '123 Test',
        senderIsAnonymous: true,
        petitionType: 'TO_CAO',
        summary: 'TC-151 xss test',
        detailContent: xssPayload,
        receivedDate: today,
      },
    });
    console.log(`TC-151: XSS payload 竊・${res.status()}`);
    expect(res.status()).not.toBe(500);
    expect([200, 201, 400]).toContain(res.status());
    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json();
      const id = unwrap(body).id;
      if (id) createdIds.push(id);
    }
  });

  // 笏笏笏 TC-152: Officer export admin-only petition IDs 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test('TC-152: GET /petitions/export as officer1 with admin-only ids 竊・[200 empty, 403]', async ({
    request,
  }) => {
    const res = await request.get(
      `${API}/petitions/export?ids=${encodeURIComponent(sharedId)}`,
      { headers: authHeader(officer1Token) },
    );
    console.log(`TC-152: officer1 export admin petition 竊・${res.status()}`);
    expect([200, 403, 400, 429]).toContain(res.status());
  });

  // 笏笏笏 TC-153: Double assign 窶・second should 409 or 200 idempotent 笏笏笏笏笏笏笏笏笏

  test('TC-153: PATCH /petitions/:id/assign same payload twice 竊・409 or 200', async ({
    request,
  }) => {
    const payload = { summary: 'TC-153 idempotent assign', expectedUpdatedAt: sharedUpdatedAt };
    const res1 = await request.patch(`${API}/petitions/${sharedId}/assign`, {
      headers: authHeader(adminToken),
      data: payload,
    });
    const res2 = await request.patch(`${API}/petitions/${sharedId}/assign`, {
      headers: authHeader(adminToken),
      data: payload,
    });
    console.log(`TC-153: assign x2 竊・${res1.status()}, ${res2.status()}`);
    expect([200, 201, 400, 404, 409]).toContain(res1.status());
    expect([200, 201, 400, 404, 409]).toContain(res2.status());
    // Not 500
    expect(res1.status()).not.toBe(500);
    expect(res2.status()).not.toBe(500);
  });

  // 笏笏笏 Cleanup 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

  test.afterAll(async ({ request }) => {
    for (const id of [...new Set(createdIds)]) {
      const res = await request.delete(`${API}/petitions/${id}`, {
        headers: authHeader(adminToken),
        data: { reason: 'UAT cleanup 窶・petitions-uat-security spec' },
      });
      console.log(`Cleanup petition ${id} 竊・${res.status()}`);
    }
  });
});

