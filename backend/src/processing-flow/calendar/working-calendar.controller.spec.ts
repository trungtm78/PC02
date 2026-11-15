import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkingCalendarController } from './working-calendar.controller';
import { WorkingCalendarService } from './working-calendar.service';

/**
 * The routes of the working calendar through the REAL feature-switch and permission guards: the permission layer the
 * calendar service itself does not have.
 */
const ALL = ['read', 'edit', 'confirm'].map((action) => `${action}:ProcessingCalendar`);
const expected = { id: 'y1', revision: 3 };
const saveBody = { weekendDays: [6, 0], days: [{ date: '2031-01-01', kind: 'OFF', label: 'New year' }], note: null, expected };

type Method = 'get' | 'post' | 'put' | 'delete';
/** [method, path, body, the permission it needs, the service method it reaches] */
const ROUTES: Array<[Method, string, object | undefined, string, string]> = [
  ['get', '/processing-calendar/years', undefined, 'read:ProcessingCalendar', 'listYears'],
  ['get', '/processing-calendar/years/2031', undefined, 'read:ProcessingCalendar', 'getYear'],
  ['put', '/processing-calendar/years/2031', saveBody, 'edit:ProcessingCalendar', 'saveYear'],
  ['post', '/processing-calendar/years/2031/confirm', { expected }, 'confirm:ProcessingCalendar', 'confirmYear'],
  ['post', '/processing-calendar/years/2031/unconfirm', { expected }, 'confirm:ProcessingCalendar', 'unconfirmYear'],
  ['delete', '/processing-calendar/years/2031?id=y1&revision=3', undefined, 'edit:ProcessingCalendar', 'deleteYear'],
];

describe('WorkingCalendarController (HTTP, real guards)', () => {
  let app: INestApplication;
  const service = Object.fromEntries(['listYears', 'getYear', 'saveYear', 'confirmYear', 'unconfirmYear', 'deleteYear'].map((name) => [name, jest.fn()])) as Record<
    string,
    jest.Mock
  >;
  let switchedOn = true;
  let held: string[] = ALL;
  const asked: string[] = [];

  const call = (method: Method, path: string, body?: object) => {
    const sent = request(app.getHttpServer())[method](path);
    return body === undefined ? sent : sent.send(body);
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WorkingCalendarController],
      providers: [
        { provide: WorkingCalendarService, useValue: service },
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
    held = [...ALL.filter((key) => key !== permission), 'read:ProcessingFlow', 'edit:ProcessingFlow', 'publish:ProcessingFlow'];
    await call(method, path, body).expect(403);
    Object.values(service).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it.each(ROUTES)('%s %s needs nothing but its own permission', async (method, path, body, permission, reached) => {
    held = [permission];
    const response = await call(method, path, body);
    expect(response.status).toBeLessThan(300);
    expect(service[reached]).toHaveBeenCalledTimes(1);
  });

  describe('what reaches the service', () => {
    it('a year as a number; a year that has no row answers "nothing stored", not an error', async () => {
      service.getYear.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'y1', year: 2031 });
      expect((await call('get', '/processing-calendar/years/2031').expect(200)).body).toEqual({ year: 2031, stored: null });
      expect((await call('get', '/processing-calendar/years/2031').expect(200)).body).toEqual({ year: 2031, stored: { id: 'y1', year: 2031 } });
      expect(service.getYear.mock.calls).toEqual([[2031], [2031]]);
    });

    it.each(['abc', '31', '20311', '2031.5', '-2031'])('a year written as "%s" is refused with its code', async (year) => {
      const response = await call('get', `/processing-calendar/years/${year}`).expect(400);
      expect(response.body).toMatchObject({ code: 'CALENDAR_YEAR_INVALID' });
      expect(service.getYear).not.toHaveBeenCalled();
    });

    it('saving: the days, what was looked at, and who saves (the signed-in person)', async () => {
      await call('put', '/processing-calendar/years/2031', saveBody).expect(200);
      expect(service.saveYear).toHaveBeenCalledWith(2031, saveBody, 'admin-1');

      // A year that has no row yet: "nothing was looked at".
      await call('put', '/processing-calendar/years/2032', { weekendDays: [0], days: [], expected: null }).expect(200);
      expect(service.saveYear).toHaveBeenLastCalledWith(2032, { weekendDays: [0], days: [], expected: null }, 'admin-1');
    });

    it.each([
      ['no "expected" at all', { weekendDays: [6, 0], days: [] }],
      ['a revision that is not a whole number', { weekendDays: [6, 0], days: [], expected: { id: 'y1', revision: '3' } }],
      ['what was looked at without its row', { weekendDays: [6, 0], days: [], expected: { revision: 3 } }],
      ['days that are not a list', { weekendDays: [6, 0], days: 'x', expected: null }],
      ['a day without its kind', { weekendDays: [6, 0], days: [{ date: '2031-01-01' }], expected: null }],
      ['a weekday that is text', { weekendDays: ['SUN'], days: [], expected: null }],
      ['a field the route does not know', { weekendDays: [6, 0], days: [], expected: null, actorId: 'x' }],
    ])('saving refuses %s', async (_what, body) => {
      await call('put', '/processing-calendar/years/2031', body).expect(400);
      expect(service.saveYear).not.toHaveBeenCalled();
    });

    it('confirming and its way back name what was looked at', async () => {
      await call('post', '/processing-calendar/years/2031/confirm', { expected }).expect(200);
      await call('post', '/processing-calendar/years/2031/unconfirm', { expected }).expect(200);
      expect(service.confirmYear).toHaveBeenCalledWith(2031, expected, 'admin-1');
      expect(service.unconfirmYear).toHaveBeenCalledWith(2031, expected, 'admin-1');
      await call('post', '/processing-calendar/years/2031/confirm', {}).expect(400);
      await call('post', '/processing-calendar/years/2031/confirm', { expected: null }).expect(400);
      expect(service.confirmYear).toHaveBeenCalledTimes(1);
    });

    it('deleting names the row and the revision in the query', async () => {
      await call('delete', '/processing-calendar/years/2031?id=y1&revision=3').expect(200);
      expect(service.deleteYear).toHaveBeenCalledWith(2031, { id: 'y1', revision: 3 }, 'admin-1');
      for (const bad of ['', '?id=y1', '?revision=3', '?id=y1&revision=abc', '?id=y1&revision=0', '?id=&revision=3']) {
        const response = await call('delete', `/processing-calendar/years/2031${bad}`).expect(400);
        expect(response.body).toMatchObject({ code: 'EXPECTED_REVISION_INVALID' });
      }
      expect(service.deleteYear).toHaveBeenCalledTimes(1);
    });
  });
});
