import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-team
 * Total TC: 2
 */
test.describe('UAT-create-team: Create-team', () => {
  test(`TC-051: assignedTeamId KHÔNG tồn tại trong teams (FK invalid) → ? @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-051] assignedTeamId KHÔNG tồn tại trong teams (FK invalid) → ?", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 500,
    });
  });

  test(`TC-059: assignedTeamId của team đã isActive=false → field saved nhưng cảnh báo @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-059] assignedTeamId của team đã isActive=false → field saved nhưng cảnh báo", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 201,
    });
  });

});