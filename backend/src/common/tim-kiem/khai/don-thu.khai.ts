import { PetitionStatus } from '@prisma/client';
import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';
import { PETITION_STATUS_LABEL } from '../../constants/status-labels.constants';

/**
 * Khai trường tìm được của danh sách Đơn thư — NGUỒN DUY NHẤT cho: cột bóng + trigger + chỉ mục
 * (migration sinh ra), field Prisma, và danh sách khoá thẻ phía giao diện (`generated.ts`).
 *
 * Thứ tự = thứ tự cột trên màn danh sách (`PetitionListPageShell.tsx`), để gợi ý thẻ xếp đúng
 * như cán bộ nhìn thấy. Khoá dùng tên CHUẨN liên thực thể (`nguoiGui`, `tomTat`, `donViGiaiQuyet`…)
 * — màn Tổng hợp gửi cùng một khoá tới cả ba API.
 *
 * Thêm một cột tìm được = thêm một dòng ở đây rồi chạy `npm run gen:tim-kiem`; cổng
 * `tim-kiem-sinh-khop.gate.spec.ts` đỏ nếu quên chạy.
 */
export const KHAI_TIM_KIEM_DON_THU: KhaiThucThe = {
  thucThe: 'don-thu',
  bang: 'petitions',
  model: 'Petition',
  truong: [
    { key: 'stt', nhan: 'STT', kieu: 'ma', cot: 'stt' },
    { key: 'sttCu', nhan: 'STT cũ', kieu: 'ma-cu', cot: 'sttCu' },
    {
      key: 'ngayDeXuat',
      nhan: 'Ngày đề xuất',
      kieu: 'ngay',
      cot: 'ngayDeXuat',
    },
    {
      key: 'nguonDon',
      nhan: 'Nguồn đơn/Đơn vị giao',
      kieu: 'chu',
      cot: 'nguonDon',
    },
    {
      key: 'nguoiGui',
      nhan: 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
      kieu: 'chu',
      cot: 'senderName',
    },
    {
      key: 'tomTat',
      nhan: 'Tóm tắt nội dung',
      kieu: 'chu',
      cot: 'detailContent',
    },
    {
      key: 'donViGiaiQuyet',
      nhan: 'Đơn vị giải quyết',
      kieu: 'chu',
      cot: 'donViGiaiQuyet',
    },
    {
      key: 'ketQuaXuLyKhac',
      nhan: 'Kết quả xử lý, giải quyết khác',
      kieu: 'chu',
      cot: 'ketQuaXuLyKhac',
    },
    {
      key: 'nguoiNhap',
      nhan: 'Người nhập',
      kieu: 'nguoi',
      quanHe: 'enteredBy',
    },
    {
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'status',
      // Mã trạng thái lạ → 400; để lọt tới Prisma là 500 vì giá trị enum không hợp lệ.
      giaTriHopLe: Object.values(PetitionStatus),
      // Nhãn tiếng Việt cho dòng "tất cả các cột": gõ "đang xử lý" phải ra đúng nhóm hồ sơ ấy.
      // Lấy từ hằng số nhãn dùng chung — chép sang đây là hai bản sẽ trôi khỏi nhau.
      nhanGiaTri: PETITION_STATUS_LABEL,
    },
    {
      key: 'doiTuong',
      nhan: 'Đối tượng bị tố',
      kieu: 'chu',
      cot: 'suspectedPerson',
    },
    // Cột `deadline` RỖNG SẠCH trên dữ liệu thật (đo 21/09/2026: 0/46.741) nên thẻ này hiện
    // khớp 0 hồ sơ. GIỮ vì gỡ khoá thẻ là vỡ đường dẫn đã lưu, và hạn tự tính sẽ điền cột ấy.
    /* Hạn xử lý là ngày TƯƠNG LAI phải làm xong, không phải ngày của sự việc: gõ một ngày mà ra hồ sơ "đến hạn hôm ấy" là kết quả không ai hỏi. Thẻ riêng vẫn lọc được. */
    { key: 'hanXuLy', nhan: 'Hạn xử lý', kieu: 'ngay', cot: 'deadline', vaoTatCa: false },
    /* 45.459 hồ sơ di trú mang CÙNG một `createdAt` (ngày chạy di trú) — để trong `*` là gõ đúng tháng ấy trả về cả kho. */
    { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay', cot: 'createdAt', vaoTatCa: false },
    /*
      Sáu cột ngày ĐẦY DỮ LIỆU mà trước 21/09/2026 không tìm được — đo trên 46.741 đơn thật:
      Ngày tiếp nhận 46.741 · Ngày tiếp nhận nguồn tin 44.367 · Ngày viết đơn 41.820 ·
      Ngày giao đơn vị 25.386 · Ngày phiếu chuyển 9.315 · Ngày cấp CCCD 2.168.

      Mỗi khoá kèm một cột `optional: 'hide'` trên `PetitionListPageShell` để cổng
      `timKiemCotKhai` vẫn xanh MÀ KHÔNG BỊ NỚI, và cán bộ bật được cột để nhìn thấy đúng thứ
      mình vừa tìm.
    */
    {
      key: 'ngayTiepNhan',
      nhan: 'Ngày tiếp nhận',
      kieu: 'ngay',
      cot: 'receivedDate',
    },
    {
      key: 'ngayTiepNhanNguonTin',
      nhan: 'Ngày tiếp nhận nguồn tin',
      kieu: 'ngay',
      cot: 'ngayTiepNhanNguonTin',
    },
    {
      key: 'ngayVietDon',
      nhan: 'Ngày viết đơn',
      kieu: 'ngay',
      cot: 'petitionDate',
      // ~4.4k đơn chỉ có ngày THIẾU thành phần (`2026-12-XX`), cột ngày thật rỗng.
      cotEdtf: 'ngayVietDonEdtf',
    },
    {
      key: 'ngayGiaoDonViGiaiQuyet',
      nhan: 'Ngày giao đơn vị giải quyết',
      kieu: 'ngay',
      cot: 'ngayGiaoDonViGiaiQuyet',
    },
    {
      key: 'ngayPhieuChuyen',
      nhan: 'Ngày phiếu chuyển',
      kieu: 'ngay',
      cot: 'ngayPhieuChuyen',
    },
    {
      key: 'ngayCapCCCD',
      nhan: 'Ngày cấp CCCD',
      kieu: 'ngay',
      cot: 'senderIdIssueDate',
    },
  ],
  // Không phải cột trên danh sách nhưng thẻ "tất cả các cột" phải tìm được: số hồ sơ hệ cũ để
  // truy nguyên (ô tìm cũ vẫn tìm cột này).
  cotThemVaoTatCa: ['soHoSoCu'],
};
