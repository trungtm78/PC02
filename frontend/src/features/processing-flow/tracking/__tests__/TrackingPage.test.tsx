import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import TrackingPage from '../TrackingPage';
import { trackingApi } from '../api';
import type { TrackingItemDto, TrackingItemsDto, TrackingSummaryDto } from '../types';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { apiError } from '../../__tests__/fixtures';

vi.mock('../api', () => ({ trackingApi: { summary: vi.fn(), items: vi.fn(), teams: vi.fn() } }));
/** What the account holds; `null`: the profile has not loaded yet. */
const account = vi.hoisted(() => ({ permissions: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: account.permissions }) }));

const api = vi.mocked(trackingApi);
const T = L.tracking;

const AS_OF = '2026-12-10T02:30:00.000Z'; // 09:30 in Vietnam
const AS_OF_2 = '2026-12-10T02:45:00.000Z'; // 09:45 in Vietnam

const item = (over: Partial<TrackingItemDto> = {}): TrackingItemDto => ({
  recordKind: 'PETITION',
  recordId: 'pet-1',
  recordCode: '2026-11940',
  recordLabel: 'Phạm Văn Đ',
  stepKey: 's2',
  stepName: 'Xác minh',
  teamId: 't3',
  teamName: 'Tổ 3',
  assigneeUserId: 'u7',
  responsibleName: 'Trần B',
  dueAt: '2026-12-11T16:59:59.999Z',
  band: 'RED',
  remainingDays: 1,
  ...over,
  // The id of a piece of work is the party row; a fixture that names none gets one from its record and step.
  id: over.id ?? `${over.recordId ?? 'pet-1'}-${over.stepKey ?? 's2'}`,
});

const summary = (over: Partial<TrackingSummaryDto> = {}): TrackingSummaryDto => ({ asOf: AS_OF, counts: { OVERDUE: 2, RED: 1, YELLOW: 3, GREEN: 4 }, ...over });
const items = (rows: TrackingItemDto[], over: Partial<TrackingItemsDto> = {}): TrackingItemsDto => ({
  asOf: AS_OF,
  band: null,
  items: rows,
  total: rows.length,
  page: 1,
  pageSize: 20,
  ...over,
});

function Where() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="where">{`${location.pathname}${location.search}`}</output>
      <button type="button" data-testid="go-back" onClick={() => navigate(-1)}>
        back
      </button>
    </>
  );
}

function renderPage(path = '/theo-doi-xu-ly') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/theo-doi-xu-ly" element={<><TrackingPage /><Where /></>} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const card = (band: string) => screen.getByTestId(`tracking-card-${band}`);
const where = () => screen.getByTestId('where').textContent ?? '';
const lastItemsCall = () => api.items.mock.calls[api.items.mock.calls.length - 1][0];

beforeEach(() => {
  vi.resetAllMocks();
  account.permissions = ['read:ProcessingStep', 'approve:ProcessingStep'];
  api.summary.mockResolvedValue(summary());
  api.teams.mockResolvedValue([
    { id: 't1', name: 'Tổ 1', parentTeamId: null },
    { id: 't3', name: 'Tổ 3', parentTeamId: null },
  ]);
  api.items.mockResolvedValue(items([item(), item({ recordId: 'pet-2', recordCode: '2026-11902', band: 'OVERDUE', remainingDays: -2, stepName: 'Trả lời đơn' })], { total: 10 }));
});

