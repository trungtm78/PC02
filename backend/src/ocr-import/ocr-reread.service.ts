import { HttpStatus, Injectable } from '@nestjs/common';
import type { OcrEntity } from '@prisma/client';
import type { Readable } from 'node:stream';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { DataScope } from '../auth/services/unit-scope.service';
import { DocumentsService } from '../documents/documents.service';
import type { QueryDocumentsDto } from '../documents/dto/query-documents.dto';
import { OcrJobQueue } from './jobs/ocr-job-queue';
import { OcrImportError } from './ocr-import-error';
import { OcrSendPolicy } from './ocr-send-policy';
import { OcrSessionsService } from './sessions/ocr-sessions.service';
import { ImageStorageService, isPdf } from './storage/image-storage.service';

const PARENT_KEY: Readonly<
  Record<OcrEntity, 'petitionId' | 'incidentId' | 'caseId'>
> = {
  PETITION: 'petitionId',
  INCIDENT: 'incidentId',
  CASE: 'caseId',
};

const SUBJECT: Readonly<Record<OcrEntity, string>> = {
  PETITION: 'Petition',
  INCIDENT: 'Incident',
  CASE: 'Case',
};

/** A record never has more scans than a session can hold; this also bounds the list query. */
const MAX_SCANS = 100;

async function toBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/**
 * Reads the scans attached to a SAVED record again. The scans are fetched through the ordinary, authorised document
 * download (data scope, evidence governance, audit all apply), copied into a new reading session, and read the same
 * way as on the create screen. The result is a proposal: nothing is changed on the record until the officer picks
 * values and saves through the ordinary update.
 */
@Injectable()
export class OcrRereadService {
  constructor(
    private readonly documents: DocumentsService,
    private readonly sessions: OcrSessionsService,
    private readonly storage: ImageStorageService,
    private readonly queue: OcrJobQueue,
    private readonly sendPolicy: OcrSendPolicy,
  ) {}

  async start(
    entity: OcrEntity,
    recordId: string,
    user: AuthUser,
    dataScope: DataScope | null | undefined,
  ): Promise<{ sessionId: string; jobId: string; pages: number }> {
    await this.sendPolicy.requirePermission(
      user.roleId,
      'edit',
      SUBJECT[entity],
    );
    await this.sendPolicy.assertForRole(user.roleId);

    const listed = await this.documents.getList(
      {
        [PARENT_KEY[entity]]: recordId,
        documentType: 'BAN_SCAN',
        limit: MAX_SCANS,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      } as QueryDocumentsDto,
      dataScope,
      user.id,
    );
    // Page order is the order the scans were attached in: the title carries the page number, the time breaks ties.
    const scans = [...listed.data].sort(
      (a, b) =>
        pageNumber(a.title) - pageNumber(b.title) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    if (scans.length === 0) {
      throw new OcrImportError('OCR_NO_PAGES', HttpStatus.CONFLICT);
    }

    const actor = { id: user.id };
    const session = await this.sessions.createSession(entity, actor);
    try {
      for (const scan of scans) {
        const { data } = await this.documents.openDownload(
          scan.id,
          { userId: user.id },
          dataScope,
        );
        const bytes = await toBuffer(data.stream);
        // A scan attached from a PDF is a single-page PDF, which the image path would refuse.
        const stored = isPdf(bytes)
          ? await this.storage.savePdfPage(session.id, bytes)
          : await this.storage.saveOriginal(session.id, bytes);
        await this.sessions.addPage(session.id, stored, actor);
      }
      const job = await this.queue.enqueue(session.id, 'READ', actor);
      return { sessionId: session.id, jobId: job.id, pages: scans.length };
    } catch (error) {
      // A half-built session would sit on the server with scans nobody asked to keep.
      await this.sessions.cancel(session.id, actor).catch(() => undefined);
      throw error;
    }
  }
}

/** "Bản scan trang 3" → 3; a title without a number sorts after the numbered ones. */
function pageNumber(title: string): number {
  const match = /(\d+)\s*$/.exec(title);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}
