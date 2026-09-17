import { describe, it, expect } from 'vitest';
import { classificationMenu } from '../menu';
import { renderClassificationRoutes } from '../routes';
import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

/**
 * "Phân loại khác" được GỠ 18/09/2026 theo quyết định của anh.
 *
 * Đọc mã hệ cũ (`_PC02/Modules/PhanLoaiKhac`): màn ấy lọc `ho_so_doi_1.loai = "phan_loai_khac"` — một
 * LOẠI hồ sơ thứ tư. Đếm trên MongoDB hệ cũ (chỉ đọc) được 0 bản; hệ mới cũng không có chỗ lưu loại ấy.
 * Màn trong hệ mới thì tải MỌI vụ án REGULAR rồi gán cột "phân loại" = tội danh, tức số liệu bịa.
 *
 * Ca kiểm này giữ cho nó không lặng lẽ quay lại: muốn bật lại thì phải dựng loại hồ sơ thật trước.
 */
describe('Menu Phân loại & Quản lý — không còn "Phân loại khác"', () => {
  const phang = (ds: FeatureMenuEntry[]): FeatureMenuEntry[] =>
    ds.flatMap((m) => [m, ...phang(m.children ?? [])]);

  it('menu không còn mục Phân loại khác', () => {
    const muc = phang(classificationMenu);
    expect(muc.map((m) => m.id)).not.toContain('classification-others');
    expect(muc.map((m) => m.label)).not.toContain('Phân loại khác');
  });

  it('không còn đường dẫn /classification/others', () => {
    const duong = renderClassificationRoutes().map(
      (r) => (r.props as { path?: string }).path,
    );
    expect(duong).not.toContain('/classification/others');
    // Các màn cùng nhóm vẫn còn nguyên.
    expect(duong).toEqual(
      expect.arrayContaining(['/ward/cases', '/ward/incidents', '/classification/duplicates']),
    );
  });
});
