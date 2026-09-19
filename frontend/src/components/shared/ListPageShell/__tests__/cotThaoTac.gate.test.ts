import { describe, it, expect } from 'vitest';
import { TABLE_CELL_WRAP, TABLE_CELL } from '@/constants/styles';

/**
 * CỔNG — cột Thao tác không được đè chữ cột bên (anh chụp 19/09/2026: nút ⋮ dính vào mã hồ sơ).
 *
 * Hai điều kiện là một CẶP: ô cắt phần thừa (không nút nào vẽ đè cột bên) VÀ cột đủ rộng cho mọi nút (không nút nào
 * bị cắt mất). jsdom không dàn trang nên chỉ chốt được khai báo; toạ độ thật đo ở UAT Chrome
 * `tests/e2e/cot-thao-tac-uat.e2e.spec.ts`.
 */
const NGUON = import.meta.glob(
  [
    '../../../../pages/petitions/PetitionListPageShell.tsx',
    '../../../../pages/incidents/IncidentListPageShell.tsx',
    '../../../../pages/cases/CaseListPageShell.tsx',
    '../../../../pages/cases/ComprehensiveListPageShell.tsx',
  ],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;

describe('cột Thao tác', () => {
  it('ô ở CẢ hai chế độ (một dòng / xuống dòng) đều cắt phần thừa', () => {
    expect(TABLE_CELL).toMatch(/\boverflow-hidden\b/);
    expect(TABLE_CELL_WRAP).toMatch(/\boverflow-hidden\b/);
  });

  it('bốn màn danh sách hồ sơ dùng CHUNG hằng số bề rộng cột Thao tác (không số viết tay)', () => {
    expect(Object.keys(NGUON)).toHaveLength(4);
    for (const [tep, ma] of Object.entries(NGUON)) {
      const i = ma.indexOf("key: 'actions'");
      expect(i, tep).toBeGreaterThan(0);
      const khoi = ma.slice(i, ma.indexOf('render:', i));
      expect(khoi, tep).toContain('width: BE_RONG_COT_THAO_TAC');
    }
  });
});
