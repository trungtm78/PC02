import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExportController } from './export.controller';
import { AggregateService } from './aggregate.service';
import { SubmissionError } from '../submission/submission.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * S25 (PR7 slice 7) — `GET /bao-cao-dong/exports/:exportId/download`. Uses
 * `@Res()` to stream the xlsx bytes directly, so these tests assert on
 * the mocked Express response object's calls rather than a return value.
 */
describe('ExportController', () => {
  let controller: ExportController;
  const service = { getExportForDownload: jest.fn() };
  const user = { id: 'u1', roleId: 'r1' };

  function buildRes() {
    return {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [
        { provide: AggregateService, useValue: service },
        { provide: FeatureFlagsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get<ExportController>(ExportController);
  });

  it('streams the file bytes with the correct headers', async () => {
    const fileBytes = Buffer.from('fake-xlsx');
    service.getExportForDownload.mockResolvedValue({
      fileBytes,
      fileName: 'HSLN-2026-06.xlsx',
    });
    const res = buildRes();

    await controller.download('export1', user, res as never);

    expect(service.getExportForDownload).toHaveBeenCalledWith(
      'export1',
      'u1',
      'r1',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="HSLN-2026-06.xlsx"; filename*=UTF-8''HSLN-2026-06.xlsx`,
    );
    expect(res.send).toHaveBeenCalledWith(fileBytes);
  });

  it('a Vietnamese report name does not make the download fail (Node rejects letters above U+00FF in a header)', async () => {
    service.getExportForDownload.mockResolvedValue({
      fileBytes: Buffer.from('x'),
      fileName: 'Thống-kê-vụ-việc-2026-11.xlsx',
    });
    const headers: Record<string, string> = {};
    const strictRes = {
      setHeader: (k: string, v: string) => {
        // What Node itself does with a header value.
        if (/[^	 -~-ÿ]/.test(v)) throw new TypeError('ERR_INVALID_CHAR');
        headers[k] = v;
      },
      send: jest.fn(),
    };

    await controller.download('export1', user, strictRes as never);

    expect(headers['Content-Disposition']).toContain(`filename*=UTF-8''${encodeURIComponent('Thống-kê-vụ-việc-2026-11.xlsx')}`);
    expect(strictRes.send).toHaveBeenCalled();
  });

  it('rethrows a 404 unchanged (anti-probe — no SubmissionError wrapping)', async () => {
    service.getExportForDownload.mockRejectedValue(
      new NotFoundException('Không tìm thấy file xuất này.'),
    );
    const res = buildRes();

    await expect(
      controller.download('export1', user, res as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(res.send).not.toHaveBeenCalled();
  });

  it('translates a CELL_VALIDATION SubmissionError (expired/scope-changed) into a 400', async () => {
    service.getExportForDownload.mockRejectedValue(
      new SubmissionError('File xuất đã hết hạn.', 'CELL_VALIDATION'),
    );
    const res = buildRes();

    await expect(
      controller.download('export1', user, res as never),
    ).rejects.toMatchObject({ response: { code: 'CELL_VALIDATION' } });
  });
});
