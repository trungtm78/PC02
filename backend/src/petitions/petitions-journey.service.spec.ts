/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * PetitionsJourneyService Unit Tests
 *
 * TDD Cycle RED — all tests MUST fail before implementation exists.
 *
 * Tests cover:
 *   TC-PJ01: empty history → synthetic PETITION CREATED event from petition.createdAt
 *   TC-PJ02: AuditLog events mapped to PETITION entityType, sorted DESC
 *   TC-PJ03: ForbiddenException propagated when petition out of DataScope
 *   TC-PJ04: metadata.hasDiff=false when null, hasDiff=true when before present; no raw before/after
 *   TC-PJ05: 51 audit events → 50 returned page 1 (hasNextPage=true), page 2 returns rest
 *   TC-PJ06: pagination boundary — exactly 50 events → hasNextPage=false, total=50
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PetitionsJourneyService } from './petitions-journey.service';
import { PetitionsService } from './petitions.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = { id: 'user-001', firstName: 'Nguyễn', lastName: 'Văn A', username: 'nguyenvana' };

const mockPetition = {
  id: 'petition-001',
  stt: 'DT-2025-00001',
  status: 'DANG_XU_LY',
  createdAt: new Date('2025-01-01T08:00:00Z'),
  updatedAt: new Date('2025-01-01T08:00:00Z'),
  deletedAt: null,
  assignedToId: 'user-001',
  assignedTeamId: 'team-001',
};

