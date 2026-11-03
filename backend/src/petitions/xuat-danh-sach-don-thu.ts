import type { KhaiCotXuat } from '../common/xuat-danh-sach/xuat-danh-sach';
import { hoTenCanBo, ngayVN, soVN } from '../common/xuat-danh-sach/dinh-dang';
import {
  HUONG_XU_LY_LABEL,
  PETITION_STATUS_LABEL,
} from '../common/constants/status-labels.constants';
import { maHoSoNgan } from '../common/utils/ho-so-code.util';
import { ngayVietDonHienThi } from '../common/utils/ngay-viet-don.util';
import { LOAI_DON_LABEL_BE } from './petitions.constants';
import type { DongDanhSachDonThu } from './petitions.service';

/**
 * A string stored under `key` in the petition `metadata` JSON, or '' when the JSON is missing, not an object, or the
 * value is not a string. Never throws: one malformed JSON must not fail a whole export.
 */
export function chuoiMetadata(metadata: unknown, key: string): string {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return '';
  }
  const v = (metadata as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
}

/**
 * Cột xuất Excel của danh sách Đơn thư. `key` TRÙNG khoá cột trên `PetitionListPageShell` (cổng
 * `khaiCotXuat.gate` kiểm), tiêu đề và cách đọc giống hệt ô trên màn.
 */
