/**
 * S22 "Danh sách phiên bản" (spec §6.1 PR4 slice 6) — read-only list of
 * every version of one report, newest first, and which periods were
 * generated against each (D09 context: a report version only applies
 * going forward — this screen shows exactly that history).
 *
 * Deliberately scoped to the LIST half of S22 only: "tạo phiên bản mới"
 * (D09 — apply immediately if no team has data yet, else from the next
 * period) and "tiếp tục nháp" are separate mutating actions, left for a
 * later slice — this screen has no write path at all.
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, History } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import {
  DYN_REPORT_VERSION_STATUS_LABEL,
  DYN_REPORT_VERSION_STATUS_BADGE_CLASS,
} from '@/shared/enums/status-labels';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';

export default function ReportVersionsPage() {
  const { reportId } = useParams<{ reportId: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dynamic-reports', 'versions', reportId],
    queryFn: () => dynamicReportsApi.listVersions(reportId as string),
    enabled: !!reportId,
  });

  return (
    <div className="max-w-4xl mx-auto p-6" data-testid="report-versions-page">
      <Link
        to="/bao-cao-dong/thiet-lap"
        className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách báo cáo
      </Link>

      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-blue-700" />
        <h1 className="text-xl font-bold text-slate-800">Danh sách phiên bản</h1>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">Không tải được danh sách phiên bản — vui lòng thử lại.</p>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="versions-empty">
          Báo cáo này chưa có phiên bản nào.
        </p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid="versions-table">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Phiên bản</th>
                <th className="text-left px-3 py-2">Trạng thái</th>
                <th className="text-left px-3 py-2">Xuất bản lúc</th>
                <th className="text-left px-3 py-2">Tạo lúc</th>
                <th className="text-left px-3 py-2">Kỳ dùng phiên bản này</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((v) => (
                <tr key={v.versionId} data-testid={`version-row-${v.version}`}>
                  <td className="px-3 py-2 text-slate-800 font-medium">v{v.version}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DYN_REPORT_VERSION_STATUS_BADGE_CLASS[v.status]}`}
                    >
                      {DYN_REPORT_VERSION_STATUS_LABEL[v.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {v.publishedAt ? formatVNDateTime(v.publishedAt) : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{formatVNDateTime(v.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {v.periodKeys.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      v.periodKeys.join(', ')
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
