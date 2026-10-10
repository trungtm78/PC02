import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Post,
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
  constructor(private readonly configService: ReportConfigService) {}

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
      return await this.configService.save(
        body.config,
        file.buffer,
        file.originalname,
        user.id,
      );
    } catch (err) {
      if (err instanceof ReportConfigError) {
        if (err.code === 'REPORT_CODE_TAKEN') {
          throw new ConflictException({ code: err.code, message: err.message });
        }
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }
}
