import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProcessingFlowsController } from './processing-flows.controller';
import { ProcessingFlowsService } from './processing-flows.service';

/**
 * The routes of the flow configuration through the REAL feature-switch and permission guards: a route is not there
 * while the switch is off (404), and is refused to a person who lacks exactly its permission (403).
 */
const ALL = ['read', 'create', 'edit', 'delete', 'publish', 'verify'].map((action) => `${action}:ProcessingFlow`);

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
/** [method, path, body, the permission it needs, the service method it reaches] */
const ROUTES: Array<[Method, string, object | undefined, string, string]> = [
  ['get', '/processing-flows', undefined, 'read:ProcessingFlow', 'list'],
  ['get', '/processing-flows/templates', undefined, 'read:ProcessingFlow', 'templates'],
  ['get', '/processing-flows/resolve?recordKind=PETITION&informationType=x', undefined, 'read:ProcessingFlow', 'resolve'],
  ['post', '/processing-flows/preview-schedule', { recordKind: 'PETITION', steps: [], anchors: {} }, 'read:ProcessingFlow', 'previewSchedule'],
  ['get', '/processing-flows/f1', undefined, 'read:ProcessingFlow', 'get'],
  ['post', '/processing-flows', { name: 'A', recordKind: 'PETITION' }, 'create:ProcessingFlow', 'create'],
  ['patch', '/processing-flows/f1', { name: 'B', expectedRevision: 1 }, 'edit:ProcessingFlow', 'update'],
  ['put', '/processing-flows/f1/bindings', { directoryIds: [], deadlineGroups: [], expectedRevision: 1 }, 'edit:ProcessingFlow', 'setBindings'],
  ['post', '/processing-flows/f1/archive', { expectedRevision: 1 }, 'edit:ProcessingFlow', 'archive'],
  ['post', '/processing-flows/f1/restore', { expectedRevision: 1 }, 'edit:ProcessingFlow', 'restore'],
  ['delete', '/processing-flows/f1?expectedRevision=1&confirmName=A', undefined, 'delete:ProcessingFlow', 'remove'],
  ['post', '/processing-flows/f1/versions', undefined, 'edit:ProcessingFlow', 'createDraft'],
  ['put', '/processing-flows/f1/versions/v1/steps', { steps: [], expectedRevision: 1 }, 'edit:ProcessingFlow', 'replaceSteps'],
  ['delete', '/processing-flows/f1/versions/v1', undefined, 'edit:ProcessingFlow', 'deleteDraft'],
  ['post', '/processing-flows/f1/versions/v1/publish', { expectedRevision: 1 }, 'publish:ProcessingFlow', 'publish'],
  ['post', '/processing-flows/f1/versions/v1/steps/k1/verify-legal', undefined, 'verify:ProcessingFlow', 'verifyLegal'],
  ['post', '/processing-flows/f1/versions/v1/steps/k1/unverify-legal', undefined, 'verify:ProcessingFlow', 'unverifyLegal'],
];

