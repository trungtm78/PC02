import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: route có đường dẫn TĨNH phải khai TRƯỚC mọi route `:id` trong cùng controller.
 *
 * Nest khớp route theo thứ tự khai. `@Get(':id')` đứng trước `@Get('goi-y-ten-nguoi-gui')` thì
 * mọi lượt gọi đường dẫn tĩnh rơi vào nhánh đọc hồ sơ với `id = "goi-y-ten-nguoi-gui"` và trả
 * 404 "không tìm thấy đơn thư" — một lỗi không có dấu vết nào trong mã, chỉ lộ khi bấm thử.
 *
 * Đây là lớp lỗi đã có tiền lệ trong chính kho này: `/incidents/new` từng rơi vào
 * `/incidents/:id` và gọi `GET /incidents/new` → 404 (xem `features/incidents/routes.tsx:19-21`).
 */
const GOC = path.resolve(__dirname, '..', '..', '..');

const CONTROLLER = [
  'backend/src/petitions/petitions.controller.ts',
  'backend/src/cases/cases.controller.ts',
  'backend/src/incidents/incidents.controller.ts',
];

/** Đường dẫn của mỗi decorator `@Get/@Post/@Put/@Patch/@Delete('...')`, theo thứ tự trong tệp. */
function duongDanTheoThuTu(src: string): { duong: string; viTri: number }[] {
  const ra: { duong: string; viTri: number }[] = [];
  const re = /@(?:Get|Post|Put|Patch|Delete)\(\s*'([^']*)'\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) ra.push({ duong: m[1], viTri: m.index });
  return ra;
}

describe.each(CONTROLLER)('CỔNG thứ tự route — %s', (tuongDoi) => {
  const duong = path.join(GOC, tuongDoi);

  it('đọc được tệp và thấy route', () => {
    expect(fs.existsSync(duong)).toBe(true);
    expect(duongDanTheoThuTu(fs.readFileSync(duong, 'utf8')).length).toBeGreaterThan(5);
  });

  /**
   * Nuốt hay không phải so TỪNG ĐOẠN, không phải đếm số đoạn.
   *
   * Bản đầu của cổng chỉ so số đoạn và báo `'export/danh-sach'` bị `':id/export-readiness'`
   * nuốt — sai: đoạn thứ hai khác nhau nên Nest không bao giờ khớp. Một cổng đọc RỘNG hơn thực
   * tế thì mọi lần đỏ đều là báo động giả, rồi tới lúc nó đỏ thật không ai buồn nhìn.
   */
  it('không route TĨNH nào bị một route tham số khai TRƯỚC nó nuốt', () => {
    const ds = duongDanTheoThuTu(fs.readFileSync(duong, 'utf8'));
    const doan = (d: string) => d.split('/').filter(Boolean);

    /** `truoc` nuốt `sau` khi mọi đoạn hoặc là tham số, hoặc trùng chữ. */
    const nuot = (truoc: string, sau: string): boolean => {
      const a = doan(truoc);
      const b = doan(sau);
      if (a.length !== b.length) return false;
      return a.every((x, k) => x.startsWith(':') || x === b[k]);
    };

    const pham: string[] = [];
    for (let i = 0; i < ds.length; i++) {
      const t = ds[i];
      if (t.duong.includes(':') || t.duong === '') continue;
      for (let j = 0; j < i; j++)
        if (ds[j].duong.includes(':') && nuot(ds[j].duong, t.duong))
          pham.push(`'${t.duong}' khai SAU '${ds[j].duong}' → bị nuốt`);
    }
    expect(pham).toEqual([]);
  });
});
