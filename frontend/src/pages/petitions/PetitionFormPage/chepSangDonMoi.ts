/**
 * Tạo một đơn thư MỚI từ nội dung một đơn đang xem.
 *
 * Quy tắc chốt ngày 29/09/2026: sao chép mọi giá trị người dùng nhập, kể cả chuỗi rỗng,
 * Nhận xét, Ngày viết đơn, kết quả xử lý và các ô hệ cũ. Chỉ định danh, phân công và xác nhận
 * rà trùng của hồ sơ nguồn được đặt lại. Tệp đính kèm không nằm trong trạng thái form này.
 *
 * Hai danh sách bên dưới là hợp đồng tường minh. Cổng kiểm thử buộc mọi trường của form thuộc
 * đúng một nhóm, nên thêm trường mới sẽ phải quyết định trước khi có thể phát hành.
 */
import { taoFormDonThuMoi, type PetitionFormData } from './types';
import { cloneUserMetadata } from '@/shared/legacy/cloneMetadata';

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
  // Thời gian và dữ liệu nghiệp vụ do người dùng nhập
  'receivedDate', 'ngayDeXuat', 'ngayTiepNhanNguonTin', 'deadline', 'thoiHanUTDT',
  'petitionDate', 'ngayVietDonEdtf', 'ngayVietDonChu',
  'attachmentsNote', 'unit', 'donViGiaiQuyet', 'lanhDaoToTung', 'huongXuLy',
  'thuocThamQuyen', 'nhanThay', 'deXuat', 'yeuCauBoSung', 'ketQuaXuLyKhac',
  'tinhTrang', 'baoCaoBanGiamDoc', 'baoCaoBanGiamDocText',
  'soPhieuChuyen', 'ngayPhieuChuyen', 'ngayGiaoDonViGiaiQuyet',
  'soQDPhanCongNguonTin', 'ngayQDPhanCongNguonTin',
  'soQDTamDinhChiNguonTin', 'ngayQDTamDinhChiNguonTin', 'canCuTamDinhChiNguonTin',
  'soPhucHoiNguonTin', 'ngayPhucHoiNguonTin',
  // Toàn bộ ô người dùng nhập trong 10 tab hệ cũ
  'legacyExtra',
] as const satisfies readonly (keyof PetitionFormData)[];

/**
 * Chỉ các trường do hệ thống quản lý hoặc cần quyết định lại trên hồ sơ mới.
 * Giá trị đặt lại lấy từ `taoFormDonThuMoi()` để dùng chung một định nghĩa với form tạo thường.
 */
export const DAT_LAI_MOC_HO_SO = [
  // Định danh hồ sơ
  'stt', 'sttCu',
  // Phân công
  'assignedTeamId', 'assignedToId', 'canBoDeXuatId', 'dieuTraVien',
  // Xác nhận rà trùng phải được thực hiện lại cho hồ sơ mới
  'raSoatTrung',
] as const satisfies readonly (keyof PetitionFormData)[];

/**
 * Hàm THUẦN: dựng trạng thái form của đơn mới từ đơn đang xem.
 *
 * Không đụng tới hồ sơ nguồn, và `legacyExtra` được nhân bản sâu — dùng chung tham chiếu thì
 * cán bộ sửa đơn mới là sửa luôn đơn cũ đang hiển thị trên màn.
 */
export function chepSangDonMoi(nguon: PetitionFormData): PetitionFormData {
  const moi: PetitionFormData = taoFormDonThuMoi();
  for (const k of CHEP_NOI_DUNG) {
    // Phép gán qua khoá động: TypeScript không hẹp được `moi[k]` và `nguon[k]` về cùng một
    // kiểu khi `k` là hợp của nhiều khoá. `Object.assign` giữ nguyên phép kiểm kiểu ở hai đầu
    // (khoá phải thuộc `PetitionFormData`, giá trị lấy thẳng từ một `PetitionFormData`) mà
    // không phải ép kiểu — ép kiểu ở đây là mở đường cho một khoá sai lọt qua.
    Object.assign(moi, {
      [k]: k === 'legacyExtra' ? cloneUserMetadata(nguon.legacyExtra) : nguon[k],
    });
  }
  return moi;
}
