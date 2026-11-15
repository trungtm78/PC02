import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DelegationPage from '../DelegationPage';
import { delegationApi, type DelegationDto, type DelegationsDto } from '../api';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { apiError } from '../../__tests__/fixtures';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  delegationApi: { mine: vi.fn(), candidates: vi.fn(), create: vi.fn(), revoke: vi.fn() },
}));

const api = vi.mocked(delegationApi);
const D = L.delegation;

const row = (over: Partial<DelegationDto> = {}): DelegationDto => ({
  id: 'd1',
  fromUserId: 'me',
  fromName: 'Nguyễn A',
  toUserId: 'u2',
  toName: 'Trần B',
  validFrom: '2026-12-07T17:00:00.000Z', // 8 December in Vietnam
  validTo: '2026-12-10T16:59:59.999Z', // 10 December in Vietnam
  note: 'Nghỉ phép',
  state: 'IN_FORCE',
  createdById: 'me',
  createdAt: '2026-12-01T00:00:00.000Z',
  revokedAt: null,
  canRevoke: true,
  ...over,
});
const lists = (given: DelegationDto[] = [], received: DelegationDto[] = []): DelegationsDto => ({ asOf: '2026-12-09T05:00:00.000Z', given, received });

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DelegationPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  api.mine.mockResolvedValue(lists([row()], [row({ id: 'd2', fromUserId: 'u3', fromName: 'Lê C', toUserId: 'me', state: 'UPCOMING', canRevoke: false, note: null })]));
  api.candidates.mockResolvedValue([{ userId: 'u2', name: 'Trần B' }, { userId: 'u4', name: 'Phạm D' }]);
});

describe('the two lists', () => {
  it('shows what I gave and what I received, with the days in Vietnam and a chip for the state', async () => {
    renderPage();
    const given = await screen.findByTestId('delegation-d1');
    expect(given).toHaveTextContent('Uỷ quyền cho Trần B');
    expect(given).toHaveTextContent('08/12/2026 – 10/12/2026');
    expect(given).toHaveTextContent('Nghỉ phép');
    expect(screen.getByTestId('delegation-d1-state')).toHaveTextContent('Đang hiệu lực');
    const received = screen.getByTestId('delegation-d2');
    expect(received).toHaveTextContent('Lê C uỷ quyền');
    expect(screen.getByTestId('delegation-d2-state')).toHaveTextContent('Sắp tới');
    // What I received is not mine to revoke.
    expect(screen.queryByTestId('delegation-d2-revoke')).toBeNull();
  });

  it('says each list is empty in its own words', async () => {
    api.mine.mockResolvedValue(lists());
    renderPage();
    expect(await screen.findByTestId('delegation-empty-given')).toHaveTextContent(D.emptyGiven);
    expect(screen.getByTestId('delegation-empty-received')).toHaveTextContent(D.emptyReceived);
  });

  it('words every state the server knows', () => {
    expect(Object.keys(D.states).sort()).toEqual(['ENDED', 'IN_FORCE', 'REVOKED', 'UPCOMING']);
  });
});

