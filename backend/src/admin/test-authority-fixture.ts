/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
/** Existing ordinary-account tests now model an active database actor and locks. */
export function authorityFixtureTx(db: any) {
  return {
    ...db,
    caseGovernanceGrant: db.caseGovernanceGrant ?? { findFirst: jest.fn().mockResolvedValue(null) },
    caseRepresentationGrant: db.caseRepresentationGrant ?? { findFirst: jest.fn().mockResolvedValue(null) },
    $queryRaw: db.$queryRaw ?? jest.fn().mockResolvedValue([]),
    rolePermission: db.rolePermission?.findMany ? db.rolePermission : { ...db.rolePermission, findMany: jest.fn().mockResolvedValue([]) },
    user: {
      ...db.user,
      findMany: async (args: any) => args.select?.id && args.where?.roleId ? [] : db.user.findMany(args),
      findUnique: async (args: any) => {
        if (['requester-1', 'admin1', 'req'].includes(args.where.id))
          return { id: args.where.id, roleId: 'ordinary-admin', isActive: true };
        const user = await db.user.findUnique(args);
        return user ? { updatedAt: new Date(0), roleId: 'ordinary', isActive: true, ...user } : null;
      },
    },
  };
}
