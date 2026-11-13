import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { installTriggerSection } from '../common/testing/install-trigger-section';
import { TeamLifecycleService } from './team-lifecycle.service';
import { TEAM_OWN_SETTINGS } from './team-references';

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
    await installTriggerSection(pg, '20261113100000_team_status', 'teams_status_sync');
    service = new TeamLifecycleService(db as never, audit as never);
  });

  afterAll(async () => {
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
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

  describe('real delete', () => {
    let userId = '';
    beforeAll(async () => {
      const role = await db.role.create({ data: { name: `${tag}-role` } });
      userId = (
        await db.user.create({ data: { username: `${tag}-u`, passwordHash: 'x', roleId: role.id } })
      ).id;
    });

    /** Every (table, column) that has a foreign key to `teams`, asked of PostgreSQL by an independent query. */
    async function foreignKeysToTeams() {
      const r = await pg.query<{ t: string; c: string }>(
        `SELECT cl.relname AS t, a.attname AS c
           FROM pg_constraint k
           JOIN pg_class cl ON cl.oid = k.conrelid
           JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
          WHERE k.contype = 'f' AND k.confrelid = 'teams'::regclass
          ORDER BY 1, 2`,
      );
      return r.rows.map((x) => `${x.t}.${x.c}`);
    }

    it('looks at EVERY foreign key that points at teams (no hand-kept list to forget a new one)', async () => {
      const seen: string[] = [];
      const spy = new Proxy(db, {
        get(target, prop, receiver) {
          if (prop === '$queryRawUnsafe') {
            return (sql: string, ...rest: unknown[]) => {
              const m = /FROM "([^"]+)" WHERE "([^"]+)" = \$1/.exec(sql);
              if (m) seen.push(`${m[1]}.${m[2]}`);
              return (target as never as { $queryRawUnsafe: (...a: unknown[]) => unknown }).$queryRawUnsafe(sql, ...rest);
            };
          }
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      const { id } = await create();

      await new TeamLifecycleService(spy as never, audit as never).deletionCheck(id);

      // Every reference is counted, except the team's own settings: those are not anybody's data and go with the team.
      const all = await foreignKeysToTeams();
      expect(seen.sort()).toEqual(all.filter((key) => !TEAM_OWN_SETTINGS.has(key)));
      expect(all.filter((key) => TEAM_OWN_SETTINGS.has(key))).toEqual([...TEAM_OWN_SETTINGS].sort());
      // Anchors: the detector must include the cascading and the self-reference, or it proves nothing.
      expect(seen).toEqual(expect.arrayContaining(['user_teams.teamId', 'teams.parentId']));
    });

    it('deletes an empty team for real and audits it', async () => {
      const { id } = await create();

      await expect(service.deleteIfEmpty(id, 'actor')).resolves.toEqual({ success: true });

      expect(await db.team.findUnique({ where: { id } })).toBeNull();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TEAM_DELETED', subjectId: id }));
    });

    it('refuses a team that has a member (a cascading reference must not be deleted silently)', async () => {
      const { id } = await create();
      await db.userTeam.create({ data: { userId, teamId: id } });

      await expect(service.deleteIfEmpty(id, 'actor')).rejects.toMatchObject({
        response: { code: 'TEAM_HAS_DATA', details: [{ table: 'user_teams', column: 'teamId', count: 1 }] },
      });

      expect(await db.team.findUnique({ where: { id } })).not.toBeNull();
      expect(await db.userTeam.count({ where: { teamId: id } })).toBe(1);
    });

    it('refuses a team that has a child team', async () => {
      const parent = await create();
      await create({ parentId: parent.id });

      await expect(service.deleteIfEmpty(parent.id, 'actor')).rejects.toMatchObject({
        response: { code: 'TEAM_HAS_DATA', details: [{ table: 'teams', column: 'parentId', count: 1 }] },
      });
    });

    it('the preview and the delete agree, and an unknown team is a 404 for both', async () => {
      const { id } = await create();
      await expect(service.deletionCheck(id)).resolves.toEqual({ deletable: true, total: 0, blockers: [] });
      await expect(service.deletionCheck('missing')).rejects.toMatchObject({ status: 404 });
      await expect(service.deleteIfEmpty('missing', 'actor')).rejects.toMatchObject({ status: 404 });
    });

    it('a member added while the delete is waiting for its lock is counted, and blocks the delete', async () => {
      const { id } = await create();
      const adder = new Client({ connectionString: url! });
      await adder.connect();
      try {
        // The insert holds a share lock on the team row until it commits (that is what a foreign-key check takes).
        await adder.query('BEGIN');
        await adder.query('INSERT INTO user_teams ("userId", "teamId") VALUES ($1, $2)', [userId, id]);

        const attempt = service.deleteIfEmpty(id, 'actor').catch((e: unknown) => e);

        // Wait until the delete is really queued behind that lock, instead of sleeping for a guess.
        for (let i = 0; i < 200; i += 1) {
          const waiting = await pg.query(
            `SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query ILIKE '%FOR UPDATE%' AND query ILIKE '%teams%'`,
          );
          if (waiting.rowCount) break;
          await new Promise((r) => setTimeout(r, 25));
        }
        await adder.query('COMMIT');

        expect(await attempt).toMatchObject({ response: { code: 'TEAM_HAS_DATA' } });
        expect(await db.team.findUnique({ where: { id } })).not.toBeNull();
      } finally {
        await adder.end();
      }
    });
  });
});
