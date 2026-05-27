import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DelegationsService } from './delegations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrisma = {
  delegation: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
  documentNumberLog: { update: jest.fn() },
  $transaction: jest.fn(),
};
const mockAudit = { log: jest.fn() };
const mockDocNums = {
  commitWithTx: jest.fn().mockResolvedValue({ number: 'UT/2026/0001', logId: 'log-del-001', changed: false }),
  commit: jest.fn().mockResolvedValue({ number: 'UT/2026/0001', logId: 'log-del-001', changed: false }),
  updateLogDocumentId: jest.fn().mockResolvedValue(undefined),
};

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

describe('DelegationsService — create()', () => {
  let service: DelegationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DelegationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: DocumentNumbersService, useValue: mockDocNums },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(DelegationsService);
    jest.clearAllMocks();
    mockAudit.log.mockResolvedValue(undefined);
  });

  it('auto-generates delegationNumber via commitWithTx when none provided', async () => {
    const fakeRecord = { id: 'del-new', delegationNumber: 'UT/2026/0001', createdBy: {}, relatedCase: null };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.documentNumberLog.update.mockResolvedValue({});
    mockPrisma.delegation.create.mockResolvedValue(fakeRecord);

    const result = await service.create({ receivingUnit: 'X', content: 'test' } as any, 'u1');

    expect(mockDocNums.commitWithTx).toHaveBeenCalledWith('DELEGATION', { userId: 'u1' }, mockPrisma);
    expect(result.data.delegationNumber).toBe('UT/2026/0001');
    expect(result.success).toBe(true);
  });

  it('uses provided delegationNumber and skips commitWithTx', async () => {
    const fakeRecord = { id: 'del-manual', delegationNumber: 'UT-MANUAL-001', createdBy: {}, relatedCase: null };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.delegation.create.mockResolvedValue(fakeRecord);

    const result = await service.create({ delegationNumber: 'UT-MANUAL-001', receivingUnit: 'X', content: 'test' } as any, 'u1');

    expect(mockDocNums.commitWithTx).not.toHaveBeenCalled();
    expect(result.data.delegationNumber).toBe('UT-MANUAL-001');
  });

  it('rolls back counter when delegation.create throws inside transaction', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.delegation.create.mockRejectedValue(new Error('DB error'));

    await expect(service.create({ receivingUnit: 'X', content: 'test' } as any, 'u1')).rejects.toThrow('DB error');
    expect(mockPrisma.documentNumberLog.update).not.toHaveBeenCalled();
  });
});

describe('DelegationsService — scope enforcement (dual-path logic)', () => {
  let service: DelegationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DelegationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: DocumentNumbersService, useValue: mockDocNums },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
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
      const result = await service.getById('del-001', { userIds: [], teamIds: ['t1'], writableTeamIds: ['t1'] });
      expect(result.success).toBe(true);
    });

    it('throws ForbiddenException when relatedCase is out of scope', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue({ ...FAKE_DELEGATION_WITH_CASE, relatedCase: { ...FAKE_DELEGATION_WITH_CASE.relatedCase, assignedTeamId: 'team-X', investigatorId: 'user-X' } });
      await expect(service.getById('del-001', { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('orphan delegation (no case)', () => {
    it('passes when createdById matches scope userIds', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue(FAKE_DELEGATION_ORPHAN);
      const result = await service.getById('del-002', { userIds: ['u1'], teamIds: [], writableTeamIds: [] });
      expect(result.success).toBe(true);
    });

    it('throws ForbiddenException when createdById not in scope userIds', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue({ ...FAKE_DELEGATION_ORPHAN, createdById: 'other' });
      await expect(service.getById('del-002', { userIds: ['u1'], teamIds: [], writableTeamIds: [] })).rejects.toThrow(ForbiddenException);
    });
  });

  it('passes with null scope (admin bypass) regardless of content', async () => {
    mockPrisma.delegation.findFirst.mockResolvedValue({ ...FAKE_DELEGATION_WITH_CASE, relatedCase: { assignedTeamId: 'team-X', investigatorId: 'user-X' } });
    const result = await service.getById('del-001', null);
    expect(result.success).toBe(true);
  });
});
