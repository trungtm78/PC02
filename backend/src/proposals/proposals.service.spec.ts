import { Test } from '@nestjs/testing';
import { ProposalsService } from './proposals.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrisma = { proposal: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() } };
const mockAudit = { log: jest.fn() };

const FAKE_PROPOSAL_WITH_CASE = {
  id: 'prop-001', createdById: 'u1', status: 'CHO_GUI', deletedAt: null,
  createdBy: { id: 'u1', firstName: 'A', lastName: 'B', username: 'ab' },
  relatedCase: { id: 'case-001', name: 'Case', assignedTeamId: 't1', investigatorId: 'u1' },
};
const FAKE_PROPOSAL_ORPHAN = {
  id: 'prop-002', createdById: 'u1', status: 'CHO_GUI', deletedAt: null,
  createdBy: { id: 'u1', firstName: 'A', lastName: 'B', username: 'ab' },
  relatedCase: null,
};

describe('ProposalsService — scope enforcement (dual-path logic)', () => {
  let service: ProposalsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProposalsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(ProposalsService);
    jest.clearAllMocks();
  });

  it('throws NotFoundException when not found', async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue(null);
    await expect(service.getById('nope')).rejects.toThrow(NotFoundException);
  });

  describe('case-linked proposal', () => {
    it('passes when relatedCase is in scope (teamId match)', async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(FAKE_PROPOSAL_WITH_CASE);
      const result = await service.getById('prop-001', { userIds: [], teamIds: ['t1'] });
      expect(result.success).toBe(true);
    });

    it('throws ForbiddenException when relatedCase is out of scope', async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue({ ...FAKE_PROPOSAL_WITH_CASE, relatedCase: { ...FAKE_PROPOSAL_WITH_CASE.relatedCase, assignedTeamId: 'team-X', investigatorId: 'user-X' } });
      await expect(service.getById('prop-001', { userIds: ['u1'], teamIds: ['t1'] })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('orphan proposal (no case)', () => {
    it('passes when createdById matches scope userIds', async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(FAKE_PROPOSAL_ORPHAN);
      const result = await service.getById('prop-002', { userIds: ['u1'], teamIds: [] });
      expect(result.success).toBe(true);
    });

    it('throws ForbiddenException when createdById not in scope userIds', async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue({ ...FAKE_PROPOSAL_ORPHAN, createdById: 'other' });
      await expect(service.getById('prop-002', { userIds: ['u1'], teamIds: [] })).rejects.toThrow(ForbiddenException);
    });
  });

  it('passes with null scope (admin bypass)', async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue({ ...FAKE_PROPOSAL_WITH_CASE, relatedCase: { ...FAKE_PROPOSAL_WITH_CASE.relatedCase, assignedTeamId: 'team-X', investigatorId: 'user-X' } });
    const result = await service.getById('prop-001', null);
    expect(result.success).toBe(true);
  });
});
