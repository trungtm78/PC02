import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TeamLifecycleService } from './team-lifecycle.service';

/**
 * Team states on a REAL PostgreSQL.
 *
 * What the mocked unit suite cannot show: `isActive` and `status` are two representations of one state, and seeds, the
 * legacy migration and older code still write `isActive`. The `teams_status_sync` trigger is what keeps them from
 * disagreeing, so it is tested here against the migration's own SQL, not a copy of it.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database (see grid-access.database.spec.ts).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

const MIGRATION = join(
  __dirname,
  '../../prisma/migrations/20261113100000_team_status/migration.sql',
);
const MARKER = '-- TRIGGER-SECTION';

run('Team status on PostgreSQL', () => {
  let db: PrismaClient;
  let pg: Client;
  let service: TeamLifecycleService;
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tag = `ts-${randomUUID().slice(0, 8)}`;
  let n = 0;
  const create = (data: Record<string, unknown> = {}) => {
    n += 1;
    return db.team.create({
      data: { code: `${tag}-${n}`, name: `${tag}-${n}`, ...data },
    });
  };
  const read = (id: string) => db.team.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    const u = new URL(url!);
    if (
      u.hostname !== '127.0.0.1' ||
      !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)
    ) {
      throw new Error(
        'Refused: DYN_REPORTS_DATABASE_URL must point at 127.0.0.1/pc02_dynamic_reports_test or pc02_goiy_scope_test',
      );
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    pg = new Client({ connectionString: url! });
    await pg.connect();
    // `prisma db push` (how the CI scratch schema is built) creates the columns but no triggers: apply the migration's.
    const sql = readFileSync(MIGRATION, 'utf8');
    const at = sql.indexOf(MARKER);
    if (at < 0) throw new Error('The migration lost its TRIGGER-SECTION marker');
    await pg.query(sql.slice(at));
    service = new TeamLifecycleService(db as never, audit as never);
  });

  afterAll(async () => {
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await pg.end();
    await db.$disconnect();
  });

  describe('the trigger keeps isActive and status in step', () => {
    it('a team created switched off is paused', async () => {
      const t = await read((await create({ isActive: false })).id);
      expect(t).toMatchObject({ status: 'INACTIVE', isActive: false });
    });

    it('a team created archived is not active', async () => {
      const t = await read((await create({ status: 'ARCHIVED' })).id);
      expect(t).toMatchObject({ status: 'ARCHIVED', isActive: false });
    });

    it('a default team is active in both representations', async () => {
      const t = await read((await create()).id);
      expect(t).toMatchObject({ status: 'ACTIVE', isActive: true });
    });

    it('an older writer switching isActive off pauses the team', async () => {
      const { id } = await create();
      await db.team.update({ where: { id }, data: { isActive: false } });
      expect(await read(id)).toMatchObject({ status: 'INACTIVE', isActive: false });
    });

    it('an older writer switching isActive back on activates it', async () => {
      const { id } = await create({ isActive: false });
      await db.team.update({ where: { id }, data: { isActive: true } });
      expect(await read(id)).toMatchObject({ status: 'ACTIVE', isActive: true });
    });

    it('a status change decides isActive', async () => {
      const { id } = await create();
      await db.team.update({ where: { id }, data: { status: 'ARCHIVED' } });
      expect(await read(id)).toMatchObject({ status: 'ARCHIVED', isActive: false });
      await db.team.update({ where: { id }, data: { status: 'ACTIVE' } });
      expect(await read(id)).toMatchObject({ status: 'ACTIVE', isActive: true });
    });

    it('an unrelated update leaves the state alone', async () => {
      const { id } = await create({ status: 'ARCHIVED' });
      await db.team.update({ where: { id }, data: { order: 7 } });
      expect(await read(id)).toMatchObject({ status: 'ARCHIVED', isActive: false, order: 7 });
    });
  });

  describe('TeamLifecycleService', () => {
    it('pause, archive and restore round trip, stamping and clearing the archive fields', async () => {
      const { id } = await create();

      await service.setStatus(id, 'INACTIVE', 'actor');
      expect(await read(id)).toMatchObject({ status: 'INACTIVE', isActive: false, archivedAt: null });

      await service.setStatus(id, 'ARCHIVED', 'actor');
      const archived = await read(id);
      expect(archived).toMatchObject({ status: 'ARCHIVED', isActive: false, archivedById: 'actor' });
      expect(archived.archivedAt).toBeInstanceOf(Date);

      await service.setStatus(id, 'ACTIVE', 'actor');
      expect(await read(id)).toMatchObject({
        status: 'ACTIVE',
        isActive: true,
        archivedAt: null,
        archivedById: null,
      });
    });

    it('refuses to pause an archived team and leaves the row as it was', async () => {
      const { id } = await create({ status: 'ARCHIVED' });
      await expect(service.setStatus(id, 'INACTIVE', 'actor')).rejects.toMatchObject({
        response: { code: 'TEAM_INVALID_TRANSITION' },
      });
      expect((await read(id)).status).toBe('ARCHIVED');
    });
  });
});
