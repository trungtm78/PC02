import { describe, it, expect, vi } from 'vitest';
import { lamTrongForm } from '../PetitionFormPage/lamTrongForm';

function dung(isEditMode: boolean, dong = true) {
  const diToi = vi.fn();
  const taiLai = vi.fn();
  lamTrongForm({ isEditMode, xacNhan: () => dong, diToi, taiLai });
  return { diToi, taiLai };
}

describe('Làm trống form Đơn thư (F8)', () => {
  it('cán bộ bấm Huỷ ở hộp xác nhận → không làm gì cả', () => {
    const { diToi, taiLai } = dung(false, false);
    expect(diToi).not.toHaveBeenCalled();
    expect(taiLai).not.toHaveBeenCalled();
  });

  it('đang SỬA → sang route tạo mới, KHÔNG tải lại tại chỗ', () => {
    const { diToi, taiLai } = dung(true);
    expect(diToi).toHaveBeenCalledWith('/petitions/new', { state: null });
    expect(taiLai, 'tải lại tại chỗ là ghi đè hồ sơ cũ bằng dữ liệu trắng').not.toHaveBeenCalled();
  });

  /**
   * `window.location.reload()` giữ nguyên history state. Chép đơn xong bấm F8 mà không xoá
   * `state.chepTu` trước thì trang dựng lại đọc đúng mầm ấy — nội dung đơn cũ hiện về nguyên
   * vẹn và nút làm trống không làm trống được gì.
   */
  it('đang TẠO MỚI → xoá mầm chép TRƯỚC rồi mới tải lại', () => {
    const { diToi, taiLai } = dung(false);
    expect(diToi).toHaveBeenCalledWith('.', { replace: true, state: null });
    expect(taiLai).toHaveBeenCalled();
    // Thứ tự là mệnh đề, không phải chi tiết: tải lại trước thì lệnh xoá không bao giờ chạy.
    expect(diToi.mock.invocationCallOrder[0]).toBeLessThan(taiLai.mock.invocationCallOrder[0]);
  });
});
