/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * IncidentsJourneyService Unit Tests
 *
 * TDD Cycle RED — all tests MUST fail before implementation exists.
 *
 * Tests cover:
 *   TC-IJ01: IncidentStatusHistory events mapped → INCIDENT entityType + STATUS_CHANGE, sorted DESC
 *   TC-IJ02: AuditLog events merged with IncidentStatusHistory, overall sorted DESC
 *   TC-IJ03: No IncidentStatusHistory → AuditLog-only (graceful), findMany NOT called
 *   TC-IJ04: ForbiddenException propagated when incident out of DataScope
 *   TC-IJ05: pagination page 2 correct (52 total → page1=50, page2=2)
 *   TC-IJ06: synthetic CREATED event injected when no INCIDENT_CREATED AuditLog
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { IncidentsJourneyService } from './incidents-journey.service';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = { id: 'user-001', firstName: 'Nguyễn', lastName: 'Văn A', username: 'nguyenvana' };

const mockIncident = {
  id: 'incident-001',
  code: 'VA-2025-00001',
  status: 'DANG_DIEU_TRA',
  createdAt: new Date('2025-01-01T08:00:00Z'),
  updatedAt: new Date('2025-01-01T08:00:00Z'),
  deletedAt: null,
  investigatorId: 'user-001',
  assignedTeamId: 'team-001',
};

const makeStatusHistory = (id: string, date: string) => ({
  id,
  incidentId: 'incident-001',
  fromStatus: 'MOI_TIEP_NHAN',
  toStatus: 'DANG_DIEU_TRA',
  createdAt: new Date(date),
  changedBy: mockUser,
});