describe('the cards and the list behind them', () => {
  it('shows the four counts and lists every colour, judged at the instant the cards were', async () => {
    renderPage();
    await waitFor(() => expect(card('OVERDUE')).toHaveTextContent('2'));
    expect(card('OVERDUE')).toHaveTextContent('Quá hạn');
    expect(card('RED')).toHaveTextContent('Đỏ');
    expect(card('RED')).toHaveTextContent('1');
    expect(card('YELLOW')).toHaveTextContent('3');
    expect(card('GREEN')).toHaveTextContent('4');

    expect(await screen.findByTestId('tracking-row-pet-1-s2')).toBeInTheDocument();
    expect(api.summary).toHaveBeenCalledWith({ mine: false, teamId: null, kind: null, role: 'MAIN', q: null });
    expect(api.items).toHaveBeenCalledWith({ mine: false, teamId: null, kind: null, role: 'MAIN', q: null, band: null, awaiting: false, asOf: AS_OF, page: 1, pageSize: 20 });
    // Ten rows in all = the sum of the four cards: nothing to say.
    expect(screen.queryByTestId('tracking-changed')).toBeNull();
    expect(screen.getByTestId('tracking-count')).toHaveTextContent('10 dòng');
  });

  it('says who acts for the responsible person under a delegation, on that row only', async () => {
    api.items.mockResolvedValue(items([item({ delegateName: 'Lê C' }), item({ recordId: 'pet-2', delegateName: null })]));
    renderPage();
    const row = await screen.findByTestId('tracking-row-pet-1-s2');
    expect(within(row).getByTestId('tracking-delegate')).toHaveTextContent('uỷ quyền cho Lê C');
    expect(within(screen.getByTestId('tracking-row-pet-2-s2')).queryByTestId('tracking-delegate')).toBeNull();
  });

  it('never asks for the list before the cards answered (it has no instant to pass)', async () => {
    let answer: (value: TrackingSummaryDto) => void = () => {};
    api.summary.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderPage();
    await waitFor(() => expect(api.summary).toHaveBeenCalled());
    expect(api.items).not.toHaveBeenCalled();
    answer(summary());
    await waitFor(() => expect(api.items).toHaveBeenCalledTimes(1));
    expect(lastItemsCall().asOf).toBe(AS_OF);
  });

  it('a row says the colour with the days, the record, the step, the unit with the person, and the deadline in Vietnam time', async () => {
    renderPage();
    const row = await screen.findByTestId('tracking-row-pet-1-s2');
    expect(within(row).getByTestId('tracking-band')).toHaveTextContent('Đỏ · còn 1 ngày');
    expect(row).toHaveTextContent('2026-11940');
    expect(row).toHaveTextContent('Phạm Văn Đ');
    expect(row).toHaveTextContent('Đơn thư');
    expect(row).toHaveTextContent('Xác minh');
    expect(row).toHaveTextContent('Tổ 3 · Trần B');
    // 16:59:59.999Z is the end of 11/12 in Vietnam.
    expect(row).toHaveTextContent('11/12/2026');
    expect(within(screen.getByTestId('tracking-row-pet-2-s2')).getByTestId('tracking-band')).toHaveTextContent('Quá hạn 2 ngày');
  });

  it('a deadline that is not the end of a day shows its hour; a row with no unit or person says so', async () => {
    api.items.mockResolvedValue(items([item({ dueAt: '2026-12-11T03:00:00.000Z', teamName: null, teamId: null, responsibleName: null, recordCode: null, recordLabel: null })], { total: 10 }));
    renderPage();
    const row = await screen.findByTestId('tracking-row-pet-1-s2');
    expect(row).toHaveTextContent('11/12/2026 10:00');
    expect(row).toHaveTextContent(T.noUnit);
    expect(row).toHaveTextContent(T.noPerson);
    expect(row).toHaveTextContent(T.noCode);
  });

  it('clicking a card lists that band with the SAME instant; clicking it again lists every colour', async () => {
    renderPage();
    await screen.findByTestId('tracking-row-pet-1-s2');
    api.items.mockResolvedValue(items([item()], { band: 'RED', total: 1 }));
    fireEvent.click(card('RED'));
    await waitFor(() => expect(lastItemsCall()).toMatchObject({ band: 'RED', asOf: AS_OF, page: 1 }));
    expect(where()).toBe('/theo-doi-xu-ly?tracking_band=RED');
    await waitFor(() => expect(card('RED')).toHaveAttribute('aria-pressed', 'true'));
    expect(await screen.findByTestId('tracking-count')).toHaveTextContent('1 dòng · đang lọc theo thẻ Đỏ');
    expect(screen.queryByTestId('tracking-changed')).toBeNull();
    expect(api.summary).toHaveBeenCalledTimes(1);

    api.items.mockResolvedValue(items([item()], { total: 10 }));
    fireEvent.click(card('RED'));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly'));
    await waitFor(() => expect(lastItemsCall()).toMatchObject({ band: null, asOf: AS_OF }));
  });

  it('the link under the cards clears the card as well', async () => {
    api.items.mockResolvedValue(items([item()], { band: 'RED', total: 1 }));
    renderPage('/theo-doi-xu-ly?tracking_band=RED');
    fireEvent.click(await screen.findByTestId('tracking-clear-card'));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly'));
    expect(screen.queryByTestId('tracking-clear-card')).toBeNull();
  });
});

