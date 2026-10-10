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
  const service = { getSubmission: jest.fn(), save: jest.fn() };
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
    );
    expect(result).toBe(saved);
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
});
