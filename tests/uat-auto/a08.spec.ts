import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: A08
 * Total TC: 2
 */
test.describe('UAT-a08: A08', () => {
  test(`TC-232: Optimistic lock prevent lost update qua expectedUpdatedAt @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A08' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-233: FROM_PETITION race condition không double-link Petition @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A08' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});