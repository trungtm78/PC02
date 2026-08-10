/**
 * TransferAndReturnPage — Chuyển đội và Trả hồ sơ (SCR-PF-01)
 * TASK-ID: TASK-2026-260216
 *
 * REFS-FIRST: Adapted from C:/PC02/Refs/src/app/pages/TransferAndReturn.tsx
 * data-testid added for E2E/UAT automation per OPENCODE_QA_GATE.
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Download,
  RotateCcw,
  Eye,
  ArrowRightLeft,
  CornerUpLeft,
  X,
  Calendar,
  Building2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatVNDate, today } from '../../lib/dates';
import { downloadCsv } from '@/lib/csv';
import { extractApiError } from '@/lib/api-errors';
import { RecordReturnType } from '@/shared/enums/generated';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CaseRecord {
  id: string;
  stt: number;
  recordType: 'Đơn thư' | 'Vụ việc' | 'Vụ án';
  recordCode: string;
  name: string;
  currentTeam: string;
  createdDate: string;
  status: string;
  statusColor: string;
  assignedTo: string;
  isClosed?: boolean;
}


/** Loại hồ sơ trên bảng ↔ tham số `target` của `POST /workflow/returns`. */
const RETURN_TARGET_BY_TYPE: Record<CaseRecord['recordType'], 'case' | 'incident' | 'petition'> = {
  'Vụ án': 'case',
  'Vụ việc': 'incident',
  'Đơn thư': 'petition',
};

interface ReturnBulkResult {
  succeeded: { id: string }[];
  skipped: { id: string; message?: string }[];
  failed: { id: string; error: string }[];
}

// ─── Status label maps ────────────────────────────────────────────────────────

const CASE_STATUS_LABELS: Record<string, string> = {
  TIEP_NHAN: 'Tiếp nhận',
  DANG_XAC_MINH: 'Đang xác minh',
  DA_XAC_MINH: 'Đã xác minh',
  DANG_DIEU_TRA: 'Đang điều tra',
  TAM_DINH_CHI: 'Tạm đình chỉ',
  DINH_CHI: 'Đình chỉ',
  DA_KET_LUAN: 'Đã kết luận',
  DANG_TRUY_TO: 'Đang truy tố',
  DANG_XET_XU: 'Đang xét xử',
  DA_LUU_TRU: 'Đã lưu trữ',
  CHUYEN_VKS: 'Chuyển VKS',
  KHOI_TO: 'Khởi tố',
  DA_KET_THUC: 'Đã kết thúc',
};

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  TIEP_NHAN: 'Tiếp nhận',
  DANG_XAC_MINH: 'Đang xác minh',
  DA_GIAI_QUYET: 'Đã giải quyết',
  TAM_DINH_CHI: 'Tạm đình chỉ',
  QUA_HAN: 'Quá hạn',
  DA_CHUYEN_VU_AN: 'Đã chuyển vụ án',
};

const PETITION_STATUS_LABELS: Record<string, string> = {
  MOI_TIEP_NHAN: 'Mới tiếp nhận',
  DANG_XU_LY: 'Đang xử lý',
  DA_GIAI_QUYET: 'Đã giải quyết',
  DA_LUU_DON: 'Đã lưu đơn',
  DA_CHUYEN_VU_AN: 'Đã chuyển VA',
};

function getStatusLabel(recordType: CaseRecord['recordType'], status: string): string {
  if (recordType === 'Vụ án') return CASE_STATUS_LABELS[status] ?? status;
  if (recordType === 'Vụ việc') return INCIDENT_STATUS_LABELS[status] ?? status;
  return PETITION_STATUS_LABELS[status] ?? status;
}

