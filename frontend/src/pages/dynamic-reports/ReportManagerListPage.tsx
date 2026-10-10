/**
 * S15 thu nhỏ — danh sách phẳng lượt giao caller quản lý (spec §6.1 PR7
 * slice 1). Tổng hợp theo báo cáo (S15 đầy đủ) cần `AggregateService`,
 * chưa có — dời slice sau. Cùng khuôn đơn giản với
 * `ReportInputRegisterPage.tsx` (S11), vì số lượt giao caller quản lý
 * cũng nhỏ, không cần `ListPageShell`/cột tuỳ chọn.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardCheck, AlertCircle } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import {
  DYN_REPORT_SUBMISSION_STATE_LABEL,
  DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS,
} from '@/shared/enums/status-labels';
import { formatVNDateTime } from '@/lib/dates';

export default function ReportManagerListPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dynamic-reports', 'manager-submissions'],
    queryFn: () => dynamicReportsApi.listForManager(),
    staleTime: 30_000,
  });

  const assignments = data ?? [];

  return (
    <div className="max-w-3xl mx-auto p-6" data-testid="report-manager-list-page">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck className="w-5 h-5 text-blue-700" />
        <h1 className="text-xl font-bold text-slate-800">Duyệt báo cáo</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Các lượt giao thuộc báo cáo bạn quản lý, chỉ hiện những kỳ đang mở.
      </p>

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
