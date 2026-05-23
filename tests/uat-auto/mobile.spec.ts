import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Mobile
 * Total TC: 2
 */
test.describe('UAT-mobile: Mobile', () => {
  test(`TC-267: iOS Safari 17 trên iPhone 14 — list page responsive @P1 @COMPAT @Medium`, async ({ request }) => {
    // COMPAT TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-268: Android Chrome 126 trên Pixel 7 @P1 @COMPAT @Medium`, async ({ request }) => {
    // COMPAT TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});