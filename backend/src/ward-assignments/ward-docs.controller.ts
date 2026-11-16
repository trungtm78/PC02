import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import * as fs from 'fs';
import type { Readable } from 'node:stream';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import type { DataScope } from '../auth/services/unit-scope.service';
import { ALLOWED_UPLOAD_MIMES, assertUploadedDocument, documentUploadOptions } from '../documents/document-upload-policy';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../feature-flags/guards/feature-flag.guard';
import { IssueSlipDto, ReissueSlipDto } from './dto/ward-docs.dto';
import { WARD_ERROR } from './ward-assignment.codes';
import { WARD_DOCS_ERROR } from './ward-docs.codes';
import { wardBody } from './ward-errors';
import { WardFilesService } from './ward-files.service';
import { WardSlipService } from './ward-slip.service';

/** The scope the request interceptor resolved; a route of this module is never opened without one (see the module's controller). */
function scopeOf(req: ScopedRequest): DataScope | null {
  if (req.dataScope === undefined) throw new ForbiddenException(wardBody(WARD_ERROR.FORBIDDEN));
  return req.dataScope;
}

/** The documents store's upload options, refusing an unsupported type with this module's code. */
function wardUploadOptions() {
  return {
    ...documentUploadOptions(),
    fileFilter: (_req: unknown, file: { mimetype: string }, cb: (error: Error | null, accept: boolean) => void) => {
      if (ALLOWED_UPLOAD_MIMES.has(file.mimetype)) cb(null, true);
      else cb(new BadRequestException(wardBody(WARD_DOCS_ERROR.FILE_TYPE_REFUSED)), false);
    },
  };
}

/** The kind of document a file is stored as: a recording keeps the larger limit of recordings. */
function documentTypeOf(mimetype: string): 'AM_THANH' | 'VIDEO' | 'VAN_BAN' {
  if (mimetype.startsWith('audio/')) return 'AM_THANH';
  if (mimetype.startsWith('video/')) return 'VIDEO';
  return 'VAN_BAN';
}

function sendFile(res: Response, file: { stream: Readable; originalName: string; mimeType: string }) {
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  file.stream.pipe(res);
}

const meta = (req: ScopedRequest) => ({ ipAddress: req.ip, userAgent: req.headers['user-agent'] });

/**
 * The result files ("Kết quả") and the request slips ("Phiếu yêu cầu") of a ward assignment request. Behind the
 * `ward-assignments` switch. The guard asks for the permission of the action; how far it reaches and in which state
 * it may be done is the services'.
 */
@Controller('ward-assignments')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('ward-assignments')
export class WardDocsController {
  constructor(
    private readonly files: WardFilesService,
    private readonly slips: WardSlipService,
  ) {}

  @Get(':id/files')
  @RequirePermissions({ action: 'read', subject: 'WardAssignment' })
  listFiles(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.files.list(scopeOf(req), id);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post(':id/files')
  @UseInterceptors(FileInterceptor('file', wardUploadOptions()))
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  async addFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    if (!file) throw new BadRequestException(wardBody(WARD_DOCS_ERROR.FILE_REQUIRED));
    const documentType = documentTypeOf(file.mimetype);
    try {
      // Magic bytes, extension, type and size: the documents store's one check (it removes a refused file).
      await assertUploadedDocument(file, documentType);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      throw new BadRequestException(wardBody(/dung lượng/i.test(message) ? WARD_DOCS_ERROR.FILE_TOO_LARGE : WARD_DOCS_ERROR.FILE_TYPE_REFUSED));
    }
    if (req.dataScope === undefined) fs.rmSync(file.path, { force: true });
    return this.files.add(user, scopeOf(req), id, { ...file, documentType }, meta(req));
  }

  @Get(':id/files/:fileId/download')
  @RequirePermissions({ action: 'read', subject: 'WardAssignment' })
  async downloadFile(@Param('id') id: string, @Param('fileId') fileId: string, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest, @Res() res: Response) {
    sendFile(res, await this.files.download({ id: user.id, ...meta(req) }, scopeOf(req), id, fileId));
  }

  @Delete(':id/files/:fileId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  removeFile(@Param('id') id: string, @Param('fileId') fileId: string, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.files.remove(user, scopeOf(req), id, fileId, meta(req));
  }

  @Post(':id/decisions/:decisionId/slip')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  issueSlip(@Param('id') id: string, @Param('decisionId') decisionId: string, @Body() body: IssueSlipDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.slips.issue(user, scopeOf(req), id, decisionId, body);
  }

  /** What the print dialog shows before issuing (default signers, template in use, what the slip would print empty). */
  @Get(':id/decisions/:decisionId/slip/defaults')
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  slipDefaults(@Param('id') id: string, @Param('decisionId') decisionId: string, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.slips.defaults(user, scopeOf(req), id, decisionId);
  }

  @Get(':id/decisions/:decisionId/slip')
  @RequirePermissions({ action: 'read', subject: 'WardAssignment' })
  async downloadSlip(@Param('id') id: string, @Param('decisionId') decisionId: string, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest, @Res() res: Response) {
    sendFile(res, await this.slips.download({ id: user.id, ...meta(req) }, scopeOf(req), id, decisionId));
  }

  @Post(':id/decisions/:decisionId/slip/reissue')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  reissueSlip(@Param('id') id: string, @Param('decisionId') decisionId: string, @Body() body: ReissueSlipDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.slips.reissue(user, scopeOf(req), id, decisionId, body);
  }
}
