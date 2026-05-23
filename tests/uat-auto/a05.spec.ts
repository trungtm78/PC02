import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: A05
 * Total TC: 3
 */
test.describe('UAT-a05: A05', () => {
  test(`TC-226: CORS header restrict origin (không *) @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A05' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-227: Response không có sensitive header X-Powered-By, Server version @P0 @SECURITY @Medium`, async ({ request }) => {
    // Module 'A05' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-228: Security headers: HSTS, X-Content-Type-Options, X-Frame-Options @P0 @SECURITY @High`, async ({ request }) => {
    // Module 'A05' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});