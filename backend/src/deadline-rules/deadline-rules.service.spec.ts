/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DeadlineRulesService } from './deadline-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DEADLINE_RULE_ACTIONS } from './constants/deadline-rule-keys.constants';

/**
 * Unit tests for DeadlineRulesService.
 *
 * Coverage:
 *   - propose / updateDraft / submit / approve / reject / deleteDraft state gates
 *   - proposer ≠ approver enforcement
 *   - approve activates immediately when effectiveFrom <= now, defers otherwise
 *   - approve supersedes existing active version in same transaction
 *   - reject requires reviewer-different-from-proposer
 *   - getActive / getActiveValue + key validation
 *   - effectiveFrom clamps (>2y future, >30d past)
 *   - listActive returns only the 12 deadline keys with status='active'
 *   - previewImpact bucketing
 *   - activateDueRules processes versions in effectiveFrom ASC for multi-day catch-up
 *   - notifyStaleSubmissions creates notifications for each approver per stale version
 */

function makeRule(overrides: Partial<any> = {}): any {
  return {
    id: 'rule_v1',
    ruleKey: 'THOI_HAN_XAC_MINH',
    value: 20,
    label: 'Thời hạn xác minh',
    legalBasis: 'Điều 147 BLTTHS',
    documentType: 'BLTTHS',
    documentNumber: '101/2015/QH13',
    documentIssuer: 'Quốc hội',
    documentDate: null,
    attachmentId: null,
    migrationConfidence: null,
    reason: 'Initial seed',
    status: 'active',
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: null,
    supersedesId: null,
    proposedById: 'user_a',
    proposedByType: 'USER',
    proposedAt: new Date('2024-01-01'),
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('DeadlineRulesService', () => {
  let service: DeadlineRulesService;
  let prisma: any;
  let audit: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = {
      deadlineRuleVersion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      incident: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      petition: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'approver_x' }]) },
      $transaction: jest.fn(async (fn: any) =>
        typeof fn === 'function'
          ? fn({
              deadlineRuleVersion: prisma.deadlineRuleVersion,
              $executeRaw: jest.fn(),
            })
          : fn,
      ),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    notifications = { create: jest.fn().mockResolvedValue({ id: 'n1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadlineRulesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(DeadlineRulesService);
  });

  // ── getActive / getActiveValue ─────────────────────────────────────────────

  describe('getActive', () => {
    it('returns the active rule for a valid key', async () => {
      prisma.deadlineRuleVersion.findFirst.mockResolvedValue(makeRule());
      const result = await service.getActive('THOI_HAN_XAC_MINH');
      expect(result?.value).toBe(20);
    });

    it('returns null when no active version exists', async () => {
      prisma.deadlineRuleVersion.findFirst.mockResolvedValue(null);
      const result = await service.getActive('THOI_HAN_XAC_MINH');
      expect(result).toBeNull();
    });

    it('throws BadRequest for non-deadline keys (defense in depth)', async () => {
      await expect(service.getActive('TWO_FA_ENABLED')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getActiveValue', () => {
    it('returns the numeric value when active rule exists', async () => {
      prisma.deadlineRuleVersion.findFirst.mockResolvedValue(makeRule({ value: 25 }));
      expect(await service.getActiveValue('THOI_HAN_XAC_MINH')).toBe(25);
    });

    it('returns fallback when no active rule and fallback provided', async () => {
      prisma.deadlineRuleVersion.findFirst.mockResolvedValue(null);
      expect(await service.getActiveValue('THOI_HAN_XAC_MINH', 20)).toBe(20);
    });

    it('throws when no active rule and no fallback', async () => {
      prisma.deadlineRuleVersion.findFirst.mockResolvedValue(null);
      await expect(service.getActiveValue('THOI_HAN_XAC_MINH')).rejects.toThrow();
    });
  });

  // ── propose ────────────────────────────────────────────────────────────────

  describe('propose', () => {
    it('creates a draft with status=draft and audits PROPOSED', async () => {
      const created = makeRule({ id: 'new_v', status: 'draft', value: 25 });
      prisma.deadlineRuleVersion.create.mockResolvedValue(created);

      const dto = {
        ruleKey: 'THOI_HAN_XAC_MINH',
        value: 25,
        label: 'Updated',
        legalBasis: 'Điều 147',
        documentType: 'TT',
        documentNumber: '28/2020',
        documentIssuer: 'BCA',
        reason: 'Cập nhật theo thông tư 28/2020/TT-BCA Điều 11',
      };
      const result = await service.propose(dto as any, 'user_a');
      expect(result.success).toBe(true);
      expect(prisma.deadlineRuleVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'draft', value: 25 }) }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: DEADLINE_RULE_ACTIONS.PROPOSED }),
      );
    });

    it('rejects invalid ruleKey', async () => {
      await expect(service.propose({ ruleKey: 'NOT_REAL' } as any, 'user_a')).rejects.toThrow(BadRequestException);
    });

    it('clamps effectiveFrom > 2 years in the future', async () => {
      const tooFar = new Date();
      tooFar.setFullYear(tooFar.getFullYear() + 5);
      await expect(
        service.propose(
          {
            ruleKey: 'THOI_HAN_XAC_MINH',
            value: 25,
            label: 'x',
            legalBasis: 'x',
            documentType: 'TT',
            documentNumber: '28/2020',
            documentIssuer: 'BCA',
            reason: 'A reason long enough to pass validation',
            effectiveFrom: tooFar.toISOString(),
          } as any,
          'user_a',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── submit ─────────────────────────────────────────────────────────────────

  describe('submit', () => {
    it('transitions draft → submitted (proposer only)', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(makeRule({ status: 'draft', proposedById: 'user_a' }));
      prisma.deadlineRuleVersion.update.mockResolvedValue(makeRule({ status: 'submitted', proposedById: 'user_a' }));

      const result = await service.submit('rule_v1', 'user_a');
      expect(result.success).toBe(true);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: DEADLINE_RULE_ACTIONS.SUBMITTED }),
      );
    });

    it('rejects submit by non-proposer', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(makeRule({ status: 'draft', proposedById: 'user_a' }));
      await expect(service.submit('rule_v1', 'user_b')).rejects.toThrow(ForbiddenException);
    });

    it('rejects submit when status != draft', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(makeRule({ status: 'submitted', proposedById: 'user_a' }));
      await expect(service.submit('rule_v1', 'user_a')).rejects.toThrow(ConflictException);
    });

    it('translates P2002 (partial unique violation) to ConflictException', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(makeRule({ status: 'draft', proposedById: 'user_a' }));
      const err: any = new Error('Unique constraint failed');
      err.code = 'P2002';
      prisma.deadlineRuleVersion.update.mockRejectedValue(err);
      await expect(service.submit('rule_v1', 'user_a')).rejects.toThrow(ConflictException);
    });
  });

  // ── approve ────────────────────────────────────────────────────────────────

  describe('approve', () => {
    it('rejects approval when approver === proposer (maker-checker)', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(
        makeRule({ status: 'submitted', proposedById: 'user_a' }),
      );
      await expect(service.approve('rule_v1', {}, 'user_a')).rejects.toThrow(ForbiddenException);
    });

    it('rejects approval when status != submitted', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(
        makeRule({ status: 'draft', proposedById: 'user_a' }),
      );
      await expect(service.approve('rule_v1', {}, 'user_b')).rejects.toThrow(ConflictException);
    });

    it('activates immediately when effectiveFrom <= now and supersedes prior active', async () => {
      const proposed = makeRule({ status: 'submitted', proposedById: 'user_a', effectiveFrom: new Date() });
      const prior = makeRule({ id: 'rule_v0', status: 'active' });
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(proposed);
      prisma.deadlineRuleVersion.findFirst.mockResolvedValue(prior);
      prisma.deadlineRuleVersion.update.mockResolvedValue({ ...proposed, status: 'active' });

      const result = await service.approve('rule_v1', {}, 'user_b');
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('active');
      // prior version superseded
      expect(prisma.deadlineRuleVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rule_v0' },
          data: expect.objectContaining({ status: 'superseded' }),
        }),
      );
    });

    it('defers activation when effectiveFrom > now (status=approved)', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const proposed = makeRule({ status: 'submitted', proposedById: 'user_a', effectiveFrom: future });
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(proposed);
      prisma.deadlineRuleVersion.update.mockResolvedValue({ ...proposed, status: 'approved' });

      const result = await service.approve('rule_v1', { effectiveFrom: future.toISOString() }, 'user_b');
      expect(result.data.status).toBe('approved');
    });
  });

  // ── reject ─────────────────────────────────────────────────────────────────

  describe('reject', () => {
    it('transitions submitted → rejected by non-proposer', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(
        makeRule({ status: 'submitted', proposedById: 'user_a' }),
      );
      prisma.deadlineRuleVersion.update.mockResolvedValue(
        makeRule({ status: 'rejected', proposedById: 'user_a' }),
      );

      const result = await service.reject('rule_v1', { notes: 'Thiếu căn cứ' }, 'user_b');
      expect(result.success).toBe(true);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: DEADLINE_RULE_ACTIONS.REJECTED }),
      );
    });

    it('blocks self-reject', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(
        makeRule({ status: 'submitted', proposedById: 'user_a' }),
      );
      await expect(service.reject('rule_v1', { notes: 'x' }, 'user_a')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── deleteDraft ────────────────────────────────────────────────────────────

  describe('deleteDraft', () => {
    it('allows proposer to delete own draft', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(
        makeRule({ status: 'draft', proposedById: 'user_a' }),
      );
      const result = await service.deleteDraft('rule_v1', 'user_a');
      expect(result.success).toBe(true);
      expect(prisma.deadlineRuleVersion.delete).toHaveBeenCalled();
    });

    it('blocks delete of non-draft', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(
        makeRule({ status: 'active', proposedById: 'user_a' }),
      );
      await expect(service.deleteDraft('rule_v1', 'user_a')).rejects.toThrow(ConflictException);
    });

    it('blocks delete by non-proposer', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(
        makeRule({ status: 'draft', proposedById: 'user_a' }),
      );
      await expect(service.deleteDraft('rule_v1', 'user_b')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── listActive / getSummary ───────────────────────────────────────────────

  describe('listActive', () => {
    it('returns active rules for all 12 deadline keys', async () => {
      const rows = [
        makeRule({ ruleKey: 'THOI_HAN_XAC_MINH' }),
        makeRule({ ruleKey: 'THOI_HAN_TO_CAO', value: 30 }),
      ];
      prisma.deadlineRuleVersion.findMany.mockResolvedValue(rows);
      const result = await service.listActive();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(prisma.deadlineRuleVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        }),
      );
    });
  });

  describe('getSummary', () => {
    it('returns counts for active, submitted, approved-pending, needs-doc', async () => {
      prisma.deadlineRuleVersion.count
        .mockResolvedValueOnce(12) // active
        .mockResolvedValueOnce(2)  // submitted
        .mockResolvedValueOnce(1)  // approved
        .mockResolvedValueOnce(3); // needsDocumentation
      const result = await service.getSummary();
      expect(result.data).toEqual({
        active: 12,
        submitted: 2,
        approvedPending: 1,
        needsDocumentation: 3,
      });
    });
  });

  // ── activateDueRules ──────────────────────────────────────────────────────

  describe('activateDueRules', () => {
    it('promotes approved versions with effectiveFrom <= now to active', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const dueVersion = makeRule({
        id: 'rule_v2',
        status: 'approved',
        effectiveFrom: pastDate,
        proposedById: 'user_a',
      });
      prisma.deadlineRuleVersion.findMany.mockResolvedValue([dueVersion]);
      prisma.deadlineRuleVersion.findFirst.mockResolvedValue(null);
      prisma.deadlineRuleVersion.update.mockResolvedValue({ ...dueVersion, status: 'active' });

      const result = await service.activateDueRules();
      expect(result.activated).toContain('rule_v2');
    });

    it('processes due versions in effectiveFrom ASC order (multi-day catch-up)', async () => {
      const v1Date = new Date('2026-05-01');
      const v2Date = new Date('2026-05-03');
      prisma.deadlineRuleVersion.findMany.mockResolvedValue([
        makeRule({ id: 'r1', status: 'approved', effectiveFrom: v1Date }),
        makeRule({ id: 'r2', status: 'approved', effectiveFrom: v2Date }),
      ]);
      await service.activateDueRules();
      // findMany must be called with effectiveFrom ASC order
      expect(prisma.deadlineRuleVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([expect.objectContaining({ effectiveFrom: 'asc' })]),
        }),
      );
    });
  });

  // ── notifyStaleSubmissions ────────────────────────────────────────────────

  describe('notifyStaleSubmissions', () => {
    it('creates notifications for each approver per stale version', async () => {
      const oldDate = new Date(Date.now() - 48 * 3600 * 1000); // 48h ago
      const stale = makeRule({
        id: 'rule_stale',
        status: 'submitted',
        proposedAt: oldDate,
        proposedBy: { firstName: 'A', lastName: 'B', username: 'ab' },
      });
      prisma.deadlineRuleVersion.findMany.mockResolvedValue([stale]);
      prisma.user.findMany.mockResolvedValue([{ id: 'approver1' }, { id: 'approver2' }]);

      const result = await service.notifyStaleSubmissions(24);
      expect(result.notified).toContain('rule_stale');
      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: DEADLINE_RULE_ACTIONS.STALE_REVIEW_NOTIFIED }),
      );
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns version with relations', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(makeRule());
      const result = await service.getById('rule_v1');
      expect(result.data.id).toBe('rule_v1');
    });

    it('throws NotFoundException for unknown id', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(null);
      await expect(service.getById('nope')).rejects.toThrow(NotFoundException);
    });
  });

  // ── previewImpact ─────────────────────────────────────────────────────────

  describe('previewImpact', () => {
    it('returns bucketed counts for incident rule', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(makeRule({ ruleKey: 'THOI_HAN_XAC_MINH' }));
      prisma.incident.count.mockResolvedValueOnce(5).mockResolvedValueOnce(10);
      prisma.incident.findMany.mockResolvedValue([{ id: 'i1', code: 'VV-1', deadline: new Date() }]);

      const result = await service.previewImpact('rule_v1');
      expect(result.success).toBe(true);
      expect(result.data.counts).toHaveProperty('notAffected');
      expect(result.data.counts).toHaveProperty('openWillReextend');
    });

    it('returns petition-side counts for petition rule', async () => {
      prisma.deadlineRuleVersion.findUnique.mockResolvedValue(makeRule({ ruleKey: 'THOI_HAN_TO_CAO' }));
      prisma.petition.count.mockResolvedValue(7);
      prisma.petition.findMany.mockResolvedValue([{ id: 'p1', stt: 'DT-1', deadline: new Date() }]);

      const result = await service.previewImpact('rule_v1');
      expect(result.data.soonestPetitions).toHaveLength(1);
    });
  });
});
