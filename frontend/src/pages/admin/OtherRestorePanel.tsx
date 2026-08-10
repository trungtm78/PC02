/**
 * E3 — khôi phục hồ sơ con đã xoá mềm.
 *
 * Chín loại (đối tượng, luật sư, tài liệu, kết luận, ủy thác, đề xuất, hướng
 * dẫn, trao đổi, lịch công tác) có xoá mềm mà chưa từng có đường khôi phục.
 * Xoá mềm không khôi phục được thì "mềm" chỉ là cách nói.
 *
 * Một panel với ô chọn loại, thay vì chín tab: chín tab trên một màn hình quản
 * trị hiếm dùng chỉ làm khó tìm hơn.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';

interface Target {
  resource: string;
  label: string;
}

interface DeletedRow {
  id: string;
  deletedAt: string;
  [key: string]: unknown;
}

/** Nhãn dễ đọc nhất còn tìm được trên bản ghi — mỗi loại có cột khác nhau. */
function displayOf(row: DeletedRow): string {
  for (const key of ['fullName', 'title', 'name', 'code', 'stt', 'guidedPerson', 'content']) {
    const v = row[key];
    if (typeof v === 'string' && v.trim()) return v.length > 80 ? `${v.slice(0, 80)}…` : v;
  }
  return String(row.id);
}

export function OtherRestorePanel() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [resource, setResource] = useState('');
  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<DeletedRow | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await api.get('/admin/restore');
        const list = (res.data?.data ?? res.data ?? []) as Target[];
        if (!alive) return;
        setTargets(list);
        setResource((r) => r || list[0]?.resource || '');
      } catch (e) {
        if (alive) setError(extractApiError(e, 'Không tải được danh sách loại hồ sơ').message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const fetchRows = useCallback(async () => {
    if (!resource) return;
    setLoading(true);
    setError(null);
    try {
      const q = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
      const res = await api.get(`/admin/restore/${resource}?limit=50${q}`);
      const body = res.data?.data ?? res.data;
      setRows((body?.data ?? []) as DeletedRow[]);
      setTotal((body?.total ?? 0) as number);
    } catch (e) {
      setError(extractApiError(e, 'Không tải được danh sách đã xoá').message);
    } finally {
      setLoading(false);
    }
  }, [resource, search]);

  useEffect(() => {
    const t = setTimeout(() => void fetchRows(), 250);
    return () => clearTimeout(t);
  }, [fetchRows]);

  const submit = async () => {
    if (!restoring) return;
    setModalError(null);
    setSaving(true);
    try {
      await api.post(`/admin/restore/${resource}/${restoring.id}/restore`, {
        reason: reason.trim(),
      });
    } catch (e) {
      // Báo lỗi rồi DỪNG — đóng modal là nói rằng đã khôi phục xong.
      setModalError(extractApiError(e, 'Khôi phục thất bại').message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setBanner(`Đã khôi phục: ${displayOf(restoring)}`);
    setRestoring(null);
    setReason('');
    void fetchRows();
  };

  return (
    <div className="space-y-4" data-testid="other-restore-panel">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block font-medium text-slate-700 mb-1.5">Loại hồ sơ</span>
          <select
            value={resource}
            onChange={(e) => setResource(e.target.value)}
            data-testid="restore-resource"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            {targets.map((t) => (
              <option key={t.resource} value={t.resource}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm flex-1 min-w-[240px]">
          <span className="block font-medium text-slate-700 mb-1.5">Tìm kiếm</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="restore-search"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </label>
      </div>

      {banner && (
        <p className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800" data-testid="restore-banner">
          {banner}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 p-8 justify-center" data-testid="restore-loading">
          <Loader2 className="w-5 h-5 animate-spin" /> Đang tải…
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" data-testid="restore-error">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center bg-white border border-slate-200 rounded-lg" data-testid="restore-empty">
          <p className="font-medium text-slate-800">Không có bản ghi đã xoá</p>
          <p className="text-sm text-slate-500 mt-1">Loại hồ sơ này chưa có gì bị xoá mềm.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Bản ghi', 'Thời điểm xoá', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-slate-700 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100" data-testid={`restore-row-${r.id}`}>
                  <td className="px-4 py-2.5">{displayOf(r)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatVNDateTime(r.deletedAt)}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => {
                        setRestoring(r);
                        setReason('');
                        setModalError(null);
                      }}
                      data-testid={`restore-btn-${r.id}`}
                      className="flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Khôi phục
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-slate-500">Hiển thị {rows.length} / {total} bản ghi</p>
        </div>
      )}

      {restoring && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Khôi phục bản ghi"
            data-testid="restore-modal"
            className="bg-white rounded-xl shadow-xl w-full max-w-lg"
          >
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Khôi phục bản ghi</h3>
              <p className="text-sm text-slate-600 mt-1">{displayOf(restoring)}</p>
            </div>
            <div className="px-6 py-4 space-y-2">
              <label className="block text-sm">
                <span className="block font-medium text-slate-700 mb-1.5">
                  Lý do <span className="text-red-500">*</span>
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  data-testid="restore-reason"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <span className="text-xs text-slate-500">
                  Tối thiểu 10 ký tự — khôi phục là đảo ngược quyết định xoá của người khác.
                </span>
              </label>
              {modalError && (
                <p className="text-sm text-red-600" data-testid="restore-modal-error">
                  {modalError}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setRestoring(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={() => void submit()}
                disabled={reason.trim().length < 10 || saving}
                data-testid="restore-confirm"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Đang khôi phục…' : 'Khôi phục'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OtherRestorePanel;
