import { useState, useEffect, useCallback } from "react";
import { FileSpreadsheet, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
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
import { soLieuHienThi } from "@/lib/soLieuHienThi";
import { extractApiError } from "@/lib/api-errors";
import { LoadErrorBanner } from "@/components/shared/LoadErrorBanner";
import { HuyHieuSoSanh } from "@/components/shared/HuyHieuSoSanh";
import { nhacKyChuaTron, type KhoiSoSanh } from "@/lib/soSanhKy";
import {
  ChonKyBaoCao,
  type KyDangChon,
  type NenDangChon,
} from "@/components/shared/ChonKyBaoCao";
import { thamSoKy, thamSoNen, tenTepXuat } from "@/lib/thamSoKyBaoCao";

export default function MonthlyReportPage() {
  /**
   * Kỳ đang xem và nền so sánh là HAI TRỤC khác nhau: "lũy kế 8 tháng" là một KỲ, "cùng kỳ năm
   * trước" là một NỀN, và người ta muốn xem lũy kế 8 tháng so với cùng kỳ năm trước. Gộp vào
   * một ô là bắt người dùng chọn một trong hai thứ họ cần cả hai.
   */
  const [ky, setKy] = useState<KyDangChon>({ loai: 'NAM' });
  const [nen, setNen] = useState<NenDangChon>({ kieu: 'CUNG_KY_NAM_TRUOC' });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<any>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isExportingMonthly, setIsExportingMonthly] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get('/reports/monthly', {
        params: {
          year: selectedYear,
          ...thamSoKy(ky, 'THANG'),
          ...thamSoNen(nen),
        },
      });
      // Backend /reports/monthly returns raw `{data, totals}` — no envelope wrap.
      // Do NOT add `.data.data` here. See reports.controller.ts:104.
      setReportData(res.data);
    } catch (e) {
      // Bốn thẻ tổng đọc `reportData?.x ?? 0`, nên đặt null rồi im là cho ra bốn số 0 — cán bộ
      // đọc thấy "kỳ này không có hồ sơ nào", trong khi chỉ là chưa hỏi được máy chủ.
      setReportData(null);
      setLoadError(extractApiError(e, "Không tải được số liệu. Vui lòng thử lại.").messages.join(", "));
    } finally {
      setLoading(false);
    }
  }, [selectedYear, ky, nen]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const chartData = reportData?.data ?? [];

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
    { label: "Tổng đơn thư", value: reportData?.totals?.donThu ?? null, chiTieu: "donThu", color: "blue" },
    { label: "Tổng vụ việc", value: reportData?.totals?.vuViec ?? null, chiTieu: "vuViec", color: "purple" },
    { label: "Tổng vụ án", value: reportData?.totals?.vuAn ?? null, chiTieu: "vuAn", color: "red" },
    { label: "Đã giải quyết", canhBao: true, value: reportData?.totals?.daGiaiQuyet ?? null, chiTieu: "daGiaiQuyet", color: "green" },
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
            <ChonKyBaoCao
              nam={selectedYear}
              don="thang"
              ky={ky}
              nen={nen}
              onDoiKy={setKy}
              onDoiNen={setNen}
            />
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
                setIsExportingMonthly(true);
                try {
                  // Cả năm thì xuất tháng 1 tới 12 là vô nghĩa — máy chủ nhận `month` rỗng
                  // nghĩa là cả năm, và tên tệp phải nói đúng điều đó.
                  const response = await api.get('/reports/monthly/export', {
                    params: { year: selectedYear, ...thamSoKy(ky, 'THANG') },
                    responseType: 'blob',
                  });
                  const url = URL.createObjectURL(new Blob([response.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = tenTepXuat(ky, selectedYear);
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch {
                  alert('Xuất Excel thất bại. Vui lòng thử lại.');
                } finally {
                  setIsExportingMonthly(false);
                }
              }}
              data-testid="xuat-excel"
              disabled={isExportingMonthly}
              className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#0052a3] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {isExportingMonthly ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
          </div>
        </div>
      </div>

      <LoadErrorBanner error={loadError} what="báo cáo tháng" data-testid="monthly-report-load-error" />
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
              <h3 className="text-lg font-bold text-slate-800" data-testid="tieu-de-ky">
                {/* Nhãn kỳ lấy TỪ MÁY CHỦ: nó và các con số bên dưới phải cùng một nguồn, nếu
                    không thì tiêu đề nói một kỳ mà số liệu là kỳ khác. */}
                Chi tiết báo cáo {soSanh?.ky?.nhan ?? `năm ${selectedYear}`}
              </h3>
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
