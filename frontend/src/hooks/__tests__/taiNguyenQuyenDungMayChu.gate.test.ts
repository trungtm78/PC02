import { describe, it, expect } from 'vitest';

/**
 * CỔNG — màn cấu hình hỏi ĐÚNG quyền mà máy chủ của nó đòi (rà mã PR #435, 19/09/2026). Ba màn từng hỏi
 * canEdit('settings') = write:Setting, trong khi máy chủ đòi write:Directory (phân loại gốc, ánh xạ địa chỉ) và
 * write/edit:Calendar (nhóm sự kiện) → vai trò tự tạo có quyền đúng vẫn bị ẩn nút, hoặc thấy nút rồi nhận 403.
 */
const NGUON = import.meta.glob(
  [
    '../../pages/admin/MasterClassPage.tsx',
    '../../pages/settings/modules/AddressMappingModule.tsx',
    '../../pages/settings/modules/EventCategoriesModule.tsx',
  ],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;

const MONG_DOI: Record<string, string> = {
  MasterClassPage: 'directories', // master-class.controller: write:Directory
  AddressMappingModule: 'directories', // address-mapping.controller: write:Directory
  EventCategoriesModule: 'calendar', // event-categories.controller: write/edit:Calendar
};

describe('màn cấu hình hỏi đúng tài nguyên quyền', () => {
  it.each(Object.entries(MONG_DOI))('%s dùng canEdit(%j)', (ten, taiNguyen) => {
    const [, ma] = Object.entries(NGUON).find(([p]) => p.includes(ten)) ?? [];
    expect(ma, ten).toBeTruthy();
    expect(ma).toContain(`canEdit('${taiNguyen}')`);
    expect(ma).not.toContain(`canEdit('settings')`);
  });
});
