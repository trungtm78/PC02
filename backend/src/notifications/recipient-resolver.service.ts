import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_NAMES } from '../common/constants/role.constants';

@Injectable()
export class RecipientResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns user IDs that should receive notifications for a team-assigned entity.
   * Extracted from DeadlineScheduler.getTeamRecipients() (D6).
   */
  async getTeamRecipients(
    assignedTeamId: string | null,
    directUserId: string | null,
  ): Promise<string[]> {
    const ids = new Set<string>();

    if (directUserId) ids.add(directUserId);

    if (assignedTeamId) {
      const members = await this.prisma.userTeam.findMany({
        where: { teamId: assignedTeamId },
        select: { userId: true },
      });
      members.forEach((m) => ids.add(m.userId));

      const grants = await this.prisma.dataAccessGrant.findMany({
        where: {
          teamId: assignedTeamId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { granteeId: true },
      });
      grants.forEach((g) => ids.add(g.granteeId));
    }

    if (ids.size === 0) return [];

    const teamExpandedIds = [...ids].filter((id) => id !== directUserId);

    if (teamExpandedIds.length > 0) {
      const filtered = await this.prisma.user.findMany({
        where: {
          id: { in: teamExpandedIds },
          isActive: true,
          role: { name: { not: ROLE_NAMES.ADMIN } },
        },
        select: { id: true },
      });

      const result = new Set<string>(filtered.map((u) => u.id));
      if (directUserId) result.add(directUserId);
      return [...result];
    }

    return directUserId ? [directUserId] : [];
  }

  /** Fallback for CASE_CREATED — new case not yet assigned to a team (D3). */
  async getAllHeadUnits(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: ROLE_NAMES.HEAD_UNIT },
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
}
