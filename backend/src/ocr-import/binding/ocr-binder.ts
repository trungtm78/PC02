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
      request.ocrPhienBan ?? '',
      context.entity,
      request.ocrKetQua ?? [],
    );
  }

  /**
   * What the officer did with each field the reading filled. Names and outcomes only, in the same transaction as the
   * bind (so a failed save leaves nothing).
   *
   * The request is not trusted for anything but the officer's choices. Only fields the bound analysis really proposed
   * are counted, each once, so the statistics can be neither padded nor filled with arbitrary text from the browser;
   * and which provider, model and prompt produced the reading comes from the server's own call lineage, matched to the
   * analysis that was bound (not to whatever the session was read with last).
   */
  private async recordOutcomes(
    tx: Prisma.TransactionClient,
    sessionId: string,
    analysisId: string,
    entity: OcrEntity,
    outcomes: readonly OutcomeInput[],
  ): Promise<void> {
    if (outcomes.length === 0) return;
    const analysis = await tx.ocrAnalysis.findFirst({
      where: { id: analysisId, sessionId },
      select: { projection: true, promptVersions: true, createdAt: true },
    });
    if (!analysis) return;
    const proposed = new Set(filledFieldNames(analysis.projection));
    const seen = new Set<string>();
    const valid: OutcomeInput[] = [];
    for (const outcome of outcomes) {
      if (
        !FIELD_NAME.test(outcome.field) ||
        !proposed.has(outcome.field) ||
        seen.has(outcome.field)
      ) {
        continue;
      }
      seen.add(outcome.field);
      valid.push(outcome);
      if (valid.length === MAX_OUTCOMES) break;
    }
    if (valid.length === 0) return;
    const analysePrompt = promptVersionOf(analysis.promptVersions);
    const produced = await tx.llmCallLineage.findFirst({
      where: {
        sessionRef: sessionId,
        outcome: 'OK',
        // The call that produced this analysis ran before it was published; a later re-analysis is another analysis.
        createdAt: { lte: analysis.createdAt },
        ...(analysePrompt ? { promptVersion: analysePrompt } : {}),
      },
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

/** The server-side field names a stored projection proposed to fill. */
function filledFieldNames(projection: Prisma.JsonValue): string[] {
  const fills = (projection as { fills?: unknown } | null)?.fills;
  if (!Array.isArray(fills)) return [];
  return fills.flatMap((fill) => {
    const field = (fill as { field?: unknown } | null)?.field;
    return typeof field === 'string' ? [field] : [];
  });
}

function promptVersionOf(promptVersions: Prisma.JsonValue): string | null {
  const analyse = (promptVersions as { analyse?: unknown } | null)?.analyse;
  return typeof analyse === 'string' && analyse !== '' ? analyse : null;
}
