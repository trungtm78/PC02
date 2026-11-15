import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import { bandWhere, colouredWhere } from '../engine/bands';
import { bandConditions } from './band-conditions';
import { ProcessingTrackingController } from './processing-tracking.controller';
import { ProcessingTrackingService } from './processing-tracking.service';

/**
 * The two routes of the tracking screen through the REAL feature-switch and permission guards: not there while the
 * switch is off (404), refused without `read:ProcessingStep` (403), and the query string checked before the service is
 * asked.
 */
describe('ProcessingTrackingController (HTTP, real guards)', () => {
  let app: INestApplication;
  const tracking = { summary: jest.fn(), items: jest.fn() };
  let switchedOn = true;
  let held: string[] = ['read:ProcessingStep'];
  const asked: string[] = [];
  const ROUTES: Array<[string, 'summary' | 'items']> = [
    ['/processing/tracking/summary', 'summary'],
    ['/processing/tracking/items', 'items'],
  ];
  const get = (path: string) => request(app.getHttpServer()).get(path);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProcessingTrackingController],
      providers: [
        { provide: ProcessingTrackingService, useValue: tracking },
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
          context.switchToHttp().getRequest().user = { id: 'officer-1', roleId: 'role-1', role: { name: 'OFFICER' }, canDispatch: true };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    tracking.summary.mockReset().mockResolvedValue({ asOf: 'x', counts: {} });
    tracking.items.mockReset().mockResolvedValue({ items: [], total: 0 });
    switchedOn = true;
    held = ['read:ProcessingStep'];
    asked.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(ROUTES)('%s is not there while the switch is off', async (path, method) => {
    switchedOn = false;
    await get(path).expect(404);
    expect(asked).toEqual(['processing_flow_records']);
    expect(tracking[method]).not.toHaveBeenCalled();
  });

  it.each(ROUTES)('%s is refused to a person who holds every other permission of a step but not `read`', async (path, method) => {
    held = ['assign', 'complete', 'reopen', 'skip', 'adjustDue', 'extend', 'report', 'opine', 'approve'].map((action) => `${action}:ProcessingStep`).concat(['read:Petition', 'read:Case', 'read:Incident']);
    await get(path).expect(403);
    expect(tracking[method]).not.toHaveBeenCalled();
  });

  it.each(ROUTES)('%s answers the person who holds it, as the person the request carries', async (path, method) => {
    await get(path).expect(200);
    expect(tracking[method]).toHaveBeenCalledWith({ id: 'officer-1', role: 'OFFICER', canDispatch: true }, {});
  });

  it('passes the filters on, typed: a boolean, a number, the instant as it was sent', async () => {
    await get('/processing/tracking/items?band=RED&asOf=2026-12-10T03:00:00.000Z&mine=true&teamId=t1&kind=CASE&page=2&pageSize=50').expect(200);
    expect(tracking.items).toHaveBeenCalledWith(expect.anything(), { band: 'RED', asOf: '2026-12-10T03:00:00.000Z', mine: true, teamId: 't1', kind: 'CASE', page: 2, pageSize: 50 });
    await get('/processing/tracking/summary?mine=false&kind=PETITION').expect(200);
    expect(tracking.summary).toHaveBeenCalledWith(expect.anything(), { mine: false, kind: 'PETITION' });
  });

  it('the list of a cell of the backlog table: the role, the band NONE, the period', async () => {
    await get('/processing/tracking/items?band=NONE&role=CHECK&teamId=t1&from=2026-12-01&to=2026-12-31').expect(200);
    expect(tracking.items).toHaveBeenCalledWith(expect.anything(), { band: 'NONE', role: 'CHECK', teamId: 't1', from: '2026-12-01', to: '2026-12-31' });
  });

  it.each([
    '/processing/tracking/items?role=INFORM',
    '/processing/tracking/items?from=2026-02-31',
    '/processing/tracking/items?band=PURPLE',
    '/processing/tracking/items?kind=DOCUMENT',
    '/processing/tracking/items?asOf=yesterday',
    '/processing/tracking/items?mine=maybe',
    '/processing/tracking/items?page=0',
    '/processing/tracking/items?pageSize=101',
    '/processing/tracking/items?pageSize=ten',
    '/processing/tracking/items?userId=somebody-else',
    '/processing/tracking/summary?band=RED',
    '/processing/tracking/summary?page=2',
  ])('%s is refused before the service is asked', async (path) => {
    await get(path).expect(400);
    expect(tracking.summary).not.toHaveBeenCalled();
    expect(tracking.items).not.toHaveBeenCalled();
  });
});

describe('bandConditions: one condition for a count and its list', () => {
  const now = new Date('2026-12-10T03:00:00.000Z');

  it.each(['OVERDUE', 'RED', 'YELLOW', 'GREEN', 'NONE'] as const)('%s is the engine\'s bandWhere, on the columns of a step and of a record\'s stored alert', (band) => {
    const engine = bandWhere(band, now);
    const { step, flow } = bandConditions(band, now);
    expect(step).toEqual(Object.fromEntries(Object.entries(engine).map(([field, test]) => [field === 'dueAt' ? 'internalDueAt' : field, test])));
    expect(flow).toEqual(Object.fromEntries(Object.entries(engine).map(([field, test]) => [`alert${field[0].toUpperCase()}${field.slice(1)}`, test])));
  });

  it('no band asked: every colour, which is the engine\'s colouredWhere', () => {
    expect(colouredWhere(now)).toEqual({ greenFrom: { lte: now } });
    expect(bandConditions(null, now)).toEqual({ step: { greenFrom: { lte: now } }, flow: { alertGreenFrom: { lte: now } } });
  });

  it('compares with the instant it is given and nothing else: the same instant gives the same condition', () => {
    expect(bandConditions('RED', now)).toEqual(bandConditions('RED', new Date(now.getTime())));
    expect(JSON.stringify(bandConditions('RED', now))).toContain(now.toISOString());
  });
});