export const KHAI_COT_XUAT_DON_THU: readonly KhaiCotXuat<DongDanhSachDonThu>[] =
  [
    {
      key: 'stt',
      tieuDe: 'STT hồ sơ',
      rong: 14,
      // Màn hiện `26-11171`, kèm STT cũ nếu có.
      doc: (d) =>
        d.sttCu ? `${maHoSoNgan(d.stt)} (${d.sttCu})` : maHoSoNgan(d.stt),
    },
    {
      key: 'ngayDeXuat',
      tieuDe: 'Ngày đề xuất',
      rong: 13,
      doc: (d) => ngayVN(d.ngayDeXuat),
    },
    {
      key: 'loaiThongTin',
      tieuDe: 'Loại thông tin',
      rong: 18,
      doc: (d) => d.loaiThongTin ?? '',
    },
    {
      key: 'nguonDon',
      tieuDe: 'Nguồn đơn/Đơn vị giao',
      rong: 22,
      doc: (d) => d.nguonDon ?? '',
    },
    {
      key: 'senderName',
      tieuDe: 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
      rong: 26,
      doc: (d) => d.senderName ?? '',
    },
    {
      key: 'detailContent',
      tieuDe: 'Tóm tắt nội dung',
      rong: 60,
      doc: (d) => d.detailContent ?? '',
    },
    {
      key: 'donViGiaiQuyet',
      tieuDe: 'Đơn vị giải quyết',
      rong: 22,
      doc: (d) => d.donViGiaiQuyet ?? '',
    },
    {
      key: 'ketQuaXuLyKhac',
      tieuDe: 'Kết quả xử lý, giải quyết khác',
      rong: 28,
      doc: (d) => d.ketQuaXuLyKhac ?? '',
    },
    {
      key: 'enteredBy',
      tieuDe: 'Người nhập',
      rong: 20,
      doc: (d) => hoTenCanBo(d.enteredBy),
    },
    {
      key: 'status',
      tieuDe: 'Trạng thái',
      rong: 18,
      doc: (d) => PETITION_STATUS_LABEL[d.status] ?? d.status,
    },
    {
      key: 'suspectedPerson',
      tieuDe: 'Đối tượng bị tố',
      rong: 22,
      doc: (d) => d.suspectedPerson ?? '',
    },
    {
      key: 'deadline',
      tieuDe: 'Hạn xử lý',
      rong: 13,
      doc: (d) => ngayVN(d.deadline),
    },
    {
      key: 'createdAt',
      tieuDe: 'Ngày tạo',
      rong: 13,
      doc: (d) => ngayVN(d.createdAt),
    },
    /*
      Cột ngày mở cho tìm kiếm 21/09/2026 — cột nào hiện được trên bảng thì cũng phải xuất
      được, nếu không cán bộ lọc ra rồi xuất lại mất đúng cột vừa lọc.
    */
    {
      key: 'receivedDate',
      tieuDe: 'Ngày tiếp nhận',
      rong: 17,
      // Màn hiện giờ nhỏ dưới ngày; bản xuất ghi "dd/mm/yyyy HH:mm" để lọc ra rồi xuất không mất giờ. Hồ sơ cũ (không có giờ)
      // chỉ có ngày — không bịa giờ.
      doc: (d) =>
        d.gioTiepNhan
          ? `${ngayVN(d.receivedDate)} ${d.gioTiepNhan}`
          : ngayVN(d.receivedDate),
    },
    {
      key: 'ngayTiepNhanNguonTin',
      tieuDe: 'Ngày tiếp nhận nguồn tin',
      rong: 13,
      doc: (d) => ngayVN(d.ngayTiepNhanNguonTin),
    },
    {
      key: 'petitionDate',
      tieuDe: 'Ngày viết đơn',
      rong: 13,
      /*
        `ngayVietDonHienThi`, KHÔNG phải `ngayVN(d.petitionDate)`.

        ~4.400 đơn chỉ có ngày THIẾU thành phần: `petitionDate` NULL, chữ nằm ở
        `ngayVietDonEdtf` (`2026-12-XX`). Đọc thẳng cột ngày thật thì cán bộ lọc theo Ngày viết
        đơn rồi bấm Xuất sẽ nhận một tệp trống trơn ĐÚNG cột vừa lọc — tệp trông bình thường,
        không lỗi, không cảnh báo.
      */
      doc: (d) => ngayVietDonHienThi(d),
    },
    {
      key: 'ngayGiaoDonViGiaiQuyet',
      tieuDe: 'Ngày giao đơn vị giải quyết',
      rong: 13,
      doc: (d) => ngayVN(d.ngayGiaoDonViGiaiQuyet),
    },
    {
      key: 'ngayPhieuChuyen',
      tieuDe: 'Ngày phiếu chuyển',
      rong: 13,
      doc: (d) => ngayVN(d.ngayPhieuChuyen),
    },
    {
      key: 'senderIdIssueDate',
      tieuDe: 'Ngày cấp CCCD',
      rong: 13,
      doc: (d) => ngayVN(d.senderIdIssueDate),
    },
    /*
      Every other form field that holds data (03/11/2026). Same rule as the date columns above: a column the list can
      show must be exportable, otherwise the officer filters, exports, and loses exactly the column just filtered.
    */
    {
      key: 'soPhieuChuyen',
      tieuDe: 'Số phiếu chuyển/ Công văn/ Ủy thác điều tra',
      rong: 22,
      doc: (d) => d.soPhieuChuyen ?? '',
    },
    { key: 'nhanThay', tieuDe: 'Nhận xét', rong: 50, doc: (d) => d.nhanThay ?? '' },
    {
      key: 'deXuat',
      tieuDe: 'Đề xuất xử lý',
      rong: 40,
      doc: (d) => d.deXuat ?? '',
    },
    {
      key: 'huongXuLy',
      tieuDe: 'Hướng xử lý',
      rong: 16,
      doc: (d) => (d.huongXuLy ? HUONG_XU_LY_LABEL[d.huongXuLy] : ''),
    },
    {
      key: 'raSoatTrung',
      tieuDe: 'Ghi chú trùng đơn',
      rong: 26,
      doc: (d) => d.raSoatTrung ?? '',
    },
    {
      key: 'baoCaoBanGiamDocText',
      tieuDe: 'Trường hợp báo cáo Ban Giám đốc',
      rong: 26,
      doc: (d) => d.baoCaoBanGiamDocText ?? '',
    },
    {
      key: 'ghiChuKhac',
      tieuDe: 'Ghi chú khác',
      rong: 30,
      doc: (d) => d.ghiChuKhac ?? '',
    },
    {
      key: 'phuongThucThuDoan',
      tieuDe: 'Phương thức thủ đoạn',
      rong: 30,
      doc: (d) => d.phuongThucThuDoan ?? '',
    },
    {
      key: 'phanLoaiNguonTin',
      tieuDe: 'Phân loại ban đầu',
      rong: 20,
      doc: (d) => d.phanLoaiNguonTin ?? '',
    },
    {
      key: 'laCongNgheCao',
      tieuDe: 'Tội phạm công nghệ cao',
      rong: 14,
      doc: (d) =>
        d.laCongNgheCao === null || d.laCongNgheCao === undefined
          ? ''
          : d.laCongNgheCao
            ? 'Có'
            : 'Không',
    },
    {
      key: 'dieuTraVien',
      tieuDe: 'Điều tra viên thụ lý',
      rong: 22,
      doc: (d) => d.dieuTraVien ?? '',
    },
    {
      key: 'senderPhone',
      tieuDe: 'Số điện thoại nguyên đơn',
      rong: 16,
      doc: (d) => d.senderPhone ?? '',
    },
    {
      key: 'senderBirthYear',
      tieuDe: 'Sinh năm',
      rong: 10,
      doc: (d) => d.senderBirthYear ?? '',
    },
    {
      key: 'senderIdNumber',
      tieuDe: 'Số căn cước công dân',
      rong: 16,
      doc: (d) => d.senderIdNumber ?? '',
    },
    {
      key: 'senderIdIssuePlace',
      tieuDe: 'Nơi cấp CCCD',
      rong: 20,
      doc: (d) => d.senderIdIssuePlace ?? '',
    },
    {
      key: 'senderAddress',
      tieuDe: 'Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại',
      rong: 36,
      doc: (d) => d.senderAddress ?? '',
    },
    {
      key: 'soQDPhanCongNguonTin',
      tieuDe: 'Quyết định phân công giải quyết nguồn tin tội phạm',
      rong: 26,
      doc: (d) => d.soQDPhanCongNguonTin ?? '',
    },
    {
      key: 'ngayQDPhanCongNguonTin',
      tieuDe: 'Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm',
      rong: 16,
      doc: (d) => ngayVN(d.ngayQDPhanCongNguonTin),
    },
    {
      key: 'soQDTamDinhChiNguonTin',
      tieuDe: 'Quyết định Tạm đình chỉ nguồn tin',
      rong: 24,
      doc: (d) => d.soQDTamDinhChiNguonTin ?? '',
    },
    {
      key: 'ngayQDTamDinhChiNguonTin',
      tieuDe: 'Ngày ra Quyết định Tạm đình chỉ nguồn tin',
      rong: 16,
      doc: (d) => ngayVN(d.ngayQDTamDinhChiNguonTin),
    },
    {
      key: 'canCuTamDinhChiNguonTin',
      tieuDe: 'Căn cứ Tạm đình chỉ nguồn tin',
      rong: 30,
      doc: (d) => d.canCuTamDinhChiNguonTin ?? '',
    },
    {
      key: 'soPhucHoiNguonTin',
      tieuDe: 'Số Phục hồi nguồn tin tội phạm',
      rong: 22,
      doc: (d) => d.soPhucHoiNguonTin ?? '',
    },
    {
      key: 'ngayPhucHoiNguonTin',
      tieuDe: 'Ngày Phục hồi nguồn tin tội phạm',
      rong: 16,
      doc: (d) => ngayVN(d.ngayPhucHoiNguonTin),
    },
    {
      key: 'thoiHanUTDT',
      tieuDe: 'Thời hạn thực hiện Uỷ thác điều tra',
      rong: 16,
      doc: (d) => ngayVN(d.thoiHanUTDT),
    },
    {
      key: 'crimeChinh',
      tieuDe: 'Tội danh chính - BLHS 2015 (nhận định ban đầu)',
      rong: 30,
      doc: (d) => d.crimeChinh?.name ?? '',
    },
    {
      key: 'soTienBiThietHai',
      tieuDe: 'Số tiền bị thiệt hại (triệu Việt nam Đồng)',
      rong: 18,
      doc: (d) => soVN(d.soTienBiThietHai),
    },
    {
      key: 'soLuongBiHai',
      tieuDe: 'Số lượng người bị hại',
      rong: 14,
      doc: (d) => soVN(d.soLuongBiHai),
    },
    // The three prosecution fields live in `metadata` JSON (no column of their own).
    {
      key: 'soQuyetDinhKhoiTo',
      tieuDe: 'Số Quyết định Khởi tố vụ án',
      rong: 22,
      doc: (d) => chuoiMetadata(d.metadata, 'soQuyetDinhKhoiTo'),
    },
    {
      key: 'ngayKhoiTo',
      tieuDe: 'Ngày ra Quyết định Khởi tố vụ án',
      rong: 16,
      doc: (d) => ngayVN(chuoiMetadata(d.metadata, 'ngayKhoiTo') || null),
    },
    {
      key: 'toiDanhChinhKhoiTo',
      tieuDe: 'Tội danh chính khi khởi tố',
      rong: 30,
      // `metadata` holds only the crime ID; the name is resolved per page by `gonTenToiDanhKhoiTo`.
      doc: (d) => d.toiDanhChinhKhoiToTen ?? '',
    },
  ];

