import { Injectable, Logger, Optional } from '@nestjs/common';
import type { OcrEntity } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DocumentsService } from '../../documents/documents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ImageStorageService } from '../storage/image-storage.service';

export interface FinaliserOptions {
  /** Where documents are stored; must be the folder the documents service reads from. */
  documentsDir: string;
  /** Finds a document an earlier, interrupted run already created for this scan. */
  findExistingDocument: (
    parent: ParentRef,
    originalName: string,
  ) => Promise<{ id: string } | null>;
}

export interface ParentRef {
  field: 'petitionId' | 'incidentId' | 'caseId';
  id: string;
}

export type FinaliseResult =
  | { state: 'DONE'; documents: number }
  | { state: 'SKIPPED'; documents: 0 };

const PARENT_FIELD: Readonly<Record<OcrEntity, ParentRef['field']>> = {
  PETITION: 'petitionId',
  INCIDENT: 'incidentId',
  CASE: 'caseId',
};

const EXTENSION: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Turns the scans of a bound session into documents of the saved record.
 *
 * It runs after the record's transaction has committed, never inside it: copying files can fail for reasons
 * unrelated to the record, and must not be able to undo a save the officer has already seen succeed. Every step
 * can be repeated: a page that already has its document is skipped, a document an interrupted run created is
 * found by its name and linked instead of created twice, and a file copied for a document that was then refused
 * is removed again. Until every page is done the session stays unfinalised and the sweeper comes back to it.
 */
@Injectable()
export class OcrFinaliser {
  private readonly logger = new Logger(OcrFinaliser.name);
  private readonly options: FinaliserOptions;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageStorageService,
    private readonly documents: DocumentsService,
    @Optional() options?: Partial<FinaliserOptions>,
  ) {
    this.options = {
      documentsDir:
        options?.documentsDir ??
        path.join(process.cwd(), 'uploads', 'documents'),
      findExistingDocument:
        options?.findExistingDocument ??
        ((parent, originalName) =>
          this.prisma.document.findFirst({
            where: { [parent.field]: parent.id, originalName, deletedAt: null },
            select: { id: true },
          })),
    };
  }

  async finalise(sessionId: string): Promise<FinaliseResult> {
    const session = await this.prisma.ocrSession.findUnique({
      where: { id: sessionId },
    });
    if (
      !session ||
      session.status !== 'BOUND' ||
      !session.boundRecordId ||
      session.finalisedAt
    ) {
      return { state: 'SKIPPED', documents: 0 };
    }
    const parent: ParentRef = {
      field: PARENT_FIELD[session.entity],
      id: session.boundRecordId,
    };

    const set = await this.prisma.ocrPageSet.findUnique({
      where: {
        sessionId_revision: {
          sessionId,
          revision: session.pageSetRevision,
        },
      },
    });
    const refs =
      (set?.pages as unknown as Array<{ id: string }> | undefined) ?? [];
    const rows = await this.prisma.ocrPage.findMany({
      where: { id: { in: refs.map((r) => r.id) } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    let made = 0;
    for (const [index, ref] of refs.entries()) {
      const page = byId.get(ref.id);
      if (!page || page.documentId) continue;
      const number = index + 1;
      const extension = EXTENSION[page.mimeType] ?? 'bin';
      // Stable per scan, so a rerun after a crash can recognise the document it already made.
      const originalName = `ban-scan-${number}-${page.sha256.slice(0, 8)}.${extension}`;

      const known = await this.options.findExistingDocument(
        parent,
        originalName,
      );
      const documentId =
        known?.id ??
        (await this.createDocument({
          parent,
          title: `Bản scan trang ${number}`,
          originalName,
          mimeType: page.mimeType,
          originalPath: page.originalPath,
          userId: session.createdById,
          extension,
        }));
      await this.prisma.ocrPage.update({
        where: { id: page.id },
        data: { documentId },
      });
      made += 1;
    }

    await this.prisma.ocrSession.update({
      where: { id: sessionId },
      data: { finalisedAt: new Date() },
    });
    return { state: 'DONE', documents: made };
  }

  /** Finalises bound sessions that are still waiting. One failing session does not stop the others. */
  async sweep(
    limit = 5,
    scopeTag?: string,
  ): Promise<{ finalised: number; failed: number }> {
    const waiting = await this.prisma.ocrSession.findMany({
      where: {
        status: 'BOUND',
        finalisedAt: null,
        ...(scopeTag ? { createdById: { startsWith: scopeTag } } : {}),
      },
      orderBy: { boundAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    let finalised = 0;
    let failed = 0;
    for (const { id } of waiting) {
      try {
        const result = await this.finalise(id);
        if (result.state === 'DONE') finalised += 1;
      } catch (error) {
        failed += 1;
        // The error type only: its message could carry what the documents service saw.
        this.logger.warn(
          `finalising session ${id} failed: ${(error as Error).name}`,
        );
      }
    }
    return { finalised, failed };
  }

  private async createDocument(input: {
    parent: ParentRef;
    title: string;
    originalName: string;
    mimeType: string;
    originalPath: string;
    userId: string;
    extension: string;
  }): Promise<string> {
    const bytes = await this.storage.read(input.originalPath);
    const fileName = `${Date.now()}-${randomBytes(16).toString('hex')}.${input.extension}`;
    const fullPath = path.join(this.options.documentsDir, fileName);
    await fs.promises.mkdir(this.options.documentsDir, { recursive: true });
    // 'wx': never overwrite a stored document. Read-only afterwards, like every uploaded original.
    await fs.promises.writeFile(fullPath, bytes, { flag: 'wx', mode: 0o444 });
    try {
      const { data } = await this.documents.create(
        {
          title: input.title,
          documentType: 'BAN_SCAN',
          fileName,
          originalName: input.originalName,
          mimeType: input.mimeType,
          size: bytes.length,
          filePath: fullPath,
          [input.parent.field]: input.parent.id,
        },
        input.userId,
      );
      return data.id;
    } catch (error) {
      await fs.promises.chmod(fullPath, 0o666).catch(() => undefined);
      await fs.promises.unlink(fullPath).catch(() => undefined);
      throw error;
    }
  }
}
