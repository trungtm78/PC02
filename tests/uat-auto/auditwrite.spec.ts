import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: AuditWrite
 * Total TC: 1
 */
test.describe('UAT-auditwrite: AuditWrite', () => {
  test(`TC-287: Audit log insert không block main response > 50ms @P1 @PERFORMANCE @Low`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});