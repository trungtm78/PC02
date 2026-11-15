import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import TrackingPage from '../TrackingPage';
import { trackingApi } from '../api';
import type { TrackingItemDto, TrackingItemsDto, TrackingSummaryDto } from '../types';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { apiError } from '../../__tests__/fixtures';

vi.mock('../api', () => ({ trackingApi: { summary: vi.fn(), items: vi.fn() } }));
vi.mock('../../useTeamChoices', () => ({
  useTeamChoices: () => ({ data: [{ id: 't1', name: 'Tổ 1' }, { id: 't3', name: 'Tổ 3' }] }),
}));

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
  api.summary.mockResolvedValue(summary());
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
    expect(api.summary).toHaveBeenCalledWith({ mine: false, teamId: null, kind: null });
    expect(api.items).toHaveBeenCalledWith({ mine: false, teamId: null, kind: null, band: null, asOf: AS_OF, page: 1, pageSize: 20 });
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

describe('the filters live in the address', () => {
  it('reads the card, my work, the unit, the kind and the page from the address', async () => {
    api.items.mockResolvedValue(items([item()], { band: 'YELLOW', total: 3, page: 2 }));
    renderPage('/theo-doi-xu-ly?tracking_band=YELLOW&tracking_mine=1&tracking_team=t3&tracking_kind=CASE&tracking_page=2');
    await waitFor(() => expect(api.items).toHaveBeenCalled());
    expect(api.summary).toHaveBeenCalledWith({ mine: true, teamId: 't3', kind: 'CASE' });
    expect(lastItemsCall()).toEqual({ mine: true, teamId: 't3', kind: 'CASE', band: 'YELLOW', asOf: AS_OF, page: 2, pageSize: 20 });
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
    await waitFor(() => expect(api.summary).toHaveBeenLastCalledWith({ mine: false, teamId: null, kind: 'INCIDENT' }));

    fireEvent.change(screen.getByTestId('tracking-filter-team'), { target: { value: 't1' } });
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_kind=INCIDENT&tracking_team=t1'));

    fireEvent.click(screen.getByTestId('tracking-scope-mine'));
    await waitFor(() => expect(where()).toBe('/theo-doi-xu-ly?tracking_kind=INCIDENT&tracking_team=t1&tracking_mine=1'));
    await waitFor(() => expect(api.summary).toHaveBeenLastCalledWith({ mine: true, teamId: 't1', kind: 'INCIDENT' }));

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
