import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import type {
  OcrEntity,
  OcrSessionStatus,
  OcrTranscriptSource,
  Prisma,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OcrImportError } from '../ocr-import-error';

export interface Actor {
  id: string;
}

export interface PageFileMeta {
  /** sha256 of the original bytes. */
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  originalPath: string;
  derivedPath?: string | null;
  derivedTransforms?: string | null;
}

export interface SessionView {
  id: string;
  entity: OcrEntity;
  status: OcrSessionStatus;
  pageSetRevision: number;
  boundRecordId: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface PageView {
  id: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface AnalysisResult {
  entity: OcrEntity;
  pageSetRevision: number;
  /** Fingerprint of the input state this result was computed from. */
  inputFingerprint: string;
  bundle: Prisma.InputJsonValue;
  cleaned: Prisma.InputJsonValue;
  issues: Prisma.InputJsonValue;
  projection: Prisma.InputJsonValue;
  promptVersions: Prisma.InputJsonValue;
}

export interface SessionOptions {
  maxPages: number;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_OPTIONS: SessionOptions = { maxPages: 20 };

interface LockedSession {
  id: string;
  createdById: string;
  status: OcrSessionStatus;
  pageSetRevision: number;
}

/**
 * Sessions of scan-image intake: the pages of one bundle, and everything derived from them as immutable revisions.
 *
 * Every change to the page list writes a NEW page-set revision; every reading or correction of a page's text writes
 * a NEW transcript revision; an analysis is bound to a fingerprint of the exact input state it was computed from and
 * becomes the current one only if that state still stands when it is published. A late result for an older state is
 * kept as history but can never replace a newer one. Mutations take a row lock on the session, so concurrent
 * changes and concurrent publications are serialised instead of racing.
 *
 * A session is visible only to its creator; anyone else gets "not found", which does not reveal that it exists.
 */
@Injectable()
export class OcrSessionsService {
  private readonly options: SessionOptions;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() options?: SessionOptions,
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
  }

  async createSession(entity: OcrEntity, actor: Actor): Promise<SessionView> {
    const row = await this.prisma.ocrSession.create({
      data: {
        entity,
        createdById: actor.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return this.toView(row);
  }

  async getSession(id: string, actor: Actor): Promise<SessionView> {
    const row = await this.prisma.ocrSession.findUnique({ where: { id } });
    if (!row || row.createdById !== actor.id) this.notFound();
    return this.toView(row);
  }

  async addPage(
    sessionId: string,
    file: PageFileMeta,
    actor: Actor,
  ): Promise<{ page: PageView; pageSetRevision: number }> {
    return this.prisma
      .$transaction(async (tx) => {
        const session = await this.lock(tx, sessionId, actor, { open: true });
        const current = await this.currentPages(tx, session);
        if (current.length >= this.options.maxPages) {
          throw new OcrImportError('OCR_TOO_MANY_PAGES', HttpStatus.CONFLICT, {
            limit: this.options.maxPages,
          });
        }
        if (current.some((p) => p.sha256 === file.sha256)) this.duplicate();

        const page = await tx.ocrPage.create({
          data: {
            sessionId,
            sha256: file.sha256,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            originalPath: file.originalPath,
            derivedPath: file.derivedPath ?? null,
            derivedTransforms: file.derivedTransforms ?? null,
          },
        });
        const revision = await this.newPageSet(tx, session, [
          ...current,
          { id: page.id, sha256: page.sha256 },
        ]);
        return { page: this.toPageView(page), pageSetRevision: revision };
      })
      .catch((error: unknown) => {
        // Two uploads of the same scan racing past the pre-check hit the partial unique index.
        if ((error as { code?: string }).code === 'P2002') this.duplicate();
        throw error;
      });
  }

  async reorderPages(
    sessionId: string,
    orderedPageIds: string[],
    actor: Actor,
  ): Promise<{ pageSetRevision: number }> {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.lock(tx, sessionId, actor, { open: true });
      const current = await this.currentPages(tx, session);
      const byId = new Map(current.map((p) => [p.id, p]));
      const sameSet =
        orderedPageIds.length === current.length &&
        new Set(orderedPageIds).size === orderedPageIds.length &&
        orderedPageIds.every((id) => byId.has(id));
      if (!sameSet) {
        throw new OcrImportError(
          'OCR_PAGE_SET_MISMATCH',
          HttpStatus.BAD_REQUEST,
        );
      }
      const revision = await this.newPageSet(
        tx,
        session,
        orderedPageIds.map((id) => byId.get(id) as PageRef),
      );
      return { pageSetRevision: revision };
    });
  }

  async removePage(
    sessionId: string,
    pageId: string,
    actor: Actor,
  ): Promise<{ pageSetRevision: number }> {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.lock(tx, sessionId, actor, { open: true });
      const current = await this.currentPages(tx, session);
      if (!current.some((p) => p.id === pageId)) this.pageNotFound();
      await tx.ocrPage.update({
        where: { id: pageId },
        data: { removedAt: new Date() },
      });
      const revision = await this.newPageSet(
        tx,
        session,
        current.filter((p) => p.id !== pageId),
      );
      return { pageSetRevision: revision };
    });
  }

  /** The pages of the current revision, in order. */
  async listPages(sessionId: string, actor: Actor): Promise<PageView[]> {
    const session = await this.getOwned(sessionId, actor);
    const refs = await this.currentPages(this.prisma, session);
    const rows = await this.prisma.ocrPage.findMany({
      where: { id: { in: refs.map((p) => p.id) } },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return refs.map((ref) =>
      this.toPageView(
        byId.get(ref.id) as NonNullable<ReturnType<typeof byId.get>>,
      ),
    );
  }

  async cancel(sessionId: string, actor: Actor): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const session = await this.lock(tx, sessionId, actor, { open: false });
      if (session.status === 'BOUND') {
        throw new OcrImportError('OCR_SESSION_CLOSED', HttpStatus.CONFLICT);
      }
      // Expires now, so the next purge removes it together with its files.
      await tx.ocrSession.update({
        where: { id: sessionId },
        data: { status: 'CANCELLED', expiresAt: new Date() },
      });
    });
  }