describe('a number that no longer equals its rows (C15)', () => {
  it('says the figures of hh:mm changed, and the button takes a new instant for the cards AND the list', async () => {
    // The card said 1 red; by the time the list is read there are 2.
    api.items.mockResolvedValue(items([item(), item({ recordId: 'pet-9' })], { band: 'RED', total: 2 }));
    renderPage('/theo-doi-xu-ly?tracking_band=RED');
    const line = await screen.findByTestId('tracking-changed');
    expect(line).toHaveTextContent('Số liệu lúc 09:30 đã thay đổi.');
    expect(card('RED')).toHaveTextContent('1');

    api.summary.mockResolvedValue(summary({ asOf: AS_OF_2, counts: { OVERDUE: 2, RED: 2, YELLOW: 3, GREEN: 4 } }));
    api.items.mockResolvedValue(items([item(), item({ recordId: 'pet-9' })], { asOf: AS_OF_2, band: 'RED', total: 2 }));
    fireEvent.click(within(line).getByTestId('tracking-refresh'));
    await waitFor(() => expect(lastItemsCall()).toMatchObject({ band: 'RED', asOf: AS_OF_2 }));
    await waitFor(() => expect(card('RED')).toHaveTextContent('2'));
    await waitFor(() => expect(screen.queryByTestId('tracking-changed')).toBeNull());
  });

  it('with no card chosen the list is compared with the sum of the four cards', async () => {
    api.items.mockResolvedValue(items([item()], { total: 9 }));
    renderPage();
    expect(await screen.findByTestId('tracking-changed')).toHaveTextContent('09:30');
  });

  it('does not cry wolf while the list of a new instant is still loading', async () => {
    renderPage();
    await screen.findByTestId('tracking-row-pet-1-s2');
    api.summary.mockResolvedValue(summary({ asOf: AS_OF_2, counts: { OVERDUE: 5, RED: 5, YELLOW: 5, GREEN: 5 } }));
    api.items.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByTestId('tracking-reload'));
    await waitFor(() => expect(card('RED')).toHaveTextContent('5'));
    expect(screen.queryByTestId('tracking-changed')).toBeNull();
    expect(screen.queryByTestId('tracking-row-pet-1-s2')).toBeNull();
  });
});

describe('records whose flow nobody has confirmed', () => {
  it('are named in one quiet line under the cards, apart from them', async () => {
    api.summary.mockResolvedValue(summary({ unconfirmed: 1234 }));
    renderPage();
    const line = await screen.findByTestId('tracking-unconfirmed');
    expect(line).toHaveTextContent('Có 1.234 hồ sơ chưa xác định quy trình (chưa tính vào các thẻ).');
    // The cards and the list are what they were: nothing is added to them, and nothing looks changed.
    expect(card('OVERDUE')).toHaveTextContent('2');
    expect(card('RED')).toHaveTextContent('1');
    expect(screen.queryByTestId('tracking-changed')).toBeNull();
  });

  it('there is no line when there is none, nor when an older server does not say', async () => {
    api.summary.mockResolvedValue(summary({ unconfirmed: 0 }));
    const first = renderPage();
    await screen.findByTestId('tracking-row-pet-1-s2');
    expect(screen.queryByTestId('tracking-unconfirmed')).toBeNull();
    first.unmount();

    api.summary.mockResolvedValue(summary());
    renderPage();
    await screen.findByTestId('tracking-row-pet-1-s2');
    expect(screen.queryByTestId('tracking-unconfirmed')).toBeNull();
  });
});

