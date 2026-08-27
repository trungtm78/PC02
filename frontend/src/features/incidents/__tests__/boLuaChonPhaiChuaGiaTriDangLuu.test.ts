import { describe, it, expect } from 'vitest';
import { INCIDENT_LEGACY_LAYOUT } from '../legacy-form-binding';

/**
 * Ô chọn phải chứa GIÁ TRỊ ĐANG NẰM DƯỚI CƠ SỞ DỮ LIỆU, không chỉ có đúng tên ô.
 *
 * Ô "Phân loại ban đầu" lấy nguyên bộ lựa chọn của Vụ án (`vu_viec`, `don_cong_van`…), trong
 * khi cột `phanLoaiNguonTinBanDau` của Vụ việc giữ `vu-viec-ban-dau`, `vu-viec-nguon-tin`.
 * Không giá trị nào khớp, nên ô hiện TRỐNG cho 4.594/4.717 hồ sơ — cán bộ mở hồ sơ ra tưởng
 * chưa phân loại, chọn lại, và ghi đè phân loại thật.
 *
 * Ca kiểm cũ không bắt được vì chúng đối chiếu TÊN ô và NHÃN, chưa bao giờ đối chiếu GIÁ TRỊ.
 * Chỉ bấm thử trên máy thật mới lộ.
 *
 * Số đo lấy trên máy chạy ngày 27/08/2026.
 */
const DANG_LUU: Readonly<Record<string, { giaTri: string; hoSo: number }[]>> = {
  phanLoaiNguonTinBanDau: [
    { giaTri: 'vu-viec-ban-dau', hoSo: 3607 },
    { giaTri: 'vu-viec-nguon-tin', hoSo: 987 },
    { giaTri: 'cong-van-don-doc-phuc-hoi-tdc', hoSo: 3 },
  ],
};

/** Bộ lựa chọn của một ô, tìm trong mọi tab của bố cục Vụ việc. */
function boLuaChon(field: string): readonly { value: string }[] | undefined {
  for (const items of Object.values(INCIDENT_LEGACY_LAYOUT)) {
    const o = items.find((x) => x.field === field);
    if (o?.options) return o.options;
  }
  return undefined;
}

describe('Bộ lựa chọn phải chứa giá trị đang lưu', () => {
  it.each(Object.entries(DANG_LUU))('ô "%s" có bộ lựa chọn', (field) => {
    expect(boLuaChon(field)).toBeDefined();
  });

  it.each(
    Object.entries(DANG_LUU).flatMap(([field, ds]) =>
      ds.map((d) => [field, d.giaTri, d.hoSo] as const),
    ),
  )('ô "%s" nhận giá trị "%s" (%i hồ sơ đang mang)', (field, giaTri) => {
    const bo = boLuaChon(field);
    expect(bo?.map((o) => o.value)).toContain(giaTri);
  });

  /**
   * Nhãn phải giữ nguyên văn hệ cũ — đổi giá trị là để khớp dữ liệu, không phải cớ để đổi
   * chữ cán bộ đang quen.
   */
  it('nhãn giữ nguyên văn hệ cũ', () => {
    const bo = boLuaChon('phanLoaiNguonTinBanDau');
    const nhan = bo?.map((o) => (o as { label: string }).label) ?? [];
    expect(nhan).toContain('Đơn, Công văn');
    expect(nhan).toContain('Vụ việc');
    expect(nhan).toContain('Vụ án');
  });
});
