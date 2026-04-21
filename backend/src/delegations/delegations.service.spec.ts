import { Test } from '@nestjs/testing';
import { DelegationsService } from './delegations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrisma = { delegation: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() } };
const mockAudit = { log: jest.fn() };

const FAKE_DELEGATION_WITH_CASE = {
  id: 'del-001', createdById: 'u1', status: 'PENDING', deletedAt: null,
  createdBy: { id: 'u1', firstName: 'A', lastName: 'B' },
  relatedCase: { id: 'case-001', name: 'Case', assignedTeamId: 't1', investigatorId: 'u1' },
};
const FAKE_DELEGATION_ORPHAN = {
  id: 'del-002', createdById: 'u1', status: 'PENDING', deletedAt: null,
  createdBy: { id: 'u1', firstName: 'A', lastName: 'B' },
  relatedCase: null,
};

describe('DelegationsService — scope enforcement (dual-path logic)', () => {
  let service: DelegationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DelegationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(DelegationsService);
    jest.clearAllMocks();
  });

  it('throws NotFoundException when not found', async () => {
    mockPrisma.delegation.findFirst.mockResolvedValue(null);
    await expect(service.getById('nope')).rejects.toThrow(NotFoundException);
  });

  describe('case-linked delegation', () => {
    it('passes when relatedCase is in scope (teamId match)', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue(FAKE_DELEGATION_WITH_CASE);
      const result = await service.getById('del-001', { userIds: [], teamIds: ['t1'] });
      expect(result.success).toBe(true);
    });

    it('throws ForbiddenException when relatedCase is out of scope', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue({ ...FAKE_DELEGATION_WITH_CASE, relatedCase: { ...FAKE_DELEGATION_WITH_CASE.relatedCase, assignedTeamId: 'team-X', investigatorId: 'user-X' } });
      await expect(service.getById('del-001', { userIds: ['u1'], teamIds: ['t1'] })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('orphan delegation (no case)', () => {
    it('passes when createdById matches scope userIds', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue(FAKE_DELEGATION_ORPHAN);
      const result = await service.getById('del-002', { userIds: ['u1'], teamIds: [] });
      expect(result.success).toBe(true);
    });

    it('throws ForbiddenException when createdById not in scope userIds', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue({ ...FAKE_DELEGATION_ORPHAN, createdById: 'other' });
      await expect(service.getById('del-002', { userIds: ['u1'], teamIds: [] })).rejects.toThrow(ForbiddenException);
    });
  });

  it('passes with null scope (admin bypass) regardless of content', async () => {
    mockPrisma.delegation.findFirst.mockResolvedValue({ ...FAKE_DELEGATION_WITH_CASE, relatedCase: { assignedTeamId: 'team-X', investigatorId: 'user-X' } });
    const result = await service.getById('del-001', null);
    expect(result.success).toBe(true);
  });
});
