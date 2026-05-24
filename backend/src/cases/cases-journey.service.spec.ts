/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * CasesJourneyService Unit Tests
 *
 * TDD Cycle 1 RED — all tests MUST fail before implementation exists.
 *
 * Tests cover:
 *   TC-J01: empty array for case with no history
 *   TC-J02: CaseStatusHistory events included, sorted DESC
 *   TC-J03: silently skip incident data when no incident linked
 *   TC-J04: petition events from AuditLog included when petition linked
 *   TC-J05: ForbiddenException propagated when case out of DataScope
 *   TC-J06: AuditLog event without metadata.before shows no diff
 *   TC-J07: 51 events → only 50 returned per page, hasNextPage true
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CasesJourneyService } from './cases-journey.service';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaseStatus } from '@prisma/client';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = { id: 'user-001', firstName: 'Nguyễn', lastName: 'Văn A', username: 'nguyenvana' };

const mockCase = {
  id: 'case-001',
  stt: 'VV-2025-00001',
  name: 'Vụ án test',
  status: CaseStatus.TIEP_NHAN,
  investigatorId: 'user-001',
  assignedTeamId: 'team-001',
  deadline: new Date('2026-06-01'),
  petitions: [],
  createdAt: new Date('2025-01-01T08:00:00Z'),
  updatedAt: new Date('2025-01-01T08:00:00Z'),
  deletedAt: null,
  investigator: mockUser,
};

const makeStatusHistory = (id: string, date: string) => ({
  id,
  caseId: 'case-001',
  fromStatus: CaseStatus.TIEP_NHAN,
  toStatus: CaseStatus.XAC_MINH,
  changedById: 'user-001',
  changedAt: new Date(date),
  changedBy: mockUser,
});