function getStatusBadgeClass(status: string): string {
  if (['DANG_DIEU_TRA', 'DANG_XU_LY', 'DANG_XAC_MINH', 'TIEP_NHAN', 'MOI_TIEP_NHAN', 'KHOI_TO', 'DANG_TRUY_TO', 'DANG_XET_XU'].includes(status))
    return 'bg-blue-100 text-blue-700';
  if (['DA_GIAI_QUYET', 'DA_KET_LUAN', 'DA_KET_THUC', 'DA_LUU_TRU', 'DA_LUU_DON', 'DA_XAC_MINH'].includes(status))
    return 'bg-green-100 text-green-700';
  if (['TAM_DINH_CHI', 'DINH_CHI'].includes(status))
    return 'bg-slate-100 text-slate-600';
  if (['QUA_HAN'].includes(status))
    return 'bg-red-100 text-red-700';
  if (['DA_CHUYEN_VU_AN', 'CHUYEN_VKS'].includes(status))
    return 'bg-purple-100 text-purple-700';
  return 'bg-slate-100 text-slate-600';
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Màn hình Chuyển đội và Trả hồ sơ — quản lý chuyển giao hồ sơ giữa các đội.
 * Hỗ trợ multiselect, tìm kiếm nhanh, bộ lọc nâng cao, modal Chuyển/Trả.
 */
export default function TransferAndReturnPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleViewRecord = (record: { id: string; recordType: string }) => {
    if (record.recordType === 'Vụ án') navigate(`/cases/${record.id}`);
    else if (record.recordType === 'Vụ việc') navigate(`/vu-viec/${record.id}`);
    else if (record.recordType === 'Đơn thư') navigate(`/petitions/${record.id}`);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [quickSearch, setQuickSearch] = useState('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);

  // Context banner (khi navigate từ màn hình khác)
  const [showContextBanner, setShowContextBanner] = useState(false);
  const [contextInfo, setContextInfo] = useState<{
    recordCode: string;
    sourceScreen: string;
  } | null>(null);

  // Modal states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'transfer' | 'return' | null>(null);

  const [advancedFilters, setAdvancedFilters] = useState({
    recordType: '',
    currentTeam: '',
    status: '',
    fromDate: '',
    toDate: '',
  });

  // ── Real data state ────────────────────────────────────────────────────────
  const [allData, setAllData] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
      setLoading(true);
      try {
        const [casesRes, incidentsRes, petitionsRes] = await Promise.all([
          api.get('/cases?limit=50'),
          api.get('/incidents?limit=50'),
          api.get('/petitions?limit=50'),
        ]);
        const cases: CaseRecord[] = (casesRes.data.data ?? []).map((c: any, i: number) => ({
          id: c.id,
          stt: i + 1,
          recordType: 'Vụ án' as const,
          // Mã hồ sơ thật do hệ thống cấp. Trước đây cột này hiện 8 ký tự đầu
          // của id — một chuỗi không tra được ở đâu, và không khớp với con số
          // ghi trên bìa hồ sơ giấy.
          recordCode: c.caseCode ?? c.id.slice(0, 8).toUpperCase(),
          name: c.name,
          currentTeam: c.unit ?? '',
          createdDate: formatVNDate(c.createdAt),
          status: c.status ?? '',
          statusColor: 'text-blue-600',
          assignedTo: c.investigator ? `${c.investigator.firstName ?? ''} ${c.investigator.lastName ?? ''}`.trim() : '',
          isClosed: ['DA_KET_LUAN', 'DA_LUU_TRU', 'DINH_CHI'].includes(c.status),
        }));
        const incidents: CaseRecord[] = (incidentsRes.data.data ?? []).map((i: any, idx: number) => ({
          id: i.id,
          stt: cases.length + idx + 1,
          recordType: 'Vụ việc' as const,
          recordCode: i.code ?? i.id.slice(0, 8).toUpperCase(),
          name: i.name,
          currentTeam: i.unitId ?? '',
          createdDate: formatVNDate(i.createdAt),
          status: i.status ?? '',
          statusColor: 'text-emerald-600',
          assignedTo: i.investigator ? `${i.investigator.firstName ?? ''} ${i.investigator.lastName ?? ''}`.trim() : '',
          isClosed: ['DA_GIAI_QUYET', 'DA_CHUYEN_VU_AN'].includes(i.status),
        }));
        const petitions: CaseRecord[] = (petitionsRes.data.data ?? []).map((p: any, idx: number) => ({
          id: p.id,
          stt: cases.length + incidents.length + idx + 1,
          recordType: 'Đơn thư' as const,
          recordCode: p.stt ?? p.id.slice(0, 8).toUpperCase(),
          name: p.summary ?? `Đơn thư ${p.stt}`,
          currentTeam: p.unit ?? '',
          createdDate: formatVNDate(p.receivedDate),
          status: p.status ?? '',
          statusColor: 'text-amber-600',
          assignedTo: p.assignedTo ? `${p.assignedTo.firstName ?? ''} ${p.assignedTo.lastName ?? ''}`.trim() : '',
          isClosed: ['DA_GIAI_QUYET', 'DA_CHUYEN_VU_AN', 'DA_CHUYEN_VU_VIEC'].includes(p.status),
        }));
        setAllData([...cases, ...incidents, ...petitions]);
      } catch {
        setAllData([]);
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ── Auto-select từ navigation state ───────────────────────────────────────
  useEffect(() => {
    // Chờ data load xong mới xử lý
    if (allData.length === 0) return;

    const state = location.state as {
      preselectedRecord?: { id: string; caseNumber: string };
      sourceScreen?: string;
    } | null;

    if (!state?.preselectedRecord) return;

    const { id, caseNumber } = state.preselectedRecord;

    // Tìm record khớp theo id (chính xác nhất)
    const matchingRecord = allData.find((r) => r.id === id);

    if (matchingRecord) {
      setSelectedRecords([matchingRecord.id]);
      setShowContextBanner(true);

      const sourceScreenMap: Record<string, string> = {
        'comprehensive-list': 'Danh sách tổng hợp',
        'cases': 'Danh sách vụ án',
        'incidents': 'Danh sách vụ việc',
        'petitions': 'Danh sách đơn thư',
      };

      setContextInfo({
        recordCode: caseNumber ?? matchingRecord.recordCode,
        sourceScreen: sourceScreenMap[state.sourceScreen ?? ''] ?? (state.sourceScreen ?? ''),
      });

      // Auto-scroll đến row đã chọn
      setTimeout(() => {
        const selectedRow = document.querySelector(`tr[data-record-id="${matchingRecord.id}"]`);
        if (selectedRow) {
          selectedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }

    // Xóa state khỏi history để tránh re-select khi refresh
    window.history.replaceState({}, document.title);
  }, [location, allData]);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filteredRecords = allData.filter((record) => {
    const q = quickSearch.toLowerCase();
    const matchesQuickSearch =
      record.recordCode.toLowerCase().includes(q) ||
      record.name.toLowerCase().includes(q) ||
      record.currentTeam.toLowerCase().includes(q);

    const matchesType = !advancedFilters.recordType || record.recordType === advancedFilters.recordType;
    const matchesTeam = !advancedFilters.currentTeam ||
      record.currentTeam.toLowerCase().includes(advancedFilters.currentTeam.toLowerCase());
    const matchesStatus = !advancedFilters.status || record.status === advancedFilters.status;

    return matchesQuickSearch && matchesType && matchesTeam && matchesStatus;
  });

  /**
   * "Xuất Excel" chưa từng có `onClick`. Xuất đúng những dòng người dùng đang
   * nhìn (đã lọc), theo thứ tự cột của bảng — không phải toàn bộ dữ liệu.
   */
  const handleExport = () => {
    downloadCsv(
      filteredRecords.map((r) => [
        r.recordType,
        r.recordCode,
        r.name,
        r.currentTeam,
        r.assignedTo,
        r.status,
        r.createdDate,
      ]),
      ['Loại hồ sơ', 'Mã hồ sơ', 'Tên', 'Đơn vị hiện tại', 'Người thụ lý', 'Trạng thái', 'Ngày tạo'],
      `luan-chuyen-tra-ho-so-${today()}.csv`,
    );
  };

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const displayedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Select logic ───────────────────────────────────────────────────────────

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecords(filteredRecords.map((r) => r.id));
    } else {
      setSelectedRecords([]);
    }
  };

  const handleSelectRecord = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedRecords((prev) => [...prev, id]);
    } else {
      setSelectedRecords((prev) => prev.filter((rid) => rid !== id));
    }
  };

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleTransferClick = () => {
    if (selectedRecords.length === 0) return;
    // EC-02: Không cho chuyển hồ sơ đã đóng
    const hasClosedRecord = allData
      .filter((r) => selectedRecords.includes(r.id))
      .some((r) => r.isClosed);
    if (hasClosedRecord) {
      alert('Không thể chuyển hồ sơ đã ở trạng thái "Đã đóng". Vui lòng bỏ chọn hồ sơ đó.');
      return;
    }
    setConfirmAction('transfer');
    setShowConfirmDialog(true);
  };

  const handleReturnClick = () => {
    if (selectedRecords.length === 0) return;
    setConfirmAction('return');
    setShowConfirmDialog(true);
  };

  const handleConfirmProceed = () => {
    setShowConfirmDialog(false);
    if (confirmAction === 'transfer') {
      setShowTransferModal(true);
    } else if (confirmAction === 'return') {
      setShowReturnModal(true);
    }
  };

  const getSelectedRecordsInfo = () =>
    allData.filter((r) => selectedRecords.includes(r.id));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Tiêu đề */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Chuyển đội và Trả hồ sơ</h1>
        <p className="text-slate-600 text-sm mt-1">
          Quản lý chuyển giao hồ sơ giữa các đội điều tra và trả hồ sơ về đơn vị
        </p>
      </div>

      {/* Context Banner — hiển thị khi navigate từ màn hình khác */}
      {showContextBanner && contextInfo && (
        <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-4 shadow-sm" data-testid="context-banner">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Info className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-blue-900 mb-1">
                Đang xử lý hồ sơ từ {contextInfo.sourceScreen}
              </h3>
              <p className="text-sm text-blue-800">
                Hồ sơ <span className="font-semibold">{contextInfo.recordCode}</span> đã được tự động chọn.
                Bạn có thể tiếp tục chọn thêm hồ sơ khác hoặc bắt đầu chuyển đội / trả hồ sơ ngay.
              </p>
            </div>
            <button
              onClick={() => setShowContextBanner(false)}
              className="flex-shrink-0 p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
              title="Đóng thông báo"
              data-testid="close-context-banner"
            >
              <X className="w-4 h-4 text-blue-700" />
            </button>
          </div>
        </div>
      )}

      {/* Thanh hành động */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              data-testid="transfer-btn"
              onClick={handleTransferClick}
              disabled={selectedRecords.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors font-medium ${
                selectedRecords.length === 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Chuyển đội ({selectedRecords.length})
            </button>
            <button
              data-testid="return-btn"
              onClick={handleReturnClick}
              disabled={selectedRecords.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                selectedRecords.length === 0
                  ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'border-purple-600 text-purple-600 hover:bg-purple-50'
              }`}
            >
              <CornerUpLeft className="w-4 h-4" />
              Trả hồ sơ ({selectedRecords.length})
            </button>
            <button
              data-testid="advanced-search-btn"
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Tìm kiếm nâng cao
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="export-excel-btn"
              onClick={handleExport}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Xuất Excel
            </button>
            <button
              data-testid="refresh-btn"
              onClick={() => void fetchAll()}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tìm kiếm nhanh */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              data-testid="quick-search-input"
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Tìm kiếm theo mã hồ sơ, tên hồ sơ, đội hiện tại..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tìm kiếm nâng cao */}
        {showAdvancedSearch && (
          <div className="mt-4 pt-4 border-t border-slate-200" data-testid="advanced-search-panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-slate-800 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Bộ lọc nâng cao
              </h3>
              <button
                onClick={() => setShowAdvancedSearch(false)}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Loại hồ sơ</label>
                <select
                  value={advancedFilters.recordType}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, recordType: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="">Tất cả</option>
                  <option value="Đơn thư">Đơn thư</option>
                  <option value="Vụ việc">Vụ việc</option>
                  <option value="Vụ án">Vụ án</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đội hiện tại</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={advancedFilters.currentTeam}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, currentTeam: e.target.value })}
                    placeholder="Tên đội"
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
                <select
                  value={advancedFilters.status}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="">Tất cả</option>
                  <option value="Mới tiếp nhận">Mới tiếp nhận</option>
                  <option value="Đang xử lý">Đang xử lý</option>
                  <option value="Đang điều tra">Đang điều tra</option>
                  <option value="Đã đóng">Đã đóng</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={advancedFilters.fromDate}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, fromDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={advancedFilters.toDate}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, toDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setAdvancedFilters({ recordType: '', currentTeam: '', status: '', fromDate: '', toDate: '' })}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm"
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-bold text-slate-800">Danh sách hồ sơ</h2>
          <p className="text-sm text-slate-600 mt-1">
            {loading ? 'Đang tải...' : (
              <>
                Hiển thị {filteredRecords.length} / {allData.length} hồ sơ
                {selectedRecords.length > 0 && (
                  <span className="ml-2 text-blue-600 font-medium">
                    • Đã chọn {selectedRecords.length} hồ sơ
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-3 text-slate-600">Đang tải dữ liệu...</span>
            </div>
          ) : (
            <table className="w-full" data-testid="record-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      data-testid="select-all-checkbox"
                      checked={filteredRecords.length > 0 && selectedRecords.length === filteredRecords.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-16 sticky left-12 bg-slate-50 z-10 border-r border-slate-200">Thao tác</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-16">STT</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Loại hồ sơ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Mã hồ sơ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Tên hồ sơ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Đội hiện tại</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Người phụ trách</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Ngày tạo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedRecords.map((record) => (
                  <tr
                    key={record.id}
                    data-record-id={record.id}
                    onClick={() => handleViewRecord(record)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewRecord(record); } }}
                    tabIndex={0}
                    className={`cursor-pointer transition-colors ${
                      selectedRecords.includes(record.id) ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-blue-50'
                    } ${record.isClosed ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        data-testid={`record-checkbox-${record.id}`}
                        checked={selectedRecords.includes(record.id)}
                        onChange={(e) => handleSelectRecord(record.id, e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td
                      className="px-3 py-3 whitespace-nowrap sticky left-12 z-10 bg-white border-r border-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        data-testid={`view-record-${record.id}`}
                        onClick={() => handleViewRecord(record)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-medium">{record.stt}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        record.recordType === 'Đơn thư'
                          ? 'bg-blue-100 text-blue-700'
                          : record.recordType === 'Vụ việc'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {record.recordType}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-medium text-blue-600">{record.recordCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700 line-clamp-2">{record.name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{record.currentTeam}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">{record.assignedTo}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">{record.createdDate}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-3 py-1.5 rounded-md text-xs font-medium ${getStatusBadgeClass(record.status)}`}>
                        {getStatusLabel(record.recordType, record.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Hiển thị <span className="font-medium">{filteredRecords.length}</span> trên{' '}
            <span className="font-medium">{allData.length}</span> hồ sơ
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Trước</button>
            <span className="px-3 py-2 text-sm font-medium text-slate-700">Trang {currentPage}/{totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Sau</button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showConfirmDialog && (
        <ConfirmDialog
          action={confirmAction!}
          selectedCount={selectedRecords.length}
          onConfirm={handleConfirmProceed}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}

      {showTransferModal && (
        <TransferModal
          selectedRecords={getSelectedRecordsInfo()}
          onClose={() => { setShowTransferModal(false); setSelectedRecords([]); }}
        />
      )}

      {showReturnModal && (
        <ReturnModal
          selectedRecords={getSelectedRecordsInfo()}
          onClose={() => { setShowReturnModal(false); }}
          onDone={() => {
            setShowReturnModal(false);
            setSelectedRecords([]);
            void fetchAll();
          }}
        />
      )}
    </div>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  action,
  selectedCount,
  onConfirm,
  onCancel,
}: {
  action: 'transfer' | 'return';
  selectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="confirm-dialog">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                Xác nhận {action === 'transfer' ? 'chuyển đội' : 'trả hồ sơ'}
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                Bạn đã chọn <span className="font-medium text-slate-800">{selectedCount} hồ sơ</span>{' '}
                để {action === 'transfer' ? 'chuyển đội' : 'trả về'}.
              </p>
              <p className="text-slate-600 text-sm">
                Bạn có chắc chắn muốn tiếp tục thực hiện thao tác này?
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            data-testid="confirm-cancel-btn"
            onClick={onCancel}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button
            data-testid="confirm-proceed-btn"
            onClick={onConfirm}
            className={`px-4 py-2.5 text-white rounded-lg transition-colors font-medium ${
              action === 'transfer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TransferModal ────────────────────────────────────────────────────────────

function TransferModal({ selectedRecords, onClose }: { selectedRecords: CaseRecord[]; onClose: () => void }) {
  const [formData, setFormData] = useState({ receivingTeam: '', reason: '', notes: '' });
  const [errors, setErrors] = useState<{ receivingTeam?: string; reason?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [results, setResults] = useState<{ succeeded: string[]; failed: string[] } | null>(null);

  // Map recordType → { endpoint, unitField }
  const getConfig = (recordType: CaseRecord['recordType']) => {
    if (recordType === 'Vụ án')   return { endpoint: 'cases',     unitField: 'unit' };
    if (recordType === 'Vụ việc') return { endpoint: 'incidents', unitField: 'unitId' };
    return                               { endpoint: 'petitions', unitField: 'unit' };
  };

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!formData.receivingTeam) newErrors.receivingTeam = 'Vui lòng chọn đội nhận';
    if (!formData.reason.trim()) newErrors.reason = 'Vui lòng nhập lý do chuyển đội';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    setApiError(null);

    const succeeded: string[] = [];
    const failed: string[] = [];

    await Promise.allSettled(
      selectedRecords.map(async (record) => {
        try {
          const { endpoint, unitField } = getConfig(record.recordType);
          // Ghi đè unit = tên đội nhận, lưu lý do vào metadata
          await api.put(`/${endpoint}/${record.id}`, {
            [unitField]: formData.receivingTeam,
            metadata: {
              transferReason: formData.reason,
              transferNotes: formData.notes || undefined,
              transferredFrom: record.currentTeam,
              transferredAt: new Date().toISOString(),
            },
          });
          succeeded.push(record.recordCode);
        } catch {
          failed.push(record.recordCode);
        }
      }),
    );

    setIsSubmitting(false);
    setResults({ succeeded, failed });
  };

  // Màn hình kết quả
  if (results) {
    const allOk = results.failed.length === 0;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="transfer-modal">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${allOk ? 'bg-green-100' : 'bg-amber-100'}`}>
              {allOk
                ? <ArrowRightLeft className="w-8 h-8 text-green-600" />
                : <AlertTriangle className="w-8 h-8 text-amber-600" />
              }
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {allOk ? 'Chuyển đội thành công!' : 'Chuyển đội hoàn tất (có lỗi)'}
            </h3>
            {results.succeeded.length > 0 && (
              <p className="text-sm text-green-700 mb-1">
                ✓ Thành công: <span className="font-medium">{results.succeeded.join(', ')}</span>
              </p>
            )}
            {results.failed.length > 0 && (
              <p className="text-sm text-red-700 mb-1">
                ✗ Thất bại: <span className="font-medium">{results.failed.join(', ')}</span>
              </p>
            )}
            <p className="text-xs text-slate-500 mt-3">
              Đội nhận: <span className="font-medium text-slate-700">{formData.receivingTeam}</span>
            </p>
          </div>
          <div className="border-t border-slate-200 px-6 py-4 flex justify-center">
            <button
              data-testid="transfer-result-close-btn"
              onClick={onClose}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="transfer-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Chuyển đội</h2>
            <p className="text-sm text-slate-600 mt-1">Đang chuyển {selectedRecords.length} hồ sơ sang đội mới</p>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Danh sách hồ sơ đã chọn */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">
              Danh sách hồ sơ được chọn ({selectedRecords.length})
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50">
              {selectedRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between gap-2 text-sm bg-white p-2 rounded border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      record.recordType === 'Đơn thư' ? 'bg-blue-100 text-blue-700'
                        : record.recordType === 'Vụ việc' ? 'bg-purple-100 text-purple-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {record.recordType}
                    </span>
                    <span className="font-medium text-blue-600">{record.recordCode}</span>
                  </div>
                  <span className="text-slate-600 text-xs truncate max-w-[160px]">
                    {record.currentTeam || '—'}
                    {record.currentTeam && <span className="text-slate-400 mx-1">→</span>}
                    {formData.receivingTeam && <span className="text-blue-600 font-medium">{formData.receivingTeam}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Đội nhận */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Đội nhận <span className="text-red-500">*</span>
            </label>
            <select
              data-testid="receiving-team-select"
              value={formData.receivingTeam}
              onChange={(e) => { setFormData({ ...formData, receivingTeam: e.target.value }); setErrors({ ...errors, receivingTeam: undefined }); }}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 bg-white ${errors.receivingTeam ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
              disabled={isSubmitting}
            >
              <option value="">Chọn đội nhận</option>
              <option value="Đội Điều tra Kinh tế">Đội Điều tra Kinh tế</option>
              <option value="Đội Điều tra Hình sự">Đội Điều tra Hình sự</option>
              <option value="Đội Điều tra Ma túy">Đội Điều tra Ma túy</option>
              <option value="Đội Điều tra Tổng hợp">Đội Điều tra Tổng hợp</option>
              <option value="Đội Điều tra Tham nhũng">Đội Điều tra Tham nhũng</option>
              <option value="Đội Cảnh sát Hình sự">Đội Cảnh sát Hình sự</option>
            </select>
            {errors.receivingTeam && <p className="text-xs text-red-600 mt-1">{errors.receivingTeam}</p>}
          </div>

          {/* Lý do chuyển đội */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Lý do chuyển đội <span className="text-red-500">*</span>
            </label>
            <textarea
              data-testid="transfer-reason-textarea"
              value={formData.reason}
              onChange={(e) => { setFormData({ ...formData, reason: e.target.value }); setErrors({ ...errors, reason: undefined }); }}
              rows={4}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${errors.reason ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
              placeholder="Nhập lý do cụ thể tại sao cần chuyển hồ sơ sang đội khác..."
              disabled={isSubmitting}
            />
            {errors.reason && <p className="text-xs text-red-600 mt-1">{errors.reason}</p>}
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ghi chú bổ sung</label>
            <textarea
              data-testid="transfer-notes-textarea"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Các ghi chú khác..."
              disabled={isSubmitting}
            />
          </div>

          {/* API error */}
          {apiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {apiError}
            </div>
          )}

          {/* Lưu ý */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Lưu ý:</p>
              <p>Sau khi chuyển đội, trường <strong>Đơn vị</strong> của hồ sơ sẽ được cập nhật thành đội nhận. Lý do chuyển được ghi vào metadata hồ sơ.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            data-testid="submit-transfer-btn"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Đang chuyển...</>
              : <><ArrowRightLeft className="w-4 h-4" />Chuyển đội ({selectedRecords.length})</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ReturnModal ──────────────────────────────────────────────────────────────

function ReturnModal({
  selectedRecords,
  onClose,
  onDone,
}: {
  selectedRecords: CaseRecord[];
  onClose: () => void;
  onDone: () => void;
}) {
  /**
   * Bản trước kết thúc bằng `alert("Đã trả N hồ sơ ... thành công!")` mà không
   * gọi API nào. Người dùng tin là xong, hệ thống không ghi gì — và hồ sơ vẫn
   * nằm nguyên ở đơn vị cũ.
   *
   * Một lần chỉ trả MỘT loại hồ sơ: lý do trả và đơn vị nhận lại thường khác
   * nhau theo loại, gộp chung là mời người dùng gắn nhầm căn cứ cho nửa số hồ sơ.
   */
  const types = [...new Set(selectedRecords.map((r) => r.recordType))];
  const mixed = types.length > 1;

  const [returnType, setReturnType] = useState<RecordReturnType | ''>('');
  const [toUnit, setToUnit] = useState('');
  const [reason, setReason] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnBulkResult | null>(null);

  const codeOf = (id: string) => selectedRecords.find((r) => r.id === id)?.recordCode ?? id;
  const invalid = mixed || !returnType || toUnit.trim().length < 2 || reason.trim().length < 10;

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      const res = await api.post('/workflow/returns', {
        target: RETURN_TARGET_BY_TYPE[types[0]],
        ids: selectedRecords.map((r) => r.id),
        returnType,
        reason: reason.trim(),
        toUnit: toUnit.trim(),
        ...(documentNo.trim() ? { documentNo: documentNo.trim() } : {}),
      });
      setResult((res.data?.data ?? res.data) as ReturnBulkResult);
    } catch (e) {
      // Báo lỗi rồi DỪNG — không đóng modal, không nói thành công.
      setErr(extractApiError(e, 'Trả hồ sơ thất bại').message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="return-modal">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trả hồ sơ"
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Trả hồ sơ</h2>
            <p className="text-sm text-slate-600 mt-1">
              Đang trả {selectedRecords.length} hồ sơ về đơn vị đã chuyển đến
            </p>
          </div>
          <button
            onClick={() => (result ? onDone() : onClose())}
            aria-label="Đóng"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {result ? (
          <div className="px-6 py-4 space-y-3" data-testid="return-result">
            <p className="text-sm">
              <b className="text-green-700">{result.succeeded.length} hồ sơ</b> đã trả.
              {result.skipped.length > 0 && (
                <>
                  {' '}
                  <b className="text-amber-700">{result.skipped.length}</b> bỏ qua.
                </>
              )}
              {result.failed.length > 0 && (
                <>
                  {' '}
                  <b className="text-red-700">{result.failed.length}</b> lỗi.
                </>
              )}
            </p>
            {result.skipped.length > 0 && (
              <ul className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                {result.skipped.map((sk) => (
                  <li key={sk.id}>
                    <b>{codeOf(sk.id)}</b>: {sk.message ?? 'Bỏ qua'}
                  </li>
                ))}
              </ul>
            )}
            {result.failed.length > 0 && (
              <ul className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                {result.failed.map((f) => (
                  <li key={f.id}>
                    <b>{codeOf(f.id)}</b>: {f.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="px-6 py-4 space-y-4">
            {mixed && (
              <p className="text-sm text-red-600" data-testid="mixed-error">
                Đang chọn nhiều loại hồ sơ ({types.join(', ')}). Mỗi lần chỉ trả được một loại —
                lý do trả và đơn vị nhận lại khác nhau theo loại.
              </p>
            )}

            <label className="block text-sm">
              <span className="block font-medium text-slate-700 mb-1.5">
                Loại trả <span className="text-red-500">*</span>
              </span>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value as RecordReturnType)}
                data-testid="select-return-type"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">-- Chọn loại trả --</option>
                <option value={RecordReturnType.KHONG_THUOC_THAM_QUYEN}>Không thuộc thẩm quyền</option>
                <option value={RecordReturnType.THIEU_TAI_LIEU}>Thiếu tài liệu</option>
                <option value={RecordReturnType.TRUNG_HO_SO}>Trùng hồ sơ</option>
                <option value={RecordReturnType.SAI_DIA_BAN}>Sai địa bàn</option>
                <option value={RecordReturnType.LY_DO_KHAC}>Lý do khác</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="block font-medium text-slate-700 mb-1.5">
                Đơn vị nhận lại <span className="text-red-500">*</span>
              </span>
              <input
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
                data-testid="input-to-unit"
                placeholder="Tên đơn vị đã chuyển hồ sơ đến"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="block font-medium text-slate-700 mb-1.5">
                Lý do trả <span className="text-red-500">*</span>
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                data-testid="input-reason"
                placeholder="Căn cứ trả hồ sơ"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <span className="text-xs text-slate-500">
                Tối thiểu 10 ký tự — trả hồ sơ là quyết định tố tụng, phải nêu căn cứ.
              </span>
            </label>

            <label className="block text-sm">
              <span className="block font-medium text-slate-700 mb-1.5">Số văn bản trả (nếu có)</span>
              <input
                value={documentNo}
                onChange={(e) => setDocumentNo(e.target.value)}
                data-testid="input-document-no"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>

            {err && (
              <p className="text-sm text-red-600" data-testid="submit-error">
                {err}
              </p>
            )}
          </div>
        )}

        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-2">
          {result ? (
            <button
              onClick={onDone}
              data-testid="btn-close-result"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Xong
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={() => void submit()}
                disabled={invalid || saving}
                data-testid="btn-submit-return"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Đang trả…' : 'Xác nhận trả hồ sơ'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
