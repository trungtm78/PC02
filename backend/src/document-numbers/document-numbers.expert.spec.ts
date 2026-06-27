/**
 * EXPERT TEST — tầng chuyên gia cho document-number engine (hàm thuần).
 * computePeriodKey (reset kỳ, TZ Asia/Ho_Chi_Minh — NĐ 30/2020) + formatValue (format số văn bản).
 * Phương pháp: property-based + metamorphic + fuzzing + boundary (mốc năm VN).
 */
import fc from 'fast-check';
import { computePeriodKey, type ResetPeriod } from './period-key.util';
import { formatValue } from './formula-engine';

const anyDate = fc.date({
  min: new Date(Date.UTC(2000, 0, 1)),
  max: new Date(Date.UTC(2060, 11, 31)),
  noInvalidDate: true,
});

describe('EXPERT property — computePeriodKey (DN-PK-01..09)', () => {
  it('DN-PK-01: NEVER & MAX_NUMBER → luôn "global" (mọi ngày)', () => {
    fc.assert(
      fc.property(anyDate, (d) => {
        expect(computePeriodKey('NEVER', d)).toBe('global');
        expect(computePeriodKey('MAX_NUMBER', d)).toBe('global');
      }),
      { numRuns: 300 },
    );
  });

  it('DN-PK-02: YEARLY → đúng định dạng /^\\d{4}$/', () => {
    fc.assert(
      fc.property(anyDate, (d) => {
        expect(computePeriodKey('YEARLY', d)).toMatch(/^\d{4}$/);
      }),
      { numRuns: 300 },
    );
  });

  it('DN-PK-03: MONTHLY → /^\\d{4}-\\d{2}$/, tháng 01-12', () => {
    fc.assert(
      fc.property(anyDate, (d) => {
        const key = computePeriodKey('MONTHLY', d);
        expect(key).toMatch(/^\d{4}-\d{2}$/);
        const mm = Number(key.split('-')[1]);
        expect(mm).toBeGreaterThanOrEqual(1);
        expect(mm).toBeLessThanOrEqual(12);
      }),
      { numRuns: 300 },
    );
  });

  it('DN-PK-04: WEEKLY → /^\\d{4}-W\\d{2}$/, tuần 01-53', () => {
    fc.assert(
      fc.property(anyDate, (d) => {
        const key = computePeriodKey('WEEKLY', d);
        expect(key).toMatch(/^\d{4}-W\d{2}$/);
        const wk = Number(key.split('-W')[1]);
        expect(wk).toBeGreaterThanOrEqual(1);
        expect(wk).toBeLessThanOrEqual(53);
      }),
      { numRuns: 300 },
    );
  });

  it('DN-PK-05: idempotent/thuần — cùng (period,date) cho cùng key', () => {
    fc.assert(
      fc.property(fc.constantFrom<ResetPeriod>('YEARLY', 'MONTHLY', 'WEEKLY', 'NEVER'), anyDate, (p, d) => {
        expect(computePeriodKey(p, d)).toBe(computePeriodKey(p, d));
      }),
      { numRuns: 300 },
    );
  });

  it('DN-PK-06 metamorphic: YEARLY key == phần năm của MONTHLY key (nhất quán)', () => {
    fc.assert(
      fc.property(anyDate, (d) => {
        expect(computePeriodKey('YEARLY', d)).toBe(computePeriodKey('MONTHLY', d).split('-')[0]);
      }),
      { numRuns: 300 },
    );
  });

  it('DN-PK-07 metamorphic: 2 thời điểm cùng NGÀY dân sự VN → cùng key mọi period', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2001, max: 2059 }), fc.integer({ min: 1, max: 28 }), fc.integer({ min: 1, max: 12 }), (y, day, m) => {
        // 02:00 và 20:00 ICT cùng ngày = 19:00 (hôm trước UTC) và 13:00 UTC — vẫn cùng ngày VN.
        const a = new Date(Date.UTC(y, m - 1, day, 2, 0)); // 09:00 ICT
        const b = new Date(Date.UTC(y, m - 1, day, 10, 0)); // 17:00 ICT — cùng ngày VN
        for (const p of ['YEARLY', 'MONTHLY', 'WEEKLY'] as ResetPeriod[]) {
          expect(computePeriodKey(p, a)).toBe(computePeriodKey(p, b));
        }
      }),
      { numRuns: 300 },
    );
  });

  it('DN-PK-08 BOUNDARY VN tz (v0.47 P0): 2026-12-31T23:30:00Z = 06:30 ICT 2027 → YEARLY "2027"', () => {
    expect(computePeriodKey('YEARLY', new Date('2026-12-31T23:30:00Z'))).toBe('2027');
    // 2026-12-31T10:00:00Z = 17:00 ICT vẫn 2026
    expect(computePeriodKey('YEARLY', new Date('2026-12-31T10:00:00Z'))).toBe('2026');
  });

  it('DN-PK-09: resetPeriod lạ → throw', () => {
    expect(() => computePeriodKey('XYZ' as ResetPeriod, new Date())).toThrow();
  });
});

