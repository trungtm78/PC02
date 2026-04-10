import { useState, useEffect, useCallback } from "react";
import { Download, FileSpreadsheet, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";

export default function MonthlyReportPage() {
  const [selectedMonth, setSelectedMonth] = useState("2026-02");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/monthly?year=${selectedYear}`);
      setReportData(res.data);
    } catch {
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const chartData = reportData?.data ?? [];

  const stats = [
    { label: "Tổng đơn thư", value: reportData?.totals?.donThu ?? 0, change: "+12%", color: "blue" },
    { label: "Tổng vụ việc", value: reportData?.totals?.vuViec ?? 0, change: "+8%", color: "purple" },
    { label: "Tổng vụ án", value: reportData?.totals?.vuAn ?? 0, change: "+15%", color: "red" },
    { label: "Đã giải quyết", value: reportData?.totals?.daGiaiQuyet ?? 0, change: "+10%", color: "green" },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Báo cáo tháng</h1>
            <p className="text-slate-600">Tổng hợp số liệu theo từng tháng trong năm</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
            >
              <option value="2026-01">Tháng 1/2026</option>
              <option value="2026-02">Tháng 2/2026</option>
              <option value="2026-03">Tháng 3/2026</option>
              <option value="2026-04">Tháng 4/2026</option>
              <option value="2026-05">Tháng 5/2026</option>
              <option value="2026-06">Tháng 6/2026</option>
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
            >
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#0052a3] transition-colors">
              <Download className="w-4 h-4" />
              Xuất báo cáo
            </button>
          </div>
        </div>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#003973] border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-slate-600">Đang tải dữ liệu...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">{stat.label}</span>
                  <span className={`text-xs font-medium px-2 py-1 bg-${stat.color}-100 text-${stat.color}-700 rounded`}>
                    {stat.change}
                  </span>
                </div>
                <div className={`text-3xl font-bold text-${stat.color}-600`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Bar Chart */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#003973]" />
                Số liệu theo loại hồ sơ
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="donThu" fill="#3b82f6" name="Đơn thư" />
                  <Bar dataKey="vuViec" fill="#8b5cf6" name="Vụ việc" />
                  <Bar dataKey="vuAn" fill="#ef4444" name="Vụ án" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Line Chart */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#003973]" />
                Xu hướng giải quyết
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="daGiaiQuyet" stroke="#10b981" strokeWidth={2} name="Đã giải quyết" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary Table */}
          <div className="bg-white border border-slate-200 rounded-lg">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Chi tiết báo cáo tháng {selectedMonth.split('-')[1]}/{selectedYear}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-6 font-semibold text-slate-700">Loại hồ sơ</th>
                    <th className="text-center py-3 px-6 font-semibold text-slate-700">Tồn đầu kỳ</th>
                    <th className="text-center py-3 px-6 font-semibold text-slate-700">Phát sinh</th>
                    <th className="text-center py-3 px-6 font-semibold text-slate-700">Đã giải quyết</th>
                    <th className="text-center py-3 px-6 font-semibold text-slate-700">Tồn cuối kỳ</th>
                    <th className="text-center py-3 px-6 font-semibold text-slate-700">Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.tableRows?.length > 0 ? (
                    <>
                      {reportData.tableRows.map((row: any, index: number) => (
                        <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-4 px-6 font-medium text-slate-800">{row.label}</td>
                          <td className="py-4 px-6 text-center">{row.tonDauKy ?? 0}</td>
                          <td className="py-4 px-6 text-center">{row.phatSinh ?? 0}</td>
                          <td className="py-4 px-6 text-center">{row.daGiaiQuyet ?? 0}</td>
                          <td className="py-4 px-6 text-center">{row.tonCuoiKy ?? 0}</td>
                          <td className="py-4 px-6 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              (row.tyLe ?? 0) >= 90
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {(row.tyLe ?? 0) >= 90
                                ? <CheckCircle className="w-3 h-3" />
                                : <AlertCircle className="w-3 h-3" />}
                              {row.tyLe ?? 0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    <>
                      <tr className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="py-4 px-6 font-medium text-slate-800">Đơn thư khiếu nại</td>
                        <td className="py-4 px-6 text-center">—</td>
                        <td className="py-4 px-6 text-center">—</td>
                        <td className="py-4 px-6 text-center">—</td>
                        <td className="py-4 px-6 text-center">—</td>
                        <td className="py-4 px-6 text-center">—</td>
                      </tr>
                      <tr className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="py-4 px-6 font-medium text-slate-800">Vụ việc</td>
                        <td className="py-4 px-6 text-center">—</td>
                        <td className="py-4 px-6 text-center">—</td>
                        <td className="py-4 px-6 text-center">—</td>
                        <td className="py-4 px-6 text-center">—</td>
                        <td className="py-4 px-6 text-center">—</td>
                      </tr>
                      <tr className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="py-4 px-6 font-medium text-slate-800">Vụ án hình sự</td>
                        <td className="py-4 px-6 text-center">—</td>
                        <td className="py-4 px-6 text-center">—</td>
                        <td className="py-4 px-6 text-center">—</td>
                        <td className="py-4 px-6 text-center">—</td>
                        <td className="py-4 px-6 text-center">—</td>
                      </tr>
                    </>
                  )}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="py-4 px-6 text-slate-800">Tổng cộng</td>
                    <td className="py-4 px-6 text-center">{reportData?.summary?.tonDauKy ?? 0}</td>
                    <td className="py-4 px-6 text-center">{reportData?.summary?.phatSinh ?? 0}</td>
                    <td className="py-4 px-6 text-center">{reportData?.summary?.daGiaiQuyet ?? 0}</td>
                    <td className="py-4 px-6 text-center">{reportData?.summary?.tonCuoiKy ?? 0}</td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        {reportData?.summary?.tyLe ?? 0}%
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