const makeAuditLog = (id: string, date: string, metadata: unknown = null) => ({
  id,
  userId: 'user-001',
  action: 'PETITION_UPDATED',
  subject: 'Petition',
  subjectId: 'petition-001',
  metadata,
  ipAddress: null,
  userAgent: null,
  createdAt: new Date(date),
  user: mockUser,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPetitionsService = {
  getById: jest.fn(),
};

const mockPrisma = {
  auditLog: {
    findMany: jest.fn(),
  },
};

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('PetitionsJourneyService', () => {
  let service: PetitionsJourneyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetitionsJourneyService,
        { provide: PetitionsService, useValue: mockPetitionsService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PetitionsJourneyService>(PetitionsJourneyService);
    jest.clearAllMocks();
  });

  // ── TC-PJ01 ───────────────────────────────────────────────────────────────

  describe('TC-PJ01: empty audit log → synthetic CREATED event from petition.createdAt', () => {
    it('returns synthetic CREATED event when no audit log exists', async () => {
      mockPetitionsService.getById.mockResolvedValue({ success: true, data: mockPetition });
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getJourney('petition-001', null, 1, 50);

      expect(result.success).toBe(true);
      expect(result.data.events).toHaveLength(1);
      expect(result.data.hasNextPage).toBe(false);
      expect(result.data.total).toBe(1);

      const ev = result.data.events[0];
      expect(ev.entityType).toBe('PETITION');
      expect(ev.eventType).toBe('CREATED');
      expect(ev.actedAt).toEqual(mockPetition.createdAt);
    });
  });

  // ── TC-PJ02 ───────────────────────────────────────────────────────────────

  describe('TC-PJ02: AuditLog events mapped to PETITION entityType, sorted DESC', () => {
    it('maps audit logs to PETITION events sorted newest first', async () => {
      const older = makeAuditLog('audit-001', '2025-01-10T10:00:00Z');
      const newer = makeAuditLog('audit-002', '2025-01-20T14:00:00Z');
      // Provide in ASC order — service must sort DESC
      mockPetitionsService.getById.mockResolvedValue({ success: true, data: mockPetition });
      mockPrisma.auditLog.findMany.mockResolvedValue([older, newer]);

      const result = await service.getJourney('petition-001', null, 1, 50);

      expect(result.success).toBe(true);
      const petitionEvents = result.data.events.filter((e) => e.entityType === 'PETITION' && e.eventType === 'FIELD_UPDATE');
      expect(petitionEvents).toHaveLength(2);
      // Newest first
      expect(new Date(petitionEvents[0].actedAt).getTime()).toBeGreaterThan(
        new Date(petitionEvents[1].actedAt).getTime(),
      );
      // Actor populated
      expect(petitionEvents[0].actor).not.toBeNull();
      expect(petitionEvents[0].actor!.name).toContain('Nguyễn');
    });
  });

  // ── TC-PJ03 ───────────────────────────────────────────────────────────────

  describe('TC-PJ03: DataScope enforcement', () => {
    it('propagates ForbiddenException when petition is out of DataScope', async () => {
      mockPetitionsService.getById.mockRejectedValue(
        new ForbiddenException('Bạn không có quyền truy cập bản ghi này'),
      );

      const outOfScope = { canDispatch: false, userIds: ['user-other'], teamIds: ['team-other'] };

      await expect(
        service.getJourney('petition-001', outOfScope as any, 1, 50),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── TC-PJ04 ───────────────────────────────────────────────────────────────

  describe('TC-PJ04: metadata.hasDiff security', () => {
    it('hasDiff=false when metadata is null, no raw before/after exposed', async () => {
      const auditNoBefore = makeAuditLog('audit-nodiff', '2025-01-12T10:00:00Z', null);

      mockPetitionsService.getById.mockResolvedValue({ success: true, data: mockPetition });
      mockPrisma.auditLog.findMany.mockResolvedValue([auditNoBefore]);

      const result = await service.getJourney('petition-001', null, 1, 50);

      expect(result.success).toBe(true);
      const fieldEvents = result.data.events.filter(
        (e) => e.entityType === 'PETITION' && e.eventType === 'FIELD_UPDATE',
      );
      expect(fieldEvents).toHaveLength(1);
      const meta = fieldEvents[0].metadata as unknown as Record<string, unknown>;
      expect(meta?.before).toBeUndefined();
      expect(meta?.after).toBeUndefined();
      expect(fieldEvents[0].metadata?.hasDiff).toBe(false);
    });

    it('hasDiff=true when metadata.before exists, no raw before/after exposed', async () => {
      const auditWithBefore = makeAuditLog(
        'audit-diff',
        '2025-01-12T10:00:00Z',
        { before: { status: 'MOI_TIEP_NHAN' }, after: { status: 'DANG_XU_LY' } },
      );

      mockPetitionsService.getById.mockResolvedValue({ success: true, data: mockPetition });
      mockPrisma.auditLog.findMany.mockResolvedValue([auditWithBefore]);

      const result = await service.getJourney('petition-001', null, 1, 50);

      expect(result.success).toBe(true);
      const fieldEvents = result.data.events.filter(
        (e) => e.entityType === 'PETITION' && e.eventType === 'FIELD_UPDATE',
      );
      expect(fieldEvents).toHaveLength(1);
      const meta = fieldEvents[0].metadata as unknown as Record<string, unknown>;
      expect(meta?.before).toBeUndefined();
      expect(meta?.after).toBeUndefined();
      expect(fieldEvents[0].metadata?.hasDiff).toBe(true);
    });
  });

  // ── TC-PJ05 ───────────────────────────────────────────────────────────────

  describe('TC-PJ05: pagination — 51 events returns 50 on page 1, 2 on page 2', () => {
    it('returns 50 events page 1 and hasNextPage=true for 51 audit events + 1 synthetic', async () => {
      // 51 audit events + 1 synthetic CREATED = 52 total (PETITION_CREATED not in list → synthetic injected)
      const manyAudit = Array.from({ length: 51 }, (_, i) =>
        makeAuditLog(
          `audit-${i}`,
          `2025-02-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
          { before: { status: `old${i}` }, after: { status: `new${i}` } },
        ),
      );

      mockPetitionsService.getById.mockResolvedValue({ success: true, data: mockPetition });
      mockPrisma.auditLog.findMany.mockResolvedValue(manyAudit);

      const result = await service.getJourney('petition-001', null, 1, 50);

      expect(result.success).toBe(true);
      expect(result.data.events).toHaveLength(50);
      expect(result.data.hasNextPage).toBe(true);
      // 51 audit + 1 synthetic CREATED = 52 total
      expect(result.data.total).toBe(52);
    });

    it('returns page 2 correctly (remaining 2 events)', async () => {
      const manyAudit = Array.from({ length: 51 }, (_, i) =>
        makeAuditLog(
          `audit-${i}`,
          `2025-02-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
          { before: { status: `old${i}` }, after: { status: `new${i}` } },
        ),
      );

      mockPetitionsService.getById.mockResolvedValue({ success: true, data: mockPetition });
      mockPrisma.auditLog.findMany.mockResolvedValue(manyAudit);

      const result = await service.getJourney('petition-001', null, 2, 50);

      expect(result.success).toBe(true);
      expect(result.data.events).toHaveLength(2);
      expect(result.data.hasNextPage).toBe(false);
    });
  });

  // ── TC-PJ06 ───────────────────────────────────────────────────────────────

  describe('TC-PJ06: pagination boundary — exactly 50 events', () => {
    it('returns hasNextPage=false when total equals limit exactly (1 CREATED_audit + 49 others = 50)', async () => {
      // 49 FIELD_UPDATE audit logs + 1 PETITION_CREATED audit log = 50 total (no synthetic injected)
      const createdAudit = makeAuditLog('audit-created', '2025-01-01T08:00:00Z', null);
      createdAudit.action = 'PETITION_CREATED';

      const fieldAudits = Array.from({ length: 49 }, (_, i) =>
        makeAuditLog(`audit-field-${i}`, `2025-02-${String(i + 1).padStart(2, '0')}T10:00:00Z`, null),
      );

      mockPetitionsService.getById.mockResolvedValue({ success: true, data: mockPetition });
      mockPrisma.auditLog.findMany.mockResolvedValue([createdAudit, ...fieldAudits]);

      const result = await service.getJourney('petition-001', null, 1, 50);

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(50);
      expect(result.data.hasNextPage).toBe(false);
      expect(result.data.events).toHaveLength(50);
    });
  });
});
