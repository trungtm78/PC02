import { describe, expect, it } from 'vitest';
import {
  hienThiEdtf,
  loiNgayTungPhan,
  sangEdtf,
  sangNgayDayDu,
  tuEdtf,
  type NgayTungPhan,
} from '../edtf';

/**
 * "Ngày viết đơn" phải nhận được ngày THIẾU thành phần — giấy tờ nhiều khi chỉ ghi tháng/năm.
 *
 * Lưu theo EDTF Level 1 (ISO 8601-2, chuẩn Library of Congress cho ngày không đầy đủ):
 * `2026-12-15` · `2026-12-XX` · `2026-XX-XX`. Chọn nó thay vì lưu nguyên văn "__/12/2026" vì
 * chuỗi EDTF SẮP XẾP đúng thứ tự thời gian bằng so chuỗi, và lọc "tháng 12/2026" chạy thẳng
 * bằng `LIKE '2026-12%'` trên cả đơn nhập đủ lẫn nhập thiếu. Lưu nguyên văn thì cột chỉ để
 * hiện, không dùng được vào việc gì.
 *
 * KHÔNG BAO GIỜ bịa ngày 01: thiếu ngày thì cột ngày thật để trống.
 */
const p = (ngay: string, thang: string, nam: string): NgayTungPhan => ({ ngay, thang, nam });

describe('sangEdtf', () => {
  it('đủ ba phần → ngày đầy đủ', () => {
    expect(sangEdtf(p('15', '12', '2026'))).toBe('2026-12-15');
  });

  it('thiếu NGÀY → 2026-12-XX', () => {
    expect(sangEdtf(p('', '12', '2026'))).toBe('2026-12-XX');
  });

  it('thiếu cả ngày lẫn tháng → 2026-XX-XX', () => {
    expect(sangEdtf(p('', '', '2026'))).toBe('2026-XX-XX');
  });

  it('rỗng hoàn toàn → null, không dựng chuỗi rác', () => {
    expect(sangEdtf(p('', '', ''))).toBeNull();
  });

  it('đệm 0 cho ngày/tháng một chữ số — so chuỗi mới sắp đúng', () => {
    expect(sangEdtf(p('5', '3', '2026'))).toBe('2026-03-05');
  });

  it('thiếu NĂM thì không dựng được — năm là phần không thể thiếu', () => {
    expect(sangEdtf(p('15', '12', ''))).toBeNull();
  });
});

describe('tuEdtf — vòng khứ hồi', () => {
  it.each([
    ['2026-12-15', ['15', '12', '2026']],
    ['2026-12-XX', ['', '12', '2026']],
    ['2026-XX-XX', ['', '', '2026']],
  ])('%s → %s', (edtf, mong) => {
    const r = tuEdtf(edtf as string);
    expect([r.ngay, r.thang, r.nam]).toEqual(mong);
  });

  it('null/rỗng → ba ô rỗng', () => {
    expect(tuEdtf(null)).toEqual({ ngay: '', thang: '', nam: '' });
  });

  it('khứ hồi giữ nguyên: gõ → EDTF → đọc lại ra ĐÚNG thứ đã gõ', () => {
    for (const x of [p('15', '12', '2026'), p('', '12', '2026'), p('', '', '2026')]) {
      expect(tuEdtf(sangEdtf(x))).toEqual(x);
    }
  });
});

describe('sangNgayDayDu — cột ngày thật', () => {
  it('đủ ba phần → chuỗi ngày ISO cho cột DATE', () => {
    expect(sangNgayDayDu(p('15', '12', '2026'))).toBe('2026-12-15');
  });

  it('thiếu bất kỳ phần nào → null, KHÔNG BAO GIỜ bịa ngày 01', () => {
    expect(sangNgayDayDu(p('', '12', '2026'))).toBeNull();
    expect(sangNgayDayDu(p('', '', '2026'))).toBeNull();
  });
});

describe('hienThiEdtf', () => {
  it.each([
    ['2026-12-15', '15/12/2026'],
    ['2026-12-XX', '__/12/2026'],
    ['2026-XX-XX', '__/__/2026'],
  ])('%s hiện là %s', (edtf, mong) => {
    expect(hienThiEdtf(edtf as string)).toBe(mong);
  });

  it('rỗng → chuỗi rỗng, không hiện "__/__/____" trống trơn', () => {
    expect(hienThiEdtf(null)).toBe('');
  });
});

describe('loiNgayTungPhan — validate ngày RÁP LẠI, không validate từng ô', () => {
  it('31/02 là ngày không có thật → báo lỗi, dù từng ô đều trong khoảng', () => {
    expect(loiNgayTungPhan(p('31', '02', '2026'))).toBeTruthy();
  });

  it('29/02 năm không nhuận → báo lỗi', () => {
    expect(loiNgayTungPhan(p('29', '02', '2026'))).toBeTruthy();
  });

  it('29/02 năm NHUẬN → hợp lệ', () => {
    expect(loiNgayTungPhan(p('29', '02', '2024'))).toBeNull();
  });

  it('tháng 13 → báo lỗi', () => {
    expect(loiNgayTungPhan(p('', '13', '2026'))).toBeTruthy();
  });

  it('thiếu từ trái sang phải thì được: __/12/2026 hợp lệ', () => {
    expect(loiNgayTungPhan(p('', '12', '2026'))).toBeNull();
  });

  it('thiếu từ PHẢI sang trái thì vô nghĩa: 15/__/2026 → báo lỗi', () => {
    expect(loiNgayTungPhan(p('15', '', '2026'))).toBeTruthy();
  });

  it('có ngày+tháng mà thiếu NĂM → báo lỗi', () => {
    expect(loiNgayTungPhan(p('15', '12', ''))).toBeTruthy();
  });

  it('rỗng hoàn toàn → không lỗi (ô không bắt buộc)', () => {
    expect(loiNgayTungPhan(p('', '', ''))).toBeNull();
  });
});
