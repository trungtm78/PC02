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
      mockTeamsService.getDescendantIds.mockResolvedValue([]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1', 'u2']);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result).not.toBeNull();
      expect(result!.teamIds).toContain('t1');
      expect(result!.userIds).toContain('user-1');
      expect(mockTeamsService.getDescendantIds).toHaveBeenCalledWith('t1');
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
    it('includes teams from active READ grants in teamIds (readable)', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { teamId: 't1', team: { level: 1 } },
      ]);
      mockTeamsService.getDescendantIds.mockResolvedValue([]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([
        { teamId: 't-granted', accessLevel: 'READ' },
      ]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1']);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result!.teamIds).toContain('t1');
      expect(result!.teamIds).toContain('t-granted');
    });
  });

  // ── GAP-9: accessLevel enforcement (writableTeamIds) ────────────────────

  describe('resolveScope - GAP-9 writableTeamIds', () => {
    it('WRITE grant: team appears in both teamIds and writableTeamIds', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { teamId: 'own-team', team: { level: 1 } },
      ]);
      mockTeamsService.getDescendantIds.mockResolvedValue([]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([
        { teamId: 'write-team', accessLevel: 'WRITE' },
      ]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1', 'u2']);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result!.teamIds).toContain('write-team');          // readable
      expect(result!.writableTeamIds).toContain('write-team'); // also writable
      expect(result!.writableTeamIds).toContain('own-team');   // own team writable
    });

    it('READ grant: team appears in teamIds but NOT in writableTeamIds', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { teamId: 'own-team', team: { level: 1 } },
      ]);
      mockTeamsService.getDescendantIds.mockResolvedValue([]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([
        { teamId: 'readonly-team', accessLevel: 'READ' },
      ]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1']);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result!.teamIds).toContain('readonly-team');           // readable
      expect(result!.writableTeamIds).not.toContain('readonly-team'); // NOT writable
      expect(result!.writableTeamIds).toContain('own-team');         // own team writable
    });

    it('own teams always in writableTeamIds regardless of grants', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { teamId: 'my-team', team: { level: 1 } },
      ]);
      mockTeamsService.getDescendantIds.mockResolvedValue([]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1']);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result!.writableTeamIds).toContain('my-team');
    });

    it('no grants: writableTeamIds equals own teamIds', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { teamId: 'team-a', team: { level: 1 } },
        { teamId: 'team-b', team: { level: 1 } },
      ]);
      mockTeamsService.getDescendantIds.mockResolvedValue([]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1', 'u2']);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result!.writableTeamIds).toEqual(expect.arrayContaining(['team-a', 'team-b']));
      expect(result!.writableTeamIds).toHaveLength(2);
    });
  });

  // ── Multi-team ──────────────────────────────────────────────────────────

  describe('resolveScope - multi-team', () => {
    it('handles user belonging to multiple teams', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { teamId: 't1', team: { level: 1 } },
        { teamId: 't2', team: { level: 1 } },
      ]);
      mockTeamsService.getDescendantIds.mockResolvedValue([]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1', 'u2', 'u3']);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result!.teamIds).toContain('t1');
      expect(result!.teamIds).toContain('t2');
      expect(result!.teamIds).toHaveLength(2);
    });
  });

  // ── Level 1 expansion (Tổ → Phường) ─────────────────────────────────────

  describe('resolveScope - level 1 expansion', () => {
    it('should expand descendants for level 1 (Tổ → Phường)', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { teamId: 'to-1', team: { level: 1 } },
      ]);
      mockTeamsService.getDescendantIds.mockResolvedValue([
        'ward-1',
        'ward-2',
      ]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1', 'u2']);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result!.teamIds).toContain('to-1');
      expect(result!.teamIds).toContain('ward-1');
      expect(result!.teamIds).toContain('ward-2');
      expect(result!.teamIds).toHaveLength(3);
      expect(mockTeamsService.getDescendantIds).toHaveBeenCalledWith('to-1');
    });
  });

  // ── Level 2 leaf (Phường) ──────────────────────────────────────────────

  describe('resolveScope - level 2 leaf', () => {
    it('should return empty descendants for level 2 (Phường)', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { teamId: 'ward-1', team: { level: 2 } },
      ]);
      mockTeamsService.getDescendantIds.mockResolvedValue([]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
      mockTeamsService.getUserIdsForTeams.mockResolvedValue(['u1']);

      const result = await service.resolveScope('user-1', 'OFFICER');

      expect(result!.teamIds).toEqual(['ward-1']);
      expect(mockTeamsService.getDescendantIds).toHaveBeenCalledWith('ward-1');
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