describe('the card "Chờ tôi duyệt"', () => {
  const approvalCard = () => screen.getByTestId('tracking-card-APPROVAL');

  it('shows the number of the server to a person who may approve, and lists exactly those steps when clicked', async () => {
    api.summary.mockResolvedValue(summary({ awaitingMyApproval: 2 }));
    renderPage();
    await waitFor(() => expect(approvalCard()).toHaveTextContent('2'));
    expect(approvalCard()).toHaveTextContent(T.awaiting.card);
    api.items.mockResolvedValue(items([item({ id: 'w1' }), item({ id: 'w2', recordId: 'pet-9', dueAt: null, band: 'NONE', remainingDays: null })]));
    fireEvent.click(approvalCard());
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_awaiting=1'));
    await waitFor(() => expect(lastItemsCall()).toEqual({ mine: false, teamId: null, kind: null, role: 'MAIN', q: null, band: null, awaiting: true, asOf: AS_OF, page: 1, pageSize: 20 }));
    await waitFor(() => expect(screen.getByTestId('tracking-count')).toHaveTextContent(T.awaiting.count(2)));
    // A step with no deadline still waits: it says so instead of a colour and a date.
    const noDeadline = within(await screen.findByTestId('tracking-row-w2'));
    expect(noDeadline.getByTestId('tracking-band')).toHaveTextContent(T.noDeadline);
    // The number is the rows: nothing changed.
    expect(screen.queryByTestId('tracking-changed')).not.toBeInTheDocument();
  });

  it('is exclusive with the band cards, both ways, and clicking it again lists every colour', async () => {
    api.summary.mockResolvedValue(summary({ awaitingMyApproval: 2 }));
    renderPage('/theo-doi-xu-ly?tracking_band=RED&tracking_page=2');
    await waitFor(() => expect(approvalCard()).toHaveTextContent('2'));
    fireEvent.click(approvalCard());
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_awaiting=1'));
    fireEvent.click(card('OVERDUE'));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_band=OVERDUE'));
    await waitFor(() => expect(lastItemsCall()).toMatchObject({ band: 'OVERDUE', awaiting: false }));
    fireEvent.click(approvalCard());
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_awaiting=1'));
    fireEvent.click(approvalCard());
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly'));
    await waitFor(() => expect(lastItemsCall()).toMatchObject({ band: null, awaiting: false }));
  });

  it('says the figures changed when the rows are not the number of THIS card (not the sum of the bands)', async () => {
    // The bands add up to 10, as the default list does; the card says 2 and its list has 1.
    api.summary.mockResolvedValue(summary({ awaitingMyApproval: 2 }));
    api.items.mockResolvedValue(items([item()], { total: 1 }));
    renderPage('/theo-doi-xu-ly?tracking_awaiting=1');
    expect(await screen.findByTestId('tracking-changed')).toHaveTextContent('09:30');
    api.summary.mockResolvedValue(summary({ asOf: AS_OF_2, awaitingMyApproval: 1 }));
    fireEvent.click(screen.getByTestId('tracking-refresh'));
    await waitFor(() => expect(screen.queryByTestId('tracking-changed')).not.toBeInTheDocument());
    expect(lastItemsCall()).toMatchObject({ awaiting: true, asOf: AS_OF_2 });
  });

  it('a person who does not hold the permission has no card, and an address that asks for it lists every colour', async () => {
    account.permissions = ['read:ProcessingStep'];
    api.summary.mockResolvedValue(summary({ awaitingMyApproval: 0 }));
    renderPage('/theo-doi-xu-ly?tracking_awaiting=1');
    await waitFor(() => expect(card('OVERDUE')).toHaveTextContent('2'));
    expect(screen.queryByTestId('tracking-card-APPROVAL')).not.toBeInTheDocument();
    await waitFor(() => expect(lastItemsCall()).toMatchObject({ awaiting: false, band: null }));
  });

  it('an older server that does not say the number shows no card', async () => {
    renderPage();
    await waitFor(() => expect(card('OVERDUE')).toHaveTextContent('2'));
    expect(screen.queryByTestId('tracking-card-APPROVAL')).not.toBeInTheDocument();
  });
});

describe('the units of the filter follow what the screen lists', () => {
  it('asks them with the role of the screen: a unit that only checks can be picked when the checking work is listed', async () => {
    api.teams.mockImplementation((asked) =>
      Promise.resolve(asked.role === 'CHECK' ? [{ id: 't9', name: 'Tổ kiểm tra', parentTeamId: null }] : [{ id: 't1', name: 'Tổ 1', parentTeamId: null }]),
    );
    renderPage();
    const picker = screen.getByTestId('tracking-filter-team');
    await waitFor(() => expect(within(picker).getByRole('option', { name: 'Tổ 1' })).toBeInTheDocument());
    expect(api.teams).toHaveBeenLastCalledWith({ role: 'MAIN', awaiting: false });
    fireEvent.change(screen.getByTestId('tracking-filter-role'), { target: { value: 'CHECK' } });
    await waitFor(() => expect(within(picker).getByRole('option', { name: 'Tổ kiểm tra' })).toBeInTheDocument());
    expect(api.teams).toHaveBeenLastCalledWith({ role: 'CHECK', awaiting: false });
    expect(within(picker).queryByRole('option', { name: 'Tổ 1' })).not.toBeInTheDocument();
  });

  it('with the card "Chờ tôi duyệt" chosen, asks the units of that work', async () => {
    api.summary.mockResolvedValue(summary({ awaitingMyApproval: 2 }));
    renderPage('/theo-doi-xu-ly?tracking_awaiting=1&tracking_role=COORDINATE');
    await waitFor(() => expect(api.teams).toHaveBeenCalledWith({ role: 'COORDINATE', awaiting: true }));
  });
});

