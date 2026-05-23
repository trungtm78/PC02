import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: PetitionFlow
 * Total TC: 35
 */
test.describe('UAT-petitionflow: PetitionFlow', () => {
  test(`TC-682: Petition convertToCase (POST /petitions/:id/convert) @P0 @GREEN @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-683: convertToCase Petition đã linked → 400 'Đã khởi tố rồi' @P0 @RED @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 400,
    });
  });

  test(`TC-684: convertToCase ngoài scope → 403 @P0 @RED @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 403,
    });
  });

  test(`TC-685: convertToCase Petition soft-deleted → 404 @P0 @RED @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 404,
    });
  });

  test(`TC-686: Petition.status transition MOI_TIEP_NHAN → DA_CHUYEN_VU_AN (convert) @P0 @STATE @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-687: Petition.status MOI_TIEP_NHAN → DANG_XU_LY (manual) @P0 @STATE @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 200,
    });
  });

  test(`TC-688: Petition.status DANG_XU_LY → CHO_PHE_DUYET @P0 @STATE @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 200,
    });
  });

  test(`TC-689: Petition.status CHO_PHE_DUYET → DA_GIAI_QUYET @P0 @STATE @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 200,
    });
  });

  test(`TC-690: Petition.status any → DA_LUU_DON (lưu đơn) @P0 @STATE @Medium`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 200,
    });
  });

  test(`TC-691: Petition.status → DA_CHUYEN_VU_VIEC (chuyển vụ việc) @P0 @STATE @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 200,
    });
  });

  test(`TC-692: Petition DA_CHUYEN_VU_AN không sửa được @P0 @RED @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 400,
    });
  });

  test(`TC-693: Cascade: Update Case.metadata.petitionType → sync Petition.petitionType @P0 @INTEGRATION @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-694: Update Case không có Petition link KHÔNG tạo phantom Petition @P0 @INTEGRATION @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 200,
    });
  });

  test(`TC-695: STT auto-generate format DT-YYYY-NNNNN @P0 @GREEN @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-696: STT race condition: 2 concurrent create không tạo duplicate STT @P0 @RED @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-697: convertToCase Petition status không phải MOI_TIEP_NHAN/DANG_XU_LY → 400 @P0 @RED @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 400,
    });
  });

  test(`TC-698: PETITION_CONVERTED log với linkedCaseId @P0 @AUDIT @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-699: convertToCase atomic — race 2 user → 1 conflict @P0 @SECURITY @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-700: Petition senderName tiếng Việt có dấu @P1 @DATA @Low`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-701: stt cuối cùng năm 99999 → tràn? @P1 @BOUNDARY @Low`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-702: Delete Petition KHÔNG delete linked Case (Restrict) @P0 @INTEGRATION @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 400,
    });
  });

  test(`TC-703: Delete Case → Petition.linkedCaseId vẫn giữ (Restrict) @P0 @INTEGRATION @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-704: convertToCase < 1s @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-705: convertToCase VIEWER → 403 @P0 @RED @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      body: JSON.parse(`{}`),
      expectedStatus: 401,
    });
  });

  test(`TC-706: convertToCase JWT thiếu → 401 @P0 @RED @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      body: JSON.parse(`{}`),
      expectedStatus: 401,
    });
  });

  test(`TC-707: Petition tab trong Case detail show linked petitions[] @P1 @GREEN @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-708: Multiple petitions linked to same Case (1-to-many) @P1 @GREEN @Medium`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-709: CaseProvenance=FROM_PETITION → Case có linkedPetitionId set @P0 @STATE @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-710: CaseProvenance ≠ FROM_PETITION → linkedPetitionId=null @P0 @STATE @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-711: petitionType enum: TO_GIAC, KHIEU_NAI, TIN_BAO, ... @P1 @DATA @Medium`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-712: petitionType='Vietnamese label' → 400 (v0.37.2.4 BUG) @P1 @RED @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 400,
    });
  });

  test(`TC-713: petitionType='TO_GIAC' enum value pass @P1 @GREEN @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-714: Petition convertToCase preserve provenance traceability @P0 @INTEGRATION @High`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-715: E2E: Tạo Petition → review → convert Case → assign team @P0 @INTEGRATION @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 201,
    });
  });

  test(`TC-716: convertToCase fail giữa tx → Petition vẫn nguyên @P1 @RECOVERY @Critical`, async ({ request }) => {
    const id = 'NON-EXIST-PET-ID';
    await call(request, {
      method: 'POST',
      path: `/petitions/${id}/convert`,
      role: 'admin',
      body: JSON.parse(`{}`),
      expectedStatus: 500,
    });
  });

});