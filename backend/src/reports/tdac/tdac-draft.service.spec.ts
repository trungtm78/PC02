/**
 * TdacDraftService Unit Tests
 *
 * UT-001: submitReview throws BadRequestException if status is not DRAFT
 * UT-002: approve throws BadRequestException if status is not REVIEWING
 * UT-003: finalize uses optimistic lock – throws 409 ConflictException if not APPROVED
 * UT-004: reject sets rejectedReason and nullifies reviewedById / reviewedAt
 * UT-005: reopen transitions REJECTED -> DRAFT and nulls reviewedById/reviewedAt
 * UT-006: create sets status=DRAFT and associates createdById
 * UT-007: update throws if draft is FINALIZED
 * UT-008: finalize succeeds when draft is APPROVED
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TdacDraftService } from './tdac-draft.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  reportTdcDraft: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';
const DRAFT_ID = 'draft-001';

function makeDraft(overrides: Partial<{
  id: string;
  status: string;
  loaiBaoCao: string;
  fromDate: Date;
  toDate: Date;
  teamIds: string[];
  computedData: object;
  adjustedData: object | null;
  notes: string | null;
  createdById: string;
  reviewedById: string | null;
  reviewedAt: Date | null;
  approvedById: string | null;
  approvedAt: Date | null;
  rejectedById: string | null;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: DRAFT_ID,
    status: 'DRAFT',
    loaiBaoCao: 'VU_AN',
    fromDate: new Date('2025-01-01'),
    toDate: new Date('2025-12-31'),
    teamIds: [],
    computedData: {},
    adjustedData: null,
    notes: null,
    createdById: USER_ID,
    reviewedById: null,
    reviewedAt: null,
    approvedById: null,
    approvedAt: null,
    rejectedById: null,
    rejectedAt: null,
    rejectedReason: null,
    finalizedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('TdacDraftService', () => {
  let service: TdacDraftService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TdacDraftService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TdacDraftService>(TdacDraftService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─── UT-001: submitReview – status guard ─────────────────────────────────────

  describe('submitReview', () => {
    it('UT-001: throws BadRequestException if draft is not in DRAFT status', async () => {
      const reviewingDraft = makeDraft({ status: 'REVIEWING' });
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(reviewingDraft);

      await expect(service.submitReview(DRAFT_ID, USER_ID)).rejects.toThrow(BadRequestException);
      await expect(service.submitReview(DRAFT_ID, USER_ID)).rejects.toThrow(/REVIEWING/);
    });

    it('UT-001b: succeeds and sets status=REVIEWING when draft is DRAFT', async () => {
      const draft = makeDraft({ status: 'DRAFT' });
      const updated = makeDraft({ status: 'REVIEWING', reviewedById: USER_ID, reviewedAt: new Date() });

      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(draft);
      mockPrisma.reportTdcDraft.update.mockResolvedValue(updated);

      const result = await service.submitReview(DRAFT_ID, USER_ID);

      expect(result.status).toBe('REVIEWING');
      expect(mockPrisma.reportTdcDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DRAFT_ID },
          data: expect.objectContaining({ status: 'REVIEWING', reviewedById: USER_ID }),
        }),
      );
    });

    it('UT-001c: throws BadRequestException if draft is FINALIZED', async () => {
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(makeDraft({ status: 'FINALIZED' }));

      await expect(service.submitReview(DRAFT_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── UT-002: approve – status guard ──────────────────────────────────────────

  describe('approve', () => {
    it('UT-002: throws BadRequestException if draft is not in REVIEWING status', async () => {
      const draftDraft = makeDraft({ status: 'DRAFT' });
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(draftDraft);

      await expect(service.approve(DRAFT_ID, USER_ID)).rejects.toThrow(BadRequestException);
      await expect(service.approve(DRAFT_ID, USER_ID)).rejects.toThrow(/DRAFT/);
    });

    it('UT-002b: succeeds and sets status=APPROVED when draft is REVIEWING', async () => {
      const reviewing = makeDraft({ status: 'REVIEWING' });
      const approved = makeDraft({ status: 'APPROVED', approvedById: USER_ID, approvedAt: new Date() });

      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(reviewing);
      mockPrisma.reportTdcDraft.update.mockResolvedValue(approved);

      const result = await service.approve(DRAFT_ID, USER_ID);

      expect(result.status).toBe('APPROVED');
      expect(mockPrisma.reportTdcDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED', approvedById: USER_ID }),
        }),
      );
    });

    it('UT-002c: throws if draft is REJECTED', async () => {
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(makeDraft({ status: 'REJECTED' }));

      await expect(service.approve(DRAFT_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── UT-003: finalize – optimistic lock ───────────────────────────────────────

  describe('finalize', () => {
    it('UT-003: throws ConflictException (409) if draft is already FINALIZED (optimistic lock)', async () => {
      // updateMany returns count=0 because the WHERE { status: APPROVED } did not match
      mockPrisma.reportTdcDraft.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(
        makeDraft({ status: 'FINALIZED' }),
      );

      await expect(service.finalize(DRAFT_ID, USER_ID)).rejects.toThrow(ConflictException);
    });

    it('UT-003b: throws ConflictException if draft is in DRAFT status (concurrent modification)', async () => {
      mockPrisma.reportTdcDraft.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(
        makeDraft({ status: 'DRAFT' }),
      );

      await expect(service.finalize(DRAFT_ID, USER_ID)).rejects.toThrow(ConflictException);
    });

    it('UT-003c: throws NotFoundException if draft does not exist at all', async () => {
      mockPrisma.reportTdcDraft.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(null);

      await expect(service.finalize(DRAFT_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('UT-008: finalize succeeds and returns FINALIZED draft when status is APPROVED', async () => {
      const finalizedDraft = makeDraft({ status: 'FINALIZED', finalizedAt: new Date() });

      mockPrisma.reportTdcDraft.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(finalizedDraft);

      const result = await service.finalize(DRAFT_ID, USER_ID);

      expect(result.status).toBe('FINALIZED');
      expect(mockPrisma.reportTdcDraft.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DRAFT_ID, status: 'APPROVED' },
          data: expect.objectContaining({ status: 'FINALIZED' }),
        }),
      );
    });
  });

  // ─── UT-004: reject ───────────────────────────────────────────────────────────

  describe('reject', () => {
    it('UT-004: sets rejectedReason and nullifies reviewedById + reviewedAt', async () => {
      const reviewing = makeDraft({
        status: 'REVIEWING',
        reviewedById: 'reviewer-1',
        reviewedAt: new Date(),
      });
      const rejected = makeDraft({
        status: 'REJECTED',
        rejectedReason: 'Số liệu sai',
        rejectedById: USER_ID,
        reviewedById: null,
        reviewedAt: null,
      });

      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(reviewing);
      mockPrisma.reportTdcDraft.update.mockResolvedValue(rejected);

      const result = await service.reject(DRAFT_ID, USER_ID, 'Số liệu sai');

      expect(result.status).toBe('REJECTED');
      expect(mockPrisma.reportTdcDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            rejectedReason: 'Số liệu sai',
            rejectedById: USER_ID,
            reviewedById: null,
            reviewedAt: null,
          }),
        }),
      );
    });

    it('UT-004b: throws BadRequestException if draft is not REVIEWING', async () => {
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(makeDraft({ status: 'DRAFT' }));

      await expect(service.reject(DRAFT_ID, USER_ID, 'reason')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── UT-005: reopen ───────────────────────────────────────────────────────────

  describe('reopen', () => {
    it('UT-005: transitions REJECTED -> DRAFT and nullifies reviewedById/reviewedAt', async () => {
      const rejected = makeDraft({
        status: 'REJECTED',
        rejectedById: 'user-x',
        rejectedAt: new Date(),
        rejectedReason: 'Old reason',
      });
      const reopened = makeDraft({
        status: 'DRAFT',
        rejectedById: null,
        rejectedAt: null,
        rejectedReason: null,
      });

      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(rejected);
      mockPrisma.reportTdcDraft.update.mockResolvedValue(reopened);

      const result = await service.reopen(DRAFT_ID, USER_ID);

      expect(result.status).toBe('DRAFT');
      expect(mockPrisma.reportTdcDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
            rejectedById: null,
            rejectedAt: null,
            rejectedReason: null,
          }),
        }),
      );
    });

    it('UT-005b: throws BadRequestException if draft is not REJECTED', async () => {
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(makeDraft({ status: 'DRAFT' }));

      await expect(service.reopen(DRAFT_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('UT-005c: throws BadRequestException if draft is FINALIZED', async () => {
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(makeDraft({ status: 'FINALIZED' }));

      await expect(service.reopen(DRAFT_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── UT-006: create ───────────────────────────────────────────────────────────

  describe('create', () => {
    it('UT-006: creates draft with status=DRAFT and createdById', async () => {
      const created = makeDraft({ status: 'DRAFT', createdById: USER_ID });
      mockPrisma.reportTdcDraft.create.mockResolvedValue(created);

      const dto = {
        loaiBaoCao: 'VU_AN',
        fromDate: '2025-01-01',
        toDate: '2025-12-31',
        teamIds: ['team-1'],
      };

      const result = await service.create(dto as any, USER_ID);

      expect(result.status).toBe('DRAFT');
      expect(mockPrisma.reportTdcDraft.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
            createdById: USER_ID,
            loaiBaoCao: 'VU_AN',
          }),
        }),
      );
    });
  });

  // ─── UT-007: update – FINALIZED guard ────────────────────────────────────────

  describe('update', () => {
    it('UT-007: throws BadRequestException when trying to update a FINALIZED draft', async () => {
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(makeDraft({ status: 'FINALIZED' }));

      await expect(
        service.update(DRAFT_ID, { adjustedData: {} } as any, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('UT-007b: update succeeds for non-FINALIZED draft', async () => {
      const draft = makeDraft({ status: 'DRAFT' });
      const updated = makeDraft({ status: 'DRAFT', notes: 'Updated notes' });

      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(draft);
      mockPrisma.reportTdcDraft.update.mockResolvedValue(updated);

      const result = await service.update(DRAFT_ID, { notes: 'Updated notes' } as any, USER_ID);

      expect(result.notes).toBe('Updated notes');
    });
  });

  // ─── findOne – NotFoundException ─────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when draft does not exist', async () => {
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns draft when found', async () => {
      const draft = makeDraft();
      mockPrisma.reportTdcDraft.findUnique.mockResolvedValue(draft);

      const result = await service.findOne(DRAFT_ID);
      expect(result).toEqual(draft);
    });
  });
});
