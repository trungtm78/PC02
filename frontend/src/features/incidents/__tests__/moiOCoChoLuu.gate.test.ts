import { describe, it, expect } from 'vitest';
import { LEGACY_FORM_LAYOUT, type CaseFieldPath } from '@/features/cases/legacy-form-layout.def';
import {
  INCIDENT_LEGACY_LAYOUT,
  INCIDENT_LEGACY_SPEC,
  KHOA_NHANH_PHU,
  dichLuu,
} from '../legacy-form-binding';
import { INITIAL_INCIDENT_FORM } from '@/pages/incidents/incident-form.types';

/**
 * CỔNG: mọi ô của bố cục hệ cũ đều phải có CHỖ LƯU trên Vụ việc.
 *
 * Ô gõ được mà không có đích thì cán bộ nhập xong, bấm Lưu, mở lại là trắng — kiểu hỏng im
 * lặng khó lần ra nhất, và nó phá đúng lời hứa của epic: "dữ liệu chuyển sang đầy đủ".
 *
 * Hai loại đích hợp lệ: một khoá thật của `IncidentFormData`, hoặc `legacyExtra.<khoá>` (lưu
 * ở `metadata`). Không có loại thứ ba.
 */
const MOI_O = Object.values(LEGACY_FORM_LAYOUT).flat() as { field: CaseFieldPath }[];
const KHOA_FORM = new Set(Object.keys(INITIAL_INCIDENT_FORM));

describe('Mọi ô bố cục hệ cũ đều có chỗ lưu trên Vụ việc', () => {
  it('đọc được đặc tả, không rơi về rỗng', () => {
    expect(MOI_O.length).toBeGreaterThan(100);
    expect(KHOA_FORM.size).toBeGreaterThan(50);
  });

  it.each([...new Set(MOI_O.map((o) => o.field))])('ô "%s" có đích lưu', (field) => {
    const dich = dichLuu(field);
    const hopLe = KHOA_FORM.has(dich) || dich.startsWith('legacyExtra.');
    expect(hopLe).toBe(true);
  });

  /**
   * Đích trỏ vào một khoá KHÔNG có trong dữ liệu form là hỏng im lặng: `read` trả `undefined`,
   * ô hiện trống, và `write` tạo một khoá lạ mà payload không gửi đi đâu cả.
   */
  it('không đích nào trỏ vào khoá form không tồn tại', () => {
    const sai = [...new Set(MOI_O.map((o) => o.field))]
      .map((f) => dichLuu(f))
      .filter((d) => !d.startsWith('legacyExtra.') && !KHOA_FORM.has(d));
    expect(sai).toEqual([]);
  });

  it('bảng khoá nhánh phụ khớp với những ô thật sự rơi về metadata', () => {
    const roiVeMeta = [...new Set(MOI_O.map((o) => o.field))]
      .map((f) => dichLuu(f))
      .filter((d) => d.startsWith('legacyExtra.'))
      .map((d) => d.slice('legacyExtra.'.length));
    expect(new Set(roiVeMeta)).toEqual(KHOA_NHANH_PHU);
  });

  it('bố cục Vụ việc giữ nguyên số tab và số ô của đặc tả gốc', () => {
    const goc = Object.entries(LEGACY_FORM_LAYOUT);
    const vv = Object.entries(INCIDENT_LEGACY_LAYOUT);
    expect(vv.length).toBe(goc.length);
    for (const [tab, items] of goc) {
      expect(INCIDENT_LEGACY_LAYOUT[tab as keyof typeof INCIDENT_LEGACY_LAYOUT].length).toBe(
        items.length,
      );
    }
  });

  /** Nhãn và thứ tự lấy từ đặc tả gốc — không được chép sang bản thứ ba rồi trôi khỏi nhau. */
  it('nhãn của từng ô giữ nguyên theo đặc tả gốc', () => {
    for (const [tab, items] of Object.entries(LEGACY_FORM_LAYOUT)) {
      const vv = INCIDENT_LEGACY_LAYOUT[tab as keyof typeof INCIDENT_LEGACY_LAYOUT];
      items.forEach((o, i) => {
        expect(vv[i].caption).toBe(o.caption);
        expect(vv[i].kind).toBe(o.kind);
      });
    }
  });

  it('đặc tả khai đúng thực thể', () => {
    expect(INCIDENT_LEGACY_SPEC.entity).toBe('incident');
  });
});
