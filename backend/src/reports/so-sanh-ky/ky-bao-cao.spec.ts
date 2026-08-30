import {
  kyThang,
  kyQuy,
  kyNam,
  cungKyNamTruoc,
  kyLienTruoc,
  soNgayDaTroi,
  kyChuaTron,
  catTheoTienDo,
  kyLuyKe,
  kyTuyChon,
} from './ky-bao-cao';

/** Ngày cuối cùng của kỳ, đọc ra dạng dễ đối chiếu bằng mắt. */
function moc(k: { tu: Date; den: Date }): [string, string] {
  const f = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return [f(k.tu), f(k.den)];
}

describe('Dựng kỳ — độ dài tháng tự đúng', () => {
  it('tháng 31 ngày', () => expect(moc(kyThang(2026, 1))).toEqual(['2026-01-01', '2026-01-31']));
  it('tháng 30 ngày', () => expect(moc(kyThang(2026, 4))).toEqual(['2026-04-01', '2026-04-30']));
  it('tháng 2 năm thường có 28 ngày', () =>
    expect(moc(kyThang(2027, 2))).toEqual(['2027-02-01', '2027-02-28']));
  it('tháng 2 năm nhuận có 29 ngày', () =>
    expect(moc(kyThang(2028, 2))).toEqual(['2028-02-01', '2028-02-29']));
  it('tháng 12 không tràn sang năm sau', () =>
    expect(moc(kyThang(2026, 12))).toEqual(['2026-12-01', '2026-12-31']));

  it('kỳ ôm trọn tới 23:59:59.999 — hồ sơ nhập lúc 22h tối ngày cuối vẫn thuộc kỳ', () => {
    const k = kyThang(2026, 1);
    expect(k.den.getHours()).toBe(23);
    expect(k.den.getMinutes()).toBe(59);
    expect(new Date(2026, 0, 31, 22, 0).getTime()).toBeLessThanOrEqual(k.den.getTime());
  });

  it('quý gồm đúng ba tháng', () => {
    expect(moc(kyQuy(2026, 1))).toEqual(['2026-01-01', '2026-03-31']);
    expect(moc(kyQuy(2026, 4))).toEqual(['2026-10-01', '2026-12-31']);
  });

  it('năm', () => expect(moc(kyNam(2026))).toEqual(['2026-01-01', '2026-12-31']));

  it('tháng và quý ngoài dải thì ném lỗi, không lặng lẽ trả kỳ sai', () => {
    expect(() => kyThang(2026, 0)).toThrow();
    expect(() => kyThang(2026, 13)).toThrow();
    expect(() => kyQuy(2026, 5)).toThrow();
  });
});

describe('Cùng kỳ năm trước', () => {
  it('tháng 2 NHUẬN lùi về tháng 2 THƯỜNG — 28 ngày, không trượt sang 1/3', () => {
    expect(moc(cungKyNamTruoc(kyThang(2028, 2)))).toEqual(['2027-02-01', '2027-02-28']);
  });

  it('giữ nguyên loại và số kỳ', () => {
    const k = cungKyNamTruoc(kyQuy(2026, 3));
    expect(k.loai).toBe('QUY');
    expect(k.so).toBe(3);
    expect(moc(k)).toEqual(['2025-07-01', '2025-09-30']);
  });

  it('nhãn nói đúng kỳ nào, để câu "so với …" không mơ hồ', () => {
    expect(cungKyNamTruoc(kyThang(2026, 8)).nhan).toBe('tháng 8/2025');
    expect(cungKyNamTruoc(kyNam(2026)).nhan).toBe('năm 2025');
  });
});

describe('Kỳ liền trước', () => {
  it('tháng 1 lùi về tháng 12 NĂM TRƯỚC', () => {
    expect(moc(kyLienTruoc(kyThang(2026, 1)))).toEqual(['2025-12-01', '2025-12-31']);
  });
  it('quý 1 lùi về quý 4 năm trước', () => {
    expect(moc(kyLienTruoc(kyQuy(2026, 1)))).toEqual(['2025-10-01', '2025-12-31']);
  });
  it('tháng giữa năm lùi bình thường', () => {
    expect(moc(kyLienTruoc(kyThang(2026, 8)))).toEqual(['2026-07-01', '2026-07-31']);
  });
  it('năm lùi một năm', () => expect(kyLienTruoc(kyNam(2026)).nam).toBe(2025));
});

describe('Kỳ chưa trọn', () => {
  it('đang ở giữa kỳ thì kỳ chưa trọn', () => {
    expect(kyChuaTron(kyThang(2026, 8), new Date(2026, 7, 10, 9))).toBe(true);
  });
  it('kỳ đã đóng thì trọn', () => {
    expect(kyChuaTron(kyThang(2026, 7), new Date(2026, 7, 10))).toBe(false);
  });
  it('ngày 10 là đã trôi 10 ngày, tính cả ngày đầu', () => {
    expect(soNgayDaTroi(kyThang(2026, 8), new Date(2026, 7, 10, 23))).toBe(10);
  });
  it('ngày đầu kỳ là đã trôi 1 ngày, không phải 0', () => {
    expect(soNgayDaTroi(kyThang(2026, 8), new Date(2026, 7, 1, 0, 5))).toBe(1);
  });
  it('mốc trước kỳ thì chưa trôi ngày nào', () => {
    expect(soNgayDaTroi(kyThang(2026, 8), new Date(2026, 6, 20))).toBe(0);
  });
});

