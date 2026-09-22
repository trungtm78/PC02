/**
 * Tạo một đơn thư MỚI từ nội dung một đơn đang xem.
 *
 * Anh chốt 22/09/2026: "Chép nội dung, đặt lại mốc hồ sơ". Nghe thì đơn giản; chỗ khó là ranh
 * giới giữa hai thứ ấy, và kho mã có hai cái bẫy đo được:
 *
 *  1. Đặt lại `receivedDate` KHÔNG kéo theo `ngayDeXuat`. `petition-data.builder.ts:112` chỉ rơi
 *     về ngày tiếp nhận khi ô ấy RỖNG — chép giá trị cũ lên thì nó thắng, và cột "Ngày đề xuất"
 *     (cột danh sách, cũng là cột bộ lọc theo kỳ) mang ngày của đơn cũ.
 *  2. Đặt lại `receivedDate` KHÔNG kéo theo `deadline`. `petitions.service.ts:695` dùng thẳng
 *     giá trị gửi lên và bỏ qua phép tính hạn theo BLTTHS — đơn "mới" quá hạn từ lúc sinh ra.
 *
 * Nên phân loại bằng danh sách CHO PHÉP, không phải danh sách loại trừ: mọi ô của form phải
 * thuộc đúng một trong hai nhóm dưới đây, và cổng `chepSangDonMoi.gate.test.ts` đỏ khi có ô
 * chưa được ai quyết định. Danh sách loại trừ thì thêm ô mới nào cũng tự động bị chép — im lặng.
 *
 * Ranh giới đã dùng để phân loại, nói một câu: **nội dung của lá đơn và của con người trong đơn
 * thì chép; mọi thứ nói về việc XỬ LÝ chính lá đơn ấy thì đặt lại.**
 */
import { taoFormDonThuMoi, type PetitionFormData } from './types';

/**
 * Nội dung — chép nguyên.
 *
 * Gồm cả `senderIdNumber` và ngày/nơi cấp: số định danh người gửi LÀ nội dung đơn, không phải
 * quyết định xử lý. Cùng một người gửi lá đơn thứ hai thì cán bộ không phải gõ lại CCCD.
 */
export const CHEP_NOI_DUNG = [
  // Người gửi / bị hại
  'senderName', 'senderBirthYear', 'senderAddress', 'senderPhone', 'senderEmail',
  'senderIdNumber', 'senderIdIssueDate', 'senderIdIssuePlace', 'senderIsAnonymous',
  // Đối tượng bị tố
  'suspectedPerson', 'suspectedAddress',
  // Nội dung đơn
  'summary', 'detailContent', 'notes', 'ghiChuKhac',
  // Phân loại vụ việc
  'priority', 'loaiThongTin', 'nguonDon', 'phanLoaiNguonTin', 'phanLoaiToiPhamLinhVuc',
  'toiDanhBanDau', 'crimeChinhId', 'loaiToiPham', 'phuongThucThuDoan', 'laCongNgheCao',
  // Nơi và lúc xảy ra — thuộc về vụ việc, không thuộc về lá đơn
  'noiXayRa', 'noiXayRaPhuongXa', 'ngayXayRa',
  // Thiệt hại
  'soTienBiThietHai', 'soLuongBiHai',
] as const satisfies readonly (keyof PetitionFormData)[];

/**
 * Ô hệ cũ KHÔNG có cột riêng — máy chủ gộp vào `metadata`. MẶC ĐỊNH LÀ ĐẶT LẠI.
 *
 * Bản đầu chép nguyên cả `legacyExtra` vì coi nó là "nội dung". Lượt soát mô hình ngoài
 * 22/09/2026 bác, và phép đo xác nhận: đếm trên `PETITION_LEGACY_LAYOUT` có **137 ô** rơi vào
 * nhánh này, và không ô nào là nội dung lá đơn — toàn quyết định và thống kê của việc xử lý
 * một hồ sơ cụ thể: "Quyết định Không khởi tố", "Nhập vào vụ việc hồ sơ khác", "Số hồ sơ lưu",
 * "Số đối tượng bắt được", "Ngày tổng hợp thống kê".
 *
 * Nên đảo mặc định: cái thùng chứa bị đặt lại TRỌN, ô nào muốn chép phải khai tên ở đây. Khai
 * cả thùng là một dòng, và một dòng ấy kéo theo 137 quyết định không ai đọc.
 *
 * Nay rỗng — đúng nghĩa "không ô nào trong số 137 ô ấy thuộc về lá đơn mới".
 */
