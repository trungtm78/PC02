import { Test, TestingModule } from '@nestjs/testing';
import { RecipientResolverService } from './recipient-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_NAMES } from '../common/constants/role.constants';

const mockPrisma = {
  userTeam: { findMany: jest.fn() },
  dataAccessGrant: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
};

describe('RecipientResolverService', () => {
  let service: RecipientResolverService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipientResolverService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<RecipientResolverService>(RecipientResolverService);
  });

  describe('getTeamRecipients', () => {
    it('returns only directUserId when no teamId and no team members', async () => {
      const result = await service.getTeamRecipients(null, 'user-direct');
      expect(result).toEqual(['user-direct']);
      expect(mockPrisma.userTeam.findMany).not.toHaveBeenCalled();
    });

    it('returns empty array when both teamId and directUserId are null', async () => {
      const result = await service.getTeamRecipients(null, null);
      expect(result).toEqual([]);
    });

    it('includes team members and grant grantees filtered to active non-admin', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([
        { userId: 'member-1' },
        { userId: 'member-2' },
      ]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([
        { granteeId: 'grantee-1' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'member-1' },
        { id: 'member-2' },
        { id: 'grantee-1' },
      ]);

      const result = await service.getTeamRecipients('team-1', null);

      expect(mockPrisma.userTeam.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teamId: 'team-1' } }),
      );
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            role: { name: { not: ROLE_NAMES.ADMIN } },
          }),
        }),
      );
      expect(result).toEqual(expect.arrayContaining(['member-1', 'member-2', 'grantee-1']));
    });

    it('always includes directUserId even if admin-filtered from team list', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([{ userId: 'member-1' }]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]); // all filtered out

      const result = await service.getTeamRecipients('team-1', 'user-direct');
      expect(result).toContain('user-direct');
    });

    it('returns empty array when team has no members and no grants and no directUser', async () => {
      mockPrisma.userTeam.findMany.mockResolvedValue([]);
      mockPrisma.dataAccessGrant.findMany.mockResolvedValue([]);

      const result = await service.getTeamRecipients('team-empty', null);
      expect(result).toEqual([]);
    });
  });

  describe('getAllHeadUnits', () => {
    it('returns IDs of all active HEAD_UNIT users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'head-1' },
        { id: 'head-2' },
      ]);

      const result = await service.getAllHeadUnits();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            role: { name: ROLE_NAMES.HEAD_UNIT },
          },
        }),
      );
      expect(result).toEqual(['head-1', 'head-2']);
    });

    it('returns empty array when no HEAD_UNIT users exist', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      const result = await service.getAllHeadUnits();
      expect(result).toEqual([]);
    });
  });
});
