/**
 * VksMeetingsService Unit Tests
 *
 * UT-001: createForCase – throws NotFoundException when case does not exist
 * UT-002: createForCase – creates record with correct caseId and null incidentId
 * UT-003: createForIncident – throws NotFoundException when incident does not exist
 * UT-004: createForIncident – creates record with correct incidentId and null caseId
 * UT-005: findAllForCase – returns records ordered by ngayTrao desc, includes createdBy
 * UT-006: findAllForIncident – returns records for incident
 * UT-007: delete – throws NotFoundException when record does not exist
 * UT-008: delete – deletes record when it exists
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VksMeetingsService } from './vks-meetings.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  vksMeetingRecord: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  case: {
    findUnique: jest.fn(),
  },
  incident: {
    findUnique: jest.fn(),
  },
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CASE_ID = 'case-001';
const INCIDENT_ID = 'incident-001';
const RECORD_ID = 'record-001';
const USER_ID = 'user-001';

const MEETING_DTO = {
  ngayTrao: '2025-06-15',
  soQuyetDinh: '01/QD',
  noiDung: 'Trao đổi tiến độ điều tra',
  ketQua: 'Đồng ý gia hạn',
};

function makeMeetingRecord(overrides: object = {}) {
  return {
    id: RECORD_ID,
    caseId: CASE_ID,
    incidentId: null,
    ngayTrao: new Date('2025-06-15'),
    soQuyetDinh: '01/QD',
    noiDung: 'Trao đổi tiến độ điều tra',
    ketQua: 'Đồng ý gia hạn',
    createdById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: { id: USER_ID, firstName: 'Nguyen', lastName: 'Van A' },
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('VksMeetingsService', () => {
  let service: VksMeetingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VksMeetingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<VksMeetingsService>(VksMeetingsService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─── UT-001 & UT-002: createForCase ─────────────────────────────────────────

  describe('createForCase', () => {
    it('UT-001: throws NotFoundException when case does not exist', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(null);

      await expect(service.createForCase(CASE_ID, MEETING_DTO as any, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.vksMeetingRecord.create).not.toHaveBeenCalled();
    });

    it('UT-002: creates record with correct caseId and null incidentId', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ id: CASE_ID });
      const created = makeMeetingRecord();
      mockPrisma.vksMeetingRecord.create.mockResolvedValue(created);

      const result = await service.createForCase(CASE_ID, MEETING_DTO as any, USER_ID);

      expect(result).toEqual(created);
      expect(mockPrisma.vksMeetingRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseId: CASE_ID,
            incidentId: null,
            noiDung: MEETING_DTO.noiDung,
            createdById: USER_ID,
          }),
        }),
      );
    });

    it('UT-002b: converts ngayTrao string to Date', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ id: CASE_ID });
      mockPrisma.vksMeetingRecord.create.mockResolvedValue(makeMeetingRecord());

      await service.createForCase(CASE_ID, MEETING_DTO as any, USER_ID);

      const callArgs = mockPrisma.vksMeetingRecord.create.mock.calls[0][0];
      expect(callArgs.data.ngayTrao).toBeInstanceOf(Date);
    });
  });

  // ─── UT-003 & UT-004: createForIncident ──────────────────────────────────────

  describe('createForIncident', () => {
    it('UT-003: throws NotFoundException when incident does not exist', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue(null);

      await expect(
        service.createForIncident(INCIDENT_ID, MEETING_DTO as any, USER_ID),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.vksMeetingRecord.create).not.toHaveBeenCalled();
    });

    it('UT-004: creates record with correct incidentId and null caseId', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue({ id: INCIDENT_ID });
      const created = makeMeetingRecord({ incidentId: INCIDENT_ID, caseId: null });
      mockPrisma.vksMeetingRecord.create.mockResolvedValue(created);

      const result = await service.createForIncident(INCIDENT_ID, MEETING_DTO as any, USER_ID);

      expect(result).toEqual(created);
      expect(mockPrisma.vksMeetingRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            incidentId: INCIDENT_ID,
            caseId: null,
            noiDung: MEETING_DTO.noiDung,
            createdById: USER_ID,
          }),
        }),
      );
    });
  });

  // ─── UT-005: findAllForCase ───────────────────────────────────────────────────

  describe('findAllForCase', () => {
    it('UT-005: throws NotFoundException when case does not exist', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(null);

      await expect(service.findAllForCase(CASE_ID)).rejects.toThrow(NotFoundException);
    });

    it('UT-005b: returns records ordered by ngayTrao desc and includes createdBy', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ id: CASE_ID });
      const records = [makeMeetingRecord(), makeMeetingRecord({ id: 'record-002' })];
      mockPrisma.vksMeetingRecord.findMany.mockResolvedValue(records);

      const result = await service.findAllForCase(CASE_ID);

      expect(result).toEqual(records);
      expect(mockPrisma.vksMeetingRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { caseId: CASE_ID },
          orderBy: { ngayTrao: 'desc' },
          include: expect.objectContaining({
            createdBy: expect.any(Object),
          }),
        }),
      );
    });

    it('UT-005c: returns empty array when no records exist for case', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({ id: CASE_ID });
      mockPrisma.vksMeetingRecord.findMany.mockResolvedValue([]);

      const result = await service.findAllForCase(CASE_ID);

      expect(result).toEqual([]);
    });
  });

  // ─── UT-006: findAllForIncident ───────────────────────────────────────────────

  describe('findAllForIncident', () => {
    it('UT-006: throws NotFoundException when incident does not exist', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue(null);

      await expect(service.findAllForIncident(INCIDENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('UT-006b: returns records for incident with correct query', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue({ id: INCIDENT_ID });
      const records = [makeMeetingRecord({ incidentId: INCIDENT_ID, caseId: null })];
      mockPrisma.vksMeetingRecord.findMany.mockResolvedValue(records);

      const result = await service.findAllForIncident(INCIDENT_ID);

      expect(result).toEqual(records);
      expect(mockPrisma.vksMeetingRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { incidentId: INCIDENT_ID },
          orderBy: { ngayTrao: 'desc' },
        }),
      );
    });
  });

  // ─── UT-007 & UT-008: delete ──────────────────────────────────────────────────

  describe('delete', () => {
    it('UT-007: throws NotFoundException when record does not exist', async () => {
      mockPrisma.vksMeetingRecord.findUnique.mockResolvedValue(null);

      await expect(service.delete(RECORD_ID)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.vksMeetingRecord.delete).not.toHaveBeenCalled();
    });

    it('UT-007b: NotFoundException message includes the record id', async () => {
      mockPrisma.vksMeetingRecord.findUnique.mockResolvedValue(null);

      await expect(service.delete(RECORD_ID)).rejects.toThrow(RECORD_ID);
    });

    it('UT-008: deletes record and returns deleted record when found', async () => {
      const existing = makeMeetingRecord();
      mockPrisma.vksMeetingRecord.findUnique.mockResolvedValue(existing);
      mockPrisma.vksMeetingRecord.delete.mockResolvedValue(existing);

      const result = await service.delete(RECORD_ID);

      expect(result).toEqual(existing);
      expect(mockPrisma.vksMeetingRecord.delete).toHaveBeenCalledWith({
        where: { id: RECORD_ID },
      });
    });

    it('UT-008b: does not call delete if findUnique returns null', async () => {
      mockPrisma.vksMeetingRecord.findUnique.mockResolvedValue(null);

      try {
        await service.delete(RECORD_ID);
      } catch {
        // expected NotFoundException
      }

      expect(mockPrisma.vksMeetingRecord.delete).not.toHaveBeenCalled();
    });
  });
});
