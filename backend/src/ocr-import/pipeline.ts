import { z } from 'zod';
import type { PolicyOutcome, Validation } from '../llm/call-policy';
import type { GatewayContext } from '../llm/llm-gateway.service';
import type { LlmImage, LlmRequest } from '../llm/llm.types';
import {
  DOCUMENT_TYPES,
  EVIDENCE_BUNDLE_JSON_SCHEMA,
  EvidenceBundleSchema,
  type EvidenceBundle,
} from './evidence/evidence.schema';
import type { FormEntity } from './khai-o-form.generated';
import { projectToForm, type Projection } from './projection';
import {
  ANALYSE_PROMPT_VERSION,
  ANALYSE_USER_PREFIX,
  analyseSystemPrompt,
} from './prompt/analyse.v1';
import {
  TRANSCRIBE_PROMPT_VERSION,
  TRANSCRIBE_USER_TEXT,
  transcribeSystemPrompt,
} from './prompt/transcribe.v1';
import { verifyBundle, type VerifyIssue } from './verify/verify';

/** The part of the LLM gateway the pipeline needs; `LlmGatewayService` satisfies it. */
export interface PipelineGateway {
  call<T>(
    request: LlmRequest,
    validate: (json: unknown) => Validation<T>,
    context: GatewayContext,
  ): Promise<PolicyOutcome<T>>;
}

export interface PageImage {
  id: string;
  mediaType: LlmImage['mediaType'];
  dataBase64: string;
}

export interface Segment {
  id: string;
  pageId: string;
  text: string;
}

export interface PipelineInput {
  pages: PageImage[];
  entity: FormEntity;
  context: { userId: string | null; sessionRef: string | null };
}

export interface PipelineOutput {
  transcripts: Record<string, string>;
  pageKinds: Record<string, string>;
  segments: Segment[];
  /** What the model returned, kept as the record of the analysis. */
  bundle: EvidenceBundle;
  /** The bundle after verification: only this is projected into the form. */
  cleaned: EvidenceBundle;
  issues: VerifyIssue[];
  projection: Projection;
  promptVersions: { transcribe: string; analyse: string };
}

const TRANSCRIPT_SCHEMA = z.strictObject({
  pageKind: z.enum(DOCUMENT_TYPES),
  printedPageNumber: z.string().nullable(),
  transcript: z.string(),
  unreadable: z.array(z.string()),
});

const TRANSCRIPT_JSON_SCHEMA = z.toJSONSchema(TRANSCRIPT_SCHEMA) as Record<
  string,
  unknown
>;

/** At most this many pages are sent to the provider at once. */
const PAGE_CONCURRENCY = 3;

/**
 * Room for the evidence bundle of a multi-page bundle of scans. The bundle lists every segment of the transcript and
 * every point, quote and amount, so it is long: a real three-page petition used 14,000 tokens and was cut off mid-reply
 * at the old fixed 8,000. It grows with the number of pages, up to a ceiling every current provider accepts.
 */
export function analyseOutputBudget(pageCount: number): number {
  return Math.min(48_000, 6_000 + 5_000 * Math.max(1, pageCount));
}

/** One segment per non-empty line, with an id the analysis can cite and the checks can verify. */
export function splitSegments(pageId: string, transcript: string): Segment[] {
  return transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((text, index) => ({ id: `${pageId}.s${index + 1}`, pageId, text }));
}

const validateWith =
  <T>(schema: z.ZodType<T>) =>
  (json: unknown): Validation<T> => {
    const parsed = schema.safeParse(json);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : {
          ok: false,
          // Paths and messages only: never the offending values, which may be personal data.
          issues: parsed.error.issues.map(
            (i) => `${i.path.join('.')}: ${i.message}`,
          ),
        };
  };

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    // After one item fails, the others finish what they hold but start nothing new: a failed job must not go on
    // sending pages to the provider in the background.
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await work(items[index]);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

export interface PageTranscript {
  pageId: string;
  pageKind: string;
  printedPageNumber: string | null;
  text: string;
}

/** G1: transcribe each page (at most three at a time). One provider call per page. */
export async function transcribePages(
  gateway: PipelineGateway,
  pages: readonly PageImage[],
  context: PipelineInput['context'],
): Promise<PageTranscript[]> {
  if (pages.length === 0) throw new Error('no pages to read');
  return mapWithConcurrency(pages, PAGE_CONCURRENCY, async (page) => {
    const { value } = await gateway.call(
      {
        system: transcribeSystemPrompt(),
        userText: TRANSCRIBE_USER_TEXT,
        images: [{ mediaType: page.mediaType, dataBase64: page.dataBase64 }],
        schemaName: 'submit_transcript',
        schema: TRANSCRIPT_JSON_SCHEMA,
        maxOutputTokens: 4000,
      },
      validateWith(TRANSCRIPT_SCHEMA),
      { ...context, promptVersion: TRANSCRIBE_PROMPT_VERSION },
    );
    return {
      pageId: page.id,
      pageKind: value.pageKind,
      printedPageNumber: value.printedPageNumber,
      text: value.transcript,
    };
  });
}