  async saveTranscript(
    sessionId: string,
    pageId: string,
    input: {
      text: string;
      source: OcrTranscriptSource;
      pageKind?: string | null;
      promptVersion?: string | null;
    },
    actor: Actor,
  ): Promise<{ revision: number }> {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.lock(tx, sessionId, actor, { open: true });
      const current = await this.currentPages(tx, session);
      if (!current.some((p) => p.id === pageId)) this.pageNotFound();
      const last = await tx.ocrTranscript.aggregate({
        _max: { revision: true },
        where: { pageId },
      });
      const revision = (last._max.revision ?? 0) + 1;
      await tx.ocrTranscript.create({
        data: {
          pageId,
          revision,
          text: input.text,
          source: input.source,
          pageKind: input.pageKind ?? null,
          promptVersion: input.promptVersion ?? null,
        },
      });
      return { revision };
    });
  }

  async latestTranscripts(
    sessionId: string,
    actor: Actor,
  ): Promise<
    Record<
      string,
      { text: string; revision: number; source: OcrTranscriptSource }
    >
  > {
    const session = await this.getOwned(sessionId, actor);
    const latest = await this.latestRevisions(this.prisma, session);
    const result: Record<
      string,
      { text: string; revision: number; source: OcrTranscriptSource }
    > = {};
    for (const [pageId, row] of latest) {
      result[pageId] = {
        text: row.text,
        revision: row.revision,
        source: row.source,
      };
    }
    return result;
  }

  /** Fingerprint of the input state: the page-set revision, the ordered pages and each page's latest transcript. */
  async currentFingerprint(sessionId: string): Promise<string> {
    const session = await this.prisma.ocrSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) this.notFound();
    return this.fingerprintIn(this.prisma, session);
  }

  /**
   * Stores an analysis. It becomes the current one only when the state it was computed from still stands; otherwise it
   * is kept as history. The session row is locked, so concurrent publications are applied one after the other.
   */
  async publishAnalysis(
    sessionId: string,
    result: AnalysisResult,
    actor: Actor,
  ): Promise<{ id: string; isCurrent: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.lock(tx, sessionId, actor, { open: false });
      const fingerprint = await this.fingerprintIn(tx, session);
      const isCurrent = result.inputFingerprint === fingerprint;
      if (isCurrent) {
        await tx.ocrAnalysis.updateMany({
          where: { sessionId, isCurrent: true },
          data: { isCurrent: false },
        });
      }
      const row = await tx.ocrAnalysis.create({
        data: {
          sessionId,
          entity: result.entity,
          pageSetRevision: result.pageSetRevision,
          inputFingerprint: result.inputFingerprint,
          bundle: result.bundle,
          cleaned: result.cleaned,
          issues: result.issues,
          projection: result.projection,
          promptVersions: result.promptVersions,
          isCurrent,
        },
      });
      return { id: row.id, isCurrent };
    });
  }

  /** The analysis that matches the present input state, or null when the state has moved on since. */
  async currentAnalysis(sessionId: string, actor: Actor) {
    const session = await this.getOwned(sessionId, actor);
    const analysis = await this.prisma.ocrAnalysis.findFirst({
      where: { sessionId, isCurrent: true },
    });
    if (!analysis) return null;
    const fingerprint = await this.fingerprintIn(this.prisma, session);
    return analysis.inputFingerprint === fingerprint ? analysis : null;
  }

  /** Deletes unbound sessions past their expiry and returns the files that belonged to them. */
  async purgeExpired(
    now: Date,
  ): Promise<{ files: string[]; sessions: number }> {
    const expired = await this.prisma.ocrSession.findMany({
      where: { status: { not: 'BOUND' }, expiresAt: { lt: now } },
      include: { pages: { select: { originalPath: true, derivedPath: true } } },
    });
    // One session at a time, and files are reported only for sessions this call really deleted: a Save may bind a
    // listed session at any moment, and the guard in the delete keeps it. Reporting the files of a kept session would
    // have the caller delete the originals of a record that was just saved.
    const files: string[] = [];
    let sessions = 0;
    for (const session of expired) {
      const { count } = await this.prisma.ocrSession.deleteMany({
        where: { id: session.id, status: { not: 'BOUND' } },
      });
      if (count === 0) continue;
      sessions += 1;
      for (const page of session.pages) {
        for (const file of [page.originalPath, page.derivedPath]) {
          if (file) files.push(file);
        }
      }
    }
    return { files, sessions };
  }

  // ── internals ───────────────────────────────────────────────────────────────────────────────────────────────────

  private async getOwned(sessionId: string, actor: Actor) {
    const row = await this.prisma.ocrSession.findUnique({
      where: { id: sessionId },
    });
    if (!row || row.createdById !== actor.id) this.notFound();
    return row;
  }

  /** Locks the session row for the rest of the transaction and checks the caller owns it (and that it is open). */
  private async lock(
    tx: Prisma.TransactionClient,
    sessionId: string,
    actor: Actor,
    options: { open: boolean },
  ): Promise<LockedSession> {
    const rows = await tx.$queryRaw<LockedSession[]>`
      SELECT id, "createdById", status, "pageSetRevision"
      FROM ocr_sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = rows[0];
    if (!session || session.createdById !== actor.id) this.notFound();
    if (options.open && session.status !== 'OPEN') {
      throw new OcrImportError('OCR_SESSION_CLOSED', HttpStatus.CONFLICT);
    }
    return session;
  }

  private async currentPages(
    client: Pick<Prisma.TransactionClient, 'ocrPageSet'>,
    session: { id: string; pageSetRevision: number },
  ): Promise<PageRef[]> {
    if (session.pageSetRevision === 0) return [];
    const set = await client.ocrPageSet.findUnique({
      where: {
        sessionId_revision: {
          sessionId: session.id,
          revision: session.pageSetRevision,
        },
      },
    });
    return (set?.pages as unknown as PageRef[] | undefined) ?? [];
  }

  private async newPageSet(
    tx: Prisma.TransactionClient,
    session: LockedSession,
    pages: PageRef[],
  ): Promise<number> {
    const revision = session.pageSetRevision + 1;
    await tx.ocrPageSet.create({
      data: {
        sessionId: session.id,
        revision,
        pages: pages as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.ocrSession.update({
      where: { id: session.id },
      data: { pageSetRevision: revision },
    });
    return revision;
  }

  private async latestRevisions(
    client: Pick<Prisma.TransactionClient, 'ocrPageSet' | 'ocrTranscript'>,
    session: { id: string; pageSetRevision: number },
  ) {
    const pages = await this.currentPages(client, session);
    const rows = await client.ocrTranscript.findMany({
      where: { pageId: { in: pages.map((p) => p.id) } },
      orderBy: { revision: 'desc' },
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows)
      if (!latest.has(row.pageId)) latest.set(row.pageId, row);
    return latest;
  }

  private async fingerprintIn(
    client: Pick<Prisma.TransactionClient, 'ocrPageSet' | 'ocrTranscript'>,
    session: { id: string; pageSetRevision: number },
  ): Promise<string> {
    const pages = await this.currentPages(client, session);
    const latest = await this.latestRevisions(client, session);
    const state = [
      session.pageSetRevision,
      pages.map((p) => [p.id, p.sha256, latest.get(p.id)?.revision ?? 0]),
    ];
    return createHash('sha256').update(JSON.stringify(state)).digest('hex');
  }

  private toView(row: {
    id: string;
    entity: OcrEntity;
    status: OcrSessionStatus;
    pageSetRevision: number;
    boundRecordId: string | null;
    expiresAt: Date;
    createdAt: Date;
  }): SessionView {
    return {
      id: row.id,
      entity: row.entity,
      status: row.status,
      pageSetRevision: row.pageSetRevision,
      boundRecordId: row.boundRecordId,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }

  private toPageView(row: {
    id: string;
    sha256: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  }): PageView {
    return {
      id: row.id,
      sha256: row.sha256,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
    };
  }

  private notFound(): never {
    throw new OcrImportError('OCR_SESSION_NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  private pageNotFound(): never {
    throw new OcrImportError('OCR_PAGE_NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  private duplicate(): never {
    throw new OcrImportError('OCR_PAGE_DUPLICATE', HttpStatus.CONFLICT);
  }
}

interface PageRef {
  id: string;
  sha256: string;
}
