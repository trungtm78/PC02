import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DelegationsService } from './delegations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

const mockPrisma = {
  delegation: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  case: { findFirst: jest.fn() },
  documentNumberLog: { update: jest.fn() },
  user: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};
const mockAudit = { log: jest.fn() };
const mockDocNums = {
  commitWithTx: jest.fn().mockResolvedValue({
    number: 'UT/2026/0001',
    logId: 'log-del-001',
    changed: false,
  }),
  commit: jest.fn().mockResolvedValue({
    number: 'UT/2026/0001',
    logId: 'log-del-001',
    changed: false,
  }),
  updateLogDocumentId: jest.fn().mockResolvedValue(undefined),
};
const mockEventEmitter = { emit: jest.fn() };

const FAKE_DELEGATION_WITH_CASE = {
  id: 'del-001',
  createdById: 'u1',
  status: 'PENDING',
  deletedAt: null,
  createdBy: { id: 'u1', firstName: 'A', lastName: 'B' },
  relatedCase: {
    id: 'case-001',
    name: 'Case',
    assignedTeamId: 't1',
    investigatorId: 'u1',
  },
};
const FAKE_DELEGATION_ORPHAN = {
  id: 'del-002',
  createdById: 'u1',
  status: 'PENDING',
  deletedAt: null,
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
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();
    service = module.get(DelegationsService);
    jest.clearAllMocks();
    mockAudit.log.mockResolvedValue(undefined);
    mockPrisma.user.findUnique.mockResolvedValue({
      firstName: 'Trung',
      lastName: 'Nguyen',
    });
  });

  it('auto-generates delegationNumber via commitWithTx when none provided', async () => {
    const fakeRecord = {
      id: 'del-new',
      delegationNumber: 'UT/2026/0001',
      createdBy: {},
      relatedCase: null,
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) =>
      fn(mockPrisma),
    );
    mockPrisma.documentNumberLog.update.mockResolvedValue({});
    mockPrisma.delegation.create.mockResolvedValue(fakeRecord);

    const result = await service.create(
      { receivingUnit: 'X', content: 'test' } as any,
      'u1',
    );

    expect(mockDocNums.commitWithTx).toHaveBeenCalledWith(
      'DELEGATION',
      { userId: 'u1' },
      mockPrisma,
    );
    expect(result.data.delegationNumber).toBe('UT/2026/0001');
    expect(result.success).toBe(true);
  });

  it('persists assignedToId in delegation.create data when provided (C3 fix)', async () => {
    const fakeRecord = {
      id: 'del-assigned',
      delegationNumber: 'UT/2026/0002',
      assignedToId: 'user-assignee',
      createdBy: {},
      relatedCase: null,
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) =>
      fn(mockPrisma),
    );
    mockPrisma.documentNumberLog.update.mockResolvedValue({});
    mockPrisma.delegation.create.mockResolvedValue(fakeRecord);

    await service.create(
      {
        receivingUnit: 'X',
        content: 'test',
        assignedToId: 'user-assignee',
      } as any,
      'u1',
    );

    const createCall = mockPrisma.delegation.create.mock.calls[0][0];
    expect(createCall.data).toHaveProperty('assignedToId', 'user-assignee');
  });

  it('emits utdt.assigned event on create when assignedToId is provided (W3 fix)', async () => {
    const fakeRecord = {
      id: 'del-evt',
      delegationNumber: 'UT/2026/0003',
      assignedToId: 'user-b',
      createdBy: {},
      relatedCase: null,
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) =>
      fn(mockPrisma),
    );
    mockPrisma.documentNumberLog.update.mockResolvedValue({});
    mockPrisma.delegation.create.mockResolvedValue(fakeRecord);

    await service.create(
      { receivingUnit: 'X', content: 'test', assignedToId: 'user-b' } as any,
      'u1',
    );

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'utdt.assigned',
      expect.objectContaining({ toUserId: 'user-b', delegationId: 'del-evt' }),
    );
  });

  it('does NOT emit utdt.assigned when assignedToId is not provided', async () => {
    const fakeRecord = {
      id: 'del-no-assign',
      delegationNumber: 'UT/2026/0004',
      createdBy: {},
      relatedCase: null,
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) =>
      fn(mockPrisma),
    );
    mockPrisma.documentNumberLog.update.mockResolvedValue({});
    mockPrisma.delegation.create.mockResolvedValue(fakeRecord);

    await service.create({ receivingUnit: 'X', content: 'test' } as any, 'u1');

    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('uses provided delegationNumber and skips commitWithTx (C3 fix — manual number branch)', async () => {
    const fakeRecord = {
      id: 'del-manual',
      delegationNumber: 'UT-MANUAL-001',
      assignedToId: 'user-b',
      createdBy: {},
      relatedCase: null,
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) =>
      fn(mockPrisma),
    );
    mockPrisma.delegation.create.mockResolvedValue(fakeRecord);

    const result = await service.create(
      {
        delegationNumber: 'UT-MANUAL-001',
        receivingUnit: 'X',
        content: 'test',
        assignedToId: 'user-b',
      } as any,
      'u1',
    );

    expect(mockDocNums.commitWithTx).not.toHaveBeenCalled();
    expect(result.data.delegationNumber).toBe('UT-MANUAL-001');
    const createCall = mockPrisma.delegation.create.mock.calls[0][0];
    expect(createCall.data).toHaveProperty('assignedToId', 'user-b');
  });

  it('rolls back counter when delegation.create throws inside transaction', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: any) =>
      fn(mockPrisma),
    );
    mockPrisma.delegation.create.mockRejectedValue(new Error('DB error'));

    await expect(
      service.create({ receivingUnit: 'X', content: 'test' } as any, 'u1'),
    ).rejects.toThrow('DB error');
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
        { provide: EventEmitter2, useValue: mockEventEmitter },
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
      mockPrisma.delegation.findFirst.mockResolvedValue(
        FAKE_DELEGATION_WITH_CASE,
      );
      const result = await service.getById('del-001', {
        userIds: [],
        teamIds: ['t1'],
        writableTeamIds: ['t1'],
      });
      expect(result.success).toBe(true);
    });

    it('throws ForbiddenException when relatedCase is out of scope', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue({
        ...FAKE_DELEGATION_WITH_CASE,
        relatedCase: {
          ...FAKE_DELEGATION_WITH_CASE.relatedCase,
          assignedTeamId: 'team-X',
          investigatorId: 'user-X',
        },
      });
      await expect(
        service.getById('del-001', {
          userIds: ['u1'],
          teamIds: ['t1'],
          writableTeamIds: ['t1'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('orphan delegation (no case)', () => {
    it('passes when createdById matches scope userIds', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue(FAKE_DELEGATION_ORPHAN);
      const result = await service.getById('del-002', {
        userIds: ['u1'],
        teamIds: [],
        writableTeamIds: [],
      });
      expect(result.success).toBe(true);
    });

    it('throws ForbiddenException when createdById not in scope userIds', async () => {
      mockPrisma.delegation.findFirst.mockResolvedValue({
        ...FAKE_DELEGATION_ORPHAN,
        createdById: 'other',
      });
      await expect(
        service.getById('del-002', {
          userIds: ['u1'],
          teamIds: [],
          writableTeamIds: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  it('passes with null scope (admin bypass) regardless of content', async () => {
    mockPrisma.delegation.findFirst.mockResolvedValue({
      ...FAKE_DELEGATION_WITH_CASE,
      relatedCase: { assignedTeamId: 'team-X', investigatorId: 'user-X' },
    });
    const result = await service.getById('del-001', null);
    expect(result.success).toBe(true);
  });
});

/**
 * `create()` wrote `relatedCaseId` straight into the insert: no existence check
 * and no scope check. A delegation of investigation could be filed against any case in the system.
 * It is optional, so the check applies only when a case is actually named.
 */
describe('DelegationsService — create scope', () => {
  let service: DelegationsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DelegationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: DocumentNumbersService, useValue: mockDocNums },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();
    service = moduleRef.get(DelegationsService);
    jest.clearAllMocks();
  });

  it('rejects a relatedCaseId that does not exist with 400, not a foreign-key 500', async () => {
    mockPrisma.case.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        { relatedCaseId: 'case-001', content: 'x' } as never,
        'actor-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses to attach to another team’s case', async () => {
    mockPrisma.case.findFirst.mockResolvedValue({
      id: 'case-001',
      assignedTeamId: 'team-B',
      investigatorId: 'inv-B',
    });

    await expect(
      service.create(
        { relatedCaseId: 'case-001', content: 'x' } as never,
        'actor-1',
        undefined,
        {
          teamIds: ['team-A'],
          writableTeamIds: ['team-A'],
          userIds: ['inv-A'],
          writableUserIds: ['inv-A'],
        } as never,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not look up a case when relatedCaseId is omitted', async () => {
    mockPrisma.case.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockResolvedValue({
      id: 'x',
      delegationNumber: 'N-1',
    });

    await service.create({ content: 'x' } as never, 'actor-1');

    expect(mockPrisma.case.findFirst).not.toHaveBeenCalled();
  });
});
