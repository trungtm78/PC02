import { z } from 'zod';

/**
 * Typed evidence structure returned by the analysis stage (G2) for a bundle of scanned pages.
 *
 * It is the contract between the model and the rest of the pipeline. It is deliberately independent of
 * any form: the projection stage (G3) turns it into form fields with deterministic code, so the model
 * never decides which form field receives which value.
 *
 * Shape rules, so the same schema works on every provider (see llm/provider-safe-schema.ts):
 * no optional properties (use null), no unions except "value or null", no patterns or formats.
 * Semantic rules the schema cannot express (quotes exist on the cited page, ids resolve, amounts agree)
 * are enforced by the verification stage (G4), never trusted from the model.
 */

/** How a statement is backed: copied from the paper, inferred by the model, or stated by an official document. */
export const CLAIM_KINDS = ['QUOTED', 'INFERRED', 'ESTABLISHED'] as const;

export const DOCUMENT_TYPES = [
  'COMPLAINT',
  'TRANSFER_SLIP',
  'OFFICIAL_LETTER',
  'RECEIPT_STAMP',
  'ATTACHMENT',
  'OTHER',
] as const;

export const DOCUMENT_RELATIONS = [
  'FORWARDS',
  'RESPONDS_TO',
  'ATTACHES',
  'REFERS_TO',
] as const;

/**
 * Roles a person or organisation plays in the paperwork. There is deliberately no SUSPECT or
 * DEFENDANT: those are procedural statuses created by a decision, never by a complaint.
 */
export const PERSON_ROLES = [
  'COMPLAINANT',
  'ACCUSED',
  'VICTIM',
  'WITNESS',
  'FORWARDING_AGENCY',
  'RECEIVING_AGENCY',
  'SIGNATORY',
] as const;

export const AMOUNT_KINDS = [
  'LOSS_TOTAL',
  'ADVANCE_PAID',
  'INTEREST',
  'EXPENSE',
  'OTHER',
] as const;

export const SOURCE_CLASSES = [
  'DENUNCIATION',
  'CRIME_REPORT',
  'PROSECUTION_REQUEST',
  'COMPLAINT',
  'CIVIL_DISPUTE',
  'OTHER',
  'UNDETERMINED',
] as const;

export const CONTRADICTION_TOPICS = [
  'AMOUNT',
  'DATE',
  'IDENTITY',
  'OTHER',
] as const;

const ClaimKind = z.enum(CLAIM_KINDS);

/** A verbatim quote with the page it came from. The page is an id, never a position, so reordering pages keeps it valid. */
const Evidence = z.strictObject({
  pageId: z.string(),
  quote: z.string(),
});

/** A date as written, plus an ISO date only when the written date is complete and real. */
const DateText = z.strictObject({
  raw: z.string(),
  iso: z.string().nullable(),
});

const DocumentSchema = z.strictObject({
  id: z.string(),
  docType: z.enum(DOCUMENT_TYPES),
  number: z.string().nullable(),
  date: DateText.nullable(),
  issuer: z.string().nullable(),
  addressedTo: z.string().nullable(),
  pageIds: z.array(z.string()),
  relations: z.array(
    z.strictObject({
      targetId: z.string(),
      relation: z.enum(DOCUMENT_RELATIONS),
    }),
  ),
});

const PersonSchema = z.strictObject({
  id: z.string(),
  entityType: z.enum(['PERSON', 'ORGANIZATION']),
  name: z.string(),
  roles: z.array(z.enum(PERSON_ROLES)),
  idNumber: z.string().nullable(),
  idIssueDate: DateText.nullable(),
  idIssuePlace: z.string().nullable(),
  birthDate: DateText.nullable(),
  birthYear: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  claimKind: ClaimKind,
  evidence: z.array(Evidence),
});

const AmountSchema = z.strictObject({
  id: z.string(),
  amountKind: z.enum(AMOUNT_KINDS),
  /** The figure as written, e.g. "495.253.647". */
  digits: z.string().nullable(),
  /** The figure in words as written, when the paper gives it. */
  words: z.string().nullable(),
  /** The model's reading of the figure in VND. Verified against `digits` and `words` in G4; never trusted alone. */
  valueVnd: z.number().int().nullable(),
  date: DateText.nullable(),
  purpose: z.string().nullable(),
  claimKind: ClaimKind,
  evidence: z.array(Evidence),
});

const EventSchema = z.strictObject({
  id: z.string(),
  date: DateText.nullable(),
  place: z.string().nullable(),
  description: z.string(),
  personIds: z.array(z.string()),
  amountIds: z.array(z.string()),
  claimKind: ClaimKind,
  evidence: z.array(Evidence),
});

const LegalAssessmentSchema = z.strictObject({
  id: z.string(),
  offence: z.string(),
  /** Article number when the paper names it or the model infers it; verified against the offence directory later. */
  article: z.number().int().nullable(),
  law: z.string().nullable(),
  reason: z.string(),
  claimKind: ClaimKind,
  evidence: z.array(Evidence),
});

const RequestSchema = z.strictObject({
  id: z.string(),
  text: z.string(),
  evidence: z.array(Evidence),
});

const ContradictionSchema = z.strictObject({
  id: z.string(),
  topic: z.enum(CONTRADICTION_TOPICS),
  description: z.string(),
  /** Ids of the amounts, events or people that disagree. */
  itemRefs: z.array(z.string()),
  evidence: z.array(Evidence),
});

/** One numbered point of the summary. `segmentIds` are the transcript segments it covers. */
const PointSchema = z.strictObject({
  id: z.string(),
  text: z.string(),
  segmentIds: z.array(z.string()),
});

/** Every transcript segment must be assigned to points, or declared to carry none, with the reason. */
const SegmentCoverageSchema = z.strictObject({
  segmentId: z.string(),
  pointIds: z.array(z.string()),
  carriesNoPointReason: z.string().nullable(),
});

export const EvidenceBundleSchema = z.strictObject({
  documents: z.array(DocumentSchema),
  people: z.array(PersonSchema),
  amounts: z.array(AmountSchema),
  events: z.array(EventSchema),
  legalAssessments: z.array(LegalAssessmentSchema),
  sourceClass: z.strictObject({
    value: z.enum(SOURCE_CLASSES),
    reason: z.string(),
    claimKind: ClaimKind,
    evidence: z.array(Evidence),
  }),
  requests: z.array(RequestSchema),
  contradictions: z.array(ContradictionSchema),
  points: z.array(PointSchema),
  segmentCoverage: z.array(SegmentCoverageSchema),
  unreadable: z.array(z.strictObject({ pageId: z.string(), note: z.string() })),
  summary: z.strictObject({
    opening: z.string(),
    pointIds: z.array(z.string()),
  }),
  /** True when the pages look like they belong to different complaints. */
  /** How the act was committed, in the writer's terms; null when the paperwork does not say. */
  modusOperandi: z
    .strictObject({
      text: z.string(),
      claimKind: ClaimKind,
      evidence: z.array(Evidence),
    })
    .nullable(),
  mixedBundleWarning: z.boolean(),
});

export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
export type ClaimKindValue = (typeof CLAIM_KINDS)[number];

/** The schema sent to providers; derived from the validator so the two can never drift. */
export const EVIDENCE_BUNDLE_JSON_SCHEMA = z.toJSONSchema(
  EvidenceBundleSchema,
) as Record<string, unknown>;
