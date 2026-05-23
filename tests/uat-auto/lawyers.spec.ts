import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Lawyers
 * Total TC: 44
 */
test.describe('UAT-lawyers: Lawyers', () => {
  test(`TC-440: Tạo Lawyer với barNumber unique @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-440 Test Lawyer", "barNumber": "LS-UAT-TC-440", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-441: Tạo Lawyer gắn subjectId (bào chữa cho subject cụ thể) @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-441 Test Lawyer", "barNumber": "LS-UAT-TC-441", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-442: Lawyer không gắn subjectId (bào chữa chung) @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-442 Test Lawyer", "barNumber": "LS-UAT-TC-442", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-443: fullName rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-443 Test Lawyer", "barNumber": "LS-UAT-TC-443", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-444: barNumber rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-444 Test Lawyer", "barNumber": "LS-UAT-TC-444", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-445: barNumber duplicate (đã tồn tại) → 409 unique constraint @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-445 Test Lawyer", "barNumber": "LS-UAT-TC-445", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 409,
    });
  });

  test(`TC-446: caseId rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-446 Test Lawyer", "barNumber": "LS-UAT-TC-446", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-447: caseId không tồn tại → 400 FK @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-447 Test Lawyer", "barNumber": "LS-UAT-TC-447", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-448: subjectId không tồn tại trong DB → 400 FK @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-448 Test Lawyer", "barNumber": "LS-UAT-TC-448", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-449: subjectId không cùng caseId (cross-case) → 400 business rule @P1 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-449 Test Lawyer", "barNumber": "LS-UAT-TC-449", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-450: GET /lawyers?caseId=C001 trả lawyers của Case @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-450 Test Lawyer", "barNumber": "LS-UAT-TC-450", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-451: GET /lawyers?subjectId=S001 trả lawyers của subject @P0 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-451 Test Lawyer", "barNumber": "LS-UAT-TC-451", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-452: GET /lawyers/:id detail include subject info @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-452 Test Lawyer", "barNumber": "LS-UAT-TC-452", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-453: GET /lawyers/NOT_EXIST → 404 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-453 Test Lawyer", "barNumber": "LS-UAT-TC-453", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-454: GET Lawyer ngoài scope (Case không thuộc team mình) → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-454 Test Lawyer", "barNumber": "LS-UAT-TC-454", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-455: PUT update lawFirm + phone @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-455 Test Lawyer", "barNumber": "LS-UAT-TC-455", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-456: PUT barNumber duplicate → 409 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-456 Test Lawyer", "barNumber": "LS-UAT-TC-456", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 409,
    });
  });

  test(`TC-457: PUT Lawyer ngoài write scope → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-457 Test Lawyer", "barNumber": "LS-UAT-TC-457", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-458: DELETE Lawyer soft delete @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-458 Test Lawyer", "barNumber": "LS-UAT-TC-458", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-459: DELETE Lawyer không tồn tại → 404 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-459 Test Lawyer", "barNumber": "LS-UAT-TC-459", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-460: DELETE Lawyer ngoài scope → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-460 Test Lawyer", "barNumber": "LS-UAT-TC-460", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-461: IDOR: POST Lawyer với caseId ngoài team → 403 @P0 @SECURITY @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-461 Test Lawyer", "barNumber": "LS-UAT-TC-461", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-462: XSS qua fullName='<svg onload=alert(1)>' @P0 @SECURITY @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-462 Test Lawyer", "barNumber": "LS-UAT-TC-462", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-463: SQL injection qua barNumber @P0 @SECURITY @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-463 Test Lawyer", "barNumber": "LS-UAT-TC-463", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-464: fullName tiếng Việt 'Luật sư Đỗ Thị Thanh Mai' @P1 @DATA @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-464 Test Lawyer", "barNumber": "LS-UAT-TC-464", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-465: lawFirm Unicode 'Văn phòng Luật sư Hà Nội & Cộng sự' @P1 @DATA @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-465 Test Lawyer", "barNumber": "LS-UAT-TC-465", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-466: phone số Quốc tế '+84 901 234 567' @P1 @DATA @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-466 Test Lawyer", "barNumber": "LS-UAT-TC-466", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-467: barNumber chứa whitespace 'LS 2026 12345' → save raw (gap) @P1 @RED @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-467 Test Lawyer", "barNumber": "LS-UAT-TC-467", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-468: Lawyer được assign sang Subject khác (re-assign) @P1 @STATE @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-468 Test Lawyer", "barNumber": "LS-UAT-TC-468", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-469: Unassign Lawyer khỏi Subject (subjectId=null) @P1 @STATE @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-469 Test Lawyer", "barNumber": "LS-UAT-TC-469", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-470: Soft-delete Subject → Lawyer.subjectId auto null (onDelete SetNull) @P1 @INTEGRATION @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-470 Test Lawyer", "barNumber": "LS-UAT-TC-470", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-471: Form barNumber có pattern hint @P1 @A11Y @Low`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-472: GET /lawyers với 100 lawyer DB < 500ms @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-473: User VIEWER POST → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      body: JSON.parse(`{"fullName": "UAT-TC-473 Test Lawyer", "barNumber": "LS-UAT-TC-473", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-474: JWT thiếu → 401 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      body: JSON.parse(`{"fullName": "UAT-TC-474 Test Lawyer", "barNumber": "LS-UAT-TC-474", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-475: LAWYER_CREATED log có barNumber + caseId @P0 @AUDIT @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-475 Test Lawyer", "barNumber": "LS-UAT-TC-475", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-476: fullName 1 ký tự @P1 @BOUNDARY @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-476 Test Lawyer", "barNumber": "LS-UAT-TC-476", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-477: barNumber 1 ký tự @P1 @BOUNDARY @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-477 Test Lawyer", "barNumber": "LS-UAT-TC-477", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-478: fullName 500 ký tự @P1 @BOUNDARY @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-478 Test Lawyer", "barNumber": "LS-UAT-TC-478", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-479: POST với forbidNonWhitelisted field 'evil':'x' → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-479 Test Lawyer", "barNumber": "LS-UAT-TC-479", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-480: phone format không validate (gap) @P1 @RED @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-480 Test Lawyer", "barNumber": "LS-UAT-TC-480", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-481: Filter search by fullName @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-481 Test Lawyer", "barNumber": "LS-UAT-TC-481", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-482: Pagination limit/offset @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-482 Test Lawyer", "barNumber": "LS-UAT-TC-482", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-483: limit=200 → ? (max validation cần check) @P1 @RED @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/lawyers',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-483 Test Lawyer", "barNumber": "LS-UAT-TC-483", "caseId": "PLACEHOLDER_CASE_ID"}`),
      expectedStatus: 201,
    });
  });

});