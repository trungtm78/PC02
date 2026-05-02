import { useState, useCallback, useEffect } from 'react';
import {
  FileSpreadsheet,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhuLucRecord {
  id: string;
  stt: number;
  maHoSo: string;
  tenVuViecVuAn: string;
  doiTuong: string;   // Họ tên bị can / đối tượng
  namSinh: string;    // Năm sinh
  diaChiThuongTru: string;
  noiXayRa: string;
  phanLoaiToiPham: string;
  ngayTiepNhan: string;
  tinhTrang: string;
  // TĐC fields (PL2/3/5/6)
  canCuTamDinhChi?: string;
  soQdTdc?: string;
  ngayTdc?: string;
  hanThoiHieu?: string;
  bienPhapKhacPhuc?: string;
  tienDoKhacPhuc?: string;
  ketQuaGiaiQuyet?: string;
  ghiChu: string;
}

interface PhuLucResponse {
  total: number;
  data: PhuLucRecord[];
  limited: boolean;
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { loai: 1, short: 'PL1', label: 'PL1 — Vụ việc đang giải quyết', isTdc: false, isCase: false },
  { loai: 2, short: 'PL2', label: 'PL2 — TĐC hết thời hiệu (VV)', isTdc: true, isCase: false },
  { loai: 3, short: 'PL3', label: 'PL3 — TĐC còn thời hiệu (VV)', isTdc: true, isCase: false },
  { loai: 4, short: 'PL4', label: 'PL4 — Vụ án đang điều tra', isTdc: false, isCase: true },
  { loai: 5, short: 'PL5', label: 'PL5 — VA-TĐC hết thời hiệu', isTdc: true, isCase: true },
  { loai: 6, short: 'PL6', label: 'PL6 — VA-TĐC còn thời hiệu', isTdc: true, isCase: true },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PhuLuc16Page() {
  const [activeLoai, setActiveLoai] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [unit, setUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhuLucResponse | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  const activeTab = TABS.find(t => t.loai === activeLoai)!;

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { loai: activeLoai };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (unit) params.unit = unit;
      const res = await api.get('/reports/phu-luc-1-6/preview', { params });
      setResult(res.data);
    } catch {
      setError('Không thể tải dữ liệu. Vui lòng thử lại.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [activeLoai, fromDate, toDate, unit]);

  // Auto-load on tab change
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [activeLoai]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string | number> = { loai: activeLoai };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (unit) params.unit = unit;
      const res = await api.get('/reports/phu-luc-1-6/export', {
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `PhuLuc${activeLoai}_${fromDate || 'all'}_${toDate || 'all'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Phụ lục 1-6 — Báo cáo BCA</h1>
        <p className="text-slate-500 text-sm mt-1">
          Danh sách hồ sơ theo quy định BCA — Phụ lục 1 đến 6
        </p>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 border-b border-slate-200 min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.loai}
              onClick={() => setActiveLoai(tab.loai)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#003973] ${
                activeLoai === tab.loai
                  ? 'bg-[#003973] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {activeLoai === tab.loai ? tab.label : tab.short}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-lg">
        <button
          onClick={() => setShowFilters(f => !f)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <span>Bộ lọc kỳ báo cáo</span>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showFilters && (
          <div className="px-5 pb-4 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Từ ngày</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Đến ngày</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Đơn vị</label>
                <input
                  type="text"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="Tất cả đơn vị"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973] w-44"
                />
              </div>
              <button
                onClick={fetchPreview}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg text-sm hover:bg-[#0052a3] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? 'Đang tải...' : 'Xem danh sách'}
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                {exporting ? 'Đang xuất...' : 'Xuất Excel'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Limited warning */}
      {result?.limited && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Hiển thị 500 bản ghi đầu tiên / {result.total} tổng cộng. Xuất Excel để lấy đầy đủ.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#003973]" />
          <span className="ml-3 text-slate-500">Đang tải danh sách...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && result && result.data.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center">
          <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Không có dữ liệu</p>
          <p className="text-sm text-slate-400 mt-1">Không tìm thấy hồ sơ phù hợp với bộ lọc</p>
        </div>
      )}

      {/* Initial state */}
      {!loading && !error && !result && (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <Download className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">{activeTab.label}</p>
          <p className="text-sm text-slate-400 mt-1">Chọn kỳ báo cáo và nhấn "Xem danh sách" hoặc "Xuất Excel" trực tiếp</p>
        </div>
      )}

      {/* Table */}
      {!loading && result && result.data.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">{activeTab.label}</h3>
            <span className="text-xs text-slate-500">{result.total} bản ghi</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#003973] text-white">
                  <th className="px-3 py-2.5 text-center font-semibold border border-[#002d61] w-12">STT</th>
                  <th className="px-3 py-2.5 text-left font-semibold border border-[#002d61] w-28">Mã hồ sơ</th>
                  <th className="px-3 py-2.5 text-left font-semibold border border-[#002d61]">Tên vụ {activeTab.isCase ? 'án' : 'việc'}</th>
                  <th className="px-3 py-2.5 text-left font-semibold border border-[#002d61]">Đối tượng</th>
                  {activeTab.isCase && <th className="px-3 py-2.5 text-center font-semibold border border-[#002d61] w-20">Năm sinh</th>}
                  <th className="px-3 py-2.5 text-left font-semibold border border-[#002d61]">Địa chỉ</th>
                  <th className="px-3 py-2.5 text-left font-semibold border border-[#002d61] w-28">Phân loại</th>
                  <th className="px-3 py-2.5 text-center font-semibold border border-[#002d61] w-28">Ngày tiếp nhận</th>
                  <th className="px-3 py-2.5 text-left font-semibold border border-[#002d61]">Tình trạng</th>
                  {activeTab.isTdc && (
                    <>
                      <th className="px-3 py-2.5 text-left font-semibold border border-[#002d61]">Căn cứ TĐC</th>
                      <th className="px-3 py-2.5 text-center font-semibold border border-[#002d61] w-28">Hạn thời hiệu</th>
                      <th className="px-3 py-2.5 text-left font-semibold border border-[#002d61]">Kết quả</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {result.data.map((row, idx) => (
                  <tr key={`${row.id}-${idx}`} className={idx % 2 === 0 ? 'bg-[#EFF6FF]' : 'bg-white'}>
                    <td className="px-3 py-2 text-center border border-slate-200 text-slate-600">{row.stt}</td>
                    <td className="px-3 py-2 border border-slate-200 font-mono text-xs text-slate-700">{row.maHoSo}</td>
                    <td className="px-3 py-2 border border-slate-200 text-slate-800 font-medium">{row.tenVuViecVuAn}</td>
                    <td className="px-3 py-2 border border-slate-200 text-slate-700">{row.doiTuong || '—'}</td>
                    {activeTab.isCase && <td className="px-3 py-2 border border-slate-200 text-center text-slate-600">{row.namSinh || '—'}</td>}
                    <td className="px-3 py-2 border border-slate-200 text-slate-600 text-xs">{row.diaChiThuongTru || '—'}</td>
                    <td className="px-3 py-2 border border-slate-200 text-xs text-slate-600">{row.phanLoaiToiPham || '—'}</td>
                    <td className="px-3 py-2 border border-slate-200 text-center text-xs text-slate-600">{row.ngayTiepNhan}</td>
                    <td className="px-3 py-2 border border-slate-200 text-xs text-slate-700">{row.tinhTrang}</td>
                    {activeTab.isTdc && (
                      <>
                        <td className="px-3 py-2 border border-slate-200 text-xs text-slate-600">{row.canCuTamDinhChi || '—'}</td>
                        <td className="px-3 py-2 border border-slate-200 text-center text-xs text-slate-600">{row.hanThoiHieu || '—'}</td>
                        <td className="px-3 py-2 border border-slate-200 text-xs text-slate-600">{row.ketQuaGiaiQuyet || '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
