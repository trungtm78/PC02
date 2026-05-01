/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * DevicesService Unit Tests
 *
 * register:
 *   - calls prisma.userDevice.upsert with correct create/update data
 *   - returns the upserted device record
 *
 * unregister:
 *   - calls prisma.userDevice.deleteMany with fcmToken + userId filter
 *   - returns the deleteMany result
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  userDevice: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'device-1',
    userId: 'user-1',
    fcmToken: 'token-abc123',
    platform: 'android',
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('DevicesService', () => {
  let service: DevicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
    jest.clearAllMocks();
  });

  // ── register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    it('calls prisma.userDevice.upsert with correct create and update payloads', async () => {
      const device = makeDevice();
      mockPrisma.userDevice.upsert.mockResolvedValue(device);

      await service.register('user-1', 'token-abc123', 'android');

      expect(mockPrisma.userDevice.upsert).toHaveBeenCalledWith({
        where: { fcmToken: 'token-abc123' },
        create: { userId: 'user-1', fcmToken: 'token-abc123', platform: 'android' },
        update: { userId: 'user-1', platform: 'android' },
      });
    });

    it('returns the upserted device record from Prisma', async () => {
      const device = makeDevice({ platform: 'ios' });
      mockPrisma.userDevice.upsert.mockResolvedValue(device);

      const result = await service.register('user-1', 'token-abc123', 'ios');

      expect(result).toBe(device);
    });

    it('re-assigns an existing token to a different user on update', async () => {
      const device = makeDevice({ userId: 'user-2' });
      mockPrisma.userDevice.upsert.mockResolvedValue(device);

      await service.register('user-2', 'token-abc123', 'android');

      const call = mockPrisma.userDevice.upsert.mock.calls[0][0];
      expect(call.update.userId).toBe('user-2');
    });
  });

  // ── unregister ─────────────────────────────────────────────────────────────

  describe('unregister', () => {
    it('calls prisma.userDevice.deleteMany with fcmToken and userId filter', async () => {
      mockPrisma.userDevice.deleteMany.mockResolvedValue({ count: 1 });

      await service.unregister('token-abc123', 'user-1');

      expect(mockPrisma.userDevice.deleteMany).toHaveBeenCalledWith({
        where: { fcmToken: 'token-abc123', userId: 'user-1' },
      });
    });

    it('returns the deleteMany result from Prisma', async () => {
      mockPrisma.userDevice.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.unregister('token-abc123', 'user-1');

      expect(result).toEqual({ count: 1 });
    });

    it('returns count: 0 when token does not exist for the user', async () => {
      mockPrisma.userDevice.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.unregister('token-nonexistent', 'user-1');

      expect(result).toEqual({ count: 0 });
    });
  });
});
