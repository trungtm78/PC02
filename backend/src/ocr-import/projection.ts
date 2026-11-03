import { FIELD_POLICY, mayAiFill } from './chinh-sach-o';
import type {
  ClaimKindValue,
  EvidenceBundle,
} from './evidence/evidence.schema';
import { OCR_FORM_FIELDS, type FormEntity } from './khai-o-form.generated';
import { FIELD_UNITS, fromVnd } from './unit-contract';

/**
 * G3: deterministic projection of the typed evidence into the fields of the open form.
 *
 * No model is involved here. Which part of the evidence feeds which field is written down as one rule per field,
 * so the same evidence always gives the same fill, an ambiguity stays "not filled" instead of being guessed, and a
 * reviewer can read the whole mapping in one file. Only fields the policy lets a model fill (`chinh-sach-o.ts`) and
 * that the open form actually has are ever produced.
 */

export type WarningCode =
  | 'MULTIPLE_COMPLAINANTS'
  | 'EARLIEST_EVENT_USED'
  | 'ID_NUMBER_FORMAT'
  | 'INFERRED_VALUE';

export type SkipReason =
  | 'NO_DATA'
  | 'DATE_INCOMPLETE'
  | 'AMOUNT_CONFLICT'
  | 'NO_ARTICLE';

export interface Provenance {
  claimKind: ClaimKindValue;
  pageId: string | null;
  quote: string | null;
}

/** A value that still has to be matched against a directory (needs the database), so it is not a form value yet. */
export type PendingResolution =
  | { kind: 'CRIME_BY_ARTICLE'; article: number; law: string | null }
  | { kind: 'DIRECTORY'; directory: 'NGUON_DON'; text: string };

export interface FieldFill {
  field: string;
  value: string | number;
  policy: 'AI_FILL' | 'AI_FILL_MUST_CONFIRM';
  provenance: Provenance;
  warnings: WarningCode[];
  pending?: PendingResolution;
}

export interface FieldSkip {
  field: string;
  reason: SkipReason;
  candidates?: number[];
}

export interface Projection {
  fills: FieldFill[];
  skips: FieldSkip[];
}

interface RuleHit {
  value: string | number;
  provenance: Provenance;
  warnings?: WarningCode[];
  pending?: PendingResolution;
}
type RuleOutcome = RuleHit | { skip: SkipReason; candidates?: number[] } | null;
type Rule = (bundle: EvidenceBundle) => RuleOutcome;

const provenanceOf = (
  claimKind: ClaimKindValue,
  evidence: ReadonlyArray<{ pageId: string; quote: string }> = [],
): Provenance => ({
  claimKind,
  pageId: evidence[0]?.pageId ?? null,
  quote: evidence[0]?.quote ?? null,
});

type Person = EvidenceBundle['people'][number];

const withRole = (bundle: EvidenceBundle, role: Person['roles'][number]) =>
  bundle.people.filter((p) => p.roles.includes(role));

/** Rule for a value read from the first complainant; warns when there are several. */
const fromComplainant =
  (
    read: (p: Person) => string | null,
    options?: { warn?: (value: string) => WarningCode[] },
  ): Rule =>
  (bundle) => {
    const complainants = withRole(bundle, 'COMPLAINANT');
    const person = complainants[0];
    if (!person) return null;
    const value = read(person);
    if (value === null || value.trim() === '') return null;
    const warnings: WarningCode[] = [...(options?.warn?.(value) ?? [])];
    if (complainants.length > 1) warnings.push('MULTIPLE_COMPLAINANTS');
    return {
      value,
      provenance: provenanceOf(person.claimKind, person.evidence),
      warnings,
    };
  };

/** A date field: the ISO date when the written date is complete and real, otherwise an explicit skip. */
const dateOrSkip = (
  date: { raw: string; iso: string | null } | null | undefined,
  provenance: Provenance,
): RuleOutcome => {
  if (!date) return null;
  if (!date.iso) return { skip: 'DATE_INCOMPLETE' };
  return { value: date.iso, provenance };
};

