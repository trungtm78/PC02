/**
 * Registry bộ mẫu chứng từ chuẩn cho VU_AN (Case) + VU_VIEC (Incident).
 * Nội dung bám biểu mẫu tố tụng hình sự (BLTTHS 2015 + TT 119/2021/TT-BCA): khởi tố vụ án/bị can,
 * kết luận điều tra, tạm đình chỉ, biên bản; (vụ việc) phân công giải quyết nguồn tin, khởi tố/không
 * khởi tố, thông báo kết quả, tạm đình chỉ giải quyết.
 *
 * Placeholder AUTO (tự điền từ hồ sơ — xem entity-placeholders.ts): VU_AN {soVuAn,tenVuAn,toiDanh,
 * dieuTraVien,donVi,ngayKhoiTo,soQuyetDinhKhoiTo,soKLDT,ngayKLDT,soQDDinhChiVuAn,ngayDinhChiVuAn,
 * trangThai}; VU_VIEC {soVuViec,tenVuViec,nguonTin,noiDung,dieuTraVien,donViGiaiQuyet,nguoiQuyetDinh,
 * soQuyetDinh,ngayQuyetDinh,ngayTiepNhan,trangThai}. Biến KHÁC ({diaDanh},{canCu},{hoTenBiCan}…) =
 * nhập tay khi in. Số văn bản để literal "Số:   /…" (admin bật cấp số tự động sau).
 */
import type { DocLine, TemplateBody } from './docx-builder';

export interface TemplateSpec {
  entityType: 'VU_AN' | 'VU_VIEC';
  code: string;
  name: string;
  category: 'Quyết định' | 'Lệnh' | 'Biên bản' | 'Thông báo' | 'Giấy chứng nhận' | 'Kết luận' | 'Khác';
  sortOrder: number;
  body: TemplateBody;
}

const J = (text: string, opts: Partial<DocLine> = {}): DocLine => ({ text, align: 'justify', ...opts });
const C = (text: string, opts: Partial<DocLine> = {}): DocLine => ({ text, align: 'center', ...opts });

