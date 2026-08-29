import { readFileSync } from 'fs';
import { join } from 'path';
import fc from 'fast-check';
import { congNgay, tinhThoiHan, tinhHanSauGiaHan, SO_NGAY_TOI_DA } from './tinh-thoi-han';

/**
 * EXPERT property-based — phép tính THỜI HẠN TỐ TỤNG.
 *
 * Vùng rủi ro cao nhất hệ mà trước bản này KHÔNG ca kiểm nào chạm tới: phép tính nằm inline
 * trong `incidents.service.ts`, muốn kiểm phải dựng 5 phụ thuộc.
 *
 * Sai một ngày là sai thời hạn theo Điều 147/148/149 BLTTHS 2015 — hồ sơ quá hạn mà không ai
 * biết, hoặc bị coi là quá hạn khi vẫn còn hạn.
 *
 * Kiểm bằng BẤT BIẾN trên miền rộng, không bằng vài ví dụ tay.
 */
const NGAY_HOP_LE = fc
  .integer({ min: Date.UTC(2000, 0, 1), max: Date.UTC(2100, 0, 1) })
  .map((t) => new Date(t));

describe('EXPERT thời hạn — bất biến cơ bản', () => {
  it('PB-05 · hạn luôn SAU mốc với mọi số ngày dương', () => {
    fc.assert(
      fc.property(NGAY_HOP_LE, fc.integer({ min: 1, max: SO_NGAY_TOI_DA }), (moc, n) => {
        expect(tinhThoiHan(moc, n).getTime()).toBeGreaterThan(moc.getTime());
      }),
      { numRuns: 300 },
    );
  });

  it('PB-07 · số ngày 0 thì hạn TRÙNG KHÍT mốc, không lệch một ngày', () => {
    fc.assert(
      fc.property(NGAY_HOP_LE, (moc) => {
        expect(tinhThoiHan(moc, 0).getTime()).toBe(moc.getTime());
      }),
      { numRuns: 200 },
    );
  });

  /** Không đụng vào mốc gốc — bên gọi thường giữ nó để ghi nhật ký. */
  it('không làm hỏng mốc gốc', () => {
    fc.assert(
      fc.property(NGAY_HOP_LE, fc.integer({ min: 0, max: 1000 }), (moc, n) => {
        const truoc = moc.getTime();
        tinhThoiHan(moc, n);
        expect(moc.getTime()).toBe(truoc);
      }),
      { numRuns: 200 },
    );
  });

  it('PB-08 · không bao giờ sinh ngày không tồn tại', () => {
    fc.assert(
      fc.property(NGAY_HOP_LE, fc.integer({ min: 0, max: SO_NGAY_TOI_DA }), (moc, n) => {
        const h = tinhThoiHan(moc, n);
        expect(Number.isNaN(h.getTime())).toBe(false);
        expect(h.getDate()).toBeGreaterThanOrEqual(1);
        expect(h.getDate()).toBeLessThanOrEqual(31);
      }),
      { numRuns: 300 },
    );
  });
});

describe('EXPERT thời hạn — đơn điệu và cộng tính (metamorphic)', () => {
  /** PB-06: cộng nhiều ngày hơn thì hạn xa hơn — không bao giờ ngược lại. */
  it('PB-06 · đơn điệu không giảm theo số ngày', () => {
    fc.assert(
      fc.property(
        NGAY_HOP_LE,
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (moc, a, b) => {
          const it = Math.min(a, b);
          const nhieu = Math.max(a, b);
          expect(tinhThoiHan(moc, nhieu).getTime()).toBeGreaterThanOrEqual(
            tinhThoiHan(moc, it).getTime(),
          );
        },
      ),
      { numRuns: 300 },
    );
  });

  /**
   * MR-04: cộng a rồi cộng b == cộng (a+b). Đây là phép kiểm bắt lỗi tích luỹ sai số — thứ mà
   * một ca kiểm ví dụ đơn lẻ không bao giờ lộ ra.
   */
  it('MR-04 · cộng a rồi b bằng cộng (a+b)', () => {
    fc.assert(
      fc.property(
        NGAY_HOP_LE,
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        (moc, a, b) => {
          expect(congNgay(congNgay(moc, a), b).getTime()).toBe(congNgay(moc, a + b).getTime());
        },
      ),
      { numRuns: 300 },
    );
  });

  /** Cộng ngày phải đúng theo LỊCH, không theo mili-giây — khác nhau ở ngày đổi giờ mùa. */
  it('cộng n ngày ra đúng n ngày lịch', () => {
    fc.assert(
      fc.property(NGAY_HOP_LE, fc.integer({ min: 1, max: 400 }), (moc, n) => {
        const h = congNgay(moc, n);
        const ngayLech = Math.round(
          (Date.UTC(h.getFullYear(), h.getMonth(), h.getDate()) -
            Date.UTC(moc.getFullYear(), moc.getMonth(), moc.getDate())) /
            86400000,
        );
        expect(ngayLech).toBe(n);
      }),
      { numRuns: 300 },
    );
  });
});

