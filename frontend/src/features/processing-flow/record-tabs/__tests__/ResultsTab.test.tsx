import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ResultsTab } from '../ResultsTab';
import { processingRecordApi } from '../api';
import { processingFlow as L, errorText } from '@/locales/processingFlow.vi';
import { apiError } from '../../__tests__/fixtures';
import { ALL_STEP_PERMISSIONS, book, opinion, party, recFlow, recStep, report } from './fixtures';

vi.mock('../api', () => ({
  processingRecordApi: {
    get: vi.fn(),
    results: vi.fn(),
    submitReport: vi.fn(),
    editReport: vi.fn(),
    withdrawReport: vi.fn(),
    addOpinion: vi.fn(),
    withdrawOpinion: vi.fn(),
    decide: vi.fn(),
  },
}));
vi.mock('../useCurrentUserId', () => ({ useCurrentUserId: () => 'u7' }));
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

const api = vi.mocked(processingRecordApi);
const R = L.recordTabs;
const KEY = expect.stringMatching(/^[A-Za-z0-9._:-]{8,100}$/);

function renderTab(kind: 'PETITION' | 'INCIDENT' | 'CASE' = 'PETITION') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ResultsTab kind={kind} recordId="r1" />
    </QueryClientProvider>,
  );
}

const OPEN = (over = {}) => recStep({ stepKey: 'b', name: 'Xác minh', ...over });

beforeEach(() => {
  vi.resetAllMocks();
  held.value = ALL_STEP_PERMISSIONS;
  api.get.mockResolvedValue(recFlow({}, [OPEN()]));
  api.results.mockResolvedValue(book());
});

describe('the steps', () => {
  it('lists them newest activity first, opens the ones being worked and leaves the others closed', async () => {
    api.get.mockResolvedValue(
      recFlow({}, [
        recStep({ stepKey: 'a', name: 'Tiếp nhận', status: 'DONE', doneAt: '2026-12-03T03:00:00.000Z' }),
        recStep({ stepKey: 'b', name: 'Xác minh', status: 'OPEN', latestReport: { kind: 'PROGRESS', summary: 'x', at: '2026-12-10T01:00:00.000Z', revision: 1 } }),
        recStep({ stepKey: 'c', name: 'Kiểm tra', status: 'WAITING_ANCHOR', startAt: null, dueAt: null, regulatoryDueAt: null }),
      ]),
    );
    renderTab();
    await screen.findByTestId('results-step-b');
    const order = screen.getAllByTestId(/^results-step-[abc]$/).map((el) => el.getAttribute('data-testid'));
    expect(order).toEqual(['results-step-b', 'results-step-a', 'results-step-c']);
    expect(screen.getByTestId('results-step-b-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('results-step-a-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('results-step-b-status')).toHaveTextContent(R.stepStatus.OPEN);
    // A closed step reads nothing; opening a step that has not begun explains why there is nothing.
    expect(api.results).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('results-step-c-toggle'));
    expect(screen.getByTestId('results-step-c-body')).toHaveTextContent(R.results.notYet);
    expect(api.results).toHaveBeenCalledTimes(1);
  });

  it('shows the record has no flow instead of a book', async () => {
    api.get.mockRejectedValue(apiError(404, 'RECORD_FLOW_NOT_FOUND'));
    renderTab();
    expect(await screen.findByTestId('results-no-flow')).toBeInTheDocument();
  });
});