export const TEMPLATE_SPECS: TemplateSpec[] = [
  // ─────────────── VU_AN (Case) ───────────────
  {
    entityType: 'VU_AN',
    code: 'QD_KHOI_TO_VU_AN',
    name: 'Quyết định khởi tố vụ án hình sự',
    category: 'Quyết định',
    sortOrder: 10,
    body: {
      coQuan: '{donVi}',
      tieuDe: 'QUYẾT ĐỊNH',
      trichYeu: 'Khởi tố vụ án hình sự',
      noiDung: [
        C('CƠ QUAN CẢNH SÁT ĐIỀU TRA', { bold: true, spacingAfter: 120 }),
        J('Căn cứ Điều 36, Điều 143 và Điều 153 Bộ luật Tố tụng hình sự năm 2015;'),
        J('Căn cứ {canCu};'),
        J('Xét thấy có dấu hiệu của tội phạm liên quan đến vụ việc: {tenVuAn},'),
        C('QUYẾT ĐỊNH:', { bold: true, spacingAfter: 80 }),
        J('Điều 1. Khởi tố vụ án hình sự: {tenVuAn}; tội danh: {toiDanh}; xảy ra tại {noiXayRa}. Mã hồ sơ vụ án: {soVuAn}.'),
        J('Điều 2. Giao Điều tra viên {dieuTraVien} tiến hành điều tra theo quy định của pháp luật.'),
        J('Điều 3. Quyết định này có hiệu lực kể từ ngày ký.'),
      ],
    },
  },
  {
    entityType: 'VU_AN',
    code: 'QD_KHOI_TO_BI_CAN',
    name: 'Quyết định khởi tố bị can',
    category: 'Quyết định',
    sortOrder: 20,
    body: {
      coQuan: '{donVi}',
      tieuDe: 'QUYẾT ĐỊNH',
      trichYeu: 'Khởi tố bị can',
      noiDung: [
        C('CƠ QUAN CẢNH SÁT ĐIỀU TRA', { bold: true, spacingAfter: 120 }),
        J('Căn cứ Điều 36 và Điều 179 Bộ luật Tố tụng hình sự năm 2015;'),
        J('Căn cứ Quyết định khởi tố vụ án hình sự số {soQuyetDinhKhoiTo} ngày {ngayKhoiTo} về vụ án {tenVuAn};'),
        C('QUYẾT ĐỊNH:', { bold: true, spacingAfter: 80 }),
        J('Điều 1. Khởi tố bị can đối với: {hoTenBiCan}; sinh năm {namSinh}; nơi cư trú: {noiCuTru}.'),
        J('Bị can bị khởi tố về tội: {toiDanh}, quy định tại {dieuLuat} Bộ luật Hình sự.'),
        J('Điều 2. Giao Điều tra viên {dieuTraVien} tiến hành điều tra theo quy định của pháp luật.'),
      ],
    },
  },
  {
    entityType: 'VU_AN',
    code: 'KET_LUAN_DIEU_TRA',
    name: 'Bản kết luận điều tra đề nghị truy tố',
    category: 'Kết luận',
    sortOrder: 30,
    body: {
      coQuan: '{donVi}',
      tieuDe: 'BẢN KẾT LUẬN ĐIỀU TRA',
      trichYeu: 'Đề nghị truy tố',
      noiDung: [
        J('Số: {soKLDT} ngày {ngayKLDT}.'),
        J('Căn cứ Điều 232 và Điều 233 Bộ luật Tố tụng hình sự năm 2015;'),
        J('Sau khi điều tra vụ án {tenVuAn} (mã hồ sơ {soVuAn}) về tội {toiDanh}, Cơ quan Cảnh sát điều tra kết luận:'),
        J('Nội dung vụ án: {noiDungVuAn}'),
        J('Kết luận: Đề nghị truy tố bị can {hoTenBiCan} về tội {toiDanh} theo {dieuLuat} Bộ luật Hình sự.'),
        J('Điều tra viên thụ lý: {dieuTraVien}.'),
      ],
    },
  },
  {
    entityType: 'VU_AN',
    code: 'QD_TAM_DINH_CHI_DT',
    name: 'Quyết định tạm đình chỉ điều tra vụ án',
    category: 'Quyết định',
    sortOrder: 40,
    body: {
      coQuan: '{donVi}',
      tieuDe: 'QUYẾT ĐỊNH',
      trichYeu: 'Tạm đình chỉ điều tra vụ án hình sự',
      noiDung: [
        C('CƠ QUAN CẢNH SÁT ĐIỀU TRA', { bold: true, spacingAfter: 120 }),
        J('Căn cứ Điều 36 và Điều 229 Bộ luật Tố tụng hình sự năm 2015;'),
        C('QUYẾT ĐỊNH:', { bold: true, spacingAfter: 80 }),
        J('Điều 1. Tạm đình chỉ điều tra vụ án hình sự: {tenVuAn} (mã hồ sơ {soVuAn}).'),
        J('Lý do tạm đình chỉ: {lyDo}.'),
        J('Điều 2. Quyết định này có hiệu lực kể từ ngày ký. Điều tra viên {dieuTraVien} chịu trách nhiệm thi hành.'),
      ],
    },
  },
  {
    entityType: 'VU_AN',
    code: 'BB_HOI_CUNG_BI_CAN',
    name: 'Biên bản hỏi cung bị can',
    category: 'Biên bản',
    sortOrder: 50,
    body: {
      coQuan: '{donVi}',
      tieuDe: 'BIÊN BẢN HỎI CUNG BỊ CAN',
      noiDung: [
        J('Hồi {gioBatDau}, tại {diaDiem}, trong vụ án {tenVuAn} về tội {toiDanh}.'),
        J('Điều tra viên: {dieuTraVien} tiến hành hỏi cung bị can: {hoTenBiCan}, sinh năm {namSinh}.'),
        J('Nội dung hỏi cung: {noiDungHoiCung}'),
        J('Biên bản kết thúc hồi {gioKetThuc} cùng ngày, đã đọc lại cho bị can nghe, công nhận đúng và ký tên.'),
      ],
    },
  },

  // ─────────────── VU_VIEC (Incident / nguồn tin) ───────────────
  {
    entityType: 'VU_VIEC',
    code: 'QD_PHAN_CONG_GIAI_QUYET',
    name: 'Quyết định phân công giải quyết nguồn tin về tội phạm',
    category: 'Quyết định',
    sortOrder: 10,
    body: {
      coQuan: '{donViGiaiQuyet}',
      tieuDe: 'QUYẾT ĐỊNH',
      trichYeu: 'Phân công giải quyết nguồn tin về tội phạm',
      noiDung: [
        C('CƠ QUAN CẢNH SÁT ĐIỀU TRA', { bold: true, spacingAfter: 120 }),
        J('Căn cứ Điều 36, Điều 145 và Điều 146 Bộ luật Tố tụng hình sự năm 2015;'),
        J('Căn cứ Thông tư liên tịch số 01/2017 và Thông tư 28/2020/TT-BCA;'),
        J('Đối với nguồn tin: {tenVuViec} (mã {soVuViec}), nguồn phát tin: {nguonTin}, tiếp nhận ngày {ngayTiepNhan},'),
        C('QUYẾT ĐỊNH:', { bold: true, spacingAfter: 80 }),
        J('Điều 1. Phân công Điều tra viên {dieuTraVien} giải quyết nguồn tin về tội phạm nêu trên.'),
        J('Điều 2. Điều tra viên có trách nhiệm giải quyết theo đúng quy định và thời hạn của pháp luật.'),
        J('Người ra quyết định: {nguoiQuyetDinh}.'),
      ],
    },
  },
  {
    entityType: 'VU_VIEC',
    code: 'QD_KHOI_TO_TU_NGUON_TIN',
    name: 'Quyết định khởi tố vụ án hình sự (từ nguồn tin)',
    category: 'Quyết định',
    sortOrder: 20,
    body: {
      coQuan: '{donViGiaiQuyet}',
      tieuDe: 'QUYẾT ĐỊNH',
      trichYeu: 'Khởi tố vụ án hình sự',
      noiDung: [
        C('CƠ QUAN CẢNH SÁT ĐIỀU TRA', { bold: true, spacingAfter: 120 }),
        J('Căn cứ Điều 143 và Điều 153 Bộ luật Tố tụng hình sự năm 2015;'),
        J('Sau khi giải quyết nguồn tin {tenVuViec} (mã {soVuViec}, nguồn: {nguonTin}), xét thấy có dấu hiệu tội phạm,'),
        C('QUYẾT ĐỊNH:', { bold: true, spacingAfter: 80 }),
        J('Điều 1. Khởi tố vụ án hình sự về tội: {toiDanh}, quy định tại {dieuLuat} Bộ luật Hình sự.'),
        J('Nội dung: {noiDung}'),
        J('Điều 2. Giao Điều tra viên {dieuTraVien} tiến hành điều tra. Số quyết định: {soQuyetDinh}, ngày {ngayQuyetDinh}.'),
      ],
    },
  },
  {
    entityType: 'VU_VIEC',
    code: 'QD_KHONG_KHOI_TO',
    name: 'Quyết định không khởi tố vụ án hình sự',
    category: 'Quyết định',
    sortOrder: 30,
    body: {
      coQuan: '{donViGiaiQuyet}',
      tieuDe: 'QUYẾT ĐỊNH',
      trichYeu: 'Không khởi tố vụ án hình sự',
      noiDung: [
        C('CƠ QUAN CẢNH SÁT ĐIỀU TRA', { bold: true, spacingAfter: 120 }),
        J('Căn cứ Điều 157 và Điều 158 Bộ luật Tố tụng hình sự năm 2015;'),
        J('Sau khi giải quyết nguồn tin {tenVuViec} (mã {soVuViec}, nguồn: {nguonTin}),'),
        C('QUYẾT ĐỊNH:', { bold: true, spacingAfter: 80 }),
        J('Điều 1. Không khởi tố vụ án hình sự đối với nguồn tin nêu trên.'),
        J('Lý do: {lyDo}.'),
        J('Số quyết định: {soQuyetDinh}, ngày {ngayQuyetDinh}. Người ra quyết định: {nguoiQuyetDinh}.'),
      ],
    },
  },
  {
    entityType: 'VU_VIEC',
    code: 'TB_KET_QUA_GIAI_QUYET',
    name: 'Thông báo kết quả giải quyết nguồn tin về tội phạm',
    category: 'Thông báo',
    sortOrder: 40,
    body: {
      coQuan: '{donViGiaiQuyet}',
      tieuDe: 'THÔNG BÁO',
      trichYeu: 'Kết quả giải quyết nguồn tin về tội phạm',
      noiDung: [
        J('Kính gửi: {nguoiNhan}.'),
        J('Căn cứ Điều 147 Bộ luật Tố tụng hình sự năm 2015 và Thông tư 28/2020/TT-BCA;'),
        J('Về nguồn tin: {tenVuViec} (mã {soVuViec}), nguồn phát tin: {nguonTin}, tiếp nhận ngày {ngayTiepNhan};'),
        J('Cơ quan Cảnh sát điều tra thông báo kết quả giải quyết như sau: {ketQua}'),
        J('Quyết định liên quan: số {soQuyetDinh}, ngày {ngayQuyetDinh}.'),
      ],
    },
  },
  {
    entityType: 'VU_VIEC',
    code: 'QD_TAM_DINH_CHI_GQ',
    name: 'Quyết định tạm đình chỉ việc giải quyết nguồn tin',
    category: 'Quyết định',
    sortOrder: 50,
    body: {
      coQuan: '{donViGiaiQuyet}',
      tieuDe: 'QUYẾT ĐỊNH',
      trichYeu: 'Tạm đình chỉ việc giải quyết nguồn tin về tội phạm',
      noiDung: [
        C('CƠ QUAN CẢNH SÁT ĐIỀU TRA', { bold: true, spacingAfter: 120 }),
        J('Căn cứ Điều 148 Bộ luật Tố tụng hình sự năm 2015;'),
        J('Đối với nguồn tin {tenVuViec} (mã {soVuViec}),'),
        C('QUYẾT ĐỊNH:', { bold: true, spacingAfter: 80 }),
        J('Điều 1. Tạm đình chỉ việc giải quyết nguồn tin về tội phạm nêu trên. Lý do: {lyDo}.'),
        J('Điều 2. Số quyết định: {soQuyetDinh}, ngày {ngayQuyetDinh}. Điều tra viên: {dieuTraVien}.'),
      ],
    },
  },
];
