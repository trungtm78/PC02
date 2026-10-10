import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportConfigController } from './report-config.controller';
import {
  ReportConfigService,
  ReportConfigError,
} from './report-config.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { SaveReportConfigRequestDto } from './dto/save-report-config.dto';

/**
 * POST /bao-cao-dong/reports (spec §6.1 PR4, S09/S10). Same unit-test
 * pattern as templates.controller.spec.ts — mocked service, guard chain
 * covered by the route-permission gate spec.
 */
describe('ReportConfigController', () => {
  let controller: ReportConfigController;
  const service = { save: jest.fn() };
  const user = { id: 'actor1', roleId: 'r1' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportConfigController],
      providers: [
        { provide: ReportConfigService, useValue: service },
        { provide: FeatureFlagsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get<ReportConfigController>(ReportConfigController);
  });

  const file = {
    buffer: Buffer.from('fake'),
    originalname: 'mau.xlsx',
  } as Express.Multer.File;
  const body = {
    config: { code: 'HSLN' },
  } as unknown as SaveReportConfigRequestDto;

  it('rejects with 400 when no file is attached', async () => {
    await expect(controller.save(undefined, body, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.save).not.toHaveBeenCalled();
  });

  it('delegates to ReportConfigService.save with the buffer, filename, config and actor id', async () => {
    const saved = { reportId: 'rep1', versionId: 'ver1', status: 'DRAFT' };
    service.save.mockResolvedValue(saved);

    const result = await controller.save(file, body, user);

    expect(service.save).toHaveBeenCalledWith(
      body.config,
      file.buffer,
      'mau.xlsx',
      'actor1',
    );
    expect(result).toBe(saved);
  });

  it('translates a REPORT_CODE_TAKEN ReportConfigError into a 409', async () => {
    service.save.mockRejectedValue(
      new ReportConfigError('Mã đã dùng', 'REPORT_CODE_TAKEN'),
    );

    await expect(controller.save(file, body, user)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('translates any other ReportConfigError into a 400 carrying its code', async () => {
    service.save.mockRejectedValue(
      new ReportConfigError('Thiếu quản lý', 'TEMPLATE_INVALID'),
    );

    await expect(controller.save(file, body, user)).rejects.toMatchObject({
      status: 400,
      response: { code: 'TEMPLATE_INVALID', message: 'Thiếu quản lý' },
    });
  });

  it('rethrows an unexpected error unwrapped', async () => {
    service.save.mockRejectedValue(new Error('boom'));
    await expect(controller.save(file, body, user)).rejects.toThrow('boom');
  });
});
