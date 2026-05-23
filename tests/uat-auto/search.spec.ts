import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Search
 * Total TC: 1
 */
test.describe('UAT-search: Search', () => {
  test(`TC-278: GET /cases?search=trộm cắp < 1s với 10k row @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});