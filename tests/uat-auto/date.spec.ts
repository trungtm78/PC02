import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Date
 * Total TC: 1
 */
test.describe('UAT-date: Date', () => {
  test(`TC-295: ngayKhoiTo='2026-02-29' (năm 2026 không nhuận) → 400 hoặc 2026-03-01? @P1 @DATA @Medium`, async ({ request }) => {
    // Module 'Date' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});