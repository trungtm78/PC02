import { Test } from '@nestjs/testing';
import { GuidanceService } from './guidance.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrisma = { guidanceRecord: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() } };
const mockAudit = { log: jest.fn() };

const FAKE_GUIDANCE = { id: 'g-001', title: 'Test', createdById: 'u1', status: 'ACTIVE', deletedAt: null, createdBy: { id: 'u1', firstName: 'A', lastName: 'B' } };

describe('GuidanceService — scope enforcement', () => {
  let service: GuidanceService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GuidanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(GuidanceService);
    jest.clearAllMocks();
  });

  it('returns guidance when found (no scope)', async () => {
    mockPrisma.guidanceRecord.findFirst.mockResolvedValue(FAKE_GUIDANCE);
    const result = await service.getById('g-001');
    expect(result.success).toBe(true);
  });

  it('throws NotFoundException when not found', async () => {
    mockPrisma.guidanceRecord.findFirst.mockResolvedValue(null);
    await expect(service.getById('nope')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when createdById not in scope userIds', async () => {
    mockPrisma.guidanceRecord.findFirst.mockResolvedValue({ ...FAKE_GUIDANCE, createdById: 'other' });
    await expect(service.getById('g-001', { userIds: ['u1'], teamIds: [], writableTeamIds: [] })).rejects.toThrow(ForbiddenException);
  });

  it('passes when createdById matches scope userIds', async () => {
    mockPrisma.guidanceRecord.findFirst.mockResolvedValue(FAKE_GUIDANCE);
    const result = await service.getById('g-001', { userIds: ['u1'], teamIds: [], writableTeamIds: [] });
    expect(result.success).toBe(true);
  });

  it('passes with null scope (admin bypass)', async () => {
    mockPrisma.guidanceRecord.findFirst.mockResolvedValue({ ...FAKE_GUIDANCE, createdById: 'other' });
    const result = await service.getById('g-001', null);
    expect(result.success).toBe(true);
  });

  it('throws ForbiddenException for deny-all scope {userIds:[], teamIds:[]}', async () => {
    mockPrisma.guidanceRecord.findFirst.mockResolvedValue({ ...FAKE_GUIDANCE, createdById: 'user-X' });
    await expect(service.getById('g-001', { userIds: [], teamIds: [], writableTeamIds: [] })).rejects.toThrow(ForbiddenException);
  });

  it('passes for team-leader scope {userIds:[], teamIds:[...]} (creator-anchored resource)', async () => {
    mockPrisma.guidanceRecord.findFirst.mockResolvedValue({ ...FAKE_GUIDANCE, createdById: 'any-user' });
    const result = await service.getById('g-001', { userIds: [], teamIds: ['t1'], writableTeamIds: ['t1'] });
    expect(result.success).toBe(true);
  });
});
