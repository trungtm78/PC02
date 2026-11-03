import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { OcrJob, Prisma } from '@prisma/client';
import { LlmGatewayService } from '../../llm/llm-gateway.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { FormEntity } from '../khai-o-form.generated';
import { OcrImportError } from '../ocr-import-error';
import {
  analyseTranscripts,
  transcribePages,
  type PageImage,
  type PipelineGateway,
} from '../pipeline';
import { TRANSCRIBE_PROMPT_VERSION } from '../prompt/transcribe.v1';
import {
  OcrSessionsService,
  type Actor,
  type PageView,
  type SessionView,
} from '../sessions/ocr-sessions.service';
import { ImageStorageService } from '../storage/image-storage.service';

interface ReadContext {
  userId: string;
  sessionRef: string;
}

/**
 * Carries out one claimed job: reads the stored scans (READ only), keeps each reading as a transcript revision, then
 * analyses the transcripts the session holds now and publishes the result.
 *
 * It throws on failure and leaves the job's state to the caller, which classifies the error and retries or gives up.
 * Everything is derived from what is stored (originals, transcripts), so a retry after a crash starts from the same
 * place and a re-read never depends on the browser still having the files.
 */
@Injectable()
export class OcrReadExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: OcrSessionsService,
    private readonly storage: ImageStorageService,
    @Inject(LlmGatewayService) private readonly gateway: PipelineGateway,
  ) {}

  async execute(job: OcrJob): Promise<void> {
    const actor: Actor = { id: job.createdById };
    const session = await this.sessions.getSession(job.sessionId, actor);
    if (session.status !== 'OPEN') {
      throw new OcrImportError('OCR_SESSION_CLOSED', HttpStatus.CONFLICT);
    }
    const pages = await this.sessions.listPages(session.id, actor);
    if (pages.length === 0) {
      throw new OcrImportError('OCR_NO_PAGES', HttpStatus.CONFLICT);
    }
    const context: ReadContext = { userId: actor.id, sessionRef: session.id };

    if (job.kind === 'READ') {
      await this.readPages(session, pages, actor, context);
    }
    await this.analyse(session.id, actor, context);
  }

  private async readPages(
    session: SessionView,
    pages: PageView[],
    actor: Actor,
    context: ReadContext,
  ): Promise<void> {
    // The state this reading starts from. It is stored only if that state still stands when the provider answers.
    const startedFrom = await this.sessions.currentFingerprint(session.id);
    const images: PageImage[] = [];
    for (const page of pages) {
      images.push(await this.providerImage(session.id, page.id));
    }
    const transcribed = await transcribePages(this.gateway, images, context);
    await this.sessions.saveModelReadings(
      session.id,
      startedFrom,
      transcribed.map((t) => ({
        pageId: t.pageId,
        text: t.text,
        pageKind: t.pageKind,
        promptVersion: TRANSCRIBE_PROMPT_VERSION,
      })),
      actor,
    );
  }

  private async analyse(
    sessionId: string,
    actor: Actor,
    context: ReadContext,
  ): Promise<void> {
    // Text, page list and fingerprint come from one locked read, so the published analysis is labelled with the state
    // it really read. If the officer corrects a page while the provider works, the result is kept as history only.
    const snapshot = await this.sessions.snapshotForAnalysis(sessionId, actor);
    const ordered = snapshot.pages.map((page) => {
      if (page.text === null) {
        throw new OcrImportError(
          'OCR_TRANSCRIPT_MISSING',
          HttpStatus.CONFLICT,
        );
      }
      return { pageId: page.pageId, text: page.text };
    });
    const session = await this.sessions.getSession(sessionId, actor);

    const analysis = await analyseTranscripts(this.gateway, {
      pages: ordered,
      entity: session.entity.toLowerCase() as FormEntity,
      context,
    });

    const json = (value: unknown) => value as Prisma.InputJsonValue;
    await this.sessions.publishAnalysis(
      sessionId,
      {
        entity: session.entity,
        pageSetRevision: snapshot.pageSetRevision,
        inputFingerprint: snapshot.fingerprint,
        bundle: json(analysis.bundle),
        cleaned: json(analysis.cleaned),
        issues: json(analysis.issues),
        projection: json(analysis.projection),
        promptVersions: json(analysis.promptVersions),
      },
      actor,
    );
  }

  /** The copy sent to the provider, derived from the stored original on first use and kept for the next reading. */
  private async providerImage(
    sessionId: string,
    pageId: string,
  ): Promise<PageImage> {
    const page = await this.prisma.ocrPage.findUniqueOrThrow({
      where: { id: pageId },
    });
    if (page.derivedPath) {
      try {
        const stored = await this.storage.read(page.derivedPath);
        return this.toImage(pageId, stored);
      } catch (error) {
        if ((error as { ocrCode?: string }).ocrCode !== 'OCR_PAGE_NOT_FOUND') {
          throw error;
        }
        // The derived copy is gone: it can always be rebuilt from the original.
      }
    }
    const original = await this.storage.read(page.originalPath);
    const derived = await this.storage.deriveForProvider(original);
    const derivedPath = await this.storage.saveDerived(
      sessionId,
      page.sha256,
      derived,
    );
    await this.prisma.ocrPage.update({
      where: { id: pageId },
      data: { derivedPath, derivedTransforms: derived.transforms },
    });
    return this.toImage(pageId, derived.buffer);
  }

  private toImage(id: string, bytes: Buffer): PageImage {
    return {
      id,
      mediaType: 'image/jpeg',
      dataBase64: bytes.toString('base64'),
    };
  }
}
