import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  Filter,
  Download,
  AlertTriangle,
  Clock,

  User,
  Calendar,
  ChevronDown,
  ChevronUp,

  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";

interface OverdueRecord {
  id: string;
  recordNumber: string;
  recordType: "case" | "incident" | "petition";
  title: string;
  assignedTo: string;
  unit: string;
  dueDate: string;
  receivedDate: string;
  daysOverdue: number;
  status: string;
  priority: "critical" | "high" | "medium";
}

interface FilterData {
  quickSearch: string;
  recordType: string;
  unit: string;
  priority: string;
  minDaysOverdue: string;
}

export default function OverdueRecordsPage() {
  const navigate = useNavigate();
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [records, setRecords] = useState<OverdueRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterData>({
    quickSearch: "",
    recordType: "",
    unit: "",
    priority: "",
    minDaysOverdue: "",
  });

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        search: filters.quickSearch,
        recordType: filters.recordType,
        minDaysOverdue: filters.minDaysOverdue,
      };
      const response = await api.get("/reports/overdue", { params });
      const result = response.data;
      if (result.success) {
        setRecords(result.data);
      }
    } catch (err) {
      setError("Không thể tải dữ liệu hồ sơ trễ hạn. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [filters.quickSearch, filters.recordType, filters.minDaysOverdue]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleFilterChange = (field: keyof FilterData, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setFilters({
      quickSearch: "",
      recordType: "",
      unit: "",
      priority: "",
      minDaysOverdue: "",
    });
    setSelectedIds([]);
  };

  const handleExportSelected = () => {
    const toExport = selectedIds.length > 0
      ? filteredRecords.filter(r => selectedIds.includes(r.id))
      : filteredRecords;
    if (toExport.length === 0) return;
    const typeMap: Record<string, string> = { case: 'Vụ án', incident: 'Vụ việc', petition: 'Đơn thư' };
    const priorityMap: Record<string, string> = { critical: 'Khẩn cấp', high: 'Cao', medium: 'Trung bình' };
    const headers = ['STT', 'Mã hồ sơ', 'Loại', 'Tiêu đề', 'Điều tra viên', 'Đơn vị',
                     'Ngày hết hạn', 'Ngày nhận', 'Số ngày trễ', 'Trạng thái', 'Mức độ ưu tiên'];
    const rows = toExport.map((r, i) => [
      i + 1, r.recordNumber, typeMap[r.recordType] ?? r.recordType,
      r.title, r.assignedTo, r.unit,
      new Date(r.dueDate).toLocaleDateString('vi-VN'),
      new Date(r.receivedDate).toLocaleDateString('vi-VN'),
      r.daysOverdue, r.status, priorityMap[r.priority] ?? r.priority,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HoSoTreHan_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredRecords = records.filter((r) => {
    if (filters.priority && r.priority !== filters.priority) return false;
    if (filters.unit && !r.unit.includes(filters.unit)) return false;
    return true;
  });

  const handleSelectAll = () => {
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map((r) => r.id));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getRecordTypeLabel = (type: string) => {
    switch (type) {
      case "case":
        return "Vụ án";
      case "incident":
        return "Vụ việc";
      case "petition":
        return "Đơn thư";
      default:
        return type;
    }
  };

  const getRecordTypeColor = (type: string) => {
    switch (type) {
      case "case":
        return "bg-red-100 text-red-700";
      case "incident":
        return "bg-purple-100 text-purple-700";
      case "petition":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            Nghiêm trọng
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
            <Clock className="w-3 h-3" />
            Cao
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
            <Clock className="w-3 h-3" />
            Trung bình
          </span>
        );
      default:
        return null;
    }
  };

  const getOverdueBadge = (days: number) => {
    if (days >= 7) {
      return (
        <span className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-bold">
          Quá hạn {days} ngày
        </span>
      );
    } else if (days >= 3) {
      return (
        <span className="px-3 py-1 bg-orange-600 text-white rounded-full text-sm font-bold">
          Quá hạn {days} ngày
        </span>
      );
    } else {
      return (
        <span className="px-3 py-1 bg-amber-600 text-white rounded-full text-sm font-bold">
          Quá hạn {days} ngày
        </span>
      );
    }
  };

  const stats = [
    { label: "Tổng hồ sơ trễ hạn", value: filteredRecords.length, color: "red" },
    {
      label: "Nghiêm trọng (≥7 ngày)",
      value: filteredRecords.filter((r) => r.daysOverdue >= 7).length,
      color: "red",
    },
    {
      label: "Cao (3-6 ngày)",
      value: filteredRecords.filter((r) => r.daysOverdue >= 3 && r.daysOverdue < 7).length,
      color: "orange",
    },
    {
      label: "Trung bình (<3 ngày)",
      value: filteredRecords.filter((r) => r.daysOverdue < 3).length,
      color: "amber",
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-2">
              <AlertTriangle className="w-7 h-7 text-red-600" />
              Hồ sơ trễ hạn
            </h1>
            <p className="text-slate-600">Danh sách các hồ sơ đã quá hạn xử lý</p>
          </div>
          <button
            onClick={() => navigate("/settings/deadline")}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Clock className="w-4 h-4" />
            Cấu hình cảnh báo
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">{stat.label}</p>
                <p className={`text-3xl font-bold text-${stat.color}-600`}>{stat.value}</p>
              </div>
              <AlertTriangle className={`w-8 h-8 text-${stat.color}-600`} />
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={filters.quickSearch}
              onChange={(e) => handleFilterChange("quickSearch", e.target.value)}
              placeholder="Tìm kiếm theo số hồ sơ, tiêu đề, người xử lý..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
            />
          </div>
          <button
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Lọc nâng cao
            {showAdvancedFilter ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Đặt lại
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={handleExportSelected}
              className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#0052a3] transition-colors"
            >
              <Download className="w-4 h-4" />
              Xuất ({selectedIds.length})
            </button>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilter && (
          <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Loại hồ sơ
              </label>
              <select
                value={filters.recordType}
                onChange={(e) => handleFilterChange("recordType", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
              >
                <option value="">Tất cả</option>
                <option value="case">Vụ án</option>
                <option value="incident">Vụ việc</option>
                <option value="petition">Đơn thư</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Đơn vị</label>
              <select
                value={filters.unit}
                onChange={(e) => handleFilterChange("unit", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
              >
                <option value="">Tất cả</option>
                <option value="unit1">Đội Điều tra 1</option>
                <option value="unit2">Đội Điều tra 2</option>
                <option value="office">Văn phòng Cơ quan</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Mức độ ưu tiên
              </label>
              <select
                value={filters.priority}
                onChange={(e) => handleFilterChange("priority", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
              >
                <option value="">Tất cả</option>
                <option value="critical">Nghiêm trọng</option>
                <option value="high">Cao</option>
                <option value="medium">Trung bình</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Số ngày trễ tối thiểu
              </label>
              <input
                type="number"
                value={filters.minDaysOverdue}
                onChange={(e) => handleFilterChange("minDaysOverdue", e.target.value)}
                min="0"
                placeholder="Nhập số ngày"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {/* Records Table */}
      {!loading && !error && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-3 px-4 text-left">
                    <input
                      type="checkbox"
                      checked={filteredRecords.length > 0 && selectedIds.length === filteredRecords.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-[#003973] border-slate-300 rounded focus:ring-2 focus:ring-[#003973]"
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Số hồ sơ</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Tiêu đề</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Loại</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    Người xử lý
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Đơn vị</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Hạn xử lý</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Trễ hạn</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">
                    Mức độ
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      Không tìm thấy hồ sơ trễ hạn nào
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(record.id)}
                          onChange={() => handleSelectOne(record.id)}
                          className="w-4 h-4 text-[#003973] border-slate-300 rounded focus:ring-2 focus:ring-[#003973]"
                        />
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-[#003973]">{record.recordNumber}</span>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-medium text-slate-800 max-w-md">{record.title}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${getRecordTypeColor(
                            record.recordType
                          )}`}
                        >
                          {getRecordTypeLabel(record.recordType)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-700">{record.assignedTo}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-slate-700">{record.unit}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-red-500" />
                          <span className="text-slate-700">
                            {new Date(record.dueDate).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {getOverdueBadge(record.daysOverdue)}
                      </td>
                      <td className="py-4 px-4 text-center">{getPriorityBadge(record.priority)}</td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => navigate(`/cases/${record.id}`)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-[#003973] hover:bg-blue-50 rounded transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
