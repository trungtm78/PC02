/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Search,
  Download,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  X,
  FileText,
  Eye,
  Activity,
  Clock,

  Plus,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  Copy,
  Info,
} from "lucide-react";

type ActionType = "create" | "update" | "delete" | "export" | "approve" | "transfer" | "view";
type ObjectType = "complaint" | "denunciation" | "case" | "document" | "user";

interface LogEntry {
  id: string;
  timestamp: string;
  user: string;
  userId: string;
  userRole: string;
  actionType: ActionType;
  actionLabel: string;
  objectType: ObjectType;
  objectId: string;
  objectLabel: string;
  description: string;
  ipAddress: string;
  details?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    metadata?: Record<string, any>;
  };
}

interface FilterData {
  quickSearch: string;
  fromDate: string;
  toDate: string;
  user: string;
  actionType: string;
  objectType: string;
}

// Map AuditLog from API to local LogEntry shape
function auditLogToEntry(log: any): LogEntry {
  const actionMap: Record<string, ActionType> = {
    CASE_CREATED: "create",
    CASE_UPDATED: "update",
    CASE_DELETED: "delete",
    PETITION_CREATED: "create",
    PETITION_UPDATED: "update",
    PETITION_DELETED: "delete",
    INCIDENT_CREATED: "create",
    INCIDENT_UPDATED: "update",
    INCIDENT_DELETED: "delete",
    USER_LOGIN: "view",
    USER_LOGOUT: "view",
    DOCUMENT_UPLOADED: "create",
    DOCUMENT_DELETED: "delete",
  };
  const objectTypeMap: Record<string, ObjectType> = {
    Case: "case",
    Petition: "complaint",
    Incident: "denunciation",
    Document: "document",
    User: "user",
  };

  const action = log.action ?? "";
  const subject = log.subject ?? "";
  const userName = log.user
    ? `${log.user.firstName ?? ""} ${log.user.lastName ?? ""}`.trim() || log.user.username || log.user.email || ""
    : "Hệ thống";

  return {
    id: log.id,
    timestamp: log.createdAt ?? "",
    user: userName,
    userId: log.userId ?? "",
    userRole: log.user?.role?.name ?? "",
    actionType: actionMap[action] ?? "view",
    actionLabel: action.replace(/_/g, " "),
    objectType: objectTypeMap[subject] ?? "case",
    objectId: log.subjectId ?? "",
    objectLabel: `${subject} ${log.subjectId?.slice(0, 8) ?? ""}`,
    description: action.replace(/_/g, " "),
    ipAddress: log.ipAddress ?? "",
    details: log.metadata ? { metadata: log.metadata } : undefined,
  };
}

