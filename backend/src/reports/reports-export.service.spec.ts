/**
 * ReportsExportService Unit Tests
 *
 * Covers the export methods and critical edge cases:
 * - Stat48 export: worksheet name sanitization (colon/special chars crash ExcelJS)
 * - Monthly/Quarterly export: response headers and stream write
 */

import { ReportsExportService } from './reports-export.service';

// ─── Mock ExcelJS ─────────────────────────────────────────────────────────────

const mockSheet = {
  mergeCells: jest.fn(),
  getCell: jest.fn().mockReturnValue({
    value: null,
    font: {},
    fill: {},
    alignment: {},
    border: {},
  }),
  getRow: jest.fn().mockReturnValue({
    getCell: jest.fn().mockReturnValue({ value: null, font: {}, fill: {}, alignment: {}, border: {} }),
    height: 0,
  }),
  columns: [],
};

const mockWorkbook = {
  addWorksheet: jest.fn().mockReturnValue(mockSheet),
  xlsx: {
    write: jest.fn().mockResolvedValue(undefined),
  },
};

jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => mockWorkbook),
}));

// ─── Mock Response ────────────────────────────────────────────────────────────

function makeRes() {
  return {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    headersSent: false,
    destroy: jest.fn(),
  } as any;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ReportsExportService', () => {
  let service: ReportsExportService;

  beforeEach(() => {
    service = new ReportsExportService();
    jest.clearAllMocks();
    // Re-setup mocks after clear
    mockSheet.getCell.mockReturnValue({ value: null, font: {}, fill: {}, alignment: {}, border: {} });
    mockSheet.getRow.mockReturnValue({
      getCell: jest.fn().mockReturnValue({ value: null, font: {}, fill: {}, alignment: {}, border: {} }),
      height: 0,
    });
    mockWorkbook.addWorksheet.mockReturnValue(mockSheet);
    mockWorkbook.xlsx.write.mockResolvedValue(undefined);
  });

  // ── exportStat48 ────────────────────────────────────────────────────────────

  describe('exportStat48', () => {
    const baseStat48 = {
      totalCases: 10,
      nullCount: 2,
      nullRatePct: 20,
      isDraft: false,
      fromDate: '2025-01-01',
      toDate: '2025-12-31',
      groups: [],
    };

    it('sanitizes worksheet name: strips colon from group name', async () => {
      const data = {
        ...baseStat48,
        groups: [{ name: 'Nhóm 1: Nguồn tin', fields: [] }],
      };

      await service.exportStat48(data as any, makeRes());

      const sheetName = mockWorkbook.addWorksheet.mock.calls[0][0];
      // Colon must be replaced with dash, not kept
      expect(sheetName).not.toContain(':');
      expect(sheetName).toBe('Nhóm 1- Nguồn tin');
    });

    it('sanitizes worksheet name: strips all ExcelJS-illegal chars (* ? : \\ / [ ])', async () => {
      const data = {
        ...baseStat48,
        groups: [{ name: 'Test*?:/\\[]Sheet', fields: [] }],
      };

      await service.exportStat48(data as any, makeRes());

      const sheetName = mockWorkbook.addWorksheet.mock.calls[0][0];
      expect(sheetName).not.toMatch(/[*?:/\\[\]]/);
    });

    it('truncates worksheet name to 31 characters', async () => {
      const longName = 'A'.repeat(50);
      const data = {
        ...baseStat48,
        groups: [{ name: longName, fields: [] }],
      };

      await service.exportStat48(data as any, makeRes());

      const sheetName = mockWorkbook.addWorksheet.mock.calls[0][0];
      expect(sheetName.length).toBeLessThanOrEqual(31);
    });

    it('creates one worksheet per group', async () => {
      const data = {
        ...baseStat48,
        groups: [
          { name: 'Nhóm 1- Nguồn tin', fields: [] },
          { name: 'Nhóm 2- Tội phạm', fields: [] },
          { name: 'Nhóm 3- Đối tượng', fields: [] },
          { name: 'Nhóm 4- Kết quả', fields: [] },
        ],
      };

      await service.exportStat48(data as any, makeRes());

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledTimes(4);
    });

    it('sets Content-Disposition attachment header', async () => {
      const res = makeRes();
      await service.exportStat48(baseStat48 as any, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment'),
      );
    });

    it('appends _DRAFT to filename when isDraft=true', async () => {
      const res = makeRes();
      await service.exportStat48({ ...baseStat48, isDraft: true } as any, res);

      const dispositionCall = res.setHeader.mock.calls.find(
        (c: string[]) => c[0] === 'Content-Disposition',
      );
      expect(dispositionCall[1]).toContain('DRAFT');
    });

    it('does NOT crash when groups array is empty', async () => {
      await expect(
        service.exportStat48(baseStat48 as any, makeRes()),
      ).resolves.not.toThrow();
    });
  });

  // ── exportMonthly ────────────────────────────────────────────────────────────

  describe('exportMonthly', () => {
    const monthlyData = {
      year: 2026,
      month: 2,
      data: [
        { month: 'Tháng 1', donThu: 10, vuViec: 5, vuAn: 3, daGiaiQuyet: 8 },
      ],
      totals: { donThu: 10, vuViec: 5, vuAn: 3, daGiaiQuyet: 8 },
    };

    it('includes month in filename when month is provided', async () => {
      const res = makeRes();
      await service.exportMonthly(monthlyData as any, res);

      const dispositionCall = res.setHeader.mock.calls.find(
        (c: string[]) => c[0] === 'Content-Disposition',
      );
      expect(dispositionCall[1]).toContain('_T2');
    });

    it('omits month from filename when only year provided', async () => {
      const res = makeRes();
      const yearOnly = { ...monthlyData, month: undefined };
      await service.exportMonthly(yearOnly as any, res);

      const dispositionCall = res.setHeader.mock.calls.find(
        (c: string[]) => c[0] === 'Content-Disposition',
      );
      expect(dispositionCall[1]).not.toContain('_T');
    });
  });
});
