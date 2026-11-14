import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CustomReportController } from './custom-report.controller';
import { ReportViewsController } from './report-views.controller';
import { CreateViewDto, CustomReportDto, UpdateViewDto } from './dto/view.dto';

const user = { id: 'u1', roleId: 'r1' };
const errorsOf = <T extends object>(type: new () => T, body: unknown) => validateSync(plainToInstance(type, body), { whitelist: true, forbidNonWhitelisted: true });

describe('ReportViewsController', () => {
  const service = { list: jest.fn(), create: jest.fn(), update: jest.fn(), archive: jest.fn(), restore: jest.fn(), remove: jest.fn() };
  const controller = new ReportViewsController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it('lists the views in use, and the archived ones too only when asked', async () => {
    await controller.list('r1', undefined, user);
    await controller.list('r1', 'true', user);
    await controller.list('r1', '1', user);
    await controller.list('r1', 'no', user);
    expect(service.list.mock.calls).toEqual([
      ['r1', user, false],
      ['r1', user, true],
      ['r1', user, true],
      ['r1', user, false],
    ]);
  });

  it('hands each operation to the service with who asks', async () => {
    await controller.create('r1', { name: 'A', itemKeys: ['k'] }, user);
    await controller.update('v1', { expectedRevision: 3, name: 'B' }, user);
    await controller.archive('v1', undefined, user);
    await controller.restore('v1', {}, user);
    expect(service.create).toHaveBeenCalledWith('r1', user, { name: 'A', itemKeys: ['k'] });
    expect(service.update).toHaveBeenCalledWith('v1', user, { expectedRevision: 3, name: 'B' });
    expect(service.archive).toHaveBeenCalledWith('v1', user, undefined);
    expect(service.restore).toHaveBeenCalledWith('v1', user, undefined);
  });

  it.each(['archive', 'restore'] as const)(
    '%s takes the revision the view was looked at when one is sent; without one (no body, an empty body, null) it goes ahead as before',
    async (operation) => {
      await controller[operation]('v1', { expectedRevision: 4 }, user);
      await controller[operation]('v1', undefined, user);
      await controller[operation]('v1', null, user);
      await controller[operation]('v1', {}, user);
      await controller[operation]('v1', { expectedRevision: null }, user);
      expect(service[operation].mock.calls).toEqual([
        ['v1', user, 4],
        ['v1', user, undefined],
        ['v1', user, undefined],
        ['v1', user, undefined],
        ['v1', user, undefined],
      ]);
    },
  );

  it.each(['archive', 'restore'] as const)('%s refuses a revision that is not a whole number from 1 up, and anything else in the body', (operation) => {
    for (const bad of ['4', '', 'abc', 1.5, -1, 0, 1e9, true, [4], {}]) {
      expect(() => controller[operation]('v1', { expectedRevision: bad }, user)).toThrow(
        expect.objectContaining({ status: 400, response: { code: 'EXPECTED_REVISION_INVALID' } }),
      );
    }
    for (const bad of [{ expectedRevision: 2, name: 'x' }, { revision: 2 }, 'text', [2]]) {
      expect(() => controller[operation]('v1', bad, user)).toThrow(expect.objectContaining({ status: 400 }));
    }
    expect(service[operation]).not.toHaveBeenCalled();
  });

  it('deleting takes the revision it was looked at when one is sent; a revision that is not a whole number is refused', async () => {
    await controller.remove('v1', undefined, user);
    await controller.remove('v1', ' 4 ', user);
    expect(service.remove.mock.calls).toEqual([
      ['v1', user, undefined],
      ['v1', user, 4],
    ]);
    for (const bad of ['', 'abc', '1.5', '-1', '0', '1e2']) {
      expect(() => controller.remove('v1', bad, user)).toThrow(
        expect.objectContaining({ status: 400, response: { code: 'EXPECTED_REVISION_INVALID' } }),
      );
    }
    expect(service.remove).toHaveBeenCalledTimes(2);
  });
});

describe('CustomReportController', () => {
  const service = { preview: jest.fn(), export: jest.fn() };
  const controller = new CustomReportController(service as never);

  it('the preview and the export take the same request', async () => {
    const body = { viewId: 'v1', definition: { itemKeys: ['k'] }, mode: 'APPROVED' as const };
    await controller.preview('p1', body, user);
    await controller.export('p1', body, user);
    expect(service.preview).toHaveBeenCalledWith('p1', user, body);
    expect(service.export).toHaveBeenCalledWith('p1', user, body);
  });
});

describe('the request bodies', () => {
  it('a view to save: everything optional but typed; null means "all" / "no title"', () => {
    expect(errorsOf(CreateViewDto, { name: 'A' })).toHaveLength(0);
    expect(errorsOf(CreateViewDto, { name: 'A', title: null, itemKeys: null, teamIds: null })).toHaveLength(0);
    expect(errorsOf(CreateViewDto, { name: 'A', title: 'T', showFilterLine: false, itemKeys: ['k1'], teamIds: ['t1'], teamColumns: false })).toHaveLength(0);
    // The name is judged by the service, which answers with a code.
    expect(errorsOf(CreateViewDto, {})).toHaveLength(0);
    for (const bad of [{ name: 5 }, { itemKeys: 'k1' }, { itemKeys: [1] }, { teamIds: [{}] }, { showFilterLine: 'yes' }, { teamColumns: 1 }, { other: 1 }]) {
      expect(errorsOf(CreateViewDto, bad)).not.toHaveLength(0);
    }
  });

  it('an edit must say which revision it was made from', () => {
    expect(errorsOf(UpdateViewDto, { expectedRevision: 2, name: 'B' })).toHaveLength(0);
    for (const bad of [{ name: 'B' }, { expectedRevision: '2' }, { expectedRevision: 0 }, { expectedRevision: 1.5 }]) {
      expect(errorsOf(UpdateViewDto, bad)).not.toHaveLength(0);
    }
  });

  it('a report of a period: nothing at all, a saved view, an unsaved definition, a mode', () => {
    expect(errorsOf(CustomReportDto, {})).toHaveLength(0);
    expect(errorsOf(CustomReportDto, { viewId: 'v1', mode: 'ALL_SAVED' })).toHaveLength(0);
    expect(errorsOf(CustomReportDto, { viewId: null, definition: null, mode: null })).toHaveLength(0);
    expect(errorsOf(CustomReportDto, { definition: { title: 'T', itemKeys: ['k'], teamIds: null, teamColumns: false, showFilterLine: true } })).toHaveLength(0);
    for (const bad of [{ mode: 'approved' }, { viewId: 7 }, { definition: { itemKeys: 'k' } }, { definition: { name: 'not here' } }, { definition: 'x' }]) {
      expect(errorsOf(CustomReportDto, bad)).not.toHaveLength(0);
    }
  });

  it('an explicit null mode is the same as no mode', () => {
    expect(plainToInstance(CustomReportDto, { mode: null }).mode).toBeUndefined();
  });
});