export interface AnalysisOutput {
  segments: Segment[];
  /** What the model returned, kept as the record of the analysis. */
  bundle: EvidenceBundle;
  /** The bundle after verification: only this is projected into the form. */
  cleaned: EvidenceBundle;
  issues: VerifyIssue[];
  projection: Projection;
  promptVersions: { transcribe: string; analyse: string };
}

/** Replaces every string that is exactly an alias with the real id it stood for; text and quotes are left alone. */
function restoreIds<T>(value: T, fromAlias: ReadonlyMap<string, string>): T {
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return fromAlias.get(node) ?? node;
    if (Array.isArray(node)) return node.map(walk);
    if (node !== null && typeof node === 'object') {
      return Object.fromEntries(
        Object.entries(node).map(([key, child]) => [key, walk(child)]),
      );
    }
    return node;
  };
  return walk(value) as T;
}

/**
 * G2 to G4 from page transcripts (the model's, or the officer's corrections): analyse the bundle once, verify the
 * analysis by code, and project the verified evidence into the fields of the open form.
 */
export async function analyseTranscripts(
  gateway: PipelineGateway,
  input: {
    /** In reading order. */
    pages: ReadonlyArray<{ pageId: string; text: string }>;
    entity: FormEntity;
    context: PipelineInput['context'];
  },
): Promise<AnalysisOutput> {
  const transcripts: Record<string, string> = {};
  const segments: Segment[] = [];
  // What the model sees: short aliases ("p2", "p2.s3"). Real ids are long generated strings that a model shortens or
  // misspells, which would make every citation unmatchable; the aliases are mapped back below.
  const fromAlias = new Map<string, string>();
  const listingLines: string[] = [];
  const aliasOfPage: string[] = [];
  input.pages.forEach((page, index) => {
    const alias = `p${index + 1}`;
    aliasOfPage.push(alias);
    fromAlias.set(alias, page.pageId);
    transcripts[page.pageId] = page.text;
    const own = splitSegments(page.pageId, page.text);
    segments.push(...own);
    own.forEach((segment, n) => {
      const segmentAlias = `${alias}.s${n + 1}`;
      fromAlias.set(segmentAlias, segment.id);
      listingLines.push(`[${segmentAlias}] ${segment.text}`);
    });
  });

  const { value: modelBundle } = await gateway.call(
    {
      system: analyseSystemPrompt(),
      userText: `${ANALYSE_USER_PREFIX}
Pages: ${aliasOfPage.join(', ')}

${listingLines.join(String.fromCharCode(10))}`,
      schemaName: 'submit_evidence',
      schema: EVIDENCE_BUNDLE_JSON_SCHEMA,
      maxOutputTokens: analyseOutputBudget(input.pages.length),
    },
    validateWith(EvidenceBundleSchema),
    { ...input.context, promptVersion: ANALYSE_PROMPT_VERSION },
  );
  const bundle = restoreIds(modelBundle, fromAlias);

  const { cleaned, issues } = verifyBundle(bundle, {
    transcripts,
    segmentIds: segments.map((s) => s.id),
  });
  return {
    segments,
    bundle,
    cleaned,
    issues,
    projection: projectToForm(cleaned, input.entity),
    promptVersions: {
      transcribe: TRANSCRIBE_PROMPT_VERSION,
      analyse: ANALYSE_PROMPT_VERSION,
    },
  };
}

/** G1 to G4 for a bundle of pages. Nothing here writes to a database or to the form: the caller stores the result. */
export async function runPipeline(
  gateway: PipelineGateway,
  input: PipelineInput,
): Promise<PipelineOutput> {
  const transcribed = await transcribePages(
    gateway,
    input.pages,
    input.context,
  );
  const analysis = await analyseTranscripts(gateway, {
    pages: transcribed.map((t) => ({ pageId: t.pageId, text: t.text })),
    entity: input.entity,
    context: input.context,
  });
  return {
    transcripts: Object.fromEntries(transcribed.map((t) => [t.pageId, t.text])),
    pageKinds: Object.fromEntries(
      transcribed.map((t) => [t.pageId, t.pageKind]),
    ),
    ...analysis,
  };
}
