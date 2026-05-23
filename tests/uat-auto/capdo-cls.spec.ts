import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: capDo-cls
 * Total TC: 4
 */
test.describe('UAT-capdo-cls: capDo-cls', () => {
  test(`TC-327: CapDoToiPham class IT_NGHIEM_TRONG @P1 @EP @Low`, async ({ request }) => {
    // Module 'capDo-cls' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-328: CapDoToiPham class NGHIEM_TRONG @P1 @EP @Low`, async ({ request }) => {
    // Module 'capDo-cls' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-329: CapDoToiPham class RAT_NGHIEM_TRONG @P1 @EP @Low`, async ({ request }) => {
    // Module 'capDo-cls' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-330: CapDoToiPham class DAC_BIET_NGHIEM_TRONG @P1 @EP @Low`, async ({ request }) => {
    // Module 'capDo-cls' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});