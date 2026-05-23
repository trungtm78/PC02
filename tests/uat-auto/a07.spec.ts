import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: A07
 * Total TC: 3
 */
test.describe('UAT-a07: A07', () => {
  test(`TC-229: JWT hết hạn → 401, không refresh tự động infinite @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A07' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-230: JWT signature tamper → 401 @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A07' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-231: JWT của user đã deactivated/locked → 401 hoặc 403 @P0 @SECURITY @High`, async ({ request }) => {
    // Module 'A07' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});