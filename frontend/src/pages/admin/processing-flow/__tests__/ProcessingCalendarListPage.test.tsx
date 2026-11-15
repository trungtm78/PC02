import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProcessingCalendarListPage from '../ProcessingCalendarListPage';
import { processingCalendarApi } from '@/features/processing-flow/api';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { apiError } from '@/features/processing-flow/__tests__/fixtures';
import { yearSummary } from '@/features/processing-flow/__tests__/calendarFixtures';

vi.mock('@/features/processing-flow/api', () => ({ processingCalendarApi: { list: vi.fn() } }));
const api = vi.mocked(processingCalendarApi);
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}
function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/lich-lam-viec']}>
        <Routes>
          <Route path="/admin/lich-lam-viec" element={<ProcessingCalendarListPage />} />
          <Route path="/admin/lich-lam-viec/:year" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  held.value = null;
  api.list.mockResolvedValue([
    yearSummary({ year: 2026, daysOff: 9, workingDays: 1, status: 'CONFIRMED' }),
    yearSummary({ id: 'y2027', year: 2027, daysOff: 0, workingDays: 0, status: 'DRAFT' }),
  ]);
});

describe('the list of calendar years', () => {
  it('shows every stored year with its status and the counts of days off and compensatory working days', async () => {
    renderPage();
    expect(await screen.findByTestId('calendar-year-2026')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-status-2026')).toHaveTextContent('Đã xác nhận');
    expect(screen.getByTestId('calendar-status-2027')).toHaveTextContent('Nháp');
    expect(screen.getByTestId('calendar-off-2026')).toHaveTextContent('9');
    expect(screen.getByTestId('calendar-working-2026')).toHaveTextContent('1');
  });

  it('Mở goes to that year', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('calendar-open-2027'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin/lich-lam-viec/2027');
  });

  it('adding a year opens its (empty) calendar; a year that is not four digits is refused', async () => {
    renderPage();
    await screen.findByTestId('calendar-year-2026');
    fireEvent.change(screen.getByTestId('calendar-new-year'), { target: { value: '27' } });
    expect(screen.getByTestId('calendar-new-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('calendar-new-year'), { target: { value: '2028' } });
    fireEvent.click(screen.getByTestId('calendar-new-submit'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin/lich-lam-viec/2028');
  });

  it('an empty list says so', async () => {
    api.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(L.calendar.empty)).toBeInTheDocument();
  });

  it('a 404 without a code is the switch being off', async () => {
    api.list.mockRejectedValue(apiError(404, null));
    renderPage();
    expect(await screen.findByTestId('processing-flow-disabled')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('another failure shows an error with a retry', async () => {
    api.list.mockRejectedValueOnce(apiError(500, 'INTERNAL'));
    renderPage();
    expect(await screen.findByTestId('calendar-list-load-error')).toBeInTheDocument();
    api.list.mockResolvedValue([]);
    fireEvent.click(screen.getByTestId('calendar-list-retry'));
    await waitFor(() => expect(screen.queryByTestId('calendar-list-load-error')).toBeNull());
  });

  it('without edit:ProcessingCalendar there is no "Thêm năm"', async () => {
    held.value = ['read:ProcessingCalendar'];
    renderPage();
    await screen.findByTestId('calendar-year-2026');
    expect(screen.queryByTestId('calendar-new-year')).toBeNull();
  });
});

describe('a person without read:ProcessingCalendar', () => {
  it('sees the plain "no permission" state in Vietnamese, with no frame, no raw message and no retry', async () => {
    api.list.mockRejectedValue(apiError(403, null));
    renderPage();
    const state = await screen.findByTestId('processing-flow-forbidden');
    expect(state).toHaveTextContent(L.common.forbiddenTitle);
    expect(state).toHaveTextContent(L.common.forbidden);
    expect(screen.queryByTestId('calendar-list-load-error')).toBeNull();
    expect(screen.queryByTestId('calendar-list-retry')).toBeNull();
    expect(document.body).not.toHaveTextContent(/Insufficient permissions/i);
  });
});
