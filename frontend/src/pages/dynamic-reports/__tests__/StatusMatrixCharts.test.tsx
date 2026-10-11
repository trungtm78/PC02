import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatusMatrixCharts from '../StatusMatrixCharts';
import type { StatusMatrixView } from '@/features/dynamic-reports/types';

vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const MATRIX: StatusMatrixView = {
  periods: [{ periodId: 'p1', periodKey: '2026-06', dueAt: '2026-07-05T17:00:00.000Z' }],
  teams: [{ teamId: 'team1', teamName: 'Đội 1' }],
  cells: {
    team1: {
      p1: {
        notAssigned: false,
        state: 'APPROVED',
        accessState: 'LOCKED',
        timelinessState: 'ON_TIME',
        exempt: false,
        dueAt: '2026-07-05T17:00:00.000Z',
      },
    },
  },
  asOf: '2026-07-01T10:00:00.000Z',
};

const EMPTY_MATRIX: StatusMatrixView = { periods: [], teams: [], cells: {}, asOf: '2026-07-01T10:00:00.000Z' };

describe('StatusMatrixCharts', () => {
  it('renders both chart sections by default', () => {
    render(<StatusMatrixCharts matrix={MATRIX} />);

    expect(screen.getByTestId('status-matrix-charts-body')).toBeInTheDocument();
    expect(screen.getByTestId('chart-team-bar')).toBeInTheDocument();
    expect(screen.getByTestId('chart-period-trend')).toBeInTheDocument();
  });

  it('collapses and expands when the toggle button is clicked ("thu gọn được")', () => {
    render(<StatusMatrixCharts matrix={MATRIX} />);

    fireEvent.click(screen.getByTestId('btn-toggle-charts'));
    expect(screen.queryByTestId('status-matrix-charts-body')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-toggle-charts'));
    expect(screen.getByTestId('status-matrix-charts-body')).toBeInTheDocument();
  });

  it('shows an empty hint instead of a chart when there are no teams/periods', () => {
    render(<StatusMatrixCharts matrix={EMPTY_MATRIX} />);

    expect(screen.getByText('Không có tổ nào để hiện.')).toBeInTheDocument();
    expect(screen.getByText('Không có kỳ nào để hiện.')).toBeInTheDocument();
  });
});
