/**
 * EXPERT TEST — tầng chuyên gia cho legacy-migration (hàm thuần).
 * Phương pháp: property-based (fast-check) + metamorphic + fuzzing + performance.
 * Chứng minh BẤT BIẾN trên cả miền input, không bằng ví dụ rời rạc.
 * Danh mục: PB-01..14, MR-01..05, FZ-01..04, PF-01 (từ expert-test-writer W3).
 */
import fc from 'fast-check';
import {
  parseLegacyNumber,
  parseLegacyDate,
  parseLegacyBool,
  buildCaseStatistic,
  decomposeLegacyRecord,
  MAPPED_LEGACY_KEYS,
  type LegacyRecord,
} from './legacy-mapper';
import { buildMigrationReport, buildFieldCoverage } from './migration-report';

const PHAN_LOAI_HOP_LE = [
  'don-cong-van-ban-dau',
  'vu-viec-ban-dau',
  'vu-viec-nguon-tin',
  'vu-an-ban-dau',
  'huong-dan-ban-dau',
  'trao-doi-chuyen-an',
  'kien-nghi-vks',
  'uy-thac-dieu-tra',
  'luat-su',
  'tra-ho-so-ban-dau',
  'cong-van-don-doc-phuc-hoi-tdc',
];

// Format số nguyên kiểu nghìn VN (dấu chấm): 1000000 → "1.000.000"
const formatVNThousand = (n: number): string => n.toLocaleString('de-DE');
const pad2 = (n: number): string => String(n).padStart(2, '0');

