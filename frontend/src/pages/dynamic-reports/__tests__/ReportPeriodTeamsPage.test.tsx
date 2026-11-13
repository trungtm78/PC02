import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReportPeriodTeamsPage from '../ReportPeriodTeamsPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { api } from '@/lib/api';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
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
    unexemptTeamMidPeriod: vi.fn(),
    removeAddedTeamMidPeriod: vi.fn(),
    setAssignmentEditors: vi.fn(),
  },
}));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: vi.fn() }));

const OFFICERS = [
  { value: 'u1', label: 'Nguyễn Văn A', teams: [{ teamId: 'team-a1', teamName: 'Đội 3', isLeader: true, laDiaBan: false }] },
  { value: 'u2', label: 'Trần Thị B', teams: [{ teamId: 'team-a1', teamName: 'Đội 3', isLeader: false, laDiaBan: false }] },
  { value: 'u3', label: 'Lê Văn C', teams: [] },
];

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
  { assignmentId: 'a1', teamId: 'team-a1', teamName: 'Đội 3', obligation: 'REQUIRED', state: 'SUBMITTED', editors: [{ userId: 'u1', name: 'Nguyễn Văn A' }], addedMidPeriod: false, removable: false },
  { assignmentId: 'a2', teamId: 'team-a2', teamName: 'Đội 4', obligation: 'EXEMPT', state: 'NOT_STARTED', editors: [], addedMidPeriod: false, removable: false },
];

