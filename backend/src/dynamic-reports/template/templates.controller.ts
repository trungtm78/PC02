import {
  BadRequestException,
  Body,
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
import { TemplateService } from './template.service';
import { TemplateValidationError } from './template.service';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { BuildCriteriaWorkbookDto, CriteriaSelectionDto } from './dto/criteria.dto';
import { CriteriaError } from './criteria-workbook';
import { XLSX_LIMITS } from '../../xlsx-imports/hostile-xlsx-guard';

/** A refusal the screen translates (its code, and where in the list it is) becomes a 400; anything else is rethrown. */
function asBadRequest(err: unknown): unknown {
  if (err instanceof CriteriaError) {
    return new BadRequestException({ code: err.code, details: err.detail ? [err.detail] : [] });
  }
  if (err instanceof TemplateValidationError) {
    return new BadRequestException({ code: err.code, message: err.message });
  }
  return err;
}

const UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: XLSX_LIMITS.MAX_COMPRESSED_BYTES },
};

/**
 * S02/S03 (wizard upload step, spec §6.1 PR4). manage:DynamicReport only —
 * this is report authoring, not something an ordinary editor or viewer
 * ever calls. `GET /bao-cao-dong/reports?mode=setup` (PR4 slice 1) uses
 * the same permission for the same reason.
 *
 * Deliberately stateless: the wizard keeps the uploaded File in browser
 * memory across its own steps and re-sends it with `/preview` once sheets
 * are chosen, rather than this controller caching an upload server-side
 * between requests.
 */
@Controller('bao-cao-dong/templates')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class TemplatesController {
  constructor(private readonly templateService: TemplateService) {}

  @Post('sheets')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  async listSheets(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('Thiếu file upload (field "file").');
    }
    try {
      return await this.templateService.listSheets(file.buffer);
    } catch (err) {
      if (err instanceof TemplateValidationError) {
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }

  /**
   * Criteria from a picked range: the author uploads any workbook and points at one column (all of it, or some of its
   * cells). Returns the criteria read from those cells for the author to review and edit.
   */
  @Post('criteria/extract')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  async extractCriteria(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() selection: CriteriaSelectionDto,
  ) {
    if (!file) {
      throw new BadRequestException('Thiếu file upload (field "file").');
    }
    try {
      return await this.templateService.extractCriteria(file.buffer, selection);
    } catch (err) {
      throw asBadRequest(err);
    }
  }

  /** The workbook the rest of the system understands, generated from the list the author ended with. */
  @Post('criteria/workbook')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async buildCriteriaWorkbook(@Body() body: BuildCriteriaWorkbookDto) {
    try {
      return await this.templateService.buildCriteriaWorkbook(body.criteria);
    } catch (err) {
      throw asBadRequest(err);
    }
  }

  @Post('preview')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  async preview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: PreviewTemplateDto,
  ) {
    if (!file) {
      throw new BadRequestException('Thiếu file upload (field "file").');
    }
    try {
      return await this.templateService.validateAndParse(
        file.buffer,
        body.selectedSheets,
      );
    } catch (err) {
      if (err instanceof TemplateValidationError) {
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }
}
