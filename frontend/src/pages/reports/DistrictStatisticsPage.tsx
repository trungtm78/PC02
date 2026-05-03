/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useNavigate } from "react-router";
import {
  Search,
  RotateCcw,
  Download,
  Calendar,
  AlertCircle,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface FilterData {
  fromDate: string;
  toDate: string;
  province: string;  // province code (HCM, HN, ...) for ProvinceWardSelect
  district: string;  // ward name sent to API as ?district=
}

interface DailyData {
  date: string;
  count: number;
  details: {
    petitions: number;
    incidents: number;
    cases: number;
  };
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

export default function DistrictStatisticsPage() {
  const navigate = useNavigate();
  const [hasData, setHasData] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<DailyData | null>(null);

  const [filter, setFilter] = useState<FilterData>({
    fromDate: "",
    toDate: "",
    province: "",
    district: "",
  });

  // Load 32 tỉnh/TP từ DB
  const { data: provincesData } = useQuery({
    queryKey: ['report-filter', 'provinces'],
    queryFn: () => api.get('/directories?type=PROVINCE&limit=100&isActive=true')
      .then(r => (r.data?.data ?? []) as { id: string; code: string; name: string }[]),
    staleTime: 10 * 60 * 1000,
  });

  // Load phường/xã của tỉnh được chọn (qua parentId)
  const selectedProvinceEntry = (provincesData ?? []).find(p => p.code === filter.province);
  const { data: wardsData, isLoading: wardsLoading } = useQuery({
    queryKey: ['report-filter', 'wards', selectedProvinceEntry?.id],
    queryFn: () => api.get(
      `/directories?type=WARD&parentId=${selectedProvinceEntry!.id}&limit=1000&isActive=true`
    ).then(r => (r.data?.data ?? []) as { id: string; name: string }[]),
    enabled: !!selectedProvinceEntry?.id,
    staleTime: 5 * 60 * 1000,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [chartData, setChartData] = useState<any>(null);
  const [loadingChart, setLoadingChart] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoadingChart(true);
    try {
      const params = new URLSearchParams();
      if (filter.fromDate) params.set("fromDate", filter.fromDate);
      if (filter.toDate) params.set("toDate", filter.toDate);
      if (filter.district) params.set("district", filter.district);
      const res = await api.get(`/reports/district-stats?${params}`);
      setChartData(res.data.data);
      setHasData(true);
    } catch {
      setChartData(null);
      setHasData(false);
    } finally {
      setLoadingChart(false);
    }
  }, [filter]);

  // Fetch on mount with empty filter
  useEffect(() => {
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dailyChartData: DailyData[] = chartData?.daily ?? [];
  const incidentStatusData: StatusData[] = chartData?.incidentStatus ?? [];
  const caseStatusData: StatusData[] = chartData?.caseStatus ?? [];

  const validateFilters = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!filter.fromDate) {
      newErrors.fromDate = "Vui lòng chọn ngày bắt đầu";
    }

    if (!filter.toDate) {
      newErrors.toDate = "Vui lòng chọn ngày kết thúc";
    }

    if (filter.fromDate && filter.toDate) {
      const from = new Date(filter.fromDate);
      const to = new Date(filter.toDate);

      if (to <= from) {
        newErrors.toDate = "Ngày kết thúc phải sau ngày bắt đầu";
      }

      // Kiểm tra tối đa 12 tháng
      const monthsDiff =
        (to.getFullYear() - from.getFullYear()) * 12 +
        (to.getMonth() - from.getMonth());

      if (monthsDiff > 12) {
        newErrors.toDate = "Khoảng thời gian không được vượt quá 12 tháng";
      }
    }

    if (!filter.district) {
      newErrors.district = "Vui lòng nhập tên phường/xã";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSearch = () => {
    if (validateFilters()) {
      fetchStats();
    }
  };

  const handleReset = () => {
    setFilter({
      fromDate: "",
      toDate: "",
      province: "",
      district: "",
    });
    setErrors({});
    setSelectedPoint(null);
    setChartData(null);
    setHasData(false);
  };

  const handleExport = () => {
    if (!hasData || dailyChartData.length === 0) {
      alert('Không có dữ liệu để xuất! Hãy tải dữ liệu trước.');
      return;
    }
    const headers = ['Ngày', 'Vụ việc', 'Vụ án', 'Đã giải quyết'];
    const rows = dailyChartData.map(d => [d.date, d.details?.incidents ?? 0, d.details?.cases ?? 0, d.count ?? 0]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ThongKePhuongXa_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePointClick = (data: any) => {
    const point = dailyChartData.find((d) => d.date === data.date);
    if (point) {
      setSelectedPoint(point);
    }
  };

  const totalIncidents = incidentStatusData.reduce((sum, item) => sum + item.value, 0);
  const totalCases = caseStatusData.reduce((sum, item) => sum + item.value, 0);
  const totalDocs = dailyChartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Tiêu đề */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Thống kê phường/xã</h1>
        <p className="text-slate-600 text-sm mt-1">
          Báo cáo chi tiết theo đơn vị hành chính cấp phường/xã (theo cải cách hành chính 2025)
        </p>
      </div>

      {/* Bộ lọc */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <h2 className="font-bold text-slate-800 mb-4">Bộ lọc thống kê</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Từ ngày */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Từ ngày <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={filter.fromDate}
                onChange={(e) => {
                  setFilter({ ...filter, fromDate: e.target.value });
                  if (errors.fromDate) {
                    setErrors({ ...errors, fromDate: "" });
                  }
                }}
                className={`w-full pl-9 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.fromDate
                    ? "border-red-300 focus:ring-red-500"
                    : "border-slate-300 focus:ring-blue-500"
                }`}
              />
            </div>
            {errors.fromDate && (
              <p className="text-xs text-red-600 mt-1">{errors.fromDate}</p>
            )}
          </div>

          {/* Đến ngày */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Đến ngày <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={filter.toDate}
                onChange={(e) => {
                  setFilter({ ...filter, toDate: e.target.value });
                  if (errors.toDate) {
                    setErrors({ ...errors, toDate: "" });
                  }
                }}
                className={`w-full pl-9 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.toDate
                    ? "border-red-300 focus:ring-red-500"
                    : "border-slate-300 focus:ring-blue-500"
                }`}
              />
            </div>
            {errors.toDate && (
              <p className="text-xs text-red-600 mt-1">{errors.toDate}</p>
            )}
          </div>

          {/* Tỉnh/TP */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tỉnh/Thành phố
            </label>
            <select
              value={filter.province}
              onChange={(e) => {
                setFilter({ ...filter, province: e.target.value, district: '' });
                if (errors.district) setErrors({ ...errors, district: '' });
              }}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              data-testid="stats-province"
            >
              <option value="">-- Chọn tỉnh/TP --</option>
              {(provincesData ?? []).map(p => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Phường/Xã — load theo tỉnh đã chọn */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Phường/Xã <span className="text-red-500">*</span>
            </label>
            <select
              value={filter.district}
              onChange={(e) => {
                setFilter({ ...filter, district: e.target.value });
                if (errors.district) setErrors({ ...errors, district: '' });
              }}
              disabled={!filter.province || wardsLoading}
              className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400 ${
                errors.district ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
              }`}
              data-testid="stats-ward"
            >
              <option value="">
                {!filter.province ? '-- Chọn tỉnh/TP trước --' : wardsLoading ? 'Đang tải...' : '-- Chọn phường/xã --'}
              </option>
              {(wardsData ?? []).map(w => (
                <option key={w.id} value={w.name}>{w.name}</option>
              ))}
            </select>
            {errors.district && (
              <p className="text-xs text-red-600 mt-1">{errors.district}</p>
            )}
          </div>

          {/* Nút hành động */}
          <div className="flex items-end gap-2">
            <button
              onClick={handleSearch}
              disabled={loadingChart}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {loadingChart ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Tìm kiếm
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              title="Làm mới"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lưu ý validation */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Lưu ý:</strong> Ngày kết thúc phải sau ngày bắt đầu. Khoảng thời gian
              tối đa 12 tháng.
            </div>
          </div>
        </div>
      </div>

      {/* Thống kê tổng quan */}
      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Tổng hồ sơ</p>
                <p className="text-3xl font-bold text-slate-800 mt-2">
                  {totalDocs}
                </p>
              </div>
              <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Tổng vụ việc</p>
                <p className="text-3xl font-bold text-slate-800 mt-2">{totalIncidents}</p>
              </div>
              <div className="w-14 h-14 bg-purple-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Tổng vụ án</p>
                <p className="text-3xl font-bold text-slate-800 mt-2">{totalCases}</p>
              </div>
              <div className="w-14 h-14 bg-red-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Biểu đồ đường */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Biểu đồ hồ sơ theo ngày
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {filter.district && `Phường/Xã: ${filter.district}`} • {filter.fromDate} đến{" "}
              {filter.toDate}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={!hasData}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Xuất báo cáo
          </button>
        </div>

        {loadingChart ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-slate-600">Đang tải dữ liệu...</span>
          </div>
        ) : hasData ? (
          <>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={dailyChartData} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  style={{ fontSize: "12px" }}
                  label={{ value: "Ngày", position: "insideBottom", offset: -5 }}
                />
                <YAxis
                  stroke="#64748b"
                  style={{ fontSize: "12px" }}
                  label={{ value: "Số lượng", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                  formatter={(value) => [`${value} hồ sơ`, "Tổng"]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "14px" }}
                  formatter={() => "Tổng số hồ sơ"}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: "#3b82f6", r: 5, cursor: "pointer" }}
                  activeDot={{ r: 7, cursor: "pointer" }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Chi tiết điểm được chọn */}
            {selectedPoint && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-3">
                  Chi tiết ngày {selectedPoint.date}
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-blue-700">Tổng</p>
                    <p className="text-xl font-bold text-blue-900">{selectedPoint.count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700">Đơn thư</p>
                    <p className="text-xl font-bold text-blue-900">
                      {selectedPoint.details.petitions}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700">Vụ việc</p>
                    <p className="text-xl font-bold text-blue-900">
                      {selectedPoint.details.incidents}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700">Vụ án</p>
                    <p className="text-xl font-bold text-blue-900">
                      {selectedPoint.details.cases}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    navigate(
                      `/cases?date=${selectedPoint.date}&district=${filter.district}`
                    )
                  }
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Xem danh sách chi tiết →
                </button>
              </div>
            )}

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Hướng dẫn:</strong> Nhấn vào điểm trên biểu đồ để xem chi tiết hồ
                sơ theo ngày
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-lg text-slate-500 font-medium">Chưa có dữ liệu thống kê</p>
            <p className="text-sm text-slate-400 mt-2">
              Vui lòng chọn bộ lọc và nhấn "Tìm kiếm" để xem thống kê
            </p>
          </div>
        )}
      </div>

      {/* Biểu đồ phân loại */}
      {hasData && !loadingChart && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tình trạng Vụ việc */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-purple-600" />
              Tình trạng Vụ việc
            </h2>

            {incidentStatusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={incidentStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: any) =>
                        `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                      }
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {incidentStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} vụ`, "Số lượng"]} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="mt-4 space-y-2">
                  {incidentStatusData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-sm text-slate-700">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium text-slate-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-16">
                <PieChartIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Chưa có dữ liệu</p>
              </div>
            )}
          </div>

          {/* Tình trạng Vụ án */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-red-600" />
              Tình trạng Vụ án
            </h2>

            {caseStatusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={caseStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: any) =>
                        `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                      }
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {caseStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} vụ`, "Số lượng"]} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="mt-4 space-y-2">
                  {caseStatusData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-sm text-slate-700">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium text-slate-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-16">
                <PieChartIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Chưa có dữ liệu</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state cho biểu đồ phân loại */}
      {!hasData && !loadingChart && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-purple-600" />
              Tình trạng Vụ việc
            </h2>
            <div className="text-center py-16">
              <PieChartIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Chưa có dữ liệu</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-red-600" />
              Tình trạng Vụ án
            </h2>
            <div className="text-center py-16">
              <PieChartIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Chưa có dữ liệu</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
