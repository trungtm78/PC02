import { HttpStatus, Injectable } from '@nestjs/common';
import type { OcrEntity, OcrSessionStatus, Prisma } from '@prisma/client';
import { OcrImportError } from '../ocr-import-error';

export interface BindInput {
  sessionId: string;
  /** The analysis the form was filled from (`ocrPhienBan` in the create request). */
  analysisId: string;
  /** The kind of record being created. */
  entity: OcrEntity;
  /** Id of the record just created in the same transaction. */
  recordId: string;
  userId: string;
}

/**
 * Binds a scan-intake session to the record the officer has just saved.
 *
 * It runs INSIDE the record's own transaction, so the record and its binding appear together or not at all: closing
 * the browser right after Save loses nothing, and a failed save leaves the session open for another try. The session
 * row is locked, so two saves racing for the same session cannot both bind it. The originals are copied into the
 * record's documents later, by the finalisation sweeper, because that touches the disk and must not be able to fail
 * the save.
 */
@Injectable()
export class OcrBinder {
  async bind(tx: Prisma.TransactionClient, input: BindInput): Promise<void> {
    const rows = await tx.$queryRaw<
      Array<{
        createdById: string;
        status: OcrSessionStatus;
        entity: OcrEntity;
      }>
    >`SELECT "createdById", status, entity FROM ocr_sessions WHERE id = ${input.sessionId} FOR UPDATE`;
    const session = rows[0];
    if (!session || session.createdById !== input.userId) {
      throw new OcrImportError('OCR_SESSION_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (session.status !== 'OPEN') {
      throw new OcrImportError('OCR_SESSION_CLOSED', HttpStatus.CONFLICT);
    }
    if (session.entity !== input.entity) {
      throw new OcrImportError('OCR_ENTITY_MISMATCH', HttpStatus.CONFLICT);
    }
    // Any analysis of this session counts, including an older one: the form may have been filled from it before the
    // officer corrected a transcript. What matters is that it is this session's, not another's.
    const analysis = await tx.ocrAnalysis.findFirst({
      where: { id: input.analysisId, sessionId: input.sessionId },
      select: { id: true },
    });
    if (!analysis) {
      throw new OcrImportError('OCR_ANALYSIS_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    await tx.ocrSession.update({
      where: { id: input.sessionId },
      data: {
        status: 'BOUND',
        boundRecordId: input.recordId,
        boundAt: new Date(),
      },
    });
  }
}
