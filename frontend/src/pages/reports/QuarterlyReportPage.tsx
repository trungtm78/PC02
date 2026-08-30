import { useState, useEffect, useCallback } from "react";
import { FileSpreadsheet, TrendingUp, Award } from "lucide-react";
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
import { soLieuHienThi } from "@/lib/soLieuHienThi";
import { extractApiError } from "@/lib/api-errors";
import { LoadErrorBanner } from "@/components/shared/LoadErrorBanner";
import { HuyHieuSoSanh } from "@/components/shared/HuyHieuSoSanh";
import { nhacKyChuaTron, type KhoiSoSanh } from "@/lib/soSanhKy";

/** Quý viết bằng chữ số La Mã, đúng lối văn bản hành chính. */
const SO_LA_MA = ['I', 'II', 'III', 'IV'];

export default function QuarterlyReportPage() {
  /**
   * `null` = cả năm. Trước đây là chuỗi "Q1-2026" TỰ MANG NĂM của nó, tách rời khỏi ô chọn năm
   * bên cạnh — chọn năm 2024 mà vẫn xuất Excel quý I năm 2026. Một kỳ, một nguồn sự thật.
   */
  const [quyChon, setQuyChon] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<any>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isExportingQuarterly, setIsExportingQuarterly] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get('/reports/quarterly', {
        params: { year: selectedYear, ...(quyChon ? { quarter: quyChon } : {}) },
      });
      // Backend /reports/quarterly returns raw `{data, totals}` — no envelope wrap.
      // Do NOT add `.data.data` here. See reports.controller.ts:112.
      setReportData(res.data);
    } catch (e) {
      // Bốn thẻ tổng đọc `reportData?.x ?? 0`, nên đặt null rồi im là cho ra bốn số 0 — cán bộ
      // đọc thấy "kỳ này không có hồ sơ nào", trong khi chỉ là chưa hỏi được máy chủ.
      setReportData(null);
      setLoadError(extractApiError(e, "Không tải được số liệu. Vui lòng thử lại.").messages.join(", "));
    } finally {
      setLoading(false);
    }
  }, [selectedYear, quyChon]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const chartData = reportData?.data ?? [];

  // Build pie data from totals
  const comparisonData = [
    { name: "Đơn thư", value: reportData?.totals?.donThu ?? null, color: "#3b82f6" },
    { name: "Vụ việc", value: reportData?.totals?.vuViec ?? null, color: "#8b5cf6" },
    { name: "Vụ án", value: reportData?.totals?.vuAn ?? null, color: "#ef4444" },
  ];

  const soSanh: KhoiSoSanh | undefined = reportData?.soSanh;
  const nhacDoDang = nhacKyChuaTron(soSanh);
  /**
   * Hồ sơ không lọt vào BẤT KỲ kỳ nào vì thiếu ngày tiếp nhận hoặc ngày nằm ngoài 1900–2100.
   * Con số này nhỏ, nhưng phải hiện: một hồ sơ không xuất hiện trong báo cáo nào là một hồ sơ
   * vô hình, và người đọc báo cáo cần biết tổng của mình thiếu bao nhiêu.
   */
  /**
   * Hồ sơ ĐANG ở trạng thái kết thúc mà chưa có mốc giải quyết — di sản của giai đoạn trước khi
   * có cột `ngayGiaiQuyet`. Chúng không vào kỳ nào, nên phải hiện, nếu không thì "đã giải
   * quyết: 0" đọc như một sự thật.
   */
  const xongChuaRoNgay = reportData?.daGiaiQuyetChuaRoNgay as
    | { donThu: number; vuViec: number; vuAn: number; tong: number }
    | undefined;

  const khongCoNgay = reportData?.khongCoNgay as
    | { donThu: number; vuViec: number; vuAn: number; tong: number }
    | undefined;

  const stats = [
    { label: "Tổng hồ sơ tiếp nhận", value: (reportData?.totals?.donThu ?? 0) + (reportData?.totals?.vuViec ?? 0) + (reportData?.totals?.vuAn ?? 0), chiTieu: "tongTiepNhan", color: "blue" },
    { label: "Đã giải quyết", canhBao: true, value: reportData?.totals?.daGiaiQuyet ?? null, chiTieu: "daGiaiQuyet", color: "green" },
    { label: "Đang xử lý", value: reportData?.totals?.dangXuLy ?? null, chiTieu: "dangXuLy", color: "amber" },
    { label: "Quá hạn", value: reportData?.totals?.quaHan ?? null, chiTieu: "quaHan", color: "red" },
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
              data-testid="chon-quy"
              aria-label="Chọn kỳ báo cáo"
              value={quyChon ?? ''}
              onChange={(e) => setQuyChon(e.target.value === '' ? null : Number(e.target.value))}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
            >
              <option value="">Cả năm {selectedYear}</option>
              {SO_LA_MA.map((la, i) => (
                <option key={la} value={i + 1}>
                  Quý {la}/{selectedYear}
                </option>
              ))}
            </select>
            <select
              data-testid="chon-nam"
              aria-label="Chọn năm"
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
                  const response = await api.get('/reports/quarterly/export', {
                    params: { year: selectedYear, ...(quyChon ? { quarter: quyChon } : {}) },
                    responseType: 'blob',
                  });
                  const url = URL.createObjectURL(new Blob([response.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = quyChon
                    ? `BaoCao_Quy${SO_LA_MA[quyChon - 1]}_${selectedYear}.xlsx`
                    : `BaoCao_CaNam_${selectedYear}.xlsx`;
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
              data-testid="xuat-excel"
              disabled={isExportingQuarterly}
              className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#0052a3] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {isExportingQuarterly ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
          </div>
        </div>
      </div>

      <LoadErrorBanner error={loadError} what="báo cáo quý" data-testid="quarterly-report-load-error" />
      {!loadError && nhacDoDang && (
        <div
          className="mb-4 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          data-testid="nhac-ky-chua-tron"
        >
          <span aria-hidden="true">⏳</span>
          <span>{nhacDoDang}</span>
        </div>
      )}
      {!loadError && khongCoNgay && khongCoNgay.tong > 0 && (
        <div
          className="mb-4 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          data-testid="ho-so-ngoai-moi-ky"
        >
          <strong>{khongCoNgay.tong.toLocaleString("vi-VN")}</strong> hồ sơ không nằm trong bất kỳ
          kỳ báo cáo nào vì thiếu ngày tiếp nhận hoặc ngày không hợp lệ
          {" ("}đơn thư {khongCoNgay.donThu.toLocaleString("vi-VN")}, vụ việc{" "}
          {khongCoNgay.vuViec.toLocaleString("vi-VN")}, vụ án{" "}
          {khongCoNgay.vuAn.toLocaleString("vi-VN")}{")"}. Chúng KHÔNG được cộng vào các con số
          bên dưới.
        </div>
      )}

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
                {/* Huy hiệu "+12%" ở đây từng là chuỗi viết cứng: nó hiện y hệt ở mọi tháng,
                    mọi năm, mọi đơn vị, kể cả khi số liệu tải về bình thường. Máy chủ không trả
                    số kỳ trước (`reports-export.service.ts` chỉ có `totals` kỳ hiện tại) nên
                    không tính được tỷ lệ thật — và một con số không tính được thì không hiện. */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm text-slate-600">
                    {stat.label}
                    {stat.canhBao && xongChuaRoNgay && xongChuaRoNgay.tong > 0 && (
                      /* Không còn là lời cảnh báo chung chung mà là MỘT CON SỐ: bấy nhiêu hồ sơ
                         đã xong việc nhưng kết thúc từ trước khi hệ thống có mốc giải quyết,
                         nên không nằm trong kỳ nào. Con số này tự teo dần. */
                      <span
                        className="ml-1 cursor-help text-amber-600"
                        data-testid="canh-bao-da-giai-quyet"
                        title={`${xongChuaRoNgay.tong.toLocaleString('vi-VN')} hồ sơ đã ở trạng thái kết thúc nhưng chưa ghi mốc giải quyết (đơn thư ${xongChuaRoNgay.donThu}, vụ việc ${xongChuaRoNgay.vuViec}, vụ án ${xongChuaRoNgay.vuAn}) — chúng kết thúc trước khi hệ thống có mốc này, nên không nằm trong kỳ nào. Hồ sơ giải quyết từ nay trở đi đều được ghi mốc.`}
                      >
                        +{xongChuaRoNgay.tong.toLocaleString('vi-VN')}?
                      </span>
                    )}
                  </span>
                  {!loadError && (
                    <HuyHieuSoSanh
                      ketQua={stat.chiTieu ? soSanh?.chiTieu?.[stat.chiTieu] : undefined}
                      nenNhan={soSanh?.nen?.nhan}
                      data-testid={`so-sanh-${stat.chiTieu ?? index}`}
                    />
                  )}
                </div>
                <div className={`text-3xl font-bold text-${stat.color}-600`}>{soLieuHienThi(stat.value, !!loadError)}</div>
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
              <h3 className="text-lg font-bold text-slate-800" data-testid="tieu-de-ky">
                {/* Nhãn kỳ lấy TỪ MÁY CHỦ — cùng nguồn với các con số bên dưới. */}
                Chi tiết báo cáo{' '}
                {soSanh?.ky?.nhan ??
                  (quyChon ? `quý ${SO_LA_MA[quyChon - 1]}/${selectedYear}` : `năm ${selectedYear}`)}
              </h3>
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
                      <td colSpan={7} className="py-10 text-center text-slate-400">{loadError ? 'Chưa hỏi được máy chủ — xem thông báo phía trên' : 'Không có dữ liệu chi tiết'}</td>
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
