/**
 * RestorePage — /admin/khoi-phuc (theo quyền restore:<Subject> từng loại hồ sơ; v0.32.0.0, 20/09/2026)
 *
 * 3 tabs (Vụ án / Vụ việc / Đơn thư), mỗi tab list records đã xóa mềm
 * (deletedAt != null). Click "Khôi phục" → modal nhập reason 10-500 chars →
 * POST /<entity>/:id/restore body { reason }.
 *
 * Frontend gating: defense in depth. Backend @RequirePermissions guards API.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { soLieuHienThi } from '@/lib/soLieuHienThi';
import { authStore } from '@/stores/auth.store';
import { RotateCcw, X, AlertTriangle, FileText, ShieldAlert, Search } from 'lucide-react';
import { formatVNDateTime } from '../../lib/dates';
import { hoTen } from '@/lib/hoTen';
import { OTimKiemThe, DanhSachThe, useTheTimKiem } from '@/components/shared/ListPageShell';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';
import { usePermission } from '@/hooks/usePermission';
import { TIM_KIEM_VU_AN, TIM_KIEM_VU_VIEC, TIM_KIEM_DON_THU } from '@/shared/tim-kiem/generated';
import {
  CASE_STATUS_LABEL,
  INCIDENT_STATUS_LABEL,
  PETITION_STATUS_LABEL,
} from '@/shared/enums/status-labels';
import { CaseStatus, IncidentStatus, PetitionStatus } from '@/shared/enums/generated';

/** Cột "Trạng thái" mỗi loại tìm theo MÃ của đúng enum ấy; nhãn từ bảng nhãn cột trạng thái dùng. */
const GIA_TRI_CHON_VU_AN = {
  trangThai: Object.values(CaseStatus).map((v) => ({ value: v, label: CASE_STATUS_LABEL[v] })),
};
const GIA_TRI_CHON_VU_VIEC = {
  trangThai: Object.values(IncidentStatus).map((v) => ({
    value: v,
    label: INCIDENT_STATUS_LABEL[v],
  })),
};
const GIA_TRI_CHON_DON_THU = {
  trangThai: Object.values(PetitionStatus).map((v) => ({
    value: v,
    label: PETITION_STATUS_LABEL[v],
  })),
};
const GOI_Y_THE = 'Tìm trong mọi cột — gõ rồi chọn cột (phím /)';

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


