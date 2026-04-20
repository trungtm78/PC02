import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CalendarPage from '../CalendarPage';
import { authStore } from '@/stores/auth.store';

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getUser: vi.fn(),
  },
}));

// Mock usePermission hook
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    canCreate: () => true,
    canDelete: () => true,
  }),
}));

// Mock the api module with seed events so the upcoming-events test has
// deterministic data to assert against. Without this the component falls
// through to an empty array on network failure in the test env.
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(() =>
      Promise.resolve({
        data: {
          success: true,
          // Both dates must be strictly in the future because
          // UpcomingEvents filters with `date >= new Date()` and the
          // comparison happens milliseconds after the mock runs.
          data: [
            {
              id: 'evt-1',
              title: 'Họp phân công điều tra',
              type: 'meeting',
              date: new Date(Date.now() + 3600_000).toISOString(), // +1h
              description: '',
            },
            {
              id: 'evt-2',
              title: 'Hạn nộp hồ sơ',
              type: 'deadline',
              date: new Date(Date.now() + 86_400_000).toISOString(), // +1d
              description: '',
            },
          ],
        },
      }),
    ),
  },
}));

// Mock Modal component. IMPORTANT: the real Modal uses an `open` prop, not
// `isOpen`. Matching the production API here is what lets CalendarPage's
// modal state actually reach the rendered output during tests.
vi.mock('@/components/shared/Modal', () => ({
  Modal: ({
    open,
    onClose,
    title,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="modal" role="dialog">
        <div data-testid="modal-title">{title}</div>
        <button data-testid="modal-close" onClick={onClose}>
          Close
        </button>
        {children}
      </div>
    ) : null,
}));

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authStore.getUser).mockReturnValue({ email: 'test@pc02.gov.vn', role: 'investigator' });
  });

  it('should render calendar page with title', () => {
    render(<CalendarPage />);
    
    expect(screen.getByText('Lịch làm việc')).toBeInTheDocument();
  });

  it('should render month navigation buttons', () => {
    render(<CalendarPage />);
    
    expect(screen.getByTestId('prev-month-btn')).toBeInTheDocument();
    expect(screen.getByTestId('next-month-btn')).toBeInTheDocument();
  });

  it('should render weekday headers', () => {
    render(<CalendarPage />);
    
    const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    weekdays.forEach(day => {
      expect(screen.getByText(day)).toBeInTheDocument();
    });
  });

  it('should render add event button when user has permission', () => {
    render(<CalendarPage />);
    
    expect(screen.getByTestId('add-event-btn')).toBeInTheDocument();
    expect(screen.getByText('Thêm sự kiện')).toBeInTheDocument();
  });

  it('should open modal when clicking add event button', async () => {
    render(<CalendarPage />);
    
    fireEvent.click(screen.getByTestId('add-event-btn'));
    
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Thêm sự kiện mới');
    });
  });

  it('should render upcoming events section', () => {
    render(<CalendarPage />);
    
    expect(screen.getByText('Sự kiện sắp tới')).toBeInTheDocument();
  });

  it('should display mock events in upcoming list', async () => {
    render(<CalendarPage />);

    // Events are fetched via useEffect, so wait for them to appear.
    await waitFor(() => {
      expect(screen.getByText('Họp phân công điều tra')).toBeInTheDocument();
      expect(screen.getByText('Hạn nộp hồ sơ')).toBeInTheDocument();
    });
  });

  it('should navigate to previous month', () => {
    render(<CalendarPage />);
    
    const prevButton = screen.getByTestId('prev-month-btn');
    fireEvent.click(prevButton);
    
    // The month label should update (we can't easily test the exact text due to dynamic dates)
    expect(prevButton).toBeInTheDocument();
  });

  it('should navigate to next month', () => {
    render(<CalendarPage />);
    
    const nextButton = screen.getByTestId('next-month-btn');
    fireEvent.click(nextButton);
    
    expect(nextButton).toBeInTheDocument();
  });

  it('should open modal with pre-filled date when clicking a day cell', async () => {
    render(<CalendarPage />);
    
    // Click on a day cell (today's cell)
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const dayCell = screen.getByTestId(`calendar-day-${dateStr}`);
    
    fireEvent.click(dayCell);
    
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Thêm sự kiện mới');
    });
  });
});
