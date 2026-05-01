/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * TdacExportService Unit Tests
 *
 * export():
 *   - throws ServiceUnavailableException when template file is not found
 *   - throws ServiceUnavailableException when workbook has no worksheets
 *   - fills total and team cells for each data row
 *   - sets Content-Type and Content-Disposition headers on the response
 *   - skips rows with unknown rowKey (no crash)
 */

import { ServiceUnavailableException } from '@nestjs/common';
import { TdacExportService } from './tdac-export.service';

// ─── Mock fs ──────────────────────────────────────────────────────────────────

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

import * as fs from 'fs';
const mockExistsSync = fs.existsSync as jest.Mock;

// ─── Mock ExcelJS ─────────────────────────────────────────────────────────────

const mockCell = { value: null as unknown };

const mockWorksheet = {
  getCell: jest.fn().mockReturnValue(mockCell),
};

const mockWorkbook = {
  xlsx: {
    readFile: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
  },
  worksheets: [mockWorksheet] as typeof mockWorksheet[],
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
  } as any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    loaiBaoCao: 'VU_AN',
    computedData: {
      rows: [
        { rowKey: '1', total: 10, byTeam: [{ teamId: 'to4', value: 4 }, { teamId: 'to5', value: 6 }] },
        { rowKey: '2', total: 5, byTeam: [{ teamId: 'to4', value: 2 }, { teamId: 'to5', value: 3 }] },
      ],
    },
    adjustedData: null,
    ...overrides,
  } as any;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('TdacExportService', () => {
  let service: TdacExportService;

  beforeEach(() => {
    service = new TdacExportService();
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockWorkbook.xlsx.readFile.mockResolvedValue(undefined);
    mockWorkbook.xlsx.write.mockResolvedValue(undefined);
    mockWorkbook.worksheets = [mockWorksheet];
    mockWorksheet.getCell.mockReturnValue({ value: null });
  });

  // ── export ─────────────────────────────────────────────────────────────────

  it('throws ServiceUnavailableException when template file is not found', async () => {
    mockExistsSync.mockReturnValue(false);

    await expect(service.export(makeDraft(), makeRes())).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws ServiceUnavailableException when workbook has no worksheets', async () => {
    mockWorkbook.worksheets = [];

    await expect(service.export(makeDraft(), makeRes())).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('fills total cell (column C) and team cells (D, E) for known rowKeys', async () => {
    const cells: Record<string, { value: unknown }> = {};
    mockWorksheet.getCell.mockImplementation((addr: string) => {
      if (!cells[addr]) cells[addr] = { value: null };
      return cells[addr];
    });

    await service.export(makeDraft(), makeRes());

    // rowKey '1' maps to Excel row 8 → C8=total, D8=team0, E8=team1
    expect(cells['C8']?.value).toBe(10);
    expect(cells['D8']?.value).toBe(4);
    expect(cells['E8']?.value).toBe(6);
    // rowKey '2' → row 9
    expect(cells['C9']?.value).toBe(5);
  });

  it('sets Content-Type and Content-Disposition headers on the response', async () => {
    const res = makeRes();
    await service.export(makeDraft(), res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment'),
    );
  });

  it('prefers adjustedData over computedData when both present', async () => {
    const cells: Record<string, { value: unknown }> = {};
    mockWorksheet.getCell.mockImplementation((addr: string) => {
      if (!cells[addr]) cells[addr] = { value: null };
      return cells[addr];
    });

    const draft = makeDraft({
      adjustedData: {
        rows: [{ rowKey: '1', total: 99, byTeam: [] }],
      },
      computedData: {
        rows: [{ rowKey: '1', total: 1, byTeam: [] }],
      },
    });

    await service.export(draft, makeRes());

    // adjustedData wins → C8 = 99
    expect(cells['C8']?.value).toBe(99);
  });

  it('does not crash when rows contain unknown rowKeys', async () => {
    const draft = makeDraft({
      computedData: {
        rows: [{ rowKey: 'UNKNOWN_KEY', total: 5, byTeam: [] }],
      },
    });

    await expect(service.export(draft, makeRes())).resolves.not.toThrow();
  });
});
