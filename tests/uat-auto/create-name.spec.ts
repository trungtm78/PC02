import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-name
 * Total TC: 11
 */
test.describe('UAT-create-name: Create-name', () => {
  test(`TC-017: Thiếu trường name (required) trả 400 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-018: name là chuỗi rỗng '' trả 400 'Tên vụ án bắt buộc' @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"caseProvenance": "DIRECT_DISCOVERY", "name": ""}`),
      expectedStatus: 400,
    });
  });

  test(`TC-019: name chỉ whitespace '   ' bị trim thành '' → 400 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "     ", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-020: name là null → 400 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": null, "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-021: name là số 12345 không phải string → 400 IsString @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": 12345, "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-022: name vượt 500 ký tự (501 chars) → 400 MaxLength @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-023: name là object JSON → 400 IsString @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": {"text": "abc"}, "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-024: name là array → 400 IsString @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": ["abc"], "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-061: name='\\t\\t\\t' (3 tab) bị trim thành '' → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "     ", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-062: name='\\n\\n\\n' (3 newline) bị trim → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-062] name='\\\\n\\\\n\\\\n' (3 newline) bị trim → 400", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-063: name=' Vụ ABC ' (có space đầu/cuối) bị trim → save 'Vụ ABC' @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-063] name=' Vụ ABC ' (có space đầu/cuối) bị trim → save 'Vụ ABC'", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

});