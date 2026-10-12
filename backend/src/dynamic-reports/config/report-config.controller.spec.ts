import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  const service = {
    save: jest.fn(),
    suspendGeneration: jest.fn(),
    listVersions: jest.fn(),
  };
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

  it('translates WORKER_BUSY into a 503 (retry later), not a 400 about the template', async () => {
    service.save.mockRejectedValue(new ReportConfigError('Hàng đợi đầy', 'WORKER_BUSY'));

    await expect(controller.save(file, body, user)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('translates WORKER_BUSY into a 503 (retry later), not a 400 about the template', async () => {
    service.save.mockRejectedValue(new ReportConfigError('Hàng đợi đầy', 'WORKER_BUSY'));

    await expect(controller.save(file, body, user)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
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

  describe('suspend (S31 "Ngừng phát sinh")', () => {
    it('delegates to ReportConfigService.suspendGeneration with the reportId', async () => {
      service.suspendGeneration.mockResolvedValue({ status: 'SUSPENDED' });

      const result = await controller.suspend('rep1');

      expect(service.suspendGeneration).toHaveBeenCalledWith('rep1');
      expect(result).toEqual({ status: 'SUSPENDED' });
    });

    it('translates REPORT_NOT_FOUND into a 404', async () => {
      service.suspendGeneration.mockRejectedValue(
        new ReportConfigError(
          'Không tìm thấy báo cáo này.',
          'REPORT_NOT_FOUND',
        ),
      );

      await expect(controller.suspend('rep1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('translates INVALID_STATE into a 400 carrying its code', async () => {
      service.suspendGeneration.mockRejectedValue(
        new ReportConfigError('Sai trạng thái', 'INVALID_STATE'),
      );

      await expect(controller.suspend('rep1')).rejects.toMatchObject({
        status: 400,
        response: { code: 'INVALID_STATE', message: 'Sai trạng thái' },
      });
    });
  });

  describe('listVersions (S22 "Danh sách phiên bản")', () => {
    it('delegates to ReportConfigService.listVersions with the reportId', async () => {
      const versions = [
        {
          versionId: 'ver1',
          version: 1,
          status: 'PUBLISHED',
          publishedAt: null,
          createdAt: 'x',
          periodKeys: [],
        },
      ];
      service.listVersions.mockResolvedValue(versions);

      const result = await controller.listVersions('rep1');

      expect(service.listVersions).toHaveBeenCalledWith('rep1');
      expect(result).toBe(versions);
    });

    it('translates REPORT_NOT_FOUND into a 404', async () => {
      service.listVersions.mockRejectedValue(
        new ReportConfigError(
          'Không tìm thấy báo cáo này.',
          'REPORT_NOT_FOUND',
        ),
      );

      await expect(controller.listVersions('rep1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
