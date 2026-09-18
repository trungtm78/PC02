import type { KhaiCotXuat } from '../common/xuat-danh-sach/xuat-danh-sach';
import { hoTenCanBo, ngayVN } from '../common/xuat-danh-sach/dinh-dang';
import { INCIDENT_STATUS_LABEL } from '../common/constants/status-labels.constants';
import { maHoSoNgan } from '../common/utils/ho-so-code.util';
import type { DongDanhSachVuViec } from './incidents.service';

/**
 * Cột xuất Excel của danh sách Vụ việc. `key` TRÙNG khoá cột trên `IncidentListPageShell` (trừ cột Thao
 * tác), tiêu đề và cách đọc giống hệt ô trên màn.
 */
export const KHAI_COT_XUAT_VU_VIEC: readonly KhaiCotXuat<DongDanhSachVuViec>[] =
  [
    {
      key: 'code',
      tieuDe: 'STT',
      rong: 14,
      // Màn hiện `26-11171`, kèm STT cũ nếu có.
      doc: (d) =>
        d.sttCu?.trim()
          ? `${maHoSoNgan(d.code)} (${d.sttCu.trim()})`
          : maHoSoNgan(d.code),
    },
    {
      key: 'ngayDeXuat',
      tieuDe: 'Ngày đề xuất',
      rong: 13,
      doc: (d) => ngayVN(d.ngayDeXuat),
    },
    {
      key: 'chuyenTuDonVi',
      tieuDe: 'Nguồn đơn/Đơn vị giao',
      rong: 22,
      doc: (d) => d.chuyenTuDonVi ?? '',
    },
    {
      // Màn đọc `benVu` (tên người cung cấp/bị hại), KHÔNG phải `name`.
      key: 'name',
      tieuDe: 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
      rong: 26,
      doc: (d) => d.benVu ?? '',
    },
    {
      key: 'description',
      tieuDe: 'Tóm tắt nội dung',
      rong: 60,
      doc: (d) => d.description ?? '',
    },
    {
      key: 'donViGiaiQuyet',
      tieuDe: 'Đơn vị giải quyết',
      rong: 22,
      doc: (d) => d.donViGiaiQuyet ?? '',
    },
    {
      key: 'ketQuaXuLy',
      tieuDe: 'Kết quả xử lý, giải quyết khác',
      rong: 28,
      doc: (d) => d.ketQuaXuLy ?? '',
    },
    {
      key: 'canBoNhap',
      tieuDe: 'Người nhập',
      rong: 20,
      doc: (d) => hoTenCanBo(d.canBoNhap),
    },
    {
      key: 'status',
      tieuDe: 'Trạng thái',
      rong: 18,
      doc: (d) => INCIDENT_STATUS_LABEL[d.status] ?? d.status,
    },
    {
      key: 'investigator',
      tieuDe: 'Điều tra viên',
      rong: 22,
      doc: (d) => hoTenCanBo(d.investigator),
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
  ];

/**
 * Cột tệp "Vụ việc theo phường/xã" (`GET /incidents/export/ward`) — GIỮ ĐÚNG các cột tệp này vẫn có
 * trước khi chuyển sang bộ xuất chung (18/09/2026). Cột "STT" số thứ tự do bộ xuất chung tự thêm ở đầu.
 */
export const KHAI_COT_XUAT_VU_VIEC_PHUONG: readonly KhaiCotXuat<DongDanhSachVuViec>[] =
  [
    {
      key: 'code',
      tieuDe: 'Mã hồ sơ',
      rong: 14,
      doc: (d) => maHoSoNgan(d.code),
    },
    { key: 'name', tieuDe: 'Tên vụ việc', rong: 36, doc: (d) => d.name ?? '' },
    {
      key: 'toiDanhChinh',
      tieuDe: 'Tội danh',
      rong: 28,
      doc: (d) => d.crimeChinh?.name ?? '',
    },
    {
      key: 'benVu',
      tieuDe: 'Người cung cấp, bị hại',
      rong: 28,
      doc: (d) => d.benVu ?? '',
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
      doc: (d) => INCIDENT_STATUS_LABEL[d.status] ?? d.status,
    },
  ];