export default function ActivityLogPage() {
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [allData, setAllData] = useState<LogEntry[]>([]);
  const [page] = useState(1);
  const PAGE_SIZE = 50;

  const [filters, setFilters] = useState<FilterData>({
    quickSearch: "",
    fromDate: "",
    toDate: "",
    user: "",
    actionType: "",
    objectType: "",
  });

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      if (filters.actionType) params.set("action", filters.actionType.toUpperCase());
      const res = await api.get(`/audit-logs?${params}`);
      const data = res.data.data ?? res.data ?? [];
      setAllData(Array.isArray(data) ? data.map(auditLogToEntry) : []);
    } catch {
      setAllData([]);
    }
  }, [page, filters.fromDate, filters.toDate, filters.actionType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Client-side filter for search/user/objectType
  const filteredData = allData.filter((log) => {
    if (filters.quickSearch) {
      const searchLower = filters.quickSearch.toLowerCase();
      const matchesSearch =
        log.user.toLowerCase().includes(searchLower) ||
        log.objectId.toLowerCase().includes(searchLower) ||
        log.description.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    if (filters.user && log.user !== filters.user) return false;
    if (filters.objectType && log.objectType !== filters.objectType) return false;
    return true;
  });

  const handleResetFilters = () => {
    setFilters({
      quickSearch: "",
      fromDate: "",
      toDate: "",
      user: "",
      actionType: "",
      objectType: "",
    });
  };

  const handleViewDetail = (log: LogEntry) => {
    setSelectedLog(log);
    setShowDetailDrawer(true);
  };

  const handleExport = () => {
    if (filteredData.length === 0) {
      alert('Không có dữ liệu để xuất!');
      return;
    }
    const headers = ['STT', 'Thời gian', 'Người dùng', 'Vai trò', 'Hành động', 'Đối tượng', 'ID đối tượng', 'IP'];
    const rows = filteredData.map((log, i) => [
      i + 1,
      new Date(log.timestamp).toLocaleString('vi-VN'),
      log.user,
      log.userRole,
      log.actionLabel,
      log.objectLabel,
      log.objectId,
      log.ipAddress,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NhatKy_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getActionBadge = (actionType: ActionType, label: string) => {
    const styles = {
      create: "bg-green-100 text-green-800 border border-green-300",
      update: "bg-blue-100 text-blue-800 border border-blue-300",
      delete: "bg-red-100 text-red-800 border border-red-300",
      export: "bg-purple-100 text-purple-800 border border-purple-300",
      approve: "bg-emerald-100 text-emerald-800 border border-emerald-300",
      transfer: "bg-orange-100 text-orange-800 border border-orange-300",
      view: "bg-slate-100 text-slate-700 border border-slate-300",
    };

    const icons = {
      create: <Plus className="w-3 h-3" />,
      update: <Edit className="w-3 h-3" />,
      delete: <Trash2 className="w-3 h-3" />,
      export: <Download className="w-3 h-3" />,
      approve: <CheckCircle className="w-3 h-3" />,
      transfer: <Send className="w-3 h-3" />,
      view: <Eye className="w-3 h-3" />,
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${styles[actionType]}`}
      >
        {icons[actionType]}
        {label}
      </span>
    );
  };

  const getObjectTypeBadge = (objectType: ObjectType) => {
    const labels = {
      complaint: "Khiếu nại",
      denunciation: "Tố cáo",
      case: "Vụ án",
      document: "Tài liệu",
      user: "Người dùng",
    };

    return (
      <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
        {labels[objectType]}
      </span>
    );
  };

  // Unique users for filter (client-side from loaded data)
  const uniqueUsers = Array.from(new Set(allData.map((log) => log.user)));

  return (
    <div className="p-6 space-y-6">
      {/* Tiêu đề */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Nhật ký nghiệp vụ</h1>
        <p className="text-slate-600 text-sm mt-1">
          Theo dõi và truy vết các thao tác trong hệ thống
        </p>
      </div>

      {/* Thống kê */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Tổng bản ghi</p>
              <p className="text-3xl font-bold text-slate-800">{filteredData.length}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Hôm nay</p>
              <p className="text-3xl font-bold text-blue-600">
                {allData.filter((log) => log.timestamp.startsWith(new Date().toISOString().slice(0, 10))).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Người dùng</p>
              <p className="text-3xl font-bold text-slate-800">{uniqueUsers.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Loại thao tác</p>
              <p className="text-3xl font-bold text-slate-800">7</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Thanh hành động */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          Hiển thị <span className="font-medium text-slate-800">{filteredData.length}</span> bản ghi
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
              showAdvancedFilter
                ? "bg-blue-50 border-blue-300 text-blue-700"
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

      {/* Tìm kiếm và bộ lọc */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
        {/* Tìm kiếm nhanh */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={filters.quickSearch}
            onChange={(e) => setFilters({ ...filters, quickSearch: e.target.value })}
            placeholder="Tìm kiếm theo người thực hiện, đối tượng, mô tả..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Bộ lọc nâng cao */}
        {showAdvancedFilter && (
          <div className="pt-4 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Từ ngày */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Đến ngày */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Người thực hiện */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Người thực hiện
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={filters.user}
                    onChange={(e) => setFilters({ ...filters, user: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Tất cả</option>
                    {uniqueUsers.map((user) => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Loại thao tác */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Loại thao tác
                </label>
                <select
                  value={filters.actionType}
                  onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Tất cả</option>
                  <option value="create">Tạo mới</option>
                  <option value="update">Cập nhật</option>
                  <option value="delete">Xóa</option>
                  <option value="export">Xuất báo cáo</option>
                  <option value="approve">Phê duyệt</option>
                  <option value="transfer">Chuyển hồ sơ</option>
                  <option value="view">Xem</option>
                </select>
              </div>

              {/* Đối tượng tác động */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Đối tượng tác động
                </label>
                <select
                  value={filters.objectType}
                  onChange={(e) => setFilters({ ...filters, objectType: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Tất cả</option>
                  <option value="complaint">Khiếu nại</option>
                  <option value="denunciation">Tố cáo</option>
                  <option value="case">Vụ án</option>
                  <option value="document">Tài liệu</option>
                  <option value="user">Người dùng</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Thời gian
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Người thực hiện
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Loại thao tác
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Chi tiết thao tác
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Đối tượng tác động
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  IP
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Không tìm thấy bản ghi nào</p>
                    <p className="text-sm text-slate-400 mt-1">Thử điều chỉnh bộ lọc</p>
                  </td>
                </tr>
              ) : (
                filteredData.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700 font-mono">
                          {formatDateTime(log.timestamp)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm font-medium text-slate-800">{log.user}</span>
                        </div>
                        <p className="text-xs text-slate-500 pl-5">{log.userRole}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getActionBadge(log.actionType, log.actionLabel)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700 line-clamp-2 max-w-md">
                        {log.description}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-sm font-bold text-blue-600">{log.objectId}</span>
                        </div>
                        {getObjectTypeBadge(log.objectType)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-slate-600">{log.ipAddress}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewDetail(log)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors text-xs font-medium"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer chi tiết */}
      {showDetailDrawer && selectedLog && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowDetailDrawer(false)}
          />

          {/* Drawer */}
          <div className="fixed top-0 right-0 h-full w-full md:w-[600px] bg-white shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-800">Chi tiết nhật ký</h3>
                <button
                  onClick={() => setShowDetailDrawer(false)}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <p className="text-sm text-slate-600">ID: {selectedLog.id}</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Thông tin cơ bản */}
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Thông tin cơ bản
                </h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-600">Thời gian</p>
                      <p className="text-sm font-medium text-slate-800 font-mono">
                        {formatDateTime(selectedLog.timestamp)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-600">Người thực hiện</p>
                      <p className="text-sm font-medium text-slate-800">{selectedLog.user}</p>
                      <p className="text-xs text-slate-500">
                        {selectedLog.userRole} • ID: {selectedLog.userId}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Activity className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-600">Loại thao tác</p>
                      <div className="mt-1">
                        {getActionBadge(selectedLog.actionType, selectedLog.actionLabel)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-600">Đối tượng tác động</p>
                      <p className="text-sm font-bold text-blue-600 mt-1">{selectedLog.objectId}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{selectedLog.objectLabel}</p>
                      <div className="mt-1">{getObjectTypeBadge(selectedLog.objectType)}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Copy className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-600">Địa chỉ IP</p>
                      <p className="text-sm font-mono text-slate-800">{selectedLog.ipAddress}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mô tả */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-700 uppercase mb-3">Mô tả</h4>
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {selectedLog.description}
                </p>
              </div>

              {/* Dữ liệu trước/sau */}
              {selectedLog.details && (selectedLog.details.before || selectedLog.details.after) && (
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-bold text-slate-700 uppercase mb-3">Thay đổi dữ liệu</h4>
                  <div className="space-y-4">
                    {selectedLog.details.before && (
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-2">Trước:</p>
                        <pre className="text-xs bg-red-50 text-red-900 p-3 rounded border border-red-200 overflow-x-auto">
                          {JSON.stringify(selectedLog.details.before, null, 2)}
                        </pre>
                      </div>
                    )}

                    {selectedLog.details.after && (
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-2">Sau:</p>
                        <pre className="text-xs bg-green-50 text-green-900 p-3 rounded border border-green-200 overflow-x-auto">
                          {JSON.stringify(selectedLog.details.after, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.details?.metadata && (
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-bold text-slate-700 uppercase mb-3">Thông tin bổ sung</h4>
                  <pre className="text-xs bg-blue-50 text-blue-900 p-3 rounded border border-blue-200 overflow-x-auto">
                    {JSON.stringify(selectedLog.details.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 flex-shrink-0">
              <button
                onClick={() => setShowDetailDrawer(false)}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
