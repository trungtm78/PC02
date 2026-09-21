import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: điều kiện tìm kiếm không bao giờ được phá phạm vi dữ liệu.
 *
 * Danh sách hồ sơ lọc theo tổ/điều tra viên (`scope-filter.util.ts`) rồi mới nối điều kiện tìm
 * kiếm vào `where.AND` bằng `noiVaoWhere` — nối, KHÔNG ghi đè. Bất biến ấy là thứ giữ cho một ô
 * tìm kiếm không biến thành đường xem hồ sơ ngoài phạm vi.
 *
 * Đợt mở rộng 21/09/2026 thêm nhánh `OR` cho ngày, trạng thái và người nhập. Một dòng
 * `where.OR = [...]` đặt ở tầng service sẽ ĐÈ lên mảng OR của tính năng khác, và một dòng
 * `where.AND = [...]` sẽ xoá sạch điều kiện phạm vi đã đặt trước đó. Cả hai đều không có ca kiểm
 * đơn vị nào thấy, vì mỗi hàm chạy riêng thì vẫn đúng.
 *
 * Cổng đọc MÃ NGUỒN: mọi điều kiện tìm kiếm phải đi qua `noiVaoWhere`.
 */
const GOC = path.resolve(__dirname, '../..');

const TEP_CANH = [
  'petitions/petitions.service.ts',
  'incidents/incidents.service.ts',
  'cases/cases.service.ts',
  'common/tim-kiem/dieu-kien.ts',
  'common/tim-kiem/bo-tim-kiem.ts',
];

const doc = (t: string) =>
  fs.readFileSync(path.join(GOC, t), 'utf8').replace(/\r\n/g, '\n');

/** Gán đè `where.AND` / `where.OR` — trừ bên trong chính `noiVaoWhere`. */
function ganDe(nguon: string, tep: string): string[] {
  const pham: string[] = [];
  const dong = nguon.split('\n');
  const trongNoiVaoWhere = (i: number): boolean => {
    if (!tep.endsWith('dieu-kien.ts')) return false;
    const truoc = dong.slice(Math.max(0, i - 15), i).join('\n');
    return truoc.includes('export function noiVaoWhere');
  };
  dong.forEach((d, i) => {
    if (/^\s*where(\s*as [^)]*\))?\.(AND|OR)\s*=/.test(d) && !trongNoiVaoWhere(i))
      pham.push(`${tep}:${i + 1} — ${d.trim()}`);
  });
  return pham;
}

describe('CỔNG: tìm kiếm không phá phạm vi dữ liệu', () => {
  it('phép đo CHẠM được vào mã thật — đọc được cả 5 tệp và thấy noiVaoWhere', () => {
    const doDuoc = {
      soTep: TEP_CANH.filter((t) => doc(t).length > 0).length,
      soNoiGoi: TEP_CANH.filter((t) => doc(t).includes('noiVaoWhere')).length,
    };
    expect(doDuoc.soTep).toBe(TEP_CANH.length);
    // Ba service gọi + chính `dieu-kien.ts` khai hàm.
    expect(doDuoc.soNoiGoi).toBeGreaterThanOrEqual(4);
  });

  it('không tệp nào GÁN ĐÈ where.AND / where.OR ngoài noiVaoWhere', () => {
    const pham = TEP_CANH.flatMap((t) => ganDe(doc(t), t));
    // Trượt ở đây nghĩa là một tính năng vừa xoá điều kiện phạm vi của tính năng khác — cán bộ
    // nhìn thấy hồ sơ ngoài tổ mình mà không ai báo lỗi.
    expect(pham).toEqual([]);
  });

  it('ba service đều nối điều kiện tìm kiếm bằng noiVaoWhere', () => {
    const thieu = TEP_CANH.filter(
      (t) => t.endsWith('.service.ts') && !doc(t).includes('noiVaoWhere('),
    );
    expect(thieu).toEqual([]);
  });
});
