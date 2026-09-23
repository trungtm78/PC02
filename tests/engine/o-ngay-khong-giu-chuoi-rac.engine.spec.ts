import { test, expect } from '@playwright/test';
import { giaTriONgay } from '../../frontend/src/features/legacy-form/gia-tri-o-ngay';

/**
 * CỔNG ENGINE: `<input type="date">` xử lý giá trị KHÔNG hợp lệ khác nhau giữa các engine.
 *
 * Đo 23/09/2026, cùng một trang, chỉ khác engine:
 *
 *     value="undefined"  →  Chromium ""            (làm sạch theo đặc tả HTML)
 *                        →  WebKit   "undefined"   (GIỮ NGUYÊN chuỗi rác)
 *
 * WebKit là engine Safari. Nên chuỗi hỏng sống sót trên máy macOS rồi ĐI LÊN MÁY CHỦ lúc bấm
 * Lưu, còn trên Windows cùng bản dựng ấy ô chỉ hiện rỗng — không ai thấy gì bất thường.
 *
 * VÌ SAO PHẢI CHẠY Ở ĐÂY CHỨ KHÔNG Ở BỘ KIỂM ĐƠN VỊ: jsdom làm sạch y hệt Chromium. Đo cùng
 * ngày: `value="undefined"` cho `""` trên jsdom. Nên toàn bộ ~3.960 ca frontend MÙ với lớp lỗi
 * này — một ca kiểm jsdom khẳng định "chuỗi rác không lọt ra ô" vẫn xanh kể cả khi bỏ hẳn phép
 * làm sạch. Đây là cổng DUY NHẤT trong kho chạm được tới hành vi ấy.
 *
 * GIỚI HẠN — Codex nêu 24/09/2026: cổng này gọi THẲNG `giaTriONgay` rồi gán vào một ô tự
 * dựng, nên nó KHÔNG chứng minh bộ dựng form có gọi hàm ấy. Gỡ hàm khỏi component thì cổng
 * này vẫn xanh. Phần nối dây do `oNgayLamSachKhiDung.test.tsx` canh (mệnh đề ISO), và phần
 * chống trôi do `oNgayKhongNhanChuoiTran.gate.test.ts` canh. Ba cổng, ba việc khác nhau —
 * đừng nhập chúng lại rồi tưởng một cổng lo hết.
 */

/** Đặt `value` rồi đọc lại đúng như trình duyệt hiểu. */
async function docLai(page: import('@playwright/test').Page, v: string): Promise<string> {
  await page.setContent('<input id="o" type="date">');
  return page.evaluate((giaTri) => {
    const o = document.getElementById('o') as HTMLInputElement;
    o.setAttribute('value', giaTri);
    o.value = giaTri;
    return o.value;
  }, v);
}

const RAC = ['undefined', 'null', 'NaN', '15/03/2021', 'Không ghi ngày', '2021-02-30',
  '2021-13-01',
  // Đúng DẠNG nhưng đặc tả HTML đòi năm > 0. Chính cổng này bắt được 24/09/2026:
  // hàm cho nó đi qua, Chromium TỪ CHỐI (ô về rỗng), WebKit GIỮ NGUYÊN.
  '0000-01-01'];