describe('the role filter and the search box', () => {
  it('the role is read from the address and sent with the cards and the list; MAIN is the default and is not written', async () => {
    renderPage('/theo-doi-xu-ly?tracking_role=CHECK&tracking_page=2');
    await waitFor(() => expect(api.items).toHaveBeenCalled());
    expect(api.summary).toHaveBeenCalledWith(expect.objectContaining({ role: 'CHECK' }));
    expect(lastItemsCall()).toMatchObject({ role: 'CHECK', page: 2 });
    const select = screen.getByTestId('tracking-filter-role') as HTMLSelectElement;
    expect(select.value).toBe('CHECK');
    fireEvent.change(select, { target: { value: 'COORDINATE' } });
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_role=COORDINATE'));
    fireEvent.change(select, { target: { value: 'MAIN' } });
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly'));
    await waitFor(() => expect(api.summary).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'MAIN' })));
  });

  it('a role the contract does not know is MAIN', async () => {
    renderPage('/theo-doi-xu-ly?tracking_role=INFORM');
    await waitFor(() => expect(api.items).toHaveBeenCalled());
    expect(lastItemsCall()).toMatchObject({ role: 'MAIN' });
  });

  it('the search is sent, trimmed, a moment after typing stops; it is kept in the address and drops the page key', async () => {
    renderPage('/theo-doi-xu-ly?tracking_page=3');
    await waitFor(() => expect(api.items).toHaveBeenCalled());
    const box = screen.getByTestId('tracking-search') as HTMLInputElement;
    fireEvent.change(box, { target: { value: ' 2026-11' } });
    fireEvent.change(box, { target: { value: ' 2026-119 ' } });
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_q=2026-119'));
    await waitFor(() => expect(api.summary).toHaveBeenLastCalledWith(expect.objectContaining({ q: '2026-119' })));
    await waitFor(() => expect(lastItemsCall()).toMatchObject({ q: '2026-119', page: 1 }));
    // Only the last text was asked: the one typed on the way was never sent.
    expect(api.summary.mock.calls.some(([filters]) => filters.q === '2026-11')).toBe(false);
  });

  it('one character is no search; emptying the box removes the key', async () => {
    renderPage('/theo-doi-xu-ly?tracking_q=2026-119');
    await waitFor(() => expect(api.items).toHaveBeenCalled());
    const box = screen.getByTestId('tracking-search') as HTMLInputElement;
    expect(box.value).toBe('2026-119');
    expect(lastItemsCall()).toMatchObject({ q: '2026-119' });
    fireEvent.change(box, { target: { value: '2' } });
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly'));
    await waitFor(() => expect(api.summary).toHaveBeenLastCalledWith(expect.objectContaining({ q: null })));
    expect(screen.getByTestId('tracking-search-hint')).toHaveTextContent(T.search.tooShort);
  });

  it('a search of the address shorter than two characters is not sent, and clearing the filters empties the box', async () => {
    renderPage('/theo-doi-xu-ly?tracking_q=x');
    await waitFor(() => expect(api.items).toHaveBeenCalled());
    expect(lastItemsCall()).toMatchObject({ q: null });
    // What is not a search does not stay in the address.
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly'));
    fireEvent.change(screen.getByTestId('tracking-search'), { target: { value: 'Phạm Văn' } });
    await waitFor(() => expect(lastItemsCall()).toMatchObject({ q: 'Phạm Văn' }));
    expect(where()).toContain('tracking_q=');
    fireEvent.click(screen.getByTestId('tracking-clear-filters'));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly'));
    expect((screen.getByTestId('tracking-search') as HTMLInputElement).value).toBe('');
  });
});

