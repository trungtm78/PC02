import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: A10
 * Total TC: 1
 */
test.describe('UAT-a10: A10', () => {
  test(`TC-237: Cases không fetch URL từ user input — N/A SSRF @P1 @SECURITY @Low`, async ({ request }) => {
    // Module 'A10' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});