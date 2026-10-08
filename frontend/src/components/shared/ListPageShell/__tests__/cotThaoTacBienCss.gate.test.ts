/**
 * CỔNG — bề rộng cột Thao tác đi bằng biến CSS `--be-rong-cot-thao-tac`: 12rem trên máy tính, 2.5rem ở ≤767px.
 *
 * Ba nơi phải KHỚP NHAU: hằng `BE_RONG_COT_THAO_TAC` (var()), `index.css` (giá trị theo @media) và
 * `MAN_HINH_DIEN_THOAI` của `useMediaQuery` (quyết định RowActions chỉ còn một nút ⋮). Lệch ngưỡng 767 ↔ 768 thì ở
 * đúng một độ rộng màn hình cột chỉ rộng 2.5rem mà vẫn 5 nút (nút tràn đè cột bên) — hoặc ngược lại một nút ⋮ nằm giữa
 * khoảng trống 12rem. Biến chưa khai thì `var()` rỗng → cột mất bề rộng.
 *
 * Bề rộng điện thoại còn phải TRỪ LỀ Ô: nút ⋮ cao/rộng 2rem (32px) phải lọt trong phần còn lại của ô. Lề mặc định
 * `px-4` (2×1rem) làm cột 3.5rem chỉ còn 1.5rem cho nút — Chromium thật đo nút tràn ô (08/10/2026). Cột Thao tác khai
 * `thuGonTrenDienThoai` để `Table` đổi lề sang `max-md:px-1` (2×0.25rem).
 *
 * Đọc `index.css` và `Table.tsx` bằng fs (vitest xử lý `?raw` của .css thành rỗng).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { BE_RONG_COT_THAO_TAC, BIEN_CSS_BE_RONG_COT_THAO_TAC } from '../cotThaoTac';
import { MAN_HINH_DIEN_THOAI } from '@/hooks/useMediaQuery';

const GOC = path.resolve(__dirname, '../../../..');
const css = fs.readFileSync(path.join(GOC, 'index.css'), 'utf-8');
const bang = fs.readFileSync(path.join(GOC, 'components/shared/ListPageShell/Table.tsx'), 'utf-8');
const BIEN = BIEN_CSS_BE_RONG_COT_THAO_TAC;

const MAN_CO_COT_THAO_TAC = [
  'pages/petitions/PetitionListPageShell.tsx',
  'pages/incidents/IncidentListPageShell.tsx',
  'pages/cases/CaseListPageShell.tsx',
  'pages/cases/ComprehensiveListPageShell.tsx',
];

describe('biến CSS bề rộng cột Thao tác', () => {
  it('đọc được index.css (cổng không rỗng)', () => {
    expect(css.length).toBeGreaterThan(500);
  });

  it('hằng số là var() của đúng biến', () => {
    expect(BE_RONG_COT_THAO_TAC).toBe(`var(${BIEN})`);
  });

  it('index.css khai biến ở :root = 12rem (máy tính)', () => {
    const goc = css.slice(0, css.indexOf('@media'));
    expect(goc).toMatch(new RegExp(`${BIEN}:\\s*12rem`));
  });

  it('index.css đổi sang 2.5rem đúng ở ngưỡng điện thoại của useMediaQuery', () => {
    const m = /@media\s*\(max-width:\s*(\d+)px\)\s*\{\s*:root\s*\{\s*([^}]*)\}/.exec(css);
    expect(m, 'thiếu khối @media (max-width) đặt biến').not.toBeNull();
    expect(`(max-width: ${m![1]}px)`).toBe(MAN_HINH_DIEN_THOAI);
    expect(m![2]).toMatch(new RegExp(`${BIEN}:\\s*2\\.5rem`));
  });

  it('cột điện thoại đủ rộng cho nút 32px SAU KHI trừ lề ô thu gọn (2 × 0.25rem)', () => {
    const m = new RegExp(`${BIEN}:\\s*([0-9.]+)rem`).exec(css.slice(css.indexOf('@media')));
    expect(m).not.toBeNull();
    const beRong = Number(m![1]);
    expect(beRong - 2 * 0.25).toBeGreaterThanOrEqual(2);
    // ... và KHÔNG đủ nếu ô còn lề mặc định px-4: chính là lỗi đo thật, nên lề thu gọn là điều kiện cần.
    expect(beRong - 2 * 1).toBeLessThan(2);
  });

  it('Table đổi lề cột thu gọn sang max-md:px-1 ở CẢ ô tiêu đề lẫn ô dữ liệu', () => {
    expect(bang).toMatch(/LOP_THU_GON_DIEN_THOAI\s*=\s*'max-md:px-1'/);
    const soLanDung = bang.split('LOP_THU_GON_DIEN_THOAI').length - 1;
    expect(soLanDung).toBeGreaterThanOrEqual(3); // khai báo + tiêu đề + ô dữ liệu
    expect(bang).toMatch(/anNhanTrenDienThoai=\{col\.thuGonTrenDienThoai\}/);
  });

  it.each(MAN_CO_COT_THAO_TAC)('%s: cột Thao tác khai thuGonTrenDienThoai', (tep) => {
    const nd = fs.readFileSync(path.join(GOC, tep), 'utf-8');
    const i = nd.indexOf("key: 'actions'");
    expect(i).toBeGreaterThan(0);
    const khoi = nd.slice(i, nd.indexOf('render:', i));
    expect(khoi).toContain('thuGonTrenDienThoai: true');
  });
});
