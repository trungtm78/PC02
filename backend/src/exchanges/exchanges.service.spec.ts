import { Test } from '@nestjs/testing';
import { ExchangesService } from './exchanges.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrisma = {
  exchange: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  exchangeMessage: { findMany: jest.fn(), create: jest.fn() },
};
const mockAudit = { log: jest.fn() };

const FAKE_EXCHANGE = {
  id: 'ex-001',
  title: 'Test',
  createdById: 'u1',
  status: 'OPEN',
  deletedAt: null,
  createdBy: { id: 'u1', firstName: 'A', lastName: 'B' },
};

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
    mockPrisma.exchange.findFirst.mockResolvedValue({
      ...FAKE_EXCHANGE,
      createdById: 'other-user',
    });
    await expect(
      service.getById('ex-001', {
        userIds: ['u1'],
        teamIds: [],
        writableTeamIds: [],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('passes when createdById matches scope userIds', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue(FAKE_EXCHANGE);
    const result = await service.getById('ex-001', {
      userIds: ['u1'],
      teamIds: [],
      writableTeamIds: [],
    });
    expect(result.success).toBe(true);
  });

  it('passes with null scope (admin bypass)', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue({
      ...FAKE_EXCHANGE,
      createdById: 'other-user',
    });
    const result = await service.getById('ex-001', null);
    expect(result.success).toBe(true);
  });

  it('throws ForbiddenException for deny-all scope {userIds:[], teamIds:[]}', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue({
      ...FAKE_EXCHANGE,
      createdById: 'user-X',
    });
    await expect(
      service.getById('ex-001', {
        userIds: [],
        teamIds: [],
        writableTeamIds: [],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('passes for team-leader scope {userIds:[], teamIds:[...]} (creator-anchored resource)', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue({
      ...FAKE_EXCHANGE,
      createdById: 'any-user',
    });
    const result = await service.getById('ex-001', {
      userIds: [],
      teamIds: ['t1'],
      writableTeamIds: ['t1'],
    });
    expect(result.success).toBe(true);
  });
});

/**
 * `POST /exchanges/:id/messages` checked only that the exchange existed, so
 * knowing an id was enough to post into somebody else's thread. Exchange has
 * no parent case — it is anchored to its creator — so the creator scope is
 * what applies.
 */
describe('ExchangesService — addMessage scope', () => {
  let service: ExchangesService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ExchangesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = moduleRef.get(ExchangesService);
    jest.clearAllMocks();
  });

  const dto = { exchangeId: 'ex-1', content: 'xin chào' };

  it('refuses to post into a thread the caller has no write scope over', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue({
      id: 'ex-1',
      createdById: 'someone-else',
    });

    await expect(
      service.addMessage(dto as never, 'actor-1', {
        teamIds: [],
        writableTeamIds: [],
        userIds: ['actor-1'],
        writableUserIds: ['actor-1'],
      } as never),
    ).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.exchangeMessage.create).not.toHaveBeenCalled();
  });

  it('lets the creator post into their own thread', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue({
      id: 'ex-1',
      createdById: 'actor-1',
    });
    mockPrisma.exchangeMessage.create.mockResolvedValue({ id: 'msg-1' });
    mockPrisma.exchange.update.mockResolvedValue({});

    const result = await service.addMessage(dto as never, 'actor-1', {
      teamIds: [],
      writableTeamIds: [],
      userIds: ['actor-1'],
      writableUserIds: ['actor-1'],
    } as never);

    expect(result.success).toBe(true);
  });

  it('still 404s when the exchange does not exist', async () => {
    mockPrisma.exchange.findFirst.mockResolvedValue(null);

    await expect(service.addMessage(dto as never, 'actor-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