describe('EXPERT property-based — parser (PB-01..08)', () => {
  it('PB-01: parseLegacyNumber roundtrip nghìn VN — parse(format(n))==n', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000_000_000 }), (n) => {
        expect(parseLegacyNumber(formatVNThousand(n))).toBe(n);
      }),
      { numRuns: 500 },
    );
  });

  it('PB-02: chuỗi KHÔNG chứa chữ số → undefined (không bịa số)', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !/[0-9]/.test(s)),
        (s) => {
          expect(parseLegacyNumber(s)).toBeUndefined();
        },
      ),
      { numRuns: 300 },
    );
  });

  it('PB-03: hệ số nhân chữ — "n triệu"==n·1e6, "n tỷ"==n·1e9', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        fc.constantFrom<[string, number]>(['triệu', 1e6], ['tỷ', 1e9], ['nghìn', 1e3]),
        (n, [word, mult]) => {
          expect(parseLegacyNumber(`${n} ${word}`)).toBe(n * mult);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('PB-04: parseLegacyDate roundtrip dd/mm/yyyy — UTC y/m/d khớp input', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date(Date.UTC(2000, 0, 1)),
          max: new Date(Date.UTC(2050, 11, 28)),
          noInvalidDate: true,
        }),
        (d) => {
          const y = d.getUTCFullYear();
          const m = d.getUTCMonth() + 1;
          const day = d.getUTCDate();
          const parsed = parseLegacyDate(`${pad2(day)}/${pad2(m)}/${y}`);
          expect(parsed).toBeInstanceOf(Date);
          expect(parsed!.getUTCFullYear()).toBe(y);
          expect(parsed!.getUTCMonth() + 1).toBe(m);
          expect(parsed!.getUTCDate()).toBe(day);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('PB-05: chuỗi toàn số 5-6 ký tự KHÔNG bị coi là Excel serial → undefined', () => {
    fc.assert(
      fc.property(fc.integer({ min: 10_000, max: 999_999 }), (n) => {
        expect(parseLegacyDate(String(n))).toBeUndefined();
      }),
      { numRuns: 300 },
    );
  });

  it('PB-06: ngày overflow (day 32-99) → undefined (không wrap sang tháng sau)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 32, max: 99 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 2000, max: 2050 }),
        (day, m, y) => {
          expect(parseLegacyDate(`${day}/${pad2(m)}/${y}`)).toBeUndefined();
        },
      ),
      { numRuns: 300 },
    );
  });

  it('PB-07: nhãn boolean âm (theo từ đầu) → false', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('không', 'khong', 'chưa', 'chua', 'false', '0', 'no'),
        fc.constantFrom('', ' có', ' xét xử', ' thực hiện'),
        (neg, suffix) => {
          expect(parseLegacyBool(neg + suffix)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('PB-08: rỗng/whitespace/null/undefined → undefined (phân biệt thiếu vs false)', () => {
    fc.assert(
      fc.property(fc.constantFrom('', '   ', '\t', '\n', null, undefined), (v) => {
        expect(parseLegacyBool(v)).toBeUndefined();
      }),
      { numRuns: 50 },
    );
  });
});

// Arbitrary cho 1 legacy record: id non-empty + phan_loai hợp lệ + key/value tự do non-empty
const recordArb = (phanLoaiOptional = false) =>
  fc
    .dictionary(
      fc.string({ minLength: 1, maxLength: 12 }).filter((k) => !/^(id|phan_loai_nguon_tin_ban_dau)$/.test(k)),
      fc.string({ minLength: 1, maxLength: 20 }),
      { maxKeys: 8 },
    )
    .map((extra) => {
      const rec: LegacyRecord = { id: 'R-' + Math.abs(hashStr(JSON.stringify(extra))), ...extra };
      if (!phanLoaiOptional) {
        rec.phan_loai_nguon_tin_ban_dau =
          PHAN_LOAI_HOP_LE[Math.abs(hashStr(JSON.stringify(extra))) % PHAN_LOAI_HOP_LE.length];
      }
      return rec;
    });

// hash ổn định (không dùng Math.random để fast-check shrink/replay được)
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

describe('EXPERT property-based — decompose & coverage (PB-09..14)', () => {
  it('PB-09: no-data-loss — mọi key của rec ⊆ keys(entity.legacyRaw)', () => {
    fc.assert(
      fc.property(recordArb(), (rec) => {
        const d = decomposeLegacyRecord(rec);
        const entity = d.petition || d.incident || d.case || d.guidance || d.exchange || d.proposal;
        if (!entity) return; // phân loại tạo entity — luôn có với phan_loai hợp lệ
        const raw = entity.legacyRaw as Record<string, unknown>;
        for (const k of Object.keys(rec)) {
          expect(Object.prototype.hasOwnProperty.call(raw, k)).toBe(true);
        }
      }),
      { numRuns: 400 },
    );
  });

  it('PB-10: decomposeLegacyRecord THUẦN — gọi 2 lần cho kết quả deep-equal', () => {
    fc.assert(
      fc.property(recordArb(true), (rec) => {
        expect(JSON.stringify(decomposeLegacyRecord(rec))).toBe(JSON.stringify(decomposeLegacyRecord(rec)));
      }),
      { numRuns: 300 },
    );
  });

  it('PB-11: buildCaseStatistic — record không field thống kê → undefined', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (txt) => {
        expect(buildCaseStatistic({ id: 'X', tom_tat_noi_dung: txt })).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('PB-12: buildCaseStatistic — field đếm luôn là Int (Float làm Prisma reject)', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1e6, noNaN: true }), (val) => {
        const stat = buildCaseStatistic({ so_luong_bi_hai: String(val) });
        if (stat && stat.soLuongBiHai !== undefined) {
          expect(Number.isInteger(stat.soLuongBiHai)).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('PB-13: buildFieldCoverage — mapped+rawOnly==distinct; 0≤ratio≤1', () => {
    fc.assert(
      fc.property(fc.array(recordArb(), { maxLength: 15 }), (batch) => {
        const fc2 = buildFieldCoverage(batch);
        expect(fc2.mappedKeys + fc2.rawOnlyKeys).toBe(fc2.distinctSourceKeys);
        expect(fc2.rawCoverageRatio).toBeGreaterThanOrEqual(0);
        expect(fc2.rawCoverageRatio).toBeLessThanOrEqual(1);
        expect(fc2.typedCoverageRatio).toBeGreaterThanOrEqual(0);
        expect(fc2.typedCoverageRatio).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  it('PB-14: buildFieldCoverage — thêm record phân loại lạ → rawCoverageRatio không tăng', () => {
    fc.assert(
      fc.property(fc.array(recordArb(), { minLength: 1, maxLength: 10 }), fc.string({ minLength: 1 }), (batch, lostKey) => {
        const before = buildFieldCoverage(batch).rawCoverageRatio;
        const skipRec: LegacyRecord = { id: 'SKIP-X', phan_loai_nguon_tin_ban_dau: 'hoan-toan-la', [`z_${lostKey}`]: 'mat' };
        const after = buildFieldCoverage([...batch, skipRec]);
        expect(after.skippedRecords).toBeGreaterThanOrEqual(1);
        expect(after.rawCoverageRatio).toBeLessThanOrEqual(before + 1e-9);
      }),
      { numRuns: 200 },
    );
  });
});

describe('EXPERT metamorphic (MR-01..05)', () => {
  it('MR-01: parseLegacyNumber scale — parse(str(n·k))==k·parse(str(n))', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 1, max: 1000 }), (n, k) => {
        expect(parseLegacyNumber(String(n * k))).toBe(k * parseLegacyNumber(String(n))!);
      }),
      { numRuns: 300 },
    );
  });

  it('MR-02: decompose thêm key non-empty → key mới có trong legacyRaw', () => {
    fc.assert(
      fc.property(recordArb(), fc.string({ minLength: 1, maxLength: 10 }), (rec, k) => {
        const newKey = `mr2_${k}`;
        const d = decomposeLegacyRecord({ ...rec, [newKey]: 'val-moi' });
        const entity = d.petition || d.incident || d.case || d.guidance || d.exchange || d.proposal;
        if (!entity) return;
        expect((entity.legacyRaw as Record<string, unknown>)[newKey]).toBe('val-moi');
      }),
      { numRuns: 300 },
    );
  });

  it('MR-03: report nối 2 batch (id rời) → willCreate* == Σ từng batch', () => {
    fc.assert(
      fc.property(fc.array(recordArb(), { maxLength: 8 }), fc.array(recordArb(), { maxLength: 8 }), (a, b) => {
        // tách id để không trùng giữa 2 batch
        const aa = a.map((r, i) => ({ ...r, id: `A${i}` }));
        const bb = b.map((r, i) => ({ ...r, id: `B${i}` }));
        const rA = buildMigrationReport(aa);
        const rB = buildMigrationReport(bb);
        const rAB = buildMigrationReport([...aa, ...bb]);
        expect(rAB.willCreateCases).toBe(rA.willCreateCases + rB.willCreateCases);
        expect(rAB.willCreatePetitions).toBe(rA.willCreatePetitions + rB.willCreatePetitions);
        expect(rAB.willCreateIncidents).toBe(rA.willCreateIncidents + rB.willCreateIncidents);
        expect(rAB.willCreateGuidance).toBe(rA.willCreateGuidance + rB.willCreateGuidance);
      }),
      { numRuns: 200 },
    );
  });

  it('MR-04: coverage nhân đôi batch (id khác) → distinctSourceKeys & ratio giữ nguyên', () => {
    fc.assert(
      fc.property(fc.array(recordArb(), { minLength: 1, maxLength: 8 }), (batch) => {
        const single = buildFieldCoverage(batch);
        const doubled = buildFieldCoverage([...batch, ...batch.map((r, i) => ({ ...r, id: `DUP-${i}` }))]);
        expect(doubled.distinctSourceKeys).toBe(single.distinctSourceKeys);
        expect(doubled.rawCoverageRatio).toBeCloseTo(single.rawCoverageRatio, 9);
      }),
      { numRuns: 150 },
    );
  });

  it('MR-05: parseLegacyDate — dd/mm/yyyy và yyyy-mm-dd cùng ngày → cùng Date', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(Date.UTC(2000, 0, 1)), max: new Date(Date.UTC(2050, 11, 28)), noInvalidDate: true }),
        (d) => {
          const y = d.getUTCFullYear();
          const m = d.getUTCMonth() + 1;
          const day = d.getUTCDate();
          const a = parseLegacyDate(`${pad2(day)}/${pad2(m)}/${y}`);
          const b = parseLegacyDate(`${y}-${pad2(m)}-${pad2(day)}`);
          expect(a!.getTime()).toBe(b!.getTime());
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('EXPERT fuzzing — parser đầu vào méo, không crash (FZ-01..04)', () => {
  it('FZ-01: parseLegacyNumber với chuỗi rác bất kỳ → không throw, trả number|undefined', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        let r: unknown;
        expect(() => {
          r = parseLegacyNumber(s);
        }).not.toThrow();
        expect(r === undefined || typeof r === 'number').toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('FZ-02: parseLegacyDate với input méo/anything → không throw, Date|undefined', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.double(), fc.constant(null), fc.constant(undefined)), (v) => {
        let r: unknown;
        expect(() => {
          r = parseLegacyDate(v);
        }).not.toThrow();
        expect(r === undefined || r instanceof Date).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('FZ-03: decomposeLegacyRecord với record méo (rỗng/Unicode/nested) → không throw', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.anything()), (rec) => {
        expect(() => decomposeLegacyRecord(rec as LegacyRecord)).not.toThrow();
      }),
      { numRuns: 400 },
    );
  });

  it('FZ-04: parseLegacyBool với anything → không throw, boolean|undefined', () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        let r: unknown;
        expect(() => {
          r = parseLegacyBool(v);
        }).not.toThrow();
        expect(r === undefined || typeof r === 'boolean').toBe(true);
      }),
      { numRuns: 400 },
    );
  });
});

