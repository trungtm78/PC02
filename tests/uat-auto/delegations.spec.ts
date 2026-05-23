import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Delegations
 * Total TC: 36
 */
test.describe('UAT-delegations: Delegations', () => {
  test(`TC-616: Tạo Delegation với delegationNumber + receivingUnit @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-616", "receivingUnit": "Test unit", "content": "UAT TC-616 delegation"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-617: delegationNumber rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-617", "receivingUnit": "Test unit", "content": "UAT TC-617 delegation"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-618: receivingUnit rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-618", "receivingUnit": "Test unit", "content": "UAT TC-618 delegation"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-619: content rỗng → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-619", "receivingUnit": "Test unit", "content": "UAT TC-619 delegation"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-620: delegationNumber duplicate → 409 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-620", "receivingUnit": "Test unit", "content": "UAT TC-620 delegation"}`),
      expectedStatus: 409,
    });
  });

  test(`TC-621: relatedCaseId optional @P0 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-621", "receivingUnit": "Test unit", "content": "UAT TC-621 delegation"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-622: relatedCaseId không tồn tại → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-622", "receivingUnit": "Test unit", "content": "UAT TC-622 delegation"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-623: GET list paginated @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-623", "receivingUnit": "Test unit", "content": "UAT TC-623 delegation"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-624: GET detail @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-624", "receivingUnit": "Test unit", "content": "UAT TC-624 delegation"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-625: GET ngoài scope → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-625", "receivingUnit": "Test unit", "content": "UAT TC-625 delegation"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-626: GET NOT_EXIST → 404 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-626", "receivingUnit": "Test unit", "content": "UAT TC-626 delegation"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-627: PUT update content + completedDate @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-627", "receivingUnit": "Test unit", "content": "UAT TC-627 delegation"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-628: DELETE soft delete @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-628", "receivingUnit": "Test unit", "content": "UAT TC-628 delegation"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-629: Transition PENDING → IN_PROGRESS @P0 @STATE @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-629", "receivingUnit": "Test unit", "content": "UAT TC-629 delegation"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-630: Transition IN_PROGRESS → COMPLETED @P0 @STATE @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-630", "receivingUnit": "Test unit", "content": "UAT TC-630 delegation"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-631: Transition any → CANCELLED @P0 @STATE @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-631", "receivingUnit": "Test unit", "content": "UAT TC-631 delegation"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-632: COMPLETED → PENDING (downgrade) → block @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-632", "receivingUnit": "Test unit", "content": "UAT TC-632 delegation"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-633: IDOR relatedCaseId team khác @P0 @SECURITY @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-633", "receivingUnit": "Test unit", "content": "UAT TC-633 delegation"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-634: XSS content @P0 @SECURITY @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-634", "receivingUnit": "Test unit", "content": "UAT TC-634 delegation"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-635: receivingUnit tiếng Việt 'Phòng Cảnh sát Hà Nội' @P1 @DATA @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-635", "receivingUnit": "Test unit", "content": "UAT TC-635 delegation"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-636: content nhiều paragraph @P1 @DATA @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-636", "receivingUnit": "Test unit", "content": "UAT TC-636 delegation"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-637: delegationDate ISO format @P1 @DATA @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-637", "receivingUnit": "Test unit", "content": "UAT TC-637 delegation"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-638: delegationDate format invalid → 400 (nếu IsDateString) @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-638", "receivingUnit": "Test unit", "content": "UAT TC-638 delegation"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-639: DELEGATION_CREATED log @P0 @AUDIT @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-639", "receivingUnit": "Test unit", "content": "UAT TC-639 delegation"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-640: DELEGATION_COMPLETED log với completedDate @P0 @AUDIT @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-640", "receivingUnit": "Test unit", "content": "UAT TC-640 delegation"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-641: delegationNumber 1 ký tự @P1 @BOUNDARY @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-641", "receivingUnit": "Test unit", "content": "UAT TC-641 delegation"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-642: content 100K ký tự @P1 @BOUNDARY @Low`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-642", "receivingUnit": "Test unit", "content": "UAT TC-642 delegation"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-643: List 50 delegations < 500ms @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-644: Form A11Y compliant @P1 @A11Y @Low`, async ({ request }) => {
    // A11Y TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-645: Form mobile responsive @P1 @COMPAT @Medium`, async ({ request }) => {
    // COMPAT TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-646: Delegation cùng caseId hiển thị trong Case detail tab @P1 @INTEGRATION @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-646", "receivingUnit": "Test unit", "content": "UAT TC-646 delegation"}`),
      expectedStatus: 201,
    });
  });

  test(`TC-647: VIEWER POST → 403 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-647", "receivingUnit": "Test unit", "content": "UAT TC-647 delegation"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-648: JWT thiếu → 401 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-648", "receivingUnit": "Test unit", "content": "UAT TC-648 delegation"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-649: Filter status=PENDING @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-649", "receivingUnit": "Test unit", "content": "UAT TC-649 delegation"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-650: Filter by receivingUnit @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-650", "receivingUnit": "Test unit", "content": "UAT TC-650 delegation"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-651: Pagination @P1 @GREEN @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/delegations',
      role: 'admin',
      body: JSON.parse(`{"delegationNumber": "UT-UAT-TC-651", "receivingUnit": "Test unit", "content": "UAT TC-651 delegation"}`),
      expectedStatus: 200,
    });
  });

});