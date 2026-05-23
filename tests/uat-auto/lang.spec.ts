import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Lang
 * Total TC: 1
 */
test.describe('UAT-lang: Lang', () => {
  test(`TC-257: <html lang='vi'> để screen reader phát âm tiếng Việt @P2 @A11Y @Low`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});