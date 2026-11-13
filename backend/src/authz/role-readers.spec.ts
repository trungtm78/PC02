// AuthService pulls in the 2FA chain (otplib, qrcode: ESM only). The mock shapes MUST be exactly those of
// `app.bootstrap.spec.ts` / `two-fa.service.spec.ts`: suites share a worker's module registry, and a different shape
// here would leak into the 2FA suite and fail it.
jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateURI: jest
    .fn()
    .mockReturnValue('otpauth://totp/PC02:user@test.com?secret=JBSWY3DPEHPK3PXP&issuer=PC02'),
  verify: jest.fn().mockResolvedValue({ valid: true }),
  generate: jest.fn().mockResolvedValue('123456'),
}));
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,fake') }));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BulkImportService } from '../admin/bulk/bulk-import.service';
import { guardCaseAuthority } from '../admin/case-authority.guard';
import { LegalWorkflowService } from '../cases/governance/legal-workflow.service';
import { AggregateService } from '../dynamic-reports/aggregate/aggregate.service';
import { ReportLifecycleService } from '../dynamic-reports/config/report-lifecycle.service';
import { GridAccessService } from '../dynamic-reports/grid/grid-access.service';
import { DynamicReportsRegistryService } from '../dynamic-reports/reports.service';
import { StatusQueryService } from '../dynamic-reports/status/status-query.service';
import { SubmissionService } from '../dynamic-reports/submission/submission.service';
import { OcrImportError } from '../ocr-import/ocr-import-error';
import { OcrIntakeService } from '../ocr-import/ocr-intake.service';
import { OcrSendPolicy } from '../ocr-import/ocr-send-policy';
import { setEnforcement } from './enforcement';

/**
 * The services that check a permission themselves (not through the route guard). Each asks what the PERSON holds
 * when permissions by team are enforced, and its role exactly as before otherwise.
 *
 * Not enforced: the role query is made with the arguments it always had and its answer decides — asserted against
 * EXPLICIT expected arguments, not against the same code run twice.
 * Enforced: the role says yes but the person does not hold it → refused; the role says no but the person holds it →
 * allowed.
 */
const USER = 'u1';
const ROLE = 'role-1';
const ACTOR = { id: USER, roleId: ROLE };

function enforce(keys: readonly string[] | undefined) {
  setEnforcement({ scopeOf: () => undefined, keysOf: () => keys, unconditionalKeysOf: () => keys, keysOrNone: () => keys, holdersOf: () => undefined });
}
/** An instance with only the fields a method under test touches. */
function bare<T extends object>(type: { prototype: T }, fields: Record<string, unknown>): T {
  return Object.assign(Object.create(type.prototype) as object, fields) as T;
}
/** A private method, called the way the class calls it. */
function method<R>(instance: object, name: string): (...args: unknown[]) => R {
  const found = (instance as Record<string, unknown>)[name];
  if (typeof found !== 'function') throw new Error(`no method ${name}`);
  return (...args: unknown[]) => (found as (...a: unknown[]) => R).apply(instance, args);
}
const refusedWith = async (attempt: Promise<unknown>, refusal: new (...args: never[]) => Error): Promise<boolean> => {
  try {
    await attempt;
    return true;
  } catch (error) {
    if (error instanceof refusal) return false;
    return true; // got past the permission check and failed on something later
  }
};

afterEach(() => setEnforcement(null));

interface Attempt {
  allowed: boolean;
  /** The query that reads the role. */
  roleQuery: jest.Mock;
}
interface Site {
  name: string;
  /** What the person must hold. */
  keys: string[];
  /** `keys` are alternatives (any one is enough) instead of all being required. */
  anyOf?: boolean;
  /** The arguments the role query has always been made with. */
  roleQueryArgs: unknown;
  /**
   * The role is loaded by a query that also serves something else (the actor row, the roles a change touches), so
   * it runs under enforcement too; only its ANSWER about the person is ignored there.
   */
  roleLoadedAnyway?: boolean;
  attempt(roleHolds: boolean): Promise<Attempt>;
}

