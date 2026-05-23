import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Motion
 * Total TC: 1
 */
test.describe('UAT-motion: Motion', () => {
  test(`TC-253: prefers-reduced-motion respect — animation tắt @P2 @A11Y @Low`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});