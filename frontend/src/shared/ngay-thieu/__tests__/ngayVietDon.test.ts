import { describe, it, expect } from 'vitest';
import { docNgayVietDon } from '../ngay-viet-don';

/*
  Bộ đọc ô "Ngày viết đơn" — hợp đồng: chữ gõ LUÔN giữ nguyên văn để in ra Word, và việc đọc
  ra ngày KHÔNG BAO GIỜ được phép chặn.

  Mọi chuỗi dưới đây (trừ nhóm "ngày gõ sạch") là giá trị CÓ THẬT trên prod, lấy từ cột dữ liệu
  thô hệ cũ — 4.454/46.129 hồ sơ mang chữ không đọc ra được một ngày.
*/
describe('docNgayVietDon — ngày gõ sạch thì không giữ chữ', () => {
  it('ngày đủ: suy ra cả ngày thật lẫn EDTF, không cần giữ nguyên văn', () => {
    expect(docNgayVietDon('31/01/2026')).toEqual({
      ngayThat: '2026-01-31',
      edtf: '2026-01-31',
      chu: null,
      hieuLa: '',
    });
  });

  it('ngày thiếu gõ đúng dạng ô: không giữ chữ vì dựng lại y hệt', () => {
    expect(docNgayVietDon('__/__/2026')).toEqual({
      ngayThat: null,
      edtf: '2026-XX-XX',
      chu: null,
      hieuLa: '',
    });
  });

  /*
    `tháng 5/2026` đọc ra `2026-05-XX`, dựng lại thành `__/05/2026`. In bản dựng lại là SỬA LỜI
    cán bộ. Anh chốt: để nguyên chữ đã nhập và cho vào Word.
  */
  it('cùng một ngày nhưng gõ khác cách dựng lại → GIỮ nguyên văn', () => {
    const ra = docNgayVietDon('tháng 5/2026');
    expect(ra.edtf).toBe('2026-05-XX');
    expect(ra.chu).toBe('tháng 5/2026');
  });

  it('ô trống → mọi thứ rỗng, không bịa', () => {
    for (const v of ['', '   ', null, undefined]) {
      expect(docNgayVietDon(v)).toEqual({
        ngayThat: null,
        edtf: null,
        chu: null,
        hieuLa: '',
      });
    }
  });
});

describe('docNgayVietDon — chữ tự do KHÔNG bị chặn', () => {
  /* Đúng chuỗi cán bộ báo 21/09/2026, trước đây bị từ chối "Năm phải đủ 4 chữ số". */
  it('ngày thiếu + ngày đủ + ghi chú: giữ nguyên văn, đọc được mảnh đầu', () => {
    const chu = '../../2026, 31/01/2026 (đơn không có chữ ký người đứng đơn)';
    const ra = docNgayVietDon(chu);
    expect(ra.chu).toBe(chu);
    expect(ra.edtf).toBe('2026-XX-XX');
    expect(ra.ngayThat).toBeNull();
    expect(ra.hieuLa).toContain('in nguyên văn');
  });

  it('hồ sơ gộp nhiều đơn: giữ nguyên văn, lấy ngày ĐẦU để còn lọc', () => {
    const chu = '28/12/2023, 19/12/2023 (03 đơn)';
    const ra = docNgayVietDon(chu);
    expect(ra.chu).toBe(chu);
    expect(ra.ngayThat).toBe('2023-12-28');
    expect(ra.edtf).toBe('2023-12-28');
  });

  it('một ngày kèm ghi chú trong ngoặc: vẫn đọc được ngày', () => {
    const chu = '31/01/2026 (đơn không có chữ ký người đứng đơn)';
    const ra = docNgayVietDon(chu);
    expect(ra.chu).toBe(chu);
    expect(ra.ngayThat).toBe('2026-01-31');
  });

  /*
    Không có gì đọc ra ngày thì vẫn PHẢI lưu được — và phải NÓI RÕ hệ quả, chứ không im lặng
    nhận rồi để cán bộ tưởng lọc được.
  */
  it('không có ngày nào: lưu nguyên văn và nói rõ sẽ không lọc được theo ngày', () => {
    const ra = docNgayVietDon('Không ghi ngày');
    expect(ra.chu).toBe('Không ghi ngày');
    expect(ra.ngayThat).toBeNull();
    expect(ra.edtf).toBeNull();
    expect(ra.hieuLa).toContain('không lọc được theo ngày');
  });

  /*
    Mảnh đầu đọc ra ngày KHÔNG CÓ THẬT thì không được lặng lẽ nhận. 31/02 là ca kinh điển:
    Postgres cuộn nó thành 03/03 nếu lọt.
  */
  it('mảnh đầu là ngày không có thật → không suy ra ngày, vẫn giữ nguyên văn', () => {
    const ra = docNgayVietDon('31/02/2026, 01/03/2026');
    expect(ra.chu).toBe('31/02/2026, 01/03/2026');
    expect(ra.ngayThat).toBeNull();
    expect(ra.edtf).toBeNull();
  });

  /* Chuỗi dài thật trên prod — không được vỡ, không được cắt. */
  it('danh sách 6 ngày kèm số lượng: giữ TRỌN chuỗi', () => {
    const chu =
      '19/4/2021 (03 đơn), 20/4/2021 (9 đơn), 21/4/2021, 22/4/2021 (04 đơn), 23/4/2021, 26/4/2021';
    const ra = docNgayVietDon(chu);
    expect(ra.chu).toBe(chu);
    expect(ra.ngayThat).toBe('2021-04-19');
  });
});

describe('docNgayVietDon — luôn nói ra hệ hiểu gì', () => {
  /*
    Đọc thầm rồi giữ một phần là đúng lớp mất-im-lặng đã phải vá HAI lần ở chính ô này
    (`sangEdtf` vứt phần ngày; `sangEdtf` đệm 0 cho năm). Nên: chữ nào không phải một ngày gõ
    sạch thì BẮT BUỘC có câu giải thích.
  */
  it('mọi chữ tự do đều kèm câu giải thích, không ca nào im lặng', () => {
    const imLang = [
      '../../2026, 31/01/2026 (đơn không có chữ ký người đứng đơn)',
      '28/12/2023, 19/12/2023 (03 đơn)',
      'Không ghi ngày',
      '31/02/2026, 01/03/2026',
    ].filter((c) => !docNgayVietDon(c).hieuLa);
    expect(imLang).toEqual([]);
  });

  it('ngày gõ sạch thì KHÔNG làm phiền bằng câu giải thích', () => {
    expect(docNgayVietDon('31/01/2026').hieuLa).toBe('');
    expect(docNgayVietDon('__/__/2026').hieuLa).toBe('');
  });
});
