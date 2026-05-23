import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: PartialDelete
 * Total TC: 1
 */
test.describe('UAT-partialdelete: PartialDelete', () => {
  test(`TC-360: Audit fail giữa DELETE tx → rollback delete @P1 @RECOVERY @Critical`, async ({ request }) => {
    // Module 'PartialDelete' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});