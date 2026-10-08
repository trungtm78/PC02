/**
 * CỔNG — bề rộng cột Thao tác đi bằng biến CSS `--be-rong-cot-thao-tac`: 12rem trên máy tính, 3.5rem ở ≤767px.
 *
 * Ba nơi phải KHỚP NHAU: hằng `BE_RONG_COT_THAO_TAC` (var()), `index.css` (giá trị theo @media) và
 * `MAN_HINH_DIEN_THOAI` của `useMediaQuery` (quyết định RowActions chỉ còn một nút ⋮). Lệch ngưỡng 767 ↔ 768 thì ở
 * đúng một độ rộng màn hình cột chỉ rộng 3.5rem mà vẫn 5 nút (nút tràn đè cột bên) — hoặc ngược lại một nút ⋮ nằm giữa
 * khoảng trống 12rem. Biến chưa khai thì `var()` rỗng → cột mất bề rộng.
 *
 * Đọc `index.css` bằng fs (vitest xử lý `?raw` của .css thành rỗng).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { BE_RONG_COT_THAO_TAC, BIEN_CSS_BE_RONG_COT_THAO_TAC } from '../cotThaoTac';
import { MAN_HINH_DIEN_THOAI } from '@/hooks/useMediaQuery';

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

  it('index.css đổi sang 3.5rem đúng ở ngưỡng điện thoại của useMediaQuery', () => {
    const m = /@media\s*\(max-width:\s*(\d+)px\)\s*\{\s*:root\s*\{\s*([^}]*)\}/.exec(css);
    expect(m, 'thiếu khối @media (max-width) đặt biến').not.toBeNull();
    expect(`(max-width: ${m![1]}px)`).toBe(MAN_HINH_DIEN_THOAI);
    expect(m![2]).toMatch(new RegExp(`${BIEN}:\\s*3\\.5rem`));
  });

  it('3.5rem đủ cho nút 44px (2.75rem) cộng lề', () => {
    expect(3.5).toBeGreaterThanOrEqual(2.75 + 0.5);
  });
});