describe('EXPERT performance (PF-01)', () => {
  function loBanGhi(n: number): LegacyRecord[] {
    const batch: LegacyRecord[] = [];
    for (let i = 0; i < n; i++) {
      batch.push({
        id: `PF-${i}`,
        phan_loai_nguon_tin_ban_dau: PHAN_LOAI_HOP_LE[i % PHAN_LOAI_HOP_LE.length],
        tom_tat_noi_dung: `Nội dung ${i}`,
        so_luong_bi_hai: String(i % 10),
        toi_danh_chinh: '95',
      });
    }
    return batch;
  }

  function doThoiGian(n: number): number {
    const lo = loBanGhi(n);
    const t0 = Date.now();
    const report = buildMigrationReport(lo);
    const dt = Date.now() - t0;
    expect(report.totalRecords).toBe(n);
    expect(report.fieldCoverage.distinctSourceKeys).toBeGreaterThan(0);
    return dt;
  }

  /**
   * Ca này TRƯỚC ĐÂY chốt "10.000 bản ghi < 5s" bằng ĐỒNG HỒ TREO TƯỜNG.
   *
   * Một ngưỡng tuyệt đối trong bộ chạy nhiều tiến trình song song đo CỖ MÁY chứ không đo mã: nó
   * xanh trên máy rảnh và đỏ trên máy bận, cùng một dòng mã. Đo được ngày 30/08/2026: đỏ ba lần
   * liên tiếp trên máy phát triển trong khi CI xanh — tức nó báo về tải máy, không báo về hồi quy.
   *
   * Thứ ca này THẬT SỰ muốn canh là `buildMigrationReport` không có chỗ nào bậc hai. Điều đó đo
   * bằng TỶ LỆ, và tỷ lệ thì không phụ thuộc máy nhanh hay chậm: gấp bốn lượng đầu vào mà thời
   * gian gấp hơn mười lần là dấu hiệu bậc hai (bậc hai đúng lý thuyết là gấp mười sáu).
   */
  it('PF-01: buildMigrationReport không tăng theo bậc hai khi dữ liệu gấp bốn', () => {
    const N = 2_500;
    // Chạy nóng trước để không tính cả chi phí biên dịch lần đầu vào phép đo.
    doThoiGian(200);

    const nho = Math.max(doThoiGian(N), 1);
    const to = doThoiGian(N * 4);

    // Bậc một: ~4 lần. Bậc hai: ~16 lần. Đặt ngưỡng 10 để còn chỗ cho nhiễu mà vẫn bắt được
    // bậc hai.
    expect(to / nho).toBeLessThan(10);
  });

  /** Chốt riêng "không treo, không cạn bộ nhớ" — ngưỡng rộng, chỉ để bắt hỏng hẳn. */
  it('PF-01b: 10.000 bản ghi chạy xong, không treo và không cạn bộ nhớ', () => {
    expect(doThoiGian(10_000)).toBeLessThan(60_000);
  });

  it('MAPPED_LEGACY_KEYS không rỗng (registry coverage)', () => {
    expect(MAPPED_LEGACY_KEYS.size).toBeGreaterThan(50);
    expect(MAPPED_LEGACY_KEYS.has('phan_loai_nguon_tin_ban_dau')).toBe(true);
    expect(MAPPED_LEGACY_KEYS.has('tom_tat_noi_dung')).toBe(true);
  });
});
