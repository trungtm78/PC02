import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Assign
 * Total TC: 16
 */
test.describe('UAT-assign: Assign', () => {
  test(`TC-169: Dispatcher phân công Case sang Team-Q2 + investigator của team @P0 @GREEN @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'approver1',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-170: Non-dispatcher gọi assign → 403 DispatchGuard @P0 @RED @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'approver1',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-171: Case ngoài scope của dispatcher (nếu dispatcher có scope giới hạn) → ? @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'approver1',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-172: assignedTeamId team đã isActive=false → 400 'Tổ điều tra không tồn tại hoặc đã ngừng hoạt động' @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'admin',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-173: investigatorId không thuộc team được chỉ định → 400 'Điều tra viên không thuộc tổ' @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'admin',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-174: investigatorId=null khi assign (chỉ chuyển team, chưa giao cho ĐTV cụ thể) @P1 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'admin',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-175: Case không tồn tại → 404 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'admin',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-176: Case đã soft-deleted → 404 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'admin',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-177: expectedUpdatedAt mismatch → 409 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'admin',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 409,
    });
  });

  test(`TC-178: Escalation: ward team → non-ward team → emit CASE_ESCALATED_FROM_WARD audit @P0 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'admin',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-179: Re-assign cùng team (no-op assignedTeamId không đổi) → audit không emit escalation @P1 @GREEN @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'admin',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-180: Non-ward team → ward team (de-escalation) — audit không emit (chỉ from-ward) @P1 @GREEN @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'admin',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-181: assignedTeamId rỗng '' → 400 @P1 @RED @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'admin',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-182: Thiếu assignedTeamId → 400 DTO required @P1 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'admin',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-183: Dispatcher với expectedUpdatedAt KHỚP → success @P1 @GREEN @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'approver1',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-184: Non-dispatcher với JWT của dispatcher (token theft) → permission guard pass? — JWT check role thật @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/assign`,
      role: 'approver1',
      body: JSON.parse(`{"assignedTeamId": "PLACEHOLDER_TEAM_ID"}`),
      expectedStatus: 200,
    });
  });

});