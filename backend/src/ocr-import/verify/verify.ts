import type { EvidenceBundle } from '../evidence/evidence.schema';
import {
  parseVietnameseDigits,
  parseVietnameseWords,
} from './vietnamese-number';

/**
 * G4: checks done by code on what the model returned. None of it trusts the model.
 *
 * - A quoted or established claim must be backed by a quote that really is on the cited page; otherwise the claim is
 *   dropped (a fabricated value never reaches the form), and the issue says which claim and why.
 * - A figure is read from its digits and its words independently; they must agree.
 * - Dates must be real, ID numbers must agree with the stated birth year, references must resolve, every transcript
 *   segment must be covered, and a figure in the transcript that the analysis never mentions is reported.
 *
 * It is a pure function: the input bundle is never modified, and issues carry only codes, paths, ids and numbers,
 * never transcript text or identifiers.
 */

export type IssueCode =
  | 'QUOTE_NOT_FOUND'
  | 'QUOTE_MISSING'
  | 'PAGE_UNKNOWN'
  | 'AMOUNT_VALUE_CORRECTED'
  | 'AMOUNT_WORDS_MISMATCH'
  | 'ID_BIRTH_YEAR_MISMATCH'
  | 'ID_ISSUED_BEFORE_BIRTH'
  | 'DATE_INVALID'
  | 'BROKEN_REFERENCE'
  | 'UNASSIGNED_SEGMENT'
  | 'POINT_NOT_IN_SUMMARY'
  | 'FIGURE_NOT_IN_ANALYSIS';

export type IssueSeverity = 'WARN' | 'DROPPED' | 'CORRECTED';

export interface VerifyIssue {
  code: IssueCode;
  severity: IssueSeverity;
  /** Location in the cleaned bundle, for example `people[1]`. */
  path?: string;
  detail?: Record<string, number | string | null>;
}

export interface VerifyContext {
  /** Transcript text of each page, by page id. */
  transcripts: Readonly<Record<string, string>>;
  /** Ids of every segment the transcript was split into. */
  segmentIds: readonly string[];
}

export interface VerifyResult {
  cleaned: EvidenceBundle;
  issues: VerifyIssue[];
}

