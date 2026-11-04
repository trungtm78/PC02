import type { FormEntity } from '../khai-o-form.generated';
import type { Projection } from '../projection';

/**
 * A hand-checked answer for one bundle of scans. `fields` maps a field of the catalogue to the value a careful reader
 * takes from the paperwork, or to `null` when that field must stay EMPTY (the paperwork does not say). The answer is
 * written by a person from the images, never copied from what the system read.
 */
export interface GoldenCase {
  id: string;
  entity: FormEntity;
  fields: Record<string, string | null>;
}

export interface CaseScore {
  id: string;
  correct: string[];
  wrong: Array<{ field: string; expected: string; actual: string }>;
  missing: string[];
  /** Filled where the answer says the field must stay empty: the worst error, it puts words in someone's mouth. */
  invented: Array<{ field: string; actual: string }>;
  /** Filled fields the answer does not mention: reported, not counted for or against. */
  unscored: string[];
  /** Wrong fields that were among those the officer has to confirm (they are caught, but they cost a look). */
  mustConfirmWrong: string[];
}

/** Compares the way an officer would: Unicode form, case and spacing do not matter; numbers ignore separators. */
export function normaliseForCompare(value: string | number): string {
  const text = String(value)
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (/^[\d.,\s]+$/.test(text) && /\d/.test(text))
    return text.replace(/[.,\s]/g, '');
  return text;
}

export function scoreCase(
  golden: GoldenCase,
  projection: Projection,
): CaseScore {
  const filled = new Map(projection.fills.map((f) => [f.field, f]));
  const score: CaseScore = {
    id: golden.id,
    correct: [],
    wrong: [],
    missing: [],
    invented: [],
    unscored: [],
    mustConfirmWrong: [],
  };
  for (const [field, expected] of Object.entries(golden.fields)) {
    const got = filled.get(field);
    if (expected === null) {
      if (got) score.invented.push({ field, actual: String(got.value) });
      else score.correct.push(field);
      continue;
    }
    if (!got) {
      score.missing.push(field);
      continue;
    }
    if (normaliseForCompare(got.value) === normaliseForCompare(expected)) {
      score.correct.push(field);
    } else {
      score.wrong.push({ field, expected, actual: String(got.value) });
      if (got.policy === 'AI_FILL_MUST_CONFIRM')
        score.mustConfirmWrong.push(field);
    }
  }
  for (const field of filled.keys()) {
    if (!(field in golden.fields)) score.unscored.push(field);
  }
  return score;
}

export interface Summary {
  cases: number;
  scored: number;
  correct: number;
  wrong: number;
  missing: number;
  invented: number;
  accuracy: number;
  inventedRate: number;
}

export function summarise(scores: readonly CaseScore[]): Summary {
  const sum = (pick: (s: CaseScore) => number) =>
    scores.reduce((n, s) => n + pick(s), 0);
  const correct = sum((s) => s.correct.length);
  const wrong = sum((s) => s.wrong.length);
  const missing = sum((s) => s.missing.length);
  const invented = sum((s) => s.invented.length);
  const scored = correct + wrong + missing + invented;
  return {
    cases: scores.length,
    scored,
    correct,
    wrong,
    missing,
    invented,
    accuracy: scored === 0 ? 0 : correct / scored,
    inventedRate: scored === 0 ? 0 : invented / scored,
  };
}
