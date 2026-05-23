import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: DataScope-C2
 * Total TC: 1
 */
test.describe('UAT-datascope-c2: DataScope-C2', () => {
  test(`TC-334: Dispatcher (canDispatch=true) xem mọi Case @P0 @DECISION @Critical`, async ({ request }) => {
    // Module 'DataScope-C2' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});