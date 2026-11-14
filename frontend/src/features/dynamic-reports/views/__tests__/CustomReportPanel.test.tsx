import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CustomReportPanel from '../CustomReportPanel';
import { reportViewsApi, reportViewsKey } from '../api';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { reportCriteria } from '@/locales/reportCriteria.vi';
import type { AssignmentListItemView, PeriodCriteriaView, SummaryMode } from '@/features/dynamic-reports/types';
import type { CustomReportPreview, ReportViewDto } from '../types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { loadPeriodCriteria: vi.fn(), listAssignments: vi.fn(), downloadExport: vi.fn() },
}));
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  reportViewsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    remove: vi.fn(),
    preview: vi.fn(),
    createExport: vi.fn(),
    listTeamDirectory: vi.fn(),
  },
}));

const t = reportCriteria.customReport;

const CRITERIA: PeriodCriteriaView = {
  criteria: [
    { itemKey: 'tin-moi', fieldKey: 'S!C2', code: '1.1', label: 'Tin mới', unit: 'tin', parentItemKey: 'tin' },
    { itemKey: 'tin-cu', fieldKey: 'S!C3', code: '1.2', label: 'Tin cũ', unit: 'tin', parentItemKey: 'tin' },
    { itemKey: 'an', fieldKey: 'S!C4', code: '2', label: 'Số vụ án', unit: 'vụ', parentItemKey: null },
  ],
  groups: [{ itemKey: 'tin', code: 'I', name: 'Tin báo', parentItemKey: null }],
  assignments: [],
};

const assignment = (teamId: string, teamName: string): AssignmentListItemView => ({
  assignmentId: `a-${teamId}`,
  teamId,
  teamName,
  obligation: 'REQUIRED',
  state: 'SUBMITTED',
  editors: [],
  addedMidPeriod: false,
  removable: false,
});
const ASSIGNMENTS = [assignment('t2', 'Tổ 2'), assignment('d1', 'Đội 1'), assignment('t1', 'Tổ 1'), assignment('t3', 'Tổ 3')];
const DIRECTORY = [
  { id: 'd1', name: 'Đội 1', parentId: null },
  { id: 't1', name: 'Tổ 1', parentId: 'd1' },
  { id: 't2', name: 'Tổ 2', parentId: 'd1' },
  { id: 't3', name: 'Tổ 3', parentId: null },
];

const view = (over: Partial<ReportViewDto> = {}): ReportViewDto => ({
  id: 'v1',
  reportId: 'report1',
  name: 'Gửi Ban Giám đốc',
  title: 'Tình hình tin báo',
  showFilterLine: true,
  itemKeys: ['tin-moi', 'an'],
  teamIds: ['t1', 't3'],
  teamColumns: true,
  revision: 4,
  archivedAt: null,
  createdAt: '2026-11-01T02:00:00.000Z',
  updatedAt: '2026-11-10T03:30:00.000Z',
  createdBy: { id: 'u1', name: 'Nguyễn Văn A' },
  updatedBy: { id: 'u2', name: 'Trần Thị B' },
  ...over,
});

const PREVIEW: CustomReportPreview = {
  periodId: 'period1',
  reportId: 'report1',
  viewId: null,
  title: 'HSLN — kỳ 2026-06',
  mode: 'SUBMITTED',
  periodStatus: 'OPEN',
  filterLine: 'the line of the file',
  columns: [],
  teams: [
    { teamId: 't1', name: 'Tổ 1' },
    { teamId: 't2', name: 'Tổ 2' },
  ],
  rows: [
    {
      kind: 'GROUP', itemKey: 'tin', code: 'I', label: 'Tin báo', unit: null, depth: 0, type: 'NUM', total: '30', totalMark: null,
      cells: [{ value: '10', mark: null }, { value: null, mark: 'NOT_COUNTED' }],
      partial: true,
    },
    {
      kind: 'CRITERION', itemKey: 'tin-moi', code: '1.1', label: 'Tin mới', unit: 'tin', depth: 1, type: 'NUM', total: '12', totalMark: null,
      cells: [{ value: '12', mark: null }, { value: null, mark: 'EXEMPT' }],
    },
    {
      kind: 'CRITERION', itemKey: 'an', code: '2', label: 'Số vụ án', unit: 'vụ', depth: 0, type: 'TEXT', total: null, totalMark: 'NOT_AGGREGATED',
      cells: [{ value: null, mark: 'NOT_ASSIGNED' }, { value: null, mark: 'BLANK' }],
    },
  ],
  notes: [
    { code: 'PERIOD_OPEN', params: { mode: 'SUBMITTED' } },
    { code: 'GROUP_INCLUDES_UNLISTED', params: { code: 'I', label: 'Tin báo', listed: 1, total: 2 } },
  ],
  ignored: { itemKeys: [], teamIds: [], teams: [] },
  newCriteria: 0,
  counts: { criteria: { selected: 2, total: 3 }, teams: { selected: 2, total: 4 } },
};

const refusal = (status: number, code: string) => ({
  isAxiosError: true,
  response: { status, data: { success: false, code, error: { code, message: code, details: [] } } },
});

const FULL_DEFINITION = { title: null, showFilterLine: true, itemKeys: null, teamIds: null, teamColumns: true };

type PeriodStatus = 'OPEN' | 'FINALIZED';

function renderPanel(mode: SummaryMode = 'SUBMITTED') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (m: SummaryMode, status: PeriodStatus) => (
    <QueryClientProvider client={client}>
      <CustomReportPanel reportId="report1" periodId="period1" mode={m} periodStatus={status} previewDelayMs={0} />
    </QueryClientProvider>
  );
  const utils = render(ui(mode, 'OPEN'));
  return {
    ...utils,
    client,
    setMode: (m: SummaryMode) => utils.rerender(ui(m, 'OPEN')),
    setPeriodStatus: (status: PeriodStatus) => utils.rerender(ui(mode, status)),
  };
}

/** A promise settled by the test: what is on the screen while the server has not answered yet. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const exportButton = () => screen.getByTestId('custom-report-export');
/** The export waits for the preview of exactly what is on the screen. */
const exportReady = () => waitFor(() => expect(exportButton()).toBeEnabled());

const criterion = (key: string) => screen.getByTestId(`custom-report-criteria-item-${key}`) as HTMLInputElement;
const team = (id: string) => screen.getByTestId(`custom-report-team-${id}`) as HTMLInputElement;
const lastPreviewBody = () => vi.mocked(reportViewsApi.preview).mock.calls.at(-1)?.[1];

/** Opens the builder of a new report and waits until both lists are drawn. */
async function openNew() {
  fireEvent.click(await screen.findByTestId('custom-report-create'));
  await waitFor(() => expect(criterion('tin-moi')).toBeInTheDocument());
  await waitFor(() => expect(team('t1')).toBeInTheDocument());
}

async function openSaved(id = 'v1') {
  fireEvent.click(await screen.findByTestId(`custom-report-open-${id}`));
  await waitFor(() => expect(criterion('tin-moi')).toBeInTheDocument());
  await waitFor(() => expect(team('t1')).toBeInTheDocument());
}

