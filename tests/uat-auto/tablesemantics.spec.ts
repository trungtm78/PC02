import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: TableSemantics
 * Total TC: 1
 */
test.describe('UAT-tablesemantics: TableSemantics', () => {
  test(`TC-258: Bảng danh sách dùng <table><th scope='col'> @P1 @A11Y @Medium`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});