describe('EXPERT property — formatValue (DN-FV-01..07)', () => {
  it('DN-FV-01: pattern rỗng — Date→ISO, number/string→String(value)', () => {
    const d = new Date('2025-06-15T00:00:00Z');
    expect(formatValue(d, '')).toBe(d.toISOString());
    fc.assert(
      fc.property(fc.oneof(fc.integer(), fc.string()), (v) => {
        expect(formatValue(v, '')).toBe(String(v));
      }),
      { numRuns: 200 },
    );
  });

  it('DN-FV-02: Date + pattern ngày chuẩn (UTC)', () => {
    const d = new Date('2025-06-09T00:00:00Z');
    expect(formatValue(d, 'YYYY')).toBe('2025');
    expect(formatValue(d, 'YY')).toBe('25');
    expect(formatValue(d, 'MM')).toBe('06');
    expect(formatValue(d, 'DD')).toBe('09');
    expect(formatValue(d, 'YYYYMM')).toBe('202506');
    expect(formatValue(d, 'YYYYMMDD')).toBe('20250609');
  });

  it('DN-FV-03: Date + pattern lạ → ISO fallback', () => {
    const d = new Date('2025-06-15T00:00:00Z');
    expect(formatValue(d, 'KHONG_CO')).toBe(d.toISOString());
  });

  it('DN-FV-04: number + zero-pad "000..." → padStart, parse lại == n, length ≥ pattern.length', () => {
    fc.assert(
      fc.property(fc.nat({ max: 999_999 }), fc.integer({ min: 1, max: 8 }), (n, k) => {
        const pattern = '0'.repeat(k);
        const out = formatValue(n, pattern);
        expect(out.length).toBe(Math.max(k, String(n).length));
        expect(Number(out)).toBe(n);
        expect(/^\d+$/.test(out)).toBe(true);
      }),
      { numRuns: 400 },
    );
  });

  it('DN-FV-05: number + pattern KHÔNG zero-pad → String(n)', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom('YYYY', 'abc', 'X', '0a0'), (n, pat) => {
        expect(formatValue(n, pat)).toBe(String(n));
      }),
      { numRuns: 200 },
    );
  });

  it('DN-FV-06: idempotent/thuần', () => {
    fc.assert(
      fc.property(fc.oneof(fc.integer(), fc.string()), fc.constantFrom('', '000', 'YYYY', 'x'), (v, pat) => {
        expect(formatValue(v, pat)).toBe(formatValue(v, pat));
      }),
      { numRuns: 200 },
    );
  });

  it('DN-FV-07 metamorphic: tăng số chữ số của n → length không giảm', () => {
    fc.assert(
      fc.property(fc.nat({ max: 9999 }), (n) => {
        const a = formatValue(n, '00000');
        const b = formatValue(n * 10, '00000');
        expect(b.length).toBeGreaterThanOrEqual(a.length);
      }),
      { numRuns: 200 },
    );
  });
});

describe('EXPERT fuzzing — không crash với input méo', () => {
  it('FZ: formatValue với value bất kỳ + pattern bất kỳ → không throw, trả string', () => {
    fc.assert(
      fc.property(fc.oneof(fc.integer(), fc.double(), fc.string(), anyDate), fc.string(), (v, pat) => {
        let r: unknown;
        expect(() => {
          r = formatValue(v as any, pat);
        }).not.toThrow();
        expect(typeof r).toBe('string');
      }),
      { numRuns: 400 },
    );
  });
});

import { resolveSource } from './source-resolver';

