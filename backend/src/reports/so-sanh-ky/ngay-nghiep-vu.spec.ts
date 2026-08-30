import { COT_NGAY_TIEP_NHAN, NAM_HOP_LE, ngayHopLe } from './ngay-nghiep-vu';

describe('Cột ngày nghiệp vụ', () => {
  /**
   * Ghim tên cột. Đổi cột là đổi ý nghĩa của MỌI báo cáo kỳ — phải là một quyết định có ý thức,
   * kèm số đo phủ mới, chứ không phải một lần đổi tên biến cho gọn.
   */
  it('mỗi thực thể khai đúng một cột, và là cột đã đo phủ', () => {
    expect(COT_NGAY_TIEP_NHAN).toEqual({
      petition: 'receivedDate',
      incident: 'ngayDeXuat',
      case: 'receiveDate',
    });
  });

  it('KHÔNG thực thể nào dùng createdAt — đó là ngày nhập máy, không phải ngày tiếp nhận', () => {
    expect(Object.values(COT_NGAY_TIEP_NHAN)).not.toContain('createdAt');
  });
});

describe('ngayHopLe', () => {
  it('ngày trong khoảng là hợp lệ', () => {
    expect(ngayHopLe(new Date(2026, 7, 30))).toBe(true);
    expect(ngayHopLe(new Date(NAM_HOP_LE.tu, 0, 1))).toBe(true);
    expect(ngayHopLe(new Date(NAM_HOP_LE.den, 11, 31))).toBe(true);
  });

  it('năm rác của hệ cũ bị loại — đo được 2 hồ sơ năm 225 và 226', () => {
    expect(ngayHopLe(new Date(225, 0, 1))).toBe(false);
    expect(ngayHopLe(new Date(3023, 0, 1))).toBe(false);
  });

  it('không có ngày thì không hợp lệ, và không đổ vỡ', () => {
    expect(ngayHopLe(null)).toBe(false);
    expect(ngayHopLe(undefined)).toBe(false);
  });
});

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { NGAY_TIEP_NHAN_BAT_BUOC, COT_NGAY_TIEP_NHAN as COT } from './ngay-nghiep-vu';

/**
 * Cột BẮT BUỘC thì không được hỏi rỗng.
 *
 * Codex bắt trong chính bản vá này: phép đếm "hồ sơ thiếu ngày" dựng điều kiện bằng khoá động
 * rồi dùng `as never` để bịt lời cảnh báo kiểu. Lời cảnh báo ấy đúng —
 * `Petition.receivedDate` là `DateTime` không cho phép rỗng, nên `{ receivedDate: null }` là
 * điều kiện sai kiểu mà Prisma có thể từ chối LÚC CHẠY, làm hỏng cả endpoint báo cáo. Ép kiểu
 * đã biến một lỗi biên dịch thành một lỗi chỉ hiện ra trên máy thật.
 */
describe('Cột bắt buộc không được hỏi rỗng', () => {
  /**
   * Bóc dòng chú thích trước khi soi. Chú thích trong chính tệp ấy có nhắc `{ receivedDate:
   * null }` để giải thích cái bẫy — và cổng đã bắt trúng câu giải thích ấy. Một cổng tố cáo
   * chính lời cảnh báo của mình là cổng sẽ bị tắt.
   */
  const MA = readFileSync(resolve(__dirname, '../reports.service.ts'), 'utf8')
    .split(String.fromCharCode(10))
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join(String.fromCharCode(10));

  it('lược đồ khai đúng cột nào bắt buộc', () => {
    expect(NGAY_TIEP_NHAN_BAT_BUOC).toEqual({ petition: true, incident: false, case: false });
  });

  it('không truy vấn nào hỏi rỗng trên cột bắt buộc', () => {
    const pham: string[] = [];
    for (const [thucThe, batBuoc] of Object.entries(NGAY_TIEP_NHAN_BAT_BUOC)) {
      if (!batBuoc) continue;
      const cot = COT[thucThe as keyof typeof COT];
      // Không dùng regex: `\s` trong template literal của TypeScript chỉ là chữ `s`, nên
      // mẫu `${cot}\s*:\s*null` lặng lẽ thành `receivedDates*:s*null` và không bao giờ khớp —
      // cổng xanh vì lý do sai. Bỏ hết khoảng trắng rồi so chuỗi thẳng.
      if (MA.replace(/\s/g, '').includes(`${cot}:null`)) pham.push(`${thucThe}.${cot}`);
    }
    expect(pham).toEqual([]);
  });

  /**
   * Và cấm luôn cách né: ép kiểu để bịt trình biên dịch trong chính tệp này. Mỗi lần ép kiểu ở
   * điều kiện truy vấn là một lần đổi lỗi biên dịch lấy lỗi lúc chạy.
   */
  it('không ép kiểu để bịt trình biên dịch trong reports.service.ts', () => {
    const dong = MA.split(String.fromCharCode(10))
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .filter((l) => /as (never|any|unknown as)/.test(l));
    expect(dong).toEqual([]);
  });
});