/** Lower-case, Unicode-composed, with punctuation and runs of spaces collapsed, so a quote survives re-flowing. */
export function normalizeForQuote(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const isRealIsoDate = (iso: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

type Evidence = { pageId: string; quote: string };
type DateText = { raw: string; iso: string | null };

export function verifyBundle(
  input: EvidenceBundle,
  context: VerifyContext,
): VerifyResult {
  const cleaned: EvidenceBundle = structuredClone(input);
  const issues: VerifyIssue[] = [];
  const add = (issue: VerifyIssue) => issues.push(issue);

  checkDates(cleaned, add);
  checkAmounts(cleaned, add);
  const dropped = dropUnverifiedClaims(cleaned, context, add);
  checkReferences(input, cleaned, dropped, add);
  checkIdentity(cleaned, add);
  checkCoverage(cleaned, context, add);
  return { cleaned, issues };
}

// ── dates ───────────────────────────────────────────────────────────────────────────────────────────────────────

function checkDates(
  bundle: EvidenceBundle,
  add: (i: VerifyIssue) => void,
): void {
  const fix = (date: DateText | null | undefined, path: string) => {
    if (date?.iso && !isRealIsoDate(date.iso)) {
      date.iso = null;
      add({ code: 'DATE_INVALID', severity: 'CORRECTED', path });
    }
  };
  bundle.documents.forEach((d, i) => fix(d.date, `documents[${i}].date`));
  bundle.people.forEach((p, i) => {
    fix(p.idIssueDate, `people[${i}].idIssueDate`);
    fix(p.birthDate, `people[${i}].birthDate`);
  });
  bundle.amounts.forEach((a, i) => fix(a.date, `amounts[${i}].date`));
  bundle.events.forEach((e, i) => fix(e.date, `events[${i}].date`));
}

// ── amounts ─────────────────────────────────────────────────────────────────────────────────────────────────────

function checkAmounts(
  bundle: EvidenceBundle,
  add: (i: VerifyIssue) => void,
): void {
  bundle.amounts.forEach((amount, i) => {
    const digits = amount.digits ? parseVietnameseDigits(amount.digits) : null;
    const words = amount.words ? parseVietnameseWords(amount.words) : null;
    const path = `amounts[${i}]`;

    if (digits !== null && words !== null && digits !== words) {
      // One of the two was misread and we cannot tell which: withhold the value instead of guessing.
      amount.valueVnd = null;
      add({
        code: 'AMOUNT_WORDS_MISMATCH',
        severity: 'WARN',
        path,
        detail: { digits, words },
      });
      return;
    }
    const written = digits ?? words;
    if (written !== null && amount.valueVnd !== written) {
      add({
        code: 'AMOUNT_VALUE_CORRECTED',
        severity: 'CORRECTED',
        path,
        detail: { model: amount.valueVnd, written },
      });
      amount.valueVnd = written;
    }
  });
}

// ── quotes ──────────────────────────────────────────────────────────────────────────────────────────────────────

interface Claim {
  claimKind?: string;
  evidence: Evidence[];
}

/** Returns the ids that were dropped, so dangling references to them can be removed without being reported. */
function dropUnverifiedClaims(
  bundle: EvidenceBundle,
  context: VerifyContext,
  add: (i: VerifyIssue) => void,
): Set<string> {
  const normalizedPages = new Map(
    Object.entries(context.transcripts).map(([id, text]) => [
      id,
      normalizeForQuote(text),
    ]),
  );
  const dropped = new Set<string>();

  /** Splits evidence into verified entries and the failure codes of the others. */
  const verify = (evidence: Evidence[]) => {
    const failures: IssueCode[] = [];
    const verified = evidence.filter((entry) => {
      const page = normalizedPages.get(entry.pageId);
      if (page === undefined) {
        failures.push('PAGE_UNKNOWN');
        return false;
      }
      const quote = normalizeForQuote(entry.quote);
      if (quote === '' || !page.includes(quote)) {
        failures.push('QUOTE_NOT_FOUND');
        return false;
      }
      return true;
    });
    if (evidence.length === 0) failures.push('QUOTE_MISSING');
    return { verified, failures };
  };

  const filterList = <T extends Claim & { id: string }>(
    items: T[],
    name: string,
  ): T[] => {
    const kept: T[] = [];
    items.forEach((item, index) => {
      const needsQuote = item.claimKind !== 'INFERRED';
      const { verified, failures } = verify(item.evidence);
      const path = `${name}[${index}]`;
      if (needsQuote && verified.length === 0) {
        dropped.add(item.id);
        for (const code of new Set(failures))
          add({ code, severity: 'DROPPED', path });
        return;
      }
      if (verified.length < item.evidence.length) {
        for (const code of new Set(failures))
          add({ code, severity: 'WARN', path });
      }
      item.evidence = verified;
      kept.push(item);
    });
    return kept;
  };

  bundle.people = filterList(bundle.people, 'people');
  bundle.amounts = filterList(bundle.amounts, 'amounts');
  bundle.events = filterList(bundle.events, 'events');
  bundle.legalAssessments = filterList(
    bundle.legalAssessments,
    'legalAssessments',
  );

  // Requests carry no claim kind: they are always quotations.
  bundle.requests = filterList(bundle.requests, 'requests');

  if (bundle.modusOperandi) {
    const modus = bundle.modusOperandi;
    const { verified, failures } = verify(modus.evidence);
    if (modus.claimKind !== 'INFERRED' && verified.length === 0) {
      for (const code of new Set(failures))
        add({ code, severity: 'DROPPED', path: 'modusOperandi' });
      bundle.modusOperandi = null;
    } else {
      modus.evidence = verified;
    }
  }

  // The source class cannot be dropped, so an unbacked one is downgraded to an inference.
  const sourceClass = bundle.sourceClass;
  const checked = verify(sourceClass.evidence);
  if (sourceClass.claimKind !== 'INFERRED' && checked.verified.length === 0) {
    for (const code of new Set(checked.failures))
      add({ code, severity: 'WARN', path: 'sourceClass' });
    sourceClass.claimKind = 'INFERRED';
  }
  sourceClass.evidence = checked.verified;

  bundle.contradictions.forEach((c) => {
    c.evidence = verify(c.evidence).verified;
  });
  return dropped;
}

// ── references ──────────────────────────────────────────────────────────────────────────────────────────────────

function checkReferences(
  original: EvidenceBundle,
  cleaned: EvidenceBundle,
  dropped: ReadonlySet<string>,
  add: (i: VerifyIssue) => void,
): void {
  const idsOf = (b: EvidenceBundle) =>
    new Set([
      ...b.people.map((p) => p.id),
      ...b.amounts.map((a) => a.id),
      ...b.events.map((e) => e.id),
      ...b.documents.map((d) => d.id),
    ]);
  const originalIds = idsOf(original);
  const present = idsOf(cleaned);

  /** Keeps resolvable ids; a dangling id is reported unless it only dangles because its target was dropped. */
  const resolve = (
    ids: string[],
    path: string,
    universe: ReadonlySet<string>,
  ): string[] =>
    ids.filter((id) => {
      if (universe.has(id) && present.has(id)) return true;
      if (!dropped.has(id) && !originalIds.has(id)) {
        add({
          code: 'BROKEN_REFERENCE',
          severity: 'CORRECTED',
          path,
          detail: { id },
        });
      }
      return false;
    });

  const people = new Set(cleaned.people.map((p) => p.id).concat([...dropped]));
  const amounts = new Set(
    cleaned.amounts.map((a) => a.id).concat([...dropped]),
  );
  cleaned.events.forEach((event, i) => {
    event.personIds = resolve(
      event.personIds,
      `events[${i}].personIds`,
      people,
    );
    event.amountIds = resolve(
      event.amountIds,
      `events[${i}].amountIds`,
      amounts,
    );
  });
  const documents = new Set(cleaned.documents.map((d) => d.id));
  cleaned.documents.forEach((doc, i) => {
    doc.relations = doc.relations.filter((relation) => {
      if (documents.has(relation.targetId)) return true;
      add({
        code: 'BROKEN_REFERENCE',
        severity: 'CORRECTED',
        path: `documents[${i}].relations`,
        detail: { id: relation.targetId },
      });
      return false;
    });
  });
  const everything = new Set([...present, ...dropped]);
  cleaned.contradictions.forEach((c, i) => {
    c.itemRefs = resolve(
      c.itemRefs,
      `contradictions[${i}].itemRefs`,
      everything,
    );
  });

  const points = new Set(cleaned.points.map((p) => p.id));
  const keepPoints = (ids: string[], path: string) =>
    ids.filter((id) => {
      if (points.has(id)) return true;
      add({
        code: 'BROKEN_REFERENCE',
        severity: 'CORRECTED',
        path,
        detail: { id },
      });
      return false;
    });
  cleaned.summary.pointIds = keepPoints(
    cleaned.summary.pointIds,
    'summary.pointIds',
  );
  cleaned.segmentCoverage.forEach((c, i) => {
    c.pointIds = keepPoints(c.pointIds, `segmentCoverage[${i}].pointIds`);
  });
}

// ── identity ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The 4th digit of a 12-digit citizen ID encodes sex and century (0/1 = 1900s, 2/3 = 2000s); digits 5-6 the year. */
function encodedBirthYear(idNumber: string): number | null {
  const digits = idNumber.replace(/\s+/g, '');
  if (!/^\d{12}$/.test(digits)) return null;
  return (
    1900 + 100 * Math.floor(Number(digits[3]) / 2) + Number(digits.slice(4, 6))
  );
}

function checkIdentity(
  bundle: EvidenceBundle,
  add: (i: VerifyIssue) => void,
): void {
  bundle.people.forEach((person, i) => {
    const path = `people[${i}]`;
    const stated =
      person.birthYear && /^\d{4}$/.test(person.birthYear.trim())
        ? Number(person.birthYear.trim())
        : person.birthDate?.iso
          ? Number(person.birthDate.iso.slice(0, 4))
          : null;

    const encoded = person.idNumber ? encodedBirthYear(person.idNumber) : null;
    if (encoded !== null && stated !== null && encoded !== stated) {
      add({
        code: 'ID_BIRTH_YEAR_MISMATCH',
        severity: 'WARN',
        path,
        detail: { encoded, stated },
      });
    }
    const issuedYear = person.idIssueDate?.iso
      ? Number(person.idIssueDate.iso.slice(0, 4))
      : null;
    if (issuedYear !== null && stated !== null && issuedYear < stated) {
      add({
        code: 'ID_ISSUED_BEFORE_BIRTH',
        severity: 'WARN',
        path,
        detail: { issued: issuedYear, born: stated },
      });
    }
  });
}

// ── coverage ────────────────────────────────────────────────────────────────────────────────────────────────────

const GROUPED_FIGURE = /\d{1,3}(?:[.,]\d{3})+/g;

function figuresIn(text: string): number[] {
  const matches: string[] = text.match(GROUPED_FIGURE) ?? [];
  return matches
    .map((figure) => parseVietnameseDigits(figure))
    .filter((value): value is number => value !== null);
}

function checkCoverage(
  bundle: EvidenceBundle,
  context: VerifyContext,
  add: (i: VerifyIssue) => void,
): void {
  const covered = new Set(
    bundle.segmentCoverage
      .filter(
        (c) =>
          c.pointIds.length > 0 || (c.carriesNoPointReason ?? '').trim() !== '',
      )
      .map((c) => c.segmentId),
  );
  for (const segmentId of context.segmentIds) {
    if (!covered.has(segmentId))
      add({
        code: 'UNASSIGNED_SEGMENT',
        severity: 'WARN',
        detail: { segmentId },
      });
  }

  const inSummary = new Set(bundle.summary.pointIds);
  for (const point of bundle.points) {
    if (!inSummary.has(point.id))
      add({
        code: 'POINT_NOT_IN_SUMMARY',
        severity: 'WARN',
        detail: { pointId: point.id },
      });
  }

  const known = new Set<number>();
  for (const amount of bundle.amounts) {
    if (amount.valueVnd !== null) known.add(amount.valueVnd);
    for (const text of [amount.digits, amount.purpose]) {
      if (text) figuresIn(text).forEach((v) => known.add(v));
      const parsed = text ? parseVietnameseDigits(text) : null;
      if (parsed !== null) known.add(parsed);
    }
  }
  for (const text of [
    ...bundle.points.map((p) => p.text),
    ...bundle.events.map((e) => e.description),
    bundle.summary.opening,
  ]) {
    figuresIn(text).forEach((v) => known.add(v));
  }
  const seen = new Set<number>();
  for (const text of Object.values(context.transcripts)) {
    for (const value of figuresIn(text)) {
      if (!known.has(value) && !seen.has(value)) {
        seen.add(value);
        add({
          code: 'FIGURE_NOT_IN_ANALYSIS',
          severity: 'WARN',
          detail: { value },
        });
      }
    }
  }
}
