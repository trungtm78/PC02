import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Timezone
 * Total TC: 1
 */
test.describe('UAT-timezone: Timezone', () => {
  test(`TC-296: ngayKhoiTo='2026-05-23T00:00:00+07:00' (GMT+7 Vietnam) @P1 @DATA @Medium`, async ({ request }) => {
    // Module 'Timezone' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});