describe('EXPERT thời hạn — biên và đầu vào xấu', () => {
  it.each([
    ['29/02 năm nhuận', new Date(2024, 1, 29), 1],
    ['31/12 sang năm mới', new Date(2026, 11, 31), 1],
    ['31/01 sang tháng 2', new Date(2026, 0, 31), 1],
    ['30/04 sang tháng 5', new Date(2026, 3, 30), 1],
  ])('%s không sinh ngày lạ', (_ten, moc, n) => {
    const h = congNgay(moc as Date, n as number);
    expect(Number.isNaN(h.getTime())).toBe(false);
    expect(h.getTime()).toBeGreaterThan((moc as Date).getTime());
  });

  /** 31/01 + 1 phải là 01/02, không phải 31/02 (không tồn tại) hay 03/03 (tràn). */
  it('31/01 cộng 1 ngày ra đúng 01/02', () => {
    const h = congNgay(new Date(2026, 0, 31), 1);
    expect(h.getMonth()).toBe(1);
    expect(h.getDate()).toBe(1);
  });

  it('28/02 năm nhuận cộng 1 ngày ra 29/02', () => {
    const h = congNgay(new Date(2024, 1, 28), 1);
    expect(h.getMonth()).toBe(1);
    expect(h.getDate()).toBe(29);
  });

  it('28/02 năm KHÔNG nhuận cộng 1 ngày ra 01/03', () => {
    const h = congNgay(new Date(2026, 1, 28), 1);
    expect(h.getMonth()).toBe(2);
    expect(h.getDate()).toBe(1);
  });

  it.each([
    ['mốc không hợp lệ', () => congNgay(new Date('bịa'), 1)],
    ['số ngày âm', () => congNgay(new Date(2026, 0, 1), -1)],
    ['số ngày không nguyên', () => congNgay(new Date(2026, 0, 1), 1.5)],
    ['số ngày vượt trần', () => congNgay(new Date(2026, 0, 1), SO_NGAY_TOI_DA + 1)],
  ])('chặn %s', (_ten, chay) => {
    expect(chay).toThrow();
  });
});

