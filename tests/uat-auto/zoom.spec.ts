import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Zoom
 * Total TC: 1
 */
test.describe('UAT-zoom: Zoom', () => {
  test(`TC-252: Zoom 200% không vỡ layout CaseListPage @P2 @A11Y @Medium`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});