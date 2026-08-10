import { Test } from '@nestjs/testing';
import { InvestigationSupplementsService } from './investigation-supplements.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

const mockPrisma = {
  investigationSupplement: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  case: { findFirst: jest.fn() },
};
const mockAudit = { log: jest.fn() };

const FAKE_SUPPLEMENT = {
  id: 'is-001',
  caseId: 'case-001',
  type: 'TYPE_A',
  createdBy: { id: 'u1', firstName: 'A', lastName: 'B', username: 'ab' },
  case: {
    id: 'case-001',
    name: 'Case',
    status: 'ACTIVE',
    assignedTeamId: 't1',
    investigatorId: 'u1',
  },
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
    mockPrisma.investigationSupplement.findUnique.mockResolvedValue(
      FAKE_SUPPLEMENT,
    );
    const result = await service.getById('is-001');
    expect(result.success).toBe(true);
  });

  it('throws NotFoundException when not found', async () => {
    mockPrisma.investigationSupplement.findUnique.mockResolvedValue(null);
    await expect(service.getById('nope')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when parent case is out of scope', async () => {
    mockPrisma.investigationSupplement.findUnique.mockResolvedValue({
      ...FAKE_SUPPLEMENT,
      case: {
        ...FAKE_SUPPLEMENT.case,
        assignedTeamId: 'team-X',
        investigatorId: 'user-X',
      },
    });
    await expect(
      service.getById('is-001', {
        userIds: ['u1'],
        teamIds: ['t1'],
        writableTeamIds: ['t1'],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('passes when parent case teamId matches scope', async () => {
    mockPrisma.investigationSupplement.findUnique.mockResolvedValue(
      FAKE_SUPPLEMENT,
    );
    const result = await service.getById('is-001', {
      userIds: [],
      teamIds: ['t1'],
      writableTeamIds: ['t1'],
    });
    expect(result.success).toBe(true);
  });

  it('passes with null scope (admin bypass)', async () => {
    mockPrisma.investigationSupplement.findUnique.mockResolvedValue({
      ...FAKE_SUPPLEMENT,
      case: { ...FAKE_SUPPLEMENT.case, assignedTeamId: 'team-X' },
    });
    const result = await service.getById('is-001', null);
    expect(result.success).toBe(true);
  });
});

/**
 * `create()` had two holes, both invisible from the outside.
 *
 * It never checked that `caseId` referred to a real case, so a bad id came back
 * as a raw foreign-key error and a 500 instead of a 400. And it never took a
 * scope at all, so a supplementary-investigation decision — a procedural
 * document that carries a deadline — could be filed against any case in the
 * system by anyone allowed to create one anywhere.
 */
describe('InvestigationSupplementsService — create', () => {
  let service: InvestigationSupplementsService;

  const dto = { caseId: 'case-001', type: 'TYPE_A', decisionNumber: 'QD-01' };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        InvestigationSupplementsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = moduleRef.get(InvestigationSupplementsService);
    jest.clearAllMocks();
  });

  it('rejects a caseId that does not exist with 400, not a foreign-key 500', async () => {
    mockPrisma.case.findFirst.mockResolvedValue(null);

    await expect(service.create(dto as never, 'actor-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.investigationSupplement.create).not.toHaveBeenCalled();
  });

  it('refuses to file a decision against another team’s case', async () => {
    mockPrisma.case.findFirst.mockResolvedValue({
      id: 'case-001',
      assignedTeamId: 'team-B',
      investigatorId: 'inv-B',
    });

    await expect(
      service.create(dto as never, 'actor-1', undefined, {
        teamIds: ['team-A'],
        writableTeamIds: ['team-A'],
        userIds: ['inv-A'],
      } as never),
    ).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.investigationSupplement.create).not.toHaveBeenCalled();
  });

  it('creates when the case is inside the caller’s writable team', async () => {
    mockPrisma.case.findFirst.mockResolvedValue({
      id: 'case-001',
      assignedTeamId: 'team-A',
      investigatorId: 'inv-A',
    });
    mockPrisma.investigationSupplement.create.mockResolvedValue(
      FAKE_SUPPLEMENT,
    );

    const result = await service.create(dto as never, 'actor-1', undefined, {
      teamIds: ['team-A'],
      writableTeamIds: ['team-A'],
      userIds: ['inv-A'],
    } as never);

    expect(result.success).toBe(true);
    expect(mockPrisma.investigationSupplement.create).toHaveBeenCalledTimes(1);
  });
});
