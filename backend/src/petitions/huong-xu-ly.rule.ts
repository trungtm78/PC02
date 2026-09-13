import { HuongXuLyDon, PetitionStatus } from '@prisma/client';

/**
 * Luật của ba hướng xử lý đơn thư — gom một chỗ vì BA nơi cùng đọc: bộ dựng dữ liệu lúc tạo,
 * đường cập nhật lúc sửa, và migration backfill.
 *
 *      chọn hướng trên form
 *              │
 *              ├─► thuocThamQuyen  (cột cũ, suy ra — không còn ô nhập)
 *              ├─► câu "Đề xuất" + ô "Kính gửi"   (field-catalog.ts)
 *              └─► trạng thái hồ sơ   ── CHỈ khi hướng thực sự đổi ──►
 */

/** Hướng nào là xử lý NỘI BỘ — dùng để suy cột `thuocThamQuyen` đã bỏ khỏi form. */
export function suyThuocThamQuyen(huong: HuongXuLyDon | undefined | null): boolean | undefined {
  if (!huong) return undefined; // không chọn thì không suy bừa, để service khỏi ghi đè cột
  return huong !== HuongXuLyDon.CHUYEN_DON;
}

/**
 * Trạng thái tương ứng mỗi hướng.
 *
 * `TRA_LUU_DON` → `DA_TRA_DON`: "Trả đơn" và "Lưu đơn" là một việc về nghiệp vụ (quyết định
 * 09/09/2026), nên `DA_LUU_DON` không được dùng cho hướng này.
 */
export function trangThaiTheoHuong(huong: HuongXuLyDon): PetitionStatus {
  switch (huong) {
    case HuongXuLyDon.CHUYEN_DON:
      return PetitionStatus.DA_CHUYEN_DON_VI;
    case HuongXuLyDon.TRA_LUU_DON:
      return PetitionStatus.DA_TRA_DON;
    default:
      return PetitionStatus.DANG_XU_LY;
  }
}

/**
 * Có được đổi trạng thái trong lần lưu này không.
 *
 * Áp trạng thái ở MỌI lần lưu là hỏng lặng lẽ: cán bộ sửa số điện thoại người gửi rồi bấm Lưu
 * sẽ kéo hồ sơ ngược về trạng thái của hướng, xoá mất thay đổi trạng thái người khác vừa làm
 * bằng đường khác — và không có thông báo nào.
 */
export function canDoiTrangThai(
  huongCu: HuongXuLyDon | null | undefined,
  huongMoi: HuongXuLyDon | undefined | null,
): boolean {
  if (!huongMoi) return false; // lần lưu này không gửi hướng
  return huongCu !== huongMoi;
}

/**
 * Chiều ngược của `trangThaiTheoHuong`: suy hướng từ trạng thái.
 *
 * Cho hồ sơ vào hệ mới KHÔNG qua form — bộ nạp hệ cũ. Cùng luật với migration backfill
 * `20260909150000_huong_xu_ly_don`; trước đây luật chỉ nằm trong tệp SQL ấy nên bộ nạp không
 * đọc được, và đợt nạp 11/09/2026 đưa vào 434 đơn thư mang hướng trống.
 */
export function huongTheoTrangThai(status: PetitionStatus | string | null | undefined): HuongXuLyDon {
  if (status === PetitionStatus.DA_CHUYEN_DON_VI) return HuongXuLyDon.CHUYEN_DON;
  if (status === PetitionStatus.DA_TRA_DON || status === PetitionStatus.DA_LUU_DON) {
    return HuongXuLyDon.TRA_LUU_DON;
  }
  return HuongXuLyDon.GIAO_DON;
}

/** So khớp đầu câu: bỏ khoảng trắng, về chữ thường, gộp dấu tổ hợp để "Trả" gõ kiểu nào cũng khớp. */
function chuanDauCau(v: string | null | undefined): string {
  return (v ?? '').normalize('NFC').trim().toLocaleLowerCase('vi');
}

