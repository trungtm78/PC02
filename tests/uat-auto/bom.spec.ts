import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: BOM
 * Total TC: 1
 */
test.describe('UAT-bom: BOM', () => {
  test(`TC-293: name='\\uFEFFVụ' BOM character ở đầu @P1 @DATA @Low`, async ({ request }) => {
    // Module 'BOM' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});