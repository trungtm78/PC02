/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SubjectStatus } from '@prisma/client';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  subject: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  case: {
    findFirst: jest.fn(),
  },
  directory: {
    findFirst: jest.fn(),
  },
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const FAKE_SUBJECT = {
  id: 'sub-001',
  fullName: 'Nguyễn Văn A',
  dateOfBirth: new Date('1990-01-15'),
  gender: 'MALE',
  idNumber: '012345678901',
  address: 'Số 1 Nguyễn Huệ, Quận 1, TP.HCM',
  phone: '0912345678',
  occupationId: null,
  nationalityId: null,
  districtId: null,
  wardId: null,
  caseId: 'case-001',
  crimeId: 'crime-001',
  status: SubjectStatus.INVESTIGATING,
  notes: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  case: { id: 'case-001', name: 'Vụ án A', status: 'DANG_DIEU_TRA' },
};

const FAKE_CASE = { id: 'case-001', name: 'Vụ án A', deletedAt: null };
const FAKE_CRIME = { id: 'crime-001', type: 'CRIME', name: 'Trộm cắp', isActive: true };

const BASE_CREATE_DTO = {
  fullName: 'Nguyễn Văn A',
  dateOfBirth: '1990-01-15',
  gender: 'MALE' as const,
  idNumber: '012345678901',
  address: 'Số 1 Nguyễn Huệ, Quận 1, TP.HCM',
  caseId: 'case-001',
  crimeId: 'crime-001',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SubjectsService', () => {
  let service: SubjectsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<SubjectsService>(SubjectsService);
    jest.clearAllMocks();
  });

  // ── getList ───────────────────────────────────────────────────────────────

  describe('getList', () => {
    it('returns paginated subjects with default params', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([FAKE_SUBJECT]);
      mockPrisma.subject.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([FAKE_SUBJECT]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(mockPrisma.subject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          take: 20,
          skip: 0,
        }),
      );
    });

    it('applies search filter across fullName, idNumber, address, phone', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([]);
      mockPrisma.subject.count.mockResolvedValue(0);

      await service.getList({ search: 'Nguyễn' });

      expect(mockPrisma.subject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { fullName: { contains: 'Nguyễn', mode: 'insensitive' } },
              { idNumber: { contains: 'Nguyễn', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('EC-01: Vietnamese name fuzzy search — applies insensitive mode', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([]);
      mockPrisma.subject.count.mockResolvedValue(0);

      await service.getList({ search: 'Trần Thị Bình' });

      const callArg = mockPrisma.subject.findMany.mock.calls[0][0];
      expect(callArg.where.OR[0]).toMatchObject({
        fullName: { mode: 'insensitive' },
      });
    });

    it('filters by status', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([]);
      mockPrisma.subject.count.mockResolvedValue(0);

      await service.getList({ status: SubjectStatus.DETAINED });

      expect(mockPrisma.subject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: SubjectStatus.DETAINED }),
        }),
      );
    });

    it('filters by caseId', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([]);
      mockPrisma.subject.count.mockResolvedValue(0);

      await service.getList({ caseId: 'case-xyz' });

      expect(mockPrisma.subject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ caseId: 'case-xyz' }),
        }),
      );
    });

    it('filters by districtId and wardId', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([]);
      mockPrisma.subject.count.mockResolvedValue(0);

      await service.getList({ districtId: 'd-01', wardId: 'w-01' });

      expect(mockPrisma.subject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ districtId: 'd-01', wardId: 'w-01' }),
        }),
      );
    });

    it('applies fromDate and toDate filters', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([]);
      mockPrisma.subject.count.mockResolvedValue(0);

      await service.getList({ fromDate: '2026-01-01', toDate: '2026-12-31' });

      const callArg = mockPrisma.subject.findMany.mock.calls[0][0];
      expect(callArg.where.createdAt).toMatchObject({
        gte: expect.any(Date),
        lte: expect.any(Date),
      });
    });

    it('uses safe sortBy fallback for unknown field', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([]);
      mockPrisma.subject.count.mockResolvedValue(0);

      await service.getList({ sortBy: 'injectedField' });

      const callArg = mockPrisma.subject.findMany.mock.calls[0][0];
      expect(callArg.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('calculates page number correctly from offset', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([]);
      mockPrisma.subject.count.mockResolvedValue(100);

      const result = await service.getList({ limit: 20, offset: 40 });

      expect(result.page).toBe(3);
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns subject when found', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue(FAKE_SUBJECT);

      const result = await service.getById('sub-001');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(FAKE_SUBJECT);
      expect(mockPrisma.subject.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-001', deletedAt: null },
        }),
      );
    });

    it('throws NotFoundException when subject not found', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException with subject id in message', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue(null);

      await expect(service.getById('bad-id')).rejects.toThrow(
        /bad-id/,
      );
    });

    it('throws ForbiddenException when parent case is out of scope', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue({
        ...FAKE_SUBJECT,
        case: { assignedTeamId: 'team-X', investigatorId: 'user-X' },
      });
      const scope = { userIds: ['u1'], teamIds: ['t1'] };
      await expect(service.getById('sub-001', scope)).rejects.toThrow('Bạn không có quyền truy cập bản ghi này');
    });

    it('passes scope check when parent case team matches', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue({
        ...FAKE_SUBJECT,
        case: { assignedTeamId: 't1', investigatorId: null },
      });
      const scope = { userIds: [], teamIds: ['t1'] };
      const result = await service.getById('sub-001', scope);
      expect(result.success).toBe(true);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    beforeEach(() => {
      mockPrisma.subject.findFirst.mockResolvedValue(null); // no duplicate
      mockPrisma.case.findFirst.mockResolvedValue(FAKE_CASE);
      mockPrisma.directory.findFirst.mockResolvedValue(FAKE_CRIME);
      mockPrisma.subject.create.mockResolvedValue(FAKE_SUBJECT);
    });

    it('creates subject successfully', async () => {
      const result = await service.create(BASE_CREATE_DTO, 'actor-1');

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
      expect(result.data).toEqual(FAKE_SUBJECT);
      expect(mockPrisma.subject.create).toHaveBeenCalledTimes(1);
    });

    it('logs SUBJECT_CREATED audit event', async () => {
      await service.create(BASE_CREATE_DTO, 'actor-1', {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SUBJECT_CREATED',
          subject: 'Subject',
          userId: 'actor-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        }),
      );
    });

    it('EC-04: throws ConflictException on duplicate idNumber', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue(FAKE_SUBJECT); // dup found

      await expect(
        service.create(BASE_CREATE_DTO, 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('EC-04: ConflictException message contains idNumber', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue(FAKE_SUBJECT);

      await expect(
        service.create({ ...BASE_CREATE_DTO, idNumber: '012345678901' }, 'actor-1'),
      ).rejects.toThrow(/012345678901/);
    });

    it('throws BadRequestException when case does not exist', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(null);

      await expect(
        service.create(BASE_CREATE_DTO, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('EC-03: allows linking to case with any non-deleted status', async () => {
      mockPrisma.case.findFirst.mockResolvedValue({
        ...FAKE_CASE,
        status: 'TAM_DINH_CHI', // suspended/archived case
      });

      const result = await service.create(BASE_CREATE_DTO, 'actor-1');
      expect(result.success).toBe(true);
    });

    it('throws BadRequestException when crime directory not found', async () => {
      mockPrisma.directory.findFirst.mockResolvedValue(null);

      await expect(
        service.create(BASE_CREATE_DTO, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults status to INVESTIGATING when not provided', async () => {
      await service.create(BASE_CREATE_DTO, 'actor-1');

      expect(mockPrisma.subject.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SubjectStatus.INVESTIGATING,
          }),
        }),
      );
    });

    it('uses provided status when given', async () => {
      await service.create(
        { ...BASE_CREATE_DTO, status: SubjectStatus.WANTED },
        'actor-1',
      );

      expect(mockPrisma.subject.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: SubjectStatus.WANTED }),
        }),
      );
    });

    it('defaults gender to MALE when not provided', async () => {
      const dto = { ...BASE_CREATE_DTO };
      delete (dto as Partial<typeof dto>).gender;

      await service.create(dto as typeof BASE_CREATE_DTO, 'actor-1');

      expect(mockPrisma.subject.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gender: 'MALE' }),
        }),
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    beforeEach(() => {
      mockPrisma.subject.findFirst.mockResolvedValue(FAKE_SUBJECT); // found self
      mockPrisma.case.findFirst.mockResolvedValue(FAKE_CASE);
      mockPrisma.directory.findFirst.mockResolvedValue(FAKE_CRIME);
      mockPrisma.subject.update.mockResolvedValue({
        ...FAKE_SUBJECT,
        fullName: 'Tên mới',
      });
    });

    it('updates subject successfully', async () => {
      const result = await service.update(
        'sub-001',
        { fullName: 'Tên mới' },
        'actor-1',
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
      expect(mockPrisma.subject.update).toHaveBeenCalledTimes(1);
    });

    it('logs SUBJECT_UPDATED audit event', async () => {
      await service.update('sub-001', { fullName: 'Tên mới' }, 'actor-1', {
        ipAddress: '10.0.0.1',
        userAgent: 'jest',
      });

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SUBJECT_UPDATED',
          subject: 'Subject',
          subjectId: 'sub-001',
          userId: 'actor-1',
        }),
      );
    });

    it('throws NotFoundException when subject not found', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { fullName: 'X' }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('EC-04: throws ConflictException on duplicate idNumber from another record', async () => {
      // First findFirst: returns current subject (different idNumber)
      // Second findFirst (dup check): returns another subject with same new idNumber
      mockPrisma.subject.findFirst
        .mockResolvedValueOnce({ ...FAKE_SUBJECT, idNumber: 'OLD_NUMBER' })
        .mockResolvedValueOnce({ id: 'other', idNumber: '999888777666' });

      await expect(
        service.update('sub-001', { idNumber: '999888777666' }, 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('allows same idNumber as own record (no conflict)', async () => {
      // dto.idNumber === existing.idNumber => skip dup check
      mockPrisma.subject.findFirst.mockResolvedValueOnce(FAKE_SUBJECT);

      const result = await service.update(
        'sub-001',
        { idNumber: FAKE_SUBJECT.idNumber },
        'actor-1',
      );

      expect(result.success).toBe(true);
      // dup check findFirst should NOT be called a second time
      expect(mockPrisma.subject.findFirst).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when new caseId does not exist', async () => {
      mockPrisma.case.findFirst.mockResolvedValue(null);

      await expect(
        service.update('sub-001', { caseId: 'bad-case' }, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when new crimeId does not exist', async () => {
      mockPrisma.directory.findFirst.mockResolvedValue(null);

      await expect(
        service.update('sub-001', { crimeId: 'bad-crime' }, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('only applies fields present in dto (partial update)', async () => {
      await service.update('sub-001', { notes: 'Ghi chú mới' }, 'actor-1');

      const callArg = mockPrisma.subject.update.mock.calls[0][0];
      expect(callArg.data).toHaveProperty('notes', 'Ghi chú mới');
      expect(callArg.data).not.toHaveProperty('fullName');
    });

    it('converts dateOfBirth string to Date object', async () => {
      await service.update(
        'sub-001',
        { dateOfBirth: '1995-06-15' },
        'actor-1',
      );

      const callArg = mockPrisma.subject.update.mock.calls[0][0];
      expect(callArg.data.dateOfBirth).toBeInstanceOf(Date);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    beforeEach(() => {
      mockPrisma.subject.findFirst.mockResolvedValue(FAKE_SUBJECT);
      mockPrisma.subject.update.mockResolvedValue({ ...FAKE_SUBJECT, deletedAt: new Date() });
    });

    it('soft-deletes subject (sets deletedAt, does not hard delete)', async () => {
      const result = await service.delete('sub-001', 'actor-1');

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');

      expect(mockPrisma.subject.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-001' },
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });

    it('logs SUBJECT_DELETED audit event', async () => {
      await service.delete('sub-001', 'actor-1', {
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
      });

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SUBJECT_DELETED',
          subject: 'Subject',
          subjectId: 'sub-001',
          userId: 'actor-1',
          metadata: expect.objectContaining({ softDelete: true }),
          ipAddress: '192.168.1.1',
        }),
      );
    });

    it('throws NotFoundException when subject not found', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'actor-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('includes fullName in audit metadata', async () => {
      await service.delete('sub-001', 'actor-1');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            fullName: FAKE_SUBJECT.fullName,
          }),
        }),
      );
    });
  });

  // ── TASK-2026-261225: SubjectType filter ────────────────────────────────────

  describe('getList — type filter (TASK-2026-261225)', () => {
    it('filters by type=SUSPECT', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([]);
      mockPrisma.subject.count.mockResolvedValue(0);

      await service.getList({ type: 'SUSPECT' as any });

      expect(mockPrisma.subject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'SUSPECT' }),
        }),
      );
    });

    it('filters by type=VICTIM', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([]);
      mockPrisma.subject.count.mockResolvedValue(0);

      await service.getList({ type: 'VICTIM' as any });

      expect(mockPrisma.subject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'VICTIM' }),
        }),
      );
    });

    it('filters by type=WITNESS', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([]);
      mockPrisma.subject.count.mockResolvedValue(0);

      await service.getList({ type: 'WITNESS' as any });

      expect(mockPrisma.subject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'WITNESS' }),
        }),
      );
    });

    it('does NOT add type filter when type is not provided', async () => {
      mockPrisma.subject.findMany.mockResolvedValue([]);
      mockPrisma.subject.count.mockResolvedValue(0);

      await service.getList({});

      const callArg = mockPrisma.subject.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(callArg.where).not.toHaveProperty('type');
    });
  });

  // ── TASK-2026-261225: EC-04 — duplicate CCCD across different types ─────────

  describe('create — EC-04 duplicate CCCD', () => {
    beforeEach(() => {
      mockPrisma.case.findFirst.mockResolvedValue(FAKE_CASE);
      mockPrisma.directory.findFirst.mockResolvedValue(FAKE_CRIME);
      mockPrisma.subject.create.mockResolvedValue(FAKE_SUBJECT);
    });

    it('EC-04: blocks duplicate idNumber+type (same CCCD, same type)', async () => {
      // findFirst returns existing record with same idNumber + type
      mockPrisma.subject.findFirst.mockResolvedValue({
        ...FAKE_SUBJECT,
        type: 'SUSPECT',
      });

      await expect(
        service.create({ ...BASE_CREATE_DTO, type: 'SUSPECT' as any }, 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('EC-04: allows same idNumber with different type (VICTIM vs SUSPECT)', async () => {
      // No duplicate for VICTIM+same idNumber
      mockPrisma.subject.findFirst.mockResolvedValue(null);

      const result = await service.create(
        { ...BASE_CREATE_DTO, idNumber: '012345678901', type: 'VICTIM' as any },
        'actor-1',
      );

      expect(result.success).toBe(true);
    });

    it('EC-04: stamps correct type on created record', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue(null);

      await service.create({ ...BASE_CREATE_DTO, type: 'VICTIM' as any }, 'actor-1');

      expect(mockPrisma.subject.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'VICTIM' }),
        }),
      );
    });

    it('EC-04: defaults type to SUSPECT when not provided', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue(null);

      await service.create(BASE_CREATE_DTO, 'actor-1');

      expect(mockPrisma.subject.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'SUSPECT' }),
        }),
      );
    });
  });

  // ── Edge cases — status transitions ───────────────────────────────────────

  describe('status transitions', () => {
    it('can update status to DETAINED', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue(FAKE_SUBJECT);
      mockPrisma.subject.update.mockResolvedValue({
        ...FAKE_SUBJECT,
        status: SubjectStatus.DETAINED,
      });

      const result = await service.update(
        'sub-001',
        { status: SubjectStatus.DETAINED },
        'actor-1',
      );

      expect(result.success).toBe(true);
    });

    it('can update status to WANTED', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue(FAKE_SUBJECT);
      mockPrisma.subject.update.mockResolvedValue({
        ...FAKE_SUBJECT,
        status: SubjectStatus.WANTED,
      });

      const result = await service.update(
        'sub-001',
        { status: SubjectStatus.WANTED },
        'actor-1',
      );

      expect(result.success).toBe(true);
    });

    it('can update status to RELEASED', async () => {
      mockPrisma.subject.findFirst.mockResolvedValue(FAKE_SUBJECT);
      mockPrisma.subject.update.mockResolvedValue({
        ...FAKE_SUBJECT,
        status: SubjectStatus.RELEASED,
      });

      const result = await service.update(
        'sub-001',
        { status: SubjectStatus.RELEASED },
        'actor-1',
      );

      expect(result.success).toBe(true);
    });
  });
});
