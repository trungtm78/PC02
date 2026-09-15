import { describe, it, expect } from 'vitest';
import donThu from '../petitions/PetitionListPageShell.tsx?raw';
import vuViec from '../incidents/IncidentListPageShell.tsx?raw';
import vuAn from '../cases/CaseListPageShell.tsx?raw';
import uyThac from '../../features/uy-thac-dieu-tra/UyThacDieuTraListPage.tsx?raw';
import {
  TIM_KIEM_DON_THU,
  TIM_KIEM_VU_AN,
  TIM_KIEM_VU_VIEC,
} from '@/shared/tim-kiem/generated';

/**
 * CỔNG: mọi trường tìm được của một thực thể phải có CỘT mang nó trên ít nhất một màn danh sách
 * của thực thể ấy, và không cột nào mang khoá lạ.
 *
 * Gợi ý của ô thẻ suy từ cột đang hiện. Trường khai ở máy chủ mà không cột nào mang thì cán bộ
 * không bao giờ chọn được nó — chỉ còn lối dán đường dẫn tay. Khoá lạ trên cột thì gợi ý lặng lẽ
 * biến mất. Cả hai đều không làm ca kiểm nào đỏ nếu thiếu cổng này.
 *
 * Vụ án dùng CHUNG tệp khai với Ủy thác điều tra (cùng bảng `cases`): các trường riêng UTDT (đơn vị
 * giao, số QĐ, thời hạn…) mang trên màn UTDT, trường chung mang trên màn Vụ án. Cổng tính HỢP cột
 * của hai màn.
 *
 * Đọc mã nguồn dạng văn bản (`?raw`) vì cột được dựng bên trong component.
 */

function khoaTrenCot(src: string): Set<string> {
  const ra = new Set<string>();
  for (const m of src.matchAll(/timKiem:\s*(\[[^\]]*\]|'[^']*')/g)) {
    for (const k of m[1].matchAll(/'([^']+)'/g)) ra.add(k[1]);
  }
  return ra;
}

const THUC_THE = [
  ['Đơn thư', TIM_KIEM_DON_THU, [donThu]],
  ['Vụ việc', TIM_KIEM_VU_VIEC, [vuViec]],
  ['Vụ án + Ủy thác điều tra', TIM_KIEM_VU_AN, [vuAn, uyThac]],
] as const;

const khaiCua = (khai: readonly { key: string }[]) => khai.map((t) => t.key);

describe('GATE tìm kiếm — cột ↔ khai', () => {
  it.each(THUC_THE)('%s: mọi trường khai đều có cột mang nó', (_ten, khai, man) => {
    const coCot = new Set(man.flatMap((src) => [...khoaTrenCot(src)]));
    expect(khaiCua(khai).filter((k) => !coCot.has(k))).toEqual([]);
  });

  it.each(THUC_THE.flatMap(([ten, khai, man]) => man.map((src, i) => [`${ten} #${i + 1}`, khai, src] as const)))(
    '%s: không cột nào mang khoá không có trong khai',
    (_ten, khai, src) => {
      expect([...khoaTrenCot(src)].filter((k) => !khaiCua(khai).includes(k))).toEqual([]);
    },
  );

  it('gieo lỗi: gỡ khoá một cột thì cổng bắt được', () => {
    const hong = vuViec.replace(/timKiem:\s*'tomTat'/, '');
    expect(hong).not.toBe(vuViec);
    expect(khaiCua(TIM_KIEM_VU_VIEC).filter((k) => !khoaTrenCot(hong).has(k))).toEqual(['tomTat']);

    // Trường riêng UTDT chỉ mang ở màn UTDT: gỡ ở đó là đỏ, dù màn Vụ án vẫn nguyên.
    const uyThacHong = uyThac.replace(/timKiem:\s*'donViGiao'/, '');
    expect(uyThacHong).not.toBe(uyThac);
    const coCot = new Set([...khoaTrenCot(vuAn), ...khoaTrenCot(uyThacHong)]);
    expect(khaiCua(TIM_KIEM_VU_AN).filter((k) => !coCot.has(k))).toEqual(['donViGiao']);
  });
});
