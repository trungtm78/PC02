/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * PetitionsService Unit Tests
 * TASK-ID: TASK-2026-260202
 * Coverage target: >= 80%
 *
 * Tests cover:
 *   - getList: pagination, search, filters
 *   - getById: found / not found
 *   - create: success, future date validation, duplicate stt
 *   - update: success, not found, future date
 *   - delete: success, not found (soft delete)
 *   - convertToIncident: success, missing fields (EC-01), already converted
 *   - convertToCase: success, missing fields (EC-01), already converted (AC-03)
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PetitionsService } from './petitions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { PetitionStatus, LoaiDon } from '@prisma/client';

// CaseStatus values — only used in mock fixture objects (not DTO-typed)
const CaseStatus = { TIEP_NHAN: 'TIEP_NHAN' } as const;

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPetition = {
  id: 'petition-001',
  stt: 'DT-2026-00001',
  receivedDate: new Date('2026-02-01'),
  senderName: 'Trần Thị Test',
  unit: 'Công an Quận 1',
  status: PetitionStatus.MOI_TIEP_NHAN,
  linkedCaseId: null,
  linkedIncidentId: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockIncident = {
  id: 'incident-001',
  code: 'VV-2026-00001',
  name: 'Vụ việc test',
  incidentType: 'An ninh trật tự',
  status: 'TIEP_NHAN',
  sourcePetitionId: 'petition-001',
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCase = {
  id: 'case-001',
  name: 'Vụ án test',
  crime: 'Tham nhũng',
  unit: 'Công an cấp Quận/Huyện',
  status: CaseStatus.TIEP_NHAN,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  petition: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  incident: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  case: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },

  $transaction: jest.fn() as any,
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockSettings = {
  getNumericValue: jest.fn(),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('PetitionsService', () => {
  let service: PetitionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetitionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: SettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get<PetitionsService>(PetitionsService);
    jest.clearAllMocks();
  });

  // ── getList ────────────────────────────────────────────────────────────────

  describe('getList', () => {
    it('should return paginated list of petitions', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([mockPetition]);
      mockPrisma.petition.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by search query', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({ search: 'Test query' });

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
      expect(callArgs.where.OR.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({ status: PetitionStatus.DANG_XU_LY });

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe(PetitionStatus.DANG_XU_LY);
    });

    it('should always exclude soft-deleted records', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([]);
      mockPrisma.petition.count.mockResolvedValue(0);

      await service.getList({});

      const callArgs = mockPrisma.petition.findMany.mock.calls[0][0];
      expect(callArgs.where.deletedAt).toBeNull();
    });
  });

  // ── getById ────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return petition when found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      const result = await service.getById('petition-001');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('petition-001');
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto = {
      stt: 'DT-2026-00099',
      receivedDate: '2026-02-01',
      senderName: 'Nguyễn Văn Test',
    };

    it('should create petition successfully', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null); // stt not taken
      mockPrisma.petition.create.mockResolvedValue({
        ...mockPetition,
        ...validDto,
      });
      mockAudit.log.mockResolvedValue(undefined);

      const result = await service.create(validDto, 'user-001');

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
    });

    it('should throw BadRequestException for future receivedDate', async () => {
      const futureDto = {
        stt: 'DT-2099-00001',
        receivedDate: '2099-12-31',
        senderName: 'Test User',
      };

      await expect(service.create(futureDto, 'user-001')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException for duplicate stt', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(mockPetition); // stt already taken

      await expect(service.create(validDto, 'user-001')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if assignedToId not found', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { ...validDto, assignedToId: 'nonexistent-user' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('TO_CAO petitionType → reads THOI_HAN_TO_CAO setting, auto-deadline = receivedDate + 30 days', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.petition.create.mockResolvedValue({ ...mockPetition, receivedDate: new Date('2026-02-01') });
      mockSettings.getNumericValue.mockResolvedValue(30);

      await service.create({ ...validDto, petitionType: LoaiDon.TO_CAO }, 'user-001');

      expect(mockSettings.getNumericValue).toHaveBeenCalledWith('THOI_HAN_TO_CAO', 15);
      const callArgs = mockPrisma.petition.create.mock.calls[0][0];
      const expectedDeadline = new Date('2026-02-01');
      expectedDeadline.setDate(expectedDeadline.getDate() + 30);
      expect(callArgs.data.deadline).toEqual(expectedDeadline);
    });

    it('KHIEU_NAI petitionType → reads THOI_HAN_KHIEU_NAI setting, auto-deadline = receivedDate + 30 days', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.petition.create.mockResolvedValue(mockPetition);
      mockSettings.getNumericValue.mockResolvedValue(30);

      await service.create({ ...validDto, petitionType: LoaiDon.KHIEU_NAI }, 'user-001');

      expect(mockSettings.getNumericValue).toHaveBeenCalledWith('THOI_HAN_KHIEU_NAI', 15);
      const callArgs = mockPrisma.petition.create.mock.calls[0][0];
      const expectedDeadline = new Date('2026-02-01');
      expectedDeadline.setDate(expectedDeadline.getDate() + 30);
      expect(callArgs.data.deadline).toEqual(expectedDeadline);
    });

    it('KIEN_NGHI petitionType → reads THOI_HAN_KIEN_NGHI setting, auto-deadline = receivedDate + 15 days', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.petition.create.mockResolvedValue(mockPetition);
      mockSettings.getNumericValue.mockResolvedValue(15);

      await service.create({ ...validDto, petitionType: LoaiDon.KIEN_NGHI }, 'user-001');

      expect(mockSettings.getNumericValue).toHaveBeenCalledWith('THOI_HAN_KIEN_NGHI', 15);
      const callArgs = mockPrisma.petition.create.mock.calls[0][0];
      const expectedDeadline = new Date('2026-02-01');
      expectedDeadline.setDate(expectedDeadline.getDate() + 15);
      expect(callArgs.data.deadline).toEqual(expectedDeadline);
    });

    it('PHAN_ANH petitionType → reads THOI_HAN_PHAN_ANH setting, auto-deadline = receivedDate + 15 days', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.petition.create.mockResolvedValue(mockPetition);
      mockSettings.getNumericValue.mockResolvedValue(15);

      await service.create({ ...validDto, petitionType: LoaiDon.PHAN_ANH }, 'user-001');

      expect(mockSettings.getNumericValue).toHaveBeenCalledWith('THOI_HAN_PHAN_ANH', 15);
      const callArgs = mockPrisma.petition.create.mock.calls[0][0];
      const expectedDeadline = new Date('2026-02-01');
      expectedDeadline.setDate(expectedDeadline.getDate() + 15);
      expect(callArgs.data.deadline).toEqual(expectedDeadline);
    });

    it('explicit deadline overrides auto-deadline calculation', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.petition.create.mockResolvedValue(mockPetition);

      const explicitDeadline = '2026-06-30';
      await service.create(
        { ...validDto, petitionType: LoaiDon.TO_CAO, deadline: explicitDeadline },
        'user-001',
      );

      const callArgs = mockPrisma.petition.create.mock.calls[0][0];
      expect(callArgs.data.deadline).toEqual(new Date(explicitDeadline));
      expect(mockSettings.getNumericValue).not.toHaveBeenCalled();
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update petition successfully', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        senderName: 'Updated Name',
      });

      const result = await service.update(
        'petition-001',
        { senderName: 'Updated Name' },
        'user-001',
      );

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when petition not found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', {}, 'user-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for future receivedDate on update', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await expect(
        service.update(
          'petition-001',
          { receivedDate: '2099-12-31' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should soft delete petition successfully', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        deletedAt: new Date(),
      });

      const result = await service.delete('petition-001', 'user-001');

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');

      // Verify soft delete (not hard delete)
      const updateCall = mockPrisma.petition.update.mock.calls[0][0];
      expect(updateCall.data.deletedAt).toBeDefined();
    });

    it('should throw NotFoundException when petition not found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-001')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── convertToIncident ──────────────────────────────────────────────────────

  describe('convertToIncident', () => {
    const validConvertDto = {
      incidentName: 'Vụ việc từ đơn thư',
      incidentType: 'An ninh trật tự',
    };

    it('AC-03: should convert petition to incident successfully', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.incident.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockResolvedValue([mockIncident]);
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        linkedIncidentId: 'incident-001',
        status: PetitionStatus.DA_CHUYEN_VU_VIEC,
      });

      const result = await service.convertToIncident(
        'petition-001',
        validConvertDto,
        'user-001',
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
    });

    it('EC-01: should throw BadRequestException when incidentName missing', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await expect(
        service.convertToIncident(
          'petition-001',
          { incidentName: '', incidentType: 'Test' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('EC-01: should throw BadRequestException when incidentType missing', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await expect(
        service.convertToIncident(
          'petition-001',
          { incidentName: 'Test', incidentType: '' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already converted to incident', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue({
        ...mockPetition,
        linkedIncidentId: 'existing-incident',
      });

      await expect(
        service.convertToIncident('petition-001', validConvertDto, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already converted to case', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue({
        ...mockPetition,
        linkedCaseId: 'existing-case',
      });

      await expect(
        service.convertToIncident('petition-001', validConvertDto, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when petition not found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);

      await expect(
        service.convertToIncident('nonexistent', validConvertDto, 'user-001'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── convertToCase ──────────────────────────────────────────────────────────

  describe('convertToCase', () => {
    const validCaseDto = {
      caseName: 'Vụ án từ đơn thư',
      crime: 'Tham nhũng',
      jurisdiction: 'Công an cấp Quận/Huyện',
    };

    it('AC-03: should convert petition to case successfully', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.$transaction.mockResolvedValue([mockCase]);
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        linkedCaseId: 'case-001',
        status: PetitionStatus.DA_CHUYEN_VU_AN,
      });

      const result = await service.convertToCase(
        'petition-001',
        validCaseDto,
        'user-001',
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
    });

    it('EC-01: should throw BadRequestException when caseName missing', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await expect(
        service.convertToCase(
          'petition-001',
          { caseName: '', crime: 'Test', jurisdiction: 'Test' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('EC-01: should throw BadRequestException when crime missing', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await expect(
        service.convertToCase(
          'petition-001',
          { caseName: 'Test', crime: '', jurisdiction: 'Test' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('EC-01: should throw BadRequestException when jurisdiction missing', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);

      await expect(
        service.convertToCase(
          'petition-001',
          { caseName: 'Test', crime: 'Test', jurisdiction: '' },
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already converted to case', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue({
        ...mockPetition,
        linkedCaseId: 'existing-case',
      });

      await expect(
        service.convertToCase('petition-001', validCaseDto, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already converted to incident', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue({
        ...mockPetition,
        linkedIncidentId: 'existing-incident',
      });

      await expect(
        service.convertToCase('petition-001', validCaseDto, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when petition not found', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(null);

      await expect(
        service.convertToCase('nonexistent', validCaseDto, 'user-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a Case with correct fields', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          case: {
            create: jest.fn().mockResolvedValue(mockCase),
          },
          petition: {
            update: jest.fn().mockResolvedValue({
              ...mockPetition,
              linkedCaseId: 'case-001',
              status: PetitionStatus.DA_CHUYEN_VU_AN,
            }),
          },
        };
        return fn(tx);
      });

      await service.convertToCase('petition-001', validCaseDto, 'user-001');

      // Audit log should be called
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PETITION_CONVERTED_TO_CASE',
        }),
      );
    });
  });

  // ── Audit log ─────────────────────────────────────────────────────────────

  describe('Audit logging', () => {
    it('should log PETITION_CREATED on create', async () => {
      mockPrisma.petition.findUnique.mockResolvedValue(null);
      mockPrisma.petition.create.mockResolvedValue(mockPetition);

      await service.create(
        {
          stt: 'DT-2026-00002',
          receivedDate: '2026-02-01',
          senderName: 'Test',
        },
        'user-001',
        { ipAddress: '127.0.0.1', userAgent: 'jest-test' },
      );

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PETITION_CREATED' }),
      );
    });

    it('should log PETITION_DELETED on soft delete', async () => {
      mockPrisma.petition.findFirst.mockResolvedValue(mockPetition);
      mockPrisma.petition.update.mockResolvedValue({
        ...mockPetition,
        deletedAt: new Date(),
      });

      await service.delete('petition-001', 'user-001');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PETITION_DELETED' }),
      );
    });
  });
});
