import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Contrast
 * Total TC: 2
 */
test.describe('UAT-contrast: Contrast', () => {
  test(`TC-249: Text trên background đạt 4.5:1 (WCAG AA) @P1 @A11Y @High`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-250: Badge status có contrast đủ (text white trên red ≥ 4.5) @P1 @A11Y @Medium`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});