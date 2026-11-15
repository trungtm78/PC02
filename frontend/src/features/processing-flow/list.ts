/** Pure helpers of the flow list: what a row says, how many each tab holds, what a copy is called. */
import { processingFlow } from '@/locales/processingFlow.vi';
import { RECORD_KINDS } from './codes';
import type { FlowSummaryDto, RecordKind } from './types';

const L = processingFlow.list;

export function versionText(flow: Pick<FlowSummaryDto, 'publishedVersionNo' | 'draftVersionNo'>): string {
  const parts: string[] = [];
  if (flow.publishedVersionNo !== null) parts.push(L.versionPublished(flow.publishedVersionNo));
  if (flow.draftVersionNo !== null) parts.push(L.versionDraft(flow.draftVersionNo));
  return parts.length ? parts.join(', ') : L.versionNone;
}

/** The information types the flow is applied to, then the deadline groups of a petition. */
export function boundLabels(flow: Pick<FlowSummaryDto, 'boundTypes' | 'boundGroups'>): string[] {
  return [
    ...flow.boundTypes.map((t) => t.name),
    ...flow.boundGroups.map((g) => processingFlow.deadlineGroups[g] ?? g),
  ];
}

export function countByKind(flows: readonly FlowSummaryDto[]): Record<RecordKind, number> {
  const counts = Object.fromEntries(RECORD_KINDS.map((k) => [k, 0])) as Record<RecordKind, number>;
  for (const f of flows) counts[f.recordKind] += 1;
  return counts;
}

export function visibleFlows(flows: readonly FlowSummaryDto[], kind: RecordKind): FlowSummaryDto[] {
  return flows.filter((f) => f.recordKind === kind);
}

const norm = (s: string): string => s.trim().toLocaleLowerCase('vi');

/** "Tố cáo (bản chép)", then "(bản chép 2)", … the first one nobody has (names are compared as the server does). */
export function copyName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map(norm));
  const first = `${name}${L.copySuffix}`;
  if (!taken.has(norm(first))) return first;
  const base = L.copySuffix.replace(/\)$/, '');
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${name}${base} ${n})`;
    if (!taken.has(norm(candidate))) return candidate;
  }
  return `${first} ${Date.now()}`;
}
