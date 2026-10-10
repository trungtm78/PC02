/**
 * S20 ma trận (spec §6.1 PR8 slice 3) — Tổ × Kỳ cho MỘT báo cáo đã chọn,
 * tối đa 12 cột (nhiều hơn thì dùng lại bảng S19 phẳng ở `StatusDashboardPage`).
 * "Không giao" (ô xám, không có lượt giao) phân biệt rõ với "Chưa nhập"
 * (có lượt giao, `state='NOT_STARTED'`) — spec §6.1 yêu cầu rõ điều này.
 *
 * S23 (PR8 slice 5) — trạng thái màn riêng cho "không có quyền" (báo cáo
 * tồn tại nhưng caller không có `DynReportRole`/`admin:DynamicReport` trên
 * nó → backend trả 404 chống dò, `getStatusMatrix`). Trước đó mọi lỗi đều
 * rơi vào CÙNG một thông báo "không tải được — thử lại", gây hiểu lầm là
 * lỗi mạng tạm thời trong khi thực ra thử lại cũng không giúp được gì.
 */
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { DynReportSubmissionState } from '@/features/dynamic-reports/types';
import {
  DYN_REPORT_SUBMISSION_STATE_LABEL,
  DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS,
} from '@/shared/enums/status-labels';
import { formatVNDateTime } from '@/lib/dates';
import { extractApiError } from '@/lib/api-errors';

export default function StatusMatrixPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const reportId = searchParams.get('matrixReportId') ?? '';

  const { data: reports, isLoading: isLoadingReports } = useQuery({
    queryKey: ['dynamic-reports', 'status-reports'],
    queryFn: () => dynamicReportsApi.listStatusReports(),
  });

  const { data: matrix, isLoading: isLoadingMatrix, isError, error } = useQuery({
    queryKey: ['dynamic-reports', 'status-matrix', reportId],
    queryFn: () => dynamicReportsApi.getStatusMatrix(reportId),
    enabled: reportId.length > 0,
  });

  const isForbidden = isError && extractApiError(error).status === 404;

  function handleSelectReport(nextReportId: string) {
    const params = new URLSearchParams(searchParams);
    if (nextReportId) params.set('matrixReportId', nextReportId);
    else params.delete('matrixReportId');
    setSearchParams(params);
  }

  return (
    <div data-testid="status-matrix-panel">
      <div className="mb-4">
        <label htmlFor="matrix-report-select" className="block text-xs font-medium text-slate-600 mb-1">
          Báo cáo
        </label>
        <select
          id="matrix-report-select"
          data-testid="matrix-report-select"
          value={reportId}
          onChange={(e) => handleSelectReport(e.target.value)}
          disabled={isLoadingReports}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">— Chọn báo cáo —</option>
          {(reports ?? []).map((r) => (
            <option key={r.reportId} value={r.reportId}>
              {r.reportName}
            </option>
          ))}
        </select>
      </div>

      {!reportId ? (
        <p className="text-sm text-slate-500" data-testid="matrix-no-report">
          Chọn một báo cáo để xem ma trận.
        </p>
      ) : isForbidden ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-2" data-testid="matrix-forbidden">
          <p className="text-sm text-amber-800">
            Bạn không có quyền xem báo cáo này — liên hệ quản lý báo cáo để được cấp quyền.
          </p>
        </div>
      ) : isError ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <p className="text-sm text-red-700">Không tải được ma trận — vui lòng thử lại.</p>
        </div>
      ) : isLoadingMatrix ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : !matrix || matrix.periods.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="matrix-empty">
          Báo cáo này chưa có kỳ nào.
        </p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-auto" data-testid="matrix-table">
          <table className="text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-3 py-2 sticky left-0 bg-slate-50">Tổ</th>
                {matrix.periods.map((p) => (
                  <th
                    key={p.periodId}
                    className="text-center px-3 py-2 whitespace-nowrap"
                    title={`Hạn: ${formatVNDateTime(p.dueAt)}`}
                  >
                    {p.periodKey}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matrix.teams.map((team) => (
                <tr key={team.teamId} data-testid={`matrix-row-${team.teamId}`}>
                  <td className="px-3 py-2 text-slate-700 sticky left-0 bg-white font-medium whitespace-nowrap">
                    {team.teamName}
                  </td>
                  {matrix.periods.map((p) => {
                    const cell = matrix.cells[team.teamId]?.[p.periodId];
                    return (
                      <td
                        key={p.periodId}
                        className="px-3 py-2 text-center"
                        data-testid={`matrix-cell-${team.teamId}-${p.periodId}`}
                      >
                        <MatrixCellBadge
                          notAssigned={cell?.notAssigned ?? true}
                          state={cell?.state ?? null}
                          dueAt={cell?.dueAt ?? null}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MatrixCellBadge({
  notAssigned,
  state,
  dueAt,
}: {
  notAssigned: boolean;
  state: DynReportSubmissionState | null;
  dueAt: string | null;
}) {
  if (notAssigned || !state) {
    return (
      <span className="text-xs text-slate-400" data-testid="matrix-cell-not-assigned" title="Không giao">
        Không giao
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS[state]}`}
      title={dueAt ? `Hạn: ${formatVNDateTime(dueAt)}` : undefined}
    >
      {DYN_REPORT_SUBMISSION_STATE_LABEL[state]}
    </span>
  );
}
