import { NotFoundException } from '@nestjs/common';
import { GridController } from './grid.controller';
import type { GridModel } from '../engine/grid-types';

const MODEL = { sheetOrder: ['S'] } as unknown as GridModel;
const ETAG = '"g1-aaaaaaaaaaaaaaaa-v1"';
const USER = { id: 'u1', roleId: 'r1' };

function setup(opts: { allowed?: boolean; scope?: unknown } = {}) {
  const scope = opts.scope ?? ((opts.allowed ?? true) ? { kind: 'ALL' } : { kind: 'NONE' });
  const access = { readScope: jest.fn().mockResolvedValue(scope) };
  const grids = { getForVersion: jest.fn().mockResolvedValue({ model: MODEL, etag: ETAG }) };
  const headers: Record<string, string> = {};
  const res = {
    setHeader: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    status: jest.fn(),
  };
  const req = (inm?: string) => ({ headers: inm ? { 'if-none-match': inm } : {} });
  const controller = new GridController(access as never, grids as never);
  return { controller, access, grids, res, headers, req };
}

describe('GridController', () => {
  it('returns the model with a validator and must-revalidate caching', async () => {
    const { controller, res, headers, req } = setup();
    const body = await controller.grid('v1', USER, req() as never, res as never);
    expect(body).toBe(MODEL);
    expect(headers['ETag']).toBe(ETAG);
    expect(headers['Cache-Control']).toBe('private, max-age=0, must-revalidate');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('answers 304 with no body when the client already holds this exact version', async () => {
    const { controller, res, req } = setup();
    const body = await controller.grid('v1', USER, req(ETAG) as never, res as never);
    expect(body).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(304);
  });

  it('a stale validator gets the full model', async () => {
    const { controller, req, res } = setup();
    const body = await controller.grid('v1', USER, req('"g1-old"') as never, res as never);
    expect(body).toBe(MODEL);
  });

  it('a caller outside the report gets 404 — and never reaches the cache, the ETag or a 304', async () => {
    const { controller, grids, res, headers, req } = setup({ allowed: false });
    await expect(controller.grid('v1', USER, req(ETAG) as never, res as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(grids.getForVersion).not.toHaveBeenCalled();
    expect(headers['ETag']).toBeUndefined();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('asks the access service with the caller, their role and the requested version', async () => {
    const { controller, access, res, req } = setup();
    await controller.grid('v9', USER, req() as never, res as never);
    expect(access.readScope).toHaveBeenCalledWith('u1', 'r1', 'v9');
  });

  describe('an editor whose team reports only some of the criteria', () => {
    const SHEET = {
      name: 'S', rows: 2, cols: 2, colWidthsPx: [], rowHeightsPx: [], hiddenRows: [], hiddenCols: [], merges: [],
      freeze: { rows: 0, cols: 0 }, showGridlines: true, showZeros: true, zoom: 100,
      cells: { B1: { k: 'text', v: 'mine' }, C1: { k: 'text', v: '' }, B2: { k: 'text', v: 'SECRET of another team' }, C2: { k: 'text', v: '' } },
      colStyles: [], rowStyles: {}, conditionalFormats: [], validations: [],
    };
    const FULL = { sheetOrder: ['S'], sheets: [SHEET] } as unknown as GridModel;
    const OWNED = {
      kind: 'OWNED',
      ownedFieldKeys: ['S!C1'],
      criteriaRows: true,
      fields: [
        { sheetKey: 'S', address: 'C1', fieldKey: 'S!C1' },
        { sheetKey: 'S', address: 'C2', fieldKey: 'S!C2' },
      ],
    };

    it('receives the grid without the criteria of other teams', async () => {
      const { controller, grids, res, req } = setup({ scope: OWNED });
      grids.getForVersion.mockResolvedValue({ model: FULL, etag: ETAG });

      const body = await controller.grid('v1', USER, req() as never, res as never);

      expect(JSON.stringify(body)).not.toContain('SECRET');
      expect(JSON.stringify(body)).toContain('mine');
    });

    it('gets a validator of its own: the whole-report ETag never earns it a 304, and its own does', async () => {
      const { controller, grids, res, headers, req } = setup({ scope: OWNED });
      grids.getForVersion.mockResolvedValue({ model: FULL, etag: ETAG });

      const withWholeEtag = await controller.grid('v1', USER, req(ETAG) as never, res as never);
      expect(withWholeEtag).toBeDefined();
      expect(headers['ETag']).not.toBe(ETAG);
      expect(res.status).not.toHaveBeenCalled();

      const again = await controller.grid('v1', USER, req(headers['ETag']) as never, res as never);
      expect(again).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(304);
    });
  });
});
