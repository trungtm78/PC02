/**
 * InvestigationDelegationPage — Ủy thác điều tra (SCR-PF-04)
 * TASK-ID: TASK-2026-260216
 *
 * REFS-FIRST: Adapted from C:/PC02/Refs/src/app/pages/InvestigationDelegation.tsx
 * data-testid added for E2E/UAT automation per OPENCODE_QA_GATE.
 * EC-03: Validation format UT-XXX/YYYY + duplicate check.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Download,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  FileText,
  Calendar,
  Building2,
  User,
  Clock,
  CheckCircle,
  Send,
  X,
  Save,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { soLieuHienThi } from '@/lib/soLieuHienThi';
import { downloadCsv } from '@/lib/csv';
import { today, toDateInput, formatVNDate } from '@/lib/dates';
import { OTimKiemThe, DanhSachThe, useTheTimKiem } from '@/components/shared/ListPageShell';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';
import { TIM_KIEM_UY_THAC } from '@/shared/tim-kiem/generated';
import { laGiaTriNgay } from '@/shared/tim-kiem/the';

/** Thẻ Trạng thái so MÃ enum ở máy chủ (`DelegationStatus`); nhãn chỉ để hiện. */
const GIA_TRI_CHON_UY_THAC = {
  trangThai: [
    { value: 'PENDING', label: 'Chờ nhận' },
    { value: 'RECEIVED', label: 'Đã nhận' },
    { value: 'COMPLETED', label: 'Đã hoàn thành' },
  ],
};

const PAGE_SIZE = 20;
/** Trần một lượt tải khi xuất (`@Max(200)` của DTO). */
const LO_XUAT = 200;

interface ThongKeUyThac {
  total: number;
  byStatus: Partial<Record<'PENDING' | 'RECEIVED' | 'COMPLETED', number>>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type DelegationStatus = 'pending' | 'received' | 'completed';

interface Delegation {
  id: string;
  stt?: number;
  delegationNumber: string;
  delegationDate: string;
  receivingUnit: string;
  status: DelegationStatus;
  statusLabel: string;
  content: string;
  createdBy: string;
  completedDate?: string;
  relatedCase?: string;
}

interface DelegationFormData {
  delegationNumber: string;
  content: string;
  delegationDate: string;
  receivingUnit: string;
  status: DelegationStatus;
  relatedCase: string;
}

interface ValidationErrors {
  delegationNumber?: string;
  content?: string;
  delegationDate?: string;
  receivingUnit?: string;
}

/** Một dòng `GET /delegations` — chỉ các trường màn dùng. */
interface DongUyThac {
  id: string;
  delegationNumber: string;
  delegationDate?: string | null;
  receivingUnit: string;
  status: string;
  content: string;
  createdBy?: { firstName?: string | null; lastName?: string | null } | null;
  completedDate?: string | null;
  relatedCase?: { name?: string | null } | null;
}

const TRANG_THAI_API: Record<string, DelegationStatus> = {
  PENDING: 'pending',
  RECEIVED: 'received',
  COMPLETED: 'completed',
};

const NHAN_TRANG_THAI: Record<DelegationStatus, string> = {
  pending: 'Chờ xử lý',
  received: 'Đã nhận',
  completed: 'Đã hoàn thành',
};

function docDongUyThac(d: DongUyThac): Delegation {
  const status = TRANG_THAI_API[d.status] ?? 'pending';
  return {
    id: d.id,
    delegationNumber: d.delegationNumber,
    delegationDate: toDateInput(d.delegationDate ?? undefined),
    receivingUnit: d.receivingUnit,
    status,
    statusLabel: NHAN_TRANG_THAI[status],
    content: d.content,
    createdBy: d.createdBy ? `${d.createdBy.firstName ?? ''} ${d.createdBy.lastName ?? ''}`.trim() : '',
    completedDate: d.completedDate ? new Date(d.completedDate).toISOString().split('T')[0] : undefined,
    relatedCase: d.relatedCase?.name ?? undefined,
  };
}

interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
  /** Mã enum máy chủ (PENDING…), rỗng = tất cả. */
  status: string;
}

