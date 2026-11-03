export interface FieldQualityRow {
  entity: string;
  field: string;
  providerKind: string | null;
  model: string | null;
  promptVersion: string | null;
  kept: number;
  edited: number;
  cleared: number;
  total: number;
  mustConfirm: number;
}

export interface CallCostRow {
  providerKind: string;
  model: string;
  calls: number;
  ok: number;
  failed: number;
  images: number;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  errors: Record<string, number>;
}

export interface BudgetView {
  usedMicroUsd: number;
  capMicroUsd: number;
  level: 'OK' | 'WARN' | 'EXHAUSTED';
}

export interface QualityReport {
  period: { from: string; to: string };
  fields: FieldQualityRow[];
  calls: CallCostRow[];
  budget: BudgetView | null;
}

const ratio = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);

export interface ModelQuality {
  providerKind: string;
  model: string;
  /** All filled fields the officers saw, and how they ended. */
  total: number;
  keptRate: number;
  editedRate: number;
  clearedRate: number;
}

/** Per model: the share of filled fields officers kept, changed or emptied. A model whose fields are rarely kept is not saving work. */
export function qualityByModel(fields: readonly FieldQualityRow[]): ModelQuality[] {
  const by = new Map<string, { providerKind: string; model: string; kept: number; edited: number; cleared: number; total: number }>();
  for (const f of fields) {
    const key = `${f.providerKind ?? '?'}|${f.model ?? '?'}`;
    const row = by.get(key) ?? { providerKind: f.providerKind ?? '?', model: f.model ?? '?', kept: 0, edited: 0, cleared: 0, total: 0 };
    row.kept += f.kept;
    row.edited += f.edited;
    row.cleared += f.cleared;
    row.total += f.total;
    by.set(key, row);
  }
  return [...by.values()]
    .map((r) => ({
      providerKind: r.providerKind,
      model: r.model,
      total: r.total,
      keptRate: ratio(r.kept, r.total),
      editedRate: ratio(r.edited, r.total),
      clearedRate: ratio(r.cleared, r.total),
    }))
    .sort((a, b) => b.keptRate - a.keptRate);
}

/** Fields officers change or empty most often, worst first, ignoring fields seen too few times to say anything. */
export function worstFields(fields: readonly FieldQualityRow[], minimum = 5): Array<FieldQualityRow & { correctedRate: number }> {
  return fields
    .filter((f) => f.total >= minimum)
    .map((f) => ({ ...f, correctedRate: ratio(f.edited + f.cleared, f.total) }))
    .sort((a, b) => b.correctedRate - a.correctedRate || b.total - a.total)
    .slice(0, 20);
}

/** Estimated cost as dollars; the server counts in millionths of a dollar. */
export const microToUsd = (micro: number): string => (micro / 1_000_000).toFixed(micro >= 1_000_000 ? 2 : 4);

export const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
