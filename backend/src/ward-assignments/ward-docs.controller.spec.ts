import 'reflect-metadata';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { WARD_ERROR } from './ward-assignment.codes';
import { WARD_DOCS_ERROR } from './ward-docs.codes';
import { WardDocsController } from './ward-docs.controller';

type Rule = { action: string; subject: string };
const handler = (method: string) => (WardDocsController.prototype as unknown as Record<string, object>)[method];
const permissions = (method: string) => ((Reflect.getMetadata(PERMISSIONS_KEY, handler(method)) as Rule[] | undefined) ?? []).map((r) => `${r.action}:${r.subject}`);
const route = (method: string) => `${RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler(method)) as number]} ${Reflect.getMetadata(PATH_METADATA, handler(method)) as string}`;

/**
 * The routes of lane C of the contract: reading follows `read:WardAssignment`, writing `review:WardAssignment` (the
 * reach and the state are the services'); a request that carries no resolved scope is refused before any service.
 */
describe('the routes of the result files and the request slips', () => {
  it.each([
    ['listFiles', 'GET :id/files', 'read:WardAssignment'],
    ['addFile', 'POST :id/files', 'review:WardAssignment'],
    ['downloadFile', 'GET :id/files/:fileId/download', 'read:WardAssignment'],
    ['removeFile', 'DELETE :id/files/:fileId', 'review:WardAssignment'],
    ['issueSlip', 'POST :id/decisions/:decisionId/slip', 'review:WardAssignment'],
    ['downloadSlip', 'GET :id/decisions/:decisionId/slip', 'read:WardAssignment'],
    ['reissueSlip', 'POST :id/decisions/:decisionId/slip/reissue', 'review:WardAssignment'],
  ])('%s is %s and asks for %s', (method, path_, wanted) => {
    expect(route(method)).toBe(path_);
    expect(permissions(method)).toEqual([wanted]);
  });

  const build = () => {
    const files = { list: jest.fn(), add: jest.fn(), download: jest.fn(), remove: jest.fn() };
    const slips = { issue: jest.fn(), download: jest.fn(), reissue: jest.fn() };
    return { controller: new WardDocsController(files as never, slips as never), files, slips };
  };
  const noScope = { dataScope: undefined, headers: {} } as unknown as ScopedRequest;

  it('a request without a resolved scope is refused, and its uploaded file removed', async () => {
    const { controller, files, slips } = build();
    expect(() => controller.listFiles('wa1', noScope)).toThrow(expect.objectContaining({ response: { code: WARD_ERROR.FORBIDDEN, details: [] } }));
    expect(() => controller.issueSlip('wa1', 'd1', {}, { id: 'u' }, noScope)).toThrow();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdc-'));
    const file = path.join(dir, 'a.txt');
    fs.writeFileSync(file, 'hello');
    await expect(
      controller.addFile('wa1', { path: file, originalname: 'a.txt', mimetype: 'text/plain', size: 5, filename: 'a.txt' } as never, { id: 'u' }, noScope),
    ).rejects.toMatchObject({ response: { code: WARD_ERROR.FORBIDDEN } });
    expect(fs.existsSync(file)).toBe(false);
    expect(files.add).not.toHaveBeenCalled();
    expect(slips.issue).not.toHaveBeenCalled();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('no file → a code; a file whose content is not its type → a code, and it is removed', async () => {
    const { controller } = build();
    const scoped = { dataScope: null, headers: {} } as unknown as ScopedRequest;
    await expect(controller.addFile('wa1', undefined, { id: 'u' }, scoped)).rejects.toMatchObject({ response: { code: WARD_DOCS_ERROR.FILE_REQUIRED } });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdc-'));
    const file = path.join(dir, 'fake.pdf');
    fs.writeFileSync(file, 'not a pdf');
    await expect(
      controller.addFile('wa1', { path: file, originalname: 'fake.pdf', mimetype: 'application/pdf', size: 9, filename: 'fake.pdf' } as never, { id: 'u' }, scoped),
    ).rejects.toMatchObject({ response: { code: WARD_DOCS_ERROR.FILE_TYPE_REFUSED } });
    expect(fs.existsSync(file)).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
