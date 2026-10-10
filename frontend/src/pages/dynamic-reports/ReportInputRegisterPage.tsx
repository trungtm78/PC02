/**
 * S11 thanh trên — danh sách lượt giao của người nhập hiện tại (spec §6.1
 * PR6). Không dùng `ListPageShell`/cột tuỳ chọn: một người nhập chỉ có
 * vài lượt giao đang mở (D06 — báo cáo × kỳ × tổ, không phải hàng nghìn
 * dòng như các danh sách hồ sơ), một bảng đơn giản là đủ.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardList, AlertCircle } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import {
  DYN_REPORT_SUBMISSION_STATE_LABEL,
  DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS,
} from '@/shared/enums/status-labels';
import { formatVNDateTime } from '@/lib/dates';

export default function ReportInputRegisterPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dynamic-reports', 'my-submissions'],
    queryFn: () => dynamicReportsApi.listMySubmissions(),
    staleTime: 30_000,
  });

  const assignments = data ?? [];

  return (
    <div className="max-w-3xl mx-auto p-6" data-testid="report-input-register-page">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="w-5 h-5 text-blue-700" />
        <h1 className="text-xl font-bold text-slate-800">Nhập & tổng hợp</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Các lượt giao bạn là người nhập, chỉ hiện những kỳ đang mở.
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
          Chưa có lượt giao nào đang mở.
        </p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100" data-testid="assignment-list">
          {assignments.map((a) => (
            <Link
              key={a.assignmentId}
              to={`/bao-cao-dong/nhap/${a.assignmentId}`}
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
