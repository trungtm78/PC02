import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AbbreviationsService } from './abbreviations.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  userAbbreviation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AbbreviationsService', () => {
  let service: AbbreviationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbbreviationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AbbreviationsService>(AbbreviationsService);
  });

  // ─── list ────────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns abbreviations for the given userId', async () => {
      const rows = [{ id: '1', userId: 'u1', shortcut: 'lvs', expansion: 'Lê Văn Sỹ' }];
      mockPrisma.userAbbreviation.findMany.mockResolvedValue(rows);
      const result = await service.list('u1');
      expect(result).toEqual(rows);
      expect(mockPrisma.userAbbreviation.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { shortcut: 'asc' },
      });
    });

    it('returns empty array when user has no abbreviations', async () => {
      mockPrisma.userAbbreviation.findMany.mockResolvedValue([]);
      const result = await service.list('u2');
      expect(result).toEqual([]);
    });
  });

  // ─── upsert ──────────────────────────────────────────────────────────────────

  describe('upsert()', () => {
    it('creates a new abbreviation', async () => {
      const created = { id: '1', userId: 'u1', shortcut: 'lvs', expansion: 'Lê Văn Sỹ' };
      mockPrisma.userAbbreviation.upsert.mockResolvedValue(created);
      const result = await service.upsert('u1', 'lvs', {
        shortcut: 'lvs',
        expansion: 'Lê Văn Sỹ',
      });
      expect(result).toEqual(created);
    });

    it('updates expansion when shortcut already exists', async () => {
      const updated = { id: '1', userId: 'u1', shortcut: 'lvs', expansion: 'Lê Văn Sinh' };
      mockPrisma.userAbbreviation.upsert.mockResolvedValue(updated);
      const result = await service.upsert('u1', 'lvs', {
        shortcut: 'lvs',
        expansion: 'Lê Văn Sinh',
      });
      expect(result.expansion).toBe('Lê Văn Sinh');
    });

    it('throws BadRequestException for invalid shortcut chars', async () => {
      await expect(
        service.upsert('u1', 'lê văn', { shortcut: 'lê văn', expansion: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for shortcut exceeding 20 chars', async () => {
      await expect(
        service.upsert('u1', 'a'.repeat(21), { shortcut: 'a'.repeat(21), expansion: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deletes an existing abbreviation', async () => {
      const row = { id: '1', userId: 'u1', shortcut: 'lvs', expansion: 'Lê Văn Sỹ' };
      mockPrisma.userAbbreviation.findUnique.mockResolvedValue(row);
      mockPrisma.userAbbreviation.delete.mockResolvedValue(row);
      const result = await service.remove('u1', 'lvs');
      expect(result).toEqual(row);
    });

    it('throws NotFoundException when shortcut does not exist', async () => {
      mockPrisma.userAbbreviation.findUnique.mockResolvedValue(null);
      await expect(service.remove('u1', 'xxx')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── copyFrom ────────────────────────────────────────────────────────────────

  describe('copyFrom()', () => {
    it('throws ConflictException when copying from self', async () => {
      await expect(
        service.copyFrom('u1', { sourceUserId: 'u1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when source user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.copyFrom('u1', { sourceUserId: 'u2' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when source user is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isActive: false });
      await expect(
        service.copyFrom('u1', { sourceUserId: 'u2' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('merge mode does not delete existing abbreviations', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isActive: true });
      mockPrisma.userAbbreviation.findMany.mockResolvedValue([
        { shortcut: 'lvs', expansion: 'Lê Văn Sỹ' },
      ]);
      mockPrisma.userAbbreviation.createMany.mockResolvedValue({ count: 1 });

      await service.copyFrom('u1', { sourceUserId: 'u2', replace: false });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.userAbbreviation.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.userAbbreviation.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'u1', shortcut: 'lvs', expansion: 'Lê Văn Sỹ' }],
        skipDuplicates: true,
      });
    });

    it('replace mode uses $transaction to atomically delete then insert', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isActive: true });
      mockPrisma.userAbbreviation.findMany.mockResolvedValue([
        { shortcut: 'abc', expansion: 'Nguyễn Văn A' },
      ]);
      // deleteMany and createMany are passed as Prisma promises inside the transaction array
      mockPrisma.userAbbreviation.deleteMany.mockReturnValue(Promise.resolve({ count: 1 }));
      mockPrisma.userAbbreviation.createMany.mockReturnValue(Promise.resolve({ count: 1 }));
      mockPrisma.$transaction.mockResolvedValue([{ count: 1 }, { count: 1 }]);

      await service.copyFrom('u1', { sourceUserId: 'u2', replace: true });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const [args] = mockPrisma.$transaction.mock.calls[0];
      expect(Array.isArray(args)).toBe(true);
      expect(args).toHaveLength(2);
    });

    it('returns correct copied count', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isActive: true });
      mockPrisma.userAbbreviation.findMany.mockResolvedValue([
        { shortcut: 'a', expansion: 'A' },
        { shortcut: 'b', expansion: 'B' },
      ]);
      mockPrisma.userAbbreviation.createMany.mockResolvedValue({ count: 2 });

      const result = await service.copyFrom('u1', { sourceUserId: 'u2' });
      expect(result.copied).toBe(2);
    });

    it('returns copied: 0 when source user has no abbreviations', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isActive: true });
      mockPrisma.userAbbreviation.findMany.mockResolvedValue([]);
      mockPrisma.userAbbreviation.createMany.mockResolvedValue({ count: 0 });

      const result = await service.copyFrom('u1', { sourceUserId: 'u2' });
      expect(result.copied).toBe(0);
    });
  });
});
