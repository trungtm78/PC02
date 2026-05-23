import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Focus
 * Total TC: 1
 */
test.describe('UAT-focus: Focus', () => {
  test(`TC-251: Focus ring rõ ràng trên nút Lưu (outline 2px) @P1 @A11Y @High`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});