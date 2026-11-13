import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { AggregateService } from './aggregate.service';
import { reconcileAssignmentEditors } from './assignment-editors';

/**
 * Who may type into a period's assignment — checked on a REAL PostgreSQL.
 *
 * Access to the input screen is decided by the assignment's own editor rows, which used to be written once, when the
 * scheduler generated the period. So an editor added to the configuration afterwards got "Không tìm thấy lượt giao" in
 * every period (the scheduler makes six ahead), and a team added in the middle of a period had nobody at all.
 *
 * D09 still holds: a period that has opened keeps the editors it started with, and changing them there is the
 * mid-period action on the period screen (with a reason, and the leaver's row kept with an end date). A period that has
 * not opened yet has nothing in progress, so it follows the configuration.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database (see grid-access.database.spec.ts).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('assignment editors on PostgreSQL', () => {
  let db: PrismaClient;
  let svc: AggregateService;
  const tag = `ae-${randomUUID().slice(0, 8)}`;
  const user: Record<string, string> = {};
  const team: Record<string, string> = {};
  let editorRoleId = '';
  let noAccessRoleId = '';
  const past = new Date('2020-01-01T00:00:00Z');
  const future = new Date('2098-01-01T00:00:00Z');
  const due = new Date('2099-01-01T00:00:00Z');

  /** A report with manager `mgr`, teams t1 and t2 (editors e1), an OPENED period and a NOT-YET-OPENED one over both. */
  async function buildReport(name: string) {
    const report = await db.dynReport.create({
      data: {
        code: `${tag}-${name}`,
        name: `${tag} ${name}`,
        status: 'PUBLISHED',
      },
    });
    await db.dynReportRole.create({
      data: { reportId: report.id, userId: user.mgr, role: 'MANAGER' },
    });
    for (const t of ['t1', 't2']) {
      const target = await db.dynReportTarget.create({
        data: { reportId: report.id, teamId: team[t] },
      });
      await db.dynReportTargetEditor.create({
        data: { targetId: target.id, userId: user.e1 },
      });
    }
    const version = await db.dynReportVersion.create({
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
    const periods: Record<
      'opened' | 'unopened',
      { id: string; assignments: Record<string, string> }
    > = {
      opened: { id: '', assignments: {} },
      unopened: { id: '', assignments: {} },
    };
    for (const [key, opensAt] of [
      ['opened', past],
      ['unopened', future],
    ] as const) {
      const period = await db.dynReportPeriod.create({
        data: {
          reportId: report.id,
          periodKey: `${tag}-${name}-${key}`,
          startDate: new Date('2026-10-01'),
          endDate: new Date('2026-10-31'),
          opensAt,
          dueAt: due,
          versionId: version.id,
          scheduleSnapshot: {},
        },
      });
      periods[key].id = period.id;
      for (const t of ['t1', 't2']) {
        const a = await db.dynReportAssignment.create({
          data: {
            periodId: period.id,
            teamId: team[t],
            teamSnapshot: { name: t },
          },
        });
        await db.dynReportSubmission.create({
          data: { assignmentId: a.id, state: 'NOT_STARTED' },
        });
        await db.dynReportAssignmentEditor.create({
          data: { assignmentId: a.id, userId: user.e1, isActive: true },
        });
        periods[key].assignments[t] = a.id;
      }
    }
    return { reportId: report.id, periods };
  }

  /** Change who the configuration names as editor of a team, the way `applyTargets` does (the old row gets an end date). */
  async function setTargetEditors(
    reportId: string,
    teamKey: string,
    userKeys: string[],
  ) {
    const target = await db.dynReportTarget.findFirstOrThrow({
      where: { reportId, teamId: team[teamKey], validTo: null },
    });
    await db.dynReportTargetEditor.updateMany({
      where: { targetId: target.id, validTo: null },
      data: { validTo: new Date() },
    });
    for (const k of userKeys)
      await db.dynReportTargetEditor.create({
        data: { targetId: target.id, userId: user[k] },
      });
  }

  const activeEditors = async (assignmentId: string) =>
    (
      await db.dynReportAssignmentEditor.findMany({
        where: { assignmentId, isActive: true },
      })
    )
      .map((e) => e.userId)
      .sort();
  const sorted = (...keys: string[]) => keys.map((k) => user[k]).sort();
  const reconcile = (
    reportId: string,
    over: Partial<Parameters<typeof reconcileAssignmentEditors>[1]> = {},
  ) =>
    db.$transaction((tx) =>
      reconcileAssignmentEditors(tx, {
        reportId,
        now: new Date(),
        onlyNotYetOpened: true,
        reason: 'CONFIG_CHANGED',
        actorId: user.mgr,
        ...over,
      }),
    );

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
    svc = new AggregateService(
      db as never,
      {} as never,
      { emit: () => true } as never,
      {} as never,
      {} as never,
    );

    const readPermission = await db.permission.upsert({
      where: { action_subject: { action: 'read', subject: 'DynamicReport' } },
      update: {},
      create: { action: 'read', subject: 'DynamicReport' },
    });
    const editorRole = await db.role.create({
      data: { name: `${tag}-editor` },
    });
    await db.rolePermission.create({
      data: { roleId: editorRole.id, permissionId: readPermission.id },
    });
    const noAccessRole = await db.role.create({
      data: { name: `${tag}-noaccess` },
    });
    editorRoleId = editorRole.id;
    noAccessRoleId = noAccessRole.id;

    const make = async (key: string, roleId: string, isActive = true) => {
      user[key] = (
        await db.user.create({
          data: {
            username: `${tag}-${key}`,
            passwordHash: 'x',
            roleId,
            isActive,
          },
        })
      ).id;
    };
    await make('mgr', editorRoleId);
    for (const k of ['e1', 'e2', 'e3']) await make(k, editorRoleId);
    await make('gone', editorRoleId, false);
    await make('noperm', noAccessRoleId);
    for (const n of ['t1', 't2', 't3'])
      team[n] = (
        await db.team.create({
          data: { code: `${tag}-${n}`, name: `${tag}-${n}` },
        })
      ).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe('the configuration reaches periods that have not opened', () => {
    it('gives a newly named editor the assignments of a period that has not opened, and leaves the opened one alone (D09)', async () => {
      const { reportId, periods } = await buildReport('add');
      await setTargetEditors(reportId, 't1', ['e1', 'e2']);

      await reconcile(reportId);

      expect(await activeEditors(periods.unopened.assignments.t1)).toEqual(
        sorted('e1', 'e2'),
      );
      expect(await activeEditors(periods.opened.assignments.t1)).toEqual(
        sorted('e1'),
      );
      // The other team's target did not change.
      expect(await activeEditors(periods.unopened.assignments.t2)).toEqual(
        sorted('e1'),
      );
    });

    it('ends the row of an editor the configuration no longer names, keeping it with the date and the reason', async () => {
      const { reportId, periods } = await buildReport('remove');
      await setTargetEditors(reportId, 't1', ['e2']);

      await reconcile(reportId);

      expect(await activeEditors(periods.unopened.assignments.t1)).toEqual(
        sorted('e2'),
      );
      const ended = await db.dynReportAssignmentEditor.findFirstOrThrow({
        where: {
          assignmentId: periods.unopened.assignments.t1,
          userId: user.e1,
        },
      });
      expect(ended).toMatchObject({
        isActive: false,
        replaceReason: 'CONFIG_CHANGED',
        replacedById: user.mgr,
      });
      expect(ended.replacedAt).not.toBeNull();
    });

    it('never gives an inactive user an assignment', async () => {
      const { reportId, periods } = await buildReport('inactive');
      await setTargetEditors(reportId, 't1', ['e1', 'gone']);

      await reconcile(reportId);

      expect(await activeEditors(periods.unopened.assignments.t1)).toEqual(
        sorted('e1'),
      );
    });

    it('running again changes nothing and makes no duplicate row', async () => {
      const { reportId, periods } = await buildReport('again');
      await setTargetEditors(reportId, 't1', ['e1', 'e2']);

      await reconcile(reportId);
      const second = await reconcile(reportId);

      expect(second).toEqual({ added: 0, ended: 0 });
      expect(
        await db.dynReportAssignmentEditor.count({
          where: { assignmentId: periods.unopened.assignments.t1 },
        }),
      ).toBe(2);
    });

    it('leaves an assignment alone when its team is not in the configuration any more', async () => {
      const { reportId, periods } = await buildReport('leaver');
      const target = await db.dynReportTarget.findFirstOrThrow({
        where: { reportId, teamId: team.t2, validTo: null },
      });
      await db.dynReportTarget.update({
        where: { id: target.id },
        data: { validTo: new Date() },
      });
      await db.dynReportTargetEditor.updateMany({
        where: { targetId: target.id, validTo: null },
        data: { validTo: new Date() },
      });

      await reconcile(reportId);

      expect(await activeEditors(periods.unopened.assignments.t2)).toEqual(
        sorted('e1'),
      );
    });

    it('can be told to cover opened periods too (the scheduler uses it for a period it has just made)', async () => {
      const { reportId, periods } = await buildReport('all');
      await setTargetEditors(reportId, 't1', ['e2']);

      await reconcile(reportId, {
        onlyNotYetOpened: false,
        assignmentIds: [periods.opened.assignments.t1],
      });

      expect(await activeEditors(periods.opened.assignments.t1)).toEqual(
        sorted('e2'),
      );
      expect(await activeEditors(periods.unopened.assignments.t1)).toEqual(
        sorted('e1'),
      );
    });
  });

  describe('the mid-period action: change who types in a period that is running', () => {
    const change = (
      periodId: string,
      assignmentId: string,
      editors: string[],
      reason = 'Cán bộ đi công tác',
      actor = 'mgr',
    ) =>
      svc.setAssignmentEditors(
        periodId,
        user[actor],
        editorRoleId,
        assignmentId,
        editors.map((k) => user[k]),
        reason,
      );

    it('swaps the editors, keeps the leaver as history with the reason and who did it', async () => {
      const { periods } = await buildReport('swap');

      const out = await change(
        periods.opened.id,
        periods.opened.assignments.t1,
        ['e2', 'e3'],
      );

      expect([...out.editorUserIds].sort()).toEqual(sorted('e2', 'e3'));
      expect(await activeEditors(periods.opened.assignments.t1)).toEqual(
        sorted('e2', 'e3'),
      );
      const left = await db.dynReportAssignmentEditor.findFirstOrThrow({
        where: { assignmentId: periods.opened.assignments.t1, userId: user.e1 },
      });
      expect(left).toMatchObject({
        isActive: false,
        replaceReason: 'Cán bộ đi công tác',
        replacedById: user.mgr,
      });
      // Only that assignment moved.
      expect(await activeEditors(periods.opened.assignments.t2)).toEqual(
        sorted('e1'),
      );
    });

    it('someone who was taken off and is put back gets a new active row', async () => {
      const { periods } = await buildReport('back');
      await change(periods.opened.id, periods.opened.assignments.t1, ['e2']);
      await change(periods.opened.id, periods.opened.assignments.t1, [
        'e1',
        'e2',
      ]);

      expect(await activeEditors(periods.opened.assignments.t1)).toEqual(
        sorted('e1', 'e2'),
      );
    });

    it('refuses an empty list, an unknown user, an inactive user and a user who cannot open the module', async () => {
      const { periods } = await buildReport('bad');
      const a = periods.opened.assignments.t1;
      await expect(change(periods.opened.id, a, [])).rejects.toMatchObject({
        code: 'EDITORS_REQUIRED',
      });
      for (const bad of ['gone', 'noperm']) {
        await expect(
          change(periods.opened.id, a, ['e2', bad]),
        ).rejects.toMatchObject({ code: 'EDITOR_INVALID' });
      }
      await expect(
        svc.setAssignmentEditors(
          periods.opened.id,
          user.mgr,
          editorRoleId,
          a,
          ['no-such-user'],
          'x',
        ),
      ).rejects.toMatchObject({ code: 'EDITOR_INVALID' });
      expect(await activeEditors(a)).toEqual(sorted('e1'));
    });

    it('is for the managers of the report only, and only while the period is open', async () => {
      const { periods } = await buildReport('who');
      await expect(
        change(
          periods.opened.id,
          periods.opened.assignments.t1,
          ['e2'],
          'x',
          'e2',
        ),
      ).rejects.toThrow('Không tìm thấy');

      await db.dynReportPeriod.update({
        where: { id: periods.opened.id },
        data: { status: 'FINALIZED' },
      });
      await expect(
        change(periods.opened.id, periods.opened.assignments.t1, ['e2']),
      ).rejects.toMatchObject({
        code: 'INVALID_STATE_TRANSITION',
      });
    });

    it('does nothing, and says so, when the list is the one already in force', async () => {
      const { periods } = await buildReport('same');
      await change(periods.opened.id, periods.opened.assignments.t1, ['e1']);

      expect(
        await db.dynReportAssignmentEditor.count({
          where: { assignmentId: periods.opened.assignments.t1 },
        }),
      ).toBe(1);
    });
  });

  describe('a team added in the middle of a period', () => {
    const addTeam = (periodId: string, teamKey: string, editors?: string[]) =>
      svc.addTeamMidPeriod(
        periodId,
        user.mgr,
        editorRoleId,
        team[teamKey],
        'Bổ sung tổ',
        editors?.map((k) => user[k]),
      );

    it('takes the editors the configuration names for that team', async () => {
      const { reportId, periods } = await buildReport('mid-config');
      const target = await db.dynReportTarget.create({
        data: { reportId, teamId: team.t3 },
      });
      await db.dynReportTargetEditor.create({
        data: { targetId: target.id, userId: user.e2 },
      });

      const out = await addTeam(periods.opened.id, 't3');

      expect(await activeEditors(out.assignmentId)).toEqual(sorted('e2'));
    });

    it('takes the editors the manager chose when the team is not in the configuration', async () => {
      const { periods } = await buildReport('mid-chosen');

      const out = await addTeam(periods.opened.id, 't3', ['e2', 'e3']);

      expect(await activeEditors(out.assignmentId)).toEqual(sorted('e2', 'e3'));
    });

    it('is refused, with nothing created, when nobody would be able to type for the team', async () => {
      const { periods } = await buildReport('mid-nobody');

      await expect(addTeam(periods.opened.id, 't3')).rejects.toMatchObject({
        code: 'EDITORS_REQUIRED',
      });
      expect(
        await db.dynReportAssignment.count({
          where: { periodId: periods.opened.id, teamId: team.t3 },
        }),
      ).toBe(0);
    });
  });
});
