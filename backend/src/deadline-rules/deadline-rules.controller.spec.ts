/**
 * DeadlineRulesController Unit Tests — smoke coverage for endpoint→service wiring.
 *
 * Service-layer logic lives in deadline-rules.service.spec.ts (49 tests). This
 * file covers the controller boundary: route shape, DTO pass-through, user/req
 * extraction, and that each route delegates to the right service method with
 * the right arguments. Guards are overridden so we don't need a real JWT or
 * permission seed.
 *
 * CT-001: POST /deadline-rules                     → service.propose
 * CT-002: PATCH /deadline-rules/:id                → service.updateDraft
 * CT-003: POST /deadline-rules/:id/submit          → service.submit
 * CT-004: POST /deadline-rules/:id/approve         → service.approve (with DTO body)
 * CT-005: POST /deadline-rules/:id/reject          → service.reject (with notes)
 * CT-006: POST /deadline-rules/:id/withdraw        → service.withdraw (proposer recall)
 * CT-007: POST /deadline-rules/:id/request-changes → service.requestChanges (approver send-back)
 * CT-008: DELETE /deadline-rules/:id               → service.deleteDraft
 * CT-009: GET routes pass through to service read methods
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { DeadlineRulesController } from './deadline-rules.controller';
import { DeadlineRulesService } from './deadline-rules.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

const USER_ID = 'user-self';
const VERSION_ID = 'rule_v1';

const mockService = {
  listActive: jest.fn(),
  getSummary: jest.fn(),
  getApprovalQueue: jest.fn(),
  getHistory: jest.fn(),
  getById: jest.fn(),
  previewImpact: jest.fn(),
  query: jest.fn(),
  propose: jest.fn(),
  updateDraft: jest.fn(),
  submit: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  withdraw: jest.fn(),
  requestChanges: jest.fn(),
  deleteDraft: jest.fn(),
};

function makeUser() {
  return { id: USER_ID } as any;
}

function makeReq() {
  return {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
  } as any;
}

describe('DeadlineRulesController', () => {
  let controller: DeadlineRulesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeadlineRulesController],
      providers: [{ provide: DeadlineRulesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DeadlineRulesController>(DeadlineRulesController);
    jest.clearAllMocks();
  });

  // ─── CT-001 ─────────────────────────────────────────────────────────────────

  describe('propose (CT-001)', () => {
    it('delegates to service.propose with dto, userId, and req meta', async () => {
      const dto = {
        ruleKey: 'THOI_HAN_XAC_MINH',
        value: 25,
        label: 'Thời hạn',
        legalBasis: 'Điều 147',
        documentType: 'TT',
        documentNumber: '28/2020',
        documentIssuer: 'BCA',
        reason: 'Cập nhật theo TT mới',
      } as any;
      mockService.propose.mockResolvedValue({ success: true, data: { id: VERSION_ID } });

      await controller.propose(dto, makeUser(), makeReq());

      expect(mockService.propose).toHaveBeenCalledWith(
        dto,
        USER_ID,
        expect.objectContaining({ ipAddress: '127.0.0.1', userAgent: 'jest' }),
      );
    });
  });

  // ─── CT-002 ─────────────────────────────────────────────────────────────────

  describe('updateDraft (CT-002)', () => {
    it('delegates to service.updateDraft with id, dto, userId', async () => {
      const dto = { reason: 'Sửa cho rõ hơn' } as any;
      mockService.updateDraft.mockResolvedValue({ success: true });

      await controller.updateDraft(VERSION_ID, dto, makeUser(), makeReq());

      expect(mockService.updateDraft).toHaveBeenCalledWith(
        VERSION_ID,
        dto,
        USER_ID,
        expect.any(Object),
      );
    });
  });

  // ─── CT-003 ─────────────────────────────────────────────────────────────────

  describe('submit (CT-003)', () => {
    it('delegates to service.submit with id and userId', async () => {
      mockService.submit.mockResolvedValue({ success: true });

      await controller.submit(VERSION_ID, makeUser(), makeReq());

      expect(mockService.submit).toHaveBeenCalledWith(VERSION_ID, USER_ID, expect.any(Object));
    });
  });

  // ─── CT-004 ─────────────────────────────────────────────────────────────────

  describe('approve (CT-004)', () => {
    it('delegates to service.approve with id, dto, userId', async () => {
      const dto = { effectiveFrom: '2026-06-01', notes: 'OK' } as any;
      mockService.approve.mockResolvedValue({ success: true });

      await controller.approve(VERSION_ID, dto, makeUser(), makeReq());

      expect(mockService.approve).toHaveBeenCalledWith(VERSION_ID, dto, USER_ID, expect.any(Object));
    });
  });

  // ─── CT-005 ─────────────────────────────────────────────────────────────────

  describe('reject (CT-005)', () => {
    it('delegates to service.reject with notes payload', async () => {
      const dto = { notes: 'Thiếu căn cứ pháp lý' } as any;
      mockService.reject.mockResolvedValue({ success: true });

      await controller.reject(VERSION_ID, dto, makeUser(), makeReq());

      expect(mockService.reject).toHaveBeenCalledWith(VERSION_ID, dto, USER_ID, expect.any(Object));
    });
  });

  // ─── CT-006 ─────────────────────────────────────────────────────────────────

  describe('withdraw (CT-006)', () => {
    it('delegates to service.withdraw with WithdrawRuleDto payload', async () => {
      const dto = { withdrawNotes: 'Sai số liệu — cần sửa' } as any;
      mockService.withdraw.mockResolvedValue({ success: true });

      await controller.withdraw(VERSION_ID, dto, makeUser(), makeReq());

      expect(mockService.withdraw).toHaveBeenCalledWith(
        VERSION_ID,
        dto,
        USER_ID,
        expect.objectContaining({ ipAddress: '127.0.0.1' }),
      );
    });
  });

  // ─── CT-007 ─────────────────────────────────────────────────────────────────

  describe('requestChanges (CT-007)', () => {
    it('delegates to service.requestChanges with RequestChangesDto payload', async () => {
      const dto = { reviewNotes: 'Cần bổ sung Điều 147 khoản 2' } as any;
      mockService.requestChanges.mockResolvedValue({ success: true });

      await controller.requestChanges(VERSION_ID, dto, makeUser(), makeReq());

      expect(mockService.requestChanges).toHaveBeenCalledWith(
        VERSION_ID,
        dto,
        USER_ID,
        expect.objectContaining({ ipAddress: '127.0.0.1' }),
      );
    });
  });

  // ─── CT-008 ─────────────────────────────────────────────────────────────────

  describe('deleteDraft (CT-008)', () => {
    it('delegates to service.deleteDraft with id and userId', async () => {
      mockService.deleteDraft.mockResolvedValue({ success: true });

      await controller.deleteDraft(VERSION_ID, makeUser(), makeReq());

      expect(mockService.deleteDraft).toHaveBeenCalledWith(VERSION_ID, USER_ID, expect.any(Object));
    });
  });

  // ─── CT-009: GET read routes pass-through ───────────────────────────────────

  describe('read endpoints (CT-009)', () => {
    it('listActive → service.listActive()', async () => {
      mockService.listActive.mockResolvedValue({ success: true, data: [] });
      await controller.listActive();
      expect(mockService.listActive).toHaveBeenCalledTimes(1);
    });

    it('getSummary → service.getSummary()', async () => {
      mockService.getSummary.mockResolvedValue({ success: true });
      await controller.getSummary();
      expect(mockService.getSummary).toHaveBeenCalledTimes(1);
    });

    it('getApprovalQueue → service.getApprovalQueue()', async () => {
      mockService.getApprovalQueue.mockResolvedValue({ success: true, data: [] });
      await controller.getApprovalQueue();
      expect(mockService.getApprovalQueue).toHaveBeenCalledTimes(1);
    });

    it('getHistory(key) → service.getHistory(key)', async () => {
      mockService.getHistory.mockResolvedValue({ success: true, data: [] });
      await controller.getHistory('THOI_HAN_XAC_MINH');
      expect(mockService.getHistory).toHaveBeenCalledWith('THOI_HAN_XAC_MINH');
    });

    it('getById(id) → service.getById(id)', async () => {
      mockService.getById.mockResolvedValue({ success: true, data: { id: VERSION_ID } });
      await controller.getById(VERSION_ID);
      expect(mockService.getById).toHaveBeenCalledWith(VERSION_ID);
    });

    it('previewImpact(id) → service.previewImpact(id)', async () => {
      mockService.previewImpact.mockResolvedValue({ success: true });
      await controller.previewImpact(VERSION_ID);
      expect(mockService.previewImpact).toHaveBeenCalledWith(VERSION_ID);
    });

    it('query(q) → service.query(q)', async () => {
      const q = { ruleKey: 'THOI_HAN_TO_CAO' } as any;
      mockService.query.mockResolvedValue({ success: true, data: [] });
      await controller.query(q);
      expect(mockService.query).toHaveBeenCalledWith(q);
    });
  });
});