const makeAuditLog = (id: string, date: string, metadata: unknown = null) => ({
  id,
  userId: 'user-001',
  action: 'INCIDENT_UPDATED',
  subject: 'Incident',
  subjectId: 'incident-001',
  metadata,
  ipAddress: null,
  userAgent: null,
  createdAt: new Date(date),
  user: mockUser,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockIncidentsService = {
  getById: jest.fn(),
};

const mockPrisma = {
  incidentStatusHistory: {
    findMany: jest.fn(),
  },
  auditLog: {
    findMany: jest.fn(),
  },
};

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('IncidentsJourneyService', () => {
  let service: IncidentsJourneyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsJourneyService,
        { provide: IncidentsService, useValue: mockIncidentsService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<IncidentsJourneyService>(IncidentsJourneyService);
    jest.clearAllMocks();
  });

  // ── TC-IJ01 ───────────────────────────────────────────────────────────────

  describe('TC-IJ01: IncidentStatusHistory events mapped and sorted DESC', () => {
    it('maps IncidentStatusHistory to STATUS_CHANGE events and sorts newest first', async () => {
      const older = makeStatusHistory('sh-001', '2025-01-10T10:00:00Z');
      const newer = makeStatusHistory('sh-002', '2025-01-20T14:00:00Z');

      mockIncidentsService.getById.mockResolvedValue({ success: true, data: mockIncident });
      mockPrisma.incidentStatusHistory.findMany.mockResolvedValue([older, newer]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getJourney('incident-001', null, 1, 50);

      expect(result.success).toBe(true);
      const statusEvents = result.data.events.filter(
        (e) => e.entityType === 'INCIDENT' && e.eventType === 'STATUS_CHANGE',
      );
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

  // ── TC-IJ02 ───────────────────────────────────────────────────────────────

  describe('TC-IJ02: AuditLog events merged with IncidentStatusHistory, sorted DESC', () => {
    it('merges audit and status history into a unified DESC timeline', async () => {
      const statusHistory = makeStatusHistory('sh-001', '2025-01-15T12:00:00Z');
      const auditLog = makeAuditLog('audit-001', '2025-01-20T09:00:00Z');

      mockIncidentsService.getById.mockResolvedValue({ success: true, data: mockIncident });
      mockPrisma.incidentStatusHistory.findMany.mockResolvedValue([statusHistory]);
      mockPrisma.auditLog.findMany.mockResolvedValue([auditLog]);

      const result = await service.getJourney('incident-001', null, 1, 50);

      expect(result.success).toBe(true);
      // audit (Jan 20) should be before status history (Jan 15) in DESC order
      const incidentEvents = result.data.events.filter((e) => e.entityType === 'INCIDENT');
      expect(incidentEvents.length).toBeGreaterThanOrEqual(2);
      expect(new Date(incidentEvents[0].actedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(incidentEvents[1].actedAt).getTime(),
      );
    });
  });

  // ── TC-IJ03 ───────────────────────────────────────────────────────────────

  describe('TC-IJ03: graceful when IncidentStatusHistory is empty', () => {
    it('returns AuditLog-only events when IncidentStatusHistory returns empty', async () => {
      const auditLog = makeAuditLog('audit-001', '2025-01-15T09:00:00Z');

      mockIncidentsService.getById.mockResolvedValue({ success: true, data: mockIncident });
      mockPrisma.incidentStatusHistory.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([auditLog]);

      const result = await service.getJourney('incident-001', null, 1, 50);

      expect(result.success).toBe(true);
      const statusEvents = result.data.events.filter((e) => e.eventType === 'STATUS_CHANGE');
      expect(statusEvents).toHaveLength(0);
      const fieldEvents = result.data.events.filter((e) => e.eventType === 'FIELD_UPDATE');
      expect(fieldEvents).toHaveLength(1);
    });
  });

  // ── TC-IJ04 ───────────────────────────────────────────────────────────────

  describe('TC-IJ04: DataScope enforcement', () => {
    it('propagates ForbiddenException when incident is out of DataScope', async () => {
      mockIncidentsService.getById.mockRejectedValue(
        new ForbiddenException('Bạn không có quyền truy cập bản ghi này'),
      );

      const outOfScope = { canDispatch: false, userIds: ['user-other'], teamIds: ['team-other'] };

      await expect(
        service.getJourney('incident-001', outOfScope as any, 1, 50),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── TC-IJ05 ───────────────────────────────────────────────────────────────

  describe('TC-IJ05: pagination — 52 events total', () => {
    it('returns 50 on page 1 (hasNextPage=true) and 2 on page 2 (hasNextPage=false)', async () => {
      // 25 status history + 26 audit = 51 + 1 synthetic CREATED = 52 total
      const manyHistory = Array.from({ length: 25 }, (_, i) =>
        makeStatusHistory(`sh-${i}`, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
      );
      const manyAudit = Array.from({ length: 26 }, (_, i) =>
        makeAuditLog(
          `audit-${i}`,
          `2025-02-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
          { before: { status: `old${i}` }, after: { status: `new${i}` } },
        ),
      );

      mockIncidentsService.getById.mockResolvedValue({ success: true, data: mockIncident });
      mockPrisma.incidentStatusHistory.findMany.mockResolvedValue(manyHistory);
      mockPrisma.auditLog.findMany.mockResolvedValue(manyAudit);

      // Page 1
      const page1 = await service.getJourney('incident-001', null, 1, 50);
      expect(page1.success).toBe(true);
      expect(page1.data.events).toHaveLength(50);
      expect(page1.data.hasNextPage).toBe(true);
      expect(page1.data.total).toBe(52);

      // Page 2
      const page2 = await service.getJourney('incident-001', null, 2, 50);
      expect(page2.success).toBe(true);
      expect(page2.data.events).toHaveLength(2);
      expect(page2.data.hasNextPage).toBe(false);
    });
  });

  // ── TC-IJ06 ───────────────────────────────────────────────────────────────

  describe('TC-IJ06: synthetic CREATED event injected', () => {
    it('injects synthetic CREATED event when no INCIDENT_CREATED AuditLog exists', async () => {
      mockIncidentsService.getById.mockResolvedValue({ success: true, data: mockIncident });
      mockPrisma.incidentStatusHistory.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getJourney('incident-001', null, 1, 50);

      expect(result.success).toBe(true);
      expect(result.data.events).toHaveLength(1);

      const ev = result.data.events[0];
      expect(ev.entityType).toBe('INCIDENT');
      expect(ev.eventType).toBe('CREATED');
      expect(ev.actedAt).toEqual(mockIncident.createdAt);
    });
  });
});
