/**
 * TdacController Unit Tests
 *
 * CT-001: GET /reports/tdac/vu-an — accessible with 'read' on 'Case', delegates to TdacService
 * CT-002: GET /reports/tdac/vu-viec — accessible with 'read' on 'Case', delegates to TdacService
 * CT-003: POST /reports/tdac/drafts/:id/approve — requires 'approve' on 'Report'
 * CT-004: POST /reports/tdac/drafts/:id/finalize — requires 'approve' on 'Report'
 * CT-005: teamIds validation — user without canDispatch requesting forbidden teamId → ForbiddenException
 * CT-006: canDispatch user bypasses teamId scope check
 * CT-007: POST /reports/tdac/drafts — creates draft via draftService
 * CT-008: GET /reports/tdac/drafts — lists drafts via draftService
 * CT-009: PATCH /reports/tdac/drafts/:id — updates draft via draftService
 * CT-010: POST /reports/tdac/drafts/:id/submit-review — delegates to draftService
 * CT-011: POST /reports/tdac/drafts/:id/reject — delegates to draftService with reason
 * CT-012: POST /reports/tdac/drafts/:id/reopen — delegates to draftService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TdacController } from './tdac.controller';
import { TdacService } from './tdac.service';
import { TdacDraftService } from './tdac-draft.service';
import { TdacExportService } from './tdac-export.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

// ─── Mock Services ────────────────────────────────────────────────────────────

const mockTdacService = {
  computeTdcVuAn: jest.fn(),
  computeTdcVuViec: jest.fn(),
};

const mockDraftService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  submitReview: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  reopen: jest.fn(),
  finalize: jest.fn(),
};

const mockExportService = {
  export: jest.fn(),
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DRAFT_ID = 'draft-001';
const USER_ID = 'user-abc';

function makeReq(overrides: Partial<{
  id: string;
  canDispatch: boolean;
  teamIds: string[];
}> = {}) {
  return {
    user: {
      id: USER_ID,
      canDispatch: false,
      teamIds: [],
      ...overrides,
    },
  } as any;
}

function makeDraft(overrides: Partial<{ id: string; status: string }> = {}) {
  return {
    id: DRAFT_ID,
    status: 'DRAFT',
    loaiBaoCao: 'VU_AN',
    fromDate: new Date('2025-01-01'),
    toDate: new Date('2025-12-31'),
    teamIds: [],
    computedData: {},
    createdById: USER_ID,
    ...overrides,
  };
}

const MOCK_REPORT_DATA = {
  rows: [],
  fromDate: new Date('2025-01-01'),
  toDate: new Date('2025-12-31'),
  teamIds: ['team-1'],
  generatedAt: new Date(),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('TdacController', () => {
  let controller: TdacController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TdacController],
      providers: [
        { provide: TdacService, useValue: mockTdacService },
        { provide: TdacDraftService, useValue: mockDraftService },
        { provide: TdacExportService, useValue: mockExportService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TdacController>(TdacController);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─── CT-001: GET vu-an ────────────────────────────────────────────────────

  describe('getVuAn (CT-001)', () => {
    it('delegates to TdacService.computeTdcVuAn with parsed dates and teamIds', async () => {
      mockTdacService.computeTdcVuAn.mockResolvedValue(MOCK_REPORT_DATA);

      const req = makeReq({ canDispatch: true });
      const result = await controller.getVuAn(
        { fromDate: '2025-01-01', toDate: '2025-12-31', teamIds: 'team-1,team-2' } as any,
        req,
      );

      expect(mockTdacService.computeTdcVuAn).toHaveBeenCalledWith(
        new Date('2025-01-01'),
        new Date('2025-12-31'),
        ['team-1', 'team-2'],
      );
      expect(result).toBe(MOCK_REPORT_DATA);
    });

    it('passes empty array when teamIds query param is empty', async () => {
      mockTdacService.computeTdcVuAn.mockResolvedValue(MOCK_REPORT_DATA);

      const req = makeReq({ canDispatch: true });
      await controller.getVuAn(
        { fromDate: '2025-01-01', toDate: '2025-12-31', teamIds: '' } as any,
        req,
      );

      expect(mockTdacService.computeTdcVuAn).toHaveBeenCalledWith(
        new Date('2025-01-01'),
        new Date('2025-12-31'),
        [],
      );
    });
  });

  // ─── CT-002: GET vu-viec ──────────────────────────────────────────────────

  describe('getVuViec (CT-002)', () => {
    it('delegates to TdacService.computeTdcVuViec with parsed params', async () => {
      mockTdacService.computeTdcVuViec.mockResolvedValue(MOCK_REPORT_DATA);

      const req = makeReq({ canDispatch: true });
      const result = await controller.getVuViec(
        { fromDate: '2025-01-01', toDate: '2025-12-31', teamIds: 'team-1' } as any,
        req,
      );

      expect(mockTdacService.computeTdcVuViec).toHaveBeenCalledWith(
        new Date('2025-01-01'),
        new Date('2025-12-31'),
        ['team-1'],
      );
      expect(result).toBe(MOCK_REPORT_DATA);
    });
  });

  // ─── CT-003: approve delegates to draftService ────────────────────────────

  describe('approve (CT-003)', () => {
    it('delegates to draftService.approve with id and userId', async () => {
      const approved = makeDraft({ status: 'APPROVED' });
      mockDraftService.approve.mockResolvedValue(approved);

      const req = makeReq();
      const result = await controller.approve(DRAFT_ID, req);

      expect(mockDraftService.approve).toHaveBeenCalledWith(DRAFT_ID, USER_ID);
      expect(result.status).toBe('APPROVED');
    });
  });

  // ─── CT-004: finalize delegates to draftService ───────────────────────────

  describe('finalize (CT-004)', () => {
    it('delegates to draftService.finalize with id and userId', async () => {
      const finalized = makeDraft({ status: 'FINALIZED' });
      mockDraftService.finalize.mockResolvedValue(finalized);

      const req = makeReq();
      const result = await controller.finalize(DRAFT_ID, req);

      expect(mockDraftService.finalize).toHaveBeenCalledWith(DRAFT_ID, USER_ID);
      expect(result.status).toBe('FINALIZED');
    });
  });

  // ─── CT-005: teamId scope enforcement ────────────────────────────────────

  describe('teamIds validation (CT-005)', () => {
    it('throws ForbiddenException when non-canDispatch user requests teamId outside their teams', async () => {
      // User is in team-1 only, requests team-2
      const req = makeReq({ canDispatch: false, teamIds: ['team-1'] });

      await expect(
        controller.getVuAn({ fromDate: '2025-01-01', toDate: '2025-12-31', teamIds: 'team-2' } as any, req),
      ).rejects.toThrow(ForbiddenException);

      expect(mockTdacService.computeTdcVuAn).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when user requests one valid and one forbidden teamId', async () => {
      const req = makeReq({ canDispatch: false, teamIds: ['team-1'] });

      await expect(
        controller.getVuAn({ fromDate: '2025-01-01', toDate: '2025-12-31', teamIds: 'team-1,team-99' } as any, req),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows access when requested teamIds are a subset of user teamIds', async () => {
      mockTdacService.computeTdcVuAn.mockResolvedValue(MOCK_REPORT_DATA);
      const req = makeReq({ canDispatch: false, teamIds: ['team-1', 'team-2'] });

      await expect(
        controller.getVuAn({ fromDate: '2025-01-01', toDate: '2025-12-31', teamIds: 'team-1' } as any, req),
      ).resolves.toBe(MOCK_REPORT_DATA);
    });

    it('allows empty teamIds for user with no team scope restriction', async () => {
      mockTdacService.computeTdcVuAn.mockResolvedValue(MOCK_REPORT_DATA);
      // User with empty teamIds means no restriction
      const req = makeReq({ canDispatch: false, teamIds: [] });

      await expect(
        controller.getVuAn({ fromDate: '2025-01-01', toDate: '2025-12-31', teamIds: 'any-team' } as any, req),
      ).resolves.toBe(MOCK_REPORT_DATA);
    });
  });

  // ─── CT-006: canDispatch bypasses scope check ─────────────────────────────

  describe('canDispatch bypass (CT-006)', () => {
    it('canDispatch user can request any teamId without ForbiddenException', async () => {
      mockTdacService.computeTdcVuAn.mockResolvedValue(MOCK_REPORT_DATA);
      const req = makeReq({ canDispatch: true, teamIds: ['team-1'] });

      // Requests team-99 which is not in user.teamIds — should still succeed
      await expect(
        controller.getVuAn({ fromDate: '2025-01-01', toDate: '2025-12-31', teamIds: 'team-99' } as any, req),
      ).resolves.toBe(MOCK_REPORT_DATA);

      expect(mockTdacService.computeTdcVuAn).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        ['team-99'],
      );
    });
  });

  // ─── CT-007: createDraft ──────────────────────────────────────────────────

  describe('createDraft (CT-007)', () => {
    it('delegates to draftService.create and enforces teamIds access', async () => {
      const created = makeDraft();
      mockDraftService.create.mockResolvedValue(created);

      const dto = {
        loaiBaoCao: 'VU_AN',
        fromDate: '2025-01-01',
        toDate: '2025-12-31',
        teamIds: ['team-1'],
      };
      const req = makeReq({ canDispatch: false, teamIds: ['team-1'] });

      const result = await controller.createDraft(dto as any, req);

      expect(mockDraftService.create).toHaveBeenCalledWith(dto, USER_ID);
      expect(result.status).toBe('DRAFT');
    });

    it('throws ForbiddenException when createDraft dto.teamIds contains forbidden team', async () => {
      const dto = {
        loaiBaoCao: 'VU_AN',
        fromDate: '2025-01-01',
        toDate: '2025-12-31',
        teamIds: ['team-forbidden'],
      };
      const req = makeReq({ canDispatch: false, teamIds: ['team-1'] });

      await expect(controller.createDraft(dto as any, req)).rejects.toThrow(ForbiddenException);
      expect(mockDraftService.create).not.toHaveBeenCalled();
    });
  });

  // ─── CT-008: listDrafts ───────────────────────────────────────────────────

  describe('listDrafts (CT-008)', () => {
    it('delegates to draftService.findAll with optional filters', async () => {
      const drafts = [makeDraft()];
      mockDraftService.findAll.mockResolvedValue(drafts);

      const result = await controller.listDrafts('VU_AN', 'DRAFT');

      expect(mockDraftService.findAll).toHaveBeenCalledWith({ loaiBaoCao: 'VU_AN', status: 'DRAFT' });
      expect(result).toEqual(drafts);
    });

    it('passes undefined filters when no query params provided', async () => {
      mockDraftService.findAll.mockResolvedValue([]);

      await controller.listDrafts(undefined, undefined);

      expect(mockDraftService.findAll).toHaveBeenCalledWith({ loaiBaoCao: undefined, status: undefined });
    });
  });

  // ─── CT-009: updateDraft ──────────────────────────────────────────────────

  describe('updateDraft (CT-009)', () => {
    it('delegates to draftService.update with id, dto, and userId', async () => {
      const updated = makeDraft({ status: 'DRAFT' });
      mockDraftService.update.mockResolvedValue(updated);

      const dto = { notes: 'Updated' };
      const req = makeReq();

      const result = await controller.updateDraft(DRAFT_ID, dto as any, req);

      expect(mockDraftService.update).toHaveBeenCalledWith(DRAFT_ID, dto, USER_ID);
      expect(result).toEqual(updated);
    });
  });

  // ─── CT-010: submitReview ─────────────────────────────────────────────────

  describe('submitReview (CT-010)', () => {
    it('delegates to draftService.submitReview with id and userId', async () => {
      const reviewing = makeDraft({ status: 'REVIEWING' });
      mockDraftService.submitReview.mockResolvedValue(reviewing);

      const req = makeReq();
      const result = await controller.submitReview(DRAFT_ID, req);

      expect(mockDraftService.submitReview).toHaveBeenCalledWith(DRAFT_ID, USER_ID);
      expect(result.status).toBe('REVIEWING');
    });
  });

  // ─── CT-011: reject ───────────────────────────────────────────────────────

  describe('reject (CT-011)', () => {
    it('delegates to draftService.reject with id, userId, and reason', async () => {
      const rejected = makeDraft({ status: 'REJECTED' });
      mockDraftService.reject.mockResolvedValue(rejected);

      const req = makeReq();
      const result = await controller.reject(DRAFT_ID, { reason: 'Số liệu sai' }, req);

      expect(mockDraftService.reject).toHaveBeenCalledWith(DRAFT_ID, USER_ID, 'Số liệu sai');
      expect(result.status).toBe('REJECTED');
    });
  });

  // ─── CT-012: reopen ───────────────────────────────────────────────────────

  describe('reopen (CT-012)', () => {
    it('delegates to draftService.reopen with id and userId', async () => {
      const reopened = makeDraft({ status: 'DRAFT' });
      mockDraftService.reopen.mockResolvedValue(reopened);

      const req = makeReq();
      const result = await controller.reopen(DRAFT_ID, req);

      expect(mockDraftService.reopen).toHaveBeenCalledWith(DRAFT_ID, USER_ID);
      expect(result.status).toBe('DRAFT');
    });
  });
});
