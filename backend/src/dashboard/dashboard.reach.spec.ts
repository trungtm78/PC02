import type { DataScope } from '../auth/services/unit-scope.service';
import type { PreciseScope } from '../common/utils/precise-scope';
import { DashboardService } from './dashboard.service';

/**
 * The totals and the charts of the dashboard, and the reach of the person asking.
 * Nothing enforced: the whole organisation, as always. Permissions by team enforced (the scope is precise): only
 * what the person can open, per kind of record.
 */
const NONE: PreciseScope = { all: false, own: false, exactTeamIds: [], tree: null };
const precise = (subjects: Partial<Record<'Case' | 'Incident' | 'Petition', PreciseScope>>): DataScope =>
  ({
    teamIds: [],
    userIds: ['me'],
    writableTeamIds: [],
    writableUserIds: ['me'],
    precise: {
      userId: 'me',
      subjects: {
        Case: { read: subjects.Case ?? NONE, write: NONE },
        Incident: { read: subjects.Incident ?? NONE, write: NONE },
        Petition: { read: subjects.Petition ?? NONE, write: NONE },
      },
    },
  }) as unknown as DataScope;
/** A scope as the role path gives it: no precise part. */
const LEGACY = { teamIds: ['T'], userIds: ['me'], writableTeamIds: ['T'], writableUserIds: ['me'] } as unknown as DataScope;

function build() {
  const prisma = {
    case: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
    incident: { count: jest.fn().mockResolvedValue(0) },
    petition: { count: jest.fn().mockResolvedValue(0) },
  };
  const service = new DashboardService(prisma as never, {} as never);
  const wheres = (mock: jest.Mock) => mock.mock.calls.map(([args]) => (args as { where: Record<string, unknown> }).where);
  return { service, prisma, wheres };
}

describe('dashboard totals and charts follow the reach of permissions by team', () => {
  it.each([
    ['no scope (an administrator)', null],
    ['a scope from the role path', LEGACY],
  ])('%s: every query counts the whole organisation, as before', async (_name, scope) => {
    const { service, prisma, wheres } = build();
    await service.getStats(scope);
    await service.getCharts(scope);
    const all = [...wheres(prisma.case.count), ...wheres(prisma.case.groupBy), ...wheres(prisma.incident.count), ...wheres(prisma.petition.count)];
    // 4 + 1 + 1 totals, 12 months x 3, and the status breakdown.
    expect(all).toHaveLength(6 + 36 + 1);
    for (const where of all) expect(where).not.toHaveProperty('AND');
    // And exactly the first total as it has always been asked.
    expect(wheres(prisma.case.count)[0]).toEqual({ deletedAt: null, caseType: 'REGULAR' });
  });

  it('enforced, own records only: every query of each kind carries that kind\'s own filter', async () => {
    const { service, prisma, wheres } = build();
    const scope = precise({ Case: { ...NONE, own: true }, Petition: { ...NONE, exactTeamIds: ['T'] } });
    await service.getStats(scope);
    await service.getCharts(scope);
    const caseQueries = [...wheres(prisma.case.count), ...wheres(prisma.case.groupBy)];
    expect(caseQueries).toHaveLength(4 + 12 + 1);
    for (const where of caseQueries) expect(where.AND).toEqual([{ OR: [{ investigatorId: 'me' }] }]);
    for (const where of wheres(prisma.petition.count)) expect(where.AND).toEqual([{ OR: [{ assignedTeamId: { in: ['T'] } }] }]);
    // No permission on incidents at all: a filter nothing passes, never the whole organisation.
    const incidentQueries = wheres(prisma.incident.count);
    expect(incidentQueries).toHaveLength(1 + 12);
    for (const where of incidentQueries) expect(where.AND).toEqual([{ id: '__no_access__' }]);
    // The conditions that were there stay.
    expect(wheres(prisma.case.count)[0]).toMatchObject({ deletedAt: null, caseType: 'REGULAR' });
  });

  it('enforced and reaching everything: no filter is added', async () => {
    const { service, prisma, wheres } = build();
    const everything: PreciseScope = { ...NONE, all: true };
    await service.getStats(precise({ Case: everything, Incident: everything, Petition: everything }));
    for (const where of [...wheres(prisma.case.count), ...wheres(prisma.incident.count), ...wheres(prisma.petition.count)]) {
      expect(where).not.toHaveProperty('AND');
    }
  });
});
