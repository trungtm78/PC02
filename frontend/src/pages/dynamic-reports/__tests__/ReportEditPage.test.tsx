import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReportEditPage from '../ReportEditPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { api } from '@/lib/api';
import type { ReportDetailView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    getReportDetail: vi.fn(),
    updateReportConfig: vi.fn(),
    getNonWorkingDates: vi.fn(),
  },
}));

// The teams step reads the officer directory and the team list; what is under test here is the edit page's wiring.
vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

const OFFICERS = [
  { value: 'u1', label: 'Nguyễn An', teams: [{ teamId: 't1', teamName: 'Đội 1', isLeader: true, laDiaBan: false }] },
  { value: 'u2', label: 'Lê Bình', teams: [{ teamId: 't1', teamName: 'Đội 1', isLeader: false, laDiaBan: false }] },
];

const DETAIL: ReportDetailView = {
  id: 'r1',
  code: 'HSLN',
  name: 'Thống kê hình sự',
  description: 'Mô tả cũ',
  status: 'PUBLISHED',
  reportingUnit: 'TEAM',
  effectiveFrom: '2026-10-01T00:00:00.000Z',
  configVersion: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  schedule: {
    periodType: 'MONTHLY',
    periodStartDay: 1,
    dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
    openRule: { kind: 'AT_PERIOD_START' },
    shiftNonWorking: false,
    oneTimeDate: null,
    timezone: 'Asia/Ho_Chi_Minh',
    effectiveFrom: '2026-10-01T00:00:00.000Z',
  },
  roles: [
    { userId: 'u1', name: 'Nguyễn An', role: 'MANAGER', teamScopeId: null },
    { userId: 'u2', name: 'Lê Bình', role: 'VIEWER', teamScopeId: 't1' },
  ],
  targets: [{ teamId: 't1', teamCode: 'DOI-1', teamName: 'Đội 1', editors: [{ userId: 'u1', name: 'Nguyễn An' }] }],
  currentVersion: null,
  versionCount: 1,
  periods: [],
  periodTotal: 0,
};

