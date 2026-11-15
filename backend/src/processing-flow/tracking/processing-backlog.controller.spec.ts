import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProcessingBacklogController } from './processing-backlog.controller';
import { ProcessingBacklogService } from './processing-backlog.service';

/**
 * The routes of the backlog screen through the REAL feature-switch and permission guards: not there while the switch
 * is off (404), refused without `read:ProcessingStep` (403), the query string checked before the service is asked.
 */
describe('ProcessingBacklogController (HTTP, real guards)', () => {
  let app: INestApplication;
  const backlog = { units: jest.fn(), onTime: jest.fn(), unitsWorkbook: jest.fn() };
  let switchedOn = true;
  let held: string[] = ['read:ProcessingStep'];
  const asked: string[] = [];
  const ROUTES: Array<[string, keyof typeof backlog]> = [
    ['/processing/backlog/units', 'units'],
    ['/processing/backlog/units/export', 'unitsWorkbook'],
    ['/processing/backlog/on-time', 'onTime'],
  ];
  const get = (path: string) => request(app.getHttpServer()).get(path);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProcessingBacklogController],
      providers: [
        { provide: ProcessingBacklogService, useValue: backlog },
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
    backlog.units.mockReset().mockResolvedValue({ asOf: 'x', rows: [], totals: {} });
    backlog.onTime.mockReset().mockResolvedValue({ asOf: 'x', rows: [], totals: {} });
    backlog.unitsWorkbook.mockReset().mockResolvedValue({ buffer: Buffer.from('xlsx-bytes'), asOf: '2026-12-10T03:00:00.000Z' });
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
    expect(backlog[method]).not.toHaveBeenCalled();
  });

  it.each(ROUTES)('%s is refused to a person who reads records but not steps', async (path, method) => {
    held = ['read:Petition', 'read:Case', 'read:Incident', 'report:ProcessingStep'];
    await get(path).expect(403);
    expect(backlog[method]).not.toHaveBeenCalled();
  });

  it.each(ROUTES)('%s answers the person who holds it, as the person the request carries, with the filters as sent', async (path, method) => {
    await get(`${path}?asOf=2026-12-10T03:00:00.000Z&kind=CASE&role=COORDINATE&from=2026-12-01&to=2026-12-31`).expect(200);
    expect(backlog[method]).toHaveBeenCalledWith({ id: 'officer-1', role: 'OFFICER', canDispatch: true }, { asOf: '2026-12-10T03:00:00.000Z', kind: 'CASE', role: 'COORDINATE', from: '2026-12-01', to: '2026-12-31' });
  });

  it('the export is an .xlsx attachment named after the day the table was judged at', async () => {
    const answer = await get('/processing/backlog/units/export').expect(200);
    expect(answer.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(answer.headers['content-disposition']).toBe('attachment; filename="ton-dong-theo-don-vi-2026-12-10.xlsx"');
  });

  it.each([
    '/processing/backlog/units?role=INFORM',
    '/processing/backlog/units?kind=DOCUMENT',
    '/processing/backlog/units?asOf=yesterday',
    '/processing/backlog/units?teamId=t1',
    '/processing/backlog/units/export?from=2026-02-31',
    '/processing/backlog/on-time?to=soon',
    '/processing/backlog/on-time?userId=somebody-else',
  ])('%s is refused before the service is asked', async (path) => {
    await get(path).expect(400);
    for (const method of Object.values(backlog)) expect(method).not.toHaveBeenCalled();
  });
});
