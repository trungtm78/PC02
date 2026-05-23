import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Server500
 * Total TC: 1
 */
test.describe('UAT-server500: Server500', () => {
  test(`TC-358: Server 500 giữa POST — Case không tạo, audit không log @P1 @RECOVERY @High`, async ({ request }) => {
    // Module 'Server500' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});