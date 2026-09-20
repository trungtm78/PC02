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
 */
const THU_MUC = join(__dirname);

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
  const tep = tepNguon(THU_MUC);

  it('có tệp để quét — cổng quét 0 tệp mà vẫn xanh là cổng vô nghĩa', () => {
    expect(tep.length).toBeGreaterThan(3);
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
      const mau = /resolve\s*:/g;
      let m: RegExpExecArray | null;
      while ((m = mau.exec(than)) !== null) {
        const cua = than.slice(m.index, m.index + 400);
        if (/petitionDate/.test(cua) && !/ngayVietDonHienThi/.test(cua)) {
          pham.push(relative(THU_MUC, duong) + ': ' + cua.slice(0, 80));
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
