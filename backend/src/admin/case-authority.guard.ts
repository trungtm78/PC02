import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { CaseGovernanceService } from '../cases/governance/case-governance.service';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../auth/utils/password-hash.util';

type Tx = Prisma.TransactionClient;
type Permission = { action: string; subject: string; conditions?: unknown };
const governance = (permission: Permission) =>
  permission.subject === 'CaseGovernance';
export function businessCapabilities(permissions: Permission[]): Set<string> {
  return new Set(
    permissions
      .filter((p) => governance(p) && p.conditions === null)
      .map((p) => p.action),
  );
}
export async function businessCredentialInvalidation(
  requireEnrollment: boolean,
): Promise<Prisma.UserUpdateManyMutationInput> {
  return {
    tokenVersion: { increment: 1 },
    refreshTokenHash: null,
    enrollmentTokenHash: null,
    enrollmentExpiresAt: null,
    ...(requireEnrollment
      ? {
          passwordHash: await hashPassword(
            randomBytes(32).toString('base64url'),
          ),
          passwordChangedAt: new Date(),
          mustChangePassword: true,
        }
      : {}),
  };
}

export async function authorityTransaction<T>(
  prisma: PrismaService,
  handler: (tx: Tx) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(handler, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2034'
    )
      throw new ConflictException(
        'Current account authority changed; reload and retry',
      );
    throw error;
  }
}

/** Locks current identities and roles until the caller's mutation and audit commit. */
export async function guardCaseAuthority(
  tx: Tx,
  actorId: string,
  input: {
    targetUserId?: string;
    nextRoleId?: string;
    roleId?: string;
    nextPermissions?: Permission[];
    destinationTeamId?: string;
  },
) {
  if (!actorId)
    throw new ForbiddenException('Current authenticated actor required');
  const roleUsers = input.roleId
    ? await tx.user.findMany({
        where: { roleId: input.roleId },
        select: { id: true, caseAccessMode: true },
      })
    : [];
  const userIds = [
    ...new Set(
      [actorId, input.targetUserId, ...roleUsers.map((user) => user.id)].filter(
        (id): id is string => !!id,
      ),
    ),
  ].sort();
  for (const id of userIds)
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor?.isActive)
    throw new ForbiddenException('Current active actor required');
  const target = input.targetUserId
    ? await tx.user.findUnique({ where: { id: input.targetUserId } })
    : null;
  if (input.targetUserId && !target)
    throw new NotFoundException('User does not exist');
  const roleIds = [
    ...new Set(
      [actor.roleId, target?.roleId, input.nextRoleId, input.roleId].filter(
        (id): id is string => !!id,
      ),
    ),
  ].sort();
  for (const id of roleIds)
    await tx.$queryRaw`SELECT id FROM roles WHERE id = ${id} FOR UPDATE`;
  const rolePermissions = new Map<string, Permission[]>();
  for (const roleId of roleIds) {
    const rows = await tx.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    rolePermissions.set(
      roleId,
      rows.map((row) => row.permission),
    );
  }
  const current = rolePermissions.get(actor.roleId) ?? [];
  const has = (subject: string, action: string) =>
    current.some(
      (p) =>
        p.subject === subject && p.action === action && p.conditions === null,
    );
  const affected = [target?.roleId, input.nextRoleId, input.roleId].flatMap(
    (roleId) => (roleId ? (rolePermissions.get(roleId) ?? []) : []),
  );
  const clock = new Date();
  const affectedUsers = input.roleId ? roleUsers : target ? [target] : [];
  let protectedPrincipal = affectedUsers.some(
    (user) => user.caseAccessMode === 'REPRESENTATION_ONLY',
  );
  for (const user of affectedUsers) {
    if (
      (await tx.caseGovernanceGrant.findFirst({
        where: {
          granteeId: user.id,
          revokedAt: null,
          startsAt: { lte: clock },
          OR: [{ expiresAt: null }, { expiresAt: { gt: clock } }],
        },
        select: { id: true },
      })) ||
      (await tx.caseRepresentationGrant.findFirst({
        where: {
          granteeId: user.id,
          revokedAt: null,
          startsAt: { lte: clock },
          expiresAt: { gt: clock },
        },
        select: { id: true },
      }))
    ) {
      protectedPrincipal = true;
      break;
    }
  }
  const sensitive =
    affected.some(governance) ||
    (input.nextPermissions ?? []).some(governance) ||
    protectedPrincipal;
  // Preserve the normal account-management permission protocol. Business authority
  // changes additionally require an explicit current User.write and manage_access.
  if (
    sensitive &&
    (!has('User', 'write') || !has('CaseGovernance', 'manage_access'))
  )
    throw new ForbiddenException(
      'Current User.write and CaseGovernance.manage_access required',
    );
  const actorGovernance = businessCapabilities(current);
  const acquired =
    input.targetUserId === actorId && input.nextRoleId
      ? (rolePermissions.get(input.nextRoleId) ?? []).filter(governance)
      : input.roleId === actor.roleId
        ? (input.nextPermissions ?? []).filter(governance)
        : [];
  if (acquired.some((p) => !actorGovernance.has(p.action)))
    throw new ForbiddenException(
      'Self acquisition of business authority is prohibited',
    );
  if (sensitive) {
    const core = new CaseGovernanceService(tx as PrismaService);
    if (
      (await core.accessProfile(tx, { actorId })).caseAccessMode ===
      'REPRESENTATION_ONLY'
    )
      throw new ForbiddenException(
        'Internal business account management required',
      );
    const scope = await core.currentActorScope(tx, { actorId });
    if (input.destinationTeamId) {
      const team = await tx.team.findUnique({
        where: { id: input.destinationTeamId },
        select: { isActive: true },
      });
      if (
        !team?.isActive ||
        (scope && !scope.writableTeamIds.includes(input.destinationTeamId))
      )
        throw new ForbiddenException(
          'Business scope destination is outside current writable teams',
        );
    }
    if (scope) {
      if (!target && input.nextRoleId && !input.roleId)
        throw new ForbiddenException(
          'Global management required for unassigned business account creation',
        );
      for (const affectedUser of affectedUsers) {
        if (scope.writableUserIds.includes(affectedUser.id)) continue;
        const membership = await tx.userTeam.findFirst({
          where: {
            userId: affectedUser.id,
            teamId: { in: scope.writableTeamIds },
            team: { isActive: true },
          },
          select: { userId: true },
        });
        if (!membership)
          throw new ForbiddenException(
            'Business principal is outside current writable scope',
          );
      }
    }
  }
  return { actor, target, rolePermissions };
}