/**
 * Cột tệp "Đơn thư theo phường/xã" (`GET /petitions/export/ward`) — GIỮ ĐÚNG các cột tệp này vẫn có
 * trước khi chuyển sang bộ xuất chung (18/09/2026).
 */
export const KHAI_COT_XUAT_DON_THU_PHUONG: readonly KhaiCotXuat<DongDanhSachDonThu>[] =
  [
    { key: 'stt', tieuDe: 'Số đơn', rong: 18, doc: (d) => maHoSoNgan(d.stt) },
    {
      key: 'senderName',
      tieuDe: 'Người gửi',
      rong: 22,
      doc: (d) => d.senderName ?? '',
    },
    {
      key: 'petitionType',
      tieuDe: 'Loại đơn',
      rong: 16,
      doc: (d) =>
        d.petitionType
          ? (LOAI_DON_LABEL_BE[d.petitionType] ?? d.petitionType)
          : '',
    },
    {
      key: 'detailContent',
      tieuDe: 'Tóm tắt',
      rong: 40,
      // Cùng cột "Tóm tắt" trên màn (`detailContent`); đơn chưa có thì lùi bản rút gọn.
      doc: (d) => d.detailContent ?? d.summary ?? '',
    },
    {
      key: 'phuongXa',
      tieuDe: 'Phường/Xã',
      rong: 18,
      doc: (d) => d.assignedTeam?.ward?.name ?? '',
    },
    {
      key: 'ngayDeXuat',
      tieuDe: 'Ngày đề xuất',
      rong: 16,
      doc: (d) => ngayVN(d.ngayDeXuat),
    },
    {
      key: 'status',
      tieuDe: 'Trạng thái',
      rong: 22,
      doc: (d) => PETITION_STATUS_LABEL[d.status] ?? d.status,
    },
  ];