describe('the reports of a step', () => {
  it('shows the fields, the proposal with its Vietnamese label, the grounds, the documents, the author and the time', async () => {
    api.results.mockResolvedValue(
      book([
        report({
          id: 'r-full',
          kind: 'RESULT',
          doneWork: 'Đã xác minh xong.',
          findings: 'Có dấu hiệu chiếm đoạt.',
          difficulties: 'Chờ sao kê.',
          proposalKind: 'TRANSFER_TO_INCIDENT',
          proposalContent: 'Đề nghị chuyển vụ việc.',
          proposalBasis: 'Đ.147 BLTTHS',
          documents: [{ type: 'Công văn', number: '118/BC', date: '2026-12-15' }],
          answered: true,
        }),
      ]),
    );
    renderTab();
    const card = await screen.findByTestId('report-r-full');
    expect(card).toHaveTextContent('Đã xác minh xong.');
    expect(card).toHaveTextContent('Có dấu hiệu chiếm đoạt.');
    expect(card).toHaveTextContent('Chờ sao kê.');
    expect(card).toHaveTextContent('Chuyển thành vụ việc');
    expect(card).toHaveTextContent('Đ.147 BLTTHS');
    expect(card).toHaveTextContent('Công văn · số 118/BC · ngày 15/12/2026');
    expect(card).toHaveTextContent('Trần B');
    expect(card).toHaveTextContent('Báo cáo kết quả');
    expect(card).toHaveTextContent('05/12/2026');
  });

  it('greys and marks a withdrawn and a replaced report, with no buttons; an answered report has none either', async () => {
    api.results.mockResolvedValue(
      book([
        report({ id: 'old', kind: 'RESULT', supersededAt: '2026-12-08T00:00:00.000Z' }),
        report({ id: 'gone', withdrawnAt: '2026-12-09T00:00:00.000Z' }),
        report({ id: 'answered', answered: true }),
        report({ id: 'mine' }),
        report({ id: 'theirs', authorId: 'u9', authorName: 'Phạm D' }),
      ]),
    );
    renderTab();
    await screen.findByTestId('report-mine');
    expect(screen.getByTestId('report-old')).toHaveAttribute('data-dead', 'true');
    expect(screen.getByTestId('report-old-superseded')).toBeInTheDocument();
    expect(screen.getByTestId('report-gone')).toHaveAttribute('data-dead', 'true');
    expect(screen.getByTestId('report-gone-withdrawn')).toBeInTheDocument();
    for (const id of ['old', 'gone', 'answered', 'theirs']) {
      expect(screen.queryByTestId(`report-${id}-edit`)).toBeNull();
      expect(screen.queryByTestId(`report-${id}-withdraw`)).toBeNull();
    }
    expect(screen.getByTestId('report-answered-answered')).toBeInTheDocument();
    expect(screen.getByTestId('report-mine-edit')).toBeInTheDocument();
    expect(screen.getByTestId('report-mine-withdraw')).toBeInTheDocument();
  });

  it('"Rút lại" sends withdraw with the revision and a key; "Sửa" sends the corrected fields without a kind', async () => {
    api.results.mockResolvedValue(book([report({ id: 'mine', findings: 'Cũ', documents: [{ type: 'Công văn', number: '1', date: '' }] })]));
    api.editReport.mockResolvedValue(recFlow({ revision: 6 }, [OPEN()]));
    api.withdrawReport.mockResolvedValue(recFlow({ revision: 7 }, [OPEN()]));
    renderTab();
    fireEvent.click(await screen.findByTestId('report-mine-edit'));
    const form = screen.getByTestId('report-edit-form');
    expect(within(form).getByTestId('report-done-work')).toHaveValue('Lấy lời khai người tố giác.');
    fireEvent.change(within(form).getByTestId('report-findings'), { target: { value: 'Mới' } });
    fireEvent.click(within(form).getByTestId('report-doc-0-remove'));
    fireEvent.click(within(form).getByTestId('report-submit'));
    await waitFor(() =>
      expect(api.editReport).toHaveBeenCalledWith('PETITION', 'r1', 'b', 'mine', {
        expectedRevision: 5,
        idempotencyKey: KEY,
        doneWork: 'Lấy lời khai người tố giác.',
        findings: 'Mới',
        documents: [],
      }),
    );
    await waitFor(() => expect(screen.queryByTestId('report-edit-form')).toBeNull());
    fireEvent.click(await screen.findByTestId('report-mine-withdraw'));
    await waitFor(() => expect(api.withdrawReport).toHaveBeenCalledWith('PETITION', 'r1', 'b', 'mine', { expectedRevision: 6, idempotencyKey: KEY }));
  });

  it('a result waiting for the leader can be withdrawn by its author; a progress report cannot', async () => {
    api.get.mockResolvedValue(recFlow({}, [OPEN({ status: 'REPORTED', requiresApproval: true })]));
    api.results.mockResolvedValue(book([report({ id: 'res', kind: 'RESULT' }), report({ id: 'prog', kind: 'PROGRESS' })]));
    renderTab();
    await screen.findByTestId('report-res');
    expect(screen.getByTestId('report-res-withdraw')).toBeInTheDocument();
    expect(screen.queryByTestId('report-res-edit')).toBeNull();
    expect(screen.queryByTestId('report-prog-withdraw')).toBeNull();
  });
});

