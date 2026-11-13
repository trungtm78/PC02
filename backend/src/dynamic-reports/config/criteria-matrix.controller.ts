import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { attachmentDisposition } from '../attachment-disposition.util';
import { CriteriaMatrixError, CriteriaMatrixService } from './criteria-matrix.service';
import { ReportConfigError } from './report-config.service';

/** A small workbook: a criteria matrix has no reason to be large. */
const MAX_MATRIX_BYTES = 5 * 1024 * 1024;

/**
 * The criteria-by-team matrix of a report as an Excel sheet: take it out, edit the marks, put it back. Authoring
 * only (`manage:DynamicReport`), like every other configuration route of a report.
 */
@Controller('bao-cao-dong/reports')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class CriteriaMatrixController {
  constructor(private readonly matrix: CriteriaMatrixService) {}

  @Get(':reportId/criteria-matrix')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  async download(@Param('reportId') reportId: string, @Res() res: Response) {
    const { fileName, fileBuffer } = await this.guard(() => this.matrix.export(reportId));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', attachmentDisposition(fileName));
    res.send(fileBuffer);
  }

  /**
   * Multipart: `file`, and the text parts `apply` ("true" to change the configuration; anything else only previews)
   * and `expectedConfigVersion` (the revision the preview was shown at, so two people cannot overwrite each other).
   */
  @Post(':reportId/criteria-matrix')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_MATRIX_BYTES } }))
  upload(
    @Param('reportId') reportId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { apply?: string; expectedConfigVersion?: string },
  ) {
    if (!file) throw new BadRequestException({ code: 'MATRIX_FILE_MISSING' });
    const revision = Number(body.expectedConfigVersion);
    return this.guard(() =>
      this.matrix.import(reportId, file.buffer, {
        apply: body.apply === 'true',
        expectedConfigVersion: Number.isInteger(revision) ? revision : undefined,
      }),
    );
  }

  private async guard<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (err instanceof CriteriaMatrixError) {
        throw new BadRequestException({ code: 'CRITERIA_MATRIX_INVALID', details: err.errors });
      }
      if (err instanceof ReportConfigError) {
        if (err.code === 'REPORT_NOT_FOUND') throw new NotFoundException(err.message);
        if (err.code === 'REVISION_CONFLICT') throw new ConflictException({ code: err.code, message: err.message });
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }
}