describe('ProcessingFlowsController (HTTP, real guards)', () => {
  let app: INestApplication;
  const service = Object.fromEntries(
    ['list', 'templates', 'resolve', 'previewSchedule', 'get', 'create', 'update', 'setBindings', 'archive', 'restore', 'remove', 'createDraft', 'replaceSteps', 'deleteDraft', 'publish', 'verifyLegal', 'unverifyLegal'].map(
      (name) => [name, jest.fn()],
    ),
  ) as Record<string, jest.Mock>;
  let switchedOn = true;
  let held: string[] = ALL;
  const asked: string[] = [];

  const call = (method: Method, path: string, body?: object) => {
    const sent = request(app.getHttpServer())[method](path);
    return body === undefined ? sent : sent.send(body);
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProcessingFlowsController],
      providers: [
        { provide: ProcessingFlowsService, useValue: service },
        {
          provide: FeatureFlagsService,
          useValue: {
            isEnabled: (key: string) => {
              asked.push(key);
              return Promise.resolve(switchedOn);
            },
          },
        },
        {
          provide: PrismaService,
          useValue: {
            rolePermission: {
              findMany: () =>
                Promise.resolve(
                  held.map((key) => {
                    const at = key.indexOf(':');
                    return { permission: { action: key.slice(0, at), subject: key.slice(at + 1) } };
                  }),
                ),
            },
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): { user?: unknown } } }) => {
          context.switchToHttp().getRequest().user = { id: 'admin-1', roleId: 'role-1', role: 'ADMIN' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    // Same pipe as main.ts: unknown keys are rejected, not silently dropped.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset().mockResolvedValue({ ok: true }));
    switchedOn = true;
    held = ALL;
    asked.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('the table names every route of the controller', () => {
    expect(new Set(ROUTES.map((route) => route[4])).size).toBe(Object.keys(service).length);
  });

  it.each(ROUTES)('%s %s is not there while the switch is off', async (method, path, body) => {
    switchedOn = false;
    await call(method, path, body).expect(404);
    expect(asked).toEqual(['processing_flow']);
    Object.values(service).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it.each(ROUTES)('%s %s is refused to a person who holds every permission but its own (%s)', async (method, path, body, permission) => {
    held = ALL.filter((key) => key !== permission);
    await call(method, path, body).expect(403);
    Object.values(service).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it.each(ROUTES)('%s %s needs nothing but its own permission', async (method, path, body, permission, reached) => {
    held = [permission];
    const response = await call(method, path, body);
    expect(response.status).toBeLessThan(300);
    expect(service[reached]).toHaveBeenCalledTimes(1);
  });

  it('a person with no permission of the feature reaches nothing', async () => {
    held = ['read:Petition', 'read:ProcessingCalendar'];
    for (const [method, path, body] of ROUTES) await call(method, path, body).expect(403);
    Object.values(service).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  describe('what reaches the service', () => {
    it('the list: a record kind and whether the archived ones are wanted', async () => {
      await call('get', '/processing-flows').expect(200);
      await call('get', '/processing-flows?recordKind=CASE&includeArchived=true').expect(200);
      await call('get', '/processing-flows?includeArchived=1').expect(200);
      expect(service.list.mock.calls).toEqual([
        [{ recordKind: undefined, includeArchived: false }],
        [{ recordKind: 'CASE', includeArchived: true }],
        [{ recordKind: undefined, includeArchived: true }],
      ]);
    });

    it('who acts is the signed-in person, never a value of the body', async () => {
      await call('post', '/processing-flows', { name: 'A', recordKind: 'PETITION', isDefault: true, templateKey: 'PETITION_COMPLAINT' }).expect(201);
      expect(service.create).toHaveBeenCalledWith('admin-1', { name: 'A', recordKind: 'PETITION', isDefault: true, templateKey: 'PETITION_COMPLAINT' });
      await call('post', '/processing-flows', { name: 'A', recordKind: 'PETITION', actorId: 'somebody-else' }).expect(400);
      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it('edits, bindings, archive, restore and publish carry the revision they were decided on', async () => {
      await call('patch', '/processing-flows/f1', { description: null, isDefault: false, expectedRevision: 3 }).expect(200);
      await call('put', '/processing-flows/f1/bindings', { directoryIds: ['d1'], deadlineGroups: ['TO_CAO'], expectedRevision: 4 }).expect(200);
      await call('post', '/processing-flows/f1/archive', { expectedRevision: 5 }).expect(200);
      await call('post', '/processing-flows/f1/restore', { expectedRevision: 6 }).expect(200);
      await call('post', '/processing-flows/f1/versions/v1/publish', { expectedRevision: 2 }).expect(200);
      expect(service.update).toHaveBeenCalledWith('f1', 'admin-1', { description: null, isDefault: false, expectedRevision: 3 });
      expect(service.setBindings).toHaveBeenCalledWith('f1', 'admin-1', { directoryIds: ['d1'], deadlineGroups: ['TO_CAO'], expectedRevision: 4 });
      expect(service.archive).toHaveBeenCalledWith('f1', 'admin-1', 5);
      expect(service.restore).toHaveBeenCalledWith('f1', 'admin-1', 6);
      expect(service.publish).toHaveBeenCalledWith('f1', 'v1', 'admin-1', 2);
    });

    it.each([
      ['patch', '/processing-flows/f1', { name: 'B' }],
      ['patch', '/processing-flows/f1', { name: 'B', expectedRevision: '1' }],
      ['put', '/processing-flows/f1/bindings', { directoryIds: [], deadlineGroups: [] }],
      ['put', '/processing-flows/f1/bindings', { directoryIds: 'd1', deadlineGroups: [], expectedRevision: 1 }],
      ['post', '/processing-flows/f1/archive', {}],
      ['post', '/processing-flows/f1/restore', { expectedRevision: 0 }],
      ['post', '/processing-flows/f1/versions/v1/publish', { expectedRevision: 1.5 }],
      ['put', '/processing-flows/f1/versions/v1/steps', { steps: [] }],
      ['put', '/processing-flows/f1/versions/v1/steps', { steps: 'x', expectedRevision: 1 }],
    ] as Array<[Method, string, object]>)('%s %s refuses a body without a whole revision or of the wrong shape: %j', async (method, path, body) => {
      await call(method, path, body).expect(400);
      Object.values(service).forEach((fn) => expect(fn).not.toHaveBeenCalled());
    });

    it('the steps of a draft travel as sent: the service judges them and answers with codes', async () => {
      const steps = [{ name: 'One', durationUnit: 'WEEK', anything: 1 }];
      await call('put', '/processing-flows/f1/versions/v1/steps', { steps, expectedRevision: 2 }).expect(200);
      expect(service.replaceSteps).toHaveBeenCalledWith('f1', 'v1', 'admin-1', { steps, expectedRevision: 2 });
    });

    it('deleting a flow needs the revision and passes the name typed back', async () => {
      await call('delete', '/processing-flows/f1?expectedRevision=4&confirmName=Quy%20tr%C3%ACnh%20A').expect(200);
      await call('delete', '/processing-flows/f1?expectedRevision=4').expect(200);
      expect(service.remove.mock.calls).toEqual([
        ['f1', 'admin-1', { expectedRevision: 4, confirmName: 'Quy trình A' }],
        ['f1', 'admin-1', { expectedRevision: 4, confirmName: undefined }],
      ]);
      for (const bad of ['', '?expectedRevision=', '?expectedRevision=abc', '?expectedRevision=0', '?expectedRevision=1.5', '?expectedRevision=-1']) {
        const response = await call('delete', `/processing-flows/f1${bad}`).expect(400);
        expect(response.body).toMatchObject({ code: 'EXPECTED_REVISION_INVALID' });
      }
      expect(service.remove).toHaveBeenCalledTimes(2);
    });

    it('throwing a draft away takes the revision when one is sent', async () => {
      await call('delete', '/processing-flows/f1/versions/v1').expect(200);
      await call('delete', '/processing-flows/f1/versions/v1?expectedRevision=3').expect(200);
      expect(service.deleteDraft.mock.calls).toEqual([
        ['f1', 'v1', 'admin-1', undefined],
        ['f1', 'v1', 'admin-1', 3],
      ]);
      const response = await call('delete', '/processing-flows/f1/versions/v1?expectedRevision=x').expect(400);
      expect(response.body).toMatchObject({ code: 'EXPECTED_REVISION_INVALID' });
    });

    it('confirming a legal basis names the flow, the version and the step', async () => {
      await call('post', '/processing-flows/f1/versions/v1/steps/k1/verify-legal').expect(200);
      await call('post', '/processing-flows/f1/versions/v1/steps/k1/unverify-legal').expect(200);
      expect(service.verifyLegal).toHaveBeenCalledWith('f1', 'v1', 'k1', 'admin-1');
      expect(service.unverifyLegal).toHaveBeenCalledWith('f1', 'v1', 'k1', 'admin-1');
    });

    it('resolve and the preview hand over what was asked', async () => {
      await call('get', '/processing-flows/resolve?recordKind=PETITION&informationType=T%E1%BB%91%20c%C3%A1o').expect(200);
      await call('get', '/processing-flows/resolve?recordKind=CASE').expect(200);
      expect(service.resolve.mock.calls).toEqual([
        ['PETITION', 'Tố cáo'],
        ['CASE', undefined],
      ]);
      const body = { recordKind: 'CASE', steps: [{ name: 'x' }], anchors: { PROSECUTED: '2026-01-05' }, conditions: { CRIME_GRAVITY: 'NGHIEM_TRONG' } };
      await call('post', '/processing-flows/preview-schedule', body).expect(200);
      expect(service.previewSchedule).toHaveBeenCalledWith(body);
    });

    it('"templates" and "resolve" are not read as the id of a flow', async () => {
      await call('get', '/processing-flows/templates').expect(200);
      await call('get', '/processing-flows/resolve?recordKind=CASE').expect(200);
      expect(service.get).not.toHaveBeenCalled();
    });
  });
});
