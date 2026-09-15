import { describe, it, expect } from 'vitest';
import donThu from '../petitions/PetitionListPageShell.tsx?raw';
import vuViec from '../incidents/IncidentListPageShell.tsx?raw';
import vuAn from '../cases/CaseListPageShell.tsx?raw';
import uyThac from '../../features/uy-thac-dieu-tra/UyThacDieuTraListPage.tsx?raw';
import doiTuong from '../objects/ObjectListPageShell.tsx?raw';
import luatSu from '../lawyers/LawyerListPageShell.tsx?raw';
import tongHop from '../cases/ComprehensiveListPageShell.tsx?raw';
import {
  TIM_KIEM_DOI_TUONG,
  TIM_KIEM_DON_THU,
  TIM_KIEM_LUAT_SU,
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
  // Ba loại đối tượng (bị can / bị hại / nhân chứng) dùng CHUNG một shell và một khai.
  ['Đối tượng', TIM_KIEM_DOI_TUONG, [doiTuong]],
  ['Luật sư', TIM_KIEM_LUAT_SU, [luatSu]],
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

  /**
   * Mỗi ô lọc chữ cũ đã GỠ khỏi mặt lọc của một màn (tham số cũ quy về thẻ) phải có cột mang khoá ấy
   * trên CHÍNH màn đó. Tính hợp cột nhiều màn thì lọt: Vụ án từng gỡ ô "Tội danh" trong khi chỉ màn
   * UTDT có cột Tội danh — cán bộ ở màn Vụ án không còn lối nào chọn được thẻ ấy.
   */
  const MAN_THAM_SO_CU = [
    ['Đơn thư', donThu],
    ['Vụ việc', vuViec],
    ['Vụ án', vuAn],
    ['Ủy thác điều tra', uyThac],
    ['Tổng hợp', tongHop],
  ] as const;

  /**
   * Tổng hợp gộp ba loại hồ sơ nên không có tệp khai riêng: khoá trên cột phải có ở ÍT NHẤT một trong
   * ba khai (máy chủ nào không nhận khoá thì giao diện lọc bỏ theo loại, không gửi).
   */
  it('Tổng hợp: cột chỉ mang khoá có ở ít nhất một trong ba thực thể', () => {
    const hop = new Set(
      [...TIM_KIEM_DON_THU, ...TIM_KIEM_VU_VIEC, ...TIM_KIEM_VU_AN].map((t) => t.key as string),
    );
    const trenCot = [...khoaTrenCot(tongHop)];
    expect(trenCot.length).toBeGreaterThan(0);
    expect(trenCot.filter((k) => !hop.has(k))).toEqual([]);
  });

  it.each(MAN_THAM_SO_CU)('%s: khoá của mọi ô lọc chữ cũ có cột trên chính màn này', (_ten, src) => {
    const khoiCu = /const THAM_SO_CU_\w+ = \{([^}]*)\}/.exec(src);
    expect(khoiCu).not.toBeNull();
    const khoaCu = [...khoiCu![1].matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(khoaCu.length).toBeGreaterThan(0);
    const coCot = khoaTrenCot(src);
    expect(khoaCu.filter((k) => !coCot.has(k))).toEqual([]);
  });

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
