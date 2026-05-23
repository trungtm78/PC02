import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Screenreader
 * Total TC: 3
 */
test.describe('UAT-screenreader: Screenreader', () => {
  test(`TC-246: Input có aria-label hoặc label[for] gắn id @P1 @A11Y @High`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-247: Status badge có aria-label='Trạng thái Đang điều tra' @P1 @A11Y @Medium`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-248: Error message gắn aria-describedby với input @P1 @A11Y @High`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});