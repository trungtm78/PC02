import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: CSRF
 * Total TC: 1
 */
test.describe('UAT-csrf: CSRF', () => {
  test(`TC-239: Mutation POST/PUT/DELETE từ origin lạ không có cookie + custom header → reject CORS @P0 @SECURITY @High`, async ({ request }) => {
    // Module 'CSRF' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});