export const CHEP_O_HE_CU: readonly string[] = [];

/**
 * Mốc hồ sơ và mọi dấu vết xử lý — đặt lại về giá trị của một đơn mới tinh.
 *
 * Lấy thẳng từ `taoFormDonThuMoi()` chứ không chép tay từng giá trị: "đặt lại" và "đơn mới tạo
 * hôm nay" thành CÙNG MỘT định nghĩa, không thể lệch nhau. Hàm ấy tính ba ô ngày LÚC GỌI — hằng
 * mô-đun thì `today()` đông cứng ở thời điểm trình duyệt nạp tệp.
 */
export const DAT_LAI_MOC_HO_SO = [
  // Định danh hồ sơ
  'stt', 'sttCu',
  /*
    "Đồ vật, tài liệu kèm theo" KIỂM ĐẾM hiện vật đi kèm CHÍNH lá đơn cũ ("USB 8GB, CCCD
    photo"). Đơn mới chưa nhận hiện vật nào, mà ô đã bị bỏ khỏi form (22/09/2026) nên cán bộ
    cũng không xoá được thứ mình không nhìn thấy — chép sang là một bản kê khai sai, in thẳng
    ra chứng từ qua `field-catalog.ts:714`.
  */
  'attachmentsNote',
  // Mốc thời gian của chính lá đơn này
  'receivedDate', 'ngayDeXuat', 'ngayTiepNhanNguonTin', 'deadline', 'thoiHanUTDT',
  'petitionDate', 'ngayVietDonEdtf', 'ngayVietDonChu',
  // Phân công
  'unit', 'assignedTeamId', 'assignedToId', 'canBoDeXuatId', 'dieuTraVien',
  'donViGiaiQuyet', 'lanhDaoToTung', 'huongXuLy', 'thuocThamQuyen',
  // Ý kiến và kết quả xử lý
  'nhanThay', 'deXuat', 'yeuCauBoSung', 'ketQuaXuLyKhac', 'tinhTrang',
  'raSoatTrung', 'baoCaoBanGiamDoc', 'baoCaoBanGiamDocText',
  // Phiếu chuyển / giao đơn vị
  'soPhieuChuyen', 'ngayPhieuChuyen', 'ngayGiaoDonViGiaiQuyet',
  // Quyết định nguồn tin
  'soQDPhanCongNguonTin', 'ngayQDPhanCongNguonTin',
  'soQDTamDinhChiNguonTin', 'ngayQDTamDinhChiNguonTin', 'canCuTamDinhChiNguonTin',
  'soPhucHoiNguonTin', 'ngayPhucHoiNguonTin',
  // Thùng chứa ô hệ cũ: đặt lại TRỌN, trừ những khoá khai ở `CHEP_O_HE_CU` bên dưới.
  'legacyExtra',
] as const satisfies readonly (keyof PetitionFormData)[];

/**
 * Hàm THUẦN: dựng trạng thái form của đơn mới từ đơn đang xem.
 *
 * Không đụng tới hồ sơ nguồn, và `legacyExtra` được nhân bản nông — dùng chung tham chiếu thì
 * cán bộ sửa đơn mới là sửa luôn đơn cũ đang hiển thị trên màn.
 */
export function chepSangDonMoi(nguon: PetitionFormData): PetitionFormData {
  const moi: PetitionFormData = taoFormDonThuMoi();
  for (const k of CHEP_NOI_DUNG) {
    // Phép gán qua khoá động: TypeScript không hẹp được `moi[k]` và `nguon[k]` về cùng một
    // kiểu khi `k` là hợp của nhiều khoá. `Object.assign` giữ nguyên phép kiểm kiểu ở hai đầu
    // (khoá phải thuộc `PetitionFormData`, giá trị lấy thẳng từ một `PetitionFormData`) mà
    // không phải ép kiểu — ép kiểu ở đây là mở đường cho một khoá sai lọt qua.
    Object.assign(moi, { [k]: nguon[k] });
  }
  const oHeCuChep: PetitionFormData['legacyExtra'] = {};
  for (const k of CHEP_O_HE_CU)
    if (k in nguon.legacyExtra) oHeCuChep[k] = nguon.legacyExtra[k];
  moi.legacyExtra = oHeCuChep;
  return moi;
}
