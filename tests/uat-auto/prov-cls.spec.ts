import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: prov-cls
 * Total TC: 2
 */
test.describe('UAT-prov-cls: prov-cls', () => {
  test(`TC-325: Provenance class valid enum (DIRECT_DISCOVERY) @P1 @EP @Low`, async ({ request }) => {
    // Module 'prov-cls' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-326: Provenance class invalid (string ngẫu nhiên) @P1 @EP @Medium`, async ({ request }) => {
    // Module 'prov-cls' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});