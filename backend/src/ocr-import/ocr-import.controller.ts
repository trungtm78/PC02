import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { OcrJob } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../feature-flags/guards/feature-flag.guard';
import {
  OpenSessionDto,
  ReorderPagesDto,
  RequestReadDto,
  SaveTranscriptDto,
  StartRereadDto,
} from './dto/ocr-import.dto';
import { OcrJobQueue } from './jobs/ocr-job-queue';
import { OcrImportError } from './ocr-import-error';
import { OcrIntakeService } from './ocr-intake.service';
import { OcrRereadService } from './ocr-reread.service';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { OcrSessionsService } from './sessions/ocr-sessions.service';

/** One scan per request, under nginx's 25 MB body limit. */
const MAX_SCAN_BYTES = 20 * 1024 * 1024;
const UPLOAD_THROTTLE = { default: { ttl: 60_000, limit: 60 } };
/** A reading costs money at the provider. */
const READ_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

const actorOf = (user: AuthUser) => ({ id: user.id });

/** What a screen needs to follow a job: nothing about the input state or the owner. */
const jobView = (job: OcrJob | null) =>
  job && {
    id: job.id,
    kind: job.kind,
    state: job.state,
    attempts: job.attempts,
    lastErrorCode: job.lastErrorCode,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  };

/**
 * Scan-image intake. Every route is for the signed-in user's own sessions: someone else's session is "not found".
 * Nothing here saves a record: the officer checks the filled form and saves it with the ordinary create call.
 */
@Controller('ocr')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('ocr_import')
@RequirePermissions({ action: 'use', subject: 'OcrImport' })
export class OcrImportController {
  constructor(
    private readonly sessions: OcrSessionsService,
    private readonly queue: OcrJobQueue,
    private readonly intake: OcrIntakeService,
    private readonly reread: OcrRereadService,
  ) {}

  @Post('sessions')
  openSession(@Body() dto: OpenSessionDto, @CurrentUser() user: AuthUser) {
    return this.intake.openSession(dto.entity, user);
  }

  /**
   * Reads the scans attached to a SAVED record again. Returns the new session and the job to follow; the result is a
   * proposal the officer applies field by field through the ordinary update.
   */
  @Post('rereads')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(READ_THROTTLE)
  startReread(
    @Body() dto: StartRereadDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.reread.start(dto.entity, dto.recordId, user, req.dataScope);
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const actor = actorOf(user);
    const session = await this.sessions.getSession(id, actor);
    const [pages, job] = await Promise.all([
      this.sessions.listPages(id, actor),
      this.queue.latestJob(id, actor),
    ]);
    return { session, pages, job: jobView(job) };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.sessions.cancel(id, actorOf(user));
  }

  @Post('sessions/:id/pages')
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SCAN_BYTES, files: 1 },
    }),
  )
  uploadPage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new OcrImportError('OCR_FILE_MISSING', HttpStatus.BAD_REQUEST);
    }
    return this.intake.uploadPage(id, file.buffer, user);
  }

  @Put('sessions/:id/pages/order')
  reorderPages(
    @Param('id') id: string,
    @Body() dto: ReorderPagesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.reorderPages(id, dto.pageIds, actorOf(user));
  }

  @Delete('sessions/:id/pages/:pageId')
  removePage(
    @Param('id') id: string,
    @Param('pageId') pageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.removePage(id, pageId, actorOf(user));
  }

  @Get('sessions/:id/pages/:pageId/image')
  async pageImage(
    @Param('id') id: string,
    @Param('pageId') pageId: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { bytes, mimeType } = await this.intake.pageImage(id, pageId, user);
    res.set({
      'Content-Type': mimeType,
      // A scan is evidence and personal data: not kept by the browser or a proxy.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(bytes);
  }

  @Put('sessions/:id/pages/:pageId/transcript')
  saveTranscript(
    @Param('id') id: string,
    @Param('pageId') pageId: string,
    @Body() dto: SaveTranscriptDto,
    @CurrentUser() user: AuthUser,
  ) {
    // Always the officer's: the model's readings are written only by the job.
    return this.sessions.saveTranscript(
      id,
      pageId,
      { text: dto.text, source: 'OFFICER' },
      actorOf(user),
    );
  }

  @Get('sessions/:id/transcripts')
  transcripts(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.latestTranscripts(id, actorOf(user));
  }

  @Post('sessions/:id/read')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(READ_THROTTLE)
  read(
    @Param('id') id: string,
    @Body() dto: RequestReadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.intake.requestRead(id, dto.mode, user);
  }

  @Get('sessions/:id/job')
  async job(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { job: jobView(await this.queue.latestJob(id, actorOf(user))) };
  }

  /** The analysis the form is filled from. The raw model output stays on the server. */
  @Get('sessions/:id/analysis')
  async analysis(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const analysis = await this.sessions.currentAnalysis(id, actorOf(user));
    if (!analysis) return { analysis: null };
    return {
      analysis: {
        id: analysis.id,
        entity: analysis.entity,
        pageSetRevision: analysis.pageSetRevision,
        inputFingerprint: analysis.inputFingerprint,
        cleaned: analysis.cleaned,
        issues: analysis.issues,
        projection: analysis.projection,
        promptVersions: analysis.promptVersions,
      },
    };
  }
}
