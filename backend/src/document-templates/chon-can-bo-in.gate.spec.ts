import * as fs from 'fs';
import * as path from 'path';
import { CHON_CAN_BO_IN } from './chon-can-bo-in';

/**
 * Bộ nạp phục vụ xuất chứng từ phải lấy ĐỦ cột cán bộ mà bộ in cần.
 *
 * ── Vì sao cần cổng đọc thẳng mã nguồn ──
 *
 * Ngày 28/08/2026 bản vá `${ten_ngan}` xanh hết ca kiểm đơn vị — vì ca kiểm truyền thẳng một
 * đối tượng cán bộ có sẵn `shortName`. Trên máy thật thì Prisma không trả cột ấy về, bộ in thấy
 * `undefined` rồi lặng lẽ rơi về họ tên đầy đủ. Không lỗi, không cảnh báo, văn bản vẫn có chữ.
 *
 * Không ca kiểm đơn vị nào bắt được chuyện ấy: khoảng hở nằm giữa "bộ nạp khai cột gì" và "bộ
 * in đọc cột gì", mà hai bên chưa từng gặp nhau trong một ca kiểm. Cổng này ghép chúng lại bằng
 * cách đọc mã nguồn — cùng lối `cap-nhat-phai-bu-ma.gate.spec.ts` đã dùng.
 */

const GOC = path.resolve(__dirname, '..');

/**
 * Quan hệ cán bộ mà bộ tra giá trị hệ cũ đọc: `r.enteredBy ?? r.canBoNhap ?? r.createdBy`, cộng
 * `canBoDeXuat` và `investigator` mà bộ mẫu PC01 dùng.
 */
const BO_NAP_XUAT_CHUNG_TU: ReadonlyArray<{ tep: string; quanHe: readonly string[] }> = [
  { tep: 'petitions/petitions.service.ts', quanHe: ['enteredBy', 'canBoDeXuat'] },
  { tep: 'incidents/incidents.service.ts', quanHe: ['canBoNhap', 'createdBy', 'investigator'] },
  { tep: 'cases/cases.service.ts', quanHe: ['createdBy', 'investigator'] },
];

function doc(tep: string): string {
  return fs.readFileSync(path.join(GOC, tep), 'utf-8');
}

describe('Cổng: bộ nạp xuất chứng từ lấy đủ cột cán bộ', () => {
  it.each(BO_NAP_XUAT_CHUNG_TU.map((b) => b.tep))('%s dùng hằng số CHON_CAN_BO_IN', (tep) => {
    expect(doc(tep)).toContain('CHON_CAN_BO_IN');
  });

  /**
   * Quan hệ nào bộ in ĐỌC thì bộ nạp phải NẠP. Thiếu một quan hệ là ô ấy in ra trống mà không
   * ai biết — `${nguoi_nhan}`/`${ten_ngan}` của Vụ án từng rỗng đúng vì bộ nạp không hề lấy
   * `createdBy`.
   */
  it.each(
    BO_NAP_XUAT_CHUNG_TU.flatMap((b) => b.quanHe.map((q) => [b.tep, q] as const)),
  )('%s nạp quan hệ `%s` bằng CHON_CAN_BO_IN', (tep, quanHe) => {
    const ma = doc(tep);
    const mau = new RegExp(`${quanHe}:\\s*\\{\\s*select:\\s*CHON_CAN_BO_IN`);
    expect(mau.test(ma)).toBe(true);
  });

  /**
   * Hằng số phải mang đúng cột mà bộ in đọc. Thêm cột vào bộ in mà quên khai ở đây là tái diễn
   * đúng lỗi 28/08/2026.
   */
  it.each(['firstName', 'lastName', 'rank', 'shortName'])('khai cột `%s`', (cot) => {
    expect(CHON_CAN_BO_IN[cot as keyof typeof CHON_CAN_BO_IN]).toBe(true);
  });
});
