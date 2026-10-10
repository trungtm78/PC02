import { ConflictException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SubmissionController } from './submission.controller';
import { SubmissionService, SubmissionError } from './submission.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * GET/PATCH /bao-cao-dong/submissions/:assignmentId (spec §6.1 PR6).
 * Same unit-test pattern as templates.controller.spec.ts/
 * report-config.controller.spec.ts — mocked service, guard chain covered
 * by the route-permission gate spec.
 */
describe('SubmissionController', () => {
  let controller: SubmissionController;
  const service = {
    getSubmission: jest.fn(),
    save: jest.fn(),
    submit: jest.fn(),
    listMyAssignments: jest.fn(),
    listForManager: jest.fn(),
    getSubmissionForManager: jest.fn(),
    approve: jest.fn(),
    returnSubmission: jest.fn(),
    unapprove: jest.fn(),
    grantUnlock: jest.fn(),
    revokeActiveGrant: jest.fn(),
    requestUnlock: jest.fn(),
    listPendingRequests: jest.fn(),
    decideRequest: jest.fn(),
    bulkGrantUnlock: jest.fn(),
  };
  const user = { id: 'u1', roleId: 'r1' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubmissionController],
      providers: [
        { provide: SubmissionService, useValue: service },
        { provide: FeatureFlagsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get<SubmissionController>(SubmissionController);
  });

  it('GET (list) delegates to SubmissionService.listMyAssignments with the current user id', async () => {
    const rows = [{ assignmentId: 'assign1' }];
    service.listMyAssignments.mockResolvedValue(rows);

    const result = await controller.listMine(user);

    expect(service.listMyAssignments).toHaveBeenCalledWith('u1');
    expect(result).toBe(rows);
  });

  it('GET delegates to SubmissionService.getSubmission with the assignmentId and current user id', async () => {
    const view = { assignmentId: 'assign1', state: 'DRAFT' };
    service.getSubmission.mockResolvedValue(view);

    const result = await controller.get('assign1', user);

    expect(service.getSubmission).toHaveBeenCalledWith('assign1', 'u1');
    expect(result).toBe(view);
  });

  it('PATCH delegates to SubmissionService.save with values and expectedRevision', async () => {
    const saved = { revision: '1', state: 'DRAFT' };
    service.save.mockResolvedValue(saved);

    const result = await controller.save(
      'assign1',
      { values: { 'Đội 3!C6': '12' }, expectedRevision: '0' },
      user,
    );

    expect(service.save).toHaveBeenCalledWith(
      'assign1',
      'u1',
      { 'Đội 3!C6': '12' },
      '0',
      undefined,
    );
    expect(result).toBe(saved);
  });

  it('PATCH passes idempotencyKey through when given (S26, PR6 slice 7)', async () => {
    service.save.mockResolvedValue({ revision: '1', state: 'DRAFT' });

    await controller.save(
      'assign1',
      {
        values: { 'Đội 3!C6': '12' },
        expectedRevision: '0',
        idempotencyKey: 'key1',
      },
      user,
    );

    expect(service.save).toHaveBeenCalledWith(
      'assign1',
      'u1',
      { 'Đội 3!C6': '12' },
      '0',
      'key1',
    );
  });

  it('translates an IDEMPOTENCY_MISMATCH SubmissionError from save into a 400', async () => {
    service.save.mockRejectedValue(
      new SubmissionError('mismatch', 'IDEMPOTENCY_MISMATCH'),
    );

    await expect(
      controller.save(
        'assign1',
        { values: {}, expectedRevision: '0', idempotencyKey: 'key1' },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('translates a REVISION_CONFLICT SubmissionError into a 409', async () => {
    service.save.mockRejectedValue(
      new SubmissionError('conflict', 'REVISION_CONFLICT'),
    );

    await expect(
      controller.save('assign1', { values: {}, expectedRevision: '0' }, user),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('translates a CELL_VALIDATION SubmissionError into a 400', async () => {
    service.save.mockRejectedValue(
      new SubmissionError('bad cell', 'CELL_VALIDATION'),
    );

    await expect(
      controller.save('assign1', { values: {}, expectedRevision: '0' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rethrows an unexpected error unwrapped', async () => {
    service.save.mockRejectedValue(new Error('boom'));
    await expect(
      controller.save('assign1', { values: {}, expectedRevision: '0' }, user),
    ).rejects.toThrow('boom');
  });

  it('POST submit delegates to SubmissionService.submit with expectedRevision', async () => {
    const submitted = { revision: '2', state: 'SUBMITTED' };
    service.submit.mockResolvedValue(submitted);

    const result = await controller.submit(
      'assign1',
      { expectedRevision: '1' },
      user,
    );

    expect(service.submit).toHaveBeenCalledWith('assign1', 'u1', '1');
    expect(result).toBe(submitted);
  });

  it('translates an INVALID_STATE_TRANSITION SubmissionError into a 409', async () => {
    service.submit.mockRejectedValue(
      new SubmissionError('wrong state', 'INVALID_STATE_TRANSITION'),
    );

    await expect(
      controller.submit('assign1', { expectedRevision: '1' }, user),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('translates a CELL_VALIDATION SubmissionError from submit into a 400', async () => {
    service.submit.mockRejectedValue(
      new SubmissionError('missing required fields', 'CELL_VALIDATION'),
    );

    await expect(
      controller.submit('assign1', { expectedRevision: '1' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('GET manager delegates to SubmissionService.listForManager with the current user id and roleId', async () => {
    const rows = [{ assignmentId: 'assign1' }];
    service.listForManager.mockResolvedValue(rows);

    const result = await controller.listManager(user);

    expect(service.listForManager).toHaveBeenCalledWith('u1', 'r1');
    expect(result).toBe(rows);
  });

  it('GET :assignmentId/review delegates to SubmissionService.getSubmissionForManager', async () => {
    const view = {
      assignmentId: 'assign1',
      state: 'SUBMITTED',
      editable: false,
    };
    service.getSubmissionForManager.mockResolvedValue(view);

    const result = await controller.getForManager('assign1', user);

    expect(service.getSubmissionForManager).toHaveBeenCalledWith(
      'assign1',
      'u1',
      'r1',
    );
    expect(result).toBe(view);
  });

  it('POST approve delegates to SubmissionService.approve with expectedRevision and reason', async () => {
    const approved = { revision: '2', state: 'APPROVED' };
    service.approve.mockResolvedValue(approved);

    const result = await controller.approve(
      'assign1',
      { expectedRevision: '1', reason: 'OK' },
      user,
    );

    expect(service.approve).toHaveBeenCalledWith(
      'assign1',
      'u1',
      'r1',
      '1',
      'OK',
    );
    expect(result).toBe(approved);
  });

  it('POST return delegates to SubmissionService.returnSubmission with reason and returnDueAt', async () => {
    const returned = { revision: '2', state: 'RETURNED' };
    service.returnSubmission.mockResolvedValue(returned);

    const result = await controller.returnSubmission(
      'assign1',
      {
        expectedRevision: '1',
        reason: 'Thiếu số liệu',
        returnDueAt: '2026-06-20T17:00:00Z',
      },
      user,
    );

    expect(service.returnSubmission).toHaveBeenCalledWith(
      'assign1',
      'u1',
      'r1',
      '1',
      'Thiếu số liệu',
      '2026-06-20T17:00:00Z',
    );
    expect(result).toBe(returned);
  });

  it('POST unapprove delegates to SubmissionService.unapprove with expectedRevision and reason', async () => {
    const unapproved = { revision: '3', state: 'SUBMITTED' };
    service.unapprove.mockResolvedValue(unapproved);

    const result = await controller.unapprove(
      'assign1',
      { expectedRevision: '2', reason: 'cần xem lại' },
      user,
    );

    expect(service.unapprove).toHaveBeenCalledWith(
      'assign1',
      'u1',
      'r1',
      '2',
      'cần xem lại',
    );
    expect(result).toBe(unapproved);
  });

  it('translates a REPORT_LOCKED SubmissionError from approve into a 409', async () => {
    service.approve.mockRejectedValue(
      new SubmissionError('period finalized', 'REPORT_LOCKED'),
    );

    await expect(
      controller.approve('assign1', { expectedRevision: '1' }, user),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('translates a CELL_VALIDATION SubmissionError from return into a 400', async () => {
    service.returnSubmission.mockRejectedValue(
      new SubmissionError(
        'returnDueAt must be in the future',
        'CELL_VALIDATION',
      ),
    );

    await expect(
      controller.returnSubmission(
        'assign1',
        {
          expectedRevision: '1',
          reason: 'r',
          returnDueAt: '2020-01-01T00:00:00Z',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('POST unlock delegates to SubmissionService.grantUnlock with reason and expiresAt', async () => {
    const granted = {
      id: 'unlock1',
      expiresAt: '2026-06-15T13:00:00.000Z',
      reason: 'r',
    };
    service.grantUnlock.mockResolvedValue(granted);

    const result = await controller.grantUnlock(
      'assign1',
      { reason: 'Cho thêm giờ', expiresAt: '2026-06-15T13:00:00.000Z' },
      user,
    );

    expect(service.grantUnlock).toHaveBeenCalledWith(
      'assign1',
      'u1',
      'r1',
      'Cho thêm giờ',
      '2026-06-15T13:00:00.000Z',
    );
    expect(result).toBe(granted);
  });

  it('POST unlock/revoke delegates to SubmissionService.revokeActiveGrant with a reason', async () => {
    service.revokeActiveGrant.mockResolvedValue(undefined);

    await controller.revokeUnlock('assign1', { reason: 'Hết cần thiết' }, user);

    expect(service.revokeActiveGrant).toHaveBeenCalledWith(
      'assign1',
      'u1',
      'r1',
      'Hết cần thiết',
    );
  });

  it('translates a CELL_VALIDATION SubmissionError from revokeUnlock into a 400', async () => {
    service.revokeActiveGrant.mockRejectedValue(
      new SubmissionError('no active grant', 'CELL_VALIDATION'),
    );

    await expect(
      controller.revokeUnlock('assign1', { reason: 'r' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('translates a REPORT_LOCKED SubmissionError from grantUnlock into a 409', async () => {
    service.grantUnlock.mockRejectedValue(
      new SubmissionError('period finalized', 'REPORT_LOCKED'),
    );

    await expect(
      controller.grantUnlock('assign1', { reason: 'r' }, user),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('POST unlock/request delegates to SubmissionService.requestUnlock', async () => {
    const requested = { id: 'req1', teamName: 'Đội 3' };
    service.requestUnlock.mockResolvedValue(requested);

    const result = await controller.requestUnlock(
      'assign1',
      { reason: 'Nhập nhầm số' },
      user,
    );

    expect(service.requestUnlock).toHaveBeenCalledWith(
      'assign1',
      'u1',
      'Nhập nhầm số',
    );
    expect(result).toBe(requested);
  });

  it('GET unlock-requests delegates to SubmissionService.listPendingRequests', async () => {
    const queue = [{ id: 'req1' }];
    service.listPendingRequests.mockResolvedValue(queue);

    const result = await controller.listUnlockRequests(user);

    expect(service.listPendingRequests).toHaveBeenCalledWith('u1', 'r1');
    expect(result).toBe(queue);
  });

  it('POST unlock-requests/:unlockId/decide delegates to SubmissionService.decideRequest', async () => {
    service.decideRequest.mockResolvedValue(undefined);

    await controller.decideUnlockRequest(
      'req1',
      { decision: 'APPROVE', expiresAt: '2026-06-15T13:00:00.000Z' },
      user,
    );

    expect(service.decideRequest).toHaveBeenCalledWith(
      'req1',
      'u1',
      'r1',
      'APPROVE',
      undefined,
      '2026-06-15T13:00:00.000Z',
    );
  });

  it('translates a CELL_VALIDATION SubmissionError from decideRequest into a 400', async () => {
    service.decideRequest.mockRejectedValue(
      new SubmissionError('already decided', 'CELL_VALIDATION'),
    );

    await expect(
      controller.decideUnlockRequest('req1', { decision: 'APPROVE' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('POST unlock/bulk-grant delegates to SubmissionService.bulkGrantUnlock', async () => {
    const outcome = { granted: ['a1'], skipped: [] };
    service.bulkGrantUnlock.mockResolvedValue(outcome);

    const result = await controller.bulkGrantUnlock(
      { assignmentIds: ['a1'], reason: 'Quá hạn chung' },
      user,
    );

    expect(service.bulkGrantUnlock).toHaveBeenCalledWith(
      ['a1'],
      'u1',
      'r1',
      'Quá hạn chung',
      undefined,
    );
    expect(result).toBe(outcome);
  });
});
