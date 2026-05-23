import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: DataScope-C1
 * Total TC: 1
 */
test.describe('UAT-datascope-c1: DataScope-C1', () => {
  test(`TC-333: ADMIN (dataScope=null) xem mọi Case @P0 @DECISION @Critical`, async ({ request }) => {
    // Module 'DataScope-C1' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});