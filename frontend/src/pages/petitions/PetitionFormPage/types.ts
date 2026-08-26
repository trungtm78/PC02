/**
 * Kiểu dữ liệu form Đơn thư.
 *
 * Tách khỏi `PetitionFormPage.tsx` để `buildPetitionPayload` và ca kiểm dùng được mà không
 * phải nạp cả trang 1.287 dòng. Nội dung giữ nguyên từ `interface FormData` cũ — chỉ đổi chỗ.
 */

import { today } from '@/lib/dates';

export interface PetitionFormData {
  stt: string; receivedDate: string; unit: string; assignedTeamId: string;
  senderName: string;
  senderBirthYear: string; senderAddress: string; senderPhone: string;
  senderEmail: string; suspectedPerson: string; suspectedAddress: string;
  petitionType: string; priority: string; summary: string;
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
  ngayDeXuat: string;
  phanLoaiNguonTin: string;
  dieuTraVien: string;
  donViGiaiQuyet: string;
  // Thẩm quyền & đơn vị xử lý
  thuocThamQuyen: boolean;
  donViXuLy: string;
}

export const INITIAL_PETITION_FORM: PetitionFormData = {
  stt: "", receivedDate: today(), unit: "", assignedTeamId: "",
  senderName: "", senderBirthYear: "", senderAddress: "", senderPhone: "",
  senderEmail: "", suspectedPerson: "", suspectedAddress: "", petitionType: "",
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
  nguonDon: "", petitionDate: "", ngayDeXuat: today(), phanLoaiNguonTin: "",
  dieuTraVien: "", donViGiaiQuyet: "",
  thuocThamQuyen: true, donViXuLy: "",
};
