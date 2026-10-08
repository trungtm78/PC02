/**
 * CỔNG nối dây: cơ chế chia sẻ phiên (chiaSePhien.ts) chỉ có tác dụng khi có người GỌI nó ở cả hai phía.
 *
 *  - phía trả lời: `main.tsx` phải gọi `batDauTraLoiPhien()` MỘT lần, TRƯỚC khi dựng React (ngoài StrictMode);
 *  - phía hỏi: `ProtectedRoute` phải gọi `xinPhienTuTabKhac()` trước khi đẩy sang /login.
 *
 * Gỡ một trong hai thì mọi ca kiểm cơ chế vẫn xanh nhưng tab mới lại bắt đăng nhập lại — đúng lỗi anh báo 08/10/2026.
 * Cổng engine (`tests/engine/chia-se-phien.engine.spec.ts`) chứng minh cơ chế; cổng này chứng minh nó được dùng.
 */
import { describe, it, expect } from 'vitest';
import mainSrc from '../../main.tsx?raw';
import protectedSrc from '../../components/ProtectedRoute.tsx?raw';

function boChuThich(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('chia sẻ phiên giữa các tab — nối dây', () => {
  const main = boChuThich(mainSrc);
  const route = boChuThich(protectedSrc);

  it('main.tsx nhập và GỌI batDauTraLoiPhien() ngoài React', () => {
    expect(main).toMatch(/import\s*\{\s*batDauTraLoiPhien\s*\}\s*from\s*['"]\.\/lib\/chiaSePhien['"]/);
    expect(main).toMatch(/^batDauTraLoiPhien\(\);/m);
  });

  it('batDauTraLoiPhien() chạy TRƯỚC createRoot (tab mới hỏi ngay lúc nạp, không đợi React)', () => {
    expect(main.indexOf('batDauTraLoiPhien();')).toBeGreaterThan(-1);
    expect(main.indexOf('batDauTraLoiPhien();')).toBeLessThan(main.indexOf('createRoot('));
  });

  it('ProtectedRoute xin phiên từ tab khác trước khi chuyển sang /login', () => {
    expect(route).toMatch(/xinPhienTuTabKhac\(/);
    expect(route).toMatch(/coTheCoPhienOTabKhac\(/);
    expect(route.indexOf('xinPhienTuTabKhac(')).toBeLessThan(route.indexOf('<Navigate'));
  });

  it('batDauTraLoiPhien() không bị đặt trong useEffect (StrictMode sẽ đăng ký hai lần)', () => {
    expect(main).not.toMatch(/useEffect\([^)]*batDauTraLoiPhien/);
  });
});
