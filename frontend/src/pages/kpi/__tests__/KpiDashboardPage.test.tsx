import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import KpiDashboardPage from '../KpiDashboardPage';

vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const makeKpi = (kpi: 1 | 2 | 3 | 4, value: number, status: 'PASS' | 'FAIL' | 'WARNING' | 'N_A', noData = false) => ({
  kpi,
  label: `KPI-${kpi} label`,
  target: 90,
  value,
  status,
  numerator: value,
  denominator: 100,
  noData,
});

const FAKE_SUMMARY = {
  period: { year: 2026 },
  kpi1: makeKpi(1, 100, 'PASS'),
  kpi2: makeKpi(2, 92, 'PASS'),
  kpi3: makeKpi(3, 75, 'FAIL'),
  kpi4: makeKpi(4, 96, 'PASS'),
};

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '@/lib/api';

describe('KpiDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and shows loading initially', () => {
    (api.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<KpiDashboardPage />);
    expect(screen.getByText('Chỉ tiêu KPI Công tác Điều tra')).toBeInTheDocument();
    expect(screen.getByText('Đang tải...')).toBeInTheDocument();
  });

  it('renders 4 KPI cards after successful API response', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/kpi/summary')) return Promise.resolve({ data: FAKE_SUMMARY });
      if (url.includes('/kpi/by-team')) return Promise.resolve({ data: [] });
      if (url.includes('/kpi/trend')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: null });
    });

    render(<KpiDashboardPage />);

    await waitFor(() => {
      expect(screen.queryByText('Đang tải...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('96%')).toBeInTheDocument();
  });

  it('shows N_A dash when noData=true on a KPI card', async () => {
    const noDataSummary = {
      ...FAKE_SUMMARY,
      kpi1: makeKpi(1, 0, 'N_A', true),
    };
    (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/kpi/summary')) return Promise.resolve({ data: noDataSummary });
      if (url.includes('/kpi/by-team')) return Promise.resolve({ data: [] });
      if (url.includes('/kpi/trend')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: null });
    });

    render(<KpiDashboardPage />);

    await waitFor(() => {
      expect(screen.queryByText('Đang tải...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('clears data and hides cards on API error', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    render(<KpiDashboardPage />);

    await waitFor(() => {
      expect(screen.queryByText('Đang tải...')).not.toBeInTheDocument();
    });

    // Cards should not appear (summary is null after error)
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
  });
});
