/**
 * CỔNG — bề rộng cột Thao tác đi bằng biến CSS `--be-rong-cot-thao-tac`: 12rem trên máy tính, 5rem ở ≤767px.
 *
 * Ba nơi phải KHỚP NHAU: hằng `BE_RONG_COT_THAO_TAC` (var()), `index.css` (giá trị theo @media) và
 * `MAN_HINH_DIEN_THOAI` của `useMediaQuery` (quyết định RowActions chỉ còn một nút ⋮). Lệch ngưỡng 767 ↔ 768 thì ở
 * đúng một độ rộng màn hình cột chỉ rộng 5rem mà vẫn 5 nút (nút tràn đè cột bên) — hoặc ngược lại một nút ⋮ nằm giữa
 * khoảng trống 12rem. Biến chưa khai thì `var()` rỗng → cột mất bề rộng.
 *
 * Đọc `index.css` bằng fs (vitest xử lý `?raw` của .css thành rỗng).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { BE_RONG_COT_THAO_TAC, BIEN_CSS_BE_RONG_COT_THAO_TAC } from '../cotThaoTac';
import { MAN_HINH_DIEN_THOAI } from '@/hooks/useMediaQuery';
import { TABLE_CELL } from '@/constants/styles';

const css = fs.readFileSync(path.resolve(__dirname, '../../../../index.css'), 'utf-8');
const BIEN = BIEN_CSS_BE_RONG_COT_THAO_TAC;

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

  it('index.css đổi sang 5rem đúng ở ngưỡng điện thoại của useMediaQuery', () => {
    const m = /@media\s*\(max-width:\s*(\d+)px\)\s*\{\s*:root\s*\{\s*([^}]*)\}/.exec(css);
    expect(m, 'thiếu khối @media (max-width) đặt biến').not.toBeNull();
    expect(`(max-width: ${m![1]}px)`).toBe(MAN_HINH_DIEN_THOAI);
    expect(m![2]).toMatch(new RegExp(`${BIEN}:\\s*5rem`));
  });

  it('cột điện thoại đủ rộng cho nút 44px SAU KHI trừ lề ô (đo thật 08/10/2026: 3.5rem làm nút ⋮ tràn khỏi ô)', () => {
    const m = new RegExp(`${BIEN}:\\s*([0-9.]+)rem`).exec(css.slice(css.indexOf('@media')));
    expect(m).not.toBeNull();
    const beRong = Number(m![1]);
    // Ô dùng `px-4` (1rem mỗi bên) — nút phải nằm trọn trong phần còn lại.
    expect(TABLE_CELL).toMatch(/\bpx-4\b/);
    expect(beRong - 2).toBeGreaterThanOrEqual(2.75);
  });
});
