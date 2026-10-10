/**
 * S15 thu nhỏ — danh sách phẳng lượt giao caller quản lý (spec §6.1 PR7
 * slice 1), cùng khuôn đơn giản với `ReportInputRegisterPage.tsx` (S11).
 * Slice 2 thêm dải "Tổng hợp theo kỳ" phía trên: mỗi (reportId, periodId)
 * khác nhau trong danh sách là một kỳ riêng, dẫn tới
 * `ReportPeriodSummaryPage.tsx` (S15 đầy đủ — KPI + tổng hợp từng trường
 * qua `AggregateService`).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardCheck, BarChart3, AlertCircle, Unlock } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import {
  DYN_REPORT_SUBMISSION_STATE_LABEL,
  DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS,
} from '@/shared/enums/status-labels';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';

export default function ReportManagerListPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dynamic-reports', 'manager-submissions'],
    queryFn: () => dynamicReportsApi.listForManager(),
    staleTime: 30_000,
  });

  const assignments = data ?? [];

  const periods = useMemo(() => {
    const seen = new Map<string, { periodId: string; reportName: string; periodKey: string }>();
    for (const a of data ?? []) {
      if (!seen.has(a.periodId)) {
        seen.set(a.periodId, { periodId: a.periodId, reportName: a.reportName, periodKey: a.periodKey });
      }
    }
    return Array.from(seen.values());
  }, [data]);

  return (
    <div className="max-w-3xl mx-auto p-6" data-testid="report-manager-list-page">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck className="w-5 h-5 text-blue-700" />
        <h1 className="text-xl font-bold text-slate-800">Duyệt báo cáo</h1>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Các lượt giao thuộc báo cáo bạn quản lý, chỉ hiện những kỳ đang mở.
      </p>

      <Link
        to="/bao-cao-dong/duyet/mo-khoa"
        data-testid="unlock-request-queue-link"
        className={`inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 mb-6 ${A11Y_FOCUS_RING}`}
      >
        <Unlock className="w-4 h-4" />
        Yêu cầu mở lại &amp; mở khoá hàng loạt
      </Link>

      {periods.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6" data-testid="period-summary-links">
          <p className="text-xs font-semibold text-blue-800 mb-2">Tổng hợp theo kỳ</p>
          <div className="flex flex-wrap gap-2">
            {periods.map((p) => (
              <Link
                key={p.periodId}
                to={`/bao-cao-dong/duyet/tong-hop/${p.periodId}`}
                data-testid={`period-summary-link-${p.periodId}`}
                className={`inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 rounded text-xs text-blue-700 hover:bg-blue-100 ${A11Y_FOCUS_RING}`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                {p.reportName} — Kỳ {p.periodKey}
              </Link>
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">
            Không tải được danh sách lượt giao — vui lòng thử lại.
          </p>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : assignments.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="empty-state">
          Chưa có lượt giao nào cần duyệt.
        </p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100" data-testid="assignment-list">
          {assignments.map((a) => (
            <Link
              key={a.assignmentId}
              to={`/bao-cao-dong/duyet/${a.assignmentId}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              data-testid={`assignment-row-${a.assignmentId}`}
            >
              <div>
                <div className="font-medium text-slate-800 text-sm">
                  {a.reportName} — {a.teamName || a.periodKey}
                </div>
                <div className="text-xs text-slate-500">
                  Kỳ {a.periodKey} · Hạn {formatVNDateTime(a.dueAt)}
                </div>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS[a.state]}`}
              >
                {DYN_REPORT_SUBMISSION_STATE_LABEL[a.state]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
