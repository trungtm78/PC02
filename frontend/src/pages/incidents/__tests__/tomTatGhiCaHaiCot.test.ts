import { describe, it, expect } from 'vitest';
import { buildIncidentPayload } from '../buildIncidentPayload';
import { computeIncidentErrors } from '../validate-incident';
import { INITIAL_INCIDENT_FORM, type IncidentFormData } from '../incident-form.types';

/**
 * Hệ cũ có ĐÚNG MỘT ô nội dung; hệ mới tách đôi thành `name` và `description`.
 *
 * Đo trên máy chạy 27/08/2026: 4.598/4.717 hồ sơ (97,5%) có `name` trùng y hệt `description`
 * — bộ di trú đổ cùng một chữ vào cả hai. Anh chốt giữ MỘT ô như hệ cũ, nên ô ấy phải ghi cả
 * hai cột: ghi một cột thôi thì hai cột trôi khỏi nhau và danh sách hiện một đằng, form hiện
 * một nẻo.
 */
const form = (sua: Partial<IncidentFormData>): IncidentFormData =>
  ({ ...INITIAL_INCIDENT_FORM, ...sua }) as IncidentFormData;

const payload = (sua: Partial<IncidentFormData>) =>
  buildIncidentPayload(form(sua), { isEditMode: true, metaState: {}, parityState: {} });

describe('Ô "Tóm tắt nội dung" ghi cả hai cột', () => {
  it('gõ vào ô tóm tắt thì cả `name` lẫn `description` cùng nhận', () => {
    const p = payload({ description: 'Trộm cắp tài sản tại phường Tây Thạnh' });
    expect(p.description).toBe('Trộm cắp tài sản tại phường Tây Thạnh');
    expect(p.name).toBe('Trộm cắp tài sản tại phường Tây Thạnh');
  });

  /**
   * Hồ sơ cũ có `name` khác `description` (2,5% còn lại) mà cán bộ chưa đụng ô nội dung thì
   * không được im lặng đổi tên hồ sơ của họ.
   */
  it('ô tóm tắt trống thì giữ nguyên `name` đang có', () => {
    const p = payload({ description: '', name: 'Tên riêng do cán bộ đặt' });
    expect(p.name).toBe('Tên riêng do cán bộ đặt');
  });
});

describe('Phép kiểm trỏ vào ô cán bộ nhìn thấy', () => {
  /**
   * Máy chủ đòi `name` ≥5 ký tự, nhưng `name` nay suy từ ô "Tóm tắt nội dung". Báo lỗi về
   * "Tên vụ việc" là chỉ vào một ô không tồn tại trên màn hình — cán bộ không biết sửa ở đâu.
   */
  it('nội dung quá ngắn thì báo về ô Tóm tắt, không phải ô Tên', () => {
    const { msgs, fields } = computeIncidentErrors(form({ description: 'abc' }));
    expect(msgs).toContain('Tóm tắt nội dung phải có ít nhất 5 ký tự');
    expect(fields).toContain('field-description');
    expect(fields).not.toContain('field-name');
  });

  it('nội dung đủ dài thì qua', () => {
    expect(computeIncidentErrors(form({ description: 'Trộm cắp tài sản' })).msgs).toEqual([]);
  });

  /** Hồ sơ cũ chỉ có `name` (ô tóm tắt trống) vẫn phải lưu được, không bị chặn oan. */
  it('chỉ có `name` mà không có `description` thì vẫn qua', () => {
    expect(computeIncidentErrors(form({ description: '', name: 'Vụ trộm xe máy' })).msgs).toEqual(
      [],
    );
  });
});