describe('writing a report', () => {
  it('only the work done is required: nothing is sent without it', async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId('report-submit'));
    expect(await screen.findByTestId('report-form-error')).toHaveTextContent(errorText('REPORT_TEXT_REQUIRED'));
    expect(api.submitReport).not.toHaveBeenCalled();
  });

  it('sends a progress report with only what was filled in, and clears the form when it went through', async () => {
    api.submitReport.mockResolvedValue(recFlow({ revision: 6 }, [OPEN()]));
    renderTab();
    fireEvent.change(await screen.findByTestId('report-done-work'), { target: { value: '  Lấy lời khai  ' } });
    fireEvent.click(screen.getByTestId('report-submit'));
    await waitFor(() =>
      expect(api.submitReport).toHaveBeenCalledWith('PETITION', 'r1', 'b', { expectedRevision: 5, idempotencyKey: KEY, kind: 'PROGRESS', doneWork: 'Lấy lời khai' }),
    );
    await waitFor(() => expect(screen.getByTestId('report-done-work')).toHaveValue(''));
    expect(await screen.findByTestId('results-message')).toHaveTextContent(R.done.reportSent);
  });

  it('sends a result with the proposal, the grounds and the documents (rows with nothing in them are dropped)', async () => {
    api.submitReport.mockResolvedValue(recFlow({ revision: 6 }, [OPEN()]));
    renderTab();
    fireEvent.change(await screen.findByTestId('report-kind'), { target: { value: 'RESULT' } });
    expect(screen.getByTestId('report-submit')).toHaveTextContent(R.results.form.submitResult);
    fireEvent.change(screen.getByTestId('report-done-work'), { target: { value: 'Xong' } });
    fireEvent.change(screen.getByTestId('report-proposal-kind'), { target: { value: 'REPLY' } });
    fireEvent.change(screen.getByTestId('report-proposal-content'), { target: { value: 'Trả lời đơn' } });
    fireEvent.change(screen.getByTestId('report-proposal-basis'), { target: { value: 'Đ.147' } });
    fireEvent.click(screen.getByTestId('report-doc-add'));
    fireEvent.change(screen.getByTestId('report-doc-0-type'), { target: { value: 'Công văn' } });
    fireEvent.change(screen.getByTestId('report-doc-0-number'), { target: { value: '12' } });
    fireEvent.change(screen.getByTestId('report-doc-0-date'), { target: { value: '2026-12-15' } });
    fireEvent.click(screen.getByTestId('report-doc-add'));
    fireEvent.click(screen.getByTestId('report-submit'));
    await waitFor(() =>
      expect(api.submitReport).toHaveBeenCalledWith('PETITION', 'r1', 'b', {
        expectedRevision: 5,
        idempotencyKey: KEY,
        kind: 'RESULT',
        doneWork: 'Xong',
        proposalKind: 'REPLY',
        proposalContent: 'Trả lời đơn',
        proposalBasis: 'Đ.147',
        documents: [{ type: 'Công văn', number: '12', date: '2026-12-15' }],
      }),
    );
  });

  it('offers the proposals of the kind of record, worded in Vietnamese; a step that needs approval says so on the button', async () => {
    api.get.mockResolvedValue(recFlow({}, [OPEN({ requiresApproval: true })]));
    renderTab('INCIDENT');
    const select = await screen.findByTestId('report-proposal-kind');
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual([R.results.form.proposalNone, 'Khởi tố vụ án', 'Không khởi tố', 'Tạm đình chỉ', 'Chuyển đơn vị khác', 'Nhập vào hồ sơ khác', 'Đề nghị gia hạn', 'Khác']);
    fireEvent.change(screen.getByTestId('report-kind'), { target: { value: 'RESULT' } });
    expect(screen.getByTestId('report-submit')).toHaveTextContent(R.results.form.submitResultApproval);
    expect(screen.getByTestId('report-result-hint')).toHaveTextContent(R.results.form.resultHintApproval);
  });

  it('keeps the typed text and locks everything after a revision conflict until the person takes the newer data', async () => {
    api.submitReport.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    renderTab();
    fireEvent.change(await screen.findByTestId('report-done-work'), { target: { value: 'Việc đã làm' } });
    api.get.mockResolvedValue(recFlow({ revision: 9 }, [OPEN()]));
    fireEvent.click(screen.getByTestId('report-submit'));
    expect(await screen.findByTestId('results-conflict')).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('report-done-work')).toHaveValue('Việc đã làm');
    expect(screen.getByTestId('report-submit')).toBeDisabled();
    fireEvent.click(screen.getByTestId('results-conflict-reload'));
    await waitFor(() => expect(screen.queryByTestId('results-conflict')).toBeNull());
    expect(screen.getByTestId('report-submit')).toBeEnabled();
    expect(screen.getByTestId('report-done-work')).toHaveValue('Việc đã làm');
  });

  it('shows the sentence of a refusal (not a party of the step)', async () => {
    api.submitReport.mockRejectedValue(apiError(403, 'NOT_A_PARTY_OF_STEP'));
    renderTab();
    fireEvent.change(await screen.findByTestId('report-done-work'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('report-submit'));
    expect(await screen.findByTestId('results-error')).toHaveTextContent(errorText('NOT_A_PARTY_OF_STEP'));
  });

  it('a person without `report` sees no report form; a step that is not OPEN has none either', async () => {
    held.value = ['read:ProcessingStep'];
    renderTab();
    await screen.findByTestId('book-b');
    expect(screen.queryByTestId('report-form')).toBeNull();
    expect(screen.queryByTestId('opinion-open')).toBeNull();
    expect(screen.queryByTestId('decision-form')).toBeNull();
  });

  it('no report form on a step waiting for the leader', async () => {
    api.get.mockResolvedValue(recFlow({}, [OPEN({ status: 'REPORTED', requiresApproval: true })]));
    renderTab();
    await screen.findByTestId('book-b');
    expect(screen.queryByTestId('report-form')).toBeNull();
  });
});

