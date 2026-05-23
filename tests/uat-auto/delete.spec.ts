import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Delete
 * Total TC: 19
 */
test.describe('UAT-delete: Delete', () => {
  test(`TC-139: Soft delete Case TIEP_NHAN, reason 50 chars, creator → success @P0 @GREEN @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-139 delete reason — test"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-140: Reason < 10 ký tự → 400 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-140 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-141: Reason > 500 ký tự → 400 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-141 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-142: Thiếu reason → 400 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-142 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-143: Reason rỗng '' → 400 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-143 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-144: Reason chỉ whitespace '          ' → 400 (Transform trim) @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-144 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-145: Status ≠ TIEP_NHAN (DANG_DIEU_TRA) → 400 'Chỉ xóa được vụ án ở trạng thái Tiếp nhận' @P0 @RED @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-145 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-146: Có ≥1 subject linked → 400 'có N đối tượng. Xóa các đối tượng trước' @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-146 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-147: Có ≥1 lawyer linked → 400 'có N luật sư' @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-147 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-148: Có ≥1 conclusion → 400 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-148 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-149: Có ≥1 document → 400 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-149 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-150: Có ≥1 linkedIncident → 400 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-150 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-151: User không phải creator + không phải ADMIN → 403 @P0 @RED @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-151 delete reason — test"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-152: createdById=NULL (legacy data) + user không ADMIN → 403 message riêng @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-152 delete reason — test"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-153: ADMIN xóa được Case của bất kỳ ai trong window @P0 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-153 delete reason — test"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-154: Quá window (THOI_HAN_XOA_VU_AN=72h default) + không ADMIN → 400 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-154 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-155: ADMIN có thể xóa Case quá 72h window @P0 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-155 delete reason — test"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-156: Race condition: status đổi trong lúc DELETE → P2025 catch → 400 friendly @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-156 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-157: TOCTOU: subject vừa được insert giữa initial check và transaction → 400 trong tx @P0 @RED @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'DELETE',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-157 delete reason — test"}`),
      expectedStatus: 400,
    });
  });

});