describe('the filters live in the address', () => {
  it('reads the card, my work, the unit, the kind and the page from the address', async () => {
    api.items.mockResolvedValue(items([item()], { band: 'YELLOW', total: 3, page: 2 }));
    renderPage('/theo-doi-xu-ly?tracking_band=YELLOW&tracking_mine=1&tracking_team=t3&tracking_kind=CASE&tracking_page=2');
    await waitFor(() => expect(api.items).toHaveBeenCalled());
    expect(api.summary).toHaveBeenCalledWith({ mine: true, teamId: 't3', kind: 'CASE', role: 'MAIN', q: null });
    expect(lastItemsCall()).toEqual({ mine: true, teamId: 't3', kind: 'CASE', role: 'MAIN', q: null, band: 'YELLOW', awaiting: false, asOf: AS_OF, page: 2, pageSize: 20 });
    expect(screen.getByTestId('tracking-scope-mine')).toHaveAttribute('aria-pressed', 'true');
    expect((screen.getByTestId('tracking-filter-team') as HTMLSelectElement).value).toBe('t3');
    expect((screen.getByTestId('tracking-filter-kind') as HTMLSelectElement).value).toBe('CASE');
  });

  it('ignores a card or a kind the contract does not know', async () => {
    renderPage('/theo-doi-xu-ly?tracking_band=NONE&tracking_kind=LETTER&tracking_page=abc');
    await waitFor(() => expect(api.items).toHaveBeenCalled());
    expect(lastItemsCall()).toMatchObject({ band: null, kind: null, page: 1 });
  });

  it('changing a filter writes it, drops the page key, and asks the cards again', async () => {
    renderPage('/theo-doi-xu-ly?tracking_page=3');
    await waitFor(() => expect(api.items).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('tracking-filter-kind'), { target: { value: 'INCIDENT' } });
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_kind=INCIDENT'));
    await waitFor(() => expect(api.summary).toHaveBeenLastCalledWith({ mine: false, teamId: null, kind: 'INCIDENT', role: 'MAIN', q: null }));

    fireEvent.change(screen.getByTestId('tracking-filter-team'), { target: { value: 't1' } });
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_kind=INCIDENT&tracking_team=t1'));

    fireEvent.click(screen.getByTestId('tracking-scope-mine'));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_kind=INCIDENT&tracking_team=t1&tracking_mine=1'));
    await waitFor(() => expect(api.summary).toHaveBeenLastCalledWith({ mine: true, teamId: 't1', kind: 'INCIDENT', role: 'MAIN', q: null }));

    fireEvent.click(screen.getByTestId('tracking-scope-all'));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_kind=INCIDENT&tracking_team=t1'));
  });

  it('clearing the filters removes every key of the screen, the page key included', async () => {
    renderPage('/theo-doi-xu-ly?tracking_band=RED&tracking_team=t1&tracking_page=2&other=1');
    await waitFor(() => expect(api.items).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('tracking-clear-filters'));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?other=1'));
  });

  it('a card click is a step of the history: Back returns to the list before it', async () => {
    renderPage();
    await screen.findByTestId('tracking-row-pet-1-s2');
    fireEvent.click(card('OVERDUE'));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_band=OVERDUE'));
    fireEvent.click(screen.getByTestId('go-back'));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly'));
  });

  it('pages with the page key of the screen, keeping the instant', async () => {
    // 45 pieces of work in all: three pages, and the cards add up to the same 45.
    api.summary.mockResolvedValue(summary({ counts: { OVERDUE: 10, RED: 10, YELLOW: 10, GREEN: 15 } }));
    api.items.mockResolvedValue(items([item()], { total: 45 }));
    renderPage();
    await screen.findByTestId('tracking-row-pet-1-s2');
    fireEvent.click(screen.getByRole('button', { name: /Sau/ }));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_page=2'));
    await waitFor(() => expect(lastItemsCall()).toMatchObject({ page: 2, asOf: AS_OF }));
    expect(api.summary).toHaveBeenCalledTimes(1);
  });
});

describe('opening a record', () => {
  it.each([
    ['PETITION', '/petitions/r1?tab=phan-cong-xu-ly'],
    ['INCIDENT', '/incidents/r1?tab=phan-cong-xu-ly'],
    ['CASE', '/cases/r1/edit?tab=phan-cong-xu-ly'],
  ] as const)('the link of a %s row opens its form on the assignment tab', async (kind, href) => {
    api.items.mockResolvedValue(items([item({ recordKind: kind, recordId: 'r1' })], { total: 10 }));
    renderPage();
    const row = await screen.findByTestId('tracking-row-r1-s2');
    expect(within(row).getByRole('link')).toHaveAttribute('href', href);
    // The record opens by its link (the row itself is not a click target: the app's row-click setting is per list).
    fireEvent.click(within(row).getByRole('link'));
    await waitFor(() => expect(where()).toBe(href));
  });
});