describe('loading, failing, forbidden, switched off', () => {
  it('says it is loading before the answer, and shows no empty list meanwhile', () => {
    api.mine.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('delegation-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('delegation-empty-given')).toBeNull();
  });

  it('a failed load is an error with a retry, never an empty list', async () => {
    api.mine.mockRejectedValueOnce(apiError(500, null));
    renderPage();
    expect(await screen.findByTestId('delegation-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('delegation-empty-given')).toBeNull();
    expect(screen.queryByTestId('delegation-create')).toBeNull();
    fireEvent.click(screen.getByTestId('delegation-retry'));
    expect(await screen.findByTestId('delegation-d1')).toBeInTheDocument();
  });

  it('without the permission it says so', async () => {
    api.mine.mockRejectedValue(apiError(403, null));
    renderPage();
    expect(await screen.findByTestId('delegation-forbidden')).toHaveTextContent(D.forbidden);
  });

  it('while the switch is off (404 with no code of the contract) it shows the feature-off state', async () => {
    api.mine.mockRejectedValue(apiError(404, null));
    renderPage();
    expect(await screen.findByTestId('processing-flow-disabled')).toBeInTheDocument();
    expect(screen.queryByTestId('delegation-load-error')).toBeNull();
  });
});

describe('creating', () => {
  it('offers only the teammates the server lists, and sends the person, the two days and the note', async () => {
    api.create.mockResolvedValue(row({ id: 'd9' }));
    renderPage();
    const person = (await screen.findByTestId('delegation-person')) as HTMLSelectElement;
    await waitFor(() => expect(Array.from(person.options).map((o) => o.textContent)).toEqual([D.create.choosePerson, 'Trần B', 'Phạm D']));
    fireEvent.change(person, { target: { value: 'u4' } });
    fireEvent.change(screen.getByTestId('delegation-from'), { target: { value: '2026-12-20' } });
    fireEvent.change(screen.getByTestId('delegation-to'), { target: { value: '2026-12-22' } });
    fireEvent.change(screen.getByTestId('delegation-note'), { target: { value: '  Đi công tác ' } });
    fireEvent.click(screen.getByTestId('delegation-submit'));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0][0]).toEqual({ toUserId: 'u4', validFrom: '2026-12-20', validTo: '2026-12-22', note: 'Đi công tác' });
    // The list is asked again after the write.
    await waitFor(() => expect(api.mine).toHaveBeenCalledTimes(2));
  });

  it('does not call the server while the person or a day is missing', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('delegation-submit'));
    expect(await screen.findByTestId('delegation-form-error')).toHaveTextContent(D.create.incomplete);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('shows the sentence of the code the server refuses with', async () => {
    api.create.mockRejectedValue(apiError(409, 'DELEGATION_OVERLAP'));
    renderPage();
    fireEvent.change(await screen.findByTestId('delegation-person'), { target: { value: 'u2' } });
    await waitFor(() => expect((screen.getByTestId('delegation-person') as HTMLSelectElement).options).toHaveLength(3));
    fireEvent.change(screen.getByTestId('delegation-person'), { target: { value: 'u2' } });
    fireEvent.change(screen.getByTestId('delegation-to'), { target: { value: '2099-12-22' } });
    fireEvent.click(screen.getByTestId('delegation-submit'));
    expect(await screen.findByTestId('delegation-form-error')).toHaveTextContent(L.errors.DELEGATION_OVERLAP);
  });

  it('a failed load of the teammates is said, apart from a unit with no teammate', async () => {
    api.candidates.mockRejectedValue(apiError(500, null));
    renderPage();
    expect(await screen.findByTestId('delegation-candidates-error')).toHaveTextContent(D.create.candidatesFailed);
    expect(screen.queryByTestId('delegation-no-candidates')).toBeNull();
  });

  it('a unit with no teammate says so', async () => {
    api.candidates.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId('delegation-no-candidates')).toHaveTextContent(D.create.noCandidates);
  });
});

describe('revoking', () => {
  it('asks in the row before it revokes; "Thôi" leaves it alone', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('delegation-d1-revoke'));
    expect(screen.getByTestId('delegation-d1-confirm')).toHaveTextContent(D.revokeConfirm('Trần B'));
    expect(api.revoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('delegation-d1-revoke-no'));
    expect(screen.queryByTestId('delegation-d1-confirm')).toBeNull();
    expect(api.revoke).not.toHaveBeenCalled();
  });

  it('revokes after the confirmation and loads the list again', async () => {
    api.revoke.mockResolvedValue(row({ state: 'REVOKED', canRevoke: false }));
    renderPage();
    fireEvent.click(await screen.findByTestId('delegation-d1-revoke'));
    api.mine.mockResolvedValue(lists([row({ state: 'REVOKED', canRevoke: false })]));
    fireEvent.click(screen.getByTestId('delegation-d1-revoke-yes'));
    await waitFor(() => expect(api.revoke.mock.calls[0][0]).toBe('d1'));
    await waitFor(() => expect(screen.getByTestId('delegation-d1-state')).toHaveTextContent('Đã thu hồi'));
    expect(screen.queryByTestId('delegation-d1-revoke')).toBeNull();
  });

  it('shows why a revocation was refused', async () => {
    api.revoke.mockRejectedValue(apiError(409, 'DELEGATION_ALREADY_REVOKED'));
    renderPage();
    fireEvent.click(await screen.findByTestId('delegation-d1-revoke'));
    fireEvent.click(screen.getByTestId('delegation-d1-revoke-yes'));
    expect(await screen.findByTestId('delegation-revoke-error')).toHaveTextContent(L.errors.DELEGATION_ALREADY_REVOKED);
  });
});