const documentRule =
  (
    docType: EvidenceBundle['documents'][number]['docType'],
    read: 'number' | 'date',
  ): Rule =>
  (bundle) => {
    const doc = bundle.documents.find((d) => d.docType === docType);
    if (!doc) return null;
    const provenance: Provenance = {
      claimKind: 'ESTABLISHED',
      pageId: doc.pageIds[0] ?? null,
      quote: null,
    };
    if (read === 'number')
      return doc.number ? { value: doc.number, provenance } : null;
    return dateOrSkip(doc.date, provenance);
  };

const ID_NUMBER = /^(\d{9}|\d{12})$/;

export const PROJECTION_RULES: Readonly<Record<string, Rule>> = {
  tenCungCap: fromComplainant((p) => p.name),
  sdtCungCap: fromComplainant((p) => p.phone),
  sinhNamCungCap: fromComplainant((p) => {
    if (p.birthYear && /^\d{4}$/.test(p.birthYear.trim()))
      return p.birthYear.trim();
    return p.birthDate?.iso ? p.birthDate.iso.slice(0, 4) : null;
  }),
  cccdCungCap: fromComplainant((p) => p.idNumber?.replace(/\s+/g, '') ?? null, {
    warn: (value) => (ID_NUMBER.test(value) ? [] : ['ID_NUMBER_FORMAT']),
  }),
  ngayCapCccd: (bundle) => {
    const person = withRole(bundle, 'COMPLAINANT')[0];
    if (!person?.idIssueDate) return null;
    return dateOrSkip(
      person.idIssueDate,
      provenanceOf(person.claimKind, person.evidence),
    );
  },
  noiCapCccd: fromComplainant((p) => p.idIssuePlace),
  diaChiCungCap: fromComplainant((p) => p.address),

  soPhieuChuyen: documentRule('TRANSFER_SLIP', 'number'),
  ngayPhieuChuyen: documentRule('TRANSFER_SLIP', 'date'),
  ngayVietDon: documentRule('COMPLAINT', 'date'),

  nguonDon: (bundle) => {
    const agency = withRole(bundle, 'FORWARDING_AGENCY')[0];
    if (!agency) return null;
    return {
      value: agency.name,
      provenance: provenanceOf(agency.claimKind, agency.evidence),
      pending: { kind: 'DIRECTORY', directory: 'NGUON_DON', text: agency.name },
    };
  },

  crimeChinhId: (bundle) => {
    const withArticle = bundle.legalAssessments.filter(
      (l) => l.article !== null,
    );
    if (withArticle.length === 0) {
      return bundle.legalAssessments.length > 0 ? { skip: 'NO_ARTICLE' } : null;
    }
    // A stated offence beats an inferred one.
    const best =
      withArticle.find((l) => l.claimKind !== 'INFERRED') ?? withArticle[0];
    return {
      value: '',
      provenance: provenanceOf(best.claimKind, best.evidence),
      warnings: best.claimKind === 'INFERRED' ? ['INFERRED_VALUE'] : [],
      pending: {
        kind: 'CRIME_BY_ARTICLE',
        article: best.article as number,
        law: best.law,
      },
    };
  },

  nghiVanDoiTuong: (bundle) => {
    const accused = withRole(bundle, 'ACCUSED');
    if (accused.length === 0) return null;
    return {
      value: accused.map((p) => p.name).join('; '),
      provenance: provenanceOf(accused[0].claimKind, accused[0].evidence),
    };
  },

  ngayXayRa: (bundle) => {
    const dated = bundle.events
      .filter((e) => e.date?.iso && e.claimKind !== 'INFERRED')
      .sort((a, b) =>
        (a.date!.iso as string).localeCompare(b.date!.iso as string),
      );
    if (dated.length === 0) return null;
    return {
      value: dated[0].date!.iso as string,
      provenance: provenanceOf(dated[0].claimKind, dated[0].evidence),
      warnings: ['EARLIEST_EVENT_USED'],
    };
  },

  'statistic.soTienBiThietHai': (bundle) => {
    const losses = bundle.amounts.filter(
      (a) => a.amountKind === 'LOSS_TOTAL' && a.valueVnd !== null,
    );
    if (losses.length === 0) return null;
    const distinct = [...new Set(losses.map((a) => a.valueVnd as number))].sort(
      (a, b) => a - b,
    );
    // Different totals across the pages are a contradiction for the officer to settle, never to be picked here.
    if (distinct.length > 1)
      return { skip: 'AMOUNT_CONFLICT', candidates: distinct };
    return {
      value: fromVnd(
        distinct[0],
        FIELD_UNITS['statistic.soTienBiThietHai'] as 'VND',
      ),
      provenance: provenanceOf(losses[0].claimKind, losses[0].evidence),
    };
  },

  'statistic.soLuongBiHai': (bundle) => {
    const victims = withRole(bundle, 'VICTIM').filter(
      (p) => p.entityType === 'PERSON',
    );
    if (victims.length === 0) return null;
    return {
      value: victims.length,
      provenance: provenanceOf('INFERRED', victims[0].evidence),
    };
  },

  phuongThucThuDoan: (bundle) =>
    bundle.modusOperandi
      ? {
          value: bundle.modusOperandi.text,
          provenance: provenanceOf(
            bundle.modusOperandi.claimKind,
            bundle.modusOperandi.evidence,
          ),
        }
      : null,

  noiXayRa: (bundle) => {
    const places = [
      ...new Set(
        bundle.events
          .map((e) => e.place?.trim())
          .filter((p): p is string => !!p),
      ),
    ].slice(0, 3);
    if (places.length === 0) return null;
    const first = bundle.events.find((e) => e.place?.trim() === places[0]);
    return {
      value: places.join('; '),
      provenance: provenanceOf(first?.claimKind ?? 'QUOTED', first?.evidence),
    };
  },

  description: (bundle) => {
    const pointText = new Map(bundle.points.map((p) => [p.id, p.text]));
    const lines = bundle.summary.pointIds
      .map((id) => pointText.get(id))
      .filter((text): text is string => !!text)
      .map((text, index) => `${index + 1}. ${text}`);
    if (!bundle.summary.opening.trim() && lines.length === 0) return null;
    return {
      value: [bundle.summary.opening.trim(), ...lines]
        .filter(Boolean)
        .join('\n'),
      provenance: { claimKind: 'INFERRED', pageId: null, quote: null },
    };
  },
};