describe('what the screen says when there is nothing to show', () => {
  it('a failed load of the cards is a failure with a retry, not zeros', async () => {
    api.summary.mockRejectedValueOnce(apiError(500, null));
    renderPage();
    expect(await screen.findByTestId('tracking-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('list-page-shell-table-empty')).toBeNull();
    expect(screen.queryByTestId('tracking-card-RED')).toBeNull();
    expect(api.items).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('tracking-retry'));
    expect(await screen.findByTestId('tracking-row-pet-1-s2')).toBeInTheDocument();
    expect(screen.queryByTestId('tracking-load-error')).toBeNull();
  });

  it('a failed load of the list is a failure with a retry, not an empty list', async () => {
    api.items.mockRejectedValueOnce(apiError(500, null));
    renderPage();
    expect(await screen.findByTestId('tracking-list-error')).toBeInTheDocument();
    expect(screen.queryByTestId('list-page-shell-table-empty')).toBeNull();
    expect(screen.queryByText(T.empty)).toBeNull();
    // The cards did load: they stay.
    expect(card('RED')).toHaveTextContent('1');
    fireEvent.click(screen.getByTestId('tracking-list-retry'));
    expect(await screen.findByTestId('tracking-row-pet-1-s2')).toBeInTheDocument();
  });

  it('an empty list says no step matches', async () => {
    api.summary.mockResolvedValue(summary({ counts: { OVERDUE: 0, RED: 0, YELLOW: 0, GREEN: 0 } }));
    api.items.mockResolvedValue(items([]));
    renderPage();
    expect(await screen.findByText(T.empty)).toBeInTheDocument();
    expect(screen.queryByTestId('tracking-changed')).toBeNull();
  });

  it('404 with no code of the contract = the switch is off: says so, with no error banner', async () => {
    api.summary.mockRejectedValue(apiError(404, null));
    renderPage();
    expect(await screen.findByTestId('processing-flow-disabled')).toHaveTextContent(L.recordTabs.off);
    expect(screen.queryByTestId('tracking-load-error')).toBeNull();
  });

  it('403 says the person lacks the permission', async () => {
    api.summary.mockRejectedValue(apiError(403, null));
    renderPage();
    expect(await screen.findByTestId('tracking-forbidden')).toHaveTextContent(T.forbidden);
    expect(screen.queryByTestId('tracking-retry')).toBeNull();
  });

  it('shows a loading state, not an empty list, while the cards are on their way', async () => {
    api.summary.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(await screen.findByTestId('list-page-shell-table-loading')).toBeInTheDocument();
    expect(screen.queryByText(T.empty)).toBeNull();
  });
});

describe('one row per piece of work (a step x a MAIN party)', () => {
  const rowIds = () => screen.queryAllByTestId(/^tracking-row-/).map((row) => row.getAttribute('data-testid'));

  it('two MAIN parties of one step are two rows, each under its own id', async () => {
    const twin = { recordId: 'pet-1', stepKey: 's2', band: 'RED' };
    api.items.mockResolvedValue(items([item({ ...twin, id: 'party-a', teamName: 'Tổ 1' }), item({ ...twin, id: 'party-b', teamName: 'Tổ 3' })], { total: 10 }));
    renderPage();
    await screen.findByTestId('tracking-row-party-a');
    expect(rowIds()).toEqual(['tracking-row-party-a', 'tracking-row-party-b']);
    expect(screen.getByTestId('tracking-row-party-a')).toHaveTextContent('Tổ 1');
    expect(screen.getByTestId('tracking-row-party-b')).toHaveTextContent('Tổ 3');
  });

  it('switching band leaves no row of the other band behind, even when the two lists share a record and a step', async () => {
    const twin = { recordId: 'pet-1', stepKey: 's2' };
    api.items.mockResolvedValue(items([item({ ...twin, id: 'party-a', band: 'RED', teamName: 'Tổ 1' }), item({ ...twin, id: 'party-b', band: 'RED', teamName: 'Tổ 3' })], { band: 'RED', total: 1 }));
    api.summary.mockResolvedValue(summary({ counts: { OVERDUE: 1, RED: 2, YELLOW: 0, GREEN: 0 } }));
    renderPage('/theo-doi-xu-ly?tracking_band=RED');
    await screen.findByTestId('tracking-row-party-b');

    api.items.mockResolvedValue(items([item({ recordId: 'pet-7', stepKey: 's2', id: 'party-c', band: 'OVERDUE', remainingDays: -2, teamName: 'Tổ 9' })], { band: 'OVERDUE', total: 1 }));
    fireEvent.click(card('OVERDUE'));
    await screen.findByTestId('tracking-row-party-c');
    expect(rowIds()).toEqual(['tracking-row-party-c']);
    expect(screen.queryByText(/Tổ 1|Tổ 3/, { selector: 'td, td *' })).toBeNull();
    expect(screen.getAllByTestId('tracking-band').map((chip) => chip.textContent)).toEqual(['Quá hạn 2 ngày']);
  });
});

describe('a page that no longer exists', () => {
  it('a refresh goes back to the first page: the page key is removed with the new instant', async () => {
    api.summary.mockResolvedValue(summary({ counts: { OVERDUE: 10, RED: 10, YELLOW: 10, GREEN: 15 } }));
    api.items.mockResolvedValue(items([item()], { total: 45, page: 3 }));
    renderPage('/theo-doi-xu-ly?tracking_page=3');
    await screen.findByTestId('tracking-row-pet-1-s2');
    expect(lastItemsCall()).toMatchObject({ page: 3 });

    // Meanwhile most of the work was finished: one page is left.
    api.summary.mockResolvedValue(summary({ asOf: AS_OF_2, counts: { OVERDUE: 1, RED: 0, YELLOW: 0, GREEN: 0 } }));
    api.items.mockImplementation((query) => Promise.resolve(query.page === 1 ? items([item()], { asOf: query.asOf, total: 1 }) : items([], { asOf: query.asOf, total: 1, page: query.page })));
    fireEvent.click(screen.getByTestId('tracking-reload'));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly'));
    await waitFor(() => expect(lastItemsCall()).toMatchObject({ page: 1, asOf: AS_OF_2 }));
    expect(await screen.findByTestId('tracking-row-pet-1-s2')).toBeInTheDocument();
    expect(screen.queryByText(T.empty)).toBeNull();
    // No list of the new instant was asked for the page that is gone.
    expect(api.items.mock.calls.filter(([query]) => query.asOf === AS_OF_2 && query.page !== 1)).toEqual([]);
  });

  it('the refresh button of the "changed" line does the same', async () => {
    api.summary.mockResolvedValue(summary({ counts: { OVERDUE: 10, RED: 10, YELLOW: 10, GREEN: 15 } }));
    api.items.mockResolvedValue(items([item()], { total: 44, page: 2 }));
    renderPage('/theo-doi-xu-ly?tracking_page=2');
    const line = await screen.findByTestId('tracking-changed');
    api.summary.mockResolvedValue(summary({ asOf: AS_OF_2, counts: { OVERDUE: 1, RED: 0, YELLOW: 0, GREEN: 0 } }));
    api.items.mockResolvedValue(items([item()], { asOf: AS_OF_2, total: 1 }));
    fireEvent.click(within(line).getByTestId('tracking-refresh'));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly'));
    await waitFor(() => expect(lastItemsCall()).toMatchObject({ page: 1, asOf: AS_OF_2 }));
  });

  it('an answer with no rows while the total says there are some (the page ran out behind our back) goes back to page 1', async () => {
    api.summary.mockResolvedValue(summary({ counts: { OVERDUE: 5, RED: 0, YELLOW: 0, GREEN: 0 } }));
    api.items.mockImplementation((query) => Promise.resolve(query.page === 1 ? items([item()], { total: 5 }) : items([], { total: 5, page: query.page })));
    renderPage('/theo-doi-xu-ly?tracking_page=3');
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly'));
    expect(await screen.findByTestId('tracking-row-pet-1-s2')).toBeInTheDocument();
    expect(lastItemsCall()).toMatchObject({ page: 1 });
    // The empty page was never shown as "nothing matches".
    expect(screen.queryByText(T.empty)).toBeNull();
  });

  it('a list that is truly empty stays where it is and says so', async () => {
    api.summary.mockResolvedValue(summary({ counts: { OVERDUE: 0, RED: 0, YELLOW: 0, GREEN: 0 } }));
    api.items.mockResolvedValue(items([], { total: 0, page: 2 }));
    renderPage('/theo-doi-xu-ly?tracking_page=2');
    expect(await screen.findByText(T.empty)).toBeInTheDocument();
    expect(where()).toBe('/theo-doi-xu-ly?tracking_page=2');
  });
});

describe('the unit filter', () => {
  it('offers the units of the tracking route itself, so a person who may not read the list of units still filters', async () => {
    renderPage();
    const select = screen.getByTestId('tracking-filter-team');
    await waitFor(() => expect(within(select).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['', 't1', 't3']));
    expect(api.teams).toHaveBeenCalledTimes(1);
  });

  it('a failed read of the units leaves the filter with "Tất cả" and the screen working', async () => {
    api.teams.mockRejectedValue(new Error('down'));
    renderPage();
    await waitFor(() => expect(card('OVERDUE')).toBeInTheDocument());
    expect(within(screen.getByTestId('tracking-filter-team')).getAllByRole('option')).toHaveLength(1);
  });
});
