import { describe, expect, it } from 'vitest';
import {
  hienThiEdtf,
  loiEdtf,
  loiNgayTungPhan,
  sangEdtf,
  sangNgayDayDu,
  tuChuNhapTay,
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

/**
 * Năm PHẢI đủ 4 chữ số — và luật ấy phải nằm ở `loiNgayTungPhan`, không ở ô nhập.
 *
 * Ô ba phân đoạn che khuyết điểm này: ô năm hiện rõ `20` nên cán bộ tự thấy mình gõ thiếu.
 * Ô một dòng thì `12/20` trông y như một ngày hoàn chỉnh, mà đoán hộ (2020? 1920?) là bịa.
 *
 * Quan trọng hơn: `loiEdtf` gọi thẳng hàm này, còn `validate.ts` gọi `loiEdtf` — nên đặt luật
 * ở đây thì năm thiếu chữ số CHẶN ĐƯỢC nút Lưu. Đặt ở ô nhập thì chỉ hiện chữ đỏ rồi vẫn lưu,
 * và cột nhận `0020-12-XX`.
 */
describe('loiNgayTungPhan — năm phải đủ 4 chữ số', () => {
  it('năm 2 chữ số → báo lỗi (không đoán hộ thế kỷ)', () => {
    expect(loiNgayTungPhan(p('', '12', '20'))).toBeTruthy();
  });

  it('năm 3 chữ số → báo lỗi', () => {
    expect(loiNgayTungPhan(p('', '12', '202'))).toBeTruthy();
  });

  it('năm đủ 4 chữ số → không lỗi', () => {
    expect(loiNgayTungPhan(p('', '12', '2026'))).toBeNull();
  });

  it('luật này CHẶN ĐƯỢC Lưu: loiEdtf thấy năm thiếu chữ số qua sangEdtf', () => {
    // KHÔNG phải '0020-12-XX': đệm 0 cho năm là bịa ra một năm hợp lệ và mở khoá nút Lưu.
    const edtf = sangEdtf(p('', '12', '20'));
    expect(edtf).toBe('20-12-XX');
    expect(loiEdtf(edtf)).toBeTruthy();
  });
});

/**
 * `tuChuNhapTay` — đọc chữ cán bộ gõ/dán vào MỘT ô.
 *
 * Anh yêu cầu bỏ ba ô phân đoạn để dán được một lần. Hàm này là toàn bộ phần "đọc"; mọi phép
 * kiểm vẫn là `loiNgayTungPhan` cũ, không viết lại luật lần hai.
 *
 * Nguyên tắc: KHÔNG đoán hộ. Thiếu thì để trống và báo, không tự điền.
 */
describe('tuChuNhapTay — đọc chữ gõ tay thành ba phần', () => {
  it('rỗng → ba phần rỗng, không lỗi', () => {
    expect(tuChuNhapTay('')).toEqual(p('', '', ''));
    expect(tuChuNhapTay('   ')).toEqual(p('', '', ''));
  });

  it.each(['15/12/2026', '15-12-2026', '15.12.2026', ' 15 / 12 / 2026 '])(
    'đủ ba phần: %s',
    (chu) => {
      expect(tuChuNhapTay(chu)).toEqual(p('15', '12', '2026'));
    },
  );

  it('hai phần → tháng + năm, KHÔNG bịa ngày', () => {
    expect(tuChuNhapTay('12/2026')).toEqual(p('', '12', '2026'));
  });

  it('một phần → chỉ năm', () => {
    expect(tuChuNhapTay('2026')).toEqual(p('', '', '2026'));
  });

  /**
   * Khứ hồi với thứ ô IN RA: `hienThiEdtf` sinh `__/12/2026`, nên dán lại chính nó phải ra
   * đúng thứ ban đầu. Không có mệnh đề này thì cán bộ chép ô này sang ô kia là mất dữ liệu.
   */
  it.each(['2026-12-15', '2026-12-XX', '2026-XX-XX'])(
    'khứ hồi: dán lại đúng thứ hienThiEdtf in ra (%s)',
    (edtf) => {
      expect(sangEdtf(tuChuNhapTay(hienThiEdtf(edtf)))).toBe(edtf);
    },
  );

  it('dãy chữ số liền: 8 số = ngày/tháng/năm, 6 số = tháng/năm, 4 số = năm', () => {
    expect(tuChuNhapTay('15122026')).toEqual(p('15', '12', '2026'));
    expect(tuChuNhapTay('122026')).toEqual(p('', '12', '2026'));
    expect(tuChuNhapTay('2026')).toEqual(p('', '', '2026'));
  });

  it('năm thiếu chữ số KHÔNG bị đoán hộ — giữ nguyên để loiNgayTungPhan báo', () => {
    expect(tuChuNhapTay('12/20')).toEqual(p('', '12', '20'));
    expect(loiNgayTungPhan(tuChuNhapTay('12/20'))).toBeTruthy();
  });

  it('thiếu năm hẳn (15/12) → báo lỗi chứ không lặng lẽ bỏ', () => {
    expect(loiNgayTungPhan(tuChuNhapTay('15/12'))).toBeTruthy();
  });

  it('ngày không có thật vẫn đọc ra ba phần để chặn tại chỗ', () => {
    expect(tuChuNhapTay('31/02/2026')).toEqual(p('31', '02', '2026'));
    expect(loiNgayTungPhan(tuChuNhapTay('31/02/2026'))).toBeTruthy();
  });

  it('thừa phân đoạn → KHÔNG lặng lẽ lấy ba cái đầu rồi báo hợp lệ', () => {
    expect(loiNgayTungPhan(tuChuNhapTay('15/12/2026/99'))).toBeTruthy();
  });
});
