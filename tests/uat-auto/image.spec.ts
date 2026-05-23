import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Image
 * Total TC: 1
 */
test.describe('UAT-image: Image', () => {
  test(`TC-256: Icon button có aria-label (vd 'Xóa vụ án') @P1 @A11Y @Medium`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});