describe('EXPERT SECURITY — resolveSource allowlist (chống đọc cột DB tùy ý qua formula)', () => {
  const mkPrisma = () => ({
    case: { findUnique: jest.fn().mockResolvedValue({ crime: 'CRIME_VAL' }) },
    incident: { findUnique: jest.fn().mockResolvedValue({ code: 'INC_VAL' }) },
    petition: { findUnique: jest.fn().mockResolvedValue({ stt: 'P_VAL' }) },
    directory: { findUnique: jest.fn().mockResolvedValue({ code: 'DIR_VAL' }) },
    systemSetting: { findUnique: jest.fn().mockResolvedValue({ value: 'SET_VAL' }) },
  });
  const ctx: any = { workId: 'WID', username: 'UN', departmentId: 'DEP', userId: 'UID', caseId: 'C1' };

  it('SR-01: NOW → Date', async () => {
    expect(await resolveSource('NOW', ctx, mkPrisma())).toBeInstanceOf(Date);
  });
  it('SR-02: ctx:Login.* map đúng field (id→userId)', async () => {
    const p = mkPrisma();
    expect(await resolveSource('ctx:Login.workId', ctx, p)).toBe('WID');
    expect(await resolveSource('ctx:Login.id', ctx, p)).toBe('UID');
    expect(await resolveSource('ctx:Login.departmentId', ctx, p)).toBe('DEP');
  });
  it('SR-03: ctx:Login field lạ → throw', async () => {
    await expect(resolveSource('ctx:Login.password', ctx, mkPrisma())).rejects.toThrow();
  });
  it('SR-04: lookup field hợp lệ (cases.crime) → gọi findUnique select đúng field', async () => {
    const p = mkPrisma();
    const v = await resolveSource('lookup:cases.crime', ctx, p);
    expect(v).toBe('CRIME_VAL');
    expect(p.case.findUnique).toHaveBeenCalledWith({ where: { id: 'C1' }, select: { crime: true } });
  });
  it('SR-05 SECURITY: lookup field NGOÀI allowlist → THROW, KHÔNG query DB (chống đọc cột bất kỳ)', async () => {
    const p = mkPrisma();
    for (const bad of ['password', 'investigatorId', 'metadata', 'deletedAt', '__proto__']) {
      await expect(resolveSource(`lookup:cases.${bad}`, ctx, p)).rejects.toThrow();
    }
    expect(p.case.findUnique).not.toHaveBeenCalled();
  });
  it('SR-06: lookup table lạ → throw', async () => {
    await expect(resolveSource('lookup:users.password', ctx, mkPrisma())).rejects.toThrow();
  });
  it('SR-07: lookup không có entityId trong ctx → "" (không query)', async () => {
    const p = mkPrisma();
    expect(await resolveSource('lookup:incidents.code', ctx, p)).toBe('');
    expect(p.incident.findUnique).not.toHaveBeenCalled();
  });
  it('SR-08: setting:KEY → value ?? ""', async () => {
    expect(await resolveSource('setting:SOME_KEY', ctx, mkPrisma())).toBe('SET_VAL');
  });
  it('SR-09: source type lạ → throw', async () => {
    await expect(resolveSource('garbage', ctx, mkPrisma())).rejects.toThrow();
  });
  it('SR-10 SECURITY property: mọi table chỉ field allowlist mới không throw', async () => {
    const allow: Record<string, string[]> = {
      cases: ['crime', 'caseType', 'name', 'status'],
      incidents: ['incidentType', 'code', 'status'],
      petitions: ['stt', 'status', 'petitionType'],
      directories: ['code', 'name', 'shortName'],
    };
    const fullCtx: any = { ...ctx, incidentId: 'I1', petitionId: 'P1' };
    for (const [table, fields] of Object.entries(allow)) {
      for (const f of fields) {
        const p: any = mkPrisma();
        p.case.findUnique.mockResolvedValue({ [f]: 'v' });
        p.incident.findUnique.mockResolvedValue({ [f]: 'v' });
        p.petition.findUnique.mockResolvedValue({ [f]: 'v' });
        p.directory.findUnique.mockResolvedValue({ [f]: 'v' });
        await expect(resolveSource(`lookup:${table}.${f}`, fullCtx, p)).resolves.toBeDefined();
      }
      await expect(resolveSource(`lookup:${table}.evil_col`, fullCtx, mkPrisma())).rejects.toThrow();
    }
  });
});