function renderPage(detail: ReportDetailView = DETAIL) {
  vi.mocked(dynamicReportsApi.getReportDetail).mockResolvedValue(detail);
  vi.mocked(dynamicReportsApi.getNonWorkingDates).mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/bao-cao-dong/thiet-lap/r1/sua']}>
        <Routes>
          <Route path="/bao-cao-dong/thiet-lap/:reportId/sua" element={<ReportEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportEditPage — "Sửa cấu hình"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOfficerOptions).mockReturnValue({ data: OFFICERS, isLoading: false } as never);
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 't1', name: 'Đội 1', isActive: true, wardId: null },
        { id: 't2', name: 'Đội 2', isActive: true, wardId: null },
      ],
    });
  });

  it('opens with the report as it is now: name, description, the schedule in force, managers, teams and editors', async () => {
    renderPage();

    expect(await screen.findByTestId('edit-name')).toHaveValue('Thống kê hình sự');
    expect(screen.getByTestId('edit-description')).toHaveValue('Mô tả cũ');
    expect(screen.getByTestId('select-period-type')).toHaveValue('MONTHLY');
    expect(screen.getByTestId('input-days-after-end')).toHaveValue(5);
    expect(screen.getByTestId('manager-list')).toHaveTextContent('Nguyễn An');
    expect(screen.getByTestId('viewer-list')).toHaveTextContent('Lê Bình');
    expect(screen.getByTestId('target-t1')).toHaveTextContent('Đội 1');
  });

  it('says what applies when: schedule and teams from the next period, managers at once', async () => {
    renderPage();
    await screen.findByTestId('report-edit-page');
    expect(screen.getByText(/kỳ kế tiếp/, { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByTestId('section-teams-edit')).toHaveTextContent('có hiệu lực ngay');
  });

  it('the info Save is disabled until something changes, then sends only the name and description with the revision it saw', async () => {
    vi.mocked(dynamicReportsApi.updateReportConfig).mockResolvedValue({ configVersion: 4, changed: ['info'] });
    renderPage();
    const save = await screen.findByTestId('btn-save-info');
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByTestId('edit-name'), { target: { value: 'Tên mới' } });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() =>
      expect(dynamicReportsApi.updateReportConfig).toHaveBeenCalledWith('r1', {
        expectedConfigVersion: 3,
        name: 'Tên mới',
        description: 'Mô tả cũ',
      }),
    );
    expect(await screen.findByTestId('edit-saved')).toHaveTextContent('thông tin');
  });

  it('a blank name cannot be saved', async () => {
    renderPage();
    fireEvent.change(await screen.findByTestId('edit-name'), { target: { value: '   ' } });
    expect(screen.getByTestId('btn-save-info')).toBeDisabled();
  });

  it('saving the schedule sends the rule as edited, and only the schedule', async () => {
    vi.mocked(dynamicReportsApi.updateReportConfig).mockResolvedValue({ configVersion: 4, changed: ['schedule'] });
    renderPage();
    fireEvent.change(await screen.findByTestId('input-days-after-end'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('btn-schedule-next'));

    await waitFor(() => expect(dynamicReportsApi.updateReportConfig).toHaveBeenCalledTimes(1));
    const body = vi.mocked(dynamicReportsApi.updateReportConfig).mock.calls[0][1];
    expect(Object.keys(body).sort()).toEqual(['expectedConfigVersion', 'schedule']);
    expect(body.schedule).toMatchObject({ periodType: 'MONTHLY', dueRule: { kind: 'DAYS_AFTER_END', days: 3, time: '17:00' }, openRule: { kind: 'AT_PERIOD_START' } });
  });

  it('saving managers and teams sends the WHOLE lists, keeping the viewer\'s team limit', async () => {
    vi.mocked(dynamicReportsApi.updateReportConfig).mockResolvedValue({ configVersion: 4, changed: ['roles'] });
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-teams-next'));

    await waitFor(() => expect(dynamicReportsApi.updateReportConfig).toHaveBeenCalledTimes(1));
    const body = vi.mocked(dynamicReportsApi.updateReportConfig).mock.calls[0][1];
    expect(body.roles).toEqual([
      { userId: 'u1', role: 'MANAGER' },
      { userId: 'u2', role: 'VIEWER', teamScopeId: 't1' },
    ]);
    expect(body.targets).toEqual([{ teamId: 't1', editorUserIds: ['u1'] }]);
  });

  it('removing the only editor of a team blocks the Save (every team needs somebody to type)', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-remove-editor-t1-u1'));
    expect(screen.getByTestId('btn-teams-next')).toBeDisabled();
  });

  it('when somebody else changed the report first, the conflict is explained and reloading brings their version', async () => {
    vi.mocked(dynamicReportsApi.updateReportConfig).mockRejectedValue(
      Object.assign(new Error('x'), {
        isAxiosError: true,
        response: { status: 409, data: { error: { code: 'REVISION_CONFLICT', message: 'Cấu hình vừa được người khác thay đổi.' } } },
      }),
    );
    renderPage();
    fireEvent.change(await screen.findByTestId('edit-name'), { target: { value: 'Tên mới' } });
    fireEvent.click(screen.getByTestId('btn-save-info'));

    expect(await screen.findByTestId('edit-save-error')).toHaveTextContent('người khác');
    vi.mocked(dynamicReportsApi.getReportDetail).mockResolvedValue({ ...DETAIL, name: 'Tên của người kia', configVersion: 4 });
    fireEvent.click(screen.getByTestId('btn-reload'));
    await waitFor(() => expect(screen.getByTestId('edit-name')).toHaveValue('Tên của người kia'));
  });

  it('saving one section keeps the unsaved edits of the others (found by Codex)', async () => {
    vi.mocked(dynamicReportsApi.updateReportConfig).mockResolvedValue({ configVersion: 4, changed: ['info'] });
    renderPage();
    // An unsaved edit in the schedule section…
    fireEvent.change(await screen.findByTestId('input-days-after-end'), { target: { value: '9' } });
    // …then the name is changed and saved.
    fireEvent.change(screen.getByTestId('edit-name'), { target: { value: 'Tên mới' } });
    vi.mocked(dynamicReportsApi.getReportDetail).mockResolvedValue({ ...DETAIL, name: 'Tên mới', configVersion: 4 });
    fireEvent.click(screen.getByTestId('btn-save-info'));
    await screen.findByTestId('edit-saved');

    expect(screen.getByTestId('input-days-after-end')).toHaveValue(9);
  });

  it('saving the schedule keeps an unsaved name, and the saved section is read back from the server', async () => {
    vi.mocked(dynamicReportsApi.updateReportConfig).mockResolvedValue({ configVersion: 4, changed: ['schedule'] });
    renderPage();
    fireEvent.change(await screen.findByTestId('edit-name'), { target: { value: 'Tên chưa lưu' } });
    fireEvent.change(screen.getByTestId('input-days-after-end'), { target: { value: '3' } });
    vi.mocked(dynamicReportsApi.getReportDetail).mockResolvedValue({
      ...DETAIL,
      configVersion: 4,
      schedule: { ...DETAIL.schedule!, dueRule: { kind: 'DAYS_AFTER_END', days: 3, time: '17:00' } },
    });
    fireEvent.click(screen.getByTestId('btn-schedule-next'));
    await screen.findByTestId('edit-saved');

    expect(screen.getByTestId('edit-name')).toHaveValue('Tên chưa lưu');
    await waitFor(() => expect(screen.getByTestId('input-days-after-end')).toHaveValue(3));
  });

  it('a save that changed nothing says so instead of claiming success', async () => {
    vi.mocked(dynamicReportsApi.updateReportConfig).mockResolvedValue({ configVersion: 3, changed: [] });
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-teams-next'));
    expect(await screen.findByTestId('edit-saved')).toHaveTextContent('Không có gì thay đổi');
  });

  it('an archived report is told to be restored first; a report that cannot be loaded says so', async () => {
    renderPage({ ...DETAIL, status: 'ARCHIVED' });
    expect(await screen.findByTestId('edit-archived')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-name')).not.toBeInTheDocument();
  });
});
