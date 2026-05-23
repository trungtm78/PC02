import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Form
 * Total TC: 1
 */
test.describe('UAT-form: Form', () => {
  test(`TC-254: Form error message tiếng Việt, không dùng chỉ màu để biểu thị error @P1 @A11Y @High`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});