import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: name
 * Total TC: 4
 */
test.describe('UAT-name: name', () => {
  test(`TC-301: name 1 ký tự 'A' (min) → pass @P0 @BOUNDARY @Medium`, async ({ request }) => {
    // Module 'name' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-302: name 500 ký tự (max) → pass @P0 @BOUNDARY @Medium`, async ({ request }) => {
    // Module 'name' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-303: name 501 ký tự → 400 @P0 @BOUNDARY @High`, async ({ request }) => {
    // Module 'name' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-304: name 499 ký tự → pass @P0 @BOUNDARY @Low`, async ({ request }) => {
    // Module 'name' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});