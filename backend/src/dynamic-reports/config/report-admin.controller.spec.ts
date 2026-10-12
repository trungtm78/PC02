import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReportAdminController } from './report-admin.controller';
import { ReportConfigService, ReportConfigError } from './report-config.service';
import { ReportDetailService } from './report-detail.service';
import { ReportLifecycleService } from './report-lifecycle.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportAdminController', () => {
  const config = { resumeGeneration: jest.fn() };
  const detail = { getDetail: jest.fn(), getVersionFile: jest.fn() };
  const lifecycle = { getDeletionImpact: jest.fn(), archive: jest.fn(), unarchive: jest.fn(), deleteReport: jest.fn() };
  const user = { id: 'actor1' };
  let controller: ReportAdminController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [ReportAdminController],
      providers: [
        { provide: ReportConfigService, useValue: config },
        { provide: ReportDetailService, useValue: detail },
        { provide: ReportLifecycleService, useValue: lifecycle },
        { provide: FeatureFlagsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get(ReportAdminController);
  });

  it('detail passes the report id and returns the view', async () => {
    detail.getDetail.mockResolvedValue({ id: 'r1' });
    await expect(controller.detail('r1')).resolves.toEqual({ id: 'r1' });
    expect(detail.getDetail).toHaveBeenCalledWith('r1');
  });

  it('detail turns a missing report into 404', async () => {
    detail.getDetail.mockRejectedValue(new ReportConfigError('x', 'REPORT_NOT_FOUND'));
    await expect(controller.detail('r1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resume: 404 for a missing report, 400 for a report that is not suspended', async () => {
    config.resumeGeneration.mockRejectedValueOnce(new ReportConfigError('x', 'REPORT_NOT_FOUND'));
    await expect(controller.resume('r1')).rejects.toBeInstanceOf(NotFoundException);
    config.resumeGeneration.mockRejectedValueOnce(new ReportConfigError('x', 'INVALID_STATE'));
    await expect(controller.resume('r1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('versionFile sends the bytes with an RFC 5987 file name (Vietnamese letters must not break the header)', async () => {
    detail.getVersionFile.mockResolvedValue({ fileName: 'Biểu thống kê.xlsx', bytes: Buffer.from('xlsx') });
    const headers: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => (headers[k] = v), send: jest.fn() };
    await controller.versionFile('r1', 'v1', res as never);
    expect(headers['Content-Disposition']).toContain('filename*=UTF-8');
    expect(res.send).toHaveBeenCalledWith(Buffer.from('xlsx'));
  });

  describe('delete / archive', () => {
    it('a plain delete passes withData:false and the actor', async () => {
      lifecycle.deleteReport.mockResolvedValue({ deleted: true });
      await controller.remove('r1', user);
      expect(lifecycle.deleteReport).toHaveBeenCalledWith('r1', { withData: false }, 'actor1');
    });

    it('a report with data answers 409 with the code the screen explains', async () => {
      lifecycle.deleteReport.mockRejectedValue(new ReportConfigError('có số liệu', 'HAS_DATA'));
      await expect(controller.remove('r1', user)).rejects.toBeInstanceOf(ConflictException);
    });

    it('delete with data passes the typed code; a wrong code is a 400', async () => {
      lifecycle.deleteReport.mockResolvedValueOnce({ deleted: true });
      await controller.removeWithData('r1', 'HSLN', user);
      expect(lifecycle.deleteReport).toHaveBeenCalledWith('r1', { withData: true, confirmCode: 'HSLN' }, 'actor1');

      lifecycle.deleteReport.mockRejectedValueOnce(new ReportConfigError('x', 'CONFIRMATION_REQUIRED'));
      await expect(controller.removeWithData('r1', undefined, user)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('archive, unarchive and the impact read are forwarded; a missing report is 404', async () => {
      lifecycle.archive.mockResolvedValue({ status: 'ARCHIVED' });
      await expect(controller.archive('r1')).resolves.toEqual({ status: 'ARCHIVED' });
      lifecycle.unarchive.mockResolvedValue({ status: 'SUSPENDED' });
      await expect(controller.unarchive('r1')).resolves.toEqual({ status: 'SUSPENDED' });
      lifecycle.getDeletionImpact.mockRejectedValue(new ReportConfigError('x', 'REPORT_NOT_FOUND'));
      await expect(controller.deletionImpact('r1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
