/* In-memory Prisma delegate fixtures intentionally use partial dynamic records. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { CasePrincipalAccessService } from './case-principal-access.service';
import { CaseGovernanceService } from './case-governance.service';
const date = new Date('2026-10-06T00:00:00Z');
function fixture() {
  const manager: any = {
    id: 'manager',
    isActive: true,
    caseAccessMode: 'INTERNAL',
    caseAccessRevision: 0,
    role: {
      name: 'ADMIN',
      permissions: [
        { permission: { subject: 'User', action: 'write', conditions: null } },
        {
          permission: {
            subject: 'CaseGovernance',
            action: 'manage_access',
            conditions: null,
          },
        },
      ],
    },
  };
  const target: any = {
    id: 'target',
    caseAccessMode: 'INTERNAL',
    caseAccessRevision: 0,
    updatedAt: date,
  };
  const audits: any[] = [];
  const db: any = {
    user: {
      findUnique: async ({ where }: any) =>
        where.id === 'manager' ? manager : target,
      findUniqueOrThrow: async () => target,
      updateMany: jest.fn(async ({ data }: any) => {
        target.caseAccessMode = data.caseAccessMode;
        target.caseAccessRevision++;
        target.updatedAt = new Date(date.getTime() + 1);
        return { count: 1 };
      }),
    },
    auditLog: {
      findUnique: async ({ where }: any) =>
        audits.find((a) => a.id === where.id) ?? null,
      create: jest.fn(async ({ data }: any) => {
        audits.push(data);
        return data;
      }),
    },
    featureFlag: { findUnique: async () => ({ enabled: true }) },
    $transaction: async (fn: any) => fn(db),
  };
  const dto: any = {
    caseAccessMode: 'REPRESENTATION_ONLY',
    expectedUserUpdatedAt: date.toISOString(),
    expectedCaseAccessRevision: 0,
    requestKey: 'mode1',
    reason: 'Restrict external representation access',
  };
  return {
    manager,
    target,
    db,
    audits,
    dto,
    service: new CasePrincipalAccessService(db, new CaseGovernanceService(db)),
  };
}
describe('principal access mode control plane', () => {
  it('reads the current principal version only for explicit internal managers in target scope', async () => {
    const f = fixture();
    expect(
      (await f.service.get('target', { actorId: 'manager' })).data,
    ).toEqual({
      id: 'target',
      caseAccessMode: 'INTERNAL',
      caseAccessRevision: 0,
      updatedAt: date,
    });
    jest
      .spyOn((f.service as any).core, 'currentActorScope')
      .mockResolvedValue({ writableUserIds: [] } as any);
    await expect(
      f.service.get('target', { actorId: 'manager' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      f.service.change('target', f.dto, { actorId: 'manager' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.db.user.updateMany).not.toHaveBeenCalled();
  });
  it('requires User write permission for principal reads and never fabricates a missing target', async () => {
    const f = fixture();
    f.manager.role.permissions = f.manager.role.permissions.filter(
      (p: any) => p.permission.subject !== 'User',
    );
    await expect(
      f.service.get('target', { actorId: 'manager' }),
    ).rejects.toMatchObject({ status: 403 });
    const missing = fixture();
    missing.db.user.findUnique = async ({ where }: any) =>
      where.id === 'manager' ? missing.manager : null;
    await expect(
      missing.service.get('target', { actorId: 'manager' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      missing.service.change('target', missing.dto, { actorId: 'manager' }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('maps serialization races to current authorized replay or a conflict without an HTTP 500', async () => {
    const f = fixture();
    const result = await f.service.change('target', f.dto, {
      actorId: 'manager',
    });
    let calls = 0;
    f.db.$transaction = async (fn: any) => {
      if (++calls === 1)
        throw Object.assign(new Error('Synthetic serialization race'), {
          code: 'P2034',
        });
      return fn(f.db);
    };
    await expect(
      f.service.change('target', f.dto, { actorId: 'manager' }),
    ).resolves.toEqual(result);
    expect(f.db.user.updateMany).toHaveBeenCalledTimes(1);
    f.db.$transaction = async () => {
      throw Object.assign(new Error('Synthetic serialization race'), {
        code: 'P2034',
      });
    };
    await expect(
      f.service.change('target', f.dto, { actorId: 'manager' }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('requires explicit manage_access independently of technical ADMIN and rejects representation control plane', async () => {
    const f = fixture();
    f.manager.role.permissions = f.manager.role.permissions.filter(
      (p: any) => p.permission.subject !== 'CaseGovernance',
    );
    await expect(
      f.service.change('target', f.dto, {
        actorId: 'manager',
        roleId: 'forged-admin',
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.db.user.updateMany).not.toHaveBeenCalled();
    const only = fixture();
    only.manager.caseAccessMode = 'REPRESENTATION_ONLY';
    await expect(
      only.service.change('target', only.dto, { actorId: 'manager' }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('updates mode/revision with audit in one transaction and replays exact content once', async () => {
    const f = fixture();
    const result = await f.service.change('target', f.dto, {
      actorId: 'manager',
    });
    expect(result.data).toMatchObject({
      id: 'target',
      caseAccessMode: 'REPRESENTATION_ONLY',
      caseAccessRevision: 1,
    });
    expect(f.db.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enrollmentTokenHash: null,
          enrollmentExpiresAt: null,
          refreshTokenHash: null,
          tokenVersion: { increment: 1 },
          mustChangePassword: true,
          passwordHash: expect.any(String),
        }),
      }),
    );
    expect(f.audits).toHaveLength(1);
    expect(
      await f.service.change('target', f.dto, { actorId: 'manager' }),
    ).toEqual(result);
    expect(f.db.user.updateMany).toHaveBeenCalledTimes(1);
    await expect(
      f.service.change(
        'target',
        { ...f.dto, caseAccessMode: 'INTERNAL' },
        { actorId: 'manager' },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('stale User CAS leaves mode and audit unchanged', async () => {
    const f = fixture();
    f.db.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      f.service.change('target', f.dto, { actorId: 'manager' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.target.caseAccessRevision).toBe(0);
    expect(f.db.auditLog.create).not.toHaveBeenCalled();
  });
});
