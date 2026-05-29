import { sanitizeBatchFilename, validateBatchRequest, MAX_BATCH_SIZE } from './batch-export.service';

describe('BatchExportService — pure helpers', () => {
  describe('MAX_BATCH_SIZE', () => {
    it('caps at 100 to prevent OOM and abusive load', () => {
      expect(MAX_BATCH_SIZE).toBe(100);
    });
  });

  describe('validateBatchRequest', () => {
    it('rejects empty petitionIds array with 400', () => {
      expect(() => validateBatchRequest([], 'PHIEU_DE_XUAT')).toThrow(/petitionIds|trống/);
    });

    it(`rejects > ${100} petitionIds`, () => {
      const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);
      expect(() => validateBatchRequest(ids, 'PHIEU_DE_XUAT')).toThrow(/100/);
    });

    it('rejects unknown docType', () => {
      expect(() => validateBatchRequest(['id-1'], 'NOT_A_REAL_DOC' as any)).toThrow(
        /docType/,
      );
    });

    it('rejects duplicate petitionIds in same batch (defensive — protects DocumentRenderLog from double-allocation race)', () => {
      expect(() =>
        validateBatchRequest(['id-1', 'id-2', 'id-1'], 'PHIEU_DE_XUAT'),
      ).toThrow(/trùng|duplicate/i);
    });

    it('passes a clean batch of 1..100 petitions', () => {
      expect(() => validateBatchRequest(['id-1', 'id-2'], 'PHIEU_DE_XUAT')).not.toThrow();
      const ids100 = Array.from({ length: 100 }, (_, i) => `id-${i}`);
      expect(() => validateBatchRequest(ids100, 'PHIEU_DE_XUAT')).not.toThrow();
    });
  });

  describe('sanitizeBatchFilename', () => {
    it('builds a ZIP filename from docType + timestamp', () => {
      const filename = sanitizeBatchFilename('PHIEU_DE_XUAT', new Date('2026-05-29T10:30:00Z'));
      expect(filename).toMatch(/PHIEU_DE_XUAT/);
      expect(filename).toMatch(/2026/);
      expect(filename.endsWith('.zip')).toBe(true);
    });

    it('returns sanitized output (no /, \\, ..)', () => {
      const filename = sanitizeBatchFilename('PHIEU_DE_XUAT', new Date());
      expect(filename).not.toContain('/');
      expect(filename).not.toContain('\\');
      expect(filename).not.toContain('..');
    });
  });
});
