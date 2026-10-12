import { NotFoundException } from '@nestjs/common';
import { GridController } from './grid.controller';
import type { GridModel } from '../engine/grid-types';

const MODEL = { sheetOrder: ['S'] } as unknown as GridModel;
const ETAG = '"g1-aaaaaaaaaaaaaaaa-v1"';
const USER = { id: 'u1', roleId: 'r1' };

function setup(opts: { allowed?: boolean } = {}) {
  const access = { canReadVersion: jest.fn().mockResolvedValue(opts.allowed ?? true) };
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
    expect(access.canReadVersion).toHaveBeenCalledWith('u1', 'r1', 'v9');
  });
});
