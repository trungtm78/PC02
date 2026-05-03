import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { CaseStatus } from "@/shared/enums/generated";
import { CASE_STATUS_LABEL } from "@/shared/enums/status-labels";
import { CASE_PHASE } from "@/shared/enums/case-phase";
import {
  Search,
  Download,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Calendar,
  MapPin,
  FileText,
  FolderOpen,
} from "lucide-react";
import { api } from "@/lib/api";

interface OtherCase {
  id: string;
  stt: number;
  caseName: string;
  type: string;
  location: string;
  ward: string;
  district: string;
  reportedBy: string;
  reportedDate: string;
  status: "pending" | "processing" | "resolved" | "archived";
  statusLabel: string;
  category: string;
  notes: string;
}

interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
  ward: string;
  district: string;
  status: string;
  category: string;
}

const categories = [
  "Chưa phân loại",
  "Vụ án hình sự",
  "Vụ việc dân sự",
  "Đơn thư khiếu nại",
  "Hồ sơ lưu trữ",
  "Khác",
];

export default function OtherClassificationPage() {
  const navigate = useNavigate();
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  const [allData, setAllData] = useState<OtherCase[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<FilterData>({
    quickSearch: "",
    fromDate: "",
    toDate: "",
    ward: "",
    district: "",
    status: "",
    category: "",
  });

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await api.get("/cases?limit=100");
        const mapped: OtherCase[] = (res.data.data ?? []).map((c: any, i: number) => ({
          id: c.id,
          stt: i + 1,
          caseName: c.name,
          type: c.crime ?? "Khác",
          location: "",
          ward: "",
          district: c.unit ?? "",
          reportedBy: c.investigator ? `${c.investigator.firstName ?? ""} ${c.investigator.lastName ?? ""}`.trim() : "",
          reportedDate: c.createdAt ? new Date(c.createdAt).toLocaleDateString("vi-VN") : "",
          status: (() => {
            const m: Record<string, string> = {
              [CaseStatus.TIEP_NHAN]: "pending",
              [CaseStatus.DANG_XAC_MINH]: "processing",
              [CaseStatus.DA_LUU_TRU]: "archived",
              [CaseStatus.DINH_CHI]: "archived",
              [CaseStatus.DA_KET_LUAN]: "resolved",
            };
            return m[c.status] ?? "pending";
          })() as OtherCase["status"],
          statusLabel: CASE_STATUS_LABEL[c.status as CaseStatus] ?? c.status ?? "",
          category: c.crime ?? "Khác",
          notes: "",
        }));
        setAllData(mapped);
      } catch {
        setAllData([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const filteredData = useMemo(() => {
    return allData.filter((item) => {
      if (filters.quickSearch) {
        const searchLower = filters.quickSearch.toLowerCase();
        const matchesSearch =
          String(item.stt).toLowerCase().includes(searchLower) ||
          item.caseName.toLowerCase().includes(searchLower) ||
          item.type.toLowerCase().includes(searchLower) ||
          item.ward.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (filters.fromDate && item.reportedDate < filters.fromDate) return false;
      if (filters.toDate && item.reportedDate > filters.toDate) return false;
      if (filters.ward && item.ward !== filters.ward) return false;
      if (filters.district && item.district !== filters.district) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.category && item.category !== filters.category) return false;

      return true;
    });
  }, [allData, filters]);

  const handleResetFilters = () => {
    setFilters({
      quickSearch: "",
      fromDate: "",
      toDate: "",
      ward: "",
      district: "",
      status: "",
      category: "",
    });
  };

  const handleView = (item: OtherCase) => {
    navigate(`/cases/${item.id}`);
  };

  const handleExport = () => {
    const toExport = filteredData.length > 0 ? filteredData : allData;
    if (toExport.length === 0) { alert('Không có dữ liệu để xuất!'); return; }
    const headers = ['STT', 'Tên vụ', 'Loại', 'Địa điểm', 'Phường/Xã',
                     'Khu vực', 'Người báo cáo', 'Ngày tiếp nhận', 'Trạng thái', 'Phân loại'];
    const rows = toExport.map(c => [
      c.stt, c.caseName, c.type, c.location,
      c.ward, c.district, c.reportedBy, c.reportedDate, c.statusLabel, c.category,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `PhanLoaiKhac_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: OtherCase["status"], label: string) => {
    const styles = {
      pending: "bg-amber-600 text-white",
      processing: "bg-blue-600 text-white",
      resolved: "bg-green-600 text-white",
      archived: "bg-slate-500 text-white",
    };

    return (
      <span
        data-testid={`status-badge-${status}`}
        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${styles[status]}`}
      >
        {label}
      </span>
    );
  };

  const totalCount = filteredData.length;
  const pendingCount = filteredData.filter((i) => i.status === CASE_PHASE.PENDING).length;
  const processingCount = filteredData.filter((i) => i.status === CASE_PHASE.PROCESSING).length;
  const resolvedCount = filteredData.filter((i) => i.status === CASE_PHASE.RESOLVED).length;

  return (
    <div className="p-6 space-y-6" data-testid="other-classification-page">
      <div>
        <h1 className="text-2xl font-bold text-[#003973]">Phân loại khác</h1>
        <p className="text-slate-600 text-sm mt-1">
          Quản lý các hồ sơ chưa được phân loại vào nhóm chính
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border-2 border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Tổng hồ sơ</p>
              <p className="text-3xl font-bold text-[#003973]">{totalCount}</p>
            </div>
            <div className="w-12 h-12 bg-[#003973]/10 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-[#003973]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-amber-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 font-medium mb-1">Chờ phân loại</p>
              <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-blue-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Đang xử lý</p>
              <p className="text-3xl font-bold text-blue-600">{processingCount}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Search className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-green-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium mb-1">Đã giải quyết</p>
              <p className="text-3xl font-bold text-green-600">{resolvedCount}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {loading ? (
            <span>Đang tải...</span>
          ) : (
            <>Hiển thị <span className="font-medium text-[#003973]">{filteredData.length}</span> hồ sơ</>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            data-testid="filter-toggle-btn"
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
              showAdvancedFilter
                ? "bg-[#003973]/10 border-[#003973] text-[#003973]"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Bộ lọc
            {showAdvancedFilter ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={handleExport}
            data-testid="export-excel-btn"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Xuất Excel
          </button>

          <button
            onClick={handleResetFilters}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Làm mới
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            data-testid="quick-search-input"
            value={filters.quickSearch}
            onChange={(e) => setFilters({ ...filters, quickSearch: e.target.value })}
            placeholder="Tìm kiếm theo STT, Tên hồ sơ, Loại, Phường/Xã..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent"
          />
        </div>

        {showAdvancedFilter && (
          <div className="pt-4 border-t border-slate-200" data-testid="advanced-filter-panel">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quận/Huyện</label>
                <select
                  value={filters.district}
                  onChange={(e) => setFilters({ ...filters, district: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white"
                >
                  <option value="">Tất cả</option>
                  <option value="Quận 1">Quận 1</option>
                  <option value="Quận 3">Quận 3</option>
                  <option value="Quận 5">Quận 5</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phường/Xã</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={filters.ward}
                    onChange={(e) => setFilters({ ...filters, ward: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white"
                  >
                    <option value="">Tất cả</option>
                    <option value="Phường 2">Phường 2</option>
                    <option value="Phường 4">Phường 4</option>
                    <option value="Phường 6">Phường 6</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phân loại</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white"
                >
                  <option value="">Tất cả</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white"
                >
                  <option value="">Tất cả</option>
                  <option value="pending">Chờ xử lý</option>
                  <option value="processing">Đang xử lý</option>
                  <option value="resolved">Đã giải quyết</option>
                  <option value="archived">Đã lưu trữ</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="other-classification-table">
            <thead className="bg-[#003973]/5 border-b-2 border-[#003973]/20">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider w-20 sticky left-0 bg-[#eef2f7] z-10 border-r border-slate-200">
                  Thao tác
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  STT
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Tên hồ sơ
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Loại
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Phân loại
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Địa điểm
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Ngày
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <p className="text-slate-500">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Không tìm thấy hồ sơ nào</p>
                    <p className="text-sm text-slate-400 mt-1">Thử điều chỉnh bộ lọc tìm kiếm</p>
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleView(item)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleView(item); } }}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-blue-50 transition-colors"
                  >
                    <td
                      className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleView(item)}
                        data-testid={`view-btn-${item.id}`}
                        className="p-1.5 text-[#003973] hover:bg-[#003973]/10 rounded transition-colors"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-[#003973]">{item.stt}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-800 font-medium line-clamp-2 max-w-xs">
                        {item.caseName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">{item.type}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-sm font-medium text-slate-800">{item.ward}</span>
                        </div>
                        <span className="text-xs text-slate-500">{item.district}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700">{item.reportedDate}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(item.status, item.statusLabel)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
