/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mainTsx from '../main.tsx?raw';
import indexHtml from '../../index.html?raw';
import summaryCell from '../components/shared/ListPageShell/SummaryCell.tsx?raw';

/**
 * CỔNG font tự host (18/09/2026, PR-F): Be Vietnam Pro cho giao diện, Source Serif 4 CHỈ cho cột Tóm tắt,
 * JetBrains Mono cho mã/ngày. Mạng nội bộ có thể chặn Google Fonts nên phải tự host; và chỉ nạp bộ chữ tiếng
 * Việt + Latin (bộ nhớ đệm PWA nạp sẵn mọi `.woff2` được xuất ra).
 */
// CSS đọc bằng Node: vitest thay mọi `.css` (kể cả `?raw`) bằng mô-đun rỗng.
const THU_MUC_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fonts = readFileSync(resolve(THU_MUC_SRC, 'fonts.css'), 'utf8');
const indexCss = readFileSync(resolve(THU_MUC_SRC, 'index.css'), 'utf8');

const matChu = [...fonts.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);

describe('CỔNG font tự host', () => {
  it('đủ 3 họ chữ, mỗi mặt chữ có unicode-range và font-display: swap', () => {
    expect(matChu.length).toBe(12);
    for (const k of matChu) {
      expect(k).toMatch(/unicode-range:\s*U\+/);
      expect(k).toMatch(/font-display:\s*swap/);
    }
    const ho = new Set(matChu.map((k) => /font-family:\s*'([^']+)'/.exec(k)?.[1]));
    expect([...ho].sort()).toEqual(['Be Vietnam Pro', 'JetBrains Mono Variable', 'Source Serif 4 Variable']);
  });

  it('chỉ bộ chữ tiếng Việt + Latin (không Cyrillic/Hy Lạp/latin-ext)', () => {
    const tep = [...fonts.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(tep.length).toBe(12);
    for (const t of tep) expect(t).toMatch(/-(vietnamese|latin)-(\d+|wght)-normal\.woff2$/);
  });

  it('theme dùng đúng ba họ chữ; trang nạp tệp font; không gọi Google Fonts', () => {
    expect(indexCss).toMatch(/--font-sans:\s*'Be Vietnam Pro'/);
    // Token RIÊNG cho cột Tóm tắt — KHÔNG đè `--font-serif`: mẫu in Mẫu 59/60 (ủy thác điều tra) dùng
    // `font-serif`, đè là văn bản hành chính đổi font theo (rà mã 18/09/2026).
    expect(indexCss).toMatch(/--font-doc:\s*'Source Serif 4 Variable'/);
    expect(indexCss).not.toMatch(/--font-serif:/);
    expect(indexCss).toMatch(/--font-mono:\s*'JetBrains Mono Variable'/);
    expect(mainTsx).toMatch(/import '\.\/fonts\.css';/);
    expect(`${indexHtml}\n${indexCss}\n${fonts}`).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  it('cột Tóm tắt dùng font có chân (đọc đoạn dài)', () => {
    expect(summaryCell).toMatch(/\bfont-doc\b/);
  });

  it('gieo lỗi: mặt chữ thiếu unicode-range → cổng bắt được', () => {
    const hong = fonts.replace(/\s*unicode-range:[^;]*;/, '');
    const k = [...hong.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(k.some((x) => !/unicode-range/.test(x))).toBe(true);
  });
});