const ADMIN_OF_REPORTS = { where: { roleId: ROLE, permission: { subject: 'DynamicReport', action: 'admin' } } };
/** `rolePermission.findFirst` as the dynamic-report services ask it: a row when the role holds it, else null. */
const firstGrant = (roleHolds: boolean) => jest.fn().mockResolvedValue(roleHolds ? { roleId: ROLE, permissionId: 'p' } : null);
const none = () => jest.fn().mockResolvedValue([]);

const SITES: Site[] = [
  {
    name: 'DynamicReportsRegistryService.listReports(setup) — manage:DynamicReport',
    keys: ['manage:DynamicReport'],
    roleQueryArgs: { where: { roleId: ROLE, permission: { subject: 'DynamicReport' } }, include: { permission: true } },
    async attempt(roleHolds) {
      const roleQuery = jest.fn().mockResolvedValue(roleHolds ? [{ permission: { action: 'manage' } }] : []);
      const service = new DynamicReportsRegistryService({ rolePermission: { findMany: roleQuery }, dynReport: { findMany: none() } } as never);
      return { allowed: await refusedWith(service.listReports(ACTOR, 'setup'), NotFoundException), roleQuery };
    },
  },
  {
    name: 'DynamicReportsRegistryService.listReports(manage) — admin:DynamicReport sees every report',
    keys: ['admin:DynamicReport'],
    roleQueryArgs: { where: { roleId: ROLE, permission: { subject: 'DynamicReport' } }, include: { permission: true } },
    async attempt(roleHolds) {
      const roleQuery = jest.fn().mockResolvedValue(roleHolds ? [{ permission: { action: 'admin' } }] : []);
      const reports = none();
      const service = new DynamicReportsRegistryService({ rolePermission: { findMany: roleQuery }, dynReport: { findMany: reports } } as never);
      await service.listReports(ACTOR, 'manage');
      // An admin's list has no `where`; everybody else's is narrowed to the reports they have a role on.
      const query = reports.mock.calls[0][0] as { where?: unknown };
      return { allowed: query.where === undefined, roleQuery };
    },
  },
  {
    name: 'GridAccessService.readScope — admin:DynamicReport or manage:DynamicReport reads a draft',
    keys: ['admin:DynamicReport', 'manage:DynamicReport'],
    anyOf: true,
    roleQueryArgs: {
      where: { roleId: ROLE, permission: { subject: 'DynamicReport', action: { in: ['admin', 'manage'] } } },
      select: { roleId: true },
    },
    async attempt(roleHolds) {
      const roleQuery = jest.fn().mockResolvedValue(roleHolds ? { roleId: ROLE } : null);
      const service = new GridAccessService({
        dynReportVersion: { findUnique: jest.fn().mockResolvedValue({ id: 'v1', reportId: 'rep', status: 'DRAFT', sourceKind: null }) },
        rolePermission: { findFirst: roleQuery },
      } as never);
      return { allowed: await service.canReadVersion(USER, ROLE, 'v1'), roleQuery };
    },
  },
  {
    name: 'StatusQueryService.resolveReportIds — admin:DynamicReport',
    keys: ['admin:DynamicReport'],
    roleQueryArgs: ADMIN_OF_REPORTS,
    async attempt(roleHolds) {
      const roleQuery = firstGrant(roleHolds);
      const service = bare(StatusQueryService, { prisma: { rolePermission: { findFirst: roleQuery }, dynReportRole: { findMany: none() } } });
      return { allowed: (await method<Promise<string[] | 'ALL'>>(service, 'resolveReportIds')(USER, ROLE)) === 'ALL', roleQuery };
    },
  },
  {
    name: 'SubmissionService.resolveManagerRole — admin:DynamicReport',
    keys: ['admin:DynamicReport'],
    roleQueryArgs: ADMIN_OF_REPORTS,
    async attempt(roleHolds) {
      const roleQuery = firstGrant(roleHolds);
      const client = { rolePermission: { findFirst: roleQuery }, dynReportRole: { findFirst: jest.fn().mockResolvedValue(null) } };
      const role = await method<Promise<string | null>>(bare(SubmissionService, {}), 'resolveManagerRole')(client, 'rep', USER, ROLE);
      return { allowed: role === 'ADMIN', roleQuery };
    },
  },
  ...(['listForManager', 'listPendingRequests'] as const).map((list): Site => ({
    name: `SubmissionService.${list} — admin:DynamicReport sees every report`,
    keys: ['admin:DynamicReport'],
    roleQueryArgs: ADMIN_OF_REPORTS,
    async attempt(roleHolds) {
      const roleQuery = firstGrant(roleHolds);
      const everyReport = none();
      const service = bare(SubmissionService, {
        prisma: { rolePermission: { findFirst: roleQuery }, dynReport: { findMany: everyReport }, dynReportRole: { findMany: none() } },
      });
      await service[list](USER, ROLE);
      return { allowed: everyReport.mock.calls.length === 1, roleQuery };
    },
  })),
  {
    name: 'AggregateService.accessRoleFor (resolveManagerRole) — admin:DynamicReport',
    keys: ['admin:DynamicReport'],
    roleQueryArgs: ADMIN_OF_REPORTS,
    async attempt(roleHolds) {
      const roleQuery = firstGrant(roleHolds);
      const service = bare(AggregateService, {
        prisma: { rolePermission: { findFirst: roleQuery }, dynReportRole: { findFirst: jest.fn().mockResolvedValue(null) } },
      });
      return { allowed: (await service.accessRoleFor('rep', USER, ROLE))?.role === 'ADMIN', roleQuery };
    },
  },
  {
    name: 'AggregateService.reopenPeriod — admin:DynamicReport',
    keys: ['admin:DynamicReport'],
    roleQueryArgs: ADMIN_OF_REPORTS,
    async attempt(roleHolds) {
      const roleQuery = firstGrant(roleHolds);
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        // Not closed yet: an admin gets past the permission check and is told so; anybody else gets "not found".
        dynReportPeriod: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', reportId: 'rep', status: 'OPEN' }) },
        rolePermission: { findFirst: roleQuery },
      };
      const service = bare(AggregateService, { prisma: { $transaction: (run: (t: typeof tx) => unknown) => run(tx) } });
      return { allowed: await refusedWith(service.reopenPeriod('p1', USER, ROLE, 'reason'), NotFoundException), roleQuery };
    },
  },
  {
    name: 'AggregateService.listPeriodsForViewer — admin:DynamicReport sees every report',
    keys: ['admin:DynamicReport'],
    roleQueryArgs: ADMIN_OF_REPORTS,
    async attempt(roleHolds) {
      const roleQuery = firstGrant(roleHolds);
      const everyReport = none();
      const service = bare(AggregateService, {
        prisma: { rolePermission: { findFirst: roleQuery }, dynReport: { findMany: everyReport }, dynReportRole: { findMany: none() } },
      });
      await service.listPeriodsForViewer(USER, ROLE);
      return { allowed: everyReport.mock.calls.length === 1, roleQuery };
    },
  },
  {
    name: 'ReportLifecycleService.standing — admin:DynamicReport',
    keys: ['admin:DynamicReport'],
    roleQueryArgs: ADMIN_OF_REPORTS,
    async attempt(roleHolds) {
      const roleQuery = firstGrant(roleHolds);
      const client = { rolePermission: { findFirst: roleQuery }, dynReportRole: { findFirst: jest.fn().mockResolvedValue(null) } };
      const standing = await method<Promise<string | null>>(bare(ReportLifecycleService, {}), 'standing')(client, 'rep', ACTOR);
      return { allowed: standing === 'ADMIN', roleQuery };
    },
  },
  {
    name: 'OcrSendPolicy.requirePermission — edit:Case (reading the scans of a saved record again)',
    keys: ['edit:Case'],
    roleQueryArgs: { where: { roleId: ROLE, permission: { action: 'edit', subject: 'Case' } } },
    async attempt(roleHolds) {
      const roleQuery = jest.fn().mockResolvedValue(roleHolds ? 1 : 0);
      const policy = new OcrSendPolicy({ rolePermission: { count: roleQuery } } as never, {} as never);
      return { allowed: await refusedWith(policy.requirePermission(USER, ROLE, 'edit', 'Case'), OcrImportError), roleQuery };
    },
  },
  ...([
    ['assertForRole — when a reading is requested', (policy: OcrSendPolicy) => policy.assertForRole(USER, ROLE)],
    ['assertForUser — again when the queued job runs', (policy: OcrSendPolicy) => policy.assertForUser(USER)],
  ] as const).map(([what, ask]): Site => ({
    name: `OcrSendPolicy.${what} — sendInternal:OcrImport`,
    keys: ['sendInternal:OcrImport'],
    roleQueryArgs: { where: { roleId: ROLE, permission: { action: 'sendInternal', subject: 'OcrImport' } } },
    async attempt(roleHolds) {
      const roleQuery = jest.fn().mockResolvedValue(roleHolds ? 1 : 0);
      const policy = new OcrSendPolicy(
        { rolePermission: { count: roleQuery }, user: { findUnique: jest.fn().mockResolvedValue({ roleId: ROLE, isActive: true }) } } as never,
        { activeDestinations: jest.fn().mockResolvedValue({ cloud: false, internal: true }) } as never,
      );
      return { allowed: await refusedWith(ask(policy), OcrImportError), roleQuery };
    },
  })),
  {
    name: 'OcrIntakeService.openSession — write:Petition',
    keys: ['write:Petition'],
    roleQueryArgs: { where: { roleId: ROLE, permission: { action: 'write', subject: 'Petition' } } },
    async attempt(roleHolds) {
      const roleQuery = jest.fn().mockResolvedValue(roleHolds ? 1 : 0);
      const sessions = { createSession: jest.fn().mockResolvedValue({ id: 's1' }) };
      const service = new OcrIntakeService({ rolePermission: { count: roleQuery } } as never, sessions as never, {} as never, {} as never, {} as never, {} as never);
      const user = { id: USER, roleId: ROLE, email: 'u@x', role: 'OFFICER' };
      return { allowed: await refusedWith(service.openSession('PETITION', user as never), OcrImportError), roleQuery };
    },
  },
  {
    name: 'BulkImportService.getJob — read:User',
    keys: ['read:User'],
    roleLoadedAnyway: true,
    roleQueryArgs: { where: { id: USER }, include: { role: { include: { permissions: { include: { permission: true } } } } } },
    async attempt(roleHolds) {
      const permissions = roleHolds ? [{ permission: { subject: 'User', action: 'read', conditions: null } }] : [];
      const roleQuery = jest.fn().mockResolvedValue({ id: USER, isActive: true, role: { name: 'OFFICER', permissions } });
      // No such job: whoever gets past the permission check is told "not found".
      const tx = { user: { findUnique: roleQuery }, bulkImportJob: { findUnique: jest.fn().mockResolvedValue(null) } };
      const service = bare(BulkImportService, { prisma: { $transaction: (run: (t: typeof tx) => unknown) => run(tx) } });
      return { allowed: await refusedWith(service.getJob('job-1', USER, false), ForbiddenException), roleQuery };
    },
  },
  {
    name: 'LegalWorkflowService.assertSourceScope — read:Incident and edit:Incident',
    keys: ['read:Incident', 'edit:Incident'],
    roleLoadedAnyway: true,
    roleQueryArgs: { where: { id: USER }, include: { role: { include: { permissions: { include: { permission: true } } } } } },
    async attempt(roleHolds) {
      const permissions = roleHolds ? ['read', 'edit'].map((action) => ({ permission: { subject: 'Incident', action, conditions: null } })) : [];
      const roleQuery = jest.fn().mockResolvedValue({ id: USER, isActive: true, role: { name: 'OFFICER', permissions } });
      const service = bare(LegalWorkflowService, { core: { currentScope: jest.fn().mockResolvedValue(null) } });
      const check = method<Promise<void>>(service, 'assertSourceScope')({ user: { findUniqueOrThrow: roleQuery } }, {}, { actorId: USER }, 'Incident');
      return { allowed: await refusedWith(check, ForbiddenException), roleQuery };
    },
  },
  {
    name: 'guardCaseAuthority — write:User and manage_access:CaseGovernance to change a business account',
    keys: ['write:User', 'manage_access:CaseGovernance'],
    roleLoadedAnyway: true,
    roleQueryArgs: { where: { roleId: 'manager' }, include: { permission: true } },
    async attempt(roleHolds) {
      const { tx } = authorityFixture(roleHolds ? [['User', 'write'], ['CaseGovernance', 'manage_access']] : [['Case', 'read']]);
      return { allowed: await refusedWith(guardCaseAuthority(tx as never, USER, { targetUserId: 'target' }), ForbiddenException), roleQuery: tx.rolePermission.findMany };
    },
  },
];

