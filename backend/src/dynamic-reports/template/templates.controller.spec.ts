import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TemplatesController } from './templates.controller';
import { TemplateService, TemplateValidationError } from './template.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * POST /bao-cao-dong/templates/{sheets,preview} (spec §6.1 PR4, S02/S03).
 * Unit test only wires the controller to a mocked TemplateService — the
 * guard chain (JwtAuthGuard, FeatureFlagGuard, PermissionsGuard) is
 * exercised by the route-permission gate spec, not here; NestJS still
 * needs their dependencies resolvable at compile time (same workaround as
 * clock.controller.spec.ts / reports.controller.spec.ts).
 */
describe('TemplatesController', () => {
  let controller: TemplatesController;
  const service = { listSheets: jest.fn(), validateAndParse: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        { provide: TemplateService, useValue: service },
        { provide: FeatureFlagsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get<TemplatesController>(TemplatesController);
  });

  const file = { buffer: Buffer.from('fake') } as Express.Multer.File;

  describe('POST sheets', () => {
    it('rejects with 400 when no file is attached', async () => {
      await expect(controller.listSheets(undefined)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(service.listSheets).not.toHaveBeenCalled();
    });

    it('delegates to TemplateService.listSheets with the uploaded buffer', async () => {
      const sheets = [{ name: 'Sheet1', state: 'visible' }];
      service.listSheets.mockResolvedValue(sheets);

      const result = await controller.listSheets(file);

      expect(service.listSheets).toHaveBeenCalledWith(file.buffer);
      expect(result).toBe(sheets);
    });

    it('translates a TemplateValidationError into a 400 carrying its code', async () => {
      service.listSheets.mockRejectedValue(
        new TemplateValidationError('File quá lớn', 'FILE_TOO_LARGE'),
      );

      await expect(controller.listSheets(file)).rejects.toMatchObject({
        status: 400,
        response: { code: 'FILE_TOO_LARGE', message: 'File quá lớn' },
      });
    });

    it('rethrows an unexpected error unwrapped (not silently swallowed)', async () => {
      service.listSheets.mockRejectedValue(new Error('boom'));
      await expect(controller.listSheets(file)).rejects.toThrow('boom');
    });
  });

  describe('POST preview', () => {
    it('rejects with 400 when no file is attached', async () => {
      await expect(
        controller.preview(undefined, { selectedSheets: ['Sheet1'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(service.validateAndParse).not.toHaveBeenCalled();
    });

    it('delegates to TemplateService.validateAndParse with the buffer and selected sheets', async () => {
      const parsed = { fields: [], sha256: 'abc' };
      service.validateAndParse.mockResolvedValue(parsed);

      const result = await controller.preview(file, {
        selectedSheets: ['Đội 3', 'Đội 4'],
      });

      expect(service.validateAndParse).toHaveBeenCalledWith(file.buffer, [
        'Đội 3',
        'Đội 4',
      ]);
      expect(result).toBe(parsed);
    });

    it('translates a TemplateValidationError into a 400 carrying its code', async () => {
      service.validateAndParse.mockRejectedValue(
        new TemplateValidationError(
          'Quá nhiều sheet',
          'TOO_MANY_SELECTED_SHEETS',
        ),
      );

      await expect(
        controller.preview(file, {
          selectedSheets: ['A', 'B', 'C', 'D', 'E', 'F'],
        }),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'TOO_MANY_SELECTED_SHEETS',
          message: 'Quá nhiều sheet',
        },
      });
    });
  });
});
