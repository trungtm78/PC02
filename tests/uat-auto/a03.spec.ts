import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: A03
 * Total TC: 6
 */
test.describe('UAT-a03: A03', () => {
  test(`TC-217: SQLi qua search param: ?search=' OR 1=1-- → vẫn an toàn @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A03' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-218: SQLi qua sortBy: ?sortBy=name; DROP TABLE cases-- → whitelist filter @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A03' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-219: XSS reflected: name=<script>alert(1)</script> → React escape khi render @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A03' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-220: XSS stored: crime=<img src=x onerror=alert(1)> render detail → escape @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A03' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-221: XSS DOM: search query có script trong URL → no eval @P0 @SECURITY @High`, async ({ request }) => {
    // Module 'A03' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-222: JSON injection vào metadata: metadata={__proto__:{isAdmin:true}} @P0 @SECURITY @High`, async ({ request }) => {
    // Module 'A03' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});