describe('Cắt kỳ nền theo tiến độ', () => {
  it('10 ngày đầu của kỳ nền', () => {
    expect(moc(catTheoTienDo(kyThang(2025, 8), 10))).toEqual(['2025-08-01', '2025-08-10']);
  });

  it('nền NGẮN hơn tiến độ thì kẹp ở cuối kỳ nền, không tràn sang tháng sau', () => {
    // Tháng 2/2028 có 29 ngày; trôi 29 ngày; nền tháng 2/2027 chỉ có 28.
    const cat = catTheoTienDo(kyThang(2027, 2), 29);
    expect(moc(cat)).toEqual(['2027-02-01', '2027-02-28']);
  });

  it('trôi đủ kỳ thì trả nguyên kỳ nền, không thêm chú thích thừa', () => {
    const nen = kyThang(2025, 8);
    expect(catTheoTienDo(nen, 31)).toEqual(nen);
  });

  it('cắt 0 ngày thì NÉM LỖI — không trả về một kỳ rỗng trông như kỳ thật', () => {
    expect(() => catTheoTienDo(kyThang(2025, 8), 0)).toThrow();
    expect(() => catTheoTienDo(kyThang(2025, 8), -3)).toThrow();
  });

  it('nhãn nói rõ đã bị cắt — để không ai tưởng đang so với cả tháng', () => {
    expect(catTheoTienDo(kyThang(2025, 8), 10).nhan).toBe('tháng 8/2025 (10 ngày đầu)');
  });
});

describe('Kỳ LŨY KẾ', () => {
  it('lũy kế 8 tháng = từ 1/1 tới hết 31/8', () => {
    expect(moc(kyLuyKe(2026, 8))).toEqual(['2026-01-01', '2026-08-31']);
  });

  it('lũy kế 1 tháng đúng bằng tháng 1', () => {
    expect(moc(kyLuyKe(2026, 1))).toEqual(['2026-01-01', '2026-01-31']);
  });

  it('lũy kế 12 tháng đúng bằng cả năm', () => {
    expect(moc(kyLuyKe(2026, 12))).toEqual(moc(kyNam(2026)));
  });

  it('nhãn nói rõ là lũy kế, không lẫn với một tháng', () => {
    expect(kyLuyKe(2026, 8).nhan).toBe('lũy kế 8 tháng đầu năm 2026');
  });

  /**
   * Đây là chốt làm cho lũy kế đáng làm: nền của nó phải là lũy kế CÙNG ĐỘ DÀI năm trước, chứ
   * không phải cả năm trước. So 8 tháng với 12 tháng thì năm nào cũng "giảm một phần ba".
   */
  it('cùng kỳ năm trước của lũy kế 8 tháng là LŨY KẾ 8 THÁNG năm trước', () => {
    const nen = cungKyNamTruoc(kyLuyKe(2026, 8));
    expect(moc(nen)).toEqual(['2025-01-01', '2025-08-31']);
    expect(nen.nhan).toBe('lũy kế 8 tháng đầu năm 2025');
  });

  it('kỳ liền trước của lũy kế 1 tháng lùi về lũy kế 12 tháng năm trước', () => {
    expect(moc(kyLienTruoc(kyLuyKe(2026, 1)))).toEqual(['2025-01-01', '2025-12-31']);
  });

  it('tháng ngoài dải thì ném lỗi', () => {
    expect(() => kyLuyKe(2026, 0)).toThrow();
    expect(() => kyLuyKe(2026, 13)).toThrow();
  });
});

describe('Kỳ TUỲ CHỌN', () => {
  it('ôm trọn ngày cuối tới 23:59:59.999', () => {
    const k = kyTuyChon(new Date(2026, 2, 5), new Date(2026, 4, 20));
    expect(moc(k)).toEqual(['2026-03-05', '2026-05-20']);
    expect(k.den.getHours()).toBe(23);
  });

  it('nhãn ghi rõ hai đầu, để câu "so với …" không mơ hồ', () => {
    expect(kyTuyChon(new Date(2026, 2, 5), new Date(2026, 4, 20)).nhan).toBe(
      '05/03/2026 – 20/05/2026',
    );
  });

  it('ngày cuối trước ngày đầu thì NÉM LỖI, không lặng lẽ đảo', () => {
    expect(() => kyTuyChon(new Date(2026, 4, 20), new Date(2026, 2, 5))).toThrow();
  });

  /**
   * Một khoảng tuỳ ý KHÔNG có "cùng kỳ năm trước" đúng đắn: lùi 365 ngày sai vào năm nhuận, lùi
   * một năm dương lịch thì 29/2 không tồn tại. Từ chối rõ ràng còn hơn trả một khoảng trông hợp
   * lý mà lệch một ngày — người dùng sẽ không bao giờ phát hiện.
   */
  it('KHÔNG dịch được sang kỳ khác — phải chọn nền riêng', () => {
    const k = kyTuyChon(new Date(2026, 2, 5), new Date(2026, 4, 20));
    expect(() => cungKyNamTruoc(k)).toThrow();
    expect(() => kyLienTruoc(k)).toThrow();
  });

  it('một ngày duy nhất vẫn là kỳ hợp lệ', () => {
    const k = kyTuyChon(new Date(2026, 2, 5), new Date(2026, 2, 5));
    expect(moc(k)).toEqual(['2026-03-05', '2026-03-05']);
  });
});
