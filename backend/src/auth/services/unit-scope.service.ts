import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TeamsService } from '../../teams/teams.service';

export interface DataScope {
  teamIds: string[];
  userIds: string[];
}

@Injectable()
export class UnitScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamsService: TeamsService,
  ) {}

  /**
   * Resolve the data scope for a user based on their role and team memberships.
   * ADMIN role returns null (full access).
   */
  async resolveScope(
    userId: string,
    roleName: string,
  ): Promise<DataScope | null> {
    // Admin bypasses all scope restrictions
    if (roleName === 'ADMIN') return null;

    // Get user's team memberships
    const userTeams = await this.prisma.userTeam.findMany({
      where: { userId },
      include: { team: true },
    });

    const teamIds: string[] = [];

    for (const ut of userTeams) {
      teamIds.push(ut.teamId);

      // Expand to all descendants regardless of level
      // Level 0 (Nhóm) → expands to Tổ + Phường
      // Level 1 (Tổ) → expands to Phường
      // Level 2 (Phường) → no children, returns []
      // Performance note: recursive N+1 queries, acceptable at current scale (MAX_DEPTH=3, <100 teams)
      const descendants = await this.teamsService.getDescendantIds(ut.teamId);
      teamIds.push(...descendants);
    }

    // Add teams from DataAccessGrants (active, not expired)
    const grants = await this.prisma.dataAccessGrant.findMany({
      where: {
        granteeId: userId,
        team: { isActive: true },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { teamId: true },
    });

    for (const grant of grants) {
      if (!teamIds.includes(grant.teamId)) {
        teamIds.push(grant.teamId);
      }
    }

    // Get unique team IDs
    const uniqueTeamIds = [...new Set(teamIds)];

    // Get user IDs for all teams
    const userIds = await this.teamsService.getUserIdsForTeams(uniqueTeamIds);

    // Always include the user themselves
    if (!userIds.includes(userId)) {
      userIds.push(userId);
    }

    return { teamIds: uniqueTeamIds, userIds };
  }
}
