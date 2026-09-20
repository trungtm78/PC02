import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CỔNG: mọi ô chọn cán bộ phải truyền id ĐANG GIỮ vào `gomCanBoTheoTo`.
 *
 * Không truyền thì cán bộ đã bị khoá biến mất khỏi ô, ô hiện chữ gợi ý trông như chưa chọn
 * ai, và người dùng chọn người khác — đổi phân công NGẦM. Đây đúng là lớp lỗi mà
 * `giuCanBoDaChon` và nhóm GHIM sinh ra để chặn.
 */
const GOC = process.cwd();

function boChuThich(than: string): string {
  return than.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const TEP = [
  'src/pages/petitions/PetitionFormPage/index.tsx',
  'src/pages/cases/CaseFormPage/tabs.tsx',
  'src/pages/incidents/IncidentFormPage.tsx',
];

describe('Mọi lời gọi gomCanBoTheoTo đều truyền id đang giữ', () => {
  it('có lời gọi để soi — cổng quét 0 chỗ mà vẫn xanh là cổng vô nghĩa', () => {
    const tong = TEP.reduce(
      (s, t) => s + (boChuThich(readFileSync(join(GOC, t), 'utf8')).match(/gomCanBoTheoTo\s*\(/g)?.length ?? 0),
      0,
    );
    expect(tong).toBeGreaterThanOrEqual(4);
  });

  it('không lời gọi nào chỉ có MỘT đối số', () => {
    const pham: string[] = [];
    for (const t of TEP) {
      const than = boChuThich(readFileSync(join(GOC, t), 'utf8'));
      const mau = /gomCanBoTheoTo\s*\(([^)]*)\)/g;
      let m: RegExpExecArray | null;
      while ((m = mau.exec(than)) !== null) {
        if (!m[1].includes(',')) pham.push(`${t}: gomCanBoTheoTo(${m[1]})`);
      }
    }
    expect(pham).toEqual([]);
  });
});
