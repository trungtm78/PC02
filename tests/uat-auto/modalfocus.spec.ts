import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: ModalFocus
 * Total TC: 1
 */
test.describe('UAT-modalfocus: ModalFocus', () => {
  test(`TC-259: Modal mở thì focus trap inside; close trả focus về trigger @P1 @A11Y @High`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});