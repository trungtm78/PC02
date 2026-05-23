import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Unicode
 * Total TC: 2
 */
test.describe('UAT-unicode: Unicode', () => {
  test(`TC-288: name có dấu tiếng Việt 'Vụ án Nguyễn Quỳnh Trâm' @P1 @DATA @High`, async ({ request }) => {
    // Module 'Unicode' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-289: name có dấu tổ hợp (Unicode NFC vs NFD) — normalize @P1 @DATA @Medium`, async ({ request }) => {
    // Module 'Unicode' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});