/** The actor (role `manager`) and a business account (role `business`, which carries case-governance authority). */
function authorityFixture(managerHolds: [subject: string, action: string][]) {
  const pair = ([subject, action]: [string, string]) => ({ permission: { subject, action, conditions: null } });
  const users = new Map([
    [USER, { id: USER, isActive: true, roleId: 'manager', caseAccessMode: 'INTERNAL', role: { name: 'ADMIN' } }],
    ['target', { id: 'target', isActive: true, roleId: 'business', caseAccessMode: 'INTERNAL', role: { name: 'BUSINESS' } }],
  ]);
  const roles = new Map([
    ['manager', managerHolds.map(pair)],
    ['business', [pair(['CaseGovernance', 'review'])]],
  ]);
  const tx = {
    caseGovernanceGrant: { findFirst: jest.fn().mockResolvedValue(null) },
    caseRepresentationGrant: { findFirst: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null),
      findMany: jest.fn(async ({ where }: { where: { roleId: string } }) =>
        [...users.values()].filter((user) => user.roleId === where.roleId).map((user) => ({ id: user.id, caseAccessMode: user.caseAccessMode })),
      ),
    },
    userTeam: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    team: { findMany: jest.fn().mockResolvedValue([]) },
    dataAccessGrant: { findMany: jest.fn().mockResolvedValue([]) },
    rolePermission: { findMany: jest.fn(async ({ where }: { where: { roleId: string } }) => roles.get(where.roleId) ?? []) },
  };
  return { tx };
}

