/**
 * S19/S23 (spec §6.1 PR8 slice 1) — "Tình trạng nhập liệu" toàn hệ thống,
 * không chỉ một báo cáo đang mở như Màn B. KPI + bảng dùng thẳng
 * `StatusQueryService` (backend) — không tự tính lại ở đây.
 *
 * Scope deliberately narrower than spec §6.1's full PR8 for this slice:
 * KHÔNG có biểu đồ cột/xu hướng, bộ lọc nâng cao dạng drawer (S27), hay
 * bộ lọc theo "đơn vị"/"người nhập"/"quản lý"/"loại kỳ" — `StatusQueryService`
 * chưa có các filter đó (chỉ reportId/periodId/teamId/state/overdue/reopened).
 * Mỗi phần còn thiếu là một slice riêng khi có nhu cầu thật, cùng cách
 * PR7/PR6 đã chia nhỏ — không xây trước khi có người dùng.
 *
 * S20 ma trận (PR8 slice 3): chỉ soi được MỘT báo cáo tại một thời điểm
 * (cột = kỳ của báo cáo đó, tối đa 12 — nhiều hơn thì dùng lại bảng S19
 * phẳng ở trên, đúng theo spec "≤12 cột, nhiều hơn thì chuyển sang bảng").
 *
 * PR8 slice 4: thêm bộ lọc "Báo cáo" cho bảng S19 (tái dùng
 * `listStatusReports` đã có từ slice 3) — trước đó `reportId` ĐÃ được
 * `StatusQueryService` hỗ trợ nhưng bảng chưa có ô chọn nào để gửi lên.
 *
 * PR8 slice 7 — thêm bộ lọc "Đơn vị" (S27, phần đầu tiên — `teamId` đã
 * được `StatusQueryService` hỗ trợ từ slice 1 kèm `getDescendantIds`,
 * chỉ thiếu UI). **Quyết định phạm vi có chủ đích**: dùng `<select>`
 * PHẲNG (tái dùng đúng `GET /teams` + bộ lọc client `isActive && !wardId`
 * của `ReportTeamsStep.tsx`, S09), KHÔNG dựng cây tổ — repo chưa có
 * component cây tổ tái dùng nào, và dựng mới chỉ cho MỘT bộ lọc là việc
 * lớn hơn giá trị mang lại ở quy mô hiện tại. "Người nhập"/"quản lý"/
 * "loại kỳ" (phần còn lại của S27 drawer) vẫn để lại cho slice sau — cần
 * join `AssignmentEditor`/`DynReportRole`/`DynReportSchedule` mới ở
 * backend.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Download, RefreshCw, Table2 } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type {
  AssignmentStatusRow,
  DynReportSubmissionState,
} from '@/features/dynamic-reports/types';
import {
  DYN_REPORT_SUBMISSION_STATE_LABEL,
  DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS,
} from '@/shared/enums/status-labels';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import StatusMatrixPanel from './StatusMatrixPanel';

const PAGE_SIZE = 25;

const ACCESS_STATE_LABEL: Record<AssignmentStatusRow['accessState'], string> = {
  NOT_YET_OPEN: 'Chưa mở',
  OPEN: 'Đang mở',
  LOCKED: 'Đã khoá',
  REOPENED: 'Mở lại',
};

const TIMELINESS_LABEL: Record<AssignmentStatusRow['timelinessState'], string> = {
  NOT_YET_DUE: 'Chưa đến hạn',
  ON_TIME: 'Đúng hạn',
  LATE: 'Trễ',
  OVERDUE_NOT_DONE: 'Quá hạn chưa nộp',
};

type KpiFilterKey = 'overdue' | 'reopened' | `state:${DynReportSubmissionState}`;

type ViewMode = 'table' | 'matrix';

export default function StatusDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: ViewMode = searchParams.get('view') === 'matrix' ? 'matrix' : 'table';
  const page = Number(searchParams.get('status_page') ?? '1') || 1;
  const reportId = searchParams.get('reportId') ?? undefined;
  const teamId = searchParams.get('teamId') ?? undefined;
  const state = (searchParams.get('state') as DynReportSubmissionState | null) ?? undefined;
  const overdue = searchParams.get('overdue') === 'true' ? true : undefined;
  const reopened = searchParams.get('reopened') === 'true' ? true : undefined;

  const [activeKpi, setActiveKpi] = useState<KpiFilterKey | null>(() => {
    if (overdue) return 'overdue';
    if (reopened) return 'reopened';
    if (state) return `state:${state}`;
    return null;
  });

  const { data: reports } = useQuery({
    queryKey: ['dynamic-reports', 'status-reports'],
    queryFn: () => dynamicReportsApi.listStatusReports(),
  });

  const { data: teams } = useQuery({
    queryKey: ['dynamic-reports', 'status-teams'],
    queryFn: () => dynamicReportsApi.listTeamsForFilter(),
  });

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dynamic-reports', 'status', { page, reportId, teamId, state, overdue, reopened }],
    queryFn: () =>
      dynamicReportsApi.listStatus({ reportId, teamId, state, overdue, reopened }, page, PAGE_SIZE),
  });

  const [exportingFormat, setExportingFormat] = useState<'csv' | 'xlsx' | null>(null);

  async function handleExport(format: 'csv' | 'xlsx') {
    setExportingFormat(format);
    try {
      await dynamicReportsApi.exportStatus({ reportId, teamId, state, overdue, reopened }, format);
    } finally {
      setExportingFormat(null);
    }
  }

  function handleSelectReportFilter(nextReportId: string) {
    const params = new URLSearchParams(searchParams);
    if (nextReportId) params.set('reportId', nextReportId);
    else params.delete('reportId');
    params.set('status_page', '1');
    setSearchParams(params);
  }

  function handleSelectTeamFilter(nextTeamId: string) {
    const params = new URLSearchParams(searchParams);
    if (nextTeamId) params.set('teamId', nextTeamId);
    else params.delete('teamId');
    params.set('status_page', '1');
    setSearchParams(params);
  }

  function applyKpiFilter(key: KpiFilterKey) {
    const turningOff = activeKpi === key;
    const next = new URLSearchParams(searchParams);
    next.delete('state');
    next.delete('overdue');
    next.delete('reopened');
    next.set('status_page', '1');
    if (!turningOff) {
      if (key === 'overdue') next.set('overdue', 'true');
      else if (key === 'reopened') next.set('reopened', 'true');
      else next.set('state', key.slice('state:'.length));
    }
    setActiveKpi(turningOff ? null : key);
    setSearchParams(next);
  }

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams);
    params.set('status_page', String(next));
    setSearchParams(params);
  }

  function setView(next: ViewMode) {
    const params = new URLSearchParams(searchParams);
    if (next === 'matrix') params.set('view', 'matrix');
    else params.delete('view');
    setSearchParams(params);
  }

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1),
    [data],
  );

  return (
    <div className="max-w-6xl mx-auto p-6" data-testid="status-dashboard-page">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Table2 className="w-5 h-5 text-blue-700" />
          <h1 className="text-xl font-bold text-slate-800">Tình trạng nhập liệu</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="btn-export-csv"
            onClick={() => void handleExport('csv')}
            disabled={exportingFormat !== null}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <Download className="w-3.5 h-3.5" />
            Xuất CSV
          </button>
          <button
            type="button"
            data-testid="btn-export-xlsx"
            onClick={() => void handleExport('xlsx')}
            disabled={exportingFormat !== null}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <Download className="w-3.5 h-3.5" />
            Xuất XLSX
          </button>
          <button
            type="button"
            data-testid="btn-refresh"
            onClick={() => void refetch()}
            disabled={isFetching}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4" role="tablist" aria-label="Chế độ xem">
        <button
          type="button"
          data-testid="btn-view-table"
          onClick={() => setView('table')}
          aria-pressed={view === 'table'}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${A11Y_FOCUS_RING} ${
            view === 'table'
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Bảng
        </button>
        <button
          type="button"
          data-testid="btn-view-matrix"
          onClick={() => setView('matrix')}
          aria-pressed={view === 'matrix'}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${A11Y_FOCUS_RING} ${
            view === 'matrix'
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Ma trận
        </button>
      </div>

      {view === 'matrix' ? (
        <StatusMatrixPanel />
      ) : (
        <>
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label htmlFor="report-filter-select" className="block text-xs font-medium text-slate-600 mb-1">
                Báo cáo
              </label>
              <select
                id="report-filter-select"
                data-testid="report-filter-select"
                value={reportId ?? ''}
                onChange={(e) => handleSelectReportFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">— Mọi báo cáo —</option>
                {(reports ?? []).map((r) => (
                  <option key={r.reportId} value={r.reportId}>
                    {r.reportName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="team-filter-select" className="block text-xs font-medium text-slate-600 mb-1">
                Đơn vị
              </label>
              <select
                id="team-filter-select"
                data-testid="team-filter-select"
                value={teamId ?? ''}
                onChange={(e) => handleSelectTeamFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">— Mọi đơn vị —</option>
                {(teams ?? []).map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.teamName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {data && (
            <p className="text-sm text-slate-500 mb-4" data-testid="as-of">
              Dữ liệu cập nhật lúc {formatVNDateTime(data.asOf)}
            </p>
          )}

          {isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">Không tải được tình trạng nhập liệu — vui lòng thử lại.</p>
            </div>
          )}

          {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="empty-state">
          Không có lượt giao nào khớp với bộ lọc hiện tại.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" data-testid="kpi-cards">
            <KpiCard
              testId="kpi-required"
              label="Phải nộp"
              value={data.kpi.requiredCount}
            />
            <KpiCard
              testId="kpi-completed"
              label="Đã nộp/duyệt"
              value={data.kpi.completionRateLabel}
            />
            <button
              type="button"
              data-testid="kpi-overdue"
              onClick={() => applyKpiFilter('overdue')}
              className={`text-left bg-white border rounded-lg p-3 ${A11Y_FOCUS_RING} ${activeKpi === 'overdue' ? 'border-red-500 ring-1 ring-red-300' : 'border-slate-200'}`}
            >
              <p className="text-xs text-slate-500">Quá hạn chưa nộp</p>
              <p className="text-lg font-bold text-red-600">{data.kpi.overdueNotDoneCount}</p>
            </button>
            <button
              type="button"
              data-testid="kpi-reopened"
              onClick={() => applyKpiFilter('reopened')}
              className={`text-left bg-white border rounded-lg p-3 ${A11Y_FOCUS_RING} ${activeKpi === 'reopened' ? 'border-blue-500 ring-1 ring-blue-300' : 'border-slate-200'}`}
            >
              <p className="text-xs text-slate-500">Đang mở lại</p>
              <p className="text-lg font-bold text-slate-800">{data.kpi.reopenedCount}</p>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4" data-testid="status-table">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Báo cáo</th>
                  <th className="text-left px-3 py-2">Tổ</th>
                  <th className="text-left px-3 py-2">Đơn vị cha</th>
                  <th className="text-left px-3 py-2">Kỳ</th>
                  <th className="text-right px-3 py-2">Mức điền</th>
                  <th className="text-left px-3 py-2">Tiến độ</th>
                  <th className="text-left px-3 py-2">Đúng hạn</th>
                  <th className="text-left px-3 py-2">Quyền nhập</th>
                  <th className="text-right px-3 py-2">Hạn gốc</th>
                  <th className="text-right px-3 py-2">Cập nhật cuối</th>
                  <th className="text-left px-3 py-2">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((row) => (
                  <tr key={row.assignmentId} data-testid={`status-row-${row.assignmentId}`}>
                    <td className="px-3 py-2 text-slate-700">{row.reportName}</td>
                    <td className="px-3 py-2 text-slate-700">{row.teamName}</td>
                    <td className="px-3 py-2 text-slate-500">{row.parentTeamName ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{row.periodKey}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.dataCoverageLabel}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS[row.state]}`}
                      >
                        {DYN_REPORT_SUBMISSION_STATE_LABEL[row.state]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {TIMELINESS_LABEL[row.timelinessState]}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {ACCESS_STATE_LABEL[row.accessState]}
                      {row.changedSinceReopen && (
                        <span
                          className="ml-1 text-amber-700"
                          data-testid={`changed-since-reopen-${row.assignmentId}`}
                          title="Đã sửa sau khi mở lại"
                        >
                          *
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">{formatVNDateTime(row.dueAt)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {row.updatedAt ? formatVNDateTime(row.updatedAt) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/bao-cao-dong/duyet/${row.assignmentId}`}
                        data-testid={`link-review-${row.assignmentId}`}
                        className={`text-xs text-blue-700 hover:text-blue-900 ${A11Y_FOCUS_RING}`}
                      >
                        Xem
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span data-testid="pagination-summary">
              Trang {page}/{totalPages} · {data.total} lượt giao
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="btn-prev-page"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className={`px-2 py-1 border border-slate-300 rounded disabled:opacity-50 ${A11Y_FOCUS_RING}`}
              >
                Trước
              </button>
              <button
                type="button"
                data-testid="btn-next-page"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
                className={`px-2 py-1 border border-slate-300 rounded disabled:opacity-50 ${A11Y_FOCUS_RING}`}
              >
                Sau
              </button>
            </div>
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
}

function KpiCard({ testId, label, value }: { testId: string; label: string; value: string | number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3" data-testid={testId}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-800">{value}</p>
    </div>
  );
}
