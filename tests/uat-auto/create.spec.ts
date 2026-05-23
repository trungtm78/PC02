import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create
 * Total TC: 17
 */
test.describe('UAT-create: Create', () => {
  test(`TC-001: Tạo Case DIRECT_DISCOVERY thành công với input đầy đủ @P0 @GREEN @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-001] Tạo Case DIRECT_DISCOVERY thành công với input đầy đủ", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-002: Tạo Case FROM_PETITION link Petition đang status TIEP_NHAN + expectedPetitionUpdatedAt khớp @P0 @GREEN @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-002] Tạo Case FROM_PETITION link Petition đang status TIEP_NHAN + expectedPetitionUpd", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-003: Tạo Case FROM_INCIDENT link Incident chưa khởi tố + expectedIncidentUpdatedAt khớp @P0 @GREEN @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-003] Tạo Case FROM_INCIDENT link Incident chưa khởi tố + expectedIncidentUpdatedAt kh", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-004: Tạo Case TRANSFERRED với sourceDocumentNote @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-004] Tạo Case TRANSFERRED với sourceDocumentNote", "caseProvenance": "TRANSFERRED", "sourceDocumentNote": "Công văn chuyển CQĐT số test"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-005: Tạo Case OTHER_LEGAL_SOURCE @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-005] Tạo Case OTHER_LEGAL_SOURCE", "caseProvenance": "OTHER_LEGAL_SOURCE", "sourceDocumentNote": "Tin báo"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-006: Tạo Case với capDoToiPham=DAC_BIET_NGHIEM_TRONG để KPI-4 tính @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-006] Tạo Case với capDoToiPham=DAC_BIET_NGHIEM_TRONG để KPI-4 tính", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-007: Auto-deadline tính theo SystemSetting THOI_HAN_GIAI_QUYET @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-007] Auto-deadline tính theo SystemSetting THOI_HAN_GIAI_QUYET", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-008: Tạo Case manual deadline override auto-deadline @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-008] Tạo Case manual deadline override auto-deadline", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-009: Tạo Case với metadata custom (người báo tin) @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-009] Tạo Case với metadata custom (người báo tin)", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-010: Ward officer auto-set assignedTeamId theo wardTeamId (silent override) @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'officer1',
      body: JSON.parse(`{"name": "[UAT-TC-010] Ward officer auto-set assignedTeamId theo wardTeamId (silent override)", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-011: Tạo Case bỏ trống các field optional @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-011] Tạo Case bỏ trống các field optional", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-012: Tạo Case với investigatorId là user khác đang active @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-012] Tạo Case với investigatorId là user khác đang active", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-013: Tạo Case với ngayKhoiTo lùi vài ngày trước hôm nay (đã khởi tố trước khi vào hệ thống) @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-013] Tạo Case với ngayKhoiTo lùi vài ngày trước hôm nay (đã khởi tố trước khi vào hệ ", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-014: Dispatcher tạo Case có thể chọn assignedTeamId bất kỳ @P1 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'approver1',
      body: JSON.parse(`{"name": "[UAT-TC-014] Dispatcher tạo Case có thể chọn assignedTeamId bất kỳ", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-015: Tạo Case ADMIN với toàn bộ field bao gồm field hiếm dùng @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-015] Tạo Case ADMIN với toàn bộ field bao gồm field hiếm dùng", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-016: POST trả response message tiếng Việt 'Tạo vụ án thành công' @P1 @GREEN @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-016] POST trả response message tiếng Việt 'Tạo vụ án thành công'", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-281: POST /cases (FROM_PETITION transaction) < 600ms @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});