describe('CustomReportPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(reportViewsApi.list).mockResolvedValue([]);
    vi.mocked(reportViewsApi.preview).mockResolvedValue(PREVIEW);
    vi.mocked(reportViewsApi.listTeamDirectory).mockResolvedValue(DIRECTORY);
    vi.mocked(dynamicReportsApi.loadPeriodCriteria).mockResolvedValue(CRITERIA);
    vi.mocked(dynamicReportsApi.listAssignments).mockResolvedValue(ASSIGNMENTS);
    vi.mocked(dynamicReportsApi.downloadExport).mockResolvedValue(undefined);
  });

  describe('the section', () => {
    it('stays out of sight, without an error, for somebody the server answers 404', async () => {
      vi.mocked(reportViewsApi.list).mockRejectedValue(refusal(404, 'REPORT_NOT_FOUND'));
      const { container, client } = renderPanel();
      await waitFor(() => expect(reportViewsApi.list).toHaveBeenCalledWith('report1'));
      // The answer has arrived (the section is also empty while it waits: that would prove nothing).
      await waitFor(() => expect(client.getQueryState(reportViewsKey('report1'))?.status).toBe('error'));
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByTestId('custom-report-panel')).not.toBeInTheDocument();
    });

    it('a list that could not be loaded for another reason says so and can be tried again', async () => {
      vi.mocked(reportViewsApi.list).mockRejectedValueOnce(refusal(500, 'INTERNAL'));
      renderPanel();
      expect(await screen.findByTestId('custom-report-load-error')).toHaveTextContent(t.loadError);
      expect(screen.queryByTestId('custom-report-empty')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('custom-report-load-retry'));
      expect(await screen.findByTestId('custom-report-empty')).toHaveTextContent(t.empty);
    });

    it('lists the saved reports with what they hold and who changed them last; archived ones behind a switch', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([
        view(),
        view({ id: 'v2', name: 'Toàn bộ', itemKeys: null, teamIds: null, updatedBy: null }),
        view({ id: 'v3', name: 'Bản cũ', archivedAt: '2026-11-11T00:00:00.000Z' }),
      ]);
      renderPanel();
      const first = await screen.findByTestId('custom-report-view-v1');
      expect(screen.getByTestId('custom-report-panel')).toHaveTextContent(t.heading);
      expect(first).toHaveTextContent('Gửi Ban Giám đốc');
      expect(first).toHaveTextContent('2 tiêu chí · 2 tổ');
      expect(first).toHaveTextContent('Trần Thị B');
      expect(screen.getByTestId('custom-report-view-v2')).toHaveTextContent('Tất cả tiêu chí · Tất cả tổ');

      expect(screen.queryByTestId('custom-report-view-v3')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('custom-report-toggle-archived'));
      const old = screen.getByTestId('custom-report-view-v3');
      expect(within(old).getByTestId('custom-report-restore-v3')).toBeInTheDocument();
      expect(within(old).getByTestId('custom-report-delete-v3')).toBeInTheDocument();
      expect(within(old).queryByTestId('custom-report-open-v3')).not.toBeInTheDocument();
    });
  });

  describe('a new report', () => {
    it('opens with every criterion and every team ticked, and asks for "all" as null', async () => {
      renderPanel();
      await openNew();
      for (const key of ['tin-moi', 'tin-cu', 'an']) expect(criterion(key).checked).toBe(true);
      for (const id of ['d1', 't1', 't2', 't3']) expect(team(id).checked).toBe(true);
      expect(screen.getByTestId('custom-report-criteria-count')).toHaveTextContent('Đã chọn 3/3');
      expect(screen.getByTestId('custom-report-teams-count')).toHaveTextContent('Đã chọn 4/4 tổ');
      expect((screen.getByTestId('custom-report-show-filter-line') as HTMLInputElement).checked).toBe(true);
      expect((screen.getByTestId('custom-report-team-columns') as HTMLInputElement).checked).toBe(true);

      await waitFor(() => expect(reportViewsApi.preview).toHaveBeenCalled());
      expect(reportViewsApi.preview).toHaveBeenCalledWith('period1', { viewId: null, definition: FULL_DEFINITION, mode: 'SUBMITTED' });
    });

    it('unticking sends the lists that are left; ticking everything again goes back to null', async () => {
      renderPanel();
      await openNew();
      fireEvent.click(criterion('tin-cu'));
      fireEvent.click(team('t3'));
      await waitFor(() =>
        expect(lastPreviewBody()).toEqual({
          viewId: null,
          definition: { ...FULL_DEFINITION, itemKeys: ['tin-moi', 'an'], teamIds: ['d1', 't1', 't2'] },
          mode: 'SUBMITTED',
        }),
      );
      expect(screen.getByTestId('custom-report-criteria-count')).toHaveTextContent('Đã chọn 2/3');
      expect(screen.getByTestId('custom-report-teams-count')).toHaveTextContent('Đã chọn 3/4 tổ');

      fireEvent.click(criterion('tin-cu'));
      fireEvent.click(team('t3'));
      await waitFor(() => expect(lastPreviewBody()).toEqual({ viewId: null, definition: FULL_DEFINITION, mode: 'SUBMITTED' }));
    });

    it('a parent team carries the teams under it; a team under it is ticked by itself', async () => {
      renderPanel();
      await openNew();
      await waitFor(() => expect(team('t1').closest('li')).toHaveAttribute('data-depth', '1'));
      fireEvent.click(team('d1'));
      expect(team('d1').checked).toBe(false);
      expect(team('t1').checked).toBe(false);
      expect(team('t2').checked).toBe(false);
      expect(team('t3').checked).toBe(true);

      fireEvent.click(team('d1'));
      expect(team('t1').checked).toBe(true);
      expect(team('t2').checked).toBe(true);

      fireEvent.click(team('t2'));
      expect(team('d1').checked).toBe(true);
      expect(team('t2').checked).toBe(false);
    });

    it('the group box, "Bỏ hết", "Chọn hết", "Đảo chọn" and the search work on the criteria', async () => {
      renderPanel();
      await openNew();
      fireEvent.click(screen.getByTestId('custom-report-criteria-group-tin'));
      expect(criterion('tin-moi').checked).toBe(false);
      expect(criterion('tin-cu').checked).toBe(false);
      expect(criterion('an').checked).toBe(true);
      fireEvent.click(screen.getByTestId('custom-report-criteria-invert'));
      expect(criterion('tin-moi').checked).toBe(true);
      expect(criterion('an').checked).toBe(false);
      fireEvent.click(screen.getByTestId('custom-report-criteria-all'));
      expect(criterion('an').checked).toBe(true);
      fireEvent.change(screen.getByTestId('custom-report-criteria-search'), { target: { value: 'vu an' } });
      expect(screen.queryByTestId('custom-report-criteria-item-tin-moi')).not.toBeInTheDocument();
      expect(criterion('an')).toBeInTheDocument();
    });

    it('"Bỏ hết" and "Chọn hết" of the teams, and the search', async () => {
      renderPanel();
      await openNew();
      fireEvent.click(screen.getByTestId('custom-report-teams-none'));
      expect(screen.getByTestId('custom-report-teams-count')).toHaveTextContent('Đã chọn 0/4 tổ');
      fireEvent.click(screen.getByTestId('custom-report-teams-all'));
      expect(screen.getByTestId('custom-report-teams-count')).toHaveTextContent('Đã chọn 4/4 tổ');
      fireEvent.change(screen.getByTestId('custom-report-teams-search'), { target: { value: 'to 3' } });
      expect(screen.queryByTestId('custom-report-team-t1')).not.toBeInTheDocument();
      expect(team('t3')).toBeInTheDocument();
    });

    it('cannot be saved without a name, and says why', async () => {
      renderPanel();
      await openNew();
      expect(screen.getByTestId('custom-report-save')).toBeDisabled();
      expect(screen.getByTestId('custom-report-save-reason')).toHaveTextContent(t.builder.nameNeeded);
      await exportReady();
      fireEvent.change(screen.getByTestId('custom-report-name'), { target: { value: 'Báo cáo tuần' } });
      expect(screen.getByTestId('custom-report-save')).toBeEnabled();
      expect(screen.queryByTestId('custom-report-save-reason')).not.toBeInTheDocument();
    });

    it('with no criterion ticked: export and save are disabled, the reason is shown, nothing is asked', async () => {
      renderPanel();
      await openNew();
      fireEvent.change(screen.getByTestId('custom-report-name'), { target: { value: 'Báo cáo tuần' } });
      await waitFor(() => expect(reportViewsApi.preview).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTestId('custom-report-criteria-none'));
      expect(screen.getByTestId('custom-report-block-reason')).toHaveTextContent(t.builder.noCriteriaTicked);
      expect(screen.getByTestId('custom-report-export')).toBeDisabled();
      expect(screen.getByTestId('custom-report-save')).toBeDisabled();
      expect(screen.queryByTestId('custom-report-preview')).not.toBeInTheDocument();
      expect(reportViewsApi.preview).toHaveBeenCalledTimes(1);
    });

    it('with no team ticked: export and save are disabled and the reason is shown', async () => {
      renderPanel();
      await openNew();
      fireEvent.change(screen.getByTestId('custom-report-name'), { target: { value: 'Báo cáo tuần' } });
      fireEvent.click(screen.getByTestId('custom-report-teams-none'));
      expect(screen.getByTestId('custom-report-block-reason')).toHaveTextContent(t.builder.noTeamsTicked);
      expect(screen.getByTestId('custom-report-export')).toBeDisabled();
      expect(screen.getByTestId('custom-report-save')).toBeDisabled();
    });

    it('lists that cannot be loaded are not shown as empty', async () => {
      vi.mocked(dynamicReportsApi.loadPeriodCriteria).mockRejectedValueOnce(new Error('down'));
      renderPanel();
      fireEvent.click(await screen.findByTestId('custom-report-create'));
      expect(await screen.findByTestId('custom-report-lists-error')).toHaveTextContent(t.builder.listsError);
      expect(screen.getByTestId('custom-report-export')).toBeDisabled();
      fireEvent.click(screen.getByTestId('custom-report-lists-retry'));
      await waitFor(() => expect(criterion('tin-moi')).toBeInTheDocument());
    });

    it('without the team directory the teams are still there, as a flat list', async () => {
      vi.mocked(reportViewsApi.listTeamDirectory).mockRejectedValue(new Error('no rights'));
      renderPanel();
      await openNew();
      expect(team('t1').closest('li')).toHaveAttribute('data-depth', '0');
      expect(screen.getByTestId('custom-report-teams-count')).toHaveTextContent('Đã chọn 4/4 tổ');
    });
  });

  describe('the preview', () => {
    it('shows the title, the filter line worded here, rows with their depth, marks and notes', async () => {
      renderPanel();
      await openNew();
      const table = await screen.findByTestId('custom-report-preview-table');
      expect(screen.getByTestId('custom-report-preview-title')).toHaveTextContent('HSLN — kỳ 2026-06');
      expect(screen.getByTestId('custom-report-preview-filter-line')).toHaveTextContent(
        'Đơn vị: Tổ 1, Tổ 2 (2/4 tổ) · Số liệu: đã nộp + đã duyệt',
      );
      expect(screen.getByTestId('custom-report-preview')).not.toHaveTextContent('the line of the file');
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Mã', 'Tiêu chí', 'ĐVT', 'Tổng', 'Tổ 1', 'Tổ 2']);

      const group = screen.getByTestId('custom-report-row-tin');
      expect(group).toHaveAttribute('data-kind', 'GROUP');
      expect(group).toHaveAttribute('data-depth', '0');
      expect(group.className).toContain('font-semibold');
      expect(screen.getByTestId('custom-report-partial-tin')).toHaveTextContent(t.preview.partialTag);
      expect(screen.getByTestId('custom-report-total-tin')).toHaveTextContent('30');

      const child = screen.getByTestId('custom-report-row-tin-moi');
      expect(child).toHaveAttribute('data-depth', '1');
      expect(child).toHaveTextContent('1.1');
      expect(child).toHaveTextContent('tin');
      expect(screen.queryByTestId('custom-report-partial-tin-moi')).not.toBeInTheDocument();

      expect(screen.getByTestId('custom-report-cell-tin-moi-t1')).toHaveTextContent('12');
      expect(screen.getByTestId('custom-report-cell-tin-moi-t2')).toHaveTextContent('miễn nộp');
      expect(screen.getByTestId('custom-report-cell-tin-t2')).toHaveTextContent('chưa nộp');
      expect(screen.getByTestId('custom-report-cell-an-t1')).toHaveTextContent('—');
      expect(screen.getByTestId('custom-report-cell-an-t2')).toBeEmptyDOMElement();
      expect(screen.getByTestId('custom-report-total-an')).toBeEmptyDOMElement();

      expect(screen.getByTestId('custom-report-note-PERIOD_OPEN')).toHaveTextContent('chưa khoá sổ');
      expect(screen.getByTestId('custom-report-note-GROUP_INCLUDES_UNLISTED')).toHaveTextContent('"I Tin báo"');
      expect(screen.queryByTestId('custom-report-ignored-teams')).not.toBeInTheDocument();
      expect(screen.queryByTestId('custom-report-new-criteria')).not.toBeInTheDocument();
      // The placeholder of the title is the title the system made.
      await waitFor(() => expect(screen.getByTestId('custom-report-title')).toHaveAttribute('placeholder', 'HSLN — kỳ 2026-06'));
    });

    it('a team not counted is "chưa duyệt" when only approved figures count', async () => {
      vi.mocked(reportViewsApi.preview).mockResolvedValue({ ...PREVIEW, mode: 'APPROVED' });
      renderPanel('APPROVED');
      await openNew();
      expect(await screen.findByTestId('custom-report-cell-tin-t2')).toHaveTextContent('chưa duyệt');
      expect(lastPreviewBody()).toMatchObject({ mode: 'APPROVED' });
    });

    it('is asked again with the new mode when the mode of the page changes', async () => {
      const { setMode } = renderPanel();
      await openNew();
      await waitFor(() => expect(reportViewsApi.preview).toHaveBeenCalledTimes(1));
      setMode('ALL_SAVED');
      await waitFor(() => expect(lastPreviewBody()).toEqual({ viewId: null, definition: FULL_DEFINITION, mode: 'ALL_SAVED' }));
    });

    it('has no filter line and no team columns when both are switched off', async () => {
      vi.mocked(reportViewsApi.preview).mockResolvedValue({
        ...PREVIEW,
        filterLine: null,
        rows: PREVIEW.rows.map((r) => ({ ...r, cells: [] })),
      });
      renderPanel();
      await openNew();
      fireEvent.click(screen.getByTestId('custom-report-show-filter-line'));
      fireEvent.click(screen.getByTestId('custom-report-team-columns'));
      await waitFor(() => expect(lastPreviewBody()).toMatchObject({ definition: { showFilterLine: false, teamColumns: false } }));
      const table = await screen.findByTestId('custom-report-preview-table');
      expect(within(table).getAllByRole('columnheader')).toHaveLength(4);
      expect(screen.queryByTestId('custom-report-preview-filter-line')).not.toBeInTheDocument();
    });

    it('names the teams that were left out, counts the criteria left out, and says when criteria are new', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.preview).mockResolvedValue({
        ...PREVIEW,
        viewId: 'v1',
        notes: [
          { code: 'ITEM_KEYS_IGNORED', params: { count: 1 } },
          { code: 'TEAMS_IGNORED', params: { count: 2 } },
        ],
        ignored: {
          itemKeys: ['old'],
          teamIds: ['t9', 't8'],
          teams: [
            { teamId: 't9', name: 'Tổ 9' },
            { teamId: 't8', name: null },
          ],
        },
        newCriteria: 2,
      });
      renderPanel();
      await openSaved();
      expect(await screen.findByTestId('custom-report-ignored-teams')).toHaveTextContent(`Tổ 9, ${t.preview.unknownTeam}`);
      expect(screen.getByTestId('custom-report-ignored-criteria')).toHaveTextContent(t.preview.ignoredCriteria(1));
      expect(screen.getByTestId('custom-report-new-criteria')).toHaveTextContent('Có 2 tiêu chí mới chưa được chọn');
      expect(screen.getByTestId('custom-report-note-ITEM_KEYS_IGNORED')).toBeInTheDocument();
      expect(screen.getByTestId('custom-report-note-TEAMS_IGNORED')).toBeInTheDocument();
    });

    it('is asked again when the period is closed or opened again, and the export waits for it', async () => {
      const { setPeriodStatus } = renderPanel();
      await openNew();
      await exportReady();
      expect(reportViewsApi.preview).toHaveBeenCalledTimes(1);

      const afterClosing = deferred<CustomReportPreview>();
      vi.mocked(reportViewsApi.preview).mockReturnValueOnce(afterClosing.promise);
      setPeriodStatus('FINALIZED');
      await waitFor(() => expect(reportViewsApi.preview).toHaveBeenCalledTimes(2));
      expect(exportButton()).toBeDisabled();
      afterClosing.resolve({ ...PREVIEW, periodStatus: 'FINALIZED', mode: 'APPROVED' });
      await exportReady();
      expect(await screen.findByTestId('custom-report-cell-tin-t2')).toHaveTextContent('chưa duyệt');

      setPeriodStatus('OPEN');
      await waitFor(() => expect(reportViewsApi.preview).toHaveBeenCalledTimes(3));
    });

    describe('a saved report of which nothing is left in this period', () => {
      const EMPTY_ANSWER: CustomReportPreview = {
        ...PREVIEW,
        viewId: 'v1',
        teams: [],
        rows: [],
        notes: [{ code: 'TEAMS_IGNORED', params: { count: 2 } }],
        ignored: {
          itemKeys: [],
          teamIds: ['gone-1', 'gone-2'],
          teams: [
            { teamId: 'gone-1', name: 'Tổ 9' },
            { teamId: 'gone-2', name: null },
          ],
        },
        counts: { criteria: { selected: 2, total: 3 }, teams: { selected: 0, total: 4 } },
      };

      it('teams: the preview is still asked for; the warnings, the teams by name and a plain sentence are shown; export is off with the reason', async () => {
        vi.mocked(reportViewsApi.list).mockResolvedValue([view({ teamIds: ['gone-1', 'gone-2'] })]);
        vi.mocked(reportViewsApi.preview).mockResolvedValue(EMPTY_ANSWER);
        renderPanel();
        await openSaved();
        await waitFor(() => expect(reportViewsApi.preview).toHaveBeenCalledWith('period1', { viewId: 'v1', mode: 'SUBMITTED' }));
        // Not the sentence of somebody who unticked everything by hand.
        expect(screen.queryByTestId('custom-report-block-reason')).not.toBeInTheDocument();

        const gone = await screen.findByTestId('custom-report-saved-teams-gone');
        expect(gone).toHaveTextContent(t.preview.savedTeamsGone(`Tổ 9, ${t.preview.unknownTeam}`));
        expect(gone).not.toHaveTextContent('gone-2');
        expect(screen.getByTestId('custom-report-ignored-teams')).toHaveTextContent(`Tổ 9, ${t.preview.unknownTeam}`);
        expect(screen.getByTestId('custom-report-preview-area')).not.toHaveTextContent('gone-2');
        expect(screen.getByTestId('custom-report-note-TEAMS_IGNORED')).toBeInTheDocument();
        expect(screen.queryByTestId('custom-report-preview-table')).not.toBeInTheDocument();
        expect(screen.queryByTestId('custom-report-saved-criteria-gone')).not.toBeInTheDocument();

        await waitFor(() => expect(screen.getByTestId('custom-report-export-reason')).toHaveTextContent(t.builder.exportNothingLeft));
        expect(exportButton()).toBeDisabled();
      });

      it('teams: ticking a team of this period fixes it, and the absent ones stay in the selection', async () => {
        vi.mocked(reportViewsApi.list).mockResolvedValue([view({ teamIds: ['gone-1', 'gone-2'] })]);
        vi.mocked(reportViewsApi.preview).mockResolvedValueOnce(EMPTY_ANSWER).mockResolvedValue({ ...PREVIEW, viewId: 'v1' });
        renderPanel();
        await openSaved();
        await screen.findByTestId('custom-report-saved-teams-gone');
        expect(team('t1')).toBeEnabled();
        fireEvent.click(team('t1'));
        await waitFor(() =>
          expect(lastPreviewBody()).toEqual({
            viewId: 'v1',
            definition: { title: 'Tình hình tin báo', showFilterLine: true, itemKeys: ['tin-moi', 'an'], teamIds: ['t1', 'gone-1', 'gone-2'], teamColumns: true },
            mode: 'SUBMITTED',
          }),
        );
        await exportReady();
        expect(screen.queryByTestId('custom-report-saved-teams-gone')).not.toBeInTheDocument();
      });

      it('criteria: the same, counted by the answer', async () => {
        vi.mocked(reportViewsApi.list).mockResolvedValue([view({ itemKeys: ['old-1', 'old-2'] })]);
        vi.mocked(reportViewsApi.preview).mockResolvedValue({
          ...PREVIEW,
          viewId: 'v1',
          rows: [],
          notes: [{ code: 'ITEM_KEYS_IGNORED', params: { count: 2 } }],
          ignored: { itemKeys: ['old-1', 'old-2'], teamIds: [], teams: [] },
          counts: { criteria: { selected: 0, total: 3 }, teams: { selected: 2, total: 4 } },
        });
        renderPanel();
        await openSaved();
        expect(await screen.findByTestId('custom-report-saved-criteria-gone')).toHaveTextContent(t.preview.savedCriteriaGone);
        expect(screen.getByTestId('custom-report-ignored-criteria')).toHaveTextContent(t.preview.ignoredCriteria(2));
        expect(screen.getByTestId('custom-report-note-ITEM_KEYS_IGNORED')).toBeInTheDocument();
        expect(screen.queryByTestId('custom-report-block-reason')).not.toBeInTheDocument();
        expect(reportViewsApi.preview).toHaveBeenCalledWith('period1', { viewId: 'v1', mode: 'SUBMITTED' });
        await waitFor(() => expect(screen.getByTestId('custom-report-export-reason')).toHaveTextContent(t.builder.exportNothingLeft));
        expect(exportButton()).toBeDisabled();
        expect(criterion('tin-moi')).toBeEnabled();
      });

      it('somebody who then unticks everything by hand is told to tick, and nothing more is asked', async () => {
        vi.mocked(reportViewsApi.list).mockResolvedValue([view({ teamIds: ['gone-1', 'gone-2'] })]);
        vi.mocked(reportViewsApi.preview).mockResolvedValue(EMPTY_ANSWER);
        renderPanel();
        await openSaved();
        await screen.findByTestId('custom-report-saved-teams-gone');
        await waitFor(() => expect(screen.getByTestId('custom-report-export-reason')).toHaveTextContent(t.builder.exportNothingLeft));
        const asked = vi.mocked(reportViewsApi.preview).mock.calls.length;
        fireEvent.click(screen.getByTestId('custom-report-teams-none'));
        expect(screen.getByTestId('custom-report-block-reason')).toHaveTextContent(t.builder.noTeamsTicked);
        expect(exportButton()).toBeDisabled();
        expect(screen.queryByTestId('custom-report-preview')).not.toBeInTheDocument();
        await new Promise((r) => setTimeout(r, 30));
        expect(reportViewsApi.preview).toHaveBeenCalledTimes(asked);
      });
    });

    it('a refused preview is told by its code', async () => {
      vi.mocked(reportViewsApi.preview).mockRejectedValue(refusal(400, 'VIEW_TEAMS_EMPTY'));
      renderPanel();
      await openNew();
      expect(await screen.findByTestId('custom-report-preview-error')).toHaveTextContent(t.errors.VIEW_TEAMS_EMPTY);
      expect(screen.queryByTestId('custom-report-preview')).not.toBeInTheDocument();
    });
  });

  describe('export', () => {
    it('posts what is on the screen with the mode of the page, and downloads the file it is given', async () => {
      vi.mocked(reportViewsApi.createExport).mockResolvedValue({ exportId: 'exp1', fileName: 'bao-cao-2026-06.xlsx' });
      renderPanel('APPROVED');
      await openNew();
      fireEvent.change(screen.getByTestId('custom-report-title'), { target: { value: '  Tình hình tuần  ' } });
      fireEvent.click(criterion('an'));
      expect(exportButton()).toBeDisabled();
      await exportReady();
      fireEvent.click(exportButton());

      await waitFor(() => expect(dynamicReportsApi.downloadExport).toHaveBeenCalledWith('exp1', 'bao-cao-2026-06.xlsx'));
      expect(reportViewsApi.createExport).toHaveBeenCalledWith('period1', {
        viewId: null,
        definition: { ...FULL_DEFINITION, title: 'Tình hình tuần', itemKeys: ['tin-moi', 'tin-cu'] },
        mode: 'APPROVED',
      });
      expect(await screen.findByTestId('custom-report-builder-notice')).toHaveTextContent(t.done.exported('bao-cao-2026-06.xlsx'));
    });

    it('waits for the preview of what is on the screen: disabled, with the reason, until it has arrived', async () => {
      const first = deferred<CustomReportPreview>();
      vi.mocked(reportViewsApi.preview).mockReturnValueOnce(first.promise);
      renderPanel();
      await openNew();
      await waitFor(() => expect(reportViewsApi.preview).toHaveBeenCalledTimes(1));
      expect(exportButton()).toBeDisabled();
      expect(screen.getByTestId('custom-report-export-reason')).toHaveTextContent(t.builder.exportWaitsPreview);

      first.resolve(PREVIEW);
      await exportReady();
      expect(screen.queryByTestId('custom-report-export-reason')).not.toBeInTheDocument();

      // A change: the preview on the screen is of an earlier state of the form until the new one arrives.
      const second = deferred<CustomReportPreview>();
      vi.mocked(reportViewsApi.preview).mockReturnValueOnce(second.promise);
      fireEvent.click(criterion('an'));
      expect(exportButton()).toBeDisabled();
      expect(screen.getByTestId('custom-report-export-reason')).toHaveTextContent(t.builder.exportWaitsPreview);
      await waitFor(() => expect(reportViewsApi.preview).toHaveBeenCalledTimes(2));
      expect(exportButton()).toBeDisabled();
      fireEvent.click(exportButton());
      expect(reportViewsApi.createExport).not.toHaveBeenCalled();
      second.resolve(PREVIEW);
      await exportReady();
    });

    it('a preview that failed gives nothing to export: disabled with the reason, and it can be tried again', async () => {
      vi.mocked(reportViewsApi.preview).mockRejectedValueOnce(refusal(500, 'INTERNAL'));
      renderPanel();
      await openNew();
      await screen.findByTestId('custom-report-preview-error');
      expect(exportButton()).toBeDisabled();
      expect(screen.getByTestId('custom-report-export-reason')).toHaveTextContent(t.builder.exportNeedsPreview);
      fireEvent.click(screen.getByTestId('custom-report-preview-retry'));
      await exportReady();
      expect(screen.queryByTestId('custom-report-preview-error')).not.toBeInTheDocument();
    });

    it('a refused export is told by its code', async () => {
      vi.mocked(reportViewsApi.createExport).mockRejectedValue(refusal(409, 'PERIOD_TEAMS_CHANGED'));
      renderPanel();
      await openNew();
      await exportReady();
      fireEvent.click(exportButton());
      expect(await screen.findByTestId('custom-report-error')).toHaveTextContent(t.errors.PERIOD_TEAMS_CHANGED);
      expect(dynamicReportsApi.downloadExport).not.toHaveBeenCalled();
    });

    it('straight from the list: the saved report by its id, with the mode of the page', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.createExport).mockResolvedValue({ exportId: 'exp2', fileName: 'gui-bgd.xlsx' });
      renderPanel('ALL_SAVED');
      fireEvent.click(await screen.findByTestId('custom-report-export-v1'));
      await waitFor(() => expect(dynamicReportsApi.downloadExport).toHaveBeenCalledWith('exp2', 'gui-bgd.xlsx'));
      expect(reportViewsApi.createExport).toHaveBeenCalledWith('period1', { viewId: 'v1', mode: 'ALL_SAVED' });
      expect(await screen.findByTestId('custom-report-notice')).toHaveTextContent(t.done.exported('gui-bgd.xlsx'));
    });
  });

  describe('saving', () => {
    it('creates a report under its name with "all" as null, then reloads the list', async () => {
      vi.mocked(reportViewsApi.create).mockResolvedValue(view({ id: 'v9', name: 'Báo cáo tuần', title: null, itemKeys: null, teamIds: null, revision: 1 }));
      renderPanel();
      await openNew();
      fireEvent.change(screen.getByTestId('custom-report-name'), { target: { value: '  Báo cáo tuần ' } });
      fireEvent.click(screen.getByTestId('custom-report-save'));

      expect(await screen.findByTestId('custom-report-builder-notice')).toHaveTextContent(t.done.created('Báo cáo tuần'));
      expect(reportViewsApi.create).toHaveBeenCalledWith('report1', { name: 'Báo cáo tuần', ...FULL_DEFINITION });
      await waitFor(() => expect(reportViewsApi.list).toHaveBeenCalledTimes(2));
      // It is a saved report from here on: it can be saved as a new one, archived, deleted.
      expect(screen.getByTestId('custom-report-builder-heading')).toHaveTextContent('Báo cáo tuần');
      expect(screen.getByTestId('custom-report-save-as')).toBeInTheDocument();
      expect(screen.getByTestId('custom-report-archive')).toBeInTheDocument();
      expect(screen.getByTestId('custom-report-delete')).toBeInTheDocument();
    });

    it('a saved report opens with exactly its ticks and is previewed by its id alone', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      renderPanel();
      await openSaved();
      expect(criterion('tin-moi').checked).toBe(true);
      expect(criterion('tin-cu').checked).toBe(false);
      expect(criterion('an').checked).toBe(true);
      expect(team('t1').checked).toBe(true);
      expect(team('d1').checked).toBe(false);
      expect(team('t3').checked).toBe(true);
      expect(screen.getByTestId('custom-report-name')).toHaveValue('Gửi Ban Giám đốc');
      expect(screen.getByTestId('custom-report-title')).toHaveValue('Tình hình tin báo');
      await waitFor(() => expect(reportViewsApi.preview).toHaveBeenCalledWith('period1', { viewId: 'v1', mode: 'SUBMITTED' }));
      expect(screen.queryByTestId('custom-report-unsaved')).not.toBeInTheDocument();
    });

    it('edits a saved report with the revision it was read at, sending only what was touched', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.update).mockResolvedValue(view({ title: null, itemKeys: null, revision: 5 }));
      renderPanel();
      await openSaved();
      fireEvent.click(criterion('tin-cu'));
      fireEvent.change(screen.getByTestId('custom-report-title'), { target: { value: '' } });
      expect(screen.getByTestId('custom-report-unsaved')).toHaveTextContent(t.builder.unsaved);
      await waitFor(() =>
        expect(lastPreviewBody()).toEqual({
          viewId: 'v1',
          definition: { title: null, showFilterLine: true, itemKeys: null, teamIds: ['t1', 't3'], teamColumns: true },
          mode: 'SUBMITTED',
        }),
      );
      fireEvent.click(screen.getByTestId('custom-report-save'));

      expect(await screen.findByTestId('custom-report-builder-notice')).toHaveTextContent(t.done.updated('Gửi Ban Giám đốc'));
      // The name, the two switches and the teams were not touched: they are not sent, so the server keeps them.
      expect(reportViewsApi.update).toHaveBeenCalledWith('v1', { expectedRevision: 4, title: null, itemKeys: null });
      await waitFor(() => expect(reportViewsApi.list).toHaveBeenCalledTimes(2));
      expect(screen.queryByTestId('custom-report-unsaved')).not.toBeInTheDocument();
    });

    it('keeps the criteria a saved report names that this period does not have', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view({ itemKeys: ['tin-moi', 'an', 'old-key'], teamIds: null })]);
      vi.mocked(reportViewsApi.update).mockResolvedValue(view({ revision: 5 }));
      renderPanel();
      await openSaved();
      fireEvent.click(criterion('an'));
      fireEvent.click(screen.getByTestId('custom-report-save'));
      await waitFor(() => expect(reportViewsApi.update).toHaveBeenCalled());
      expect(vi.mocked(reportViewsApi.update).mock.calls[0][1]).toMatchObject({ itemKeys: ['tin-moi', 'old-key'] });
      expect(vi.mocked(reportViewsApi.update).mock.calls[0][1]).not.toHaveProperty('teamIds');
    });

    it('"Lưu thành bản mới" asks for a name and creates another report with what is on the screen', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.create).mockResolvedValue(view({ id: 'v7', name: 'Bản gửi Bộ', revision: 1 }));
      renderPanel();
      await openSaved();
      fireEvent.click(team('t3'));
      fireEvent.click(screen.getByTestId('custom-report-save-as'));
      expect(screen.getByTestId('custom-report-save-as-name')).toHaveValue(t.builder.copyName('Gửi Ban Giám đốc'));
      fireEvent.change(screen.getByTestId('custom-report-save-as-name'), { target: { value: 'Bản gửi Bộ' } });
      fireEvent.click(screen.getByTestId('custom-report-save-as-confirm'));

      expect(await screen.findByTestId('custom-report-builder-notice')).toHaveTextContent(t.done.created('Bản gửi Bộ'));
      expect(reportViewsApi.create).toHaveBeenCalledWith('report1', {
        name: 'Bản gửi Bộ',
        title: 'Tình hình tin báo',
        showFilterLine: true,
        itemKeys: ['tin-moi', 'an'],
        teamIds: ['t1'],
        teamColumns: true,
      });
      expect(reportViewsApi.update).not.toHaveBeenCalled();
      expect(screen.getByTestId('custom-report-builder-heading')).toHaveTextContent('Bản gửi Bộ');
      expect(screen.queryByTestId('custom-report-save-as-box')).not.toBeInTheDocument();
    });

    it('a name already in use is said in plain words and the choices stay', async () => {
      vi.mocked(reportViewsApi.create).mockRejectedValue(refusal(409, 'VIEW_NAME_TAKEN'));
      renderPanel();
      await openNew();
      fireEvent.click(criterion('an'));
      fireEvent.change(screen.getByTestId('custom-report-name'), { target: { value: 'Trùng tên' } });
      fireEvent.click(screen.getByTestId('custom-report-save'));
      expect(await screen.findByTestId('custom-report-error')).toHaveTextContent(t.errors.VIEW_NAME_TAKEN);
      expect(screen.getByTestId('custom-report-name')).toHaveValue('Trùng tên');
      expect(criterion('an').checked).toBe(false);
    });

    it('when somebody else saved first: says so, reloads the saved report, keeps the choices, and the next save goes through', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValueOnce([view()]).mockResolvedValue([view({ revision: 6, name: 'Tên người khác đặt' })]);
      vi.mocked(reportViewsApi.update).mockRejectedValueOnce(refusal(409, 'REVISION_CONFLICT')).mockResolvedValue(view({ revision: 7 }));
      renderPanel();
      await openSaved();
      fireEvent.click(criterion('tin-cu'));
      fireEvent.click(screen.getByTestId('custom-report-save'));

      expect(await screen.findByTestId('custom-report-error')).toHaveTextContent(t.conflictReloaded);
      expect(criterion('tin-cu').checked).toBe(true);
      expect(screen.getByTestId('custom-report-builder-heading')).toHaveTextContent('Tên người khác đặt');
      // The name was not touched here, so it follows the other person's rename instead of undoing it.
      expect(screen.getByTestId('custom-report-name')).toHaveValue('Tên người khác đặt');

      fireEvent.click(screen.getByTestId('custom-report-save'));
      await waitFor(() => expect(reportViewsApi.update).toHaveBeenCalledTimes(2));
      // Only the criteria were touched: the other person's name is not sent back, so it cannot be undone.
      expect(vi.mocked(reportViewsApi.update).mock.calls[1][1]).toEqual({ expectedRevision: 6, itemKeys: null });
    });

    it('after touching only the title, only the title is sent', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.update).mockResolvedValue(view({ title: 'Tiêu đề mới', revision: 5 }));
      renderPanel();
      await openSaved();
      fireEvent.change(screen.getByTestId('custom-report-title'), { target: { value: ' Tiêu đề mới ' } });
      fireEvent.click(screen.getByTestId('custom-report-save'));
      await waitFor(() => expect(reportViewsApi.update).toHaveBeenCalled());
      expect(reportViewsApi.update).toHaveBeenCalledWith('v1', { expectedRevision: 4, title: 'Tiêu đề mới' });
    });

    it('each switch and the name are sent only when touched', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.update).mockResolvedValue(view({ name: 'Tên mới', teamColumns: false, revision: 5 }));
      renderPanel();
      await openSaved();
      fireEvent.change(screen.getByTestId('custom-report-name'), { target: { value: 'Tên mới' } });
      fireEvent.click(screen.getByTestId('custom-report-team-columns'));
      fireEvent.click(screen.getByTestId('custom-report-save'));
      await waitFor(() => expect(reportViewsApi.update).toHaveBeenCalled());
      expect(reportViewsApi.update).toHaveBeenCalledWith('v1', { expectedRevision: 4, name: 'Tên mới', teamColumns: false });
    });

    it('a report saved with teams this period lacks keeps them when the only team shown is unticked and ticked again', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view({ itemKeys: ['tin-moi', 'old-key'], teamIds: ['t1', 'gone-team'] })]);
      vi.mocked(dynamicReportsApi.loadPeriodCriteria).mockResolvedValue({ ...CRITERIA, criteria: [CRITERIA.criteria[0]] });
      vi.mocked(dynamicReportsApi.listAssignments).mockResolvedValue([assignment('t1', 'Tổ 1')]);
      vi.mocked(reportViewsApi.update).mockResolvedValue(view({ revision: 5 }));
      renderPanel();
      await openSaved();
      fireEvent.click(team('t1'));
      fireEvent.click(team('t1'));
      fireEvent.click(criterion('tin-moi'));
      fireEvent.click(criterion('tin-moi'));
      expect(screen.getByTestId('custom-report-teams-count')).toHaveTextContent('Đã chọn 1/1 tổ');
      fireEvent.click(screen.getByTestId('custom-report-save'));
      await waitFor(() => expect(reportViewsApi.update).toHaveBeenCalled());
      // Everything on the screen is ticked, and still neither selection became "all" (null).
      expect(reportViewsApi.update).toHaveBeenCalledWith('v1', {
        expectedRevision: 4,
        itemKeys: ['tin-moi', 'old-key'],
        teamIds: ['t1', 'gone-team'],
      });
    });

    it('while a save is on its way nothing can be edited, so the answer overwrites nothing typed meanwhile', async () => {
      const pending = deferred<ReportViewDto>();
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.update).mockReturnValue(pending.promise);
      renderPanel();
      await openSaved();
      fireEvent.click(criterion('tin-cu'));
      const editable = () => [
        screen.getByTestId('custom-report-name'),
        screen.getByTestId('custom-report-title'),
        screen.getByTestId('custom-report-show-filter-line'),
        screen.getByTestId('custom-report-team-columns'),
        criterion('tin-moi'),
        screen.getByTestId('custom-report-criteria-group-tin'),
        screen.getByTestId('custom-report-criteria-all'),
        screen.getByTestId('custom-report-criteria-none'),
        screen.getByTestId('custom-report-criteria-invert'),
        team('t1'),
        team('d1'),
        screen.getByTestId('custom-report-teams-all'),
        screen.getByTestId('custom-report-teams-none'),
      ];
      for (const control of editable()) expect(control).toBeEnabled();

      fireEvent.click(screen.getByTestId('custom-report-save'));
      await waitFor(() => expect(reportViewsApi.update).toHaveBeenCalled());
      for (const control of editable()) expect(control).toBeDisabled();

      pending.resolve(view({ itemKeys: null, revision: 5 }));
      expect(await screen.findByTestId('custom-report-builder-notice')).toHaveTextContent(t.done.updated('Gửi Ban Giám đốc'));
      for (const control of editable()) expect(control).toBeEnabled();
    });

    it('nothing can be edited while "Lưu thành bản mới" or an archive is on its way either', async () => {
      const creating = deferred<ReportViewDto>();
      const archiving = deferred<ReportViewDto>();
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.create).mockReturnValue(creating.promise);
      vi.mocked(reportViewsApi.archive).mockReturnValue(archiving.promise);
      renderPanel();
      await openSaved();
      fireEvent.click(screen.getByTestId('custom-report-save-as'));
      fireEvent.click(screen.getByTestId('custom-report-save-as-confirm'));
      await waitFor(() => expect(reportViewsApi.create).toHaveBeenCalled());
      expect(screen.getByTestId('custom-report-name')).toBeDisabled();
      expect(screen.getByTestId('custom-report-save-as-name')).toBeDisabled();
      expect(team('t1')).toBeDisabled();
      creating.resolve(view({ id: 'v7', name: 'Bản sao', revision: 1 }));
      await waitFor(() => expect(screen.getByTestId('custom-report-name')).toBeEnabled());

      fireEvent.click(screen.getByTestId('custom-report-archive'));
      await waitFor(() => expect(reportViewsApi.archive).toHaveBeenCalled());
      expect(screen.getByTestId('custom-report-title')).toBeDisabled();
      expect(criterion('an')).toBeDisabled();
      archiving.resolve(view({ id: 'v7', name: 'Bản sao', archivedAt: '2026-11-14T00:00:00.000Z', revision: 2 }));
      await waitFor(() => expect(screen.getByTestId('custom-report-title')).toBeEnabled());
    });

    it('when the report was deleted meanwhile: says so and the next save makes a new one', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValueOnce([view()]).mockResolvedValue([]);
      vi.mocked(reportViewsApi.update).mockRejectedValue(refusal(409, 'REVISION_CONFLICT'));
      vi.mocked(reportViewsApi.create).mockResolvedValue(view({ id: 'v8', revision: 1 }));
      renderPanel();
      await openSaved();
      fireEvent.click(criterion('tin-cu'));
      fireEvent.click(screen.getByTestId('custom-report-save'));
      expect(await screen.findByTestId('custom-report-error')).toHaveTextContent(t.conflictGone);
      fireEvent.click(screen.getByTestId('custom-report-save'));
      await waitFor(() => expect(reportViewsApi.create).toHaveBeenCalled());
      expect(vi.mocked(reportViewsApi.create).mock.calls[0][1]).toMatchObject({ name: 'Gửi Ban Giám đốc', teamIds: ['t1', 't3'] });
    });
  });

  describe('archive, restore, delete, rename', () => {
    it('archives and restores from the builder; an archived report cannot be saved until restored', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.archive).mockResolvedValue(view({ archivedAt: '2026-11-14T00:00:00.000Z', revision: 5 }));
      vi.mocked(reportViewsApi.restore).mockResolvedValue(view({ revision: 6 }));
      renderPanel();
      await openSaved();
      fireEvent.click(screen.getByTestId('custom-report-archive'));
      expect(await screen.findByTestId('custom-report-builder-notice')).toHaveTextContent(t.done.archived('Gửi Ban Giám đốc'));
      // With the revision the screen holds: somebody else's change in between is a conflict, not silently passed over.
      expect(reportViewsApi.archive).toHaveBeenCalledWith('v1', 4);
      expect(screen.getByTestId('custom-report-save')).toBeDisabled();
      expect(screen.getByTestId('custom-report-save-reason')).toHaveTextContent(t.builder.archivedReason);
      expect(screen.queryByTestId('custom-report-archive')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('custom-report-restore'));
      expect(await screen.findByTestId('custom-report-builder-notice')).toHaveTextContent(t.done.restored('Gửi Ban Giám đốc'));
      expect(reportViewsApi.restore).toHaveBeenCalledWith('v1', 5);
      expect(screen.getByTestId('custom-report-save')).toBeEnabled();
      await waitFor(() => expect(reportViewsApi.list).toHaveBeenCalledTimes(3));
    });

    it('archives from the list and restores from the archived list', async () => {
      vi.mocked(reportViewsApi.list)
        .mockResolvedValueOnce([view()])
        .mockResolvedValue([view({ archivedAt: '2026-11-14T00:00:00.000Z', revision: 5 })]);
      vi.mocked(reportViewsApi.archive).mockResolvedValue(view({ archivedAt: '2026-11-14T00:00:00.000Z', revision: 5 }));
      vi.mocked(reportViewsApi.restore).mockResolvedValue(view({ revision: 6 }));
      renderPanel();
      fireEvent.click(await screen.findByTestId('custom-report-archive-v1'));
      expect(await screen.findByTestId('custom-report-notice')).toHaveTextContent(t.done.archived('Gửi Ban Giám đốc'));
      expect(reportViewsApi.archive).toHaveBeenCalledWith('v1', 4);

      fireEvent.click(await screen.findByTestId('custom-report-toggle-archived'));
      fireEvent.click(screen.getByTestId('custom-report-restore-v1'));
      await waitFor(() => expect(reportViewsApi.restore).toHaveBeenCalledWith('v1', 5));
      expect(await screen.findByTestId('custom-report-notice')).toHaveTextContent(t.done.restored('Gửi Ban Giám đốc'));
    });

    it('an archive refused because somebody else changed the report: said in plain words, the report is read again, and what was not touched follows it', async () => {
      vi.mocked(reportViewsApi.list)
        .mockResolvedValueOnce([view()])
        .mockResolvedValue([view({ revision: 6, name: 'Tên người khác đặt', showFilterLine: false })]);
      vi.mocked(reportViewsApi.archive).mockRejectedValueOnce(refusal(409, 'REVISION_CONFLICT'));
      vi.mocked(reportViewsApi.update).mockResolvedValue(view({ revision: 7, name: 'Tên người khác đặt', title: 'Tiêu đề của tôi' }));
      renderPanel();
      await openSaved();
      fireEvent.change(screen.getByTestId('custom-report-title'), { target: { value: 'Tiêu đề của tôi' } });
      fireEvent.click(screen.getByTestId('custom-report-archive'));

      const error = await screen.findByTestId('custom-report-error');
      expect(error).toHaveTextContent(t.conflictReloadedRetry);
      expect(error).not.toHaveTextContent('REVISION_CONFLICT');
      expect(reportViewsApi.archive).toHaveBeenCalledWith('v1', 4);
      // Read again: the untouched name and switch are the other person's; the title typed here stays.
      expect(screen.getByTestId('custom-report-builder-heading')).toHaveTextContent('Tên người khác đặt');
      expect(screen.getByTestId('custom-report-name')).toHaveValue('Tên người khác đặt');
      expect((screen.getByTestId('custom-report-show-filter-line') as HTMLInputElement).checked).toBe(false);
      expect(screen.getByTestId('custom-report-title')).toHaveValue('Tiêu đề của tôi');

      fireEvent.click(screen.getByTestId('custom-report-save'));
      await waitFor(() => expect(reportViewsApi.update).toHaveBeenCalled());
      expect(reportViewsApi.update).toHaveBeenCalledWith('v1', { expectedRevision: 6, title: 'Tiêu đề của tôi' });
    });

    it('after an archive answered with a newer version, an untouched name is that of the server and is not sent', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.archive).mockResolvedValue(view({ archivedAt: '2026-11-14T00:00:00.000Z', revision: 8, name: 'Tên trên máy chủ' }));
      vi.mocked(reportViewsApi.restore).mockResolvedValue(view({ revision: 9, name: 'Tên trên máy chủ', teamColumns: false }));
      vi.mocked(reportViewsApi.update).mockResolvedValue(view({ revision: 10, name: 'Tên trên máy chủ' }));
      renderPanel();
      await openSaved();
      fireEvent.change(screen.getByTestId('custom-report-title'), { target: { value: 'Tiêu đề của tôi' } });
      fireEvent.click(screen.getByTestId('custom-report-archive'));
      await waitFor(() => expect(screen.getByTestId('custom-report-name')).toHaveValue('Tên trên máy chủ'));
      expect(screen.getByTestId('custom-report-title')).toHaveValue('Tiêu đề của tôi');

      fireEvent.click(await screen.findByTestId('custom-report-restore'));
      await waitFor(() => expect(reportViewsApi.restore).toHaveBeenCalledWith('v1', 8));
      await waitFor(() => expect((screen.getByTestId('custom-report-team-columns') as HTMLInputElement).checked).toBe(false));

      await waitFor(() => expect(screen.getByTestId('custom-report-save')).toBeEnabled());
      fireEvent.click(screen.getByTestId('custom-report-save'));
      await waitFor(() => expect(reportViewsApi.update).toHaveBeenCalled());
      expect(reportViewsApi.update).toHaveBeenCalledWith('v1', { expectedRevision: 9, title: 'Tiêu đề của tôi' });
    });

    it('an archive from the list refused for the same reason is told by its code and the list is read again', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.archive).mockRejectedValue(refusal(409, 'REVISION_CONFLICT'));
      renderPanel();
      fireEvent.click(await screen.findByTestId('custom-report-archive-v1'));
      expect(await screen.findByTestId('custom-report-list-error')).toHaveTextContent(t.errors.REVISION_CONFLICT);
      await waitFor(() => expect(reportViewsApi.list).toHaveBeenCalledTimes(2));
    });

    it('deleting from the list asks first, naming the report; "Huỷ" deletes nothing', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.remove).mockResolvedValue({ deleted: true, id: 'v1' });
      renderPanel();
      fireEvent.click(await screen.findByTestId('custom-report-delete-v1'));
      expect(screen.getByTestId('custom-report-delete-confirm-v1')).toHaveTextContent(t.confirmDelete('Gửi Ban Giám đốc'));
      expect(reportViewsApi.remove).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('custom-report-delete-no-v1'));
      expect(screen.queryByTestId('custom-report-delete-confirm-v1')).not.toBeInTheDocument();
      expect(reportViewsApi.remove).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('custom-report-delete-v1'));
      fireEvent.click(screen.getByTestId('custom-report-delete-yes-v1'));
      expect(await screen.findByTestId('custom-report-notice')).toHaveTextContent(t.done.deleted('Gửi Ban Giám đốc'));
      expect(reportViewsApi.remove).toHaveBeenCalledWith('v1', 4);
      await waitFor(() => expect(reportViewsApi.list).toHaveBeenCalledTimes(2));
    });

    it('deleting from the builder asks first, naming the report, then closes the builder', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.remove).mockResolvedValue({ deleted: true, id: 'v1' });
      renderPanel();
      await openSaved();
      fireEvent.click(screen.getByTestId('custom-report-delete'));
      expect(screen.getByTestId('custom-report-delete-confirm')).toHaveTextContent(t.confirmDelete('Gửi Ban Giám đốc'));
      expect(reportViewsApi.remove).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('custom-report-delete-yes'));
      expect(await screen.findByTestId('custom-report-notice')).toHaveTextContent(t.done.deleted('Gửi Ban Giám đốc'));
      expect(reportViewsApi.remove).toHaveBeenCalledWith('v1', 4);
      expect(screen.queryByTestId('custom-report-builder')).not.toBeInTheDocument();
    });

    it('renames from the list with the revision it was read at', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.update).mockResolvedValue(view({ name: 'Tên mới', revision: 5 }));
      renderPanel();
      fireEvent.click(await screen.findByTestId('custom-report-rename-v1'));
      expect(screen.getByTestId('custom-report-rename-save-v1')).toBeDisabled();
      fireEvent.change(screen.getByTestId('custom-report-rename-input-v1'), { target: { value: ' Tên mới ' } });
      fireEvent.click(screen.getByTestId('custom-report-rename-save-v1'));
      expect(await screen.findByTestId('custom-report-notice')).toHaveTextContent(t.done.renamed('Tên mới'));
      expect(reportViewsApi.update).toHaveBeenCalledWith('v1', { expectedRevision: 4, name: 'Tên mới' });
      expect(screen.queryByTestId('custom-report-rename-box-v1')).not.toBeInTheDocument();
    });

    it('the new name cannot be typed over while the rename is being saved', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      const saving = deferred<ReportViewDto>();
      vi.mocked(reportViewsApi.update).mockReturnValue(saving.promise);
      renderPanel();
      fireEvent.click(await screen.findByTestId('custom-report-rename-v1'));
      fireEvent.change(screen.getByTestId('custom-report-rename-input-v1'), { target: { value: 'Tên mới' } });
      expect(screen.getByTestId('custom-report-rename-input-v1')).toBeEnabled();
      fireEvent.click(screen.getByTestId('custom-report-rename-save-v1'));
      await waitFor(() => expect(screen.getByTestId('custom-report-rename-input-v1')).toBeDisabled());
      saving.resolve(view({ name: 'Tên mới', revision: 5 }));
      expect(await screen.findByTestId('custom-report-notice')).toHaveTextContent(t.done.renamed('Tên mới'));
    });

    it('a refusal on the list is told by its code and the list is read again', async () => {
      vi.mocked(reportViewsApi.list).mockResolvedValue([view()]);
      vi.mocked(reportViewsApi.update).mockRejectedValue(refusal(409, 'REVISION_CONFLICT'));
      renderPanel();
      fireEvent.click(await screen.findByTestId('custom-report-rename-v1'));
      fireEvent.change(screen.getByTestId('custom-report-rename-input-v1'), { target: { value: 'Tên mới' } });
      fireEvent.click(screen.getByTestId('custom-report-rename-save-v1'));
      expect(await screen.findByTestId('custom-report-list-error')).toHaveTextContent(t.errors.REVISION_CONFLICT);
      await waitFor(() => expect(reportViewsApi.list).toHaveBeenCalledTimes(2));
    });

    it('"Đóng" closes the builder without writing anything', async () => {
      renderPanel();
      await openNew();
      fireEvent.click(screen.getByTestId('custom-report-close'));
      expect(screen.queryByTestId('custom-report-builder')).not.toBeInTheDocument();
      expect(reportViewsApi.create).not.toHaveBeenCalled();
    });
  });
});
