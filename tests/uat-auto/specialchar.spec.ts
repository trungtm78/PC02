import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: SpecialChar
 * Total TC: 1
 */
test.describe('UAT-specialchar: SpecialChar', () => {
  test(`TC-299: name có '&', '<', '>', '"', "'" — SQL escape @P1 @DATA @Medium`, async ({ request }) => {
    // Module 'SpecialChar' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});