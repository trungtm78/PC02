import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssignmentTab } from '../AssignmentTab';
import type { StepViewerDto } from '../types';
import { RecordNotices } from '../RecordNotices';
import { processingRecordApi } from '../api';
import { processingFlow as L, errorText } from '@/locales/processingFlow.vi';
import { apiError } from '../../__tests__/fixtures';
import { ALL_STEP_PERMISSIONS, party, recFlow, recStep } from './fixtures';

vi.mock('../api', () => ({
  processingRecordApi: {
    get: vi.fn(),
    apply: vi.fn(),
    reapply: vi.fn(),
    confirm: vi.fn(),
    accepted: vi.fn(),
    complete: vi.fn(),
    reopen: vi.fn(),
    skip: vi.fn(),
    unskip: vi.fn(),
    due: vi.fn(),
    extend: vi.fn(),
    assignParty: vi.fn(),
    candidates: vi.fn(),
  },
}));
const me = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('../useCurrentUserId', () => ({ useCurrentUserId: () => me.value }));
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

const api = vi.mocked(processingRecordApi);
const R = L.recordTabs;
const KEY = expect.stringMatching(/^[A-Za-z0-9._:-]{8,100}$/);

function renderTab() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AssignmentTab kind="PETITION" recordId="r1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  held.value = ALL_STEP_PERMISSIONS;
  me.value = null;
});

