import type { PetitionStatus } from '@prisma/client';
import type { KhaiCotXuat } from '../common/xuat-danh-sach/xuat-danh-sach';
import { hoTenCanBo, ngayVN } from '../common/xuat-danh-sach/dinh-dang';
import { PETITION_STATUS_LABEL } from '../common/constants/status-labels.constants';
import { maHoSoNgan } from '../common/utils/ho-so-code.util';
import type { DongDanhSachDonThu } from './petitions.service';

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
      doc: (d) => PETITION_STATUS_LABEL[d.status as PetitionStatus] ?? d.status,
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
  ];
