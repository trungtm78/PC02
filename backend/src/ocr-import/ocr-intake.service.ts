import { HttpStatus, Injectable } from '@nestjs/common';
import type { OcrEntity, OcrJobKind } from '@prisma/client';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { OcrJobQueue, type EnqueuedJob } from './jobs/ocr-job-queue';
import { OcrImportError } from './ocr-import-error';
import { OcrSendPolicy } from './ocr-send-policy';
import { OcrSessionsService } from './sessions/ocr-sessions.service';
import { PdfSandbox } from './pdf/pdf-sandbox';
import { ImageStorageService, isPdf } from './storage/image-storage.service';

/** Same ceiling as a session's own page limit; a PDF is checked against it before any page is added. */
const MAX_SESSION_PAGES = 20;

/** The subject whose `write` permission lets a user create each kind of record. */
const WRITE_SUBJECT: Readonly<Record<OcrEntity, string>> = {
  PETITION: 'Petition',
  INCIDENT: 'Incident',
  CASE: 'Case',
};

/**
 * What a signed-in user may do with a scan-intake session, on top of the session's own owner check.
 *
 * Reading a record is not the same as sending it abroad: filling a form from scans needs permission to write that kind
 * of record, and asking for a reading needs the "send" permission of every kind of provider the scans may go to.
 */
@Injectable()
export class OcrIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: OcrSessionsService,
    private readonly storage: ImageStorageService,
    private readonly queue: OcrJobQueue,
    private readonly sendPolicy: OcrSendPolicy,
    private readonly pdfSandbox: PdfSandbox,
  ) {}

  async openSession(entity: OcrEntity, user: AuthUser) {
    await this.require(user, 'write', WRITE_SUBJECT[entity]);
    return this.sessions.createSession(entity, { id: user.id });
  }

  /** Stores one uploaded scan as it came, then adds it to the session as the last page. */
  async uploadPage(sessionId: string, bytes: Buffer, user: AuthUser) {
    const actor = { id: user.id };
    // Ownership and openness first, so a stranger's session never gets a file written into it.
    const session = await this.sessions.getSession(sessionId, actor);
    if (session.status !== 'OPEN') {
      throw new OcrImportError('OCR_SESSION_CLOSED', HttpStatus.CONFLICT);
    }
    if (isPdf(bytes)) return this.uploadPdf(sessionId, bytes, actor);
    const stored = await this.storage.saveOriginal(sessionId, bytes);
    try {
      const added = await this.sessions.addPage(sessionId, stored, actor);
      return { ...added, pages: [added.page] };
    } catch (error) {
      // The file was written before the page was refused. Remove it unless a page row (even a removed one, which
      // still counts as history) points at the same file.
      const stillUsed = await this.prisma.ocrPage.count({
        where: { sessionId, originalPath: stored.originalPath },
      });
      if (stillUsed === 0)
        await this.storage.deleteFiles([stored.originalPath]);
      throw error;
    }
  }

  /** One uploaded PDF becomes one page per PDF page, all or none: a PDF that does not fit is refused whole. */
  private async uploadPdf(
    sessionId: string,
    bytes: Buffer,
    actor: { id: string },
  ) {
    const parts = await this.pdfSandbox.split(bytes);
    const present = await this.sessions.listPages(sessionId, actor);
    if (present.length + parts.length > MAX_SESSION_PAGES) {
      throw new OcrImportError('OCR_TOO_MANY_PAGES', HttpStatus.CONFLICT, {
        limit: MAX_SESSION_PAGES,
      });
    }
    const pages: Array<
      Awaited<ReturnType<OcrSessionsService['addPage']>>['page']
    > = [];
    let pageSetRevision = 0;
    for (const part of parts) {
      const stored = await this.storage.savePdfPage(
        sessionId,
        Buffer.from(part),
      );
      const added = await this.sessions.addPage(sessionId, stored, actor);
      pages.push(added.page);
      pageSetRevision = added.pageSetRevision;
    }
    return { page: pages[0], pages, pageSetRevision };
  }

  /** Queues a reading ('READ': scans then analysis) or a re-analysis of the stored text ('ANALYSE'). */
  async requestRead(
    sessionId: string,
    kind: OcrJobKind,
    user: AuthUser,
  ): Promise<EnqueuedJob> {
    // Checked again when the job runs: permissions can change while it waits.
    await this.sendPolicy.assertForRole(user.roleId);
    return this.queue.enqueue(sessionId, kind, { id: user.id });
  }

  /** The original of one page, for the side-by-side view. Only a page of the caller's own session. */
  async pageImage(sessionId: string, pageId: string, user: AuthUser) {
    const pages = await this.sessions.listPages(sessionId, { id: user.id });
    if (!pages.some((page) => page.id === pageId)) {
      throw new OcrImportError('OCR_PAGE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    const page = await this.prisma.ocrPage.findUnique({
      where: { id: pageId },
    });
    if (!page) {
      throw new OcrImportError('OCR_PAGE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return {
      bytes: await this.storage.read(page.originalPath),
      mimeType: page.mimeType,
    };
  }

  private async require(user: AuthUser, action: string, subject: string) {
    const granted = await this.prisma.rolePermission.count({
      where: { roleId: user.roleId, permission: { action, subject } },
    });
    if (granted === 0) {
      throw new OcrImportError('OCR_FORBIDDEN', HttpStatus.FORBIDDEN, {
        action,
        subject,
      });
    }
  }
}
