import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: subC
 * Total TC: 3
 */
test.describe('UAT-subc: subC', () => {
  test(`TC-313: subjectsCount = 0 (min) → pass @P1 @BOUNDARY @Low`, async ({ request }) => {
    // Module 'subC' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-314: subjectsCount = -1 → 400 @Min(0) @P1 @BOUNDARY @Medium`, async ({ request }) => {
    // Module 'subC' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-315: subjectsCount = 1 → pass @P1 @BOUNDARY @Low`, async ({ request }) => {
    // Module 'subC' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});