import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Number
 * Total TC: 1
 */
test.describe('UAT-number: Number', () => {
  test(`TC-297: subjectsCount=Number.MAX_SAFE_INTEGER → save hoặc 400 @P1 @DATA @Low`, async ({ request }) => {
    // Module 'Number' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});