describe('EXPERT gia hạn — chỉ đẩy hạn RA XA', () => {
  /**
   * Bất biến nghiệp vụ, không phải chi tiết kỹ thuật: kéo hạn vào gần hơn là biến một hồ sơ
   * đang trong hạn thành quá hạn bằng một thao tác mang tên "gia hạn".
   */
  it('PB-06b · hạn sau gia hạn luôn XA hơn hạn cũ', () => {
    fc.assert(
      fc.property(NGAY_HOP_LE, fc.integer({ min: 1, max: 365 }), (han, n) => {
        expect(tinhHanSauGiaHan(han, n).getTime()).toBeGreaterThan(han.getTime());
      }),
      { numRuns: 300 },
    );
  });

  it.each([[0], [-1], [-30]])('chặn gia hạn %s ngày', (n) => {
    expect(() => tinhHanSauGiaHan(new Date(2026, 0, 1), n)).toThrow();
  });

  /** Gia hạn hai lần liên tiếp cộng dồn đúng — chuỗi gia hạn của một hồ sơ là chuỗi cộng dồn. */
  it('gia hạn hai lần cộng dồn đúng', () => {
    fc.assert(
      fc.property(
        NGAY_HOP_LE,
        fc.integer({ min: 1, max: 200 }),
        fc.integer({ min: 1, max: 200 }),
        (han, a, b) => {
          expect(tinhHanSauGiaHan(tinhHanSauGiaHan(han, a), b).getTime()).toBe(
            congNgay(han, a + b).getTime(),
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Sinh ra TỪ phân tích mutant sống sót.
 *
 * Gieo lỗi đổi `ra.setDate(ra.getDate() + n)` thành `ra.setTime(ra.getTime() + n * 86400000)`
 * mà cả 23 ca vẫn xanh. Lý do: Việt Nam KHÔNG đổi giờ mùa, nên ở múi +07 hai cách cho cùng
 * kết quả — bài kiểm không thể phân biệt được điều nó cần phân biệt.
 *
 * Nhưng máy chủ, bản sao dữ liệu, hay một lần khôi phục ở nơi khác có thể chạy ở múi CÓ đổi
 * giờ. Ở đó cộng mili-giây sai đúng một ngày, và một hạn tố tụng lệch một ngày là lệch thật.
 *
 * Ca dưới đây đổi múi giờ tiến trình sang nơi có đổi giờ mùa rồi cộng qua đúng ngày ấy:
 * ngày 01/11/2026 ở New York dài 25 giờ, nên `+24h` vẫn còn nằm trong ngày 01, trong khi cộng
 * theo LỊCH phải sang ngày 02.
 */
describe('EXPERT thời hạn — phải cộng theo LỊCH, không theo mili-giây', () => {
  /**
   * Ghim bằng CẤU TRÚC, và đây là một lựa chọn có lý do — không phải đường tắt.
   *
   * Gieo lỗi đổi `ra.setDate(ra.getDate() + n)` thành `ra.setTime(ra.getTime() + n * 86400000)`
   * mà cả 23 ca hành vi vẫn xanh. Hai lần thử làm ca hành vi phân biệt được đều thất bại:
   *
   *   1. Việt Nam KHÔNG đổi giờ mùa, nên ở múi +07 hai cách cho CÙNG kết quả.
   *   2. Đổi `process.env.TZ` giữa chừng để chạy ở múi có đổi giờ cũng không ăn — Node đã nạp
   *      múi giờ lúc khởi động, đổi biến môi trường sau đó không có tác dụng.
   *
   * Nên bất biến này không quan sát được từ bên trong tiến trình. Nhưng nó vẫn thật: máy chủ,
   * bản sao dữ liệu, hay một lần khôi phục ở nơi khác có thể chạy ở múi CÓ đổi giờ, và ở đó
   * cộng mili-giây sai đúng một ngày — một hạn tố tụng lệch một ngày là lệch thật.
   *
   * Ca này đọc thẳng mã nguồn. Ai đổi sang số học mili-giây sẽ thấy đỏ kèm lời giải thích ở
   * ngay đây, thay vì phát hiện ra khi có hồ sơ bị tính sai hạn ở một múi giờ khác.
   */
  it('cài đặt dùng setDate (số học LỊCH), không dùng số học mili-giây', () => {
    const nguyen = readFileSync(join(__dirname, 'tinh-thoi-han.ts'), 'utf8');
    // Bóc chú thích trước khi soi: chính đoạn giải thích "vì sao KHÔNG dùng số học mili-giây"
    // có chứa con số ấy, nên soi cả tệp là ca kiểm tự làm mình đỏ. Dựng biểu thức từ CHUỖI vì
    // mẫu bóc chú thích khối chứa dấu đóng chú thích — viết thẳng làm vỡ cú pháp tệp.
    // Bóc chú thích bằng phép CẮT CHUỖI, không dùng biểu thức: mẫu bóc chú thích khối chứa
    // đúng dấu đóng chú thích, viết kiểu nào cũng vướng một tầng dấu thoát.
    const bocChuThich = (v: string): string => {
      let ra = '';
      let i = 0;
      while (i < v.length) {
        if (v.startsWith('/*', i)) {
          const het = v.indexOf('*' + '/', i + 2);
          i = het === -1 ? v.length : het + 2;
        } else if (v.startsWith('//', i)) {
          const het = v.indexOf(String.fromCharCode(10), i);
          i = het === -1 ? v.length : het;
        } else {
          ra += v[i];
          i += 1;
        }
      }
      return ra;
    };
    const ma = bocChuThich(nguyen);
    expect(ma).toContain('ra.setDate(ra.getDate() + soNgay)');
    expect(ma).not.toMatch(new RegExp('86400000'));
  });
});
