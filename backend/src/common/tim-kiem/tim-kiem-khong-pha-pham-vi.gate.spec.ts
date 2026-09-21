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
  'petitions/bulk/petitions.bulk.service.ts',
  'incidents/bulk/incidents.bulk.service.ts',
  'cases/bulk/cases.bulk.service.ts',
  'common/tim-kiem/dieu-kien.ts',
  'common/tim-kiem/bo-tim-kiem.ts',
];

const doc = (t: string) =>
  fs.readFileSync(path.join(GOC, t), 'utf8').replace(/\r\n/g, '\n');

/**
 * Một dòng có phải phép GÁN ĐÈ `AND`/`OR` trên biến điều kiện không.
 *
 * Tách làm HAI BƯỚC tường minh thay vì một biểu thức chính quy khôn: bước một lấy tên biến và
 * khoá, bước hai hỏi tên biến có phải biến điều kiện không. Bản đầu gộp cả vào một mẫu neo cứng
 * chữ `where` và XANH RỖNG với `baseWhere.OR = …`, `(where as T).AND = …`, `where['AND'] = …`
 * và `??=` — lúc ấy có BỐN dòng gán đè đang sống trong chính tệp cổng nói là đang canh. Một cổng
 * chỉ bắt được cách viết mà tác giả nghĩ tới thì không phải cổng.
 */
export function laGanDe(dong: string): boolean {
  const m =
    /^\s*\(?\s*([A-Za-z_$][\w$]*)(?:\s+as\s+[^)]*\))?\s*(?:\.(?:AND|OR)|\[\s*['"](?:AND|OR)['"]\s*\])\s*(?:\?\?)?=(?!=)/.exec(
      dong,
    );
  return m !== null && /where/i.test(m[1]);
}

/** Mọi dòng gán đè trong một tệp — trừ bên trong chính `noiVaoWhere`. */
function ganDe(nguon: string, tep: string): string[] {
  const pham: string[] = [];
  const dong = nguon.split('\n');
  const trongNoiVaoWhere = (i: number): boolean => {
    if (!tep.endsWith('dieu-kien.ts')) return false;
    // Quét tới ĐẦU tệp thay vì 15 dòng cố định: thêm vài dòng chú thích vào `noiVaoWhere` không
    // được làm cổng đỏ giả. Khai hàm gần nhất phía trên quyết định ta đang ở trong hàm nào.
    const khaiHam = dong
      .slice(0, i)
      .filter((d) => /^(export )?function /.test(d));
    return (
      khaiHam.length > 0 && khaiHam[khaiHam.length - 1].includes('noiVaoWhere')
    );
  };
  dong.forEach((d, i) => {
    if (laGanDe(d) && !trongNoiVaoWhere(i))
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

  /**
   * Bản đầu của ca này chỉ hỏi "tệp có chứa chuỗi `noiVaoWhere(` không" — xanh rỗng: một tệp có
   * MỘT đường dùng đúng và MỘT đường chép tay vẫn xanh, và đó đúng là tình trạng của
   * `incidents.service.ts` lúc ấy. Nay đếm: số lần gán đè phải bằng 0 ở MỌI tệp canh, và mỗi
   * service phải gọi `noiVaoWhere` ít nhất một lần.
   */
  it('mỗi service gọi noiVaoWhere, và KHÔNG tệp nào còn đường chép tay', () => {
    const doDuoc = TEP_CANH.filter((t) => t.endsWith('.service.ts')).map((t) => ({
      tep: t,
      soGoi: (doc(t).match(/noiVaoWhere\(/g) ?? []).length,
      soGanDe: ganDe(doc(t), t).length,
    }));
    expect(doDuoc.filter((d) => d.soGoi === 0)).toEqual([]);
    expect(doDuoc.filter((d) => d.soGanDe > 0)).toEqual([]);
  });

  /**
   * Cổng chỉ có giá trị nếu phép dò BẮT được các cách viết thật. Ca này chạy `laGanDe` trên
   * một bộ mẫu — vừa là tài liệu, vừa chặn ai đó thu hẹp lại phép dò.
   */
  it('phép dò bắt được mọi cách viết gán đè đã biết', () => {
    const batDuoc = [
      '  where.AND = [x];',
      '  where.OR = orConditions;',
      '  baseWhere.OR = orConditions;',
      "  baseWhere.AND = [{ OR: baseWhere.OR }];",
      '  (where as Prisma.PetitionWhereInput).AND = [x];',
      "  where['AND'] = [x];",
      '  where.AND ??= [];',
    ].filter((d) => !laGanDe(d));
    expect(batDuoc).toEqual([]);

    // KHÔNG được bắt nhầm phép ĐỌC hay phép so.
    const batNham = [
      '  if (where.AND) {',
      '  const cu = where.AND;',
      '  noiVaoWhere(where as Record<string, unknown>, [x]);',
      '  expect(where.AND).toEqual([]);',
    ].filter((d) => laGanDe(d));
    expect(batNham).toEqual([]);
  });
});
