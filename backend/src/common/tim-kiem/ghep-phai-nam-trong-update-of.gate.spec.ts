import * as fs from 'fs';
import * as path from 'path';
import { KHAI_TIM_KIEM } from './khai';
import { sinhMigrationTimKiem } from './sinh/sinh-tim-kiem';
import {
  THU_MUC_MIGRATION,
  thuMucMigrationTimKiemMoiNhat,
} from './sinh/tep-sinh';

/**
 * CỔNG: mọi cột nằm trong biểu thức ghép `concat_ws` phải nằm trong danh sách `UPDATE OF` của
 * trigger.
 *
 * Đây là kiểu hỏng IM LẶNG cuối cùng còn lại của đường cột bóng. Trigger khai
 * `BEFORE INSERT OR UPDATE OF <danh sách cột>`: sửa một cột KHÔNG có trong danh sách thì trigger
 * không chạy, cột bóng giữ giá trị CŨ, và hồ sơ ấy tìm không ra theo nội dung mới. Không lỗi,
 * không cảnh báo, không ca kiểm đơn vị nào thấy — cán bộ chỉ thấy "hồ sơ biến mất khỏi tìm kiếm".
 *
 * Đọc từ tệp `migration.sql` ĐÃ COMMIT, không từ hàm sinh: đó mới là thứ đã chạy trên máy thật.
 * Cổng `tim-kiem-sinh-khop.gate.spec.ts` lo phần "tệp đã commit ≡ đầu ra bộ sinh", nên hai cổng
 * cộng lại phủ cả hai phía.
 */
const docLF = (tep: string) =>
  fs.readFileSync(tep, 'utf8').replace(/\r\n/g, '\n');

/** Mọi `NEW."ten"` xuất hiện trong thân một khối `CREATE OR REPLACE FUNCTION ... $$ ... $$`. */
function cotTrongThanHam(sql: string): Map<string, Set<string>> {
  const ra = new Map<string, Set<string>>();
  const re =
    /CREATE OR REPLACE FUNCTION (\w+)\(\)[\s\S]*?\$\$([\s\S]*?)\$\$;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const cot = new Set<string>();
    // Chỉ lấy vế PHẢI của phép gán (nguồn đọc), bỏ vế trái (`NEW."x_bd" :=`) vì cột bóng không
    // phải cột nguồn và cố ý KHÔNG nằm trong `UPDATE OF`.
    for (const dong of m[2].split('\n')) {
      const vePhai = dong.includes(':=') ? dong.slice(dong.indexOf(':=')) : '';
      for (const c of vePhai.matchAll(/NEW\."([^"]+)"/g)) cot.add(c[1]);
    }
    ra.set(m[1], cot);
  }
  return ra;
}

/** Danh sách cột của `BEFORE INSERT OR UPDATE OF ...` theo tên hàm trigger gọi. */
function cotTrongUpdateOf(sql: string): Map<string, Set<string>> {
  const ra = new Map<string, Set<string>>();
  const re =
    /BEFORE INSERT OR UPDATE OF ([^\n]*?)\s+ON [^\n]*?\n\s*FOR EACH ROW EXECUTE FUNCTION (\w+)\(\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    ra.set(
      m[2],
      new Set([...m[1].matchAll(/"([^"]+)"/g)].map((c) => c[1])),
    );
  }
  return ra;
}

describe('CỔNG: concat_ws ⊆ UPDATE OF (migration đã commit)', () => {
  const thuMuc = thuMucMigrationTimKiemMoiNhat() as string;
  const sql = docLF(path.join(THU_MUC_MIGRATION, thuMuc, 'migration.sql'));

  it('phép đo CHẠM được vào dữ liệu thật — có hàm trigger và có UPDATE OF', () => {
    const than = cotTrongThanHam(sql);
    const updateOf = cotTrongUpdateOf(sql);
    // Jest không nhận thông điệp ở `expect`, nên gom thành một đối tượng: trượt là đọc ra ngay
    // con số nào bằng 0, thay vì chỉ thấy "expected 0 to be greater than 0".
    const doDuoc = {
      soHam: than.size,
      soTrigger: updateOf.size,
      soCotNguon: [...than.values()].reduce((n, c) => n + c.size, 0),
    };
    expect(doDuoc.soHam).toBeGreaterThan(0);
    expect(doDuoc.soTrigger).toBe(doDuoc.soHam);
    expect(doDuoc.soCotNguon).toBeGreaterThan(0);
  });

  it('không cột nguồn nào nằm ngoài UPDATE OF', () => {
    const than = cotTrongThanHam(sql);
    const updateOf = cotTrongUpdateOf(sql);
    const pham: string[] = [];
    for (const [ham, cot] of than) {
      const cho = updateOf.get(ham);
      if (!cho) {
        pham.push(`hàm "${ham}" không có trigger UPDATE OF nào gọi tới`);
        continue;
      }
      for (const c of cot) {
        if (!cho.has(c)) pham.push(`${ham}: cột "${c}" ghép vào cột bóng mà KHÔNG có trong UPDATE OF`);
      }
    }
    // Trượt ở đây nghĩa là: sửa cột ấy thì trigger KHÔNG chạy, cột bóng giữ giá trị cũ, và hồ sơ
    // tìm không ra theo nội dung mới — không lỗi, không cảnh báo, không ai biết.
    expect(pham).toEqual([]);
  });

  it('đầu ra bộ sinh HIỆN TẠI cũng giữ bất biến ấy (bắt trước khi kịp commit)', () => {
    const moi = sinhMigrationTimKiem(KHAI_TIM_KIEM);
    const than = cotTrongThanHam(moi);
    const updateOf = cotTrongUpdateOf(moi);
    const pham: string[] = [];
    for (const [ham, cot] of than)
      for (const c of cot)
        if (!updateOf.get(ham)?.has(c)) pham.push(`${ham}: "${c}"`);
    expect(pham).toEqual([]);
  });
});
