import { Test, TestingModule } from '@nestjs/testing';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  userDevice: {
    findMany: jest.fn(),
    delete: jest.fn(),
  },
};

const mockPayload = { title: 'Test', body: 'Test body' };

// Silence logger in tests
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('PushService', () => {
  let service: PushService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<PushService>(PushService);
    // Ensure auth is null so we test the no-credentials path without real FCM
    (service as any).auth = null;
  });

  it('sends to all user devices (calls fcmSend for each)', async () => {
    mockPrisma.userDevice.findMany.mockResolvedValue([
      { id: 'd1', fcmToken: 'token-1', platform: 'android' },
      { id: 'd2', fcmToken: 'token-2', platform: 'ios' },
    ]);
    const fcmSendSpy = jest.spyOn(service as any, 'fcmSend');
    await service.sendToUser('u1', mockPayload);
    expect(fcmSendSpy).toHaveBeenCalledTimes(2);
  });

  it('returns gracefully when user has no devices', async () => {
    mockPrisma.userDevice.findMany.mockResolvedValue([]);
    await expect(service.sendToUser('u1', mockPayload)).resolves.toBeUndefined();
  });

  it('logs warning and skips when GOOGLE_APPLICATION_CREDENTIALS not set', async () => {
    mockPrisma.userDevice.findMany.mockResolvedValue([
      { id: 'd1', fcmToken: 'token-1', platform: 'android' },
    ]);
    const warnSpy = jest.spyOn((service as any).logger, 'warn');
    await service.sendToUser('u1', mockPayload);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('FCM not configured'));
  });

  it('continues to other devices when one throws', async () => {
    mockPrisma.userDevice.findMany.mockResolvedValue([
      { id: 'd1', fcmToken: 'token-bad', platform: 'android' },
      { id: 'd2', fcmToken: 'token-good', platform: 'android' },
    ]);
    const fcmSendSpy = jest
      .spyOn(service as any, 'fcmSend')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(undefined);

    await expect(service.sendToUser('u1', mockPayload)).resolves.toBeUndefined();
    expect(fcmSendSpy).toHaveBeenCalledTimes(2);
  });

  it('deletes stale token when FCM returns UNREGISTERED status', async () => {
    // Simulate a configured auth that returns a stale token error
    (service as any).auth = {};
    const mockClient = { getAccessToken: jest.fn().mockResolvedValue({ token: 'access-token' }) };
    jest.spyOn(service as any, 'fcmSend').mockImplementation(async (deviceId: string) => {
      if (deviceId === 'd1') {
        await mockPrisma.userDevice.delete({ where: { id: 'd1' } });
      }
    });
    mockPrisma.userDevice.findMany.mockResolvedValue([
      { id: 'd1', fcmToken: 'stale-token', platform: 'android' },
    ]);
    await service.sendToUser('u1', mockPayload);
    expect(mockPrisma.userDevice.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
  });
});
