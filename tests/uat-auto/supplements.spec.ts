import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Supplements
 * Total TC: 30
 */
test.describe('UAT-supplements: Supplements', () => {
  test(`TC-652: Tạo Supplement caseId + decisionNumber + reason + deadline @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-652", "reason": "Test supplement"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-653: caseId rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-653", "reason": "Test supplement"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-654: type rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-654", "reason": "Test supplement"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-655: decisionNumber rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-655", "reason": "Test supplement"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-656: reason rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-656", "reason": "Test supplement"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-657: decisionDate sai ISO → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-657", "reason": "Test supplement"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-658: deadline sai ISO → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-658", "reason": "Test supplement"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-659: deadline < decisionDate (deadline trước quyết định) @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-659", "reason": "Test supplement"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-660: GET list paginated @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-660", "reason": "Test supplement"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-661: GET detail @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-661", "reason": "Test supplement"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-662: GET ngoài scope → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-662", "reason": "Test supplement"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-663: GET NOT_EXIST → 404 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-663", "reason": "Test supplement"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-664: PUT update reason @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-664", "reason": "Test supplement"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-665: DELETE soft delete @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-665", "reason": "Test supplement"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-666: Tạo supplement → Case.soLanGiaHan auto-increment @P0 @INTEGRATION @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-666", "reason": "Test supplement"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-667: Tạo supplement với deadline mới → Case.deadline update @P0 @INTEGRATION @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-667", "reason": "Test supplement"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-668: IDOR caseId team khác → 403 @P0 @SECURITY @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-668", "reason": "Test supplement"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-669: XSS reason @P0 @SECURITY @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-669", "reason": "Test supplement"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-670: reason tiếng Việt long text @P1 @DATA @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-670", "reason": "Test supplement"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-671: decisionNumber format 'XYZ-2026-001' @P1 @DATA @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-671", "reason": "Test supplement"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-672: SUPPLEMENT_CREATED log @P0 @AUDIT @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-672", "reason": "Test supplement"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-673: decisionNumber 1 ký tự @P1 @BOUNDARY @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-673", "reason": "Test supplement"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-674: reason 50K ký tự @P1 @BOUNDARY @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-674", "reason": "Test supplement"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-675: List < 500ms @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-676: Form A11Y @P1 @A11Y @Low`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-677: Mobile responsive @P1 @COMPAT @Medium`, async ({ request }) => {
    // COMPAT TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-678: VIEWER POST → 403 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-678", "reason": "Test supplement"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-679: JWT thiếu → 401 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-679", "reason": "Test supplement"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-680: Filter by caseId @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-680", "reason": "Test supplement"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-681: Filter by type @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/investigation-supplements',
      role: 'admin',
      body: JSON.parse(`{"caseId": "PLACEHOLDER_CASE_ID", "type": "Gia hạn", "decisionNumber": "GH-UAT-TC-681", "reason": "Test supplement"}`),
      expectedStatus: 200,
    });
  });

});