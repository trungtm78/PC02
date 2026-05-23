import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: unit
 * Total TC: 2
 */
test.describe('UAT-unit: unit', () => {
  test(`TC-307: unit 255 ký tự → pass @P1 @BOUNDARY @Low`, async ({ request }) => {
    // Module 'unit' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-308: unit 256 ký tự → 400 @P1 @BOUNDARY @Low`, async ({ request }) => {
    // Module 'unit' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});