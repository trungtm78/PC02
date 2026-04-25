import { Test } from '@nestjs/testing';
import { InvestigationSupplementsService } from './investigation-supplements.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrisma = { investigationSupplement: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), create: jest.fn() } };
const mockAudit = { log: jest.fn() };

const FAKE_SUPPLEMENT = {
  id: 'is-001', caseId: 'case-001', type: 'TYPE_A',
  createdBy: { id: 'u1', firstName: 'A', lastName: 'B', username: 'ab' },
  case: { id: 'case-001', name: 'Case', status: 'ACTIVE', assignedTeamId: 't1', investigatorId: 'u1' },
};

describe('InvestigationSupplementsService — scope enforcement', () => {
  let service: InvestigationSupplementsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvestigationSupplementsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(InvestigationSupplementsService);
    jest.clearAllMocks();
  });

  it('returns supplement when found (no scope)', async () => {
    mockPrisma.investigationSupplement.findUnique.mockResolvedValue(FAKE_SUPPLEMENT);
    const result = await service.getById('is-001');
    expect(result.success).toBe(true);
  });

  it('throws NotFoundException when not found', async () => {
    mockPrisma.investigationSupplement.findUnique.mockResolvedValue(null);
    await expect(service.getById('nope')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when parent case is out of scope', async () => {
    mockPrisma.investigationSupplement.findUnique.mockResolvedValue({ ...FAKE_SUPPLEMENT, case: { ...FAKE_SUPPLEMENT.case, assignedTeamId: 'team-X', investigatorId: 'user-X' } });
    await expect(service.getById('is-001', { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] })).rejects.toThrow(ForbiddenException);
  });

  it('passes when parent case teamId matches scope', async () => {
    mockPrisma.investigationSupplement.findUnique.mockResolvedValue(FAKE_SUPPLEMENT);
    const result = await service.getById('is-001', { userIds: [], teamIds: ['t1'], writableTeamIds: ['t1'] });
    expect(result.success).toBe(true);
  });

  it('passes with null scope (admin bypass)', async () => {
    mockPrisma.investigationSupplement.findUnique.mockResolvedValue({ ...FAKE_SUPPLEMENT, case: { ...FAKE_SUPPLEMENT.case, assignedTeamId: 'team-X' } });
    const result = await service.getById('is-001', null);
    expect(result.success).toBe(true);
  });
});
