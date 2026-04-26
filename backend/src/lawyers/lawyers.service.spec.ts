/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * lawyers.service.spec.ts
 * TASK-2026-261225 — Unit tests for LawyersService
 * Target: ≥85% statement/branch coverage
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { LawyersService } from './lawyers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  lawyer: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  case: {
    findFirst: jest.fn(),
  },
  subject: {
    findFirst: jest.fn(),
  },
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FAKE_CASE = { id: 'case-001', name: 'Vụ án A', deletedAt: null };
const FAKE_SUBJECT = {
  id: 'sub-001',
  fullName: 'Nguyễn Văn A',
  type: 'SUSPECT',
  caseId: 'case-001',
  deletedAt: null,
};

const FAKE_LAWYER = {
  id: 'law-001',
  fullName: 'Luật sư Trần Văn B',
  barNumber: 'LS-HCM-0042',
  lawFirm: 'Văn phòng Luật sư ABC',
  phone: '0901234567',
  caseId: 'case-001',
  subjectId: 'sub-001',
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  case: FAKE_CASE,
  subject: FAKE_SUBJECT,
};

const BASE_CREATE_DTO = {
  fullName: 'Luật sư Trần Văn B',
  barNumber: 'LS-HCM-0042',
  lawFirm: 'Văn phòng Luật sư ABC',
  phone: '0901234567',
  caseId: 'case-001',
  subjectId: 'sub-001',
};

