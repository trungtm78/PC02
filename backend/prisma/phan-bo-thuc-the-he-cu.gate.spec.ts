import { PHAN_BO_THUC_THE_DO_DUOC } from './phan-bo-thuc-the-he-cu';
import { MAU_HE_CU } from './seed-legacy-templates';

/**
 * CỔNG: mọi mẫu hệ cũ phải được mời in ở ĐỦ những thực thể mà hồ sơ loại ấy thật sự nằm.
 *
 * Thiếu một thực thể là chứng từ hệ cũ in được mà hệ mới không mời — hỏng LẶNG LẼ: cán bộ mở
 * popup, không thấy mẫu, và không có gì báo rằng nó lẽ ra phải có. Đo 09/09/2026: 5.227 hồ sơ
 * rơi vào đúng cảnh ấy.
 */
describe('mẫu hệ cũ phủ đủ thực thể đã đo', () => {
  it('mỗi mẫu khai đúng bộ thực thể đo được, không thiếu không thừa', () => {
    for (const m of MAU_HE_CU) {
      const canCo = PHAN_BO_THUC_THE_DO_DUOC[m.code];
      expect(canCo).toBeDefined();
      expect([...m.entityTypes].sort()).toEqual([...(canCo ?? [])].sort());
    }
  });

  it('bảng đo không có mã lạ — hai bảng phải nói về cùng một bộ mẫu', () => {
    const maTrongSeed = new Set(MAU_HE_CU.map((m) => m.code));

    for (const ma of Object.keys(PHAN_BO_THUC_THE_DO_DUOC)) {
      expect(maTrongSeed.has(ma)).toBe(true);
    }
  });

  /** Thực thể ĐẦU là thực thể chính — quyết định tên và nhóm mẫu hiện cho cán bộ. */
  it('mẫu Trả hồ sơ có mặt ở Vụ việc — nơi 385/444 hồ sơ loại ấy thật sự nằm', () => {
    const m = MAU_HE_CU.find((x) => x.code === 'HE_CU_TRA_HO_SO');

    expect(m?.entityTypes).toContain('VU_VIEC');
    expect(m?.entityTypes).toContain('VU_AN');
  });
});
