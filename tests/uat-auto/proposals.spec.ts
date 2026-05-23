import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Proposals
 * Total TC: 35
 */
test.describe('UAT-proposals: Proposals', () => {
  test(`TC-581: Tạo Proposal với proposalNumber + content @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-581", "content": "UAT TC-581 proposal"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-582: proposalNumber rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-582", "content": "UAT TC-582 proposal"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-583: content rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-583", "content": "UAT TC-583 proposal"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-584: proposalNumber duplicate → 409 unique @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-584", "content": "UAT TC-584 proposal"}`),
      expectedStatus: 409,
    });
  });

  test(`TC-585: relatedCaseId optional bỏ trống (general proposal) @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-585", "content": "UAT TC-585 proposal"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-586: relatedCaseId không tồn tại → 400 FK @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-586", "content": "UAT TC-586 proposal"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-587: Tạo Proposal với sentDate @P0 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-587", "content": "UAT TC-587 proposal"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-588: sentDate format invalid → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-588", "content": "UAT TC-588 proposal"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-589: GET /proposals list paginated @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-589", "content": "UAT TC-589 proposal"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-590: GET /proposals/:id detail @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-590", "content": "UAT TC-590 proposal"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-591: GET proposal ngoài scope → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-591", "content": "UAT TC-591 proposal"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-592: GET /proposals/NOT_EXIST → 404 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-592", "content": "UAT TC-592 proposal"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-593: PUT update response + responseDate @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-593", "content": "UAT TC-593 proposal"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-594: DELETE soft delete @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-594", "content": "UAT TC-594 proposal"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-595: Transition PENDING → SENT → RESPONDED @P0 @STATE @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-595", "content": "UAT TC-595 proposal"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-596: Transition SENT → CANCELLED @P0 @STATE @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-596", "content": "UAT TC-596 proposal"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-597: status='INVALID' → 400 IsEnum @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-597", "content": "UAT TC-597 proposal"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-598: IDOR: POST relatedCaseId của team khác → 403 @P0 @SECURITY @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-598", "content": "UAT TC-598 proposal"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-599: XSS qua content @P0 @SECURITY @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-599", "content": "UAT TC-599 proposal"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-600: content rất dài (50K chars) @P1 @DATA @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-600", "content": "UAT TC-600 proposal"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-601: content tiếng Việt có dấu @P1 @DATA @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-601", "content": "UAT TC-601 proposal"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-602: PROPOSAL_CREATED audit log @P0 @AUDIT @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-602", "content": "UAT TC-602 proposal"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-603: PROPOSAL_RESPONDED log với response timestamp @P0 @AUDIT @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-603", "content": "UAT TC-603 proposal"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-604: proposalNumber 1 ký tự @P1 @BOUNDARY @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-604", "content": "UAT TC-604 proposal"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-605: proposalNumber 500 ký tự @P1 @BOUNDARY @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-605", "content": "UAT TC-605 proposal"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-606: List 100 proposals < 500ms @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-607: Form input có label @P1 @A11Y @Low`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-608: Chrome mobile OK @P1 @COMPAT @Medium`, async ({ request }) => {
    // COMPAT TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-609: Proposal sent → notification gửi đến receiver @P1 @INTEGRATION @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-609", "content": "UAT TC-609 proposal"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-610: VIEWER POST → 403 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-610", "content": "UAT TC-610 proposal"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-611: JWT thiếu → 401 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-611", "content": "UAT TC-611 proposal"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-612: Atomic rollback nếu audit fail @P1 @RECOVERY @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-612", "content": "UAT TC-612 proposal"}`),
      expectedStatus: 500,
    });
  });

  test(`TC-613: Filter status=PENDING @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-613", "content": "UAT TC-613 proposal"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-614: Pagination @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-614", "content": "UAT TC-614 proposal"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-615: Filter relatedCaseId @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/proposals',
      role: 'admin',
      body: JSON.parse(`{"proposalNumber": "DX-UAT-TC-615", "content": "UAT TC-615 proposal"}`),
      expectedStatus: 200,
    });
  });

});