import { describe, it, expect } from 'vitest';
import { mergeCaseApiToFormData } from '../mergeCaseApiToFormData';
import { buildCreateCasePayload } from '../buildCreateCasePayload';
import { INITIAL_FORM_DATA } from '../types';

/**
 * Mở một hồ sơ DI TRÚ ra rồi bấm Lưu — không sửa gì — thì mọi giá trị phải còn nguyên.
 *
 * Đây là lớp hỏng mà ba epic vừa rồi lần nào bấm tay trên máy thật cũng lộ, còn ca kiểm thì
 * không: form nạp ô từ cột A, payload gửi ô ấy vào cột B. Ô nạp rỗng, payload luôn gửi, máy
 * chủ ghi đè — mất dữ liệu trong đúng một lần bấm, không một thông báo nào.
 *
 * Ngày 27/08/2026 chuyện ấy suýt xảy ra với 3.286 vụ án: ô "Đơn vị giải quyết" chuyển sang
 * ghi `donViGiaiQuyet`, nhưng đường ĐỌC vẫn nạp từ `unit` — cột rỗng ở mọi hồ sơ di trú.
 *
 * Hình dạng dữ liệu dưới đây chụp từ MÁY THẬT (vụ án 2026-11139, đơn thư 2026-3696): cả hai
 * đều có `donViGiaiQuyet: "Đội 4"` và `unit: null`.
 */
const VU_AN_DI_TRU = {
  id: 'cmp-vu-an-that',
  caseCode: '2026-11139',
  name: 'Vụ án di trú từ hệ cũ',
  donViGiaiQuyet: 'Đội 4',
  unit: null,
  legacySourceId: 'VA-legacy-11139',
} as unknown as Parameters<typeof mergeCaseApiToFormData>[0];

describe('Mở hồ sơ di trú rồi Lưu — không sửa gì thì không mất gì', () => {
  it('ô "Đơn vị giải quyết" nạp từ `donViGiaiQuyet`, không nạp từ cột rỗng `unit`', () => {
    const form = mergeCaseApiToFormData(VU_AN_DI_TRU, INITIAL_FORM_DATA);
    expect(form.supervisingUnit).toBe('Đội 4');
  });

  it('lưu lại thì gửi đúng giá trị cũ, không gửi rỗng đè lên', () => {
    const form = mergeCaseApiToFormData(VU_AN_DI_TRU, INITIAL_FORM_DATA);
    const payload = buildCreateCasePayload(form) as Record<string, unknown>;
    expect(payload['donViGiaiQuyet']).toBe('Đội 4');
  });

  /** Cán bộ xoá trắng ô thì PHẢI xoá thật — gửi `null` chứ không phải bỏ khoá đi. */
  it('cán bộ xoá trắng ô thì gửi null để máy chủ xoá thật', () => {
    const form = { ...mergeCaseApiToFormData(VU_AN_DI_TRU, INITIAL_FORM_DATA), supervisingUnit: '' };
    const payload = buildCreateCasePayload(form) as Record<string, unknown>;
    expect(payload['donViGiaiQuyet']).toBeNull();
  });
});
