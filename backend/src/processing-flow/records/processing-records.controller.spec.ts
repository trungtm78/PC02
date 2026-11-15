import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordGateway } from '../gateway/record-gateway';
import { ProcessingAssignmentService } from './processing-assignment.service';
import { ProcessingCommandService } from './processing-command.service';
import { ProcessingDeadlineService } from './processing-deadline.service';
import { ProcessingResultsService } from './processing-results.service';
import { ProcessingRecordsController } from './processing-records.controller';

/**
 * The routes of the flow of ONE record through the REAL feature-switch and permission guards: not there while the
 * switch is off (404), refused to a person who lacks exactly the route's permission (403), and, when the permission is
 * held, answered only for a record the record's OWN read policy shows that person (otherwise exactly the 404 of a
 * record that does not exist).
 */
const ALL = ['read', 'assign', 'complete', 'reopen', 'skip', 'adjustDue', 'extend', 'report', 'opine', 'approve'].map((action) => `${action}:ProcessingStep`);

type Method = 'get' | 'post';
/** [method, path, body, the permission it needs, the command it reaches] */
const ROUTES: Array<[Method, string, object | undefined, string, string]> = [
  ['get', '/processing/records/PETITION/r1', undefined, 'read:ProcessingStep', 'get'],
  ['post', '/processing/records/PETITION/r1/apply', { flowId: 'f1' }, 'assign:ProcessingStep', 'apply'],
  ['post', '/processing/records/PETITION/r1/confirm', { expectedRevision: 2 }, 'assign:ProcessingStep', 'confirmFlow'],
  ['post', '/processing/records/PETITION/r1/reapply', { expectedRevision: 2, flowId: 'f2' }, 'assign:ProcessingStep', 'reapplyFlow'],
  ['post', '/processing/records/PETITION/r1/accepted', { expectedRevision: 2, date: '2026-12-05' }, 'assign:ProcessingStep', 'recordAccepted'],
  ['post', '/processing/records/PETITION/r1/steps/k1/complete', { expectedRevision: 2 }, 'complete:ProcessingStep', 'completeStep'],
  ['post', '/processing/records/PETITION/r1/steps/k1/reopen', { expectedRevision: 2, reason: 'x' }, 'reopen:ProcessingStep', 'reopenStep'],
  ['post', '/processing/records/PETITION/r1/steps/k1/due', { expectedRevision: 2, date: '2026-12-20' }, 'adjustDue:ProcessingStep', 'adjustDue'],
  ['post', '/processing/records/PETITION/r1/steps/k1/extend', { expectedRevision: 2, reason: 'More time' }, 'extend:ProcessingStep', 'extendStep'],
  ['get', '/processing/records/PETITION/r1/steps/k1/results', undefined, 'read:ProcessingStep', 'results'],
  ['post', '/processing/records/PETITION/r1/steps/k1/reports', { expectedRevision: 2, kind: 'RESULT', doneWork: 'Done' }, 'report:ProcessingStep', 'submitReport'],
  ['post', '/processing/records/PETITION/r1/steps/k1/reports/rp1/edit', { expectedRevision: 2, doneWork: 'Done again' }, 'report:ProcessingStep', 'editReport'],
  ['post', '/processing/records/PETITION/r1/steps/k1/reports/rp1/withdraw', { expectedRevision: 2 }, 'report:ProcessingStep', 'withdrawReport'],
  ['post', '/processing/records/PETITION/r1/steps/k1/opinions', { expectedRevision: 2, kind: 'CHECK', verdict: 'PASS' }, 'opine:ProcessingStep', 'addOpinion'],
  ['post', '/processing/records/PETITION/r1/steps/k1/opinions/op1/withdraw', { expectedRevision: 2 }, 'opine:ProcessingStep', 'withdrawOpinion'],
  ['post', '/processing/records/PETITION/r1/steps/k1/decision', { expectedRevision: 2, verdict: 'AGREE' }, 'approve:ProcessingStep', 'decide'],
  ['post', '/processing/records/PETITION/r1/steps/k1/parties/p1/assignee', { expectedRevision: 2, userId: null }, 'read:ProcessingStep', 'assign'],
  ['get', '/processing/records/PETITION/r1/steps/k1/parties/p1/candidates', undefined, 'read:ProcessingStep', 'candidates'],
  ['post', '/processing/records/PETITION/r1/steps/k1/skip', { expectedRevision: 2, reason: 'x' }, 'skip:ProcessingStep', 'skipStep'],
  ['post', '/processing/records/PETITION/r1/steps/k1/unskip', { expectedRevision: 2 }, 'skip:ProcessingStep', 'unskipStep'],
];

/** The commands that open the record BY the step: they read, or they are authorised by being a party of the step. */
const stepRoutes = new Set(['assign', 'candidates', 'get', 'results', 'submitReport', 'editReport', 'withdrawReport', 'addOpinion', 'withdrawOpinion']);

