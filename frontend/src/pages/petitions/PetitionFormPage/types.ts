/**
 * Kiểu dữ liệu form Đơn thư.
 *
 * Tách khỏi `PetitionFormPage.tsx` để `buildPetitionPayload` và ca kiểm dùng được mà không
 * phải nạp cả trang 1.287 dòng. Nội dung giữ nguyên từ `interface FormData` cũ — chỉ đổi chỗ.
 */

import { today } from '@/lib/dates';
import type { HuongXuLyDon } from '@/shared/enums/generated';

export interface PetitionFormData {
  stt: string; receivedDate: string; unit: string; assignedTeamId: string;
  senderName: string;
  senderBirthYear: string; senderAddress: string; senderPhone: string;
  senderEmail: string; suspectedPerson: string; suspectedAddress: string;
  priority: string; summary: string;
  detailContent: string; attachmentsNote: string; deadline: string;
  assignedToId: string; canBoDeXuatId: string; notes: string;
  // v0.47 PR3.1 — Nội dung phiếu đề xuất
  nhanThay: string;
  deXuat: string;
  raSoatTrung: string;
  baoCaoBanGiamDoc: boolean;
  // Field-parity hệ cũ (giai đoạn tiếp nhận)
  senderIdNumber: string;
  senderIdIssueDate: string;
  senderIdIssuePlace: string;
  senderIsAnonymous: boolean;
  loaiThongTin: string;
  soPhieuChuyen: string;
  ngayPhieuChuyen: string;
  ngayTiepNhanNguonTin: string;
  toiDanhBanDau: string;
  crimeChinhId: string;
  noiXayRa: string;
  noiXayRaPhuongXa: string;
  ngayXayRa: string;
  loaiToiPham: string;
  phuongThucThuDoan: string;
  ngayGiaoDonViGiaiQuyet: string;
  laCongNgheCao: boolean;
  lanhDaoToTung: string;
  ketQuaXuLyKhac: string;
  thoiHanUTDT: string;
  // Field-parity bổ sung tab "Thông tin" form cũ /doi-1/Them
  nguonDon: string;
  petitionDate: string;
  /**
   * Ngày viết đơn theo EDTF Level 1 khi giấy tờ ghi THIẾU thành phần: `2026-12-XX`.
   * `petitionDate` vẫn là cột ngày thật, chỉ có giá trị khi nhập ĐỦ ba phần.
   */
  ngayVietDonEdtf: string;
  /**
   * Ngày viết đơn GHI NGUYÊN VĂN như cán bộ gõ — trống khi chữ ấy đúng là một ngày.
   *
   * Đo prod 21/09/2026: 4.454/46.129 hồ sơ mang giá trị không đọc ra được một ngày (hồ sơ GỘP
   * nhiều đơn, hoặc ghi chú "Không ghi ngày"). Anh chốt: để nguyên chữ đã nhập và in ra Word.
   */
  ngayVietDonChu: string;
  ngayDeXuat: string;
  phanLoaiNguonTin: string;
  dieuTraVien: string;
  donViGiaiQuyet: string;
  // Thẩm quyền & đơn vị xử lý
  //
  // `huongXuLy` là ô thật trên form từ 09/09/2026; `thuocThamQuyen` giữ trong kiểu vì máy chủ
  // vẫn nhận và nhiều màn khác còn đọc cột ấy, nhưng KHÔNG còn ô nhập nào — máy chủ suy ra.
  huongXuLy: HuongXuLyDon | "";
  thuocThamQuyen: boolean;

  // ── Cột hệ cũ thêm 26/08/2026 (xem PARITY.petition) ──
  baoCaoBanGiamDocText: string;
  tinhTrang: string;
  soQDPhanCongNguonTin: string;
  ngayQDPhanCongNguonTin: string;
  soQDTamDinhChiNguonTin: string;
  ngayQDTamDinhChiNguonTin: string;
  canCuTamDinhChiNguonTin: string;
  soPhucHoiNguonTin: string;
  ngayPhucHoiNguonTin: string;
  // ── Cột parity vốn chỉ hiện ở panel cuối trang, nay có ô trong tab ──
  ghiChuKhac: string;
  phanLoaiToiPhamLinhVuc: string;
  yeuCauBoSung: string;
  soTienBiThietHai: string;
  soLuongBiHai: string;
  sttCu: string;