/** Regex validate format UT-XXX/YYYY */
const DELEGATION_NUMBER_REGEX = /^UT-\d{3}\/\d{4}$/;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Màn hình Ủy thác điều tra — quản lý phiếu ủy thác cho các đơn vị khác.
 * Dashboard stats: tổng, chờ nhận, đã nhận, hoàn thành.
 * Validation format UT-XXX/YYYY và kiểm tra số trùng.
 */
export default function InvestigationDelegationPage() {
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [editingMode, setEditingMode] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedDelegation, setSelectedDelegation] = useState<Delegation | null>(null);

  const [filters, setFilters] = useState<FilterData>({
    quickSearch: '',
    fromDate: '',
    toDate: '',
    status: '',
  });

  const [formData, setFormData] = useState<DelegationFormData>({
    delegationNumber: '',
    content: '',
    delegationDate: '',
    receivingUnit: '',
    status: 'pending',
    relatedCase: '',
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // ── Tìm kiếm, lọc, phân trang, thống kê: ĐỀU ở máy chủ ─────────────────────
  // Trước 17/09/2026 màn tải `limit=100` rồi lọc tại chỗ, thẻ thống kê đếm trên phần đã tải.

  // Ô tìm dạng thẻ — thẻ trên URL `delegation_tk`. Cờ `TIM_KIEM_THE` tắt → ô chữ cũ gửi `search`.
  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
  const timKiem = useTheTimKiem({
    prefix: 'delegation',
    khai: TIM_KIEM_UY_THAC,
    giaTriChon: GIA_TRI_CHON_UY_THAC,
    bat: theBat,
  });
  // Khoá theo GIÁ TRỊ: `tkGui` đổi tham chiếu mỗi lần URL đổi.
  const tkKey = JSON.stringify(timKiem.tkGui);

  /** Tham số lọc chung của danh sách, thống kê và xuất (không gồm trạng thái, trang). */
  const thamSoLoc = useMemo(() => {
    const p = new URLSearchParams();
    if (theBat) {
      for (const v of JSON.parse(tkKey) as string[]) p.append('tk', v);
    } else if (filters.quickSearch.trim()) {
      p.set('search', filters.quickSearch.trim());
    }
    // Chỉ gửi ngày HỢP LỆ: gõ năm từng chữ số, ô ngày bắn 0002-09-17… — gửi đi là 400 cả màn.
    if (filters.fromDate && laGiaTriNgay(filters.fromDate)) p.set('fromDate', filters.fromDate);
    if (filters.toDate && laGiaTriNgay(filters.toDate)) p.set('toDate', filters.toDate);
    return p.toString();
  }, [theBat, tkKey, filters.quickSearch, filters.fromDate, filters.toDate]);

  // Trang gắn với KHOÁ bộ lọc: bộ lọc đổi thì về trang 1 ngay lúc vẽ (không effect), ghi đè khoá cũ.
  const khoaLoc = `${thamSoLoc}|${filters.status}`;
  const [trangTheoLoc, setTrangTheoLoc] = useState({ khoa: khoaLoc, page: 1 });
  if (trangTheoLoc.khoa !== khoaLoc) setTrangTheoLoc({ khoa: khoaLoc, page: 1 });
  const page = trangTheoLoc.khoa === khoaLoc ? trangTheoLoc.page : 1;
  const setPage = (doi: (p: number) => number) => setTrangTheoLoc({ khoa: khoaLoc, page: doi(page) });

  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [total, setTotal] = useState(0);
  const [thongKe, setThongKe] = useState<ThongKeUyThac | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  /** Số lượt tải — kết quả về trễ của lượt cũ không đè lượt mới. */
  const luotTai = useRef(0);
  /** Tăng để tải lại cùng bộ lọc (nút Làm mới). */
  const [lanTai, setLanTai] = useState(0);

  const fetchDelegations = useCallback(async () => {
    const luot = ++luotTai.current;
    const danhSach = new URLSearchParams(thamSoLoc);
    if (filters.status) danhSach.set('status', filters.status);
    danhSach.set('limit', String(PAGE_SIZE));
    danhSach.set('offset', String((page - 1) * PAGE_SIZE));
    setLoading(true);
    setLoadError("");
    try {
      const [ds, tk] = await Promise.all([
        api.get<{ data?: DongUyThac[]; total?: number }>(`/delegations?${danhSach}`),
        api.get<ThongKeUyThac>(`/delegations/stats?${thamSoLoc}`),
      ]);
      if (luot !== luotTai.current) return;
      const tong = Number(ds.data.total ?? 0);
      // Tổng giảm dưới trang đang xem → kẹp về trang cuối còn dữ liệu (lượt này không hạ cờ loading).
      const trangCuoi = Math.max(1, Math.ceil(tong / PAGE_SIZE));
      if (page > trangCuoi) {
        luotTai.current++;
        setTrangTheoLoc({ khoa: khoaLoc, page: trangCuoi });
        return;
      }
      setDelegations((ds.data.data ?? []).map(docDongUyThac));
      setTotal(tong);
      setThongKe(tk.data ?? null);
    } catch (e) {
      if (luot !== luotTai.current) return;
      // KHÔNG biến "không hỏi được máy chủ" thành "không có gì cả": mảng rỗng làm mọi thẻ
      // thống kê ra số 0, và số 0 đọc như một câu trả lời. Giữ lỗi lại để giao diện nói ra.
      setDelegations([]);
      setTotal(0);
      setThongKe(null);
      setLoadError(extractApiError(e, "Không tải được dữ liệu. Vui lòng thử lại.").messages.join(", "));
    } finally {
      if (luot === luotTai.current) setLoading(false);
    }
  }, [thamSoLoc, filters.status, page, khoaLoc, lanTai]);

  useEffect(() => { void fetchDelegations(); }, [fetchDelegations]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Stats ──────────────────────────────────────────────────────────────────
  // Lấy từ MÁY CHỦ trên cùng thẻ/ngày/phạm vi. Chưa có số (đang tải lần đầu) → undefined → dấu gạch.
  const demTrangThai = (t: 'PENDING' | 'RECEIVED' | 'COMPLETED') =>
    thongKe ? (thongKe.byStatus[t] ?? 0) : undefined;
  const totalCount = thongKe?.total;
  const pendingCount = demTrangThai('PENDING');
  const receivedCount = demTrangThai('RECEIVED');
  const completedCount = demTrangThai('COMPLETED');

  /** Xuất CSV: tải ĐỦ mọi trang khớp bộ lọc (không chỉ trang đang xem), rồi mới ghi tệp. */
  const [dangXuat, setDangXuat] = useState(false);
  const xuatCsv = async () => {
    setDangXuat(true);
    try {
      const tatCa: Delegation[] = [];
      for (let offset = 0; ; offset += LO_XUAT) {
        const p = new URLSearchParams(thamSoLoc);
        if (filters.status) p.set('status', filters.status);
        p.set('limit', String(LO_XUAT));
        p.set('offset', String(offset));
        const res = await api.get<{ data?: DongUyThac[]; total?: number }>(`/delegations?${p}`);
        const lo = (res.data.data ?? []).map(docDongUyThac);
        tatCa.push(...lo);
        if (lo.length < LO_XUAT || tatCa.length >= Number(res.data.total ?? 0)) break;
      }
      const headers = ['STT', 'Số ủy thác', 'Ngày', 'Đơn vị nhận', 'Trạng thái', 'Nội dung', 'Người tạo'];
      const rows = tatCa.map((d, i) => [
        i + 1, d.delegationNumber, d.delegationDate, d.receivingUnit,
        d.statusLabel, d.content, d.createdBy,
      ]);
      downloadCsv(rows, headers, `UyThacDieuTra_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      alert('Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setDangXuat(false);
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.delegationNumber.trim()) {
      errors.delegationNumber = 'Vui lòng nhập số ủy thác';
    } else if (!DELEGATION_NUMBER_REGEX.test(formData.delegationNumber)) {
      errors.delegationNumber = 'Số ủy thác phải có định dạng UT-XXX/YYYY (VD: UT-001/2026)';
    } else {
      // EC-03: Kiểm tra số ủy thác trùng
      const isEditingSelf = editingMode === 'edit' && selectedDelegation?.delegationNumber === formData.delegationNumber;
      const isDuplicate = !isEditingSelf && delegations.some((d) => d.delegationNumber === formData.delegationNumber);
      if (isDuplicate) {
        errors.delegationNumber = `Số ủy thác "${formData.delegationNumber}" đã tồn tại. Vui lòng nhập số khác.`;
      }
    }

    if (!formData.content.trim()) {
      errors.content = 'Vui lòng nhập nội dung ủy thác';
    } else if (formData.content.trim().length < 10) {
      errors.content = 'Nội dung phải có ít nhất 10 ký tự';
    }

    if (!formData.delegationDate) {
      errors.delegationDate = 'Vui lòng chọn ngày ủy thác';
    }

    if (!formData.receivingUnit.trim()) {
      errors.receivingUnit = 'Vui lòng chọn đơn vị nhận';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Modal handlers ─────────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingMode('add');
    setSelectedDelegation(null);
    setFormData({
      delegationNumber: '',
      content: '',
      delegationDate: today(),
      receivingUnit: '',
      status: 'pending',
      relatedCase: '',
    });
    setValidationErrors({});
    setShowDelegationModal(true);
  };

  const openEditModal = (delegation: Delegation) => {
    setEditingMode('edit');
    setSelectedDelegation(delegation);
    setFormData({
      delegationNumber: delegation.delegationNumber,
      content: delegation.content,
      delegationDate: delegation.delegationDate,
      receivingUnit: delegation.receivingUnit,
      status: delegation.status,
      relatedCase: delegation.relatedCase || '',
    });
    setValidationErrors({});
    setShowDelegationModal(true);
  };

  const openViewModal = (delegation: Delegation) => {
    setEditingMode('view');
    setSelectedDelegation(delegation);
    setFormData({
      delegationNumber: delegation.delegationNumber,
      content: delegation.content,
      delegationDate: delegation.delegationDate,
      receivingUnit: delegation.receivingUnit,
      status: delegation.status,
      relatedCase: delegation.relatedCase || '',
    });
    setValidationErrors({});
    setShowDelegationModal(true);
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    try {
      const dto = {
        delegationNumber: formData.delegationNumber,
        content: formData.content,
        delegationDate: formData.delegationDate,
        receivingUnit: formData.receivingUnit,
        status: formData.status,
        relatedCase: formData.relatedCase || undefined,
      };
      if (editingMode === 'add') {
        await api.post('/delegations', dto);
      } else if (editingMode === 'edit' && selectedDelegation) {
        await api.put(`/delegations/${selectedDelegation.id}`, dto);
      }
      await fetchDelegations();
    } catch (e) {
      // Danh sách đã phân trang: kiểm trùng tại chỗ chỉ thấy trang đang xem. Máy chủ chặn trùng bằng khoá
      // duy nhất (409) — phải NÓI ra dưới ô Số ủy thác, không để modal đứng im không lý do.
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setValidationErrors({
          ...validationErrors,
          delegationNumber: `Số ủy thác "${formData.delegationNumber}" đã tồn tại. Vui lòng nhập số khác.`,
        });
      }
      return;
    }
    setShowDelegationModal(false);
    setSelectedDelegation(null);
    setValidationErrors({});
  };


  // ── Status badge ───────────────────────────────────────────────────────────

  const getStatusBadge = (status: DelegationStatus, label: string) => {
    const styles: Record<DelegationStatus, string> = {
      pending: 'bg-amber-600 text-white',
      received: 'bg-blue-600 text-white',
      completed: 'bg-green-600 text-white',
    };
    const icons: Record<DelegationStatus, React.ReactNode> = {
      pending: <Clock className="w-3.5 h-3.5" />,
      received: <CheckCircle className="w-3.5 h-3.5" />,
      completed: <CheckCircle className="w-3.5 h-3.5" />,
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {label}
      </span>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Tiêu đề */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Quản lý Ủy thác điều tra</h1>
        <p className="text-slate-600 text-sm mt-1">
          Quản lý việc ủy thác điều tra cho các đơn vị công an khác
        </p>
      </div>

      {/* Thống kê */}
      <LoadErrorBanner error={loadError} what="danh sách ủy thác điều tra" data-testid="delegation-load-error" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div data-testid="stat-total" className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Tổng ủy thác</p>
              <p className="text-3xl font-bold text-slate-800">{soLieuHienThi(totalCount, !!loadError)}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </div>

        <div data-testid="stat-pending" className="bg-white rounded-lg border-2 border-amber-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 font-medium mb-1">Chờ nhận</p>
              <p className="text-3xl font-bold text-amber-600">{soLieuHienThi(pendingCount, !!loadError)}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div data-testid="stat-received" className="bg-white rounded-lg border-2 border-blue-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Đã nhận</p>
              <p className="text-3xl font-bold text-blue-600">{soLieuHienThi(receivedCount, !!loadError)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Send className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div data-testid="stat-completed" className="bg-white rounded-lg border-2 border-green-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium mb-1">Đã hoàn thành</p>
              <p className="text-3xl font-bold text-green-600">{soLieuHienThi(completedCount, !!loadError)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Thanh hành động */}
      <div className="flex items-center justify-between gap-3">
        <button
          data-testid="create-delegation-btn"
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Tạo ủy thác mới
        </button>

        <div className="flex items-center gap-3">
          <button
            data-testid="filter-toggle-btn"
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
              showAdvancedFilter
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Bộ lọc
            {showAdvancedFilter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            data-testid="export-excel-btn"
            onClick={() => { void xuatCsv(); }}
            disabled={dangXuat}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Xuất Excel
          </button>

          <button
            data-testid="refresh-btn"
            onClick={() => {
              timKiem.xoaHet();
              setFilters({ quickSearch: '', fromDate: '', toDate: '', status: '' });
              setLanTai((n) => n + 1);
            }}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Làm mới
          </button>
        </div>
      </div>

      {/* Tìm kiếm và bộ lọc */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
        {theBat ? (
          <OTimKiemThe
            the={timKiem.the}
            truong={TIM_KIEM_UY_THAC}
            khai={TIM_KIEM_UY_THAC}
            giaTriChon={GIA_TRI_CHON_UY_THAC}
            onThem={timKiem.them}
            onBoThe={timKiem.boThe}
            onBoGiaTri={timKiem.boGiaTri}
            placeholder="Tìm trong mọi cột — gõ rồi chọn cột (phím /)"
          />
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              data-testid="quick-search-input"
              type="text"
              value={filters.quickSearch}
              onChange={(e) => setFilters({ ...filters, quickSearch: e.target.value })}
              placeholder="Tìm kiếm theo số ủy thác, nội dung, đơn vị nhận..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {showAdvancedFilter && (
          <div className="pt-4 border-t border-slate-200" data-testid="advanced-filter-panel">
            {/* Đơn vị nhận: lọc bằng thẻ "Đơn vị nhận" — ô chọn cũ liệt kê cứng 5 công an quận không có trong dữ liệu. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" data-testid="filter-from-date" value={filters.fromDate}
                    onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" data-testid="filter-to-date" value={filters.toDate}
                    onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
                <select data-testid="filter-status" value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Tất cả</option>
                  {GIA_TRI_CHON_UY_THAC.trangThai.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-slate-600">
          {loading ? 'Đang tải...' : (
            <>Tìm thấy <span data-testid="delegation-total" className="font-medium text-slate-800">{total}</span> ủy thác</>
          )}
        </div>
      </div>

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="ml-3 text-slate-600">Đang tải dữ liệu...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="delegation-table">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-24 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Thao tác</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Số ủy thác</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Nội dung</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Ngày ủy thác</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Đơn vị nhận</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Người tạo</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {delegations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">{loadError ? 'Chưa hỏi được máy chủ — xem thông báo phía trên' : 'Không tìm thấy ủy thác nào'}</p>
                      {!loadError && theBat && timKiem.the.length > 0 ? (
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                          <span>Không tìm thấy với:</span>
                          <DanhSachThe
                            the={timKiem.the}
                            khai={TIM_KIEM_UY_THAC}
                            giaTriChon={GIA_TRI_CHON_UY_THAC}
                            onBoThe={timKiem.boThe}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 mt-1">Thử điều chỉnh bộ lọc hoặc tạo ủy thác mới</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  delegations.map((delegation) => (
                    <tr
                      key={delegation.id}
                      onClick={() => openViewModal(delegation)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openViewModal(delegation); } }}
                      tabIndex={0}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                    >
                      <td
                        className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            data-testid={`view-delegation-${delegation.id}`}
                            onClick={() => openViewModal(delegation)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {delegation.status !== 'completed' && (
                            <button
                              data-testid={`edit-delegation-${delegation.id}`}
                              onClick={() => openEditModal(delegation)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                              title="Sửa thông tin"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-bold text-blue-600">{delegation.delegationNumber}</span>
                        </div>
                        {delegation.relatedCase && (
                          <p className="text-xs text-slate-500 mt-0.5">Liên quan: {delegation.relatedCase}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-800 line-clamp-2 max-w-md">{delegation.content}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatVNDate(delegation.delegationDate)}
                        </div>
                        {delegation.completedDate && (
                          <p className="text-xs text-green-600 mt-1">Hoàn thành: {formatVNDate(delegation.completedDate)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-700 font-medium">{delegation.receivingUnit}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-700">{delegation.createdBy}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(delegation.status, delegation.statusLabel)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Trang {page} / {totalPages} — {total} ủy thác
            </p>
            <div className="flex items-center gap-2">
              <button
                data-testid="delegation-prev-page"
                aria-label="Trang trước"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                data-testid="delegation-next-page"
                aria-label="Trang sau"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Thêm/Sửa/Xem */}
      {showDelegationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="delegation-modal">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  {editingMode === 'add' && <><Plus className="w-5 h-5 text-blue-600" />Tạo ủy thác điều tra mới</>}
                  {editingMode === 'edit' && <><Edit className="w-5 h-5 text-slate-600" />Chỉnh sửa ủy thác</>}
                  {editingMode === 'view' && <><Eye className="w-5 h-5 text-blue-600" />Chi tiết ủy thác</>}
                </h3>
                <button
                  onClick={() => { setShowDelegationModal(false); setSelectedDelegation(null); setValidationErrors({}); }}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Thông tin ủy thác */}
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Thông tin ủy thác
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Số ủy thác */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Số ủy thác <span className="text-red-600">*</span>
                    </label>
                    <input
                      data-testid="delegation-number-input"
                      type="text"
                      value={formData.delegationNumber}
                      onChange={(e) => {
                        setFormData({ ...formData, delegationNumber: e.target.value });
                        setValidationErrors({ ...validationErrors, delegationNumber: undefined });
                      }}
                      disabled={editingMode === 'view'}
                      placeholder="UT-001/2026"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-600 ${
                        validationErrors.delegationNumber ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    />
                    {validationErrors.delegationNumber && (
                      <div className="flex items-center gap-1 mt-1 text-red-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <p data-testid="delegation-number-error" className="text-xs">{validationErrors.delegationNumber}</p>
                      </div>
                    )}
                  </div>

                  {/* Ngày ủy thác */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Ngày ủy thác <span className="text-red-600">*</span>
                    </label>
                    <input
                      data-testid="delegation-date-input"
                      type="date"
                      value={formData.delegationDate}
                      onChange={(e) => {
                        setFormData({ ...formData, delegationDate: e.target.value });
                        setValidationErrors({ ...validationErrors, delegationDate: undefined });
                      }}
                      disabled={editingMode === 'view'}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                        validationErrors.delegationDate ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    />
                    {validationErrors.delegationDate && (
                      <div className="flex items-center gap-1 mt-1 text-red-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <p data-testid="delegation-date-error" className="text-xs">{validationErrors.delegationDate}</p>
                      </div>
                    )}
                  </div>

                  {/* Đơn vị nhận */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Đơn vị nhận <span className="text-red-600">*</span>
                    </label>
                    <select
                      data-testid="receiving-unit-select"
                      value={formData.receivingUnit}
                      onChange={(e) => {
                        setFormData({ ...formData, receivingUnit: e.target.value });
                        setValidationErrors({ ...validationErrors, receivingUnit: undefined });
                      }}
                      disabled={editingMode === 'view'}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-white disabled:bg-slate-50 ${
                        validationErrors.receivingUnit ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                    >
                      <option value="">-- Chọn đơn vị --</option>
                      <option value="Công an Quận 1">Công an Quận 1</option>
                      <option value="Công an Quận 3">Công an Quận 3</option>
                      <option value="Công an Quận 5">Công an Quận 5</option>
                      <option value="Công an Quận 10">Công an Quận 10</option>
                      <option value="Công an Quận Tân Bình">Công an Quận Tân Bình</option>
                    </select>
                    {validationErrors.receivingUnit && (
                      <div className="flex items-center gap-1 mt-1 text-red-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <p data-testid="receiving-unit-error" className="text-xs">{validationErrors.receivingUnit}</p>
                      </div>
                    )}
                  </div>

                  {/* Trạng thái */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
                    <select
                      data-testid="delegation-status-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as DelegationStatus })}
                      disabled={editingMode === 'view' || editingMode === 'add'}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50"
                    >
                      <option value="pending">Chờ nhận</option>
                      <option value="received">Đã nhận</option>
                      <option value="completed">Đã hoàn thành</option>
                    </select>
                    {editingMode === 'add' && (
                      <p className="text-xs text-slate-500 mt-1">Trạng thái mặc định là &quot;Chờ nhận&quot;</p>
                    )}
                  </div>

                  {/* Vụ án liên quan */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Vụ án liên quan</label>
                    <input
                      data-testid="related-case-input"
                      type="text"
                      value={formData.relatedCase}
                      onChange={(e) => setFormData({ ...formData, relatedCase: e.target.value })}
                      disabled={editingMode === 'view'}
                      placeholder="VA-XXX/2026"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                    />
                  </div>
                </div>
              </div>

              {/* Nội dung ủy thác */}
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  Nội dung ủy thác
                </h4>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nội dung chi tiết <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    data-testid="delegation-content-textarea"
                    value={formData.content}
                    onChange={(e) => {
                      setFormData({ ...formData, content: e.target.value });
                      setValidationErrors({ ...validationErrors, content: undefined });
                    }}
                    disabled={editingMode === 'view'}
                    rows={5}
                    placeholder="Mô tả chi tiết công việc cần đơn vị nhận thực hiện..."
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-none disabled:bg-slate-50 ${
                      validationErrors.content ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  />
                  {validationErrors.content && (
                    <div className="flex items-center gap-1 mt-1 text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <p data-testid="delegation-content-error" className="text-xs">{validationErrors.content}</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1">{formData.content.length} ký tự (tối thiểu 10 ký tự)</p>
                </div>
              </div>

              {/* Thông tin bổ sung (view/edit only) */}
              {editingMode !== 'add' && selectedDelegation && (
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Thông tin bổ sung
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-600 mb-1">Người tạo</p>
                      <p className="text-sm font-medium text-slate-800">{selectedDelegation.createdBy}</p>
                    </div>
                    {selectedDelegation.completedDate && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-700 mb-1">Ngày hoàn thành</p>
                        <p className="text-sm font-medium text-green-800">{formatVNDate(selectedDelegation.completedDate)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => { setShowDelegationModal(false); setSelectedDelegation(null); setValidationErrors({}); }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {editingMode === 'view' ? 'Đóng' : 'Hủy bỏ'}
              </button>
              {editingMode !== 'view' && (
                <button
                  data-testid="save-delegation-btn"
                  onClick={() => void handleSave()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  {editingMode === 'add' ? 'Tạo ủy thác' : 'Lưu thay đổi'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
