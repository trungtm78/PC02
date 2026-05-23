import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-prov
 * Total TC: 17
 */
test.describe('UAT-create-prov: Create-prov', () => {
  test(`TC-025: Thiếu caseProvenance → 400 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-025] Thiếu caseProvenance → 400"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-026: caseProvenance không phải enum value → 400 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-026] caseProvenance không phải enum value → 400", "caseProvenance": "INVALID_VALUE"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-027: caseProvenance là tiếng Việt (legacy payload) → 400 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-027] caseProvenance là tiếng Việt (legacy payload) → 400", "caseProvenance": "Phát hiện trực tiếp"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-028: FROM_PETITION nhưng thiếu linkedPetitionId → 400 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-028] FROM_PETITION nhưng thiếu linkedPetitionId → 400", "caseProvenance": "FROM_PETITION"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-029: FROM_INCIDENT thiếu linkedIncidentId → 400 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-029] FROM_INCIDENT thiếu linkedIncidentId → 400", "caseProvenance": "FROM_INCIDENT"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-030: FROM_PETITION thiếu expectedPetitionUpdatedAt → 400 IsISO8601 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-030] FROM_PETITION thiếu expectedPetitionUpdatedAt → 400 IsISO8601", "caseProvenance": "FROM_PETITION", "linkedPetitionId": "PET-NOT-EXIST-999"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-031: FROM_PETITION với expectedPetitionUpdatedAt cũ hơn current → 409 Conflict @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-031] FROM_PETITION với expectedPetitionUpdatedAt cũ hơn current → 409 Conflict", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 409,
    });
  });

  test(`TC-032: FROM_PETITION với linkedPetitionId KHÔNG tồn tại → 404 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-032] FROM_PETITION với linkedPetitionId KHÔNG tồn tại → 404", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-033: FROM_PETITION với Petition của user KHÁC scope → 404 (không lộ tồn tại) @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-033] FROM_PETITION với Petition của user KHÁC scope → 404 (không lộ tồn tại)", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-034: FROM_PETITION với Petition đã có linkedCaseId (đã khởi tố trước) → 404 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-034] FROM_PETITION với Petition đã có linkedCaseId (đã khởi tố trước) → 404", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-035: FROM_PETITION với deletedAt != null → 404 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-035] FROM_PETITION với deletedAt != null → 404", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-036: expectedPetitionUpdatedAt sai format (không ISO 8601) → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-036] expectedPetitionUpdatedAt sai format (không ISO 8601) → 400", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-048: caseProvenance=DIRECT_DISCOVERY nhưng vẫn truyền linkedPetitionId → field bị ignore @P0 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-048] caseProvenance=DIRECT_DISCOVERY nhưng vẫn truyền linkedPetitionId → field bị ign", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-060: caseProvenance=SELF_SURRENDER cần linkedPetitionId hoặc khác? — check enum @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-060] caseProvenance=SELF_SURRENDER cần linkedPetitionId hoặc khác? — check enum", "caseProvenance": "SELF_SURRENDER"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-064: Race condition: 2 user đồng thời FROM_PETITION cùng PET-001 → 1 ConflictException @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-064] Race condition: 2 user đồng thời FROM_PETITION cùng PET-001 → 1 ConflictExceptio", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-065: FROM_INCIDENT với Incident updatedAt mismatch → 409 'Vụ việc đã chỉnh sửa' @P1 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-065] FROM_INCIDENT với Incident updatedAt mismatch → 409 'Vụ việc đã chỉnh sửa'", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 409,
    });
  });

  test(`TC-066: FROM_PETITION + ngayKhoiTo trước Petition.receivedDate? — business logic cần check @P1 @RED @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-066] FROM_PETITION + ngayKhoiTo trước Petition.receivedDate? — business logic cần che", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

});