/** Fillable fields that have no projection rule yet, each with the reason. A gate keeps this list honest. */
export const NOT_PROJECTED_YET: Readonly<Record<string, string>> = {
  loaiThongTin:
    'the values of the LOSS directory are not known yet, so a classification cannot be mapped safely',
  noiXayRaPhuongXa:
    'needs a ward-level address structure that the evidence does not carry',
  doVatTaiLieuKemTheo:
    'the list of attached items is not extracted from the pages yet',
};

/** Rules in the order fields appear in the catalogue, restricted to what the open form has and the policy allows. */
export function projectToForm(
  bundle: EvidenceBundle,
  entity: FormEntity,
): Projection {
  const fills: FieldFill[] = [];
  const skips: FieldSkip[] = [];
  for (const { field } of OCR_FORM_FIELDS[entity]) {
    const rule = PROJECTION_RULES[field];
    if (!rule || !mayAiFill(field)) continue;
    const outcome = rule(bundle);
    if (outcome === null) continue;
    if ('skip' in outcome) {
      skips.push({
        field,
        reason: outcome.skip,
        ...(outcome.candidates ? { candidates: outcome.candidates } : {}),
      });
      continue;
    }
    fills.push({
      field,
      value: outcome.value,
      policy: FIELD_POLICY[field] as 'AI_FILL' | 'AI_FILL_MUST_CONFIRM',
      provenance: outcome.provenance,
      warnings: outcome.warnings ?? [],
      ...(outcome.pending ? { pending: outcome.pending } : {}),
    });
  }
  return { fills, skips };
}