describe('ProcessingRecordsController (HTTP, real guards)', () => {
  let app: INestApplication;
  const commands = Object.fromEntries(['assign', 'candidates', 'results', 'submitReport', 'editReport', 'withdrawReport', 'addOpinion', 'withdrawOpinion', 'decide', 'adjustDue', 'extendStep', 'get', 'apply', 'reapplyFlow', 'confirmFlow', 'recordAccepted', 'completeStep', 'reopenStep', 'skipStep', 'unskipStep'].map((name) => [name, jest.fn()])) as Record<string, jest.Mock>;
  const gateway = { canRead: jest.fn() };
  let switchedOn = true;
  let held: string[] = ALL;
  const asked: string[] = [];

  const call = (method: Method, path: string, body?: object) => {
    const sent = request(app.getHttpServer())[method](path);
    return body === undefined ? sent : sent.send(body);
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProcessingRecordsController],
      providers: [
        { provide: ProcessingCommandService, useValue: commands },
        { provide: ProcessingDeadlineService, useValue: commands },
        { provide: ProcessingResultsService, useValue: commands },
        { provide: ProcessingAssignmentService, useValue: commands },
        { provide: RecordGateway, useValue: gateway },
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
          context.switchToHttp().getRequest().user = { id: 'officer-1', roleId: 'role-1', role: 'OFFICER', canDispatch: false };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    Object.values(commands).forEach((fn) => fn.mockReset().mockResolvedValue({ ok: true }));
    gateway.canRead.mockReset().mockResolvedValue(true);
    switchedOn = true;
    held = ALL;
    asked.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('the table names every command of the controller', () => {
    expect(new Set(ROUTES.map((route) => route[4])).size).toBe(Object.keys(commands).length);
  });

  it.each(ROUTES)('%s %s is not there while the switch is off', async (method, path, body) => {
    switchedOn = false;
    await call(method, path, body).expect(404);
    expect(asked).toEqual(['processing_flow_records']);
    Object.values(commands).forEach((fn) => expect(fn).not.toHaveBeenCalled());
    expect(gateway.canRead).not.toHaveBeenCalled();
  });

  it.each(ROUTES)('%s %s is refused to a person who holds every permission but its own (%s)', async (method, path, body, permission) => {
    held = ALL.filter((key) => key !== permission);
    await call(method, path, body).expect(403);
    Object.values(commands).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it.each(ROUTES)('%s %s with its own permission reaches the command, for a record the person may read', async (method, path, body, permission, reached) => {
    held = [permission];
    const response = await call(method, path, body);
    expect(response.status).toBeLessThan(300);
    expect(commands[reached]).toHaveBeenCalledTimes(1);
    // Only the GET may open a record by a step alone; every write keeps the record's own scope check.
    expect(gateway.canRead).toHaveBeenCalledWith('PETITION', 'r1', { id: 'officer-1', role: 'OFFICER', canDispatch: false }, { viaStep: stepRoutes.has(reached) });
  });

  it.each(ROUTES)('%s %s answers a record the person may not read as a record that is not there', async (method, path, body) => {
    gateway.canRead.mockResolvedValue(false);
    const response = await call(method, path, body);
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'RECORD_FLOW_NOT_FOUND' });
    Object.values(commands).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it('a record kind that does not exist is a 404 and asks nobody', async () => {
    await call('get', '/processing/records/WARRANT/r1').expect(404);
    expect(gateway.canRead).not.toHaveBeenCalled();
  });

  describe('what reaches the command', () => {
    it('who acts is the signed-in person, never a value of the body', async () => {
      await call('post', '/processing/records/CASE/c1/steps/k1/complete', { expectedRevision: 3, idempotencyKey: 'key-complete-0001' }).expect(200);
      expect(commands.completeStep).toHaveBeenCalledWith('officer-1', 'CASE', 'c1', 'k1', { expectedRevision: 3, idempotencyKey: 'key-complete-0001' });
      await call('post', '/processing/records/CASE/c1/steps/k1/complete', { expectedRevision: 3, actorId: 'somebody-else' }).expect(400);
      expect(commands.completeStep).toHaveBeenCalledTimes(1);
    });

    it('every write carries the revision it was decided on: a body without one, or with a bad one, is refused', async () => {
      await call('post', '/processing/records/PETITION/r1/confirm', {}).expect(400);
      await call('post', '/processing/records/PETITION/r1/confirm', { expectedRevision: 0 }).expect(400);
      await call('post', '/processing/records/PETITION/r1/steps/k1/skip', { reason: 'x' }).expect(400);
      expect(commands.confirmFlow).not.toHaveBeenCalled();
      expect(commands.skipStep).not.toHaveBeenCalled();
    });

    it('a skip without a reason still reaches the command, which refuses it with its code', async () => {
      await call('post', '/processing/records/PETITION/r1/steps/k1/skip', { expectedRevision: 2 }).expect(200);
      expect(commands.skipStep).toHaveBeenCalledWith('officer-1', 'PETITION', 'r1', 'k1', { expectedRevision: 2, reason: '' });
    });

    it('apply names the flow to use, or none', async () => {
      await call('post', '/processing/records/INCIDENT/i1/apply', {}).expect(200);
      await call('post', '/processing/records/INCIDENT/i1/apply', { flowId: 'f9', idempotencyKey: 'key-apply-000001' }).expect(200);
      expect(commands.apply.mock.calls).toEqual([
        ['officer-1', 'INCIDENT', 'i1', {}],
        ['officer-1', 'INCIDENT', 'i1', { flowId: 'f9', idempotencyKey: 'key-apply-000001' }],
      ]);
    });
  });
});
