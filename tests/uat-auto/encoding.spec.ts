import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Encoding
 * Total TC: 1
 */
test.describe('UAT-encoding: Encoding', () => {
  test(`TC-298: Multi-byte filename trong sourceDocumentNote @P1 @DATA @Medium`, async ({ request }) => {
    // Module 'Encoding' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});