const TEAMS = [
  { id: 'team-a1', name: 'Đội 3', wardId: null },
  { id: 'team-a2', name: 'Đội 4', wardId: null },
  { id: 'team-new', name: 'Đội 5', wardId: null },
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
    vi.mocked(useOfficerOptions).mockReturnValue({ data: OFFICERS, isLoading: false } as never);
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

  it('loads the addable teams from /teams/options (the server returns active teams only)', async () => {
    renderPage();

    await waitFor(() => screen.getByTestId('assignment-row-a1'));
    expect(api.get).toHaveBeenCalledWith('/teams/options', expect.anything());
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
        undefined,
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

  describe('who types for a team in this period', () => {
    it('shows the editors of each team, and says when a team has none', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('assignment-row-a1'));

      expect(screen.getByTestId('editors-a1')).toHaveTextContent('Nguyễn Văn A');
      expect(screen.getByTestId('editors-a2')).toHaveTextContent('Chưa có người nhập');
    });

    it('"Đổi người nhập" starts from the current editors, needs at least one editor and a reason, then saves', async () => {
      vi.mocked(dynamicReportsApi.setAssignmentEditors).mockResolvedValue({
        assignmentId: 'a1', teamId: 'team-a1', teamName: 'Đội 3', obligation: 'REQUIRED', editorUserIds: ['u1', 'u2'],
      });
      renderPage();
      await waitFor(() => screen.getByTestId('btn-editors-a1'));

      fireEvent.click(screen.getByTestId('btn-editors-a1'));
      const panel = await screen.findByTestId('editors-panel');
      expect(panel).toHaveTextContent('Nguyễn Văn A');
      expect(screen.getByTestId('btn-confirm-editors')).toBeDisabled(); // no reason yet

      openAndSelect('editors-picker', 'u2');
      fireEvent.change(screen.getByTestId('editors-reason-input'), { target: { value: 'Cán bộ đi công tác' } });
      fireEvent.click(screen.getByTestId('btn-confirm-editors'));

      await waitFor(() =>
        expect(dynamicReportsApi.setAssignmentEditors).toHaveBeenCalledWith('period1', 'a1', ['u1', 'u2'], 'Cán bộ đi công tác'),
      );
      await waitFor(() => expect(dynamicReportsApi.listAssignments).toHaveBeenCalledTimes(2));
    });

    it('cannot confirm with every editor removed', async () => {
      renderPage();
      fireEvent.click(await screen.findByTestId('btn-editors-a1'));
      await screen.findByTestId('editors-panel');
      fireEvent.change(screen.getByTestId('editors-reason-input'), { target: { value: 'Lý do' } });
      expect(screen.getByTestId('btn-confirm-editors')).not.toBeDisabled();

      fireEvent.click(screen.getByTestId('btn-remove-editor-u1'));

      expect(screen.getByTestId('btn-confirm-editors')).toBeDisabled();
    });

    it('shows the reason the server gives when the change is refused', async () => {
      vi.mocked(dynamicReportsApi.setAssignmentEditors).mockRejectedValue(
        Object.assign(new Error('x'), {
          isAxiosError: true,
          response: { status: 400, data: { error: { code: 'EDITOR_INVALID', message: 'Có người được chọn đã bị khoá' } } },
        }),
      );
      renderPage();
      fireEvent.click(await screen.findByTestId('btn-editors-a1'));
      await screen.findByTestId('editors-panel');
      fireEvent.change(screen.getByTestId('editors-reason-input'), { target: { value: 'Lý do' } });
      fireEvent.click(screen.getByTestId('btn-confirm-editors'));

      expect(await screen.findByTestId('editors-error')).toHaveTextContent('đã bị khoá');
    });

    it('switching the team being added forgets the editors chosen for the previous team (found by Codex)', async () => {
      vi.mocked(dynamicReportsApi.previewAddTeam).mockResolvedValue(ADD_PREVIEW);
      vi.mocked(dynamicReportsApi.addTeamMidPeriod).mockResolvedValue({
        assignmentId: 'new1', teamId: 'team-b', teamName: 'Đội 6', obligation: 'REQUIRED',
      });
      vi.mocked(api.get).mockResolvedValue({
        data: [...TEAMS, { id: 'team-b', name: 'Đội 6', wardId: null }],
      });
      renderPage();
      await waitFor(() => screen.getByTestId('select-add-team-trigger'));
      openAndSelect('select-add-team', 'team-new');
      fireEvent.click(screen.getByTestId('btn-preview-add'));
      await waitFor(() => screen.getByTestId('impact-preview'));
      openAndSelect('add-editors-picker', 'u3');

      openAndSelect('select-add-team', 'team-b');
      fireEvent.click(screen.getByTestId('btn-preview-add'));
      await waitFor(() => screen.getByTestId('impact-preview'));
      fireEvent.change(screen.getByTestId('add-reason-input'), { target: { value: 'Bổ sung' } });
      fireEvent.click(screen.getByTestId('btn-confirm-add'));

      await waitFor(() =>
        expect(dynamicReportsApi.addTeamMidPeriod).toHaveBeenCalledWith('period1', 'team-b', 'Bổ sung', undefined),
      );
    });

    it('add-team sends the editors the manager chose', async () => {
      vi.mocked(dynamicReportsApi.previewAddTeam).mockResolvedValue(ADD_PREVIEW);
      vi.mocked(dynamicReportsApi.addTeamMidPeriod).mockResolvedValue({
        assignmentId: 'new1', teamId: 'team-new', teamName: 'Đội 5', obligation: 'REQUIRED',
      });
      renderPage();
      await waitFor(() => screen.getByTestId('select-add-team-trigger'));
      openAndSelect('select-add-team', 'team-new');
      fireEvent.click(screen.getByTestId('btn-preview-add'));
      await waitFor(() => screen.getByTestId('impact-preview'));

      openAndSelect('add-editors-picker', 'u3');
      fireEvent.change(screen.getByTestId('add-reason-input'), { target: { value: 'Bổ sung Tổ 5' } });
      fireEvent.click(screen.getByTestId('btn-confirm-add'));

      await waitFor(() =>
        expect(dynamicReportsApi.addTeamMidPeriod).toHaveBeenCalledWith('period1', 'team-new', 'Bổ sung Tổ 5', ['u3']),
      );
    });
  });

  describe('the way back (created => editable and deletable)', () => {
    const WITH_ADDED: AssignmentListItemView[] = [
      ...ASSIGNMENTS,
      { assignmentId: 'a3', teamId: 'team-new', teamName: 'Đội 5', obligation: 'REQUIRED', state: 'NOT_STARTED', editors: [], addedMidPeriod: true, removable: true },
      { assignmentId: 'a4', teamId: 'team-b', teamName: 'Đội 6', obligation: 'REQUIRED', state: 'DRAFT', editors: [], addedMidPeriod: true, removable: false },
    ];

    beforeEach(() => {
      vi.mocked(api.get).mockResolvedValue({ data: TEAMS });
    });

    it('an exempt team can be un-exempted; a team that is required cannot (it has "Miễn nộp" instead)', async () => {
      vi.mocked(dynamicReportsApi.listAssignments).mockResolvedValue(ASSIGNMENTS);
      renderPage();
      await waitFor(() => screen.getByTestId('assignment-row-a2'));

      expect(screen.getByTestId('btn-unexempt-a2')).toBeInTheDocument();
      expect(screen.queryByTestId('btn-unexempt-a1')).not.toBeInTheDocument();
      expect(screen.getByTestId('btn-exempt-a1')).toBeInTheDocument();
    });

    it('"Bỏ miễn nộp" asks first, then calls the API and reloads the list', async () => {
      vi.mocked(dynamicReportsApi.listAssignments).mockResolvedValue(ASSIGNMENTS);
      vi.mocked(dynamicReportsApi.unexemptTeamMidPeriod).mockResolvedValue({ assignmentId: 'a2', teamId: 'team-a2', teamName: 'Đội 4', obligation: 'REQUIRED' });
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
      renderPage();
      fireEvent.click(await screen.findByTestId('btn-unexempt-a2'));
      expect(dynamicReportsApi.unexemptTeamMidPeriod).not.toHaveBeenCalled();

      confirm.mockReturnValueOnce(true);
      fireEvent.click(screen.getByTestId('btn-unexempt-a2'));
      await waitFor(() => expect(dynamicReportsApi.unexemptTeamMidPeriod).toHaveBeenCalledWith('period1', 'a2'));
      await waitFor(() => expect(dynamicReportsApi.listAssignments).toHaveBeenCalledTimes(2));
    });

    it('"Gỡ tổ" only on a team added mid-period that nobody touched (removable); a touched one keeps just "Miễn nộp"', async () => {
      vi.mocked(dynamicReportsApi.listAssignments).mockResolvedValue(WITH_ADDED);
      renderPage();
      await screen.findByTestId('assignment-row-a3');

      expect(screen.getByTestId('added-badge-a3')).toBeInTheDocument();
      expect(screen.getByTestId('btn-remove-team-a3')).toBeInTheDocument();
      expect(screen.getByTestId('added-badge-a4')).toBeInTheDocument();
      expect(screen.queryByTestId('btn-remove-team-a4')).not.toBeInTheDocument();
      expect(screen.getByTestId('btn-exempt-a4')).toBeInTheDocument();
      expect(screen.queryByTestId('btn-remove-team-a1')).not.toBeInTheDocument();
    });

    it('removing asks first and calls the API; a refusal from the server is shown', async () => {
      vi.mocked(dynamicReportsApi.listAssignments).mockResolvedValue(WITH_ADDED);
      vi.mocked(dynamicReportsApi.removeAddedTeamMidPeriod).mockRejectedValueOnce(new Error('Tổ này đã có số liệu'));
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPage();
      fireEvent.click(await screen.findByTestId('btn-remove-team-a3'));

      expect(await screen.findByTestId('reverse-error')).toHaveTextContent('đã có số liệu');
      expect(dynamicReportsApi.removeAddedTeamMidPeriod).toHaveBeenCalledWith('period1', 'a3');
    });
  });
});