test.describe('Ô ngày — hợp đồng theo engine', () => {
  /**
   * Mệnh đề NỀN: ghi lại phép đo làm nên bản vá.
   *
   * Nếu một bản WebKit tương lai bắt đầu làm sạch giống Chromium thì mệnh đề này ĐỎ — và đó là
   * tin tốt cần biết, không phải lỗi. Khi ấy đọc lại `gia-tri-o-ngay.ts` xem còn cần không.
   */
  test('WebKit GIỮ chuỗi rác, Chromium thì làm sạch — phép đo nền', async ({ page, browserName }) => {
    const doc = await docLai(page, 'undefined');
    if (browserName === 'webkit') {
      expect(doc, 'WebKit đã đổi hành vi — đọc lại xem bản vá còn cần không').toBe('undefined');
    } else {
      expect(doc).toBe('');
    }
  });

  /**
   * MỆNH ĐỀ CHÍNH: thứ `giaTriONgay` cho ra, một ô ngày THẬT phải nhận nguyên vẹn.
   *
   * Đây mới là hợp đồng cần canh. Nó đúng trên MỌI engine, nên không cần rẽ nhánh theo
   * `browserName` — và chính vì thế nó bắt được cả trường hợp hàm sinh ra chuỗi mà Safari
   * không nuốt (vd `+010000-01`, lỗi Codex bắt 23/09).
   */
  for (const v of RAC) {
    test(`chuỗi rác "${v}" — sau khi làm sạch, ô ngày nhận nguyên vẹn`, async ({ page }) => {
      const sach = giaTriONgay(v);
      expect(sach, `"${v}" phải bị làm sạch về rỗng`).toBe('');
      expect(await docLai(page, sach)).toBe(sach);
    });
  }

  for (const v of ['2021-03-15', '0001-01-01', '0099-01-01', '0096-02-29', '2024-02-29', '9999-12-31']) {
    test(`ngày thật "${v}" — làm sạch xong ô ngày vẫn nhận`, async ({ page }) => {
      const sach = giaTriONgay(v);
      expect(sach, `"${v}" là ngày có thật, không được xoá`).toBe(v);
      // Chỗ này bắt được lỗi hàm sinh ra chuỗi ĐÚNG DẠNG mà trình duyệt vẫn từ chối.
      expect(await docLai(page, sach)).toBe(v);
    });
  }

  /**
   * Nhánh `Date` phải có ca HỢP LỆ, không chỉ ca bị chặn.
   *
   * Codex bắt 24/09/2026: trước đó nhánh `Date` chỉ có một ca (năm 10000, kỳ vọng rỗng), nên
   * sửa nó thành `return ''` vô điều kiện thì cổng VẪN XANH. Mọi ca ngày hợp lệ đều đi đường
   * chuỗi. Đây là cổng rỗng ở một nhánh cụ thể — thứ khó thấy vì phần còn lại của cổng chạy tốt.
   */
  for (const [ten, nam, thang, ngay, mong] of [
    ['năm thường', 2021, 3, 15, '2021-03-15'],
    ['năm nhuận', 2024, 2, 29, '2024-02-29'],
    ['biên dưới', 1, 1, 1, '0001-01-01'],
    ['năm hai chữ số', 99, 1, 1, '0099-01-01'],
    ['biên trên', 9999, 12, 31, '9999-12-31'],
  ] as ReadonlyArray<readonly [string, number, number, number, string]>) {
    test(`Date hợp lệ (${ten}) — ra đúng ngày, và ô ngày nhận`, async ({ page }) => {
      const d = new Date(Date.UTC(2000, 0, 1));
      d.setUTCFullYear(nam, thang - 1, ngay);
      const sach = giaTriONgay(d);
      expect(sach, 'nhánh Date không được trả rỗng cho ngày có thật').toBe(mong);
      expect(await docLai(page, sach)).toBe(mong);
    });
  }

  test('dấu thời gian ISO — cắt về ngày, và ô ngày nhận', async ({ page }) => {
    const sach = giaTriONgay('2021-03-15T23:59:59.000Z');
    expect(sach).toBe('2021-03-15');
    expect(await docLai(page, sach)).toBe('2021-03-15');
  });

  test('Date năm ngoài dải — KHÔNG được sinh chuỗi ISO mở rộng', async ({ page }) => {
    // `toISOString()` của năm 10000 ra "+010000-01-01T…"; cắt 10 ký tự cho "+010000-01".
    const d = new Date(Date.UTC(2000, 0, 1));
    d.setUTCFullYear(10000);
    const sach = giaTriONgay(d);
    expect(sach).toBe('');
    expect(await docLai(page, sach)).toBe('');
  });
});
