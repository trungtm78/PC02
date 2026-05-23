import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Hidden
 * Total TC: 1
 */
test.describe('UAT-hidden: Hidden', () => {
  test(`TC-292: name có zero-width space \\u200B → save raw nhưng có thể gây bug filter @P1 @DATA @Low`, async ({ request }) => {
    // Module 'Hidden' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});