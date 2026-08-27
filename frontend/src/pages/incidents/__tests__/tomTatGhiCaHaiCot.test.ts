import { describe, it, expect } from 'vitest';
import { buildIncidentPayload } from '../buildIncidentPayload';
import { computeIncidentErrors } from '../validate-incident';
import { INITIAL_INCIDENT_FORM, type IncidentFormData } from '../incident-form.types';
import { INCIDENT_LEGACY_SPEC } from '@/features/incidents/legacy-form-binding';

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

const payload = (sua: Partial<IncidentFormData>, isEditMode = true) =>
  buildIncidentPayload(form(sua), { isEditMode, metaState: {}, parityState: {} });

/** Gõ vào ô "Tóm tắt nội dung" đúng đường form đi qua. */
const goVaoOTomTat = (truoc: Partial<IncidentFormData>, chu: string) =>
  INCIDENT_LEGACY_SPEC.write(form(truoc), 'description', chu);

describe('Ô "Tóm tắt nội dung" ghi cả hai cột', () => {
  it('hồ sơ mới: gõ vào ô tóm tắt thì cả `name` lẫn `description` cùng nhận', () => {
    const sau = goVaoOTomTat({}, 'Trộm cắp tài sản tại phường Tây Thạnh');
    expect(sau.description).toBe('Trộm cắp tài sản tại phường Tây Thạnh');
    expect(sau.name).toBe('Trộm cắp tài sản tại phường Tây Thạnh');
  });

  it('hai cột đang trùng nhau: sửa tóm tắt thì tên đi theo', () => {
    const sau = goVaoOTomTat({ name: 'Vụ trộm xe', description: 'Vụ trộm xe' }, 'Vụ trộm xe máy');
    expect(sau.name).toBe('Vụ trộm xe máy');
    expect(sau.description).toBe('Vụ trộm xe máy');
  });

  /**
   * CA NGUY HIỂM NHẤT — 119 hồ sơ (2,5%) có tên riêng KHÁC tóm tắt. Đè lên nghĩa là cán bộ mở
   * hồ sơ ra, sửa nội dung, và hồ sơ bị đổi tên mà không ai báo. Bản đầu của em ghi
   * `name: description || name` ở tầng payload, tức chỉ MỞ RỒI LƯU cũng đủ đổi tên.
   */
  it('hồ sơ có tên riêng khác tóm tắt: sửa tóm tắt KHÔNG được đổi tên', () => {
    const sau = goVaoOTomTat(
      { name: 'Tên riêng do cán bộ đặt', description: 'Tóm tắt dài dòng' },
      'Tóm tắt đã sửa',
    );
    expect(sau.name).toBe('Tên riêng do cán bộ đặt');
    expect(sau.description).toBe('Tóm tắt đã sửa');
  });

  it('mở hồ sơ có tên riêng rồi lưu, không sửa gì: tên giữ nguyên', () => {
    const p = payload({ name: 'Tên riêng do cán bộ đặt', description: 'Tóm tắt dài dòng' });
    expect(p.name).toBe('Tên riêng do cán bộ đặt');
    expect(p.description).toBe('Tóm tắt dài dòng');
  });

  it('ô tóm tắt trống thì giữ nguyên `name` đang có', () => {
    expect(payload({ description: '', name: 'Tên riêng do cán bộ đặt' }).name).toBe(
      'Tên riêng do cán bộ đặt',
    );
  });
});

describe('Ô hệ cũ chưa có cột phải lưu được ngay từ màn TẠO MỚI', () => {
  /**
   * Form 10 tab hiện đầy đủ ô ngay ở màn tạo mới. Chỉ gửi `metadata` lúc Sửa thì cán bộ gõ
   * vào lúc tạo, bấm Lưu, và mất trắng — đúng lớp lỗi `metadata` codex đã bắt ở Đơn thư.
   */
  it('tạo mới cũng gửi metadata, không chỉ khi sửa', () => {
    const p = payload({ legacyExtra: { soQuyetDinhKhoiTo: '12/QĐ' } }, false);
    expect(p.metadata).toEqual({ soQuyetDinhKhoiTo: '12/QĐ' });
  });

  it('gộp panel động và ô hệ cũ trong tab vào cùng một metadata', () => {
    const p = buildIncidentPayload(form({ legacyExtra: { a: '1' } }), {
      isEditMode: true,
      metaState: { b: '2' },
      parityState: {},
    });
    expect(p.metadata).toEqual({ b: '2', a: '1' });
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
