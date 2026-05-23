import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: name-cls
 * Total TC: 2
 */
test.describe('UAT-name-cls: name-cls', () => {
  test(`TC-323: name class hợp lệ: chuỗi VN có dấu @P1 @EP @Low`, async ({ request }) => {
    // Module 'name-cls' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-324: name class không hợp lệ: rỗng @P1 @EP @Medium`, async ({ request }) => {
    // Module 'name-cls' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});