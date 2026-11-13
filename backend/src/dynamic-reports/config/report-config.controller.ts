import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { XLSX_LIMITS } from '../../xlsx-imports/hostile-xlsx-guard';
import {
  ReportConfigService,
  ReportConfigError,
} from './report-config.service';
import { SaveReportConfigRequestDto } from './dto/save-report-config.dto';
import { PeriodSchedulerService } from '../schedule/period-scheduler.service';
import { bestEffortWithin } from '../schedule/best-effort-within';

/** How long a publish waits for its periods to be made; the proxy gives up after 90 s, the work carries on past this. */
const PERIODS_WAIT_MS = 15_000;

interface AuthenticatedUser {
  id: string;
  roleId: string;
}

/**
 * S09/S10 (spec §6.1 PR4 bước 4/4). manage:DynamicReport only — same
 * reasoning as TemplatesController/ReportsController(mode=setup): report
 * authoring, not something an ordinary editor/viewer ever calls.
 */
@Controller('bao-cao-dong/reports')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class ReportConfigController {
  private readonly logger = new Logger(ReportConfigController.name);

  constructor(
    private readonly configService: ReportConfigService,
    private readonly scheduler: PeriodSchedulerService,
  ) {}

  @Post()
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: XLSX_LIMITS.MAX_COMPRESSED_BYTES },
    }),
  )
  async save(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: SaveReportConfigRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Thiếu file mẫu (field "file").');
    }
    try {
      const saved = await this.configService.save(
        body.config,
        file.buffer,
        file.originalname,
        user.id,
      );
      if (saved.status === 'PUBLISHED') await this.makePeriodsNow(saved.reportId);
      return saved;
    } catch (err) {
      if (err instanceof ReportConfigError) {
        if (err.code === 'REPORT_CODE_TAKEN') {
          throw new ConflictException({ code: err.code, message: err.message });
        }
        if (err.code === 'WORKER_BUSY') {
          // Retry later: nothing is wrong with what the user sent.
          throw new ServiceUnavailableException({ code: err.code, message: err.message });
        }
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }

  /** S31 "Ngừng phát sinh" — stops future periods for this report; any already-OPEN period keeps running unchanged. */
  @Post(':reportId/suspend')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  async suspend(@Param('reportId') reportId: string) {
    try {
      return await this.configService.suspendGeneration(reportId);
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

  /** S22 "Danh sách phiên bản" — read-only, every version + which periods used it. */
  @Get(':reportId/versions')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  async listVersions(@Param('reportId') reportId: string) {
    try {
      return await this.configService.listVersions(reportId);
    } catch (err) {
      if (err instanceof ReportConfigError) {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }

  /**
   * A published report has no period until the scheduler makes one, which used to be the next hourly tick: nothing for
   * anyone to enter for up to an hour. Make them now. Best effort: the report is already published, so a failure here
   * is logged and the hourly tick makes the periods as it always did.
   */
  private async makePeriodsNow(reportId: string): Promise<void> {
    await bestEffortWithin(this.scheduler.generateForReport(reportId), PERIODS_WAIT_MS, (err) =>
      this.logger.error(
        `Could not make the periods of the report ${reportId} right after publishing: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }
}
