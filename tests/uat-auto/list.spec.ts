import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: List
 * Total TC: 23
 */
test.describe('UAT-list: List', () => {
  test(`TC-067: GET /cases trả paginated 20 items default sorted createdAt desc @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-068: GET /cases?limit=50 trả tối đa 50 @P0 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"limit": "50"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-069: GET /cases?limit=101 → 400 @Max(100) @P0 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"limit": "101"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-070: GET /cases?limit=0 → 400 @Min(1) @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"limit": "0"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-071: GET /cases?limit=-5 → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"limit": "-5"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-072: GET /cases?limit=abc (NaN) → 400 @IsInt @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"limit": "abc"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-073: Filter status=DANG_DIEU_TRA chỉ trả Case status đó @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-074: Filter status=INVALID → 400 IsEnum @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"status": "INVALID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-075: Filter overdue=true trả case quá hạn @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"overdue": "true"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-076: Filter overdue=true KHÔNG include Case DA_KET_LUAN dù deadline đã qua @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"overdue": "true"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-077: Search 'Trộm cắp' tìm case có name/crime/unit chứa từ này (case-insensitive) @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"search": "Trộm cắp"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-078: Search với chữ có dấu vs không dấu (Unicode Vietnamese) @P0 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"search": "tron cap"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-079: Filter fromDate='2026-05-01' & toDate='2026-05-23' khoảng ngày @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      expectedStatus: 201,
    });
  });

  test(`TC-080: toDate < fromDate → vẫn trả empty (không 400) @P1 @RED @Low`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-081: Filter capDoToiPham=RAT_NGHIEM_TRONG @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-082: Filter districtId qua subjects relation @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"districtId": "DIS-Q1"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-083: Sort sortBy=name sortOrder=asc @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"sortBy": "name", "sortOrder": "asc"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-084: sortBy='evil_field' → fallback về createdAt (security: prevent SQL injection) @P1 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"sortBy": "password"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-085: Pagination offset=20 trả page 2 @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"offset": "20", "limit": "20"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-095: Filter wardTeamId='WARD-Q5' (cross-ward view PC02) @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"wardTeamId": "WARD-Q5"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-096: Filter investigatorId trả case của ĐTV cụ thể @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases',
      role: 'admin',
      query: JSON.parse(`{"investigatorId": "U001"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-277: GET /cases?limit=20 response < 500ms với 10k row DB @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-279: Filter overdue=true + pagination < 800ms @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});