  /**
   * Ô hệ cũ CHƯA có cột riêng trên Đơn thư — giữ trong `metadata` của máy chủ.
   *
   * Hệ cũ dùng chung một form cho Đơn thư, Vụ việc và Vụ án, nên bố cục có cả ô của giai đoạn
   * khởi tố / tạm đình chỉ vụ án. Đơn thư không có cột cho chúng, nhưng cán bộ vẫn nhìn thấy ô
   * đúng chỗ như hệ cũ và giá trị vẫn được lưu — chỉ là lưu ở `metadata`.
   *
   * Dùng nhánh lồng để `nestedAccessor` đọc/ghi được, y như `statistic.` của Vụ án.
   */
  legacyExtra: Record<string, string | string[] | boolean>;
}

export const INITIAL_PETITION_FORM: PetitionFormData = {
  stt: "", receivedDate: today(), unit: "", assignedTeamId: "",
  senderName: "", senderBirthYear: "", senderAddress: "", senderPhone: "",
  senderEmail: "", suspectedPerson: "", suspectedAddress: "",
  priority: "", summary: "", detailContent: "", attachmentsNote: "",
  deadline: "", assignedToId: "", canBoDeXuatId: "", notes: "",
  nhanThay: "", deXuat: "", raSoatTrung: "Không", baoCaoBanGiamDoc: false,
  senderIdNumber: "", senderIdIssueDate: "", senderIdIssuePlace: "",
  senderIsAnonymous: false, loaiThongTin: "", soPhieuChuyen: "",
  // Mặc định = ngày tiếp nhận (hôm nay) để khi chấp nhận ngày mặc định vẫn có giá trị.
  ngayPhieuChuyen: "", ngayTiepNhanNguonTin: today(), toiDanhBanDau: "",
  crimeChinhId: "", noiXayRa: "", noiXayRaPhuongXa: "", ngayXayRa: "",
  loaiToiPham: "", phuongThucThuDoan: "", ngayGiaoDonViGiaiQuyet: "",
  laCongNgheCao: false, lanhDaoToTung: "", ketQuaXuLyKhac: "", thoiHanUTDT: "",
  nguonDon: "", petitionDate: "", ngayVietDonEdtf: "", ngayVietDonChu: "", ngayDeXuat: today(), phanLoaiNguonTin: "",
  dieuTraVien: "", donViGiaiQuyet: "",
  huongXuLy: "", thuocThamQuyen: true,
  // Anh chốt 22/09/2026: "Trường hợp báo cáo Ban Giám đốc" mặc định "Không".
  // CHỈ ở đây — trạng thái khởi tạo của chế độ TẠO MỚI. Chế độ SỬA nạp thẳng từ máy chủ
  // (`index.tsx`: `(d.baoCaoBanGiamDocText as string) ?? ""`), nên hồ sơ di trú vẫn mở ra
  // RỖNG và `suyBaoCaoBanGiamDoc` giữ nguyên NULL cho nó.
  baoCaoBanGiamDocText: "Không", tinhTrang: "",
  soQDPhanCongNguonTin: "", ngayQDPhanCongNguonTin: "",
  soQDTamDinhChiNguonTin: "", ngayQDTamDinhChiNguonTin: "",
  canCuTamDinhChiNguonTin: "", soPhucHoiNguonTin: "", ngayPhucHoiNguonTin: "",
  ghiChuKhac: "", phanLoaiToiPhamLinhVuc: "", yeuCauBoSung: "",
  soTienBiThietHai: "", soLuongBiHai: "", sttCu: "",
  legacyExtra: {},
};

/**
 * Trạng thái form của một đơn thư MỚI — ba ô ngày tính LÚC GỌI, không lúc nạp mô-đun.
 *
 * `INITIAL_PETITION_FORM` là hằng mô-đun, nên `today()` trong nó chạy đúng MỘT lần khi trình
 * duyệt nạp tệp. Cán bộ mở tab buổi chiều rồi tạo đơn sáng hôm sau là đơn mang ngày hôm qua —
 * và `useFormDefaults` không cứu được, vì nó chỉ điền khi ô còn RỖNG (`prev.receivedDate ||`).
 *
 * Lượt soát mô hình ngoài 22/09/2026 bắt được qua đường chép đơn; lỗi vốn có sẵn ở cả đường
 * tạo mới thường. Mọi chỗ dựng form trắng phải gọi hàm này, đừng dùng thẳng hằng.
 */
export function taoFormDonThuMoi(): PetitionFormData {
  const homNay = today();
  return {
    ...INITIAL_PETITION_FORM,
    receivedDate: homNay,
    ngayTiepNhanNguonTin: homNay,
    ngayDeXuat: homNay,
    legacyExtra: {},
  };
}