describe.each(SITES)('$name', (site) => {
  it('not enforced (nothing registered, or it answers undefined): the role decides, read as before', async () => {
    for (const setup of [() => undefined, () => enforce(undefined)]) {
      setup();
      const yes = await site.attempt(true);
      expect(yes.allowed).toBe(true);
      expect(yes.roleQuery).toHaveBeenCalledWith(site.roleQueryArgs);
      const no = await site.attempt(false);
      expect(no.allowed).toBe(false);
      expect(no.roleQuery).toHaveBeenCalledWith(site.roleQueryArgs);
    }
  });

  it('enforced: the role says yes but the person does not hold it — refused', async () => {
    for (const held of [[], ['read:SomethingElse']]) {
      enforce(held);
      const attempt = await site.attempt(true);
      expect(attempt.allowed).toBe(false);
      // What the person holds is the whole answer: the role is not even asked, unless its query serves something else.
      if (!site.roleLoadedAnyway) expect(attempt.roleQuery).not.toHaveBeenCalled();
    }
  });

  it('enforced: the role says no but the person holds it — allowed', async () => {
    for (const held of site.anyOf ? site.keys.map((key) => [key]) : [site.keys]) {
      enforce(held);
      expect((await site.attempt(false)).allowed).toBe(true);
    }
  });

  if (!site.anyOf && site.keys.length > 1) {
    it('enforced: holding only some of what is required is not enough', async () => {
      for (const missing of site.keys) {
        enforce(site.keys.filter((key) => key !== missing));
        expect({ missing, allowed: (await site.attempt(true)).allowed }).toEqual({ missing, allowed: false });
      }
    });
  }
});

