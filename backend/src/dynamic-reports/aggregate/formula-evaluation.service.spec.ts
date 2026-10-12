import { FormulaEvaluationService, toFormulaView } from './formula-evaluation.service';
import type { GridModelService } from '../grid/grid-model.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { evaluateFormulasInWorker } from '../template/parse-in-worker';
import type { FormulaOutcome } from '../engine/grid-workbook';

jest.mock('../template/parse-in-worker', () => ({
  evaluateFormulasInWorker: jest.fn(),
}));

const worker = evaluateFormulasInWorker as jest.MockedFunction<typeof evaluateFormulasInWorker>;

const FIELDS = [
  { sheetKey: 'Đội 3', address: 'D10', fieldKey: 'Đội 3!D10', type: 'NUM' },
  { sheetKey: 'Đội 3', address: 'D11', fieldKey: 'Đội 3!D11', type: 'NUM' },
];
const MODEL = { sheets: [] } as unknown;

function build() {
  const prisma = { dynReportField: { findMany: jest.fn().mockResolvedValue(FIELDS) } };
  const grids = { getForVersion: jest.fn().mockResolvedValue({ model: MODEL, etag: '"e"' }) };
  const service = new FormulaEvaluationService(
    prisma as unknown as PrismaService,
    grids as unknown as GridModelService,
  );
  return { service, prisma, grids };
}

describe('toFormulaView', () => {
  it('keeps numbers as decimal text and says a failure in the engine\'s own words', () => {
    const outcomes: Record<string, FormulaOutcome> = {
      'S!A1': { ok: true, type: 'number', value: '12.50' },
      'S!A2': { ok: true, type: 'string', value: 'Đúng' },
      'S!A3': { ok: true, type: 'boolean', value: false },
      'S!A4': { ok: false, code: 'DIV_BY_ZERO' },
    };

    const view = toFormulaView(outcomes);

    expect(view['S!A1']).toEqual({ ok: true, type: 'number', value: '12.50' });
    expect(view['S!A2']).toEqual({ ok: true, type: 'string', value: 'Đúng' });
    expect(view['S!A3']).toEqual({ ok: true, type: 'boolean', value: false });
    expect(view['S!A4']).toMatchObject({ ok: false, code: 'DIV_BY_ZERO' });
    expect((view['S!A4'] as { text: string }).text).toEqual(expect.any(String));
    expect((view['S!A4'] as { text: string }).text.length).toBeGreaterThan(0);
  });
});

describe('FormulaEvaluationService', () => {
  beforeEach(() => {
    worker.mockReset();
    worker.mockResolvedValue({ 'Đội 3!G10': { ok: true, type: 'boolean', value: true } });
  });

  it('hands the template, its input fields and the values to the worker', async () => {
    const { service, prisma, grids } = build();

    const out = await service.evaluate('v1', { 'Đội 3!D10': '5', 'Đội 3!D11': null }, 'none');

    expect(out).toEqual({ 'Đội 3!G10': { ok: true, type: 'boolean', value: true } });
    expect(prisma.dynReportField.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { versionId: 'v1' } }));
    expect(grids.getForVersion).toHaveBeenCalledWith('v1');
    expect(worker).toHaveBeenCalledWith({
      grid: MODEL,
      fields: FIELDS.map((f) => ({ sheetKey: f.sheetKey, address: f.address, fieldKey: f.fieldKey, type: 'NUM' })),
      values: { 'Đội 3!D10': '5', 'Đội 3!D11': null },
      blankAs: 'none',
    });
  });

  it('answers the same question twice with one calculation, whatever order the values arrive in', async () => {
    const { service } = build();

    await service.evaluate('v1', { a: '1', b: '2' }, 'none');
    await service.evaluate('v1', { b: '2', a: '1' }, 'none');

    expect(worker).toHaveBeenCalledTimes(1);
  });

  it('never serves a figure for a different version, value, or blank rule', async () => {
    const { service } = build();

    await service.evaluate('v1', { a: '1' }, 'none');
    await service.evaluate('v2', { a: '1' }, 'none');
    await service.evaluate('v1', { a: '2' }, 'none');
    await service.evaluate('v1', { a: '1' }, 'blank');

    expect(worker).toHaveBeenCalledTimes(4);
  });

  it('does not cache a failure: the next call tries again', async () => {
    const { service } = build();
    worker.mockRejectedValueOnce(new Error('WORKER_BUSY'));

    await expect(service.evaluate('v1', { a: '1' }, 'none')).rejects.toThrow('WORKER_BUSY');
    await expect(service.evaluate('v1', { a: '1' }, 'none')).resolves.toBeDefined();

    expect(worker).toHaveBeenCalledTimes(2);
  });

  it('keeps the cache bounded: the oldest answer is the one forgotten', async () => {
    const { service } = build();
    for (let i = 0; i < 101; i++) await service.evaluate('v1', { a: String(i) }, 'none');
    expect(worker).toHaveBeenCalledTimes(101);

    await service.evaluate('v1', { a: '100' }, 'none'); // recent: still remembered
    expect(worker).toHaveBeenCalledTimes(101);

    await service.evaluate('v1', { a: '0' }, 'none'); // oldest: gone
    expect(worker).toHaveBeenCalledTimes(102);
  });
});
