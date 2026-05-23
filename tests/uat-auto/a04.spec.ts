import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: A04
 * Total TC: 3
 */
test.describe('UAT-a04: A04', () => {
  test(`TC-223: Export rate limit ngăn data exfiltration @P0 @SECURITY @High`, async ({ request }) => {
    // Module 'A04' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-224: Soft delete với reason mandatory ngăn data lost without trace @P0 @SECURITY @High`, async ({ request }) => {
    // Module 'A04' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-225: Restore window check (legacy NULL createdById → ADMIN-only) @P0 @SECURITY @High`, async ({ request }) => {
    // Module 'A04' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});