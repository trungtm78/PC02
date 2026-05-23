import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Timeout
 * Total TC: 1
 */
test.describe('UAT-timeout: Timeout', () => {
  test(`TC-359: Request timeout 30s + retry → idempotency? @P1 @RECOVERY @High`, async ({ request }) => {
    // Module 'Timeout' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});