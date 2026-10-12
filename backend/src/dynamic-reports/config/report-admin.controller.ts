import {
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { attachmentDisposition } from '../attachment-disposition.util';
import { ReportConfigService, ReportConfigError } from './report-config.service';
import { ReportDetailService } from './report-detail.service';
import { ReportLifecycleService } from './report-lifecycle.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

/**
 * S01 follow-ups on an EXISTING report: look at it, resume it, take its template file. Sits next to
 * `ReportConfigController` (which creates reports and suspends them) on the same path prefix so the REST
 * shape stays `bao-cao-dong/reports/:reportId/...`; manage:DynamicReport only, like every authoring route.
 */
@Controller('bao-cao-dong/reports')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class ReportAdminController {
  constructor(
    private readonly configService: ReportConfigService,
    private readonly detailService: ReportDetailService,
    private readonly lifecycleService: ReportLifecycleService,
  ) {}

  /** Maps the service's error codes onto HTTP: a missing report is 404, "has data" is a 409 the screen can explain. */
  private async guard<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (err instanceof ReportConfigError) {
        if (err.code === 'REPORT_NOT_FOUND') throw new NotFoundException(err.message);
        if (err.code === 'HAS_DATA') throw new ConflictException({ code: err.code, message: err.message });
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }

  /** S01 "Xem" — the whole configuration of one report. */
  @Get(':reportId')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  async detail(@Param('reportId') reportId: string) {
    try {
      return await this.detailService.getDetail(reportId);
    } catch (err) {
      if (err instanceof ReportConfigError) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }

  /** The counterpart of S31 "Ngừng phát sinh": a suspended report generates periods again. */
  @Post(':reportId/resume')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  async resume(@Param('reportId') reportId: string) {
    try {
      return await this.configService.resumeGeneration(reportId);
    } catch (err) {
      if (err instanceof ReportConfigError) {
        if (err.code === 'REPORT_NOT_FOUND') {
          throw new NotFoundException(err.message);
        }
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }

  /** One version's template file — the source for copying a report or starting a new version from the same file. */
  @Get(':reportId/versions/:versionId/file')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  async versionFile(
    @Param('reportId') reportId: string,
    @Param('versionId') versionId: string,
    @Res() res: Response,
  ) {
    try {
      const { fileName, bytes } = await this.detailService.getVersionFile(reportId, versionId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', attachmentDisposition(fileName));
      res.send(bytes);
    } catch (err) {
      if (err instanceof ReportConfigError) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }

  /** What deleting this report would destroy — shown in the confirmation before anyone deletes. */
  @Get(':reportId/deletion-impact')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  deletionImpact(@Param('reportId') reportId: string) {
    return this.guard(() => this.lifecycleService.getDeletionImpact(reportId));
  }

  /** Hide the report and stop it generating periods; every figure stays. */
  @Post(':reportId/archive')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  archive(@Param('reportId') reportId: string) {
    return this.guard(() => this.lifecycleService.archive(reportId));
  }

  @Post(':reportId/unarchive')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  unarchive(@Param('reportId') reportId: string) {
    return this.guard(() => this.lifecycleService.unarchive(reportId));
  }

  /** Delete a report nobody has entered anything into. With data, this answers 409 HAS_DATA. */
  @Delete(':reportId')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  remove(@Param('reportId') reportId: string, @CurrentUser() user: { id: string }) {
    return this.guard(() => this.lifecycleService.deleteReport(reportId, { withData: false }, user.id));
  }

  /** Delete the report together with every figure under it. Admin only; the report code must be typed back. */
  @Delete(':reportId/with-data')
  @RequirePermissions({ action: 'admin', subject: 'DynamicReport' })
  removeWithData(
    @Param('reportId') reportId: string,
    @Query('confirmCode') confirmCode: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.guard(() => this.lifecycleService.deleteReport(reportId, { withData: true, confirmCode }, user.id));
  }
}
