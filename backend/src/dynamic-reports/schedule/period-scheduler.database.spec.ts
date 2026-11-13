import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { PeriodSchedulerService } from './period-scheduler.service';

/**
 * Making periods for published reports — checked on a REAL PostgreSQL.
 *
 * Two things the mocked unit suite cannot show:
 * - the work of one report must not take the others down: a database error aborts the whole PostgreSQL transaction, so
 *   a `try/catch` around one report is not enough, the next statement would fail with "transaction is aborted";
 * - publishing a report makes its periods at once (a published report used to show nothing for up to an hour).
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database (see grid-access.database.spec.ts).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

const LOCK_KEY = 'dynamic-reports-period-scheduler';

run('PeriodSchedulerService on PostgreSQL', () => {
  let db: PrismaClient;
  let pg: Client;
  let svc: PeriodSchedulerService;
  const tag = `ps-${randomUUID().slice(0, 8)}`;
  let userId = '';
  let teamId = '';
  const past = new Date('2026-10-01T00:00:00Z');
  // "Now" for the scheduler must be AFTER the rows the test creates (their validFrom is the database's real clock);
  // a fixed instant went stale the moment the real clock passed it.
  let now = new Date();
  beforeEach(() => {
    now = new Date(Date.now() + 60_000);
  });

  /** A published monthly report with one team, one editor and a version, whose schedule has made nothing yet. */
  async function buildReport(name: string) {
    const report = await db.dynReport.create({
      data: {
        code: `${tag}-${name}`,
        name: `${tag} ${name}`,
        status: 'PUBLISHED',
      },
    });
    await db.dynReportSchedule.create({
      data: {
        reportId: report.id,
        periodType: 'MONTHLY',
        dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
        openRule: { kind: 'AT_PERIOD_START' },
        shiftNonWorking: false,
        effectiveFrom: past,
      },
    });
    await db.dynReportVersion.create({
      data: {
        reportId: report.id,
        version: 1,
        status: 'PUBLISHED',
        fileBytes: Buffer.from('x'),
        sha256: 'f'.repeat(64),
        fileName: 'm.xlsx',
        selectedSheets: ['S'],
        layout: {},
        parserVersion: 't',
        engineVersion: 't',
      },
    });
    await db.dynReportRole.create({
      data: { reportId: report.id, userId, role: 'MANAGER' },
    });
    const target = await db.dynReportTarget.create({
      data: { reportId: report.id, teamId },
    });
    await db.dynReportTargetEditor.create({
      data: { targetId: target.id, userId },
    });
    return report.id;
  }

  const periodCount = (reportId: string) =>
    db.dynReportPeriod.count({ where: { reportId } });

  beforeAll(async () => {
    const u = new URL(url!);
    if (
      u.hostname !== '127.0.0.1' ||
      !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(
        u.pathname,
      )
    ) {
      throw new Error(
        'Từ chối: DYN_REPORTS_DATABASE_URL phải trỏ 127.0.0.1/pc02_dynamic_reports_test hoặc pc02_goiy_scope_test',
      );
    }
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url! }),
    });
    pg = new Client({ connectionString: url! });
    await pg.connect();
    svc = new PeriodSchedulerService(
      db as never,
      { expandOccurrences: () => [] } as never,
    );
    const role = await db.role.create({ data: { name: `${tag}-role` } });
    userId = (
      await db.user.create({
        data: { username: `${tag}-u`, passwordHash: 'x', roleId: role.id },
      })
    ).id;
    teamId = (
      await db.team.create({ data: { code: `${tag}-t`, name: `${tag}-t` } })
    ).id;
  });

  afterAll(async () => {
    await pg.end();
    await db.$disconnect();
  });

  it('a report whose generation fails does not stop the reports after it', async () => {
    const bad = await buildReport('bad');
    const good = await buildReport('good');
    // Make every period insert of ONE report fail inside the database, the way a constraint or a bad row would.
    const fn = `${tag.replace(/-/g, '_')}_boom`;
    await pg.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'boom'; END $$`,
    );
    await pg.query(
      `CREATE TRIGGER ${fn}_t BEFORE INSERT ON dyn_report_periods FOR EACH ROW WHEN (NEW."reportId" = '${bad}') EXECUTE FUNCTION ${fn}()`,
    );
    try {
      await db.$transaction(
        (tx) => svc.generateForAllReports(tx, now, [bad, good]),
        { timeout: 60_000 },
      );
    } finally {
      await pg.query(`DROP TRIGGER ${fn}_t ON dyn_report_periods`);
      await pg.query(`DROP FUNCTION ${fn}()`);
    }

    expect(await periodCount(bad)).toBe(0);
    expect(await periodCount(good)).toBeGreaterThan(0);
  });

  it('generateForReport makes the periods of that report at once, and only of that report', async () => {
    const mine = await buildReport('mine');
    const other = await buildReport('other');

    await svc.generateForReport(mine, now);

    const periods = await db.dynReportPeriod.findMany({
      where: { reportId: mine },
      include: { assignments: { include: { editors: true } } },
    });
    expect(periods.length).toBeGreaterThan(0);
    // Every period has the team's assignment with its editor, ready to type.
    expect(
      periods.every(
        (p) =>
          p.assignments.length === 1 &&
          p.assignments[0].editors.some((e) => e.userId === userId),
      ),
    ).toBe(true);
    expect(await periodCount(other)).toBe(0);
  });

  it('asking again changes nothing (no period made twice)', async () => {
    const id = await buildReport('twice');
    await svc.generateForReport(id, now);
    const first = await periodCount(id);

    await svc.generateForReport(id, now);

    expect(await periodCount(id)).toBe(first);
  });

  it('does not wait for, or break, a tick that is already running: it leaves the work to that tick', async () => {
    const id = await buildReport('busy');
    const holder = new Client({ connectionString: url! });
    await holder.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        LOCK_KEY,
      ]);

      await expect(svc.generateForReport(id, now)).resolves.toBeUndefined();

      expect(await periodCount(id)).toBe(0);
    } finally {
      await holder.query('ROLLBACK');
      await holder.end();
    }
  });

  it('a long tick is not cut off by the 5-second default: the transaction asks for more time', async () => {
    const id = await buildReport('long');
    // `pg_sleep` inside the transaction stands for a slow tick; with Prisma's default it would be rolled back at 5 s.
    const slow = new PeriodSchedulerService(
      {
        $transaction: (fn: never, options: unknown) =>
          db.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_sleep(5.5)`;
            return (fn as (t: unknown) => unknown)(tx);
          }, options as never),
      } as never,
      { expandOccurrences: () => [] } as never,
    );

    await expect(slow.generateForReport(id, now)).resolves.toBeUndefined();

    expect(await periodCount(id)).toBeGreaterThan(0);
  }, 30_000);
});