const makeAuditLog = (id: string, date: string, subjectId = 'case-001', metadata: unknown = null) => ({
  id,
  userId: 'user-001',
  action: 'CASE_UPDATED',
  subject: 'Case',
  subjectId,
  metadata,
  ipAddress: null,
  userAgent: null,
  createdAt: new Date(date),
  user: mockUser,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCasesService = {
  getById: jest.fn(),
};

const mockPrisma = {
  caseStatusHistory: {
    findMany: jest.fn(),
  },
  incident: {
    findFirst: jest.fn(),
  },
  incidentStatusHistory: {
    findMany: jest.fn(),
  },
  auditLog: {
    findMany: jest.fn(),
  },
};

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('CasesJourneyService', () => {
  let service: CasesJourneyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesJourneyService,
        { provide: CasesService, useValue: mockCasesService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CasesJourneyService>(CasesJourneyService);
    jest.clearAllMocks();
  });

  // ── TC-J01 ────────────────────────────────────────────────────────────────

  describe('TC-J01: empty history', () => {
    it('returns empty events array and hasNextPage=false when case has no history', async () => {
      mockCasesService.getById.mockResolvedValue({ success: true, data: mockCase });
      mockPrisma.caseStatusHistory.findMany.mockResolvedValue([]);
      mockPrisma.incident.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getJourney('case-001', 'user-001', null, 1, 50);

      expect(result.success).toBe(true);
      expect(result.data.events).toHaveLength(0);
      expect(result.data.hasNextPage).toBe(false);
      expect(result.data.total).toBe(0);
    });
  });

  // ── TC-J02 ────────────────────────────────────────────────────────────────

  describe('TC-J02: CaseStatusHistory events sorted DESC', () => {
    it('maps CaseStatusHistory to STATUS_CHANGE events and sorts newest first', async () => {
      const older = makeStatusHistory('sh-001', '2025-01-10T10:00:00Z');
      const newer = makeStatusHistory('sh-002', '2025-01-20T14:00:00Z');
      // Provide in ASC order (as DB would return) — service must sort DESC
      mockCasesService.getById.mockResolvedValue({ success: true, data: mockCase });
      mockPrisma.caseStatusHistory.findMany.mockResolvedValue([older, newer]);
      mockPrisma.incident.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getJourney('case-001', 'user-001', null, 1, 50);

      expect(result.success).toBe(true);
      const caseEvents = result.data.events.filter((e) => e.entityType === 'CASE');
      const statusEvents = caseEvents.filter((e) => e.eventType === 'STATUS_CHANGE');
      expect(statusEvents).toHaveLength(2);
      // Newest first
      expect(new Date(statusEvents[0].actedAt).getTime()).toBeGreaterThan(
        new Date(statusEvents[1].actedAt).getTime(),
      );
      // Actor populated
      expect(statusEvents[0].actor).not.toBeNull();
      expect(statusEvents[0].actor!.name).toContain('Nguyễn');
    });
  });

  // ── TC-J03 ────────────────────────────────────────────────────────────────

  describe('TC-J03: silently skip incident when none linked', () => {
    it('does not query incidentStatusHistory when no incident linked to case', async () => {
      mockCasesService.getById.mockResolvedValue({ success: true, data: mockCase });
      mockPrisma.caseStatusHistory.findMany.mockResolvedValue([]);
      mockPrisma.incident.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getJourney('case-001', 'user-001', null, 1, 50);

      expect(result.success).toBe(true);
      expect(mockPrisma.incidentStatusHistory.findMany).not.toHaveBeenCalled();
      const incidentEvents = result.data.events.filter((e) => e.entityType === 'INCIDENT');
      expect(incidentEvents).toHaveLength(0);
    });
  });

  // ── TC-J04 ────────────────────────────────────────────────────────────────

  describe('TC-J04: petition events from AuditLog', () => {
    it('includes petition AuditLog events when petition linked to case', async () => {
      const caseWithPetition = {
        ...mockCase,
        petitions: [{ id: 'petition-001', stt: 'DT-2025-00001', status: 'DANG_XU_LY' }],
      };
      const petitionAudit = makeAuditLog(
        'audit-pet-001',
        '2025-01-15T09:00:00Z',
        'petition-001',
        { before: { status: 'MOI_TIEP_NHAN' }, after: { status: 'DANG_XU_LY' } },
      );
      petitionAudit.action = 'PETITION_UPDATED';
      petitionAudit.subject = 'Petition';

      mockCasesService.getById.mockResolvedValue({ success: true, data: caseWithPetition });
      mockPrisma.caseStatusHistory.findMany.mockResolvedValue([]);
      mockPrisma.incident.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.findMany.mockResolvedValue([petitionAudit]);

      const result = await service.getJourney('case-001', 'user-001', null, 1, 50);

      expect(result.success).toBe(true);
      const petitionEvents = result.data.events.filter((e) => e.entityType === 'PETITION');
      expect(petitionEvents).toHaveLength(1);
      expect(petitionEvents[0].entityId).toBe('petition-001');
    });
  });

  // ── TC-J05 ────────────────────────────────────────────────────────────────

  describe('TC-J05: DataScope enforcement', () => {
    it('propagates ForbiddenException when case is out of DataScope', async () => {
      mockCasesService.getById.mockRejectedValue(
        new ForbiddenException('Bạn không có quyền truy cập bản ghi này'),
      );

      const outOfScope = { canDispatch: false, userIds: ['user-other'], teamIds: ['team-other'] };

      await expect(
        service.getJourney('case-001', 'user-other', outOfScope as any, 1, 50),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── TC-J06 ────────────────────────────────────────────────────────────────

  describe('TC-J06: graceful degrade when metadata.before missing', () => {
    it('includes FIELD_UPDATE event but does not expose diff when metadata is null', async () => {
      const auditNoBefore = makeAuditLog('audit-nodiff', '2025-01-12T10:00:00Z', 'case-001', null);

      mockCasesService.getById.mockResolvedValue({ success: true, data: mockCase });
      mockPrisma.caseStatusHistory.findMany.mockResolvedValue([]);
      mockPrisma.incident.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.findMany.mockResolvedValue([auditNoBefore]);

      const result = await service.getJourney('case-001', 'user-001', null, 1, 50);

      expect(result.success).toBe(true);
      const fieldEvents = result.data.events.filter((e) => e.entityType === 'CASE');
      expect(fieldEvents).toHaveLength(1);
      const ev = fieldEvents[0];
      // Must NOT expose raw before/after from AuditLog
      expect(ev.metadata?.before).toBeUndefined();
      expect(ev.metadata?.after).toBeUndefined();
      // Should indicate no diff available
      expect(ev.metadata?.hasDiff).toBe(false);
    });

    it('shows diff summary (not raw data) when metadata.before exists', async () => {
      const auditWithBefore = makeAuditLog(
        'audit-diff',
        '2025-01-12T10:00:00Z',
        'case-001',
        { before: { name: 'Cũ' }, after: { name: 'Mới' } },
      );

      mockCasesService.getById.mockResolvedValue({ success: true, data: mockCase });
      mockPrisma.caseStatusHistory.findMany.mockResolvedValue([]);
      mockPrisma.incident.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.findMany.mockResolvedValue([auditWithBefore]);

      const result = await service.getJourney('case-001', 'user-001', null, 1, 50);

      expect(result.success).toBe(true);
      const caseEvents = result.data.events.filter((e) => e.entityType === 'CASE');
      expect(caseEvents).toHaveLength(1);
      const ev = caseEvents[0];
      // Must NOT expose raw nested before/after objects
      expect(ev.metadata?.before).toBeUndefined();
      expect(ev.metadata?.after).toBeUndefined();
      // Must indicate diff is available
      expect(ev.metadata?.hasDiff).toBe(true);
    });
  });

  // ── TC-J07 ────────────────────────────────────────────────────────────────

  describe('TC-J07: pagination — 51 events returns only 50 per page', () => {
    it('caps results at limit=50 and sets hasNextPage=true when total > limit', async () => {
      // 25 status history + 26 audit log = 51 total events
      const manyHistory = Array.from({ length: 25 }, (_, i) =>
        makeStatusHistory(`sh-${i}`, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
      );
      const manyAudit = Array.from({ length: 26 }, (_, i) =>
        makeAuditLog(
          `audit-${i}`,
          `2025-02-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
          'case-001',
          { before: { name: `old${i}` }, after: { name: `new${i}` } },
        ),
      );

      mockCasesService.getById.mockResolvedValue({ success: true, data: mockCase });
      mockPrisma.caseStatusHistory.findMany.mockResolvedValue(manyHistory);
      mockPrisma.incident.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.findMany.mockResolvedValue(manyAudit);

      const result = await service.getJourney('case-001', 'user-001', null, 1, 50);

      expect(result.success).toBe(true);
      expect(result.data.events).toHaveLength(50);
      expect(result.data.hasNextPage).toBe(true);
      expect(result.data.total).toBe(51);
    });

    it('returns page 2 correctly', async () => {
      const manyHistory = Array.from({ length: 25 }, (_, i) =>
        makeStatusHistory(`sh-${i}`, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
      );
      const manyAudit = Array.from({ length: 26 }, (_, i) =>
        makeAuditLog(
          `audit-${i}`,
          `2025-02-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
          'case-001',
          { before: { name: `old${i}` }, after: { name: `new${i}` } },
        ),
      );

      mockCasesService.getById.mockResolvedValue({ success: true, data: mockCase });
      mockPrisma.caseStatusHistory.findMany.mockResolvedValue(manyHistory);
      mockPrisma.incident.findFirst.mockResolvedValue(null);
      mockPrisma.auditLog.findMany.mockResolvedValue(manyAudit);

      const result = await service.getJourney('case-001', 'user-001', null, 2, 50);

      expect(result.success).toBe(true);
      expect(result.data.events).toHaveLength(1); // 51 total − 50 on page 1 = 1 on page 2
      expect(result.data.hasNextPage).toBe(false);
    });
  });
});
