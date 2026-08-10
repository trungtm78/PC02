import { Test } from '@nestjs/testing';
import { ConclusionsService } from './conclusions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

const mockPrisma = {
  conclusion: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  case: { findFirst: jest.fn() },
};
const mockAudit = { log: jest.fn() };

const FAKE_CONCLUSION = {
  id: 'con-001',
  caseId: 'case-001',
  content: 'Test',
  status: 'DRAFT',
  deletedAt: null,
  case: { assignedTeamId: 't1', investigatorId: 'u1' },
};

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
    mockPrisma.conclusion.findFirst.mockResolvedValue({
      ...FAKE_CONCLUSION,
      case: { assignedTeamId: 'team-X', investigatorId: 'user-X' },
    });
    await expect(
      service.getById('con-001', {
        userIds: ['u1'],
        teamIds: ['t1'],
        writableTeamIds: ['t1'],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('passes when parent case team matches scope', async () => {
    mockPrisma.conclusion.findFirst.mockResolvedValue(FAKE_CONCLUSION);
    const result = await service.getById('con-001', {
      userIds: [],
      teamIds: ['t1'],
      writableTeamIds: ['t1'],
    });
    expect(result.success).toBe(true);
  });

  it('passes with null scope (admin bypass)', async () => {
    mockPrisma.conclusion.findFirst.mockResolvedValue({
      ...FAKE_CONCLUSION,
      case: { assignedTeamId: 'team-X', investigatorId: 'user-X' },
    });
    const result = await service.getById('con-001', null);
    expect(result.success).toBe(true);
  });
});

/**
 * `create()` wrote `caseId` straight into the insert: no existence check and
 * no scope check. A conclusion — the investigation’s closing document — could therefore be filed against any case in the
 * system by anyone allowed to create one anywhere.
 */
describe('ConclusionsService — create scope', () => {
  let service: ConclusionsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConclusionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = moduleRef.get(ConclusionsService);
    jest.clearAllMocks();
  });

  it('rejects a case id that does not exist with 400, not a foreign-key 500', async () => {
    mockPrisma.case.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        { caseId: 'case-001', type: 'KET_LUAN', content: 'x' } as never,
        'actor-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.conclusion.create).not.toHaveBeenCalled();
  });

  it('refuses to attach to another team’s case', async () => {
    mockPrisma.case.findFirst.mockResolvedValue({
      id: 'case-001',
      assignedTeamId: 'team-B',
      investigatorId: 'inv-B',
    });

    await expect(
      service.create(
        { caseId: 'case-001', type: 'KET_LUAN', content: 'x' } as never,
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
    expect(mockPrisma.conclusion.create).not.toHaveBeenCalled();
  });
});
