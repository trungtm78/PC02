import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Mã nguồn không được chứa ký tự điều khiển THÔ (NUL, \x01…).
 *
 * Hai lần liên tiếp một chuỗi phân cách viết `join("\x00")` / `join('\x01')` bị lưu thành BYTE thật
 * trong tệp: chạy được, nhưng git coi cả tệp là nhị phân (diff không đọc được, review mù) và công cụ
 * dễ cắt cụt. Phải viết dạng escape `"\u0000"` hiển thị rõ được.
 */
const TEP = [
  'src/components/FKSelect.tsx',
  'src/components/CrimeSelect.tsx',
  'src/components/inputs/ONhapGoiY.tsx',
  'src/hooks/useListboxNav.ts',
];

describe('mã nguồn ô chọn không chứa ký tự điều khiển thô', () => {
  it.each(TEP)('%s', (tep) => {
    const noiDung = readFileSync(resolve(process.cwd(), tep), 'utf8');
    const vitri: string[] = [];
    for (let i = 0; i < noiDung.length; i += 1) {
      const c = noiDung.charCodeAt(i);
      if (c < 32 && c !== 9 && c !== 10 && c !== 13) {
        vitri.push(`dòng ${noiDung.slice(0, i).split('\n').length}: U+${c.toString(16).padStart(4, '0')}`);
      }
    }
    expect(vitri).toEqual([]);
  });
});
