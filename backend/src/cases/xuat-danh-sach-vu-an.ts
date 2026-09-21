import type { KhaiCotXuat } from '../common/xuat-danh-sach/xuat-danh-sach';
import { hoTenCanBo, ngayVN } from '../common/xuat-danh-sach/dinh-dang';
import { CASE_STATUS_LABEL } from '../common/constants/status-labels.constants';
import { maHoSoNgan } from '../common/utils/ho-so-code.util';
import { dinhDangDoiTuongBiCan } from './doi-tuong-bi-can';
import type { DongDanhSachVuAn } from './cases.service';

/**
 * Cột xuất Excel của danh sách Vụ án. `key` TRÙNG khoá cột trên `CaseListPageShell` (trừ Thao tác),
 * tiêu đề và cách đọc giống hệt ô trên màn.
 */
export const KHAI_COT_XUAT_VU_AN: readonly KhaiCotXuat<DongDanhSachVuAn>[] = [
  {
    key: 'caseCode',
    tieuDe: 'STT',
    rong: 14,
    // Màn hiện `26-9893`, kèm STT cũ nếu có.
    doc: (d) =>
      d.sttCu?.trim()
        ? `${maHoSoNgan(d.caseCode)} (${d.sttCu.trim()})`
        : maHoSoNgan(d.caseCode),
  },
  {
    key: 'ngayDeXuat',
    tieuDe: 'Ngày đề xuất',
    rong: 13,
    doc: (d) => ngayVN(d.ngayDeXuat),
  },
  {
    key: 'doiTuongBiCan',
    tieuDe: 'Đối tượng bị can',
    rong: 26,
    doc: (d) => dinhDangDoiTuongBiCan(d),
  },
  {
    key: 'nguonDon',
    tieuDe: 'Nguồn đơn/Đơn vị giao',
    rong: 22,
    doc: (d) => d.nguonDon ?? '',
  },
  {
    // Khoá `name` nhưng màn đọc `tenCungCap` — `name` là TÊN VỤ ÁN, khớp bản gốc 0%.
    key: 'name',
    tieuDe: 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
    rong: 26,
    doc: (d) => d.tenCungCap ?? '',
  },
  {
    key: 'moTaChiTiet',
    tieuDe: 'Tóm tắt nội dung',
    rong: 60,
    doc: (d) => d.moTaChiTiet ?? '',
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
    key: 'createdBy',
    tieuDe: 'Người nhập',
    rong: 20,
    doc: (d) => hoTenCanBo(d.createdBy),
  },
  {
    key: 'status',
    tieuDe: 'Trạng thái',
    rong: 18,
    doc: (d) => CASE_STATUS_LABEL[d.status] ?? d.status,
  },
  {
    key: 'investigator',
    tieuDe: 'Điều tra viên',
    rong: 20,
    doc: (d) => hoTenCanBo(d.investigator),
  },
  {
    key: 'crime',
    tieuDe: 'Tội danh',
    rong: 22,
    doc: (d) => d.crime ?? '',
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
      key: 'receiveDate',
      tieuDe: 'Ngày nhận',
      rong: 13,
      doc: (d) => ngayVN(d.receiveDate),
    },
    {
      key: 'ngayPhieuChuyen',
      tieuDe: 'Ngày phiếu chuyển',
      rong: 13,
      doc: (d) => ngayVN(d.ngayPhieuChuyen),
    },
    {
      key: 'ngayKhoiTo',
      tieuDe: 'Ngày khởi tố',
      rong: 13,
      doc: (d) => ngayVN(d.ngayKhoiTo),
    },
    {
      key: 'ngayVietDon',
      tieuDe: 'Ngày viết đơn',
      rong: 13,
      doc: (d) => ngayVN(d.ngayVietDon),
    },
    {
      key: 'ngayCapCccd',
      tieuDe: 'Ngày cấp CCCD',
      rong: 13,
      doc: (d) => ngayVN(d.ngayCapCccd),
    },
];

/**
 * Cột tệp "Vụ án theo phường/xã" (`GET /cases/export/ward`) — GIỮ ĐÚNG các cột tệp này vẫn có trước
 * khi chuyển sang bộ xuất chung (18/09/2026). Cột "STT" số thứ tự do bộ xuất chung tự thêm ở đầu.
 */
export const KHAI_COT_XUAT_VU_AN_PHUONG: readonly KhaiCotXuat<DongDanhSachVuAn>[] =
  [
    {
      key: 'caseCode',
      tieuDe: 'Mã hồ sơ',
      rong: 14,
      doc: (d) => maHoSoNgan(d.caseCode),
    },
    { key: 'name', tieuDe: 'Tên vụ án', rong: 36, doc: (d) => d.name ?? '' },
    {
      key: 'crime',
      tieuDe: 'Tội danh',
      rong: 28,
      // Tội danh chính (danh mục) trước, chưa có thì ô chữ `crime`.
      doc: (d) => d.crimeChinh?.name ?? d.crime ?? '',
    },
    {
      key: 'biCan',
      tieuDe: 'Bị can',
      rong: 28,
      // Định dạng riêng của tệp phường: phần dư ghi "(+N)".
      doc: (d) => {
        const biCan = (d.subjects ?? []).map((s) => s.fullName);
        const du = (d._count?.subjects ?? biCan.length) - biCan.length;
        return biCan.join(', ') + (du > 0 ? ` (+${du})` : '');
      },
    },
    {
      key: 'phuongXa',
      tieuDe: 'Phường/Xã',
      rong: 22,
      doc: (d) => d.assignedTeam?.ward?.name ?? '',
    },
    {
      key: 'investigator',
      tieuDe: 'ĐTV phụ trách',
      rong: 22,
      // Họ + tên, không lùi về tên đăng nhập — như tệp cũ.
      doc: (d) =>
        d.investigator
          ? `${d.investigator.lastName ?? ''} ${d.investigator.firstName ?? ''}`.trim()
          : '',
    },
    {
      key: 'ngayDeXuat',
      tieuDe: 'Ngày đề xuất',
      rong: 14,
      doc: (d) => ngayVN(d.ngayDeXuat),
    },
    {
      key: 'status',
      tieuDe: 'Trạng thái',
      rong: 18,
      doc: (d) => CASE_STATUS_LABEL[d.status] ?? d.status,
    },
  ];