const ACTOR_ID = 'user-admin-001';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LawyersService', () => {
  let service: LawyersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LawyersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<LawyersService>(LawyersService);
    jest.clearAllMocks();
  });

  // ── getList ─────────────────────────────────────────────────────────────────

  describe('getList', () => {
    it('returns paginated list with default params', async () => {
      mockPrisma.lawyer.findMany.mockResolvedValue([FAKE_LAWYER]);
      mockPrisma.lawyer.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(result.data).toEqual([FAKE_LAWYER]);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(mockPrisma.lawyer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          take: 20,
          skip: 0,
        }),
      );
    });

    it('applies search filter across fullName, barNumber, lawFirm, phone', async () => {
      mockPrisma.lawyer.findMany.mockResolvedValue([]);
      mockPrisma.lawyer.count.mockResolvedValue(0);

      await service.getList({ search: 'Trần' });

      expect(mockPrisma.lawyer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { fullName: { contains: 'Trần', mode: 'insensitive' } },
              { barNumber: { contains: 'Trần', mode: 'insensitive' } },
              { lawFirm: { contains: 'Trần', mode: 'insensitive' } },
              { phone: { contains: 'Trần', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('filters by caseId', async () => {
      mockPrisma.lawyer.findMany.mockResolvedValue([]);
      mockPrisma.lawyer.count.mockResolvedValue(0);

      await service.getList({ caseId: 'case-001' });

      expect(mockPrisma.lawyer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ caseId: 'case-001' }),
        }),
      );
    });

    it('filters by subjectId', async () => {
      mockPrisma.lawyer.findMany.mockResolvedValue([]);
      mockPrisma.lawyer.count.mockResolvedValue(0);

      await service.getList({ subjectId: 'sub-001' });

      expect(mockPrisma.lawyer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ subjectId: 'sub-001' }),
        }),
      );
    });

    it('uses safe sortBy fallback for unknown field', async () => {
      mockPrisma.lawyer.findMany.mockResolvedValue([]);
      mockPrisma.lawyer.count.mockResolvedValue(0);

      await service.getList({ sortBy: 'maliciousField' });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const callArg = mockPrisma.lawyer.findMany.mock.calls[0][0] as {
        orderBy: Record<string, string>;
      };
      expect(callArg.orderBy).toMatchObject({ createdAt: expect.any(String) });
    });

    it('uses allowed sortBy field when valid (fullName)', async () => {
      mockPrisma.lawyer.findMany.mockResolvedValue([]);
      mockPrisma.lawyer.count.mockResolvedValue(0);

      await service.getList({ sortBy: 'fullName', sortOrder: 'asc' });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const callArg = mockPrisma.lawyer.findMany.mock.calls[0][0] as {
        orderBy: Record<string, string>;
      };
      expect(callArg.orderBy).toMatchObject({ fullName: 'asc' });
    });

    it('applies pagination correctly with offset', async () => {
      mockPrisma.lawyer.findMany.mockResolvedValue([]);
      mockPrisma.lawyer.count.mockResolvedValue(50);

      const result = await service.getList({ limit: 10, offset: 20 });

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
      expect(mockPrisma.lawyer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
    });

    it('returns empty list when no lawyers exist', async () => {
      mockPrisma.lawyer.findMany.mockResolvedValue([]);
      mockPrisma.lawyer.count.mockResolvedValue(0);

      const result = await service.getList({});

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ── getById ─────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns lawyer when found', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(FAKE_LAWYER);

      const result = await service.getById('law-001');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(FAKE_LAWYER);
      expect(mockPrisma.lawyer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'law-001', deletedAt: null } }),
      );
    });

    it('throws NotFoundException when lawyer not found', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when linked case is out of scope', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue({
        ...FAKE_LAWYER,
        case: { assignedTeamId: 'team-X', investigatorId: 'user-X' },
      });
      const scope = { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] };
      await expect(service.getById('law-001', scope)).rejects.toThrow('Bạn không có quyền truy cập bản ghi này');
    });

    it('passes scope check when investigatorId matches', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue({
        ...FAKE_LAWYER,
        case: { assignedTeamId: null, investigatorId: 'u1' },
      });
      const scope = { userIds: ['u1'], teamIds: [], writableTeamIds: [] };
      const result = await service.getById('law-001', scope);
      expect(result.success).toBe(true);
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates lawyer successfully with all fields', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(null); // no dup barNumber
      mockPrisma.case.findFirst.mockResolvedValue(FAKE_CASE); // case exists
      mockPrisma.subject.findFirst.mockResolvedValue(FAKE_SUBJECT); // subject in case
      mockPrisma.lawyer.create.mockResolvedValue(FAKE_LAWYER);

      const result = await service.create(BASE_CREATE_DTO, ACTOR_ID);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(FAKE_LAWYER);
      expect(result.message).toContain('thành công');
      expect(mockPrisma.lawyer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fullName: BASE_CREATE_DTO.fullName,
            barNumber: BASE_CREATE_DTO.barNumber,
            caseId: BASE_CREATE_DTO.caseId,
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LAWYER_CREATED' }),
      );
    });

    it('creates lawyer without subjectId (subjectId nullable, EC-01)', async () => {
      const dto = { ...BASE_CREATE_DTO, subjectId: undefined };
      mockPrisma.lawyer.findFirst.mockResolvedValue(null); // no dup
      mockPrisma.case.findFirst.mockResolvedValue(FAKE_CASE); // case exists
      mockPrisma.lawyer.create.mockResolvedValue({
        ...FAKE_LAWYER,
        subjectId: null,
      });

      const result = await service.create(dto, ACTOR_ID);

      expect(result.success).toBe(true);
      // subject.findFirst should NOT be called when subjectId is undefined
      expect(mockPrisma.subject.findFirst).not.toHaveBeenCalled();
    });

    it('throws ConflictException on duplicate barNumber', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(FAKE_LAWYER); // duplicate found

      await expect(service.create(BASE_CREATE_DTO, ACTOR_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.lawyer.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when caseId does not exist', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(null); // no dup
      mockPrisma.case.findFirst.mockResolvedValue(null); // case not found

      await expect(service.create(BASE_CREATE_DTO, ACTOR_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when subjectId not in case', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(null); // no dup
      mockPrisma.case.findFirst.mockResolvedValue(FAKE_CASE); // case exists
      mockPrisma.subject.findFirst.mockResolvedValue(null); // subject not in case

      await expect(service.create(BASE_CREATE_DTO, ACTOR_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('passes ipAddress and userAgent to audit.log', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(null);
      mockPrisma.case.findFirst.mockResolvedValue(FAKE_CASE);
      mockPrisma.subject.findFirst.mockResolvedValue(FAKE_SUBJECT);
      mockPrisma.lawyer.create.mockResolvedValue(FAKE_LAWYER);

      await service.create(BASE_CREATE_DTO, ACTOR_ID, {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      );
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates lawyer fields successfully', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(FAKE_LAWYER); // existing found
      mockPrisma.lawyer.update.mockResolvedValue({
        ...FAKE_LAWYER,
        fullName: 'Luật sư Mới',
      });

      const result = await service.update(
        'law-001',
        { fullName: 'Luật sư Mới' },
        ACTOR_ID,
      );

      expect(result.success).toBe(true);
      expect(result.data.fullName).toBe('Luật sư Mới');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LAWYER_UPDATED' }),
      );
    });

    it('throws NotFoundException when lawyer not found on update', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { fullName: 'X' }, ACTOR_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when updating to existing barNumber', async () => {
      // First call: existing lawyer found; second call: duplicate barNumber found
      mockPrisma.lawyer.findFirst
        .mockResolvedValueOnce(FAKE_LAWYER) // existing record
        .mockResolvedValueOnce({ ...FAKE_LAWYER, id: 'law-999' }); // dup barNumber

      await expect(
        service.update('law-001', { barNumber: 'LS-HCM-9999' }, ACTOR_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('does NOT check barNumber conflict when barNumber unchanged', async () => {
      // dto.barNumber === existing.barNumber → service skips the dup check branch
      mockPrisma.lawyer.findFirst.mockResolvedValue(FAKE_LAWYER);
      mockPrisma.lawyer.update.mockResolvedValue(FAKE_LAWYER);

      await service.update(
        'law-001',
        { barNumber: FAKE_LAWYER.barNumber },
        ACTOR_ID,
      );

      // Only 1 findFirst call — for the "does this id exist" check; dup check is skipped
      expect(mockPrisma.lawyer.findFirst).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when new caseId does not exist', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(FAKE_LAWYER); // existing found
      mockPrisma.case.findFirst.mockResolvedValue(null); // case not found

      await expect(
        service.update('law-001', { caseId: 'case-bad' }, ACTOR_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates subjectId against targetCaseId on update', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(FAKE_LAWYER); // existing
      mockPrisma.case.findFirst.mockResolvedValue(FAKE_CASE); // new case exists
      mockPrisma.subject.findFirst.mockResolvedValue(null); // subject not in case

      await expect(
        service.update(
          'law-001',
          { caseId: 'case-001', subjectId: 'sub-bad' },
          ACTOR_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not validate subjectId when not in dto', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(FAKE_LAWYER);
      mockPrisma.lawyer.update.mockResolvedValue(FAKE_LAWYER);

      await service.update('law-001', { lawFirm: 'New Firm' }, ACTOR_ID);

      // subject.findFirst should not be called
      expect(mockPrisma.subject.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft-deletes lawyer successfully', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(FAKE_LAWYER);
      mockPrisma.lawyer.update.mockResolvedValue({
        ...FAKE_LAWYER,
        deletedAt: new Date(),
      });

      const result = await service.delete('law-001', ACTOR_ID);

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
      expect(mockPrisma.lawyer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'law-001' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LAWYER_DELETED',
          metadata: expect.objectContaining({ softDelete: true }),
        }),
      );
    });

    it('throws NotFoundException when lawyer not found on delete', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(null);

      await expect(service.delete('nonexistent', ACTOR_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.lawyer.update).not.toHaveBeenCalled();
    });

    it('passes ipAddress and userAgent to audit.log on delete', async () => {
      mockPrisma.lawyer.findFirst.mockResolvedValue(FAKE_LAWYER);
      mockPrisma.lawyer.update.mockResolvedValue(FAKE_LAWYER);

      await service.delete('law-001', ACTOR_ID, {
        ipAddress: '10.0.0.1',
        userAgent: 'Playwright',
      });

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '10.0.0.1',
          userAgent: 'Playwright',
        }),
      );
    });
  });

  // ── EC-01: One lawyer defends multiple suspects ──────────────────────────────

  describe('EC-01: one lawyer defends multiple suspects', () => {
    it('allows creating multiple lawyer records for same caseId with different subjectIds', async () => {
      // First assignment
      mockPrisma.lawyer.findFirst.mockResolvedValue(null); // no dup barNumber
      mockPrisma.case.findFirst.mockResolvedValue(FAKE_CASE);
      mockPrisma.subject.findFirst.mockResolvedValue({
        ...FAKE_SUBJECT,
        id: 'sub-001',
      });
      mockPrisma.lawyer.create.mockResolvedValue({
        ...FAKE_LAWYER,
        barNumber: 'LS-001',
        subjectId: 'sub-001',
      });

      const r1 = await service.create(
        { ...BASE_CREATE_DTO, barNumber: 'LS-001', subjectId: 'sub-001' },
        ACTOR_ID,
      );
      expect(r1.success).toBe(true);

      jest.clearAllMocks();

      // Second assignment — different barNumber, different subjectId, same caseId
      mockPrisma.lawyer.findFirst.mockResolvedValue(null); // no dup barNumber for 'LS-002'
      mockPrisma.case.findFirst.mockResolvedValue(FAKE_CASE);
      mockPrisma.subject.findFirst.mockResolvedValue({
        ...FAKE_SUBJECT,
        id: 'sub-002',
      });
      mockPrisma.lawyer.create.mockResolvedValue({
        ...FAKE_LAWYER,
        barNumber: 'LS-002',
        subjectId: 'sub-002',
      });

      const r2 = await service.create(
        { ...BASE_CREATE_DTO, barNumber: 'LS-002', subjectId: 'sub-002' },
        ACTOR_ID,
      );
      expect(r2.success).toBe(true);
    });
  });
});
