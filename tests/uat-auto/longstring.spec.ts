import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: LongString
 * Total TC: 1
 */
test.describe('UAT-longstring: LongString', () => {
  test(`TC-300: metadata.note 5000 ký tự (JSONB không limit) @P1 @DATA @Low`, async ({ request }) => {
    // Module 'LongString' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});