describe('opinions', () => {
  it('lists who said what, in which role, with the verdict and the revision of the report it was about; withdrawn ones are greyed', async () => {
    api.results.mockResolvedValue(
      book(
        [],
        [
          opinion({ id: 'o1', kind: 'APPROVAL', verdict: 'AGREE', content: 'Đồng ý đề xuất.', reportRevision: 2 }),
          opinion({ id: 'o2', kind: 'CHECK', verdict: 'REQUEST_REWORK', content: null, withdrawnAt: '2026-12-07T00:00:00.000Z' }),
        ],
      ),
    );
    renderTab();
    const first = await screen.findByTestId('opinion-o1');
    expect(first).toHaveTextContent('Lãnh đạo');
    expect(first).toHaveTextContent('Đồng ý');
    expect(first).toHaveTextContent('Phạm D');
    expect(first).toHaveTextContent(R.results.aboutReport(2));
    expect(screen.getByTestId('opinion-o2')).toHaveAttribute('data-dead', 'true');
    expect(screen.getByTestId('opinion-o2-withdrawn')).toBeInTheDocument();
    expect(screen.queryByTestId('opinion-o1-withdraw')).toBeNull();
  });

  it('offers the roles the step holds, needs words for a plain remark, and sends the kind', async () => {
    api.get.mockResolvedValue(
      recFlow({}, [
        OPEN({
          parties: [
            party({ id: 'pr-1', partyKind: 'TEAM', teamId: 't3', teamName: 'Tổ 3', role: 'MAIN', assigneeUserId: null }),
            party({ id: 'pr-2', partyKind: 'TEAM', teamId: 't5', teamName: 'Tổ 5', role: 'CHECK', assigneeUserId: null }),
          ],
        }),
      ]),
    );
    api.addOpinion.mockResolvedValue(recFlow({ revision: 6 }, [OPEN()]));
    renderTab();
    fireEvent.click(await screen.findByTestId('opinion-open'));
    const kinds = within(screen.getByTestId('opinion-kind')).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(kinds).toEqual(['SUPERVISOR', 'CHECK']);
    fireEvent.click(screen.getByTestId('opinion-submit'));
    expect(await screen.findByTestId('opinion-form-error')).toHaveTextContent(errorText('REPORT_TEXT_REQUIRED'));
    fireEvent.change(screen.getByTestId('opinion-content'), { target: { value: 'Đề nghị bổ sung' } });
    fireEvent.click(screen.getByTestId('opinion-submit'));
    await waitFor(() => expect(api.addOpinion).toHaveBeenCalledWith('PETITION', 'r1', 'b', { expectedRevision: 5, idempotencyKey: KEY, kind: 'SUPERVISOR', content: 'Đề nghị bổ sung' }));
  });

  it('a check can pass a result with no words', async () => {
    api.get.mockResolvedValue(recFlow({}, [OPEN({ parties: [party({ id: 'pr-3', partyKind: 'TEAM', teamId: 't5', teamName: 'Tổ 5', role: 'CHECK', assigneeUserId: null })] })]));
    api.addOpinion.mockResolvedValue(recFlow({ revision: 6 }, [OPEN()]));
    renderTab();
    fireEvent.click(await screen.findByTestId('opinion-open'));
    fireEvent.change(screen.getByTestId('opinion-verdict'), { target: { value: 'PASS' } });
    fireEvent.click(screen.getByTestId('opinion-submit'));
    await waitFor(() => expect(api.addOpinion).toHaveBeenCalledWith('PETITION', 'r1', 'b', { expectedRevision: 5, idempotencyKey: KEY, kind: 'CHECK', verdict: 'PASS' }));
  });

  it('an author takes their own opinion back', async () => {
    api.results.mockResolvedValue(book([], [opinion({ id: 'mine', authorId: 'u7' }), opinion({ id: 'theirs', authorId: 'u9' })]));
    api.withdrawOpinion.mockResolvedValue(recFlow({ revision: 6 }, [OPEN()]));
    renderTab();
    fireEvent.click(await screen.findByTestId('opinion-mine-withdraw'));
    expect(screen.queryByTestId('opinion-theirs-withdraw')).toBeNull();
    await waitFor(() => expect(api.withdrawOpinion).toHaveBeenCalledWith('PETITION', 'r1', 'b', 'mine', { expectedRevision: 5, idempotencyKey: KEY }));
  });
});

