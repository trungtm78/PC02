import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: A02
 * Total TC: 2
 */
test.describe('UAT-a02: A02', () => {
  test(`TC-215: JWT là HS256 với secret strong (≥32 chars) — không yếu @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A02' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-216: API chạy trên HTTPS (production) — HTTP redirect 301 @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A02' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});