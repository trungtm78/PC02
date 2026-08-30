/**
 * Suy trạng thái giải quyết từ ô chữ tự do của hệ cũ.
 *
 * ── Vì sao phải suy ──
 *
 * Đo trên máy thật 30/08/2026, sau di trú:
 *
 *     petitions  46.741 bản ghi — TẤT CẢ đang ở MOI_TIEP_NHAN
 *     incidents   4.723 bản ghi — 4.605 ở TIEP_NHAN
 *     cases       3.381 bản ghi — 2.566 ở TIEP_NHAN
 *
 * Hệ cũ KHÔNG có cột trạng thái giải quyết. Đã dò hết: `loai` là loại bản ghi (đơn thư / luật
 * sư / vụ việc…), `loai_thong_tin` là loại đơn (tố giác / đề nghị…), `tinh_trang` và
 * `phan_loai_ho_so_doi_1` chỉ chứa hằng `-1`. Kết quả xử lý nằm ở ĐÚNG MỘT ô chữ tự do:
 * `ket_qua_xu_ly_giai_quyet_khac` — 11.142 đơn thư, 2.542 vụ việc, 222 vụ án có ghi.
 *
 * ── Luật của bộ suy ──
 *
 * 1. **Khớp nhiều mẫu = KHÔNG suy.** "Tạm đình chỉ sau khi chuyển PC03" khớp cả hai; đoán bừa
 *    một trong hai là khai sai tư cách pháp lý của hồ sơ. Trả `NHAP_NHANG` để người xem quyết.
 * 2. **Không khớp mẫu nào = KHÔNG suy.** Im lặng để nguyên còn hơn đoán.
 * 3. **Phủ định phải thắng khẳng định.** "không khởi tố" chứa "khởi tố"; xét phủ định TRƯỚC.
 * 4. **Ngày lấy từ chính câu chữ khi có.** 8.019/11.142 câu có dạng dd/mm/yyyy — đó là ngày
 *    cán bộ ghi tay, thật hơn mọi phép suy khác.
 */

export type TrangThaiSuy =
  | 'TAM_DINH_CHI'
  | 'KHONG_KHOI_TO'
  | 'DA_KHOI_TO'
  | 'TRA_DON'
  | 'LUU_DON'
  | 'DA_CHUYEN_DON_VI'
  | 'DA_NHAP_VU_KHAC'
  | 'DA_GIAI_QUYET'
  | 'HUONG_DAN'
  | 'PHAN_LOAI_DAN_SU'
  // Đợt hai 30/08/2026 — rút từ 3.307 hồ sơ chưa suy được của lượt đầu.
  | 'DINH_CHI'
  | 'CHUYEN_XPHC'
  | 'DANG_XU_LY';

export interface KetQuaSuy {
  trangThai: TrangThaiSuy | null;
  /** Ngày bóc được từ chính câu chữ. `null` khi câu không ghi ngày. */
  ngay: Date | null;
  ly: 'RO_RANG' | 'NHAP_NHANG' | 'KHONG_KHOP' | 'RONG';
  /** Những mẫu đã khớp — để người xem kiểm lại phán đoán, nhất là khi nhập nhằng. */
  khop: TrangThaiSuy[];
  /** Nguyên văn, đã chuẩn hoá — báo cáo chạy khô in ra để đối chiếu. */
  nguyenVan: string;
}

interface Mau {
  trangThai: TrangThaiSuy;
  /** Khớp khi có BẤT KỲ chuỗi nào trong `co`, và KHÔNG có chuỗi nào trong `tru`. */
  co: string[];
  tru?: string[];
}

/**
 * Mẫu rút từ dữ liệu THẬT, không nghĩ ra. Mỗi mẫu kèm số bản ghi đo được ở đơn thư ngày
 * 30/08/2026 để lần sau ai sửa còn biết mình đang động vào bao nhiêu hồ sơ.
 */
export const MAU_TRANG_THAI: Mau[] = [
  // 1.517 — "TĐC giải quyết (BCT6/2022)", "Tạm đình chỉ (T11/2022)"
  { trangThai: 'TAM_DINH_CHI', co: ['tạm đình chỉ', 'tđc'] },
  // 934 — "Không khởi tố vụ án", "Không KTVA (BCT6/2022)"
  { trangThai: 'KHONG_KHOI_TO', co: ['không khởi tố', 'không ktva', 'ko khởi tố', 'không kt'] },
  // "KTVA 821-01 ngày 20/9/2021" — viết tắt của KHỞI TỐ VỤ ÁN, dễ bỏ sót vì không có dấu
  {
    trangThai: 'DA_KHOI_TO',
    co: ['khởi tố', 'ktva'],
    tru: ['không khởi tố', 'không ktva', 'ko khởi tố', 'không kt'],
  },
  // 304 — "Trả đơn"
  { trangThai: 'TRA_DON', co: ['trả đơn', 'trả lại đơn'] },
  // 408 + "lưu do nguyên đơn rút đơn", "lưu theo dõi"
  { trangThai: 'LUU_DON', co: ['lưu đơn', 'lưu hồ sơ', 'lưu,', 'lưu theo dõi', 'rút đơn'] },
  // 1.094 — "Chuyển PC03 CATP HCM (M Hùng)"
  { trangThai: 'DA_CHUYEN_DON_VI', co: ['chuyển'] },
  // 1.026 — "Nhập tố giác 1373-07/5/2019 (Nghiêm)"
  { trangThai: 'DA_NHAP_VU_KHAC', co: ['nhập '] },
  // 102 — "đã giải quyết"
  { trangThai: 'DA_GIAI_QUYET', co: ['đã giải quyết', 'giải quyết xong'] },
  // 279
  { trangThai: 'HUONG_DAN', co: ['hướng dẫn'] },
  // "phân loại dân sự (tỉnh)", "phân loại ngày 23/4/2024", và "tb dân sự" (233 bản ghi)
  { trangThai: 'PHAN_LOAI_DAN_SU', co: ['phân loại', 'dân sự'] },
  // 177 — "đình chỉ" KHÔNG có chữ "tạm" là một kết quả KHÁC HẲN tạm đình chỉ: hồ sơ đóng hẳn,
  // không phục hồi. Phải loại trừ "tạm đình chỉ" và "tđc", nếu không mọi hồ sơ tạm đình chỉ đều
  // bị đọc thành đình chỉ hẳn.
  { trangThai: 'DINH_CHI', co: ['đình chỉ'], tru: ['tạm đình chỉ', 'tđc'] },
  // 22 — "chuyển xử phạt hành chính", "xphc"
  { trangThai: 'CHUYEN_XPHC', co: ['xử phạt', 'xphc'] },
  // 364 + 29 + 24 — "ra qđ phân công giải quyết", "đã tiếp nhận", "đang xác minh". Đây là trạng
  // thái ĐANG LÀM, không phải kết quả; xếp ưu tiên thấp nhất để một kết quả thật luôn thắng.
  {
    trangThai: 'DANG_XU_LY',
    co: ['phân công', 'đã tiếp nhận', 'đang xác minh', 'đang điều tra', 'đang xử lý'],
  },
];

