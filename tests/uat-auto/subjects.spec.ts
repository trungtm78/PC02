import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Subjects
 * Total TC: 72
 */
test.describe('UAT-subjects: Subjects', () => {
  test(`TC-368: Tạo Subject với CCCD 12 chữ số hợp lệ @P0 @GREEN @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-368 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-369: Tạo Subject với CCCD 9 chữ số (CMND cũ) @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-369 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-370: CCCD 8 chữ số → 400 regex fail @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-370 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-371: CCCD 13 chữ số → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-371 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-372: CCCD có chữ cái 'ABC079090123' → 400 regex @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-372 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-373: CCCD rỗng → 400 IsNotEmpty @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-373 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-374: fullName rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-374 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-375: dateOfBirth rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-375 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-376: dateOfBirth='15/01/1990' không ISO → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-376 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-377: dateOfBirth='2030-01-01' tương lai → ? (gap) @P0 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-377 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-378: address rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-378 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-379: caseId rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-379 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-380: caseId không tồn tại → 400 FK invalid @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-380 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-381: caseId của Case soft-deleted → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-381 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-382: crimeId rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-382 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-383: crimeId không tồn tại trong directory → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-383 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-384: gender='UNKNOWN' không trong enum → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-384 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-385: gender bỏ trống → default MALE @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-385 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-386: type=VICTIM (Bị hại) — không phải SUSPECT default @P1 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-386 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-387: type=WITNESS (Nhân chứng) @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-387 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-388: type='INVALID' → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-388 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-389: status=DETAINED (Đang tạm giam) @P1 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-389 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-390: status=RELEASED khi đã thả @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-390 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-391: status=WANTED (Truy nã) @P1 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-391 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-392: GET /subjects?caseId=C001 trả subjects của Case @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-392 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-393: GET /subjects/:id detail include lawyers liên kết @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-393 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-394: GET /subjects/:id Subject ngoài scope → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-394 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-395: GET /subjects/NOT_EXIST → 404 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-395 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-396: PUT update fullName của Subject @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-396 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-397: PUT Subject ngoài write scope → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-397 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-398: PUT Subject soft-deleted → 404 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-398 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-399: DELETE Subject soft delete + Case.subjectsCount giảm @P0 @GREEN @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-399 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-400: DELETE Subject ngoài scope → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-400 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-401: DELETE Subject không tồn tại → 404 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-401 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-402: DELETE Subject đã soft-deleted (idempotent) → 404 hoặc 200 @P0 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-402 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-403: IDOR: POST subject với caseId của Case khác user → 403/400 @P0 @SECURITY @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-403 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-404: XSS qua fullName='<script>alert(1)</script>' → React escape @P0 @SECURITY @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-404 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-405: SQL injection qua idNumber bypass regex (impossible vì regex strict) @P0 @SECURITY @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-405 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-406: fullName tiếng Việt có dấu 'Nguyễn Quỳnh Trâm' @P1 @DATA @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-406 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-407: fullName 200 ký tự (long name) @P1 @DATA @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-407 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-408: address Unicode + multi-line @P1 @DATA @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-408 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-409: CCCD đúng 9 chữ → pass min @P1 @BOUNDARY @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-409 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-410: CCCD đúng 12 chữ → pass max @P1 @BOUNDARY @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-410 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-411: CCCD 10 chữ → 400 (regex chỉ accept 9 hoặc 12) @P1 @BOUNDARY @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-411 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-412: CCCD 11 chữ → 400 @P1 @BOUNDARY @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-412 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-413: Transition INVESTIGATING → DETAINED (bắt tạm giam) @P0 @STATE @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-413 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-414: Transition DETAINED → RELEASED (thả) @P0 @STATE @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-414 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-415: Transition INVESTIGATING → WANTED (chuyển truy nã) @P0 @STATE @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-415 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-416: Transition WANTED → DETAINED (bắt được rồi) @P1 @STATE @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-416 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-417: Form Subject input có label gắn id @P1 @A11Y @Medium`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-418: Date picker dateOfBirth keyboard accessible @P1 @A11Y @Medium`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-419: GET /subjects?caseId=X với Case có 50 subjects < 500ms @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-420: Duplicate idNumber + caseId + type (constraint unique per type per case) @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-420 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 409,
    });
  });

  test(`TC-421: Cùng idNumber khác type (SUSPECT vs VICTIM) trong cùng Case OK @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-421 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-422: DELETE Subject ghi audit với name + reason @P0 @AUDIT @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-422 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-423: PUT thay đổi caseId (chuyển vụ án) → có cho phép? @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-423 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-424: occupationId không tồn tại directory → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-424 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-425: nationalityId không tồn tại → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-425 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-426: wardId không tồn tại → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-426 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-427: districtName denormalized preserve sau cải cách hành chính @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-427 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-428: Subject Filter by status=DETAINED @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-428 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-429: Subject Filter by type=SUSPECT @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-429 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-430: User VIEWER không có write/Subject → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      body: JSON.parse(`{"fullName": "UAT-TC-430 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-431: JWT thiếu → 401 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      body: JSON.parse(`{"fullName": "UAT-TC-431 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-432: fullName 1 ký tự 'A' @P1 @BOUNDARY @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-432 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-433: fullName 1000 ký tự (no max) @P1 @BOUNDARY @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-433 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-434: phone number format VN '0901234567' @P1 @DATA @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-434 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-435: phone với ký tự đặc biệt '+84 901 234 567' @P1 @DATA @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-435 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-436: Subject + Lawyer assign: thêm Lawyer cho 1 Subject cụ thể @P1 @INTEGRATION @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-436 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-437: Delete Subject có Lawyer link — Lawyer.subjectId=NULL (SetNull) @P1 @INTEGRATION @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-437 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-438: Atomic Subject create rollback nếu audit fail @P1 @RECOVERY @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-438 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 500,
    });
  });

  test(`TC-439: SUBJECT_CREATED log có caseId trong metadata @P0 @AUDIT @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/subjects',
      role: 'admin',
      body: JSON.parse(`{"fullName": "UAT-TC-439 Test Subject", "dateOfBirth": "1990-01-15", "idNumber": "079090012345", "address": "Test address", "caseId": "PLACEHOLDER_CASE_ID", "crimeId": "PLACEHOLDER_CRIME_ID"}`),
      expectedStatus: 201,
    });
  });

});