describe('the leader decision', () => {
  beforeEach(() => {
    api.get.mockResolvedValue(recFlow({}, [OPEN({ status: 'REPORTED', requiresApproval: true })]));
    api.decide.mockResolvedValue(recFlow({ revision: 6 }, [OPEN({ status: 'DONE', doneAt: '2026-12-10T00:00:00.000Z' })]));
  });

  it('is offered to a person with `approve` on a step waiting for the leader, and AGREE needs no words', async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId('decision-agree'));
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith('PETITION', 'r1', 'b', { expectedRevision: 5, idempotencyKey: KEY, verdict: 'AGREE' }));
  });

  it('DISAGREE and "Chỉ đạo khác" require words: nothing is sent without them', async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId('decision-disagree'));
    expect(await screen.findByTestId('decision-error')).toHaveTextContent(errorText('REPORT_TEXT_REQUIRED'));
    fireEvent.click(screen.getByTestId('decision-other'));
    expect(api.decide).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('decision-content'), { target: { value: 'Bổ sung sao kê' } });
    fireEvent.click(screen.getByTestId('decision-disagree'));
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith('PETITION', 'r1', 'b', { expectedRevision: 5, idempotencyKey: KEY, verdict: 'DISAGREE', content: 'Bổ sung sao kê' }));
  });

  it('is not offered without `approve`, nor on a step that is not waiting for the leader', async () => {
    held.value = ALL_STEP_PERMISSIONS.filter((p) => !p.startsWith('approve'));
    renderTab();
    await screen.findByTestId('book-b');
    expect(screen.queryByTestId('decision-form')).toBeNull();
  });

  it('is not offered on an open step', async () => {
    api.get.mockResolvedValue(recFlow({}, [OPEN()]));
    renderTab();
    await screen.findByTestId('book-b');
    expect(screen.queryByTestId('decision-form')).toBeNull();
  });
});

