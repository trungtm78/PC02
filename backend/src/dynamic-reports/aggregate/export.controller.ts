import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AggregateService } from './aggregate.service';
import { SubmissionError } from '../submission/submission.service';

interface AuthenticatedUser {
  id: string;
  roleId: string;
}

/**
 * S25 — the "tải qua API có kiểm quyền lại" step, deliberately a
 * separate controller/route from the `:periodId/export` creation call:
 * no public URL, every download re-checks the caller's standing and
 * the export's TTL/scope from scratch (`AggregateService.getExportForDownload`).
 */
@Controller('bao-cao-dong/exports')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class ExportController {
  constructor(private readonly aggregateService: AggregateService) {}

  @Get(':exportId/download')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async download(
    @Param('exportId') exportId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    try {
      const { fileBytes, fileName } =
        await this.aggregateService.getExportForDownload(
          exportId,
          user.id,
          user.roleId,
        );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      res.send(fileBytes);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if (err instanceof SubmissionError) {
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }
}