/**
 * Thứ tự ưu tiên khi một câu khớp NHIỀU mẫu — 501 hồ sơ ở lượt đầu.
 *
 * Bản đầu từ chối suy hẳn. Nhưng câu "nhập vv 276/05-2019 bình tân chuyển 30/05/2019" mô tả
 * SỐ PHẬN CỦA CHÍNH hồ sơ này (nó bị nhập vào hồ sơ khác), còn "chuyển" chỉ là một mốc trên
 * đường đi. Nên xếp theo mức độ mô tả số phận cuối cùng của chính bản ghi:
 *
 *   nhập / chuyển đơn vị  — hồ sơ này ĐI ĐÂU, dứt khoát nhất
 *   khởi tố / không khởi tố / đình chỉ / tạm đình chỉ — kết quả tố tụng
 *   xphc / trả đơn / lưu đơn / phân loại / hướng dẫn — kết quả hành chính
 *   đã giải quyết        — câu chung chung nhất trong nhóm kết quả
 *   đang xử lý           — KHÔNG phải kết quả, luôn thua
 *
 * Hồ sơ suy theo lối này được ĐÁNH DẤU riêng trong danh sách xuất ra, để người xác nhận soi kỹ
 * đúng nhóm đáng ngờ nhất thay vì soi đều cả bảy nghìn dòng.
 */
export const UU_TIEN: TrangThaiSuy[] = [
  'DA_NHAP_VU_KHAC',
  'DA_CHUYEN_DON_VI',
  'DA_KHOI_TO',
  'KHONG_KHOI_TO',
  'DINH_CHI',
  'TAM_DINH_CHI',
  'CHUYEN_XPHC',
  'TRA_DON',
  'LUU_DON',
  'PHAN_LOAI_DAN_SU',
  'HUONG_DAN',
  'DA_GIAI_QUYET',
  'DANG_XU_LY',
];

/** Ngày viết tay trong câu: 1 hoặc 2 chữ số ngày/tháng, 4 chữ số năm. */
const MAU_NGAY = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;

export function bocNgay(chu: string): Date | null {
  const m = MAU_NGAY.exec(chu);
  if (!m) return null;
  const ngay = Number(m[1]);
  const thang = Number(m[2]);
  const nam = Number(m[3]);
  if (thang < 1 || thang > 12 || ngay < 1 || ngay > 31) return null;
  if (nam < 1900 || nam > 2100) return null;
  const d = new Date(nam, thang - 1, ngay);
  // Chặn "31/4/2024": Date tự cuộn sang 1/5 thay vì báo sai.
  if (d.getDate() !== ngay || d.getMonth() !== thang - 1) return null;
  return d;
}

export function suyTrangThai(chuGoc: string | null | undefined): KetQuaSuy {
  const nguyenVan = (chuGoc ?? '').trim();
  if (!nguyenVan) {
    return { trangThai: null, ngay: null, ly: 'RONG', khop: [], nguyenVan: '' };
  }

  const t = nguyenVan.toLowerCase();
  const khop = MAU_TRANG_THAI.filter(
    (m) => m.co.some((c) => t.includes(c)) && !(m.tru ?? []).some((c) => t.includes(c)),
  ).map((m) => m.trangThai);

  const ngay = bocNgay(nguyenVan);

  if (khop.length === 0) return { trangThai: null, ngay, ly: 'KHONG_KHOP', khop, nguyenVan };
  if (khop.length === 1) return { trangThai: khop[0], ngay, ly: 'RO_RANG', khop, nguyenVan };

  // Khớp nhiều mẫu: chọn theo ƯU TIÊN, nhưng KHAI RÕ là suy từ câu nhiều nghĩa để người xác
  // nhận soi kỹ đúng nhóm này.
  const chon = UU_TIEN.find((t) => khop.includes(t)) ?? null;
  return { trangThai: chon, ngay, ly: 'NHAP_NHANG', khop, nguyenVan };
}
