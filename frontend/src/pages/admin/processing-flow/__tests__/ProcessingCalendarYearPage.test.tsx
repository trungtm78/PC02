import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProcessingCalendarYearPage from '../ProcessingCalendarYearPage';
import { processingCalendarApi } from '@/features/processing-flow/api';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { apiError } from '@/features/processing-flow/__tests__/fixtures';
import { yearDto } from '@/features/processing-flow/__tests__/calendarFixtures';

vi.mock('@/features/processing-flow/api', () => ({
  processingCalendarApi: { get: vi.fn(), save: vi.fn(), confirm: vi.fn(), unconfirm: vi.fn(), remove: vi.fn() },
}));
const api = vi.mocked(processingCalendarApi);
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

function renderPage(year = '2026') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/admin/lich-lam-viec/${year}`]}>
        <Routes>
          <Route path="/admin/lich-lam-viec" element={<output data-testid="list-page" />} />
          <Route path="/admin/lich-lam-viec/:year" element={<ProcessingCalendarYearPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  held.value = null;
  api.get.mockResolvedValue({ year: 2026, stored: yearDto() });
});

describe('a stored draft year', () => {
  it('shows the weekend, the special days with their kind and label, and the unconfirmed banner', async () => {
    renderPage();
    expect(await screen.findByTestId('calendar-unconfirmed-banner')).toHaveTextContent(L.calendar.unconfirmedBanner);
    expect(screen.getByTestId('weekend-0')).toBeChecked();
    expect(screen.getByTestId('weekend-6')).toBeChecked();
    expect(screen.getByTestId('weekend-1')).not.toBeChecked();
    expect(screen.getByTestId('day-row-2026-09-02')).toHaveTextContent('Nghỉ');
    expect(screen.getByTestId('day-row-2026-09-02')).toHaveTextContent('Quốc khánh');
    expect(screen.getByTestId('day-row-2026-09-05')).toHaveTextContent('Làm bù');
  });

  it('save is disabled until something changes, then sends everything with expected {id, revision}', async () => {
    api.save.mockResolvedValue(yearDto({ revision: 4 }));
    renderPage();
    const save = await screen.findByTestId('calendar-save');
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByTestId('weekend-5'));
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    expect(api.save).toHaveBeenCalledWith(2026, {
      weekendDays: [0, 5, 6],
      days: [{ date: '2026-09-02', kind: 'OFF', label: 'Quốc khánh' }, { date: '2026-09-05', kind: 'WORKING' }],
      expected: { id: 'y2026', revision: 3 },
    });
    expect(await screen.findByTestId('calendar-message')).toHaveTextContent(L.calendar.saved);
  });

  it('adds one day with its kind and label, in date order, and removes a day', async () => {
    renderPage();
    await screen.findByTestId('day-add');
    fireEvent.change(screen.getByTestId('day-date'), { target: { value: '2026-04-30' } });
    fireEvent.change(screen.getByTestId('day-label'), { target: { value: 'Giải phóng miền Nam' } });
    fireEvent.click(screen.getByTestId('day-add'));
    expect(screen.getByTestId('day-row-2026-04-30')).toHaveTextContent('Giải phóng miền Nam');
    const rows = screen.getAllByTestId(/^day-row-/).map((r) => r.getAttribute('data-testid'));
    expect(rows).toEqual(['day-row-2026-04-30', 'day-row-2026-09-02', 'day-row-2026-09-05']);
    fireEvent.click(screen.getByTestId('day-remove-2026-09-02'));
    expect(screen.queryByTestId('day-row-2026-09-02')).toBeNull();
  });

  it('the range helper adds every day of a range, as OFF or WORKING', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('range-toggle'));
    fireEvent.change(screen.getByTestId('range-from'), { target: { value: '2026-02-14' } });
    fireEvent.change(screen.getByTestId('range-to'), { target: { value: '2026-02-20' } });
    fireEvent.change(screen.getByTestId('day-label'), { target: { value: 'Tết' } });
    fireEvent.click(screen.getByTestId('range-add'));
    for (const d of ['14', '15', '16', '17', '18', '19', '20']) expect(screen.getByTestId(`day-row-2026-02-${d}`)).toHaveTextContent('Tết');
    expect(screen.getByTestId('calendar-message')).toHaveTextContent(L.calendar.add.added(7));
  });

  it('days of another year are left out and counted', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('range-toggle'));
    fireEvent.change(screen.getByTestId('range-from'), { target: { value: '2026-12-30' } });
    fireEvent.change(screen.getByTestId('range-to'), { target: { value: '2027-01-02' } });
    fireEvent.click(screen.getByTestId('range-add'));
    expect(screen.getByTestId('day-row-2026-12-31')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-message')).toHaveTextContent(L.calendar.add.skipped(2));
  });

  it('a range that ends before it starts is refused in words', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('range-toggle'));
    fireEvent.change(screen.getByTestId('range-from'), { target: { value: '2026-02-20' } });
    fireEvent.change(screen.getByTestId('range-to'), { target: { value: '2026-02-14' } });
    fireEvent.click(screen.getByTestId('range-add'));
    expect(screen.getByTestId('calendar-error')).toHaveTextContent(L.calendar.add.invalid);
  });

  it('confirming sends expected and shows the confirmed state; Xác nhận is refused with unsaved edits', async () => {
    api.confirm.mockResolvedValue(yearDto({ status: 'CONFIRMED', revision: 4, confirmedAt: '2026-11-10T03:00:00.000Z' }));
    renderPage();
    fireEvent.click(await screen.findByTestId('weekend-5'));
    expect(screen.getByTestId('calendar-confirm')).toBeDisabled();
    fireEvent.click(screen.getByTestId('weekend-5'));
    fireEvent.click(screen.getByTestId('calendar-confirm'));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledWith(2026, { id: 'y2026', revision: 3 }));
    expect(await screen.findByTestId('calendar-status')).toHaveTextContent('Đã xác nhận');
    expect(screen.queryByTestId('calendar-unconfirmed-banner')).toBeNull();
  });

  it('deleting asks first, then sends id and revision, and goes back to the list', async () => {
    api.remove.mockResolvedValue({ deleted: true, year: 2026, id: 'y2026' });
    renderPage();
    fireEvent.click(await screen.findByTestId('calendar-delete'));
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('calendar-delete-confirm'));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith(2026, { id: 'y2026', revision: 3 }));
    expect(await screen.findByTestId('list-page')).toBeInTheDocument();
  });

  it('REVISION_CONFLICT says so, reloads, shows what the person changed but cannot save it over the newer year (found by Codex)', async () => {
    api.save.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    api.get.mockResolvedValueOnce({ year: 2026, stored: yearDto() }).mockResolvedValue({ year: 2026, stored: yearDto({ revision: 4, weekendDays: [0] }) });
    renderPage();
    fireEvent.click(await screen.findByTestId('weekend-5'));
    fireEvent.click(screen.getByTestId('calendar-save'));
    expect(await screen.findByTestId('calendar-conflict')).toHaveTextContent(L.conflict.title);
    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByTestId('calendar-conflict-reload')).toBeEnabled());
    expect(screen.getByTestId('weekend-5')).toBeChecked();
    expect(screen.getByTestId('calendar-save')).toBeDisabled();
    expect(screen.getByTestId('weekend-1')).toBeDisabled();
    expect(api.save).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('calendar-conflict-reload'));
    expect(screen.getByTestId('weekend-5')).not.toBeChecked(); // the newer year's contents
    expect(screen.getByTestId('weekend-0')).toBeChecked();
    expect(screen.queryByTestId('calendar-conflict')).toBeNull();
    fireEvent.click(screen.getByTestId('weekend-5'));
    api.save.mockResolvedValue(yearDto({ revision: 5 }));
    fireEvent.click(screen.getByTestId('calendar-save'));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
    expect(api.save.mock.calls[1][1]).toMatchObject({ expected: { id: 'y2026', revision: 4 } });
  });

  it('a refresh that FAILS after a conflict keeps the form and offers to try again (found by Codex)', async () => {
    api.save.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    api.get.mockResolvedValueOnce({ year: 2026, stored: yearDto() }).mockRejectedValueOnce(apiError(500, 'INTERNAL_ERROR'));
    renderPage();
    fireEvent.click(await screen.findByTestId('weekend-5'));
    fireEvent.click(screen.getByTestId('calendar-save'));
    expect(await screen.findByTestId('calendar-conflict')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('calendar-refresh-failed')).toBeInTheDocument());
    expect(screen.queryByTestId('calendar-load-error')).toBeNull();
    expect(screen.getByTestId('weekend-5')).toBeChecked();
  });

  it('every control is disabled while a write is pending', async () => {
    api.save.mockReturnValue(new Promise(() => undefined));
    renderPage();
    fireEvent.click(await screen.findByTestId('weekend-5'));
    fireEvent.click(screen.getByTestId('calendar-save'));
    await waitFor(() => expect(screen.getByTestId('calendar-save')).toBeDisabled());
    expect(screen.getByTestId('weekend-1')).toBeDisabled();
    expect(screen.getByTestId('day-add')).toBeDisabled();
    expect(screen.getByTestId('calendar-delete')).toBeDisabled();
  });

  it('CALENDAR_DAY_INVALID from the server is answered in words', async () => {
    api.save.mockRejectedValue(apiError(400, 'CALENDAR_DAY_INVALID'));
    renderPage();
    fireEvent.click(await screen.findByTestId('weekend-5'));
    fireEvent.click(screen.getByTestId('calendar-save'));
    expect(await screen.findByTestId('calendar-error')).toHaveTextContent(L.errors.CALENDAR_DAY_INVALID);
  });
});

describe('a confirmed year', () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ year: 2026, stored: yearDto({ status: 'CONFIRMED', revision: 5, confirmedAt: '2026-11-10T03:00:00.000Z' }) });
  });

  it('is read-only until the confirmation is taken back; no banner, no save, no delete', async () => {
    renderPage();
    expect(await screen.findByTestId('weekend-1')).toBeDisabled();
    expect(screen.getByTestId('day-add')).toBeDisabled();
    expect(screen.queryByTestId('calendar-unconfirmed-banner')).toBeNull();
    expect(screen.queryByTestId('calendar-delete')).toBeNull();
    expect(screen.getByTestId('calendar-confirmed-note')).toHaveTextContent(L.calendar.confirmedNote);
  });

  it('Bỏ xác nhận sends expected and gives the year back its banner', async () => {
    api.unconfirm.mockResolvedValue(yearDto({ status: 'DRAFT', revision: 6 }));
    renderPage();
    fireEvent.click(await screen.findByTestId('calendar-unconfirm'));
    await waitFor(() => expect(api.unconfirm).toHaveBeenCalledWith(2026, { id: 'y2026', revision: 5 }));
    expect(await screen.findByTestId('calendar-unconfirmed-banner')).toBeInTheDocument();
    expect(screen.getByTestId('weekend-1')).toBeEnabled();
  });

  it('without confirm:ProcessingCalendar neither Xác nhận nor Bỏ xác nhận is drawn', async () => {
    held.value = ['read:ProcessingCalendar', 'edit:ProcessingCalendar'];
    renderPage();
    await screen.findByTestId('weekend-1');
    expect(screen.queryByTestId('calendar-unconfirm')).toBeNull();
    expect(screen.queryByTestId('calendar-confirm')).toBeNull();
  });
});

describe('a year with no row yet', () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ year: 2028, stored: null });
  });

  it('starts with Saturday and Sunday off, says it is not saved, shows the banner, and cannot be confirmed or deleted', async () => {
    renderPage('2028');
    expect(await screen.findByTestId('calendar-not-stored')).toHaveTextContent(L.calendar.notStored);
    expect(screen.getByTestId('weekend-0')).toBeChecked();
    expect(screen.getByTestId('weekend-6')).toBeChecked();
    expect(screen.getByTestId('calendar-unconfirmed-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-confirm')).toBeNull();
    expect(screen.queryByTestId('calendar-delete')).toBeNull();
  });

  it('saves with expected null', async () => {
    api.save.mockResolvedValue(yearDto({ year: 2028, id: 'y2028', revision: 1, days: [] }));
    renderPage('2028');
    fireEvent.click(await screen.findByTestId('weekend-5'));
    fireEvent.click(screen.getByTestId('calendar-save'));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(2028, { weekendDays: [0, 5, 6], days: [], expected: null }));
    await waitFor(() => expect(screen.queryByTestId('calendar-not-stored')).toBeNull());
  });
});

describe('errors and the switch', () => {
  it('a 404 without a code is the switch being off', async () => {
    api.get.mockRejectedValue(apiError(404, null));
    renderPage();
    expect(await screen.findByTestId('processing-flow-disabled')).toBeInTheDocument();
  });

  it('a year that is not four digits is answered without asking the server', async () => {
    renderPage('20x6');
    expect(await screen.findByTestId('calendar-load-error')).toHaveTextContent(L.errors.CALENDAR_YEAR_INVALID);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('without edit permission the year is read-only', async () => {
    held.value = ['read:ProcessingCalendar'];
    renderPage();
    expect(await screen.findByTestId('weekend-1')).toBeDisabled();
    expect(screen.queryByTestId('calendar-save')).toBeNull();
  });
});

describe('how a day is shown', () => {
  it('shows the special days as dd/mm/yyyy, the same civil day, never the ISO form', async () => {
    api.get.mockResolvedValue({ year: 2026, stored: yearDto({ days: [{ date: '2026-01-01', kind: 'OFF', label: 'Tết Dương lịch' }, { date: '2026-12-31', kind: 'WORKING', label: null }] }) });
    renderPage();
    const first = await screen.findByTestId('day-row-2026-01-01');
    expect(first).toHaveTextContent('01/01/2026');
    expect(first).not.toHaveTextContent('2026-01-01');
    expect(screen.getByTestId('day-row-2026-12-31')).toHaveTextContent('31/12/2026');
  });
});

describe('a person without read:ProcessingCalendar', () => {
  it('sees the plain "no permission" state, not an error with a retry', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('403'), { isAxiosError: true, response: { status: 403, data: { success: false, error: { message: 'Insufficient permissions' } } } }));
    renderPage();
    expect(await screen.findByTestId('processing-flow-forbidden')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-load-error')).toBeNull();
    expect(document.body).not.toHaveTextContent(/Insufficient permissions/i);
  });
});
