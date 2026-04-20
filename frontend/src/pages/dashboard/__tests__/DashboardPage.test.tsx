import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from '../DashboardPage';
import { authStore } from '@/stores/auth.store';

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getUser: vi.fn(),
  },
}));

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.includes('stats')) {
        // Match production wrapped envelope: { success, data }
        return Promise.resolve({
          data: {
            success: true,
            data: {
              totalCases: 1258,
              newCases: 42,
              overdueCases: 18,
              processedCases: 1198,
              totalIncidents: 0,
              totalPetitions: 0,
            },
          },
        });
      }
      if (url.includes('charts')) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              monthly: [],
              caseTypes: [],
            },
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    }),
  },
}));

// Mock recharts
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line"></div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie"></div>,
  XAxis: () => <div data-testid="x-axis"></div>,
  YAxis: () => <div data-testid="y-axis"></div>,
  CartesianGrid: () => <div data-testid="cartesian-grid"></div>,
  Tooltip: () => <div data-testid="tooltip"></div>,
  Legend: () => <div data-testid="legend"></div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container" style={{ width: '100%', height: '300px' }}>{children}</div>
  ),
  Cell: () => <div data-testid="cell"></div>,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authStore.getUser).mockReturnValue({ email: 'test@pc02.gov.vn', role: 'investigator' });
  });

  it('should render dashboard with welcome message', () => {
    render(<DashboardPage />);
    
    expect(screen.getByText('Tổng quan')).toBeInTheDocument();
    expect(screen.getByText('Chào mừng trở lại! Dưới đây là thống kê hồ sơ vụ án.')).toBeInTheDocument();
  });

  it('should render stat card labels after loading', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Tổng hồ sơ')).toBeInTheDocument();
      expect(screen.getByText('Hồ sơ mới')).toBeInTheDocument();
      expect(screen.getByText('Quá hạn')).toBeInTheDocument();
      expect(screen.getByText('Đã xử lý')).toBeInTheDocument();
    });
  });

  it('should display stat values from API', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('stat-total-cases-value')).toHaveTextContent('1.258');
      expect(screen.getByTestId('stat-new-cases-value')).toHaveTextContent('42');
      expect(screen.getByTestId('stat-overdue-cases-value')).toHaveTextContent('18');
      expect(screen.getByTestId('stat-processed-cases-value')).toHaveTextContent('1.198');
    });
  });

  it('should render chart containers', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('chart-trends')).toBeInTheDocument();
      expect(screen.getByTestId('chart-structure')).toBeInTheDocument();
    });
  });

  it('should display user info in header', () => {
    render(<DashboardPage />);
    
    expect(screen.getByText('test@pc02.gov.vn')).toBeInTheDocument();
    expect(screen.getByText('investigator')).toBeInTheDocument();
  });

  it('should handle refresh button click', async () => {
    render(<DashboardPage />);
    
    const refreshButton = screen.getByTestId('refresh-btn');
    expect(refreshButton).toBeInTheDocument();
    
    fireEvent.click(refreshButton);
    
    // Button should be disabled during loading
    await waitFor(() => {
      expect(refreshButton).toBeDisabled();
    });
    
    // Button should be re-enabled after loading
    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });
  });

  it('should render chart section headings', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Xu hướng theo tháng')).toBeInTheDocument();
      expect(screen.getByText('Cơ cấu trạng thái vụ án')).toBeInTheDocument();
    });
  });
});
