import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReportPeriodTeamsPage from '../ReportPeriodTeamsPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { api } from '@/lib/api';
import type {
  AssignmentListItemView,
  MidPeriodImpactPreview,
} from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    listAssignments: vi.fn(),
    previewAddTeam: vi.fn(),
    addTeamMidPeriod: vi.fn(),
    previewExemptTeam: vi.fn(),
    exemptTeamMidPeriod: vi.fn(),
  },
}));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/bao-cao-dong/duyet/tong-hop/period1/to']}>
        <Routes>
          <Route
            path="/bao-cao-dong/duyet/tong-hop/:periodId/to"
            element={<ReportPeriodTeamsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function openAndSelect(testId: string, optionValue: string) {
  fireEvent.click(screen.getByTestId(`${testId}-trigger`));
  fireEvent.click(screen.getByTestId(`${testId}-option-${optionValue}`));
}

const ASSIGNMENTS: AssignmentListItemView[] = [
  { assignmentId: 'a1', teamId: 'team-a1', teamName: 'Đội 3', obligation: 'REQUIRED', state: 'SUBMITTED' },
  { assignmentId: 'a2', teamId: 'team-a2', teamName: 'Đội 4', obligation: 'EXEMPT', state: 'NOT_STARTED' },
];

const TEAMS = [
  { id: 'team-a1', name: 'Đội 3', isActive: true, wardId: null },
  { id: 'team-a2', name: 'Đội 4', isActive: true, wardId: null },
  { id: 'team-new', name: 'Đội 5', isActive: true, wardId: null },
];

const ADD_PREVIEW: MidPeriodImpactPreview = {
  periodId: 'period1',
  teamId: 'team-new',
  teamName: 'Đội 5',
  requiredCountBefore: 1,
  requiredCountAfter: 2,
  contributingCountBefore: 1,
  contributingCountAfter: 1,
  fields: [
    {
      fieldKey: 'Đội 3!C6',
      label: 'Số vụ mới',
      beforeCountTotal: 1,
      afterCountTotal: 1,
      beforeValue: '10',
      afterValue: '10',
    },
  ],
};

const EXEMPT_PREVIEW: MidPeriodImpactPreview = {
  periodId: 'period1',
  teamId: 'team-a1',
  teamName: 'Đội 3',
  requiredCountBefore: 1,
  requiredCountAfter: 0,
  contributingCountBefore: 1,
  contributingCountAfter: 0,
  fields: [
    {
      fieldKey: 'Đội 3!C6',
      label: 'Số vụ mới',
      beforeCountTotal: 1,
      afterCountTotal: 0,
      beforeValue: '10',
      afterValue: null,
    },
  ],
};

describe('ReportPeriodTeamsPage (S30)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: TEAMS });
    vi.mocked(dynamicReportsApi.listAssignments).mockResolvedValue(ASSIGNMENTS);
  });

  it('lists every assignment with team name, state badge, and obligation badge', async () => {
    renderPage();

    await waitFor(() => screen.getByTestId('assignment-row-a1'));
    expect(screen.getByTestId('assignment-row-a1')).toHaveTextContent('Đội 3');
    expect(screen.getByTestId('assignment-row-a1')).toHaveTextContent('Phải nộp');
    expect(screen.getByTestId('assignment-row-a2')).toHaveTextContent('Miễn nộp');
    // Already-EXEMPT team has no "Miễn nộp" button.
    expect(screen.queryByTestId('btn-exempt-a2')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-exempt-a1')).toBeInTheDocument();
  });

  it('shows the empty state when the period has no assignments yet', async () => {
    vi.mocked(dynamicReportsApi.listAssignments).mockResolvedValue([]);
    renderPage();

    await waitFor(() => screen.getByTestId('assignments-empty'));
  });

  it('"Thêm tổ" only offers teams not already assigned to this period', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('select-add-team-trigger'));

    fireEvent.click(screen.getByTestId('select-add-team-trigger'));
    expect(screen.getByTestId('select-add-team-option-team-new')).toBeInTheDocument();
    expect(screen.queryByTestId('select-add-team-option-team-a1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('select-add-team-option-team-a2')).not.toBeInTheDocument();
  });

  it('add-team flow: pick team → preview → reason required → confirm → refetch', async () => {
    vi.mocked(dynamicReportsApi.previewAddTeam).mockResolvedValue(ADD_PREVIEW);
    vi.mocked(dynamicReportsApi.addTeamMidPeriod).mockResolvedValue({
      assignmentId: 'new1',
      teamId: 'team-new',
      teamName: 'Đội 5',
      obligation: 'REQUIRED',
    });
    renderPage();
    await waitFor(() => screen.getByTestId('select-add-team-trigger'));

    openAndSelect('select-add-team', 'team-new');
    fireEvent.click(screen.getByTestId('btn-preview-add'));

    await waitFor(() => screen.getByTestId('impact-preview'));
    expect(dynamicReportsApi.previewAddTeam).toHaveBeenCalledWith('period1', 'team-new');
    expect(screen.getByTestId('required-count-diff')).toHaveTextContent('1 → 2');

    // Confirm disabled until a reason is typed.
    expect(screen.getByTestId('btn-confirm-add')).toBeDisabled();
    fireEvent.change(screen.getByTestId('add-reason-input'), {
      target: { value: 'Chia tách địa bàn, bổ sung Tổ 5' },
    });
    expect(screen.getByTestId('btn-confirm-add')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('btn-confirm-add'));
    await waitFor(() => {
      expect(dynamicReportsApi.addTeamMidPeriod).toHaveBeenCalledWith(
        'period1',
        'team-new',
        'Chia tách địa bàn, bổ sung Tổ 5',
      );
    });
    // Refetches the assignment list after success (same queryKey).
    await waitFor(() => {
      expect(dynamicReportsApi.listAssignments).toHaveBeenCalledTimes(2);
    });
  });

  it('add-team flow shows an error note when the preview call fails', async () => {
    vi.mocked(dynamicReportsApi.previewAddTeam).mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => screen.getByTestId('select-add-team-trigger'));

    openAndSelect('select-add-team', 'team-new');
    fireEvent.click(screen.getByTestId('btn-preview-add'));

    await waitFor(() => screen.getByTestId('add-error'));
  });

  it('exempt-team flow: click "Miễn nộp" → preview → reason required → confirm → refetch', async () => {
    vi.mocked(dynamicReportsApi.previewExemptTeam).mockResolvedValue(EXEMPT_PREVIEW);
    vi.mocked(dynamicReportsApi.exemptTeamMidPeriod).mockResolvedValue({
      assignmentId: 'a1',
      teamId: 'team-a1',
      teamName: 'Đội 3',
      obligation: 'EXEMPT',
    });
    renderPage();
    await waitFor(() => screen.getByTestId('btn-exempt-a1'));

    fireEvent.click(screen.getByTestId('btn-exempt-a1'));
    fireEvent.click(screen.getByTestId('btn-preview-exempt'));

    await waitFor(() => screen.getByTestId('impact-preview'));
    expect(dynamicReportsApi.previewExemptTeam).toHaveBeenCalledWith('period1', 'a1');
    expect(screen.getByTestId('required-count-diff')).toHaveTextContent('1 → 0');

    expect(screen.getByTestId('btn-confirm-exempt')).toBeDisabled();
    fireEvent.change(screen.getByTestId('exempt-reason-input'), {
      target: { value: 'Tổ giải thể, không còn hoạt động' },
    });
    fireEvent.click(screen.getByTestId('btn-confirm-exempt'));

    await waitFor(() => {
      expect(dynamicReportsApi.exemptTeamMidPeriod).toHaveBeenCalledWith(
        'period1',
        'a1',
        'Tổ giải thể, không còn hoạt động',
      );
    });
    await waitFor(() => {
      expect(dynamicReportsApi.listAssignments).toHaveBeenCalledTimes(2);
    });
  });

  it('"Huỷ" closes the exempt panel without calling the API', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('btn-exempt-a1'));

    fireEvent.click(screen.getByTestId('btn-exempt-a1'));
    await waitFor(() => screen.getByTestId('exempt-panel'));
    fireEvent.click(screen.getByText('Huỷ'));

    expect(screen.queryByTestId('exempt-panel')).not.toBeInTheDocument();
    expect(dynamicReportsApi.previewExemptTeam).not.toHaveBeenCalled();
  });
});
