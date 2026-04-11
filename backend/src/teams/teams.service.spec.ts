/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  team: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userTeam: {
    findMany: jest.fn(),
  },
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TeamsService', () => {
  let service: TeamsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
    jest.clearAllMocks();
  });

  // ── getList ──────────────────────────────────────────────────────────────

  describe('getList', () => {
    it('returns all teams with parent, children, and member count', async () => {
      const fakeTeams = [
        { id: 't1', name: 'Team 1', code: 'T-01', parent: null, children: [], _count: { members: 3 } },
      ];
      mockPrisma.team.findMany.mockResolvedValue(fakeTeams);

      const result = await service.getList();

      expect(result).toEqual(fakeTeams);
      expect(mockPrisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            parent: true,
            children: true,
            _count: { select: { members: true } },
          }),
        }),
      );
    });
  });

  // ── getById ──────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns team when found', async () => {
      const fakeTeam = { id: 't1', name: 'Team 1', code: 'T-01' };
      mockPrisma.team.findUnique.mockResolvedValue(fakeTeam);

      const result = await service.getById('t1');
      expect(result).toEqual(fakeTeam);
    });

    it('throws NotFoundException when team not found', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates team successfully', async () => {
      const created = { id: 't-new', name: 'New Team', code: 'NT-01' };
      mockPrisma.team.create.mockResolvedValue(created);

      const result = await service.create(
        { name: 'New Team', code: 'NT-01', level: 1 },
        'actor-1',
      );

      expect(result).toEqual(created);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TEAM_CREATED' }),
      );
    });

    it('creates team with optional fields', async () => {
      const created = { id: 't-new', name: 'New', code: 'NT-02', parentId: 'p1', order: 5, isActive: false };
      mockPrisma.team.create.mockResolvedValue(created);

      const result = await service.create(
        { name: 'New', code: 'NT-02', level: 1, parentId: 'p1', order: 5, isActive: false },
        'actor-1',
      );

      expect(result).toEqual(created);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates team successfully', async () => {
      mockPrisma.team.findUnique.mockResolvedValue({ id: 't1', name: 'Old' });
      mockPrisma.team.update.mockResolvedValue({ id: 't1', name: 'Updated' });

      const result = await service.update('t1', { name: 'Updated' }, 'actor-1');

      expect(result.name).toBe('Updated');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TEAM_UPDATED' }),
      );
    });

    it('throws NotFoundException when team not found', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(
        service.update('bad-id', { name: 'X' }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── delete ──────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft deletes team successfully', async () => {
      mockPrisma.team.findUnique.mockResolvedValue({ id: 't1', name: 'Team' });
      mockPrisma.team.update.mockResolvedValue({ id: 't1', isActive: false });

      const result = await service.delete('t1', 'actor-1');

      expect(result.success).toBe(true);
      expect(mockPrisma.team.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TEAM_DELETED' }),
      );
    });

    it('throws NotFoundException when team not found', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(service.delete('bad-id', 'actor-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getDescendantIds ─────────────────────────────────────────────────────

  describe('getDescendantIds', () => {
    it('returns child IDs', async () => {
      mockPrisma.team.findMany
        .mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }]) // children of root
        .mockResolvedValueOnce([]) // children of c1
        .mockResolvedValueOnce([]); // children of c2

      const result = await service.getDescendantIds('root');

      expect(result).toEqual(['c1', 'c2']);
    });

    it('returns nested descendants recursively', async () => {
      mockPrisma.team.findMany
        .mockResolvedValueOnce([{ id: 'c1' }])  // children of root
        .mockResolvedValueOnce([{ id: 'gc1' }]) // children of c1
        .mockResolvedValueOnce([]);              // children of gc1

      const result = await service.getDescendantIds('root');

      expect(result).toContain('c1');
      expect(result).toContain('gc1');
    });

    it('respects MAX_DEPTH limit', async () => {
      // Start at depth 3 (MAX_DEPTH) — should return empty
      const result = await service.getDescendantIds('root', 3);

      expect(result).toEqual([]);
      expect(mockPrisma.team.findMany).not.toHaveBeenCalled();
    });

    it('returns empty array when no children', async () => {
      mockPrisma.team.findMany.mockResolvedValue([]);

      const result = await service.getDescendantIds('leaf');

      expect(result).toEqual([]);
    });
  });

  // ── getUserIdsForTeams ───────────────────────────────────────────────────

  describe('getUserIdsForTeams', () => {
    it('returns unique user IDs', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { userId: 'u1' },
        { userId: 'u2' },
        { userId: 'u1' }, // duplicate
      ]);

      const result = await service.getUserIdsForTeams(['t1', 't2']);

      expect(result).toEqual(['u1', 'u2']);
    });

    it('returns empty array for empty teamIds', async () => {
      const result = await service.getUserIdsForTeams([]);

      expect(result).toEqual([]);
      expect(mockPrisma.userTeam.findMany).not.toHaveBeenCalled();
    });
  });
});
