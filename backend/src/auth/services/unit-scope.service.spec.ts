/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { UnitScopeService } from './unit-scope.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TeamsService } from '../../teams/teams.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  userTeam: {
    findMany: jest.fn(),
  },
  dataAccessGrant: {
    findMany: jest.fn(),
  },
};

const mockTeamsService = {
  getDescendantIds: jest.fn(),
  getUserIdsForTeams: jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UnitScopeService', () => {
  let service: UnitScopeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitScopeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TeamsService, useValue: mockTeamsService },
      ],
    }).compile();

    service = module.get<UnitScopeService>(UnitScopeService);
    jest.clearAllMocks();
  });

  // ── ADMIN role ──────────────────────────────────────────────────────────

  describe('resolveScope - ADMIN', () => {
    it('returns null for ADMIN role (full access)', async () => {
      const result = await service.resolveScope('user-1', 'ADMIN');

      expect(result).toBeNull();
      expect(mockPrisma.userTeam.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Team member ─────────────────────────────────────────────────────────

  describe('resolveScope - team member', () => {
    it('returns scope with team IDs and user IDs for team member', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { teamId: 't1', team: { level: 1 } },
      ]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1', 'u2']);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result).not.toBeNull();
      expect(result!.teamIds).toContain('t1');
      expect(result!.userIds).toContain('user-1');
      expect(mockTeamsService.getDescendantIds).not.toHaveBeenCalled();
    });
  });

  // ── Group leader (level 0) ──────────────────────────────────────────────

  describe('resolveScope - group leader', () => {
    it('expands descendants for level 0 teams', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { teamId: 'g1', team: { level: 0 } },
      ]);
      mockTeamsService.getDescendantIds.mockResolvedValue(['t1', 't2']);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1', 'u2', 'u3']);

      const result = await service.resolveScope('leader-1', 'OFFICER');

      expect(result!.teamIds).toContain('g1');
      expect(result!.teamIds).toContain('t1');
      expect(result!.teamIds).toContain('t2');
      expect(mockTeamsService.getDescendantIds).toHaveBeenCalledWith('g1');
    });
  });

  // ── Data access grants ─────────────────────────────────────────────────

  describe('resolveScope - with grants', () => {
    it('includes teams from active grants', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { teamId: 't1', team: { level: 1 } },
      ]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([
        { teamId: 't-granted' },
      ]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1']);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result!.teamIds).toContain('t1');
      expect(result!.teamIds).toContain('t-granted');
    });
  });

  // ── Multi-team ──────────────────────────────────────────────────────────

  describe('resolveScope - multi-team', () => {
    it('handles user belonging to multiple teams', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { teamId: 't1', team: { level: 1 } },
        { teamId: 't2', team: { level: 1 } },
      ]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1', 'u2', 'u3']);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result!.teamIds).toContain('t1');
      expect(result!.teamIds).toContain('t2');
      expect(result!.teamIds).toHaveLength(2);
    });
  });

  // ── No team ─────────────────────────────────────────────────────────────

  describe('resolveScope - no team', () => {
    it('returns scope with only own user ID when no teams', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue([]);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result!.teamIds).toEqual([]);
      expect(result!.userIds).toEqual(['user-1']);
    });
  });
});
