import { Test } from '@nestjs/testing';
import { ConclusionsService } from './conclusions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrisma = { conclusion: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() } };
const mockAudit = { log: jest.fn() };

const FAKE_CONCLUSION = { id: 'con-001', caseId: 'case-001', content: 'Test', status: 'DRAFT', deletedAt: null, case: { assignedTeamId: 't1', investigatorId: 'u1' } };

describe('ConclusionsService — scope enforcement', () => {
  let service: ConclusionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ConclusionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(ConclusionsService);
    jest.clearAllMocks();
  });

  it('returns conclusion when found (no scope)', async () => {
    mockPrisma.conclusion.findFirst.mockResolvedValue(FAKE_CONCLUSION);
    const result = await service.getById('con-001');
    expect(result.success).toBe(true);
  });

  it('throws NotFoundException when not found', async () => {
    mockPrisma.conclusion.findFirst.mockResolvedValue(null);
    await expect(service.getById('nope')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when parent case is out of scope', async () => {
    mockPrisma.conclusion.findFirst.mockResolvedValue({ ...FAKE_CONCLUSION, case: { assignedTeamId: 'team-X', investigatorId: 'user-X' } });
    await expect(service.getById('con-001', { userIds: ['u1'], teamIds: ['t1'] })).rejects.toThrow(ForbiddenException);
  });

  it('passes when parent case team matches scope', async () => {
    mockPrisma.conclusion.findFirst.mockResolvedValue(FAKE_CONCLUSION);
    const result = await service.getById('con-001', { userIds: [], teamIds: ['t1'] });
    expect(result.success).toBe(true);
  });

  it('passes with null scope (admin bypass)', async () => {
    mockPrisma.conclusion.findFirst.mockResolvedValue({ ...FAKE_CONCLUSION, case: { assignedTeamId: 'team-X', investigatorId: 'user-X' } });
    const result = await service.getById('con-001', null);
    expect(result.success).toBe(true);
  });
});