/**
 * Chữ mở đầu của một CÂU đề xuất — đo trên toàn bộ ô đơn vị của đơn thư prod ngày 13/09/2026.
 *
 * "Giao" chỉ tính khi theo sau là một đơn vị/người nhận: "Giao thông vận tải" là tên đơn vị.
 * "Đồng chí …", "Đ/c Trưởng …", "Trưởng Công an …" KHÔNG ở đây — đó là người nhận, khuôn
 * "Giao … tiếp nhận" vẫn đọc đúng như biến thể 1 của mẫu hệ cũ.
 */
const MO_DAU_CAU_DE_XUAT =
  /^(trả\s+(lại\s+)?(đơn|hồ\s*sơ|tài\s*liệu)|lưu\s+(đơn|hồ\s*sơ)|hoàn\s+trả|hướng\s+dẫn|thông\s+báo|chuyển|giao\s+(cho\s+)?(đội|tổ|đ\/c|đồng\s+chí|bch|ban\s+chỉ\s+huy|cơ\s+sở|công\s+an|phòng))(?=$|[\s,.;:(])/u;

/** Chữ mở đầu nói RÕ hướng Trả đơn/Lưu đơn. */
const MO_DAU_TRA_LUU =
  /^(trả\s+(lại\s+)?(đơn|hồ\s*sơ|tài\s*liệu)|lưu\s+(đơn|hồ\s*sơ)|hoàn\s+trả|hướng\s+dẫn|thông\s+báo\s+(trả|không))(?=$|[\s,.;:(])/u;

/**
 * Một mệnh đề giao/chuyển TÁCH RIÊNG trong câu ("…; giao Tổ X", "… và chuyển Công an Y").
 * Chữ "giao" nằm trong từ khác ("hợp đồng giao dịch") không tính.
 */
const MENH_DE_GIAO_CHUYEN = /(^|[;,.(]|\svà)\s*(giao|chuyển)(?=\s)/u;

/**
 * Ô "Đơn vị giải quyết" đã là CẢ CÂU đề xuất, không phải tên đơn vị.
 *
 * Hệ cũ không có ô hướng xử lý: với trả đơn / lưu đơn, cán bộ gõ luôn câu vào ô đơn vị, và mẫu
 * `don_thu_mau.docx` có sẵn biến thể 3 in nguyên văn — `Đề xuất: ${don_vi_giai_quyet}./.`.
 * Bọc câu ấy vào khuôn Giao/Chuyển cho ra "Giao Lưu đơn; Hướng dẫn khởi kiện tại TAND tiếp nhận
 * kiểm tra…" (~1.600 đơn thư đo 13/09/2026).
 */
export function laCauDeXuat(donVi: string | null | undefined): boolean {
  return MO_DAU_CAU_DE_XUAT.test(chuanDauCau(donVi));
}

/**
 * Hướng xử lý đọc ra từ câu trong ô đơn vị — CHỈ khi câu nói rõ một hướng.
 *
 * Trả `undefined` thay vì đoán cho hai nhóm đo được trên prod:
 *  - câu nhiều nội dung ("Hướng dẫn khởi kiện…; giao Tổ Hình sự khu vực 6") không có một hướng;
 *  - "Chuyển Đ/c Phú - Phó Trưởng phòng để chỉ đạo Đội 8" là giao NỘI BỘ, không phải chuyển ra
 *    ngoài — đoán theo chữ đầu là sai.
 * Hai nhóm ấy bản in vẫn đúng vì câu được in nguyên văn (`laCauDeXuat`).
 */
export function huongTheoNoiDungDonVi(donVi: string | null | undefined): HuongXuLyDon | undefined {
  const cau = chuanDauCau(donVi);
  if (!MO_DAU_TRA_LUU.test(cau)) return undefined;
  if (MENH_DE_GIAO_CHUYEN.test(cau)) return undefined;
  return HuongXuLyDon.TRA_LUU_DON;
}