describe('what stays inside the role fallback', () => {
  it('a conditional permission of the role is not a grant when the role decides (bulk import, source link)', async () => {
    const conditional = (subject: string, action: string) => ({ permission: { subject, action, conditions: { teamId: 'x' } } });

    const actor = { id: USER, isActive: true, role: { name: 'OFFICER', permissions: [conditional('User', 'read')] } };
    const tx = { user: { findUnique: jest.fn().mockResolvedValue(actor) }, bulkImportJob: { findUnique: jest.fn().mockResolvedValue(null) } };
    const bulk = bare(BulkImportService, { prisma: { $transaction: (run: (t: typeof tx) => unknown) => run(tx) } });
    await expect(bulk.getJob('job-1', USER, false)).rejects.toBeInstanceOf(ForbiddenException);

    const user = { id: USER, isActive: true, role: { name: 'OFFICER', permissions: [conditional('Petition', 'read'), conditional('Petition', 'edit')] } };
    const legal = bare(LegalWorkflowService, { core: { currentScope: jest.fn().mockResolvedValue(null) } });
    const check = method<Promise<void>>(legal, 'assertSourceScope');
    await expect(check({ user: { findUniqueOrThrow: jest.fn().mockResolvedValue(user) } }, {}, { actorId: USER }, 'Petition')).rejects.toThrow(
      'Explicit source read/edit permission required',
    );
  });

  it('an inactive actor is refused whatever they hold (bulk import, source link)', async () => {
    enforce(['read:User', 'read:Incident', 'edit:Incident']);
    const actor = { id: USER, isActive: false, role: { name: 'OFFICER', permissions: [] } };
    const tx = { user: { findUnique: jest.fn().mockResolvedValue(actor) }, bulkImportJob: { findUnique: jest.fn().mockResolvedValue(null) } };
    const bulk = bare(BulkImportService, { prisma: { $transaction: (run: (t: typeof tx) => unknown) => run(tx) } });
    await expect(bulk.getJob('job-1', USER, false)).rejects.toBeInstanceOf(ForbiddenException);

    const legal = bare(LegalWorkflowService, { core: { currentScope: jest.fn().mockResolvedValue(null) } });
    const check = method<Promise<void>>(legal, 'assertSourceScope');
    await expect(check({ user: { findUniqueOrThrow: jest.fn().mockResolvedValue(actor) } }, {}, { actorId: USER }, 'Incident')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('the queued OCR job is refused for a deactivated person without asking what they hold', async () => {
    enforce(['sendInternal:OcrImport']);
    const policy = new OcrSendPolicy(
      { user: { findUnique: jest.fn().mockResolvedValue({ roleId: ROLE, isActive: false }) } } as never,
      { activeDestinations: jest.fn().mockResolvedValue({ cloud: false, internal: true }) } as never,
    );
    await expect(policy.assertForUser(USER)).rejects.toBeInstanceOf(OcrImportError);
  });

  it('every kind of provider that is active needs its own send permission, enforced or not', async () => {
    const policy = (roleGrants: number) =>
      new OcrSendPolicy(
        { rolePermission: { count: jest.fn().mockResolvedValue(roleGrants) } } as never,
        { activeDestinations: jest.fn().mockResolvedValue({ cloud: true, internal: true }) } as never,
      );
    enforce(['sendInternal:OcrImport']);
    await expect(policy(1).assertForRole(USER, ROLE)).rejects.toBeInstanceOf(OcrImportError);
    enforce(['sendInternal:OcrImport', 'sendCloud:OcrImport']);
    await expect(policy(0).assertForRole(USER, ROLE)).resolves.toBeUndefined();
  });
});

describe('guardCaseAuthority — nobody gives themselves business authority they do not hold', () => {
  const MANAGES: [string, string][] = [['User', 'write'], ['CaseGovernance', 'manage_access']];
  /** The actor edits the permissions of their OWN role so that it would carry `review`. */
  const addReviewToOwnRole = (managerHolds: [string, string][]) =>
    guardCaseAuthority(authorityFixture(managerHolds).tx as never, USER, {
      roleId: 'manager',
      nextPermissions: [{ subject: 'CaseGovernance', action: 'review' }],
    });

  it('not enforced: what the role holds now is what the actor may keep or add', async () => {
    for (const setup of [() => undefined, () => enforce(undefined)]) {
      setup();
      await expect(addReviewToOwnRole(MANAGES)).rejects.toThrow('Self acquisition of business authority is prohibited');
      await expect(addReviewToOwnRole([...MANAGES, ['CaseGovernance', 'review']])).resolves.toBeDefined();
    }
  });

  it('enforced: what the person holds decides', async () => {
    // The role already has `review`, the person does not hold it: adding it is still self acquisition.
    enforce(['write:User', 'manage_access:CaseGovernance']);
    await expect(addReviewToOwnRole([...MANAGES, ['CaseGovernance', 'review']])).rejects.toThrow('Self acquisition of business authority is prohibited');
    // The role lacks it, the person holds it through a team: nothing is acquired.
    enforce(['write:User', 'manage_access:CaseGovernance', 'review:CaseGovernance']);
    await expect(addReviewToOwnRole(MANAGES)).resolves.toBeDefined();
  });
});

describe('guardCaseAuthority — an account whose business authority comes from a TEAM is as protected as one whose role carries it', () => {
  /** The target's role carries no governance permission at all. */
  function plainTarget(managerHolds: [string, string][]) {
    const fixture = authorityFixture(managerHolds);
    const original = fixture.tx.rolePermission.findMany;
    fixture.tx.rolePermission.findMany = jest.fn(async (args: { where: { roleId: string } }) =>
      args.where.roleId === 'business' ? [] : original(args),
    ) as never;
    return fixture.tx;
  }
  const reset = (tx: unknown) => guardCaseAuthority(tx as never, USER, { targetUserId: 'target' });
  const ONLY_ACCOUNTS: [string, string][] = [['User', 'write']];

  it('not enforced: a target with no governance in its role and no grants is an ordinary account', async () => {
    for (const setup of [() => undefined, () => enforce(undefined)]) {
      setup();
      await expect(reset(plainTarget(ONLY_ACCOUNTS))).resolves.toBeDefined();
    }
  });

  it('enforced: the target holds `review` through a team: an account administrator without manage_access is refused', async () => {
    const keysOrNone = jest.fn((userId: string) => (userId === 'target' ? ['review:CaseGovernance'] : ['write:User']));
    setEnforcement({
      scopeOf: () => undefined,
      keysOf: () => ['write:User'],
      unconditionalKeysOf: () => ['write:User'],
      keysOrNone,
      holdersOf: () => undefined,
    });
    await expect(reset(plainTarget(ONLY_ACCOUNTS))).rejects.toThrow('Current User.write and CaseGovernance.manage_access required');
    expect(keysOrNone).toHaveBeenCalledWith('target');
  });

  it('enforced: a target who holds nothing of the kind stays an ordinary account', async () => {
    setEnforcement({
      scopeOf: () => undefined,
      keysOf: () => ['write:User'],
      unconditionalKeysOf: () => ['write:User'],
      keysOrNone: () => ['read:Case'],
      holdersOf: () => undefined,
    });
    await expect(reset(plainTarget(ONLY_ACCOUNTS))).resolves.toBeDefined();
  });
});

