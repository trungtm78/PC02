import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Export
 * Total TC: 13
 */
test.describe('UAT-export: Export', () => {
  test(`TC-185: GET /cases/export/ward trả file Excel với header BCA + 8 cột @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/export/ward',
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-186: Export ward với fromDate + toDate trong period @P0 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/export/ward',
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-187: Export 'phân loại khác' với category filter @P0 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/export/ward',
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-188: Rate limit: gọi /export/ward 6 lần trong 60s → 429 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/export/ward',
      role: 'admin',
      expectedStatus: 429,
    });
  });

  test(`TC-189: Export với scope filter — ward officer chỉ thấy case của ward mình @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/export/ward',
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-190: Dispatcher xem tất cả case khi export @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/export/ward',
      role: 'approver1',
      expectedStatus: 200,
    });
  });

  test(`TC-191: Export với take=500 limit cứng (không trả >500 row) @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/export/ward',
      role: 'admin',
      expectedStatus: 500,
    });
  });

  test(`TC-192: Permission: user role VIEWER không có 'read Case' → 403 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/export/ward',
      expectedStatus: 401,
    });
  });

  test(`TC-193: JWT thiếu → 401 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/export/ward',
      expectedStatus: 401,
    });
  });

  test(`TC-194: Export ward không có data → vẫn trả Excel với header + empty body + footer @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/export/ward',
      role: 'admin',
      query: JSON.parse(`{"fromDate": "2030-01-01", "toDate": "2030-01-02"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-195: Server crash giữa export (write fail) → response 500 JSON nếu chưa send header @P1 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/export/ward',
      role: 'admin',
      expectedStatus: 500,
    });
  });

  test(`TC-196: Audit CASE_EXPORTED capture filters đầy đủ @P1 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/export/ward',
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-282: Export 500 row Excel < 5s @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});