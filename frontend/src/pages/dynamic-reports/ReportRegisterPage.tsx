/**
 * S01 — Danh sách báo cáo (Report Register). Spec §6.1 PR4.
 *
 * Columns per spec: Mã, Tên, Loại kỳ, Hạn tiếp theo, Quản lý, Số tổ, Phiên
 * bản, Trạng thái, Cập nhật. Single-page list (no search/pagination), same
 * shape of use as DeadlineRulesListPage — an org configures at most a
 * handful of report templates, never thousands.
 *
 * Design standard "created ⇒ editable and deletable": every row can be opened ("Xem" → the detail page, where the
 * rest of the actions live), stopped and resumed ("Ngừng phát sinh" / "Tiếp tục phát sinh", one state flip that
 * `PeriodSchedulerService` already checks), and deleted ("Xoá" → archive, or delete when nobody has entered anything,
 * or — admin only — delete together with the figures).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, AlertCircle, Plus } from 'lucide-react';
import ReportDeleteDialog, { type ReportDeleteOutcome } from './ReportDeleteDialog';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { ReportSetupSummary } from '@/features/dynamic-reports/types';
import {
  DYN_REPORT_STATUS_LABEL,
  DYN_REPORT_STATUS_BADGE_CLASS,
  DYN_REPORT_PERIOD_TYPE_LABEL,
} from '@/shared/enums/status-labels';
import type { DynReportStatus, DynReportPeriodType } from '@/shared/enums/generated';
import { ListPageShell, ColumnPicker, useBoCucCot, type ColumnDef } from '@/components/shared/ListPageShell';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { formatVNDateTime, formatVNDate } from '@/lib/dates';
import { extractApiError } from '@/lib/api-errors';

const DYN_REPORTS_QUERY_KEY = ['dynamic-reports', 'setup-list'];

function StatusBadge({ status }: { status: DynReportStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DYN_REPORT_STATUS_BADGE_CLASS[status]}`}
    >
      {DYN_REPORT_STATUS_LABEL[status]}
    </span>
  );
}

function ManagersCell({ managers }: { managers: string[] }) {
  if (managers.length === 0) return <span className="text-slate-400">—</span>;
  return <span title={managers.join(', ')}>{managers.join(', ')}</span>;
}

export default function ReportRegisterPage() {
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ReportSetupSummary | null>(null);
  const queryClient = useQueryClient();

  const listQ = useQuery({
    queryKey: DYN_REPORTS_QUERY_KEY,
    queryFn: () => dynamicReportsApi.listForSetup(),
    staleTime: 30_000,
  });

  const reports = listQ.data ?? [];
  const error = listQ.isError
    ? 'Không tải được danh sách báo cáo — vui lòng thử lại.'
    : null;

  function handleDeleted(outcome: ReportDeleteOutcome) {
    const name = deleting?.name ?? '';
    setDeleting(null);
    setActionNote(outcome === 'deleted' ? `Đã xoá báo cáo "${name}".` : `Đã lưu trữ báo cáo "${name}".`);
    void queryClient.invalidateQueries({ queryKey: DYN_REPORTS_QUERY_KEY });
  }

  async function handlePublish(report: ReportSetupSummary) {
    if (!window.confirm(`Xuất bản báo cáo "${report.name}"? Từ lúc này hệ thống sinh kỳ theo lịch và các tổ thấy báo cáo để nhập.`)) return;
    setSuspendingId(report.id);
    setActionNote(null);
    try {
      await dynamicReportsApi.publishDraftReport(report.id);
      await queryClient.invalidateQueries({ queryKey: DYN_REPORTS_QUERY_KEY });
    } catch (err) {
      // The server says exactly what is missing (a manager, a team's editor, the schedule…): show that, not a generic failure.
      setActionNote(`Chưa xuất bản được "${report.name}": ${extractApiError(err).message}`);
    } finally {
      setSuspendingId(null);
    }
  }

  async function handleResume(report: ReportSetupSummary) {
    setSuspendingId(report.id);
    setActionNote(null);
    try {
      await dynamicReportsApi.resumeReportGeneration(report.id);
      await queryClient.invalidateQueries({ queryKey: DYN_REPORTS_QUERY_KEY });
    } catch {
      setActionNote(`Không tiếp tục phát sinh được "${report.name}" — vui lòng thử lại.`);
    } finally {
      setSuspendingId(null);
    }
  }

  async function handleSuspend(report: ReportSetupSummary) {
    if (
      !window.confirm(
        `Ngừng phát sinh báo cáo "${report.name}"? Sẽ không sinh kỳ mới nữa — kỳ đang mở vẫn tiếp tục hoạt động như cũ.`,
      )
    ) {
      return;
    }
    setSuspendingId(report.id);
    setActionNote(null);
    try {
      await dynamicReportsApi.suspendReportGeneration(report.id);
      await queryClient.invalidateQueries({ queryKey: DYN_REPORTS_QUERY_KEY });
    } catch {
      setActionNote(`Không ngừng phát sinh được "${report.name}" — vui lòng thử lại.`);
    } finally {
      setSuspendingId(null);
    }
  }

  const columns: ColumnDef<ReportSetupSummary>[] = useMemo(
    () => [
      { key: 'code', header: 'Mã', width: '8rem',
        cellClassName: 'px-3 py-3 font-mono text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => r.code },
      { key: 'name', header: 'Tên', width: '16rem', optional: 'show',
        cellClassName: 'px-3 py-3 font-medium text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => r.name },
      { key: 'periodType', header: 'Loại kỳ', width: '8rem', optional: 'show',
        cellClassName: 'px-3 py-3 text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) =>
          r.periodType
            ? DYN_REPORT_PERIOD_TYPE_LABEL[r.periodType as DynReportPeriodType]
            : <span className="text-slate-400">Chưa đặt lịch</span> },
      { key: 'nextDueAt', header: 'Hạn tiếp theo', width: '11rem', optional: 'show',
        cellClassName: 'px-3 py-3 text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => formatVNDateTime(r.nextDueAt) },
      { key: 'managers', header: 'Quản lý', width: '14rem', optional: 'show',
        cellClassName: 'px-3 py-3 text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => <ManagersCell managers={r.managers} /> },
      { key: 'teamCount', header: 'Số tổ', width: '6rem', optional: 'show',
        headerClassName: 'px-3 py-3 text-right text-xs font-semibold tracking-wide text-slate-600',
        cellClassName: 'px-3 py-3 text-right whitespace-nowrap overflow-hidden',
        render: (r) => r.teamCount },
      { key: 'latestVersion', header: 'Phiên bản', width: '7rem', optional: 'show',
        headerClassName: 'px-3 py-3 text-right text-xs font-semibold tracking-wide text-slate-600',
        cellClassName: 'px-3 py-3 text-right whitespace-nowrap overflow-hidden',
        render: (r) => (r.latestVersion ?? <span className="text-slate-400">—</span>) },
      { key: 'status', header: 'Trạng thái', width: '10rem', optional: 'show',
        cellClassName: 'px-3 py-3 whitespace-nowrap overflow-hidden',
        render: (r) => <StatusBadge status={r.status} /> },
      { key: 'updatedAt', header: 'Cập nhật', width: '9rem', optional: 'show',
        cellClassName: 'px-3 py-3 text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => formatVNDate(r.updatedAt) },
      { key: 'actions', header: 'Thao tác', width: '24rem',
        cellClassName: 'px-3 py-3 whitespace-nowrap overflow-hidden',
        render: (r) => (
          <div className="flex items-center gap-1">
            <Link
              to={`/bao-cao-dong/thiet-lap/${r.id}`}
              className={`px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 rounded ${A11Y_FOCUS_RING}`}
              data-testid={`btn-view-${r.code}`}
            >
              Xem
            </Link>
            {r.status !== 'ARCHIVED' && (
              <Link
                to={`/bao-cao-dong/thiet-lap/${r.id}/sua`}
                className={`px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 rounded ${A11Y_FOCUS_RING}`}
                data-testid={`btn-edit-${r.code}`}
              >
                Sửa
              </Link>
            )}
            <Link
              to={`/bao-cao-dong/thiet-lap/${r.id}/phien-ban`}
              className={`px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 rounded ${A11Y_FOCUS_RING}`}
              data-testid={`btn-versions-${r.code}`}
            >
              Phiên bản
            </Link>
            {r.status === 'DRAFT' && (
              <button
                type="button"
                className={`px-2 py-1 text-xs text-green-700 hover:bg-green-50 rounded disabled:opacity-50 ${A11Y_FOCUS_RING}`}
                data-testid={`btn-publish-${r.code}`}
                disabled={suspendingId === r.id}
                onClick={() => void handlePublish(r)}
              >
                Xuất bản
              </button>
            )}
            {r.status === 'PUBLISHED' && (
              <button
                type="button"
                className={`px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 rounded disabled:opacity-50 ${A11Y_FOCUS_RING}`}
                data-testid={`btn-suspend-${r.code}`}
                disabled={suspendingId === r.id}
                onClick={() => void handleSuspend(r)}
              >
                Ngừng phát sinh
              </button>
            )}
            {r.status === 'SUSPENDED' && (
              <button
                type="button"
                className={`px-2 py-1 text-xs text-green-700 hover:bg-green-50 rounded disabled:opacity-50 ${A11Y_FOCUS_RING}`}
                data-testid={`btn-resume-${r.code}`}
                disabled={suspendingId === r.id}
                onClick={() => void handleResume(r)}
              >
                Tiếp tục phát sinh
              </button>
            )}
            <button
              type="button"
              className={`px-2 py-1 text-xs text-red-700 hover:bg-red-50 rounded ${A11Y_FOCUS_RING}`}
              data-testid={`btn-delete-${r.code}`}
              onClick={() => setDeleting(r)}
            >
              Xoá
            </button>
          </div>
        ) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSuspend closes over stable setters/queryClient only; adding it would recompute columns every render for no behavioral change.
    [suspendingId],
  );

  const {
    coGhiDeBeRong,
    visibleColumns,
    toggleableColumns,
    isVisible,
    batTat,
    datBeRong,
    xoaBeRong,
    doiCho,
    datLai,
  } = useBoCucCot('dynamic-reports-setup', columns);

  return (
    <div data-testid="dynamic-reports-setup-page">
      <ListPageShell>
        <ListPageShell.Header
          icon={FileSpreadsheet}
          title="Danh sách báo cáo động"
          subtitle="Thiết lập, xem và quản lý mẫu báo cáo thay quy trình Excel thủ công"
          actions={
            <div className="flex items-center gap-2">
              <ColumnPicker
                columns={toggleableColumns}
                isVisible={isVisible}
                onToggle={batTat}
                onReset={datLai}
                onDoiCho={doiCho}
              />
              <Link
                to="/bao-cao-dong/thiet-lap/moi"
                className={`flex items-center gap-1 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 ${A11Y_FOCUS_RING}`}
                data-testid="btn-create-report"
              >
                <Plus className="w-4 h-4" />
                Tạo báo cáo
              </Link>
            </div>
          }
        />

        {actionNote && (
          <div
            className="bg-blue-50 border border-blue-200 rounded-lg p-3 mx-4 mt-3 flex items-center gap-2"
            data-testid="action-note"
          >
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-700">{actionNote}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mx-4 mt-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <ListPageShell.Table<ReportSetupSummary>
          state={listQ.isLoading ? 'loading' : error ? 'error' : reports.length === 0 ? 'empty' : 'ready'}
          fixedLayout
          onKeoGian={datBeRong}
          onVeMacDinhCot={xoaBeRong}
          datTongBeRong={coGhiDeBeRong}
          columns={visibleColumns}
          data={reports}
          rowKey={(r) => r.id}
          title="Báo cáo động"
          totalCount={reports.length}
          emptyState={{
            title: 'Chưa có báo cáo nào',
            description: 'Bấm "Tạo báo cáo" để thiết lập mẫu báo cáo đầu tiên từ file Excel.',
          }}
        />
      </ListPageShell>
      <ReportDeleteDialog report={deleting} onClose={() => setDeleting(null)} onDone={handleDeleted} />
    </div>
  );
}
