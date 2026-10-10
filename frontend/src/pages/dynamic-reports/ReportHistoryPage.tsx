/**
 * S21 (spec §6.1 PR7 slice 8) — whole-period history/audit: every
 * assignment's revision history at once (read-only), plus which field
 * keys changed since each team's first submission. Metadata-only per R10
 * (kind/actor/reason/time) EXCEPT the changed-keys list, which this one
 * endpoint is explicitly allowed to compute from raw values because it
 * already re-checks the caller's manager/admin standing on this report
 * (same contract S16/S18 already use).
 */
import { Fragment, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, ChevronRight, History } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';

export default function ReportHistoryPage() {
  const { periodId } = useParams<{ periodId: string }>();
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);

  const { data: view, isLoading, isError } = useQuery({
    queryKey: ['dynamic-reports', 'report-history', periodId],
    queryFn: () => dynamicReportsApi.getReportHistory(periodId as string),
    enabled: !!periodId,
  });

  if (isLoading) {
    return <div className="max-w-4xl mx-auto p-6 text-sm text-slate-500">Đang tải…</div>;
  }
  if (isError || !view) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">Không tải được lịch sử kỳ này.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6" data-testid="report-history-page">
      <Link
        to={`/bao-cao-dong/duyet/tong-hop/${periodId}`}
        className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
      >
        Quay lại tổng hợp kỳ
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <History className="w-5 h-5 text-blue-700" />
        <h1 className="text-xl font-bold text-slate-800">Lịch sử — {view.reportName}</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">Kỳ {view.periodKey} · mọi tổ, chỉ đọc.</p>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100" data-testid="assignment-history-list">
        {view.assignments.map((a) => {
          const isExpanded = expandedAssignmentId === a.assignmentId;
          return (
            <Fragment key={a.assignmentId}>
              <button
                type="button"
                data-testid={`history-row-${a.assignmentId}`}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 ${A11Y_FOCUS_RING}`}
                onClick={() => setExpandedAssignmentId(isExpanded ? null : a.assignmentId)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span className="font-medium text-slate-800 text-sm">{a.teamName}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {a.revisions.length} lượt sửa
                  {a.changedFieldKeysSinceFirstSubmit !== null && (
                    <span className="ml-2" data-testid={`changed-count-${a.assignmentId}`}>
                      · {a.changedFieldKeysSinceFirstSubmit.length} ô đổi so với lần nộp đầu
                    </span>
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="bg-slate-50 px-4 py-3" data-testid={`history-detail-${a.assignmentId}`}>
                  {a.revisions.length === 0 ? (
                    <p className="text-xs text-slate-500">Chưa có hoạt động nào.</p>
                  ) : (
                    <table className="w-full text-xs mb-3">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="text-left py-1">Lượt</th>
                          <th className="text-left py-1">Hành động</th>
                          <th className="text-left py-1">Người thực hiện</th>
                          <th className="text-left py-1">Lý do</th>
                          <th className="text-right py-1">Thời điểm</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {a.revisions.map((r) => (
                          <tr key={r.revision}>
                            <td className="py-1">{r.revision}</td>
                            <td className="py-1">{r.kind}</td>
                            <td className="py-1">{r.actorName}</td>
                            <td className="py-1">{r.reason ?? '—'}</td>
                            <td className="py-1 text-right">{formatVNDateTime(r.committedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {a.changedFieldKeysSinceFirstSubmit !== null &&
                    a.changedFieldKeysSinceFirstSubmit.length > 0 && (
                      <div data-testid={`changed-keys-${a.assignmentId}`}>
                        <p className="text-xs font-medium text-slate-700 mb-1">
                          Ô đã đổi so với lần nộp đầu:
                        </p>
                        <p className="text-xs text-slate-600">
                          {a.changedFieldKeysSinceFirstSubmit.join(', ')}
                        </p>
                      </div>
                    )}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