/** Thẻ gửi đi (chuỗi JSON khoá theo giá trị) → mảng; rỗng thì không gửi khoá `tk`. */
function tkMang(tkKey: string): string[] | undefined {
  const tk = JSON.parse(tkKey) as string[];
  return tk.length ? tk : undefined;
}

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
  // "Chưa biết" và "biết, không phải admin" là hai chuyện khác nhau — xem `chuaBietTaiKhoan`.
  const chuaBietTaiKhoan = !profile;
  // Theo QUYỀN THẬT `restore:<Subject>` từng loại hồ sơ — cùng nguồn PermissionsGuard của máy chủ (20/09/2026). Trước
  // đó xét tên vai trò ADMIN: vai trò khác được cấp quyền khôi phục vẫn bị chặn, ADMIN bị gỡ quyền vẫn vào rồi nhận 403.
  const { hasPermission } = usePermission();
  const tabDuocPhep = (Object.keys(TAB_META) as TabKey[]).filter((k) => hasPermission(k, 'restore'));
  const coQuyenKhoiPhuc = tabDuocPhep.length > 0;

  const [tabChon, setTab] = useState<TabKey>('cases');
  // Tab đang chọn mà không có quyền (vd chỉ được khôi phục Đơn thư) → tab được phép đầu tiên.
  const tab: TabKey = tabDuocPhep.includes(tabChon) ? tabChon : (tabDuocPhep[0] ?? 'cases');
  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState('');

  // Ô tìm dạng thẻ — mỗi tab một khai và một khoá URL riêng: khoá của Vụ án (vd `doiTuongBiCan`) không
  // có ở Đơn thư, mang sang là 400 cả danh sách. Hook gọi đủ ba (không được gọi có điều kiện); chỉ thẻ
  // của tab đang mở được gửi. Cờ tắt → ô chữ cũ.
  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
  const timVuAn = useTheTimKiem({
    prefix: 'restoreCases',
    khai: TIM_KIEM_VU_AN,
    giaTriChon: GIA_TRI_CHON_VU_AN,
    bat: theBat,
  });
  const timVuViec = useTheTimKiem({
    prefix: 'restoreIncidents',
    khai: TIM_KIEM_VU_VIEC,
    giaTriChon: GIA_TRI_CHON_VU_VIEC,
    bat: theBat,
  });
  const timDonThu = useTheTimKiem({
    prefix: 'restorePetitions',
    khai: TIM_KIEM_DON_THU,
    giaTriChon: GIA_TRI_CHON_DON_THU,
    bat: theBat,
  });
  const theTab = tab === 'cases' ? timVuAn : tab === 'incidents' ? timVuViec : timDonThu;
  // Khoá theo GIÁ TRỊ: `tkGui` đổi tham chiếu mỗi lần URL đổi.
  const tkKey = JSON.stringify(theTab.tkGui);

  // Restore modal state
  const [target, setTarget] = useState<DeletedRow | null>(null);
  const [reason, setReason] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchList = useCallback(async () => {
    if (!coQuyenKhoiPhuc) return;
    setLoading(true);
    setLoadError("");
    try {
      const meta = TAB_META[tab];
      const res = await api.get<{ success: boolean; data: DeletedRow[]; total: number }>(
        `${meta.apiPath}/admin/deleted`,
        {
          params: {
            limit: 50,
            offset: 0,
            // Cờ bật → chỉ gửi thẻ của tab đang mở; `search` cũng quy về thẻ "*" ở máy chủ.
            ...(theBat
              ? { tk: tkMang(tkKey) }
              : { search: search.trim() || undefined }),
          },
        },
      );
      setRows(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch (err) {
      console.error('[RestorePage] fetch failed:', err);
      setRows([]);
      setTotal(0);
      // Không nói ra thì màn hình khẳng định "Không có vụ án nào đã bị xóa. Tổng cộng: 0" —
      // một câu trả lời dứt khoát về thứ chưa hề hỏi được.
      setLoadError(extractApiError(err, "Không tải được danh sách. Vui lòng thử lại.").messages.join(", "));
    } finally {
      setLoading(false);
    }
  }, [tab, search, coQuyenKhoiPhuc, theBat, tkKey]);

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

  if (chuaBietTaiKhoan) {
    return (
      <div className="p-6" data-testid="restore-unknown-profile">
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-amber-900">
              Chưa đọc được tài khoản đang đăng nhập
            </h2>
            <p className="text-sm text-amber-800 mt-1">
              Đây KHÔNG phải là từ chối quyền — hệ thống chưa hỏi được máy chủ về tài khoản của
              anh/chị. Tải lại trang; nếu vẫn vậy thì máy chủ đang không trả lời.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!coQuyenKhoiPhuc) {
    return (
      <div className="p-6" data-testid="restore-non-admin-block">
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-amber-900">Tài khoản chưa được cấp quyền khôi phục dữ liệu</h2>
            <p className="text-sm text-amber-800 mt-1">
              Vai trò của anh/chị chưa có quyền khôi phục Vụ án, Vụ việc hay Đơn thư đã xoá. Liên hệ quản trị viên hệ thống nếu cần.
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

      <LoadErrorBanner error={loadError} what="danh sách đã xoá" data-testid="restore-load-error" />

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
        {tabDuocPhep.map((key) => (
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
      {theBat ? (
        <div className="max-w-2xl">
          {tab === 'cases' && (
            <OTimKiemThe
              the={timVuAn.the}
              truong={TIM_KIEM_VU_AN}
              khai={TIM_KIEM_VU_AN}
              giaTriChon={GIA_TRI_CHON_VU_AN}
              onThem={timVuAn.them}
              onBoThe={timVuAn.boThe}
              onBoGiaTri={timVuAn.boGiaTri}
              placeholder={GOI_Y_THE}
            />
          )}
          {tab === 'incidents' && (
            <OTimKiemThe
              the={timVuViec.the}
              truong={TIM_KIEM_VU_VIEC}
              khai={TIM_KIEM_VU_VIEC}
              giaTriChon={GIA_TRI_CHON_VU_VIEC}
              onThem={timVuViec.them}
              onBoThe={timVuViec.boThe}
              onBoGiaTri={timVuViec.boGiaTri}
              placeholder={GOI_Y_THE}
            />
          )}
          {tab === 'petitions' && (
            <OTimKiemThe
              the={timDonThu.the}
              truong={TIM_KIEM_DON_THU}
              khai={TIM_KIEM_DON_THU}
              giaTriChon={GIA_TRI_CHON_DON_THU}
              onThem={timDonThu.them}
              onBoThe={timDonThu.boThe}
              onBoGiaTri={timDonThu.boGiaTri}
              placeholder={GOI_Y_THE}
            />
          )}
        </div>
      ) : (
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
      )}

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
              ) : loadError ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500" data-testid="error-row">
                  Chưa hỏi được máy chủ — xem thông báo phía trên.
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500" data-testid="empty-state">
                  Không có {meta.entityLabel} nào đã bị xóa.
                  {/* Nhánh `loadError` nằm ngay trên — rỗng ở đây là câu trả lời thật của máy chủ. */}
                  {theBat && theTab.the.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                      <span>Không tìm thấy với:</span>
                      {tab === 'cases' && (
                        <DanhSachThe the={timVuAn.the} khai={TIM_KIEM_VU_AN} giaTriChon={GIA_TRI_CHON_VU_AN} onBoThe={timVuAn.boThe} />
                      )}
                      {tab === 'incidents' && (
                        <DanhSachThe the={timVuViec.the} khai={TIM_KIEM_VU_VIEC} giaTriChon={GIA_TRI_CHON_VU_VIEC} onBoThe={timVuViec.boThe} />
                      )}
                      {tab === 'petitions' && (
                        <DanhSachThe the={timDonThu.the} khai={TIM_KIEM_DON_THU} giaTriChon={GIA_TRI_CHON_DON_THU} onBoThe={timDonThu.boThe} />
                      )}
                    </div>
                  )}
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
          Tổng cộng: <strong>{soLieuHienThi(total, !!loadError)}</strong> {meta.entityLabel} đã xóa
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
