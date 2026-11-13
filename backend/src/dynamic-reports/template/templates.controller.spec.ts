import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TemplatesController } from './templates.controller';
import { TemplateService, TemplateValidationError } from './template.service';
import { CriteriaError } from './criteria-workbook';
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
  const service = {
    listSheets: jest.fn(),
    validateAndParse: jest.fn(),
    extractCriteria: jest.fn(),
    buildCriteriaWorkbook: jest.fn(),
  };

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

  describe('POST criteria/extract', () => {
    const selection = { sheet: 'S', column: 'B', rows: [2, 3] };

    it('reads the picked cells of the uploaded file', async () => {
      service.extractCriteria.mockResolvedValue({ criteria: [], warnings: [] });
      await expect(controller.extractCriteria(file, selection)).resolves.toEqual({ criteria: [], warnings: [] });
      expect(service.extractCriteria).toHaveBeenCalledWith(file.buffer, selection);
    });

    it('rejects with 400 when no file is attached', async () => {
      await expect(controller.extractCriteria(undefined, selection)).rejects.toBeInstanceOf(BadRequestException);
      expect(service.extractCriteria).not.toHaveBeenCalled();
    });

    it('a refusal of the selection is a 400 carrying its machine code', async () => {
      service.extractCriteria.mockRejectedValue(new CriteriaError('CRITERIA_SHEET_NOT_FOUND', { sheet: 'S' }));
      await expect(controller.extractCriteria(file, selection)).rejects.toMatchObject({
        response: { code: 'CRITERIA_SHEET_NOT_FOUND' },
      });
    });

    it('a hostile file is a 400 with the guard code, like any template upload', async () => {
      service.extractCriteria.mockRejectedValue(new TemplateValidationError('macro', 'MACRO_DETECTED'));
      await expect(controller.extractCriteria(file, selection)).rejects.toMatchObject({
        response: { code: 'MACRO_DETECTED' },
      });
    });
  });

  describe('POST criteria/workbook', () => {
    it('builds the workbook from the list the author ended with', async () => {
      service.buildCriteriaWorkbook.mockResolvedValue({ fileName: 'chi-tieu.xlsx' });
      const body = { criteria: [{ name: 'Số vụ' }] };
      await expect(controller.buildCriteriaWorkbook(body)).resolves.toEqual({ fileName: 'chi-tieu.xlsx' });
      expect(service.buildCriteriaWorkbook).toHaveBeenCalledWith(body.criteria);
    });

    it('a refused list is a 400 carrying its machine code and where it is', async () => {
      service.buildCriteriaWorkbook.mockRejectedValue(new CriteriaError('CRITERIA_PARENT_CYCLE', { index: 2 }));
      await expect(controller.buildCriteriaWorkbook({ criteria: [{ name: 'x' }] })).rejects.toMatchObject({
        response: { code: 'CRITERIA_PARENT_CYCLE', details: [{ index: 2 }] },
      });
    });
  });

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