describe('"Kết luận chung"', () => {
  const doneFlow = () =>
    recFlow({}, [
      recStep({ stepKey: 'k', name: 'Xác minh', status: 'DONE', setsRecordDeadline: true, doneAt: '2026-12-10T00:00:00.000Z' }),
      recStep({ stepKey: 'z', name: 'Kiểm tra', status: 'OPEN' }),
    ]);

  it('shows the newest result report (work done and proposal, read-only) once the step that sets the deadline is DONE', async () => {
    api.get.mockResolvedValue(doneFlow());
    api.results.mockImplementation(async (_k, _id, stepKey) =>
      stepKey === 'k'
        ? book([
            report({ id: 'r1', kind: 'RESULT', doneWork: 'Bản cũ', supersededAt: '2026-12-08T00:00:00.000Z' }),
            report({ id: 'r2', kind: 'RESULT', doneWork: 'Bản cuối cùng', proposalKind: 'REPLY', proposalContent: 'Trả lời đơn' }),
            report({ id: 'r3', kind: 'PROGRESS', doneWork: 'Chỉ tiến độ' }),
            report({ id: 'r4', kind: 'RESULT', doneWork: 'Đã rút', withdrawnAt: '2026-12-11T00:00:00.000Z' }),
          ])
        : book(),
    );
    renderTab();
    const block = await screen.findByTestId('results-conclusion');
    await waitFor(() => expect(block).toHaveTextContent('Bản cuối cùng'));
    expect(block).toHaveTextContent('Trả lời đơn');
    expect(block).not.toHaveTextContent('Bản cũ');
    expect(block).not.toHaveTextContent('Chỉ tiến độ');
    expect(block).not.toHaveTextContent('Đã rút');
    expect(block).toHaveTextContent(R.results.conclusion.fromStep(1, 'Xác minh'));
    expect(block.querySelector('button')).toBeNull();
  });

  it('says there is no result report when the step was finished without one', async () => {
    api.get.mockResolvedValue(doneFlow());
    renderTab();
    expect(await screen.findByTestId('results-conclusion-none')).toBeInTheDocument();
  });

  it('is absent while the step that sets the deadline is still being worked', async () => {
    api.get.mockResolvedValue(recFlow({}, [recStep({ stepKey: 'k', status: 'OPEN', setsRecordDeadline: true })]));
    renderTab();
    await screen.findByTestId('results-step-k');
    expect(screen.queryByTestId('results-conclusion')).toBeNull();
  });
});

describe('the role of the person on the step (viewer)', () => {
  const VIEWER = { canReport: false, opinionKinds: [], canApprove: false, memberOfPartyIds: [] };
  const parties = [party({ id: 'm', role: 'MAIN' }), party({ id: 'c', role: 'CHECK', teamId: 't4' })];

  it('a person with every permission and no part in the step is offered no report form and no opinion', async () => {
    api.get.mockResolvedValue(recFlow({}, [OPEN({ parties, viewer: VIEWER })]));
    renderTab();
    await screen.findByTestId('book-b');
    expect(screen.queryByTestId('report-form')).toBeNull();
    expect(screen.queryByTestId('opinion-open')).toBeNull();
  });

  it('a member of the unit that checks is offered only the opinion of a check, and no report form', async () => {
    api.get.mockResolvedValue(recFlow({}, [OPEN({ parties, viewer: { ...VIEWER, opinionKinds: ['CHECK'] } })]));
    renderTab();
    fireEvent.click(await screen.findByTestId('opinion-open'));
    expect(screen.queryByTestId('report-form')).toBeNull();
    // One role only: there is nothing to choose, the kind is not asked.
    const kind = screen.queryByTestId('opinion-kind');
    if (kind) expect(within(kind).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['CHECK']);
  });

  it('a member of the unit that works the step is offered the report form', async () => {
    api.get.mockResolvedValue(recFlow({}, [OPEN({ parties, viewer: { ...VIEWER, canReport: true } })]));
    renderTab();
    expect(await screen.findByTestId('report-form')).toBeInTheDocument();
    expect(screen.queryByTestId('opinion-open')).toBeNull();
  });

  it('the decision is offered only when the role allows it too; the author of a report who left the unit gets no buttons on it', async () => {
    api.get.mockResolvedValue(recFlow({}, [OPEN({ status: 'REPORTED', requiresApproval: true, parties, viewer: VIEWER })]));
    api.results.mockResolvedValue(book([report({ id: 'mine', kind: 'RESULT', authorId: 'u7' })]));
    renderTab();
    await screen.findByTestId('report-mine');
    expect(screen.queryByTestId('decision-form')).toBeNull();
    expect(screen.queryByTestId('report-mine-withdraw')).toBeNull();
  });

  it('the decision is offered when the permission and the role both allow it', async () => {
    api.get.mockResolvedValue(recFlow({}, [OPEN({ status: 'REPORTED', requiresApproval: true, parties, viewer: { ...VIEWER, canApprove: true } })]));
    renderTab();
    expect(await screen.findByTestId('decision-form')).toBeInTheDocument();
  });

  it('an answer without viewer (an older server) offers what the permissions allow, as before', async () => {
    api.get.mockResolvedValue(recFlow({}, [OPEN({ parties })]));
    renderTab();
    expect(await screen.findByTestId('report-form')).toBeInTheDocument();
    // The opinion is offered (the button, or the form a draft of an earlier visit left open).
    expect(await screen.findByTestId(/^opinion-(open|form)$/)).toBeInTheDocument();
  });
});
