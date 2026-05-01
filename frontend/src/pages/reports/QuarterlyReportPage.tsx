import { useState, useEffect, useCallback } from "react";
import { Download, FileSpreadsheet, TrendingUp, Award } from "lucide-react";
import {
  BarChart,
  Bar,
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
import { api } from "@/lib/api";

export default function QuarterlyReportPage() {
  const [selectedQuarter, setSelectedQuarter] = useState("Q1-2026");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isExportingQuarterly, setIsExportingQuarterly] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/quarterly?year=${selectedYear}`);
      setReportData(res.data);
    } catch {
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const chartData = reportData?.data ?? [];

  // Build pie data from totals
  const comparisonData = [
    { name: "Đơn thư", value: reportData?.totals?.donThu ?? 0, color: "#3b82f6" },
    { name: "Vụ việc", value: reportData?.totals?.vuViec ?? 0, color: "#8b5cf6" },
    { name: "Vụ án", value: reportData?.totals?.vuAn ?? 0, color: "#ef4444" },
  ];

  const stats = [
    { label: "Tổng hồ sơ tiếp nhận", value: (reportData?.totals?.donThu ?? 0) + (reportData?.totals?.vuViec ?? 0) + (reportData?.totals?.vuAn ?? 0), change: "+18%", color: "blue" },
    { label: "Đã giải quyết", value: reportData?.totals?.daGiaiQuyet ?? 0, change: "+17%", color: "green" },
    { label: "Đang xử lý", value: reportData?.totals?.dangXuLy ?? 0, change: "+5%", color: "amber" },
    { label: "Quá hạn", value: reportData?.totals?.quaHan ?? 0, change: "-12%", color: "red" },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Báo cáo quý</h1>
            <p className="text-slate-600">Tổng hợp số liệu theo quý trong năm</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
            >
              <option value="Q1-2025">Quý I/2025</option>
              <option value="Q2-2025">Quý II/2025</option>
              <option value="Q3-2025">Quý III/2025</option>
              <option value="Q4-2025">Quý IV/2025</option>
              <option value="Q1-2026">Quý I/2026</option>
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
            <button
              onClick={async () => {
                setIsExportingQuarterly(true);
                try {
                  // selectedQuarter format: "Q1-2026" → quarter=1, year=2026
                  const [qPart, yrPart] = selectedQuarter.split('-');
                  const quarter = qPart.replace('Q', '');
                  const response = await api.get('/reports/quarterly/export', {
                    params: { year: yrPart ?? selectedYear, quarter },
                    responseType: 'blob',
                  });
                  const url = URL.createObjectURL(new Blob([response.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `BaoCao_Quy${quarter}_${yrPart ?? selectedYear}.xlsx`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch {
                  alert('Xuất Excel thất bại. Vui lòng thử lại.');
                } finally {
                  setIsExportingQuarterly(false);
                }
              }}
              disabled={isExportingQuarterly}
              className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#0052a3] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {isExportingQuarterly ? 'Đang xuất...' : 'Xuất Excel'}
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

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Line Chart - Trend */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#003973]" />
                Xu hướng qua các quý
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="donThu" stroke="#3b82f6" strokeWidth={2} name="Đơn thư" />
                  <Line type="monotone" dataKey="vuViec" stroke="#8b5cf6" strokeWidth={2} name="Vụ việc" />
                  <Line type="monotone" dataKey="vuAn" stroke="#ef4444" strokeWidth={2} name="Vụ án" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart - Distribution */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#003973]" />
                Tỷ trọng loại hồ sơ
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={comparisonData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {comparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart - Comparison */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-[#003973]" />
              So sánh hiệu quả giải quyết
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quarter" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="daGiaiQuyet" fill="#10b981" name="Đã giải quyết" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Table */}
          <div className="bg-white border border-slate-200 rounded-lg">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Chi tiết báo cáo {selectedQuarter}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-6 font-semibold text-slate-700">Đơn vị</th>
                    <th className="text-center py-3 px-6 font-semibold text-slate-700">Đơn thư</th>
                    <th className="text-center py-3 px-6 font-semibold text-slate-700">Vụ việc</th>
                    <th className="text-center py-3 px-6 font-semibold text-slate-700">Vụ án</th>
                    <th className="text-center py-3 px-6 font-semibold text-slate-700">Tổng</th>
                    <th className="text-center py-3 px-6 font-semibold text-slate-700">Đã giải quyết</th>
                    <th className="text-center py-3 px-6 font-semibold text-slate-700">Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.tableRows?.length > 0 ? (
                    <>
                      {reportData.tableRows.map((row: any, index: number) => (
                        <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-4 px-6 font-medium text-slate-800">{row.unit}</td>
                          <td className="py-4 px-6 text-center">{row.donThu ?? 0}</td>
                          <td className="py-4 px-6 text-center">{row.vuViec ?? 0}</td>
                          <td className="py-4 px-6 text-center">{row.vuAn ?? 0}</td>
                          <td className="py-4 px-6 text-center font-semibold">{(row.donThu ?? 0) + (row.vuViec ?? 0) + (row.vuAn ?? 0)}</td>
                          <td className="py-4 px-6 text-center">{row.daGiaiQuyet ?? 0}</td>
                          <td className="py-4 px-6 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              (row.tyLe ?? 0) >= 80
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {row.tyLe ?? 0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">Không có dữ liệu chi tiết</td>
                    </tr>
                  )}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="py-4 px-6 text-slate-800">Tổng cộng</td>
                    <td className="py-4 px-6 text-center">{reportData?.totals?.donThu ?? 0}</td>
                    <td className="py-4 px-6 text-center">{reportData?.totals?.vuViec ?? 0}</td>
                    <td className="py-4 px-6 text-center">{reportData?.totals?.vuAn ?? 0}</td>
                    <td className="py-4 px-6 text-center">{(reportData?.totals?.donThu ?? 0) + (reportData?.totals?.vuViec ?? 0) + (reportData?.totals?.vuAn ?? 0)}</td>
                    <td className="py-4 px-6 text-center">{reportData?.totals?.daGiaiQuyet ?? 0}</td>
                    <td className="py-4 px-6 text-center">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        {reportData?.totals?.tyLe ?? 0}%
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