describe('a record with no flow yet', () => {
  beforeEach(() => {
    api.get.mockRejectedValue(apiError(404, 'RECORD_FLOW_NOT_FOUND'));
  });

  it('explains it and offers "Áp dụng quy trình" to the person who may assign', async () => {
    api.apply.mockResolvedValue(recFlow());
    renderTab();
    expect(await screen.findByTestId('assignment-no-flow')).toHaveTextContent(R.noFlow.title);
    fireEvent.click(screen.getByTestId('assignment-apply'));
    await waitFor(() => expect(api.apply).toHaveBeenCalledWith('PETITION', 'r1', { idempotencyKey: KEY }));
    // The answer is the whole flow: it is on screen without a second read.
    expect(await screen.findByTestId('assignment-steps')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('offers no button to a person without `assign`', async () => {
    held.value = ['read:ProcessingStep'];
    renderTab();
    expect(await screen.findByTestId('assignment-no-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('assignment-apply')).toBeNull();
    expect(screen.getByTestId('assignment-apply-denied')).toHaveTextContent(R.noFlow.noPermission);
  });

  it('shows the sentence of a refused apply (no matching flow)', async () => {
    api.apply.mockRejectedValue(apiError(409, 'NO_FLOW_FOR_RECORD'));
    renderTab();
    fireEvent.click(await screen.findByTestId('assignment-apply'));
    expect(await screen.findByTestId('assignment-error')).toHaveTextContent(errorText('NO_FLOW_FOR_RECORD'));
  });
});

describe('a flow that is only a proposal', () => {
  beforeEach(() => {
    api.get.mockResolvedValue(recFlow({ confirmed: false }));
  });

  it('shows the amber banner and confirms in one click with the revision it read', async () => {
    api.confirm.mockResolvedValue(recFlow({ confirmed: true, revision: 6 }));
    renderTab();
    const banner = await screen.findByTestId('assignment-proposal');
    expect(banner).toHaveTextContent(R.proposal.title);
    fireEvent.click(screen.getByTestId('assignment-confirm'));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledWith('PETITION', 'r1', { expectedRevision: 5, idempotencyKey: KEY }));
    await waitFor(() => expect(screen.queryByTestId('assignment-proposal')).toBeNull());
  });

  it('"Chọn lại quy trình" asks again without a flow id', async () => {
    api.reapply.mockResolvedValue(recFlow({ confirmed: false, revision: 6 }));
    renderTab();
    fireEvent.click(await screen.findByTestId('assignment-reapply'));
    await waitFor(() => expect(api.reapply).toHaveBeenCalledWith('PETITION', 'r1', { expectedRevision: 5, idempotencyKey: KEY }));
  });

  it('shows the banner but no buttons to a person without `assign`', async () => {
    held.value = ['read:ProcessingStep'];
    renderTab();
    expect(await screen.findByTestId('assignment-proposal')).toBeInTheDocument();
    expect(screen.queryByTestId('assignment-confirm')).toBeNull();
    expect(screen.queryByTestId('assignment-reapply')).toBeNull();
  });

  it('a confirmed flow shows no banner', async () => {
    api.get.mockResolvedValue(recFlow({ confirmed: true }));
    renderTab();
    await screen.findByTestId('assignment-steps');
    expect(screen.queryByTestId('assignment-proposal')).toBeNull();
  });
});

describe('the rows', () => {
  const flow = () =>
    recFlow({}, [
      recStep({ stepKey: 'a', name: 'Tiếp nhận', status: 'DONE', doneAt: '2026-12-03T03:00:00.000Z', completion: 'DONE_ON_TIME', band: 'NONE', remainingDays: null }),
      recStep({
        stepKey: 'b',
        name: 'Xác minh',
        band: 'RED',
        remainingDays: 1,
        setsRecordDeadline: true,
        provisional: true,
        upstreamReopened: true,
        internalDueAt: '2026-12-16T00:00:00.000Z',
        dueAt: '2026-12-16T00:00:00.000Z',
        extensionsUsed: 1,
        parties: [
          party({ id: 'pa-1', partyKind: 'TEAM', teamId: 't3', teamName: 'Tổ 3', role: 'MAIN', assigneeUserId: 'u7', assigneeName: 'Trần B' }),
          party({ id: 'pa-2', partyKind: 'TEAM', teamId: 't5', teamName: 'Tổ 5', role: 'COORDINATE', assigneeUserId: null }),
        ],
        latestReport: { kind: 'PROGRESS', summary: 'Đã lấy lời khai hai người làm chứng', at: '2026-12-05T01:00:00.000Z', revision: 1 },
        latestOpinion: { kind: 'SUPERVISOR', verdict: 'NOTE', at: '2026-12-06T01:00:00.000Z' },
      }),
      recStep({ stepKey: 'c', name: 'Kiểm tra', status: 'WAITING_ANCHOR', startAt: null, dueAt: null, regulatoryDueAt: null, greenFrom: null, yellowFrom: null, redFrom: null, band: 'NONE', remainingDays: null, anchor: 'PREVIOUS_STEP_DONE' }),
      recStep({ stepKey: 'd', name: 'Đã quá hạn', band: 'OVERDUE', remainingDays: -2 }),
      recStep({ stepKey: 'e', name: 'Chưa tới ngưỡng', band: 'NONE', remainingDays: 12 }),
      recStep({ stepKey: 'f', name: 'Lỗi hạn', band: 'NONE', remainingDays: null, dueAt: null, regulatoryDueAt: null, problem: 'ANCHOR_DATE_MISSING' }),
    ]);

  it('says the colour with the days left, the overdue days, and "not yet at a threshold"', async () => {
    api.get.mockResolvedValue(flow());
    renderTab();
    expect(await screen.findByTestId('step-b-band')).toHaveTextContent('Đỏ · còn 1 ngày');
    expect(screen.getByTestId('step-b-band')).toHaveAttribute('data-tone', 'red');
    expect(screen.getByTestId('step-d-band')).toHaveTextContent('Quá hạn 2 ngày');
    expect(screen.getByTestId('step-d-band')).toHaveAttribute('data-tone', 'over');
    expect(screen.getByTestId('step-e-band')).toHaveTextContent(/Chưa tới ngưỡng/);
    expect(screen.getByTestId('step-a-band')).toHaveTextContent(/Xong 03\/12\/2026/);
    expect(screen.getByTestId('step-c-band')).toHaveTextContent(R.stepStatus.WAITING_ANCHOR);
    expect(screen.getByTestId('step-c-waiting')).toHaveTextContent(R.waitingForPrevious);
  });

  it('shows the units with their roles and the person named, the regulatory deadline and the own target', async () => {
    api.get.mockResolvedValue(flow());
    renderTab();
    const units = await screen.findByTestId('step-b-units');
    expect(units).toHaveTextContent('Tổ 3 · xử lý chính · Trần B');
    expect(units).toHaveTextContent('Tổ 5 · phối hợp');
    expect(screen.getByTestId('step-b-regulatory')).toHaveTextContent('20/12/2026');
    expect(screen.getByTestId('step-b-regulatory')).toHaveTextContent(R.extensionsUsed(1, 2));
    expect(screen.getByTestId('step-b-own')).toHaveTextContent('16/12/2026');
    expect(screen.getByTestId('step-e-own')).toHaveTextContent(R.ownTargetNone);
  });

  it('marks provisional deadlines, a reopened upstream step, the problem as a sentence, and the latest report and opinion', async () => {
    api.get.mockResolvedValue(flow());
    renderTab();
    expect(await screen.findByTestId('step-b-provisional')).toHaveTextContent(R.provisional);
    expect(screen.getByTestId('step-b-upstream')).toHaveTextContent(R.upstreamReopened);
    expect(screen.getByTestId('step-f-problem')).toHaveTextContent(errorText('ANCHOR_DATE_MISSING'));
    expect(screen.getByTestId('step-b-latest-report')).toHaveTextContent('Báo cáo tiến độ: Đã lấy lời khai hai người làm chứng');
    expect(screen.getByTestId('step-b-latest-opinion')).toHaveTextContent('Trưởng đơn vị xử lý: Ý kiến');
  });

  it('draws the Gantt chart from the real dates, labelled by step name, and shows the record deadline in the header', async () => {
    api.get.mockResolvedValue(flow());
    renderTab();
    expect(await screen.findByTestId('gantt')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-1')).toHaveTextContent('2. Xác minh');
    expect(screen.getByTestId('gantt-row-0')).toHaveTextContent('✔ 1. Tiếp nhận');
    expect(screen.getByTestId('gantt-provisional-1')).toBeInTheDocument();
    // A waiting step has no bar and says why instead of an error.
    expect(screen.getByTestId('gantt-problem-2')).toHaveTextContent(R.gantt.waiting);
    expect(screen.getByTestId('assignment-record-deadline')).toHaveTextContent('Hạn chung của hồ sơ: 20/12/2026');
    // The unit's own target is earlier than the regulatory one: the gap is drawn behind the bar.
    expect(screen.getByTestId('gantt-gap-1')).toBeInTheDocument();
  });

  it('while the record is suspended no colour is shown, only the pause sentence', async () => {
    api.get.mockResolvedValue(recFlow({ suspended: true, pausedSince: '2026-12-08T00:00:00.000Z' }, [recStep({ stepKey: 'b', band: 'NONE', remainingDays: null })]));
    renderTab();
    expect(await screen.findByTestId('step-b-band')).toHaveTextContent(R.suspended);
    expect(screen.getByTestId('step-b-band').textContent).not.toMatch(/Đỏ|Vàng|Xanh|Quá hạn|còn/);
    expect(screen.getByTestId('assignment-suspended')).toHaveTextContent(R.suspendedSince('08/12/2026'));
  });
});

describe('the actions', () => {
  const open = (over = {}) => recStep({ stepKey: 'b', name: 'Xác minh', ...over });

  it('shows a button only when the person holds the permission AND the step allows it', async () => {
    api.get.mockResolvedValue(
      recFlow({}, [
        open({ stepKey: 'open' }),
        open({ stepKey: 'approval', requiresApproval: true }),
        open({ stepKey: 'reported', status: 'REPORTED' }),
        open({ stepKey: 'done', status: 'DONE', doneAt: '2026-12-03T00:00:00.000Z' }),
        open({ stepKey: 'waiting', status: 'WAITING_ANCHOR', dueAt: null, regulatoryDueAt: null }),
        open({ stepKey: 'skipped', status: 'SKIPPED', skippedAt: '2026-12-02T00:00:00.000Z', dueAt: null }),
      ]),
    );
    renderTab();
    await screen.findByTestId('step-row-open');
    const has = (step: string, action: string) => screen.queryByTestId(`step-${step}-${action}`) !== null;
    expect(['complete', 'adjust', 'extend', 'skip', 'reopen', 'unskip'].filter((a) => has('open', a))).toEqual(['complete', 'adjust', 'extend', 'skip']);
    expect(['complete', 'adjust', 'extend', 'skip'].filter((a) => has('approval', a))).toEqual(['adjust', 'extend', 'skip']);
    expect(['complete', 'adjust', 'extend', 'skip'].filter((a) => has('reported', a))).toEqual(['adjust', 'extend']);
    expect(['complete', 'reopen', 'skip', 'unskip'].filter((a) => has('done', a))).toEqual(['reopen']);
    expect(['complete', 'adjust', 'extend', 'skip'].filter((a) => has('waiting', a))).toEqual(['skip']);
    expect(['skip', 'unskip'].filter((a) => has('skipped', a))).toEqual(['unskip']);
  });

  it('a person with only `read` sees no action button and no accepted-date form', async () => {
    held.value = ['read:ProcessingStep'];
    api.get.mockResolvedValue(recFlow({}, [open(), recStep({ stepKey: 'w', status: 'WAITING_ANCHOR', anchor: 'ACCEPTED', dueAt: null, regulatoryDueAt: null })]));
    renderTab();
    await screen.findByTestId('step-row-b');
    expect(screen.getByTestId('assignment-steps').querySelectorAll('button')).toHaveLength(0);
    expect(screen.queryByTestId('assignment-accepted-form')).toBeNull();
  });

  it('"Hoàn thành" sends complete with the revision of the flow and a fresh key, and puts the answer on screen', async () => {
    api.get.mockResolvedValue(recFlow({}, [open()]));
    api.complete.mockResolvedValue(recFlow({ revision: 6 }, [open({ status: 'DONE', doneAt: '2026-12-10T00:00:00.000Z' })]));
    renderTab();
    fireEvent.click(await screen.findByTestId('step-b-complete'));
    await waitFor(() => expect(api.complete).toHaveBeenCalledWith('PETITION', 'r1', 'b', { expectedRevision: 5, idempotencyKey: KEY }));
    expect(await screen.findByTestId('assignment-message')).toHaveTextContent(R.done.completed);
    expect(screen.getByTestId('step-b-band')).toHaveTextContent(/Xong 10\/12\/2026/);
  });

  it('"Bỏ qua" needs a reason: nothing is sent without one, then it sends skip with the reason', async () => {
    api.get.mockResolvedValue(recFlow({}, [open()]));
    api.skip.mockResolvedValue(recFlow({ revision: 6 }, [open({ status: 'SKIPPED', skippedAt: '2026-12-10T00:00:00.000Z' })]));
    renderTab();
    fireEvent.click(await screen.findByTestId('step-b-skip'));
    fireEvent.click(screen.getByTestId('step-panel-submit'));
    expect(await screen.findByTestId('assignment-error')).toHaveTextContent(errorText('STEP_REASON_REQUIRED'));
    expect(api.skip).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('step-panel-reason'), { target: { value: 'Không cần bước này' } });
    fireEvent.click(screen.getByTestId('step-panel-submit'));
    await waitFor(() => expect(api.skip).toHaveBeenCalledWith('PETITION', 'r1', 'b', { expectedRevision: 5, idempotencyKey: KEY, reason: 'Không cần bước này' }));
    await waitFor(() => expect(screen.queryByTestId('step-panel-skip')).toBeNull());
  });

  it('"Gia hạn" needs a reason and sends extend', async () => {
    api.get.mockResolvedValue(recFlow({}, [open()]));
    api.extend.mockResolvedValue(recFlow({ revision: 6 }, [open({ extensionsUsed: 1 })]));
    renderTab();
    fireEvent.click(await screen.findByTestId('step-b-extend'));
    expect(screen.getByTestId('step-panel-extend')).toHaveTextContent(R.panels.extend.hint(0, 2, '20/12/2026'));
    fireEvent.click(screen.getByTestId('step-panel-submit'));
    expect(await screen.findByTestId('assignment-error')).toHaveTextContent(errorText('STEP_REASON_REQUIRED'));
    fireEvent.change(screen.getByTestId('step-panel-reason'), { target: { value: 'QĐ 12/QĐ-VKS' } });
    fireEvent.click(screen.getByTestId('step-panel-submit'));
    await waitFor(() => expect(api.extend).toHaveBeenCalledWith('PETITION', 'r1', 'b', { expectedRevision: 5, idempotencyKey: KEY, reason: 'QĐ 12/QĐ-VKS' }));
  });

  it('"Chỉnh hạn" sends the date the person chose (default: the current deadline); "Về hạn quy định" sends null', async () => {
    api.get.mockResolvedValue(recFlow({}, [open({ internalDueAt: '2026-12-16T00:00:00.000Z', dueAt: '2026-12-16T00:00:00.000Z' })]));
    api.due.mockResolvedValue(recFlow({ revision: 6 }, [open()]));
    renderTab();
    fireEvent.click(await screen.findByTestId('step-b-adjust'));
    expect(screen.getByTestId('step-panel-date')).toHaveValue('2026-12-16');
    fireEvent.change(screen.getByTestId('step-panel-date'), { target: { value: '2026-12-15' } });
    fireEvent.click(screen.getByTestId('step-panel-submit'));
    await waitFor(() => expect(api.due).toHaveBeenCalledWith('PETITION', 'r1', 'b', { expectedRevision: 5, idempotencyKey: KEY, date: '2026-12-15' }));
  });

  it('"Về hạn quy định" takes the own target back with date null', async () => {
    api.get.mockResolvedValue(recFlow({}, [open({ internalDueAt: '2026-12-16T00:00:00.000Z', dueAt: '2026-12-16T00:00:00.000Z' })]));
    api.due.mockResolvedValue(recFlow({ revision: 6 }, [open()]));
    renderTab();
    fireEvent.click(await screen.findByTestId('step-b-back-to-regulatory'));
    await waitFor(() => expect(api.due).toHaveBeenCalledWith('PETITION', 'r1', 'b', { expectedRevision: 5, idempotencyKey: KEY, date: null }));
    await waitFor(() => expect(screen.queryByTestId('step-b-back-to-regulatory')).toBeNull());
  });

  it('"Mở lại" takes an optional reason: sent only when typed', async () => {
    api.get.mockResolvedValue(recFlow({}, [open({ stepKey: 'd', status: 'DONE', doneAt: '2026-12-03T00:00:00.000Z' })]));
    api.reopen.mockResolvedValue(recFlow({ revision: 6 }));
    renderTab();
    fireEvent.click(await screen.findByTestId('step-d-reopen'));
    fireEvent.click(screen.getByTestId('step-panel-submit'));
    await waitFor(() => expect(api.reopen).toHaveBeenCalledWith('PETITION', 'r1', 'd', { expectedRevision: 5, idempotencyKey: KEY }));
  });

  it('"Mở lại" with a reason sends it', async () => {
    api.get.mockResolvedValue(recFlow({}, [open({ stepKey: 'd', status: 'DONE', doneAt: '2026-12-03T00:00:00.000Z' })]));
    api.reopen.mockResolvedValue(recFlow({ revision: 6 }));
    renderTab();
    fireEvent.click(await screen.findByTestId('step-d-reopen'));
    fireEvent.change(screen.getByTestId('step-panel-reason'), { target: { value: 'Thiếu chứng cứ' } });
    fireEvent.click(screen.getByTestId('step-panel-submit'));
    await waitFor(() => expect(api.reopen).toHaveBeenCalledWith('PETITION', 'r1', 'd', { expectedRevision: 5, idempotencyKey: KEY, reason: 'Thiếu chứng cứ' }));
  });

  it('"Khôi phục bước" sends unskip at once', async () => {
    api.get.mockResolvedValue(recFlow({}, [open({ stepKey: 'k', status: 'SKIPPED', skippedAt: '2026-12-02T00:00:00.000Z', dueAt: null })]));
    api.unskip.mockResolvedValue(recFlow({ revision: 6 }));
    renderTab();
    fireEvent.click(await screen.findByTestId('step-k-unskip'));
    await waitFor(() => expect(api.unskip).toHaveBeenCalledWith('PETITION', 'r1', 'k', { expectedRevision: 5, idempotencyKey: KEY }));
  });

  it('asks the date of acceptance (default today) when a step waits for it, and sends it', async () => {
    api.get.mockResolvedValue(recFlow({}, [recStep({ stepKey: 'w', name: 'Thụ lý', status: 'WAITING_ANCHOR', anchor: 'ACCEPTED', dueAt: null, regulatoryDueAt: null })]));
    api.accepted.mockResolvedValue(recFlow({ revision: 6, acceptedAt: '2026-12-10T00:00:00.000Z' }));
    renderTab();
    const input = await screen.findByTestId('assignment-accepted-date');
    expect((input as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(input, { target: { value: '2026-12-10' } });
    fireEvent.click(screen.getByTestId('assignment-accepted-submit'));
    await waitFor(() => expect(api.accepted).toHaveBeenCalledWith('PETITION', 'r1', { expectedRevision: 5, idempotencyKey: KEY, date: '2026-12-10' }));
    await waitFor(() => expect(screen.queryByTestId('assignment-accepted-form')).toBeNull());
  });
});

describe('a conflict', () => {
  it('locks the screen after 409, keeps the typed text, reads the newer flow, and unlocks only when the person takes it', async () => {
    api.get.mockResolvedValueOnce(recFlow({}, [recStep({ stepKey: 'b' })]));
    api.extend.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    renderTab();
    fireEvent.click(await screen.findByTestId('step-b-extend'));
    fireEvent.change(screen.getByTestId('step-panel-reason'), { target: { value: 'QĐ 12' } });
    api.get.mockResolvedValueOnce(recFlow({ revision: 9 }, [recStep({ stepKey: 'b' })]));
    fireEvent.click(screen.getByTestId('step-panel-submit'));

    expect(await screen.findByTestId('assignment-conflict')).toHaveTextContent(L.conflict.title);
    // The refresh has been asked for; nothing may be written until the person takes it.
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('step-b-complete')).toBeDisabled();
    expect(screen.getByTestId('step-panel-submit')).toBeDisabled();
    expect(screen.getByTestId('step-panel-reason')).toHaveValue('QĐ 12');

    fireEvent.click(screen.getByTestId('assignment-conflict-reload'));
    await waitFor(() => expect(screen.queryByTestId('assignment-conflict')).toBeNull());
    expect(screen.getByTestId('step-b-complete')).toBeEnabled();
    expect(screen.queryByTestId('step-panel-extend')).toBeNull();
    // The next write carries the NEWER revision.
    api.complete.mockResolvedValue(recFlow({ revision: 10 }));
    fireEvent.click(screen.getByTestId('step-b-complete'));
    await waitFor(() => expect(api.complete).toHaveBeenCalledWith('PETITION', 'r1', 'b', { expectedRevision: 9, idempotencyKey: KEY }));
  });
});

describe('the idempotency key', () => {
  it('a retry of the same action after a lost answer reuses the key; after a refusal a new action gets a new one', async () => {
    api.get.mockResolvedValue(recFlow({}, [recStep({ stepKey: 'b' })]));
    api.complete.mockRejectedValueOnce({ isAxiosError: true }).mockRejectedValueOnce({ isAxiosError: true }).mockRejectedValueOnce(apiError(409, 'STEP_NOT_OPEN')).mockResolvedValue(recFlow({ revision: 6 }));
    renderTab();
    const click = async () => {
      fireEvent.click(await screen.findByTestId('step-b-complete'));
      await waitFor(() => expect(screen.getByTestId('step-b-complete')).toBeEnabled());
    };
    await click();
    await click();
    await click();
    const keys = api.complete.mock.calls.map((c) => (c[3] as { idempotencyKey: string }).idempotencyKey);
    expect(keys).toHaveLength(3);
    expect(keys[1]).toBe(keys[0]);
    // The second try ended in a refusal (the server answered): the next attempt is a new action.
    await click();
    const all = api.complete.mock.calls.map((c) => (c[3] as { idempotencyKey: string }).idempotencyKey);
    expect(all).toHaveLength(4);
    expect(all[3]).not.toBe(all[2]);
  });
});

describe('loading and failing', () => {
  it('shows a retry for a failed first read that is not "no flow"', async () => {
    api.get.mockRejectedValueOnce(apiError(500, 'INTERNAL')).mockResolvedValue(recFlow());
    renderTab();
    expect(await screen.findByTestId('assignment-load-error')).toBeInTheDocument();
    fireEvent.click(screen.getByText(L.common.retry));
    expect(await screen.findByTestId('assignment-steps')).toBeInTheDocument();
  });

  it('a 404 with no code (the switch is off on the server) says the feature is not turned on', async () => {
    api.get.mockRejectedValue(apiError(404, null));
    renderTab();
    expect(await screen.findByTestId('assignment-off')).toHaveTextContent(R.off);
  });
});

describe('the person who answers for a party', () => {
  const heads = [{ userId: 'u1', name: 'Lê A' }];
  const oneParty = (over: Parameters<typeof party>[0] = {}, step: Parameters<typeof recStep>[0] = {}) =>
    recFlow({}, [recStep({ stepKey: 'b', parties: [party({ id: 'pm', responsible: heads, ...over })], ...(viewer ? { viewer } : {}), ...step })]);
  /** What the server says of the person on the step: a member (or the head) of the unit of party `pm`. */
  let viewer: StepViewerDto | undefined;
  const memberOf = (isLeader: boolean) => {
    me.value = 'u7';
    viewer = { canReport: true, opinionKinds: [], canApprove: true, memberOfPartyIds: ['pm'], leaderOfPartyIds: isLeader ? ['pm'] : [] };
  };
  beforeEach(() => {
    viewer = undefined;
  });

  it('with nobody named, shows the heads of the unit as the ones who answer', async () => {
    api.get.mockResolvedValue(oneParty());
    renderTab();
    expect(await screen.findByTestId('party-pm-responsible')).toHaveTextContent(R.assignee.heads('Lê A'));
  });

  it('a person who may assign picks among the members the server lists, and the command carries the revision and a key', async () => {
    api.get.mockResolvedValue(oneParty());
    api.candidates.mockResolvedValue([
      { userId: 'u1', name: 'Lê A', isLeader: true },
      { userId: 'u7', name: 'Trần B', isLeader: false },
    ]);
    api.assignParty.mockResolvedValue(oneParty({ assigneeUserId: 'u7', assigneeName: 'Trần B', responsible: [{ userId: 'u7', name: 'Trần B' }] }));
    renderTab();
    fireEvent.click(await screen.findByTestId('party-pm-assign'));
    const select = await screen.findByTestId('assignee-select');
    expect(api.candidates).toHaveBeenCalledWith('PETITION', 'r1', 'b', 'pm');
    expect(select).toHaveTextContent(R.assignee.leader('Lê A'));
    // Nothing chosen: nothing is sent, and the reason is said.
    fireEvent.click(screen.getByTestId('assignee-submit'));
    expect(api.assignParty).not.toHaveBeenCalled();
    expect(screen.getByTestId('assignment-error')).toHaveTextContent(errorText('ASSIGNEE_NOT_ELIGIBLE'));
    fireEvent.change(select, { target: { value: 'u7' } });
    fireEvent.click(screen.getByTestId('assignee-submit'));
    await waitFor(() => expect(api.assignParty).toHaveBeenCalledWith('PETITION', 'r1', 'b', 'pm', { expectedRevision: 5, idempotencyKey: KEY, userId: 'u7' }));
    await waitFor(() => expect(screen.queryByTestId('assignee-panel')).toBeNull());
    expect(screen.getByTestId('party-pm')).toHaveTextContent('Tổ 3 · xử lý chính · Trần B');
    expect(screen.getByTestId('assignment-message')).toHaveTextContent(R.done.assigned);
  });

  it('a list of members that did not load says so and offers a retry, never an empty unit', async () => {
    api.get.mockResolvedValue(oneParty());
    api.candidates.mockRejectedValue(apiError(500, 'X'));
    renderTab();
    fireEvent.click(await screen.findByTestId('party-pm-assign'));
    expect(await screen.findByTestId('assignee-load-error')).toHaveTextContent(R.assignee.loadFailed);
    expect(screen.queryByTestId('assignee-empty')).toBeNull();
    expect(screen.getByTestId('assignee-submit')).toBeDisabled();
  });

  it('"Bỏ chỉ định" gives the party back to the heads of the unit', async () => {
    api.get.mockResolvedValue(oneParty({ assigneeUserId: 'u7', assigneeName: 'Trần B' }));
    api.assignParty.mockResolvedValue(oneParty());
    renderTab();
    fireEvent.click(await screen.findByTestId('party-pm-unassign'));
    await waitFor(() => expect(api.assignParty).toHaveBeenCalledWith('PETITION', 'r1', 'b', 'pm', { expectedRevision: 5, idempotencyKey: KEY, userId: null }));
    expect(await screen.findByTestId('party-pm-responsible')).toBeInTheDocument();
  });

  it('a member of the unit without `assign` is offered "Nhận việc" only, and takes the work themself', async () => {
    held.value = ['read:ProcessingStep'];
    memberOf(false);
    api.get.mockResolvedValue(oneParty());
    api.assignParty.mockResolvedValue(oneParty({ assigneeUserId: 'u7', assigneeName: 'Trần B' }));
    renderTab();
    fireEvent.click(await screen.findByTestId('party-pm-take'));
    expect(screen.queryByTestId('party-pm-assign')).toBeNull();
    await waitFor(() => expect(api.assignParty).toHaveBeenCalledWith('PETITION', 'r1', 'b', 'pm', { expectedRevision: 5, idempotencyKey: KEY, userId: 'u7' }));
    // What they took they can give back; they cannot take what a colleague holds.
    expect(await screen.findByTestId('party-pm-unassign')).toBeInTheDocument();
    expect(screen.queryByTestId('party-pm-take')).toBeNull();
  });

  it('a head of the unit names a member without `assign`; a stranger and a finished step are offered nothing', async () => {
    held.value = ['read:ProcessingStep'];
    memberOf(true);
    api.get.mockResolvedValue(
      recFlow({}, [
        recStep({ stepKey: 'b', viewer, parties: [party({ id: 'pm' }), party({ id: 'po', teamId: 't9', teamName: 'Tổ 9', role: 'COORDINATE' })] }),
        recStep({ stepKey: 'd', status: 'DONE', viewer: { ...viewer!, memberOfPartyIds: ['pd'], leaderOfPartyIds: ['pd'] }, parties: [party({ id: 'pd' })] }),
      ]),
    );
    renderTab();
    expect(await screen.findByTestId('party-pm-assign')).toBeInTheDocument();
    expect(screen.queryByTestId('party-po-assign')).toBeNull();
    expect(screen.queryByTestId('party-po-take')).toBeNull();
    expect(screen.queryByTestId('party-pd-assign')).toBeNull();
  });

  it('a conflict locks the assignment actions like every other action', async () => {
    api.get.mockResolvedValue(oneParty({ assigneeUserId: 'u7', assigneeName: 'Trần B' }));
    api.assignParty.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    renderTab();
    fireEvent.click(await screen.findByTestId('party-pm-unassign'));
    await waitFor(() => expect(screen.getByTestId('party-pm-unassign')).toBeDisabled());
    expect(screen.getByTestId('party-pm-assign')).toBeDisabled();
  });
});

describe('"Gia hạn" when no extension is left', () => {
  it('is not offered once every extension was used, nor on a step that allows none', async () => {
    api.get.mockResolvedValue(
      recFlow({}, [
        recStep({ stepKey: 'left', extensionsAllowed: 2, extensionsUsed: 1 }),
        recStep({ stepKey: 'used', extensionsAllowed: 2, extensionsUsed: 2 }),
        recStep({ stepKey: 'none', extensionsAllowed: 0, extensionsUsed: 0 }),
      ]),
    );
    renderTab();
    expect(await screen.findByTestId('step-left-extend')).toBeInTheDocument();
    expect(screen.queryByTestId('step-used-extend')).toBeNull();
    expect(screen.queryByTestId('step-none-extend')).toBeNull();
  });
});

describe('the sentence of a conflict on the record tabs', () => {
  it('says the typed text is kept, not lost', () => {
    render(<RecordNotices testPrefix="assignment" message={null} error={null} conflict refreshing={false} refreshFailed={false} onTakeNewer={() => undefined} />);
    const notice = screen.getByTestId('assignment-conflict');
    expect(notice).toHaveTextContent(L.conflict.bodyKeepsText);
    expect(notice).not.toHaveTextContent('sẽ mất');
    expect(L.conflict.bodyKeepsText).toContain('giữ lại');
  });
});

describe('an officer who may not read the list of users', () => {
  it('reads the names from the flow and never asks for the users of the office', async () => {
    held.value = ['read:ProcessingStep'];
    me.value = 'u7';
    api.get.mockResolvedValue(
      recFlow({}, [
        recStep({
          stepKey: 'b',
          viewer: { canReport: true, opinionKinds: [], canApprove: true, memberOfPartyIds: ['pm'], leaderOfPartyIds: [] },
          parties: [party({ id: 'pm' }), party({ id: 'pn', teamId: 't9', teamName: 'Tổ 9', role: 'CHECK', assigneeUserId: 'u2', assigneeName: 'Ngô C' })],
        }),
      ]),
    );
    renderTab();
    expect(await screen.findByTestId('party-pm-take')).toBeInTheDocument();
    expect(screen.getByTestId('party-pn')).toHaveTextContent('Ngô C');
    expect(screen.queryByTestId('party-pn-take')).toBeNull();
  });

  it('an answer without viewer offers "Nhận việc" to nobody (the server would have to be asked)', async () => {
    held.value = ['read:ProcessingStep'];
    me.value = 'u7';
    api.get.mockResolvedValue(recFlow({}, [recStep({ stepKey: 'b', parties: [party({ id: 'pm' })] })]));
    renderTab();
    await screen.findByTestId('party-pm');
    expect(screen.queryByTestId('party-pm-take')).toBeNull();
  });
});
