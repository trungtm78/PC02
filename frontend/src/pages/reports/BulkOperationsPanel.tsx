/**
 * D9 — lịch sử thao tác hàng loạt.
 *
 * `BulkOperation` được ghi từ lâu nhưng chưa có màn hình nào đọc: mỗi lần xuất,
 * gán hay trả hàng loạt đều để lại một dòng, và cách duy nhất để xem là mở
 * `psql`. Khi một mẻ 200 hồ sơ chạy nửa chừng, đây là chỗ duy nhất trả lời được
 * "mẻ đó gồm những hồ sơ nào".
 *
 * Tách khỏi bảng nhật ký kiểm toán chứ không trộn vào: nhật ký là MỘT DÒNG MỖI
 * HỒ SƠ, còn đây là MỘT DÒNG MỖI MẺ. Hai hình dạng khác nhau, hai bảng.
 */
import { useCallback, useEffect, useState } from 'react';
import { Layers, Loader2, ChevronRight, X } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';

interface BulkRow {
  id: string;
  resource: string;
  action: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  succeededCount: number;
  skippedCount: number;
  failedCount: number;
  actor?: { username: string; firstName?: string; lastName?: string } | null;
}

interface BulkDetail extends BulkRow {
  auditItems: {
    id: string;
    action: string;
    subject: string;
    subjectId: string;
    createdAt: string;
  }[];
}

const ACTION_LABEL: Record<string, string> = {
  BULK_EXPORT: 'Xuất hàng loạt',
  BULK_ASSIGN: 'Phân công hàng loạt',
  BULK_DELETE: 'Xoá hàng loạt',
  BULK_TRANSFER: 'Chuyển hàng loạt',
  BULK_RECORD_RETURN: 'Trả hồ sơ hàng loạt',
};

const RESOURCE_LABEL: Record<string, string> = {
  Case: 'Vụ án',
  Incident: 'Vụ việc',
  Petition: 'Đơn thư',
};

function actorName(a: BulkRow['actor']) {
  if (!a) return '—';
  return [a.firstName, a.lastName].filter(Boolean).join(' ') || a.username;
}

export function BulkOperationsPanel() {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BulkDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/bulk-operations?limit=50');
      setRows((res.data?.data?.data ?? res.data?.data ?? []) as BulkRow[]);
    } catch (e) {
      setError(extractApiError(e, 'Không tải được lịch sử thao tác hàng loạt').message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const openDetail = async (id: string) => {
    setDetailError(null);
    try {
      const res = await api.get(`/bulk-operations/${id}`);
      setDetail((res.data?.data ?? res.data) as BulkDetail);
    } catch (e) {
      // Báo lỗi rồi dừng — mở một ngăn rỗng trông như "mẻ này không có gì".
      setDetailError(extractApiError(e, 'Không mở được chi tiết mẻ').message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 p-8 justify-center" data-testid="bulk-loading">
        <Loader2 className="w-5 h-5 animate-spin" /> Đang tải…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" data-testid="bulk-error">
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-10 text-center bg-white border border-slate-200 rounded-lg" data-testid="bulk-empty">
        <Layers className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="font-medium text-slate-800">Chưa có thao tác hàng loạt nào</p>
        <p className="text-sm text-slate-500 mt-1">
          Xuất, phân công, trả hồ sơ hàng loạt sẽ được ghi lại ở đây.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="bulk-panel">
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Thời điểm', 'Thao tác', 'Loại hồ sơ', 'Người thực hiện', 'Thành công', 'Bỏ qua', 'Lỗi', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-slate-700 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100" data-testid={`bulk-row-${r.id}`}>
                <td className="px-4 py-2.5 whitespace-nowrap">{formatVNDateTime(r.startedAt)}</td>
                <td className="px-4 py-2.5">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="px-4 py-2.5">{RESOURCE_LABEL[r.resource] ?? r.resource}</td>
                <td className="px-4 py-2.5">{actorName(r.actor)}</td>
                <td className="px-4 py-2.5 tabular-nums text-green-700">{r.succeededCount}</td>
                <td className="px-4 py-2.5 tabular-nums text-amber-700">{r.skippedCount}</td>
                {/* Số lỗi được tô đỏ khi khác 0: một mẻ chạy nửa chừng trông
                    giống hệt một mẻ thành công nếu chỉ nhìn tổng. */}
                <td
                  className={`px-4 py-2.5 tabular-nums ${r.failedCount > 0 ? 'text-red-700 font-bold' : 'text-slate-500'}`}
                >
                  {r.failedCount}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => void openDetail(r.id)}
                    data-testid={`bulk-detail-${r.id}`}
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    Chi tiết <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailError && (
        <p className="text-sm text-red-600" data-testid="bulk-detail-error">
          {detailError}
        </p>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết thao tác hàng loạt"
            data-testid="bulk-detail-modal"
            className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                {ACTION_LABEL[detail.action] ?? detail.action} · {RESOURCE_LABEL[detail.resource] ?? detail.resource}
              </h3>
              <button onClick={() => setDetail(null)} aria-label="Đóng">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-slate-600 mb-3">
                {formatVNDateTime(detail.startedAt)} · {actorName(detail.actor)} ·{' '}
                <b className="text-green-700">{detail.succeededCount}</b> thành công ·{' '}
                <b className="text-amber-700">{detail.skippedCount}</b> bỏ qua ·{' '}
                <b className="text-red-700">{detail.failedCount}</b> lỗi
              </p>
              {detail.auditItems.length === 0 ? (
                <p className="text-sm text-slate-500">Mẻ này chưa có dòng nhật ký nào.</p>
              ) : (
                <ul className="text-sm divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {detail.auditItems.map((it) => (
                    <li key={it.id} className="px-3 py-2 flex items-center justify-between gap-3">
                      <span className="font-mono text-slate-700">{it.subjectId}</span>
                      <span className="text-slate-500">{it.action}</span>
                      <span className="text-slate-400 whitespace-nowrap">{formatVNDateTime(it.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkOperationsPanel;
