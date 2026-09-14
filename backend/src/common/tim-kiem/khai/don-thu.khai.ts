import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

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
    { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon', cot: 'status' },
    {
      key: 'doiTuong',
      nhan: 'Đối tượng bị tố',
      kieu: 'chu',
      cot: 'suspectedPerson',
    },
    { key: 'hanXuLy', nhan: 'Hạn xử lý', kieu: 'ngay', cot: 'deadline' },
    { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay', cot: 'createdAt' },
  ],
  // Không phải cột trên danh sách nhưng thẻ "tất cả các cột" phải tìm được: số hồ sơ hệ cũ để
  // truy nguyên (ô tìm cũ vẫn tìm cột này).
  cotThemVaoTatCa: ['soHoSoCu'],
};
