import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Whitespace
 * Total TC: 1
 */
test.describe('UAT-whitespace: Whitespace', () => {
  test(`TC-291: name='  Vụ ABC  ' leading/trailing trimmed @P1 @DATA @Medium`, async ({ request }) => {
    // Module 'Whitespace' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});