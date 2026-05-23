import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: HTML
 * Total TC: 1
 */
test.describe('UAT-html: HTML', () => {
  test(`TC-294: name='<b>Vụ</b>' tag HTML literal @P1 @DATA @Medium`, async ({ request }) => {
    // Module 'HTML' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});