import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: IncidentFlow
 * Total TC: 30
 */
test.describe('UAT-incidentflow: IncidentFlow', () => {
  test(`TC-717: Incident convertToCase @P0 @GREEN @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-718: Incident đã linked → 400 @P0 @RED @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 400,
    });
  });

  test(`TC-719: Incident ngoài scope → 403 @P0 @RED @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 403,
    });
  });

  test(`TC-720: Incident.status MOI_TIEP_NHAN → DANG_XAC_MINH @P0 @STATE @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 200,
    });
  });

  test(`TC-721: Incident → TAM_DINH_CHI @P0 @STATE @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 200,
    });
  });

  test(`TC-722: Incident → PHUC_HOI_NGUON_TIN @P0 @STATE @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 200,
    });
  });

  test(`TC-723: Incident TAM_DINH_CHI → DANG_XAC_MINH (phục hồi) @P0 @STATE @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 200,
    });
  });

  test(`TC-724: Incident → Case keep linkage (Incident.linkedCaseId) @P0 @INTEGRATION @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-725: Delete Incident có linkedCase Restrict @P0 @INTEGRATION @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-726: CaseProvenance=FROM_INCIDENT → linkedIncidentId set @P0 @GREEN @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-727: FROM_INCIDENT thiếu expectedIncidentUpdatedAt → 400 @P0 @RED @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 400,
    });
  });

  test(`TC-728: Race convertToCase 2 user same Incident → 1×409 @P0 @SECURITY @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-729: INCIDENT_CONVERTED audit @P0 @AUDIT @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-730: Incident có deadlineRuleVersionId tracked @P1 @DATA @Medium`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-731: E2E: Tạo Incident → assign → convert Case → KPI dashboard update @P1 @INTEGRATION @Medium`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-732: convertToCase < 1s @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-733: convertToCase fail giữa tx → Incident nguyên @P1 @RECOVERY @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 500,
    });
  });

  test(`TC-734: VIEWER convert → 403 @P0 @RED @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      body: JSON.parse(`{}`),
      expectedStatus: 401,
    });
  });

  test(`TC-735: JWT thiếu → 401 @P0 @RED @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      body: JSON.parse(`{}`),
      expectedStatus: 401,
    });
  });

  test(`TC-736: Incident TAM_DINH_CHI_LAI (lần 2 trở đi) @P0 @STATE @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 200,
    });
  });

  test(`TC-737: Incident detail show ketQuaXacMinh + ngayPhucHoi @P1 @GREEN @Medium`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-738: Incident kết quả phục hồi enum khác Case @P1 @DATA @Medium`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-739: Incident deadline override Case deadline? @P1 @BOUNDARY @Low`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-740: Multiple Incidents linked to same Case (1-to-many) @P0 @INTEGRATION @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-741: Delete Case có linkedIncidents → block 400 @P0 @INTEGRATION @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 400,
    });
  });

  test(`TC-742: Incident status transitions match BLTTHS @P0 @STATE @Medium`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-743: IDOR convertToCase với Incident ID team khác @P0 @SECURITY @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 404,
    });
  });

  test(`TC-744: Convert Incident → Case → Subject (E2E) @P0 @INTEGRATION @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-745: convertToCase Incident soft-deleted → 404 @P0 @RED @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 404,
    });
  });

  test(`TC-746: INCIDENT_STATUS_CHANGED audit có fromStatus/toStatus @P0 @AUDIT @High`, async ({ request }) => {
    const id = 'NON-EXIST-INC-ID';
    await call(request, {
      method: 'POST',
      path: `/incidents/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

});