import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsModule } from '../NotificationsModule';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

const DEFAULT_PREFS = [
  { eventType: 'CASE_ASSIGNED', inApp: true, push: true },
  { eventType: 'CASE_STATUS_CHANGED', inApp: true, push: true },
  { eventType: 'PETITION_ASSIGNED', inApp: true, push: true },
  { eventType: 'PETITION_RECEIVED', inApp: true, push: true },
  { eventType: 'INCIDENT_ASSIGNED', inApp: true, push: true },
  { eventType: 'INCIDENT_CREATED', inApp: true, push: true },
  { eventType: 'UTDT_ASSIGNED', inApp: true, push: true },
];

function renderModule() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsModule />
    </QueryClientProvider>,
  );
}

describe('NotificationsModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: DEFAULT_PREFS } });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
  });

  it('renders all 4 group headers after loading', async () => {
    renderModule();
    await waitFor(() => {
      expect(screen.getByText('Vụ án')).toBeInTheDocument();
      expect(screen.getByText('Tố giác / Đơn thư')).toBeInTheDocument();
      expect(screen.getByText('Vụ việc')).toBeInTheDocument();
      expect(screen.getByText('Ủy thác điều tra')).toBeInTheDocument();
    });
  });

  it('renders checkboxes checked by default for all 7 event types', async () => {
    renderModule();
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      // 7 types × 2 channels = 14 checkboxes total
      expect(checkboxes.length).toBe(14);
      checkboxes.forEach((cb) => expect(cb).toBeChecked());
    });
  });

  it('shows loading skeleton while fetching', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {})); // never resolves
    renderModule();
    // skeleton rows exist (animate-pulse divs)
    const { container } = renderModule();
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('calls PUT when inApp checkbox is toggled off', async () => {
    const user = userEvent.setup();
    renderModule();

    await waitFor(() => screen.getByText('Được phân công vụ án mới'));

    const inAppCheckbox = screen.getByRole('checkbox', {
      name: /Vụ án — Được phân công vụ án mới — Trong app/i,
    });

    await user.click(inAppCheckbox);

    await waitFor(() => {
      expect(vi.mocked(api.put)).toHaveBeenCalledWith(
        '/notification-preferences/CASE_ASSIGNED',
        { inApp: false, push: true },
      );
    });
  });

  it('calls PUT with push=false when push checkbox is unchecked', async () => {
    const user = userEvent.setup();
    renderModule();

    await waitFor(() => screen.getByText('Được phân công vụ án mới'));

    const pushCheckbox = screen.getByRole('checkbox', {
      name: /Vụ án — Được phân công vụ án mới — Push FCM/i,
    });

    await user.click(pushCheckbox);

    await waitFor(() => {
      expect(vi.mocked(api.put)).toHaveBeenCalledWith(
        '/notification-preferences/CASE_ASSIGNED',
        { inApp: true, push: false },
      );
    });
  });

  it('calls POST /reset when "Đặt lại mặc định" is confirmed', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    renderModule();
    await waitFor(() => screen.getByText('Đặt lại mặc định'));

    fireEvent.click(screen.getByText('Đặt lại mặc định'));

    await waitFor(() => {
      expect(vi.mocked(api.post)).toHaveBeenCalledWith('/notification-preferences/reset');
    });

    vi.unstubAllGlobals();
  });

  it('does NOT call POST /reset when reset dialog is cancelled', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

    renderModule();
    await waitFor(() => screen.getByText('Đặt lại mặc định'));

    fireEvent.click(screen.getByText('Đặt lại mặc định'));

    expect(vi.mocked(api.post)).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
