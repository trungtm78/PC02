import { HttpStatus, Injectable } from '@nestjs/common';
import type { OcrEntity, OcrSessionStatus, Prisma } from '@prisma/client';
import { OcrImportError } from '../ocr-import-error';

export interface OutcomeInput {
  field: string;
  outcome: 'KEPT' | 'EDITED' | 'CLEARED';
  mustConfirm: boolean;
}

/** A field name as the forms use them: letters, digits, underscore, dot. Anything else is not recorded. */
const FIELD_NAME = /^[A-Za-z0-9_.]{1,80}$/;
/** One save adds at most this many rows. */
const MAX_OUTCOMES = 300;

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
  /**
   * What the three create services call: a no-op for an ordinary save, a bind when the request carries the scan
   * session it was filled from. A session id without the analysis it was filled from is refused rather than
   * ignored, so a client bug cannot silently lose the link to the scans.
   */
  async bindIfRequested(
    tx: Prisma.TransactionClient,
    request: {
      ocrPhienId?: string;
      ocrPhienBan?: string;
      ocrKetQua?: OutcomeInput[];
    },
    context: { entity: OcrEntity; recordId: string; userId: string },
  ): Promise<void> {
    if (!request.ocrPhienId) return;
    await this.bind(tx, {
      sessionId: request.ocrPhienId,
      analysisId: request.ocrPhienBan ?? '',
      ...context,
    });
    await this.recordOutcomes(
      tx,
      request.ocrPhienId,
      context.entity,
      request.ocrKetQua ?? [],
    );
  }

  /**
   * What the officer did with each field the reading filled. Names and outcomes only, in the same transaction as the
   * bind (so a failed save leaves nothing). Which provider, model and prompt produced the reading comes from the
   * server's own call lineage, never from the request, so the statistics cannot be skewed from the browser.
   */
  private async recordOutcomes(
    tx: Prisma.TransactionClient,
    sessionId: string,
    entity: OcrEntity,
    outcomes: readonly OutcomeInput[],
  ): Promise<void> {
    const valid = outcomes
      .filter((o) => FIELD_NAME.test(o.field))
      .slice(0, MAX_OUTCOMES);
    if (valid.length === 0) return;
    const produced = await tx.llmCallLineage.findFirst({
      where: { sessionRef: sessionId, outcome: 'OK' },
      orderBy: { createdAt: 'desc' },
      select: { providerKind: true, model: true, promptVersion: true },
    });
    await tx.ocrFieldOutcome.createMany({
      data: valid.map((o) => ({
        sessionId,
        entity,
        field: o.field,
        outcome: o.outcome,
        mustConfirm: o.mustConfirm,
        providerKind: produced?.providerKind ?? null,
        model: produced?.model ?? null,
        promptVersion: produced?.promptVersion ?? null,
      })),
    });
  }

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
