import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { UserShortcutsService } from './user-shortcuts.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  userShortcut: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

function makeP2002Error(): Prisma.PrismaClientKnownRequestError {
  // Construct a minimal error object that passes the instanceof check.
  const err = Object.create(Prisma.PrismaClientKnownRequestError.prototype);
  err.code = 'P2002';
  err.message = 'Unique constraint failed';
  err.clientVersion = 'test';
  err.meta = { target: ['userId', 'binding'] };
  return err as Prisma.PrismaClientKnownRequestError;
}

describe('UserShortcutsService', () => {
  let service: UserShortcutsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserShortcutsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<UserShortcutsService>(UserShortcutsService);
  });

  // ─── list ────────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns shortcuts for given userId', async () => {
      const rows = [{ id: '1', userId: 'u1', action: 'save', binding: 'Ctrl+Shift+S' }];
      mockPrisma.userShortcut.findMany.mockResolvedValue(rows);
      const result = await service.list('u1');
      expect(result).toEqual(rows);
      expect(mockPrisma.userShortcut.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { action: 'asc' },
      });
    });

    it('returns empty array when no overrides', async () => {
      mockPrisma.userShortcut.findMany.mockResolvedValue([]);
      expect(await service.list('u1')).toEqual([]);
    });
  });

  // ─── upsert ──────────────────────────────────────────────────────────────────

  describe('upsert()', () => {
    it('creates/updates a binding for valid input', async () => {
      const row = { id: '1', userId: 'u1', action: 'save', binding: 'Ctrl+Shift+S' };
      mockPrisma.userShortcut.upsert.mockResolvedValue(row);
      const result = await service.upsert('u1', 'save', { binding: 'Ctrl+Shift+S' });
      expect(result).toEqual(row);
      expect(mockPrisma.userShortcut.upsert).toHaveBeenCalledWith({
        where: { userId_action: { userId: 'u1', action: 'save' } },
        create: { userId: 'u1', action: 'save', binding: 'Ctrl+Shift+S' },
        update: { binding: 'Ctrl+Shift+S' },
      });
    });

    it('rejects invalid action format', async () => {
      await expect(service.upsert('u1', '../admin', { binding: 'Ctrl+S' }))
        .rejects.toThrow(BadRequestException);
      expect(mockPrisma.userShortcut.upsert).not.toHaveBeenCalled();
    });

    it('rejects invalid binding format', async () => {
      await expect(service.upsert('u1', 'save', { binding: 'NotAKey' }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when binding already used by another action (P2002 race)', async () => {
      mockPrisma.userShortcut.upsert.mockRejectedValue(makeP2002Error());
      mockPrisma.userShortcut.findFirst.mockResolvedValue({
        id: '2', userId: 'u1', action: 'search', binding: 'Ctrl+K',
      });
      await expect(service.upsert('u1', 'save', { binding: 'Ctrl+K' }))
        .rejects.toThrow(ConflictException);
    });

    it('passes through non-P2002 Prisma errors', async () => {
      const otherErr = new Error('boom');
      mockPrisma.userShortcut.upsert.mockRejectedValue(otherErr);
      await expect(service.upsert('u1', 'save', { binding: 'Ctrl+Shift+S' }))
        .rejects.toThrow('boom');
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deletes existing override', async () => {
      mockPrisma.userShortcut.findUnique.mockResolvedValue({
        id: '1', userId: 'u1', action: 'save', binding: 'Ctrl+Shift+S',
      });
      mockPrisma.userShortcut.delete.mockResolvedValue({});
      await service.remove('u1', 'save');
      expect(mockPrisma.userShortcut.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException when no override exists (UI uses 404 = at default)', async () => {
      mockPrisma.userShortcut.findUnique.mockResolvedValue(null);
      await expect(service.remove('u1', 'save')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.userShortcut.delete).not.toHaveBeenCalled();
    });

    it('rejects invalid action format', async () => {
      await expect(service.remove('u1', '../bad')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── resetAll ────────────────────────────────────────────────────────────────

  describe('resetAll()', () => {
    it('deletes all rows for given userId only', async () => {
      mockPrisma.userShortcut.deleteMany.mockResolvedValue({ count: 5 });
      const result = await service.resetAll('u1');
      expect(result).toEqual({ deleted: 5 });
      expect(mockPrisma.userShortcut.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
    });

    it('returns 0 when user has no overrides', async () => {
      mockPrisma.userShortcut.deleteMany.mockResolvedValue({ count: 0 });
      expect(await service.resetAll('u1')).toEqual({ deleted: 0 });
    });
  });

  // ─── swap ────────────────────────────────────────────────────────────────────

  describe('swap()', () => {
    it('atomically swaps bindings between two actions', async () => {
      const fromRow = { id: '1', userId: 'u1', action: 'save', binding: 'Ctrl+Shift+S' };
      const toRow = { id: '2', userId: 'u1', action: 'search', binding: 'Ctrl+K' };
      const tx = {
        userShortcut: {
          findUnique: jest.fn()
            .mockResolvedValueOnce(fromRow)
            .mockResolvedValueOnce(toRow),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx));

      const result = await service.swap('u1', { fromAction: 'save', toAction: 'search' });

      expect(result.from).toEqual({ action: 'save', binding: 'Ctrl+K' });
      expect(result.to).toEqual({ action: 'search', binding: 'Ctrl+Shift+S' });
      expect(tx.userShortcut.update).toHaveBeenCalledTimes(3); // park + 2 swaps
    });

    it('throws NotFoundException when one side has no override', async () => {
      const tx = {
        userShortcut: {
          findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({}),
        },
      };
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx));
      await expect(
        service.swap('u1', { fromAction: 'save', toAction: 'search' })
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects swap with same action on both sides', async () => {
      await expect(
        service.swap('u1', { fromAction: 'save', toAction: 'save' })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid action format', async () => {
      await expect(
        service.swap('u1', { fromAction: '../bad', toAction: 'save' })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
