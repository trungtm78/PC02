import { Test } from '@nestjs/testing';
import { ExchangesService } from './exchanges.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrisma = { exchange: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() }, exchangeMessage: { findMany: jest.fn(), create: jest.fn() } };
const mockAudit = { log: jest.fn() };

const FAKE_EXCHANGE = { id: 'ex-001', title: 'Test', createdById: 'u1', status: 'OPEN', deletedAt: null, createdBy: { id: 'u1', firstName: 'A', lastName: 'B' } };

describe('ExchangesService — scope enforcement', () => {
  let service: ExchangesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ExchangesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(ExchangesService);
    jest.clearAllMocks();
  });

  it('returns exchange when found (no scope)', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue(FAKE_EXCHANGE);
    const result = await service.getById('ex-001');
    expect(result.success).toBe(true);
  });

  it('throws NotFoundException when not found', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue(null);
    await expect(service.getById('nope')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when createdById is not in scope userIds', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue({ ...FAKE_EXCHANGE, createdById: 'other-user' });
    await expect(service.getById('ex-001', { userIds: ['u1'], teamIds: [] })).rejects.toThrow(ForbiddenException);
  });

  it('passes when createdById matches scope userIds', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue(FAKE_EXCHANGE);
    const result = await service.getById('ex-001', { userIds: ['u1'], teamIds: [] });
    expect(result.success).toBe(true);
  });

  it('passes with null scope (admin bypass)', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue({ ...FAKE_EXCHANGE, createdById: 'other-user' });
    const result = await service.getById('ex-001', null);
    expect(result.success).toBe(true);
  });

  it('throws ForbiddenException for deny-all scope {userIds:[], teamIds:[]}', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue({ ...FAKE_EXCHANGE, createdById: 'user-X' });
    await expect(service.getById('ex-001', { userIds: [], teamIds: [] })).rejects.toThrow(ForbiddenException);
  });

  it('passes for team-leader scope {userIds:[], teamIds:[...]} (creator-anchored resource)', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue({ ...FAKE_EXCHANGE, createdById: 'any-user' });
    const result = await service.getById('ex-001', { userIds: [], teamIds: ['t1'] });
    expect(result.success).toBe(true);
  });
});
