/**
 * v0.47 PR1 T4 — Unit tests for v0.47 series additions in seed-document-numbers.ts.
 *
 * Validates the static seed config shape (no DB) so the seed contract stays stable
 * even if future edits drift. Integration test (actual `commit('PHIEU_DE_XUAT', ctx)`
 * round-trip) lands in PR2 once PetitionsService.exportDocument is wired.
 */

// Import the module to access internal arrays/helpers via test-only re-export.
// The seed file does not currently export TEMPLATES / buildSegments — for this
// spec we re-export them. If maintainers prefer keeping seed internals private,
// the right next step is a behavioural integration test instead.
import * as seedModule from './seed-document-numbers';

describe('v0.47 seed-document-numbers — 4 new series for Document Template Engine', () => {
  const TEMPLATES = (seedModule as any).TEMPLATES_FOR_TEST as Array<{
    name: string;
    documentType: string;
    prefix: string;
    separator: string;
    resetPeriod: string;
    padding: number;
  }>;

  it('exposes the TEMPLATES array via TEMPLATES_FOR_TEST', () => {
    expect(Array.isArray(TEMPLATES)).toBe(true);
  });

  describe('PHIEU_DE_XUAT (ĐX)', () => {
    const spec = () => TEMPLATES.find((t) => t.documentType === 'PHIEU_DE_XUAT');

    it('exists with prefix "ĐX-PC02-Đ1"', () => {
      expect(spec()?.prefix).toBe('ĐX-PC02-Đ1');
    });

    it('uses "/" separator + YEARLY reset + 4-digit padding', () => {
      const s = spec()!;
      expect(s.separator).toBe('/');
      expect(s.resetPeriod).toBe('YEARLY');
      expect(s.padding).toBe(4);
    });
  });

  describe('PHIEU_CHUYEN (PC)', () => {
    it('exists with prefix "PC-PC02-Đ1"', () => {
      expect(TEMPLATES.find((t) => t.documentType === 'PHIEU_CHUYEN')?.prefix).toBe('PC-PC02-Đ1');
    });
  });

  describe('THONG_BAO (TB)', () => {
    it('exists with prefix "TB-PC02-Đ1"', () => {
      expect(TEMPLATES.find((t) => t.documentType === 'THONG_BAO')?.prefix).toBe('TB-PC02-Đ1');
    });
  });

  describe('HUONG_DAN (HD)', () => {
    it('exists with prefix "HD-PC02-Đ1"', () => {
      expect(TEMPLATES.find((t) => t.documentType === 'HUONG_DAN')?.prefix).toBe('HD-PC02-Đ1');
    });
  });

  describe('buildSegments for v0.47 series', () => {
    const buildSegments = (seedModule as any).buildSegmentsForTest as (s: any) => any[];

    it('produces [COUNTER, LITERAL prefix] (no year segment, counter first)', () => {
      const segments = buildSegments({
        documentType: 'PHIEU_DE_XUAT',
        prefix: 'ĐX-PC02-Đ1',
      });
      expect(segments).toEqual([
        { type: 'COUNTER' },
        { type: 'LITERAL', value: 'ĐX-PC02-Đ1' },
      ]);
    });

    it('legacy series still get [LITERAL, FORMULA year, COUNTER]', () => {
      const segments = buildSegments({
        documentType: 'PETITION',
        prefix: 'DT',
        yearPattern: 'YYYY',
      });
      expect(segments).toEqual([
        { type: 'LITERAL', value: 'DT' },
        { type: 'FORMULA', fn: 'FORMAT', source: 'NOW', pattern: 'YYYY' },
        { type: 'COUNTER' },
      ]);
    });
  });

  it('joining segments with separator yields "0001/ĐX-PC02-Đ1" shape', () => {
    const spec = TEMPLATES.find((t) => t.documentType === 'PHIEU_DE_XUAT')!;
    const buildSegments = (seedModule as any).buildSegmentsForTest as (s: any) => any[];
    const segments = buildSegments(spec);
    // Engine renders COUNTER as padded number, LITERAL as value. Simulate manually:
    const rendered = segments
      .map((seg) => {
        if (seg.type === 'COUNTER') return String(1).padStart(spec.padding, '0');
        if (seg.type === 'LITERAL') return seg.value;
        return '';
      })
      .join(spec.separator);
    expect(rendered).toBe('0001/ĐX-PC02-Đ1');
  });
});
