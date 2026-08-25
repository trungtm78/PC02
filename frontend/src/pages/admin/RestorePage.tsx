/**
 * RestorePage — /admin/khoi-phuc (ADMIN only via permission table; v0.32.0.0)
 *
 * 3 tabs (Vụ án / Vụ việc / Đơn thư), mỗi tab list records đã xóa mềm
 * (deletedAt != null). Click "Khôi phục" → modal nhập reason 10-500 chars →
 * POST /<entity>/:id/restore body { reason }.
 *
 * Frontend gating: defense in depth. Backend @RequirePermissions guards API.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { authStore } from '@/stores/auth.store';
import { RotateCcw, X, AlertTriangle, FileText, ShieldAlert, Search } from 'lucide-react';
import { formatVNDateTime } from '../../lib/dates';
import { hoTen } from '@/lib/hoTen';

type TabKey = 'cases' | 'incidents' | 'petitions';

interface DeletedRow {
  id: string;
  name?: string;
  code?: string;
  stt?: string;
  senderName?: string;
  deletedAt: string;
  createdBy?: { firstName?: string; lastName?: string; username: string } | null;
  enteredBy?: { firstName?: string; lastName?: string; username: string } | null;
  deleteAudit?: {
    userId: string | null;
    metadata?: Record<string, unknown>;
    createdAt: string;
  } | null;
}

const TAB_META: Record<TabKey, {
  label: string;
  apiPath: string;
  entityLabel: string;
  identifier: (r: DeletedRow) => string;
  display: (r: DeletedRow) => string;
}> = {
  cases: {
    label: 'Vụ án',
    apiPath: '/cases',
    entityLabel: 'vụ án',
    identifier: (r) => r.id.slice(0, 12) + '…',
    display: (r) => r.name ?? '(không tên)',
  },
  incidents: {
    label: 'Vụ việc',
    apiPath: '/incidents',
    entityLabel: 'vụ việc',
    identifier: (r) => r.code ?? r.id.slice(0, 12) + '…',
    display: (r) => r.name ?? '(không tên)',
  },
  petitions: {
    label: 'Đơn thư',
    apiPath: '/petitions',
    entityLabel: 'đơn thư',
    identifier: (r) => r.stt ?? r.id.slice(0, 12) + '…',
    display: (r) => r.senderName ?? '(không người gửi)',
  },
};


function actorDisplay(row: DeletedRow): string {
  const u = row.createdBy ?? row.enteredBy;
  if (!u) return '—';
  return hoTen(u) || u.username;
}

function deleteReasonDisplay(row: DeletedRow): string {
  const meta = row.deleteAudit?.metadata as Record<string, unknown> | undefined;
  return typeof meta?.reason === 'string' ? meta.reason : '—';
}

export default function RestorePage() {
  const profile = authStore.getProfile();
  const isAdmin = profile?.role === 'ADMIN';

  const [tab, setTab] = useState<TabKey>('cases');
  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Restore modal state
  const [target, setTarget] = useState<DeletedRow | null>(null);
  const [reason, setReason] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchList = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const meta = TAB_META[tab];
      const res = await api.get<{ success: boolean; data: DeletedRow[]; total: number }>(
        `${meta.apiPath}/admin/deleted`,
        { params: { limit: 50, offset: 0, search: search.trim() || undefined } },
      );
      setRows(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch (err) {
      console.error('[RestorePage] fetch failed:', err);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tab, search, isAdmin]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  // Esc handler + autofocus
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !restoring) closeModal();
    };
    document.addEventListener('keydown', onKey);
    setTimeout(() => textareaRef.current?.focus(), 50);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, restoring]);

  const openRestoreModal = (row: DeletedRow, btn: HTMLButtonElement | null) => {
    setTarget(row);
    setReason('');
    setRestoreError(null);
    triggerRef.current = btn;
  };

  const closeModal = () => {
    setTarget(null);
    setReason('');
    setRestoreError(null);
    if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  };

  const confirmRestore = async () => {
    if (!target || reason.trim().length < 10) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const meta = TAB_META[tab];
      await api.post(`${meta.apiPath}/${target.id}/restore`, { reason: reason.trim() });
      setRows((prev) => prev.filter((r) => r.id !== target.id));
      setTotal((t) => Math.max(0, t - 1));
      setSuccessMessage(`Đã khôi phục ${meta.entityLabel} "${TAB_META[tab].display(target).slice(0, 60)}".`);
      closeModal();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      const text = Array.isArray(msg) ? msg.join(', ') : msg ?? 'Khôi phục thất bại. Vui lòng thử lại.';
      setRestoreError(text);
    } finally {
      setRestoring(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6" data-testid="restore-non-admin-block">
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-amber-900">Chỉ quản trị viên truy cập được trang này</h2>
            <p className="text-sm text-amber-800 mt-1">
              Trang Khôi phục dữ liệu dành riêng cho vai trò ADMIN. Liên hệ quản trị viên hệ thống nếu cần khôi phục dữ liệu đã xóa.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const meta = TAB_META[tab];
  const reasonLen = reason.length;
  const reasonValid = reasonLen >= 10;
  const canSubmit = reasonValid && !restoring;

  return (
    <div className="p-6 space-y-6" data-testid="restore-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Khôi phục dữ liệu đã xóa</h1>
          <p className="text-sm text-slate-600 mt-1">
            Khôi phục vụ án, vụ việc và đơn thư đã bị xóa mềm. Mọi thao tác được ghi vào nhật ký kiểm toán.
          </p>
        </div>
        <button
          onClick={() => void fetchList()}
          className="p-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          title="Tải lại"
          data-testid="btn-refresh-restore"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {successMessage && (
        <div
          className="bg-green-50 border-2 border-green-300 rounded-lg p-3 flex items-center gap-3"
          data-testid="success-banner"
          role="status"
        >
          <FileText className="w-5 h-5 text-green-600" />
          <p className="text-sm font-medium text-green-800 flex-1">{successMessage}</p>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-green-100 rounded">
            <X className="w-4 h-4 text-green-700" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1">
        {(Object.keys(TAB_META) as TabKey[]).map((key) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSearch(''); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
            }`}
            data-testid={`tab-${key}`}
          >
            {TAB_META[key].label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Tìm kiếm ${meta.entityLabel}...`}
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="search-input"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Mã / STT</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Tên / Người gửi</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Người tạo</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Thời điểm xóa</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Lý do xóa</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500" data-testid="loading">Đang tải...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500" data-testid="empty-state">
                  Không có {meta.entityLabel} nào đã bị xóa.
                </td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} data-testid={`row-${row.id}`}>
                    <td className="px-4 py-3 font-mono text-blue-700">{meta.identifier(row)}</td>
                    <td className="px-4 py-3 text-slate-800">{meta.display(row)}</td>
                    <td className="px-4 py-3 text-slate-700">{actorDisplay(row)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatVNDateTime(row.deletedAt)}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={deleteReasonDisplay(row)}>
                      {deleteReasonDisplay(row)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => openRestoreModal(row, e.currentTarget as HTMLButtonElement)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                        data-testid={`btn-restore-${row.id}`}
                      >
                        Khôi phục
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-600">
          Tổng cộng: <strong>{total}</strong> {meta.entityLabel} đã xóa
        </div>
      </div>

      {/* Restore Modal */}
      {target && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-testid="restore-modal"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-5 border-b border-slate-200 flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-800">Khôi phục {meta.entityLabel}</h3>
                <p className="text-sm text-slate-600 mt-0.5 font-mono">Mã: <strong>{meta.identifier(target)}</strong></p>
                <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{meta.display(target)}</p>
              </div>
              <button
                onClick={closeModal}
                disabled={restoring}
                className="p-1 hover:bg-slate-100 rounded disabled:opacity-50"
                aria-label="Đóng"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {target.deleteAudit && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                  <p className="text-slate-700">
                    <strong>Đã xóa:</strong> {formatVNDateTime(target.deletedAt)}
                  </p>
                  <p className="text-slate-700 mt-1">
                    <strong>Lý do xóa gốc:</strong> {deleteReasonDisplay(target)}
                  </p>
                </div>
              )}
              <div>
                <label htmlFor="restore-reason" className="block text-sm font-medium text-slate-700 mb-1">
                  Lý do khôi phục <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="restore-reason"
                  ref={textareaRef}
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 500))}
                  rows={3}
                  maxLength={500}
                  disabled={restoring}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-50"
                  placeholder="Nhập lý do khôi phục (ít nhất 10 ký tự)..."
                  data-testid="restore-reason-input"
                />
                <div className="flex items-center justify-between mt-1">
                  {!reasonValid && reasonLen > 0 ? (
                    <p className="text-xs text-red-500">Cần ít nhất 10 ký tự</p>
                  ) : (
                    <span />
                  )}
                  <p className={`text-xs ${reasonLen < 10 ? 'text-red-500' : reasonLen > 480 ? 'text-amber-600' : 'text-slate-500'}`} data-testid="restore-reason-counter">
                    {reasonLen}/500
                  </p>
                </div>
              </div>
              {restoreError && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-lg" data-testid="restore-error-banner">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-800">{restoreError}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 p-4 flex gap-3 justify-end">
              <button
                onClick={closeModal}
                disabled={restoring}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                data-testid="btn-cancel-restore"
              >
                Hủy
              </button>
              <button
                onClick={() => void confirmRestore()}
                disabled={!canSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="btn-confirm-restore"
              >
                {restoring ? 'Đang khôi phục...' : 'Xác nhận khôi phục'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
