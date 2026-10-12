/**
 * S22 "Danh sách phiên bản" (spec §6.1 PR4 slice 6) — read-only list of
 * every version of one report, newest first, and which periods were
 * generated against each (D09 context: a report version only applies
 * going forward — this screen shows exactly that history).
 *
 * Design standard "created ⇒ editable and deletable": a published version is immutable, so "sửa" is "Cập nhật mẫu"
 * (a new version; D09 decides which open periods take it at once), and a version nobody depends on — a draft, or a
 * retired one no period was generated from — can be deleted here.
 */
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, History } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import {
  DYN_REPORT_VERSION_STATUS_LABEL,
  DYN_REPORT_VERSION_STATUS_BADGE_CLASS,
} from '@/shared/enums/status-labels';
import { formatVNDateTime } from '@/lib/dates';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';

export default function ReportVersionsPage() {
  const { reportId } = useParams<{ reportId: string }>();

  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dynamic-reports', 'versions', reportId],
    queryFn: () => dynamicReportsApi.listVersions(reportId as string),
    enabled: !!reportId,
  });

  async function handleDownload(versionId: string, version: number) {
    setDownloadingId(versionId);
    setDeleteError(null);
    try {
      await dynamicReportsApi.saveVersionFileToDisk(reportId as string, versionId, `mau-v${version}.xlsx`);
    } catch (err) {
      setDeleteError(extractApiError(err).message);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(versionId: string, version: number) {
    if (!window.confirm(`Xoá phiên bản v${version}? Việc này không hoàn tác được.`)) return;
    setDeletingId(versionId);
    setDeleteError(null);
    try {
      await dynamicReportsApi.deleteReportVersion(reportId as string, versionId);
      await queryClient.invalidateQueries({ queryKey: ['dynamic-reports', 'versions', reportId] });
      await queryClient.invalidateQueries({ queryKey: ['dynamic-reports', 'detail', reportId ?? ''] });
    } catch (err) {
      setDeleteError(extractApiError(err).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6" data-testid="report-versions-page">
      <Link
        to="/bao-cao-dong/thiet-lap"
        className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách báo cáo
      </Link>

      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-700" />
          <h1 className="text-xl font-bold text-slate-800">Danh sách phiên bản</h1>
        </div>
        <Link
          to={`/bao-cao-dong/thiet-lap/${reportId}/phien-ban/moi`}
          data-testid="btn-new-version"
          className={`px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 ${A11Y_FOCUS_RING}`}
        >
          Cập nhật mẫu
        </Link>
      </div>

      {deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-sm text-red-700" data-testid="version-delete-error">
          {deleteError}
        </div>
      )}

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
                <th className="text-right px-3 py-2">Thao tác</th>
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
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      data-testid={`btn-download-version-${v.version}`}
                      disabled={downloadingId === v.versionId}
                      onClick={() => void handleDownload(v.versionId, v.version)}
                      className={`px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 rounded disabled:opacity-50 ${A11Y_FOCUS_RING}`}
                    >
                      Tải file mẫu
                    </button>
                    {v.status !== 'PUBLISHED' && v.periodKeys.length === 0 && (
                      <button
                        type="button"
                        data-testid={`btn-delete-version-${v.version}`}
                        disabled={deletingId === v.versionId}
                        onClick={() => void handleDelete(v.versionId, v.version)}
                        className={`px-2 py-1 text-xs text-red-700 hover:bg-red-50 rounded disabled:opacity-50 ${A11Y_FOCUS_RING}`}
                      >
                        Xoá
                      </button>
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
