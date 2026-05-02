import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Download,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Trash2,
  Calendar,
  User,
  AlertTriangle,
  MapPin,
  ShieldAlert,
  Lock,
  Users,
  Scale,
  BadgeAlert,
} from "lucide-react";
import { authStore } from "@/stores/auth.store";
import { api } from "@/lib/api";

interface WardCase {
  id: string;
  stt: string;
  caseName: string;
  charge: string;
  suspects: string[];
  ward: string;
  district: string;
  reportedBy: string;
  reportedDate: string;
  status: "pending" | "investigating" | "transferred" | "prosecuted" | "resolved";
  statusLabel: string;
  severity: "low" | "medium" | "high" | "critical";
  severityLabel: string;
}

interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
  ward: string;
  district: string;
  districtId: string;
  wardId: string;
  status: string;
  severity: string;
}

interface UserPermissions {
  hasAccess: boolean;
  allowedWards: string[];
  allowedDistricts: string[];
  role: string;
  isAdmin: boolean;
}

function getUserPermissions(): UserPermissions {
  const user = authStore.getUser();
  if (!user) {
    return {
      hasAccess: false,
      allowedWards: [],
      allowedDistricts: [],
      role: "",
      isAdmin: false,
    };
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SYSTEM";

  if (isAdmin) {
    return {
      hasAccess: true,
      allowedWards: [],
      allowedDistricts: [],
      role: "Quản trị viên",
      isAdmin: true,
    };
  }

  return {
    hasAccess: true,
    allowedWards: ["Phường 2", "Phường 4", "Phường 6"],
    allowedDistricts: ["Quận 1", "Quận 3"],
    role: "Cán bộ Phường - Phụ trách Vụ án",
    isAdmin: false,
  };
}

export default function WardCasesPage() {
  const navigate = useNavigate();
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
  const [accessDeniedReason, setAccessDeniedReason] = useState("");
  const [hasPageAccess, setHasPageAccess] = useState(true);

  const [allData, setAllData] = useState<WardCase[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<FilterData>({
    quickSearch: "",
    fromDate: "",
    toDate: "",
    ward: "",
    district: "",
    districtId: "",
    wardId: "",
    status: "",
    severity: "",
  });

  const [userPermissions, setUserPermissions] = useState<UserPermissions>({
    hasAccess: false,
    allowedWards: [],
    allowedDistricts: [],
    role: "",
    isAdmin: false,
  });

  useEffect(() => {
    const permissions = getUserPermissions();
    setUserPermissions(permissions);
    if (!permissions.hasAccess) {
      setHasPageAccess(false);
      setAccessDeniedReason(
        "Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị viên để được cấp quyền."
      );
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filters.districtId) params.set("districtId", filters.districtId);
      if (filters.wardId) params.set("wardId", filters.wardId);
      const res = await api.get(`/cases?${params}`);
      const mapped: WardCase[] = (res.data.data ?? []).map((c: any, i: number) => ({
        id: c.id,
        stt: i + 1,
        caseName: c.name,
        charge: c.crime ?? "",
        suspects: [],
        ward: c.unit ?? "",
        district: c.unit ?? "",
        reportedBy: c.investigator ? `${c.investigator.firstName ?? ""} ${c.investigator.lastName ?? ""}`.trim() : "",
        reportedDate: c.createdAt ? new Date(c.createdAt).toLocaleDateString("vi-VN") : "",
        status: (() => {
          const statusMap: Record<string, string> = {
            TIEP_NHAN: "pending", DANG_XAC_MINH: "investigating", DANG_DIEU_TRA: "investigating",
            DA_KET_LUAN: "resolved", DA_LUU_TRU: "resolved", DINH_CHI: "resolved",
            DANG_TRUY_TO: "prosecuted", DANG_XET_XU: "prosecuted", DA_CHUYEN: "transferred",
          };
          return statusMap[c.status] ?? "pending";
        })() as WardCase["status"],
        statusLabel: c.status ?? "",
        severity: "medium" as const,
        severityLabel: "Trung bình",
      }));
      setAllData(mapped);
    } catch {
      setAllData([]);
    } finally {
      setLoading(false);
    }
  }, [filters.districtId, filters.wardId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const authorizedData = useMemo(() => {
    if (userPermissions.isAdmin) return allData;

    return allData.filter((caseItem) => {
      if (!userPermissions.allowedDistricts.includes(caseItem.district)) {
        return false;
      }
      if (!userPermissions.allowedWards.includes(caseItem.ward)) {
        return false;
      }
      return true;
    });
  }, [userPermissions, allData]);

  const filteredData = useMemo(() => {
    return authorizedData.filter((caseItem) => {
      if (filters.quickSearch) {
        const searchLower = filters.quickSearch.toLowerCase();
        const matchesSearch =
          String(caseItem.stt).toLowerCase().includes(searchLower) ||
          caseItem.caseName.toLowerCase().includes(searchLower) ||
          caseItem.charge.toLowerCase().includes(searchLower) ||
          caseItem.ward.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (filters.fromDate && caseItem.reportedDate < filters.fromDate) return false;
      if (filters.toDate && caseItem.reportedDate > filters.toDate) return false;
      if (filters.ward && caseItem.ward !== filters.ward) return false;
      if (filters.district && caseItem.district !== filters.district) return false;
      if (filters.status && caseItem.status !== filters.status) return false;
      if (filters.severity && caseItem.severity !== filters.severity) return false;

      return true;
    });
  }, [authorizedData, filters]);

  const handleResetFilters = () => {
    setFilters({
      quickSearch: "",
      fromDate: "",
      toDate: "",
      ward: "",
      district: "",
      districtId: "",
      wardId: "",
      status: "",
      severity: "",
    });
  };

  const handleView = (caseItem: WardCase) => {
    if (!userPermissions.isAdmin) {
      if (
        !userPermissions.allowedDistricts.includes(caseItem.district) ||
        !userPermissions.allowedWards.includes(caseItem.ward)
      ) {
        setAccessDeniedReason(
          `Bạn không có quyền xem vụ án tại ${caseItem.ward}, ${caseItem.district}. Chỉ có thể xem vụ án thuộc phạm vi quản lý được giao.`
        );
        setShowAccessDeniedModal(true);
        return;
      }
    }
    navigate(`/cases/${caseItem.id}`);
  };

  const handleDelete = async (caseItem: WardCase) => {
    if (!userPermissions.isAdmin) {
      alert("Bạn không có quyền xóa hồ sơ này.");
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa vụ án ${caseItem.stt}?`)) return;
    try {
      await api.delete(`/cases/${caseItem.id}`);
      setAllData(prev => prev.filter(c => c.id !== caseItem.id));
    } catch {
      alert('Xóa thất bại. Vui lòng thử lại.');
    }
  };

  const handleExport = () => {
    const toExport = filteredData.length > 0 ? filteredData : allData;
    if (toExport.length === 0) { alert('Không có dữ liệu để xuất!'); return; }
    const headers = ['STT', 'Tên vụ án', 'Tội danh', 'Phường/Xã', 'Khu vực',
                     'Người báo cáo', 'Ngày tiếp nhận', 'Trạng thái', 'Mức độ'];
    const rows = toExport.map(c => [
      c.stt, c.caseName, c.charge, c.ward, c.district,
      c.reportedBy, c.reportedDate, c.statusLabel, c.severityLabel,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `VuAnPhuongXa_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: WardCase["status"], label: string) => {
    const styles = {
      pending: "bg-amber-600 text-white",
      investigating: "bg-blue-600 text-white",
      transferred: "bg-purple-600 text-white",
      prosecuted: "bg-indigo-600 text-white",
      resolved: "bg-green-600 text-white",
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

  const getSeverityBadge = (severity: WardCase["severity"], label: string) => {
    const styles = {
      low: "bg-slate-100 text-slate-700 border border-slate-300",
      medium: "bg-yellow-100 text-yellow-800 border border-yellow-300",
      high: "bg-orange-100 text-orange-800 border border-orange-300",
      critical: "bg-red-100 text-red-800 border border-red-300",
    };

    const icons = {
      low: null,
      medium: null,
      high: <AlertTriangle className="w-3 h-3" />,
      critical: <BadgeAlert className="w-3 h-3" />,
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${styles[severity]}`}
      >
        {icons[severity]}
        {label}
      </span>
    );
  };

  const totalCount = filteredData.length;
  const pendingCount = filteredData.filter((c) => c.status === "pending").length;
  const investigatingCount = filteredData.filter((c) => c.status === "investigating").length;
  const criticalCount = filteredData.filter((c) => c.severity === "critical").length;

  if (!hasPageAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6" data-testid="access-denied-page">
        <div className="bg-white rounded-lg border-2 border-red-200 shadow-xl max-w-lg w-full p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Truy cập bị từ chối</h2>
            <p className="text-slate-600 mb-6">{accessDeniedReason}</p>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-medium text-red-900">Lưu ý quan trọng</p>
                  <p className="text-sm text-red-800 mt-1">
                    Trang này chỉ dành cho cán bộ cấp phường/xã có quyền xử lý vụ án. Để được cấp
                    quyền, vui lòng liên hệ quản trị viên hệ thống.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full px-4 py-2.5 bg-[#003973] text-white rounded-lg hover:bg-[#002d5c] transition-colors font-medium"
            >
              Quay về trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="ward-cases-page">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-[#003973]">Vụ án Phường/Xã</h1>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#F59E0B]/20 border border-[#F59E0B] text-[#92400E] text-xs font-bold rounded">
            <Lock className="w-3 h-3" />
            Có kiểm soát quyền
          </span>
        </div>
        <p className="text-slate-600 text-sm mt-1">
          Quản lý vụ án hình sự cấp phường/xã - {userPermissions.isAdmin ? "Xem toàn bộ hồ sơ" : "Chỉ xem vụ án thuộc phạm vi được giao"}
        </p>
        <div className="mt-2 p-3 bg-[#003973]/5 border border-[#003973]/20 rounded-lg">
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-[#003973] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#003973]">
                Vai trò: {userPermissions.role}
              </p>
              {!userPermissions.isAdmin && (
                <p className="text-xs text-[#003973]/70 mt-1">
                  Phạm vi: {userPermissions.allowedWards.slice(0, 3).join(", ")}
                  {userPermissions.allowedWards.length > 3 &&
                    ` +${userPermissions.allowedWards.length - 3}`}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border-2 border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Tổng vụ án</p>
              <p className="text-3xl font-bold text-[#003973]">{totalCount}</p>
            </div>
            <div className="w-12 h-12 bg-[#003973]/10 rounded-lg flex items-center justify-center">
              <Scale className="w-6 h-6 text-[#003973]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-amber-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 font-medium mb-1">Chờ xử lý</p>
              <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-blue-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Đang điều tra</p>
              <p className="text-3xl font-bold text-blue-600">{investigatingCount}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Search className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-red-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 font-medium mb-1">Nghiêm trọng</p>
              <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <BadgeAlert className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {loading ? (
            <span>Đang tải...</span>
          ) : (
            <>Hiển thị <span className="font-medium text-[#003973]">{filteredData.length}</span> vụ án
            {userPermissions.isAdmin ? "" : " thuộc phạm vi quản lý"}</>
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
            placeholder="Tìm kiếm theo STT, Tên vụ án, Tội danh, Phường/Xã..."
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
                  {(userPermissions.isAdmin
                    ? ["Quận 1", "Quận 3", "Quận 5"]
                    : userPermissions.allowedDistricts
                  ).map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phường/Xã</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={filters.ward}
                    onChange={(e) => setFilters({ ...filters, ward: e.target.value })}
                    disabled={!userPermissions.isAdmin}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Tất cả</option>
                    {(userPermissions.isAdmin
                      ? ["Phường 2", "Phường 4", "Phường 6", "Phường 15"]
                      : userPermissions.allowedWards
                    ).map((ward) => (
                      <option key={ward} value={ward}>
                        {ward}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mức độ</label>
                <select
                  value={filters.severity}
                  onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white"
                >
                  <option value="">Tất cả</option>
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                  <option value="critical">Nghiêm trọng</option>
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
                  <option value="investigating">Đang điều tra</option>
                  <option value="transferred">Đã chuyển Quận</option>
                  <option value="prosecuted">Đã chuyển VKS</option>
                  <option value="resolved">Đã kết thúc</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="ward-cases-table">
            <thead className="bg-[#003973]/5 border-b-2 border-[#003973]/20">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  STT
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Tên vụ án
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Tội danh
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Bị can
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Phường/Xã
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Ngày tiếp nhận
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Mức độ
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[#003973] uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <p className="text-slate-500">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Scale className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Không tìm thấy vụ án nào</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Thử điều chỉnh bộ lọc hoặc kiểm tra phạm vi quyền truy cập
                    </p>
                  </td>
                </tr>
              ) : (
                filteredData.map((caseItem) => (
                  <tr key={caseItem.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-[#003973]">{caseItem.stt}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-800 font-medium line-clamp-2 max-w-xs">
                        {caseItem.caseName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-700 line-clamp-2 max-w-xs">
                          {caseItem.charge}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                        <div>
                          {caseItem.suspects.slice(0, 2).map((suspect, index) => (
                            <p key={index} className="text-sm text-slate-700">
                              {suspect}
                            </p>
                          ))}
                          {caseItem.suspects.length > 2 && (
                            <p className="text-xs text-slate-500">
                              +{caseItem.suspects.length - 2} người khác
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-sm font-medium text-slate-800">
                            {caseItem.ward}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">{caseItem.district}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700">
                          {caseItem.reportedDate}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getSeverityBadge(caseItem.severity, caseItem.severityLabel)}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(caseItem.status, caseItem.statusLabel)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleView(caseItem)}
                          data-testid={`view-btn-${caseItem.id}`}
                          className="p-1.5 text-[#003973] hover:bg-[#003973]/10 rounded transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {userPermissions.isAdmin && (
                          <button
                            onClick={() => handleDelete(caseItem)}
                            data-testid={`delete-btn-${caseItem.id}`}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAccessDeniedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="access-denied-modal">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6 text-red-600" />
              </div>

              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
                Không có quyền truy cập
              </h3>

              <p className="text-sm text-slate-600 text-center mb-6">{accessDeniedReason}</p>

              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900">Phạm vi được phép:</p>
                    <ul className="text-sm text-red-800 mt-1 space-y-0.5">
                      {userPermissions.allowedWards.map((ward) => (
                        <li key={ward}>• {ward}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowAccessDeniedModal(false)}
                className="w-full px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002d5c] transition-colors font-medium"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
