import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * CỔNG: mọi nơi IN "Ngày viết đơn" phải đi qua `ngayVietDonHienThi`.
 *
 * Hồ sơ giữ hai cột — `petitionDate` (ngày thật, chỉ có khi nhập ĐỦ) và `ngayVietDonEdtf`
 * (EDTF, có cả khi nhập thiếu). Nơi nào đọc thẳng `petitionDate` để in thì đơn nhập thiếu
 * thành phần in ra RỖNG trên một văn bản gửi ra ngoài ngành — mất im lặng, bản in trông vẫn
 * bình thường, chỉ thiếu một dòng.
 *
 * Bản đầu của cổng soi ĐÚNG MỘT tệp (`field-catalog.ts`) và đòi hai chữ trên CÙNG một dòng —
 * nên nó bỏ lọt `khoa-he-cu.ts` (mẫu Word hệ cũ, lỗi thật đã gặp) và thua một dòng xuống hàng.
 * Nay quét CẢ thư mục và soi theo khối.
 *
 * 21/09/2026 — LẦN THỨ BA cùng một nguyên nhân: phạm vi quá hẹp. Cổng chỉ quét
 * `document-templates/` nên bỏ lọt `petitions/xuat-danh-sach-don-thu.ts`, và bộ XUẤT EXCEL trả
 * cột "Ngày viết đơn" rỗng đúng với ~4.400 hồ sơ chỉ có ngày thiếu thành phần. Cán bộ lọc theo
 * cột ấy rồi bấm Xuất là nhận tệp trống trơn đúng cột vừa lọc.
 *
 * Bài học: "in" không chỉ là chứng từ Word. Mọi nơi BIẾN ngày viết đơn thành CHỮ cho người đọc
 * — chứng từ, Excel, giao diện — đều phải đi qua một hàm. Nay quét cả `petitions/`.
 */
const THU_MUC = join(__dirname);
const THU_MUC_QUET = [THU_MUC, join(__dirname, '..', 'petitions')];

/** Bỏ chú thích — cổng kiểm MÃ, không kiểm lời văn giải thích. */
function boChuThich(than: string): string {
  return than.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function tepNguon(thuMuc: string): string[] {
  return readdirSync(thuMuc).flatMap((ten) => {
    const duong = join(thuMuc, ten);
    if (statSync(duong).isDirectory()) return tepNguon(duong);
    return /\.ts$/.test(ten) && !/\.spec\.ts$/.test(ten) ? [duong] : [];
  });
}

describe('Mọi nơi in Ngày viết đơn đi qua một hàm', () => {
  const tep = THU_MUC_QUET.flatMap(tepNguon);

  it('có tệp để quét — cổng quét 0 tệp mà vẫn xanh là cổng vô nghĩa', () => {
    expect(tep.length).toBeGreaterThan(3);
    // Và phải quét CẢ hai thư mục: quét mỗi `document-templates/` là đúng phạm vi hẹp đã để
    // lọt lỗi ba lần.
    expect(tep.some((d) => d.includes('petitions'))).toBe(true);
  });

  it('không `resolve` nào đọc thẳng `petitionDate`', () => {
    /*
      Soi THÂN của từng `resolve`, không soi cả tệp: bảng khai cột được phép nhắc
      `petitionDate` (đó là cột nguồn), cái cấm là ĐỌC THẲNG nó để dựng chuỗi in.
      Lấy một cửa sổ sau mỗi `resolve:` để một biểu thức xuống hàng vẫn bị bắt.
    */
    const pham: string[] = [];
    for (const duong of tep) {
      const than = boChuThich(readFileSync(duong, 'utf8'));
      // `resolve:` (bộ khoá in chứng từ) và `doc:` (bộ khai cột xuất Excel) — hai tên khác
      // nhau cho cùng một việc: biến cột thành CHỮ cho người đọc.
      const mau = /(?:resolve|doc)\s*:/g;
      let m: RegExpExecArray | null;
      while ((m = mau.exec(than)) !== null) {
        /*
          Cắt cửa sổ tại CUỐI biểu thức, không đếm 400 ký tự.

          Trong tệp khai cột xuất, các cột nằm sát nhau nên cửa sổ đếm ký tự chạm sang khai
          cột kế bên và báo nhầm: `doc: (d) => ngayVN(d.createdAt)` bị quy tội vì cột
          `petitionDate` đứng ngay dưới. Một cổng báo nhầm sẽ bị người ta tắt đi.
        */
        const con = than.slice(m.index);
        const het = con.search(/\n\s*\},/);
        const cua = con.slice(0, het === -1 ? 400 : het);
        if (/petitionDate/.test(cua) && !/ngayVietDonHienThi/.test(cua)) {
          pham.push(relative(join(__dirname, '..'), duong) + ': ' + cua.slice(0, 80));
        }
      }
    }
    expect(pham).toEqual([]);
  });

  it('cả hai bộ khoá in ĐỀU gọi hàm dùng chung', () => {
    const thieu = ['field-catalog.ts', 'khoa-he-cu.ts'].filter(
      (ten) =>
        !/ngayVietDonHienThi\s*\(/.test(
          boChuThich(readFileSync(join(THU_MUC, ten), 'utf8')),
        ),
    );
    expect(thieu).toEqual([]);
  });
});
