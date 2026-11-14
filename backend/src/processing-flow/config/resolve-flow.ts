import { khoaLoaiThongTin } from '../../common/utils/khoa-loai-thong-tin.util';
import { nhomHanCuaMuc } from '../../petitions/loai-thong-tin.rule';
import type { RecordKind } from '../gateway/record-snapshot';
import type { FlowMatch, FlowStatus } from './flow-steps';

/** An entry of the LOAI_THONG_TIN catalogue, as far as finding a flow needs it. */
export interface TypeEntry {
  id: string;
  name: string;
  /** The deadline group of the entry (`metadata.nhomHan`, otherwise by its name): a value of `LoaiDon`. */
  deadlineGroup: string;
}

/** The catalogue by merged key (`khoaLoaiThongTin`). */
export type TypeIndex = ReadonlyMap<string, TypeEntry>;

export interface ResolveBinding {
  flowId: string;
  recordKind: RecordKind;
  directoryId: string | null;
  /** The merged key the entry had when it was bound. */
  typeKey: string | null;
  deadlineGroup: string | null;
}

export interface ResolveFlowRow {
  id: string;
  recordKind: RecordKind;
  isDefault: boolean;
  status: FlowStatus;
}

export interface FlowResolution {
  match: FlowMatch;
  flowId: string;
  /** The catalogue entry the text matched (TYPE, GROUP, DEFAULT of a known type). */
  directoryId?: string;
  /** The merged key of the text; absent when the record carries no information type. */
  typeKey?: string;
}

/**
 * The catalogue by merged key, the way the deadline rule of a petition indexes it (`lapChiMucLoaiThongTin`): of two
 * entries with the same key the FIRST wins, so the entries must come sorted by code
 * (`TRUY_VAN_DANH_MUC_LOAI_THONG_TIN`).
 */
export function buildTypeIndex(entries: ReadonlyArray<{ id: string; name: string; metadata: unknown }>): TypeIndex {
  const index = new Map<string, TypeEntry>();
  for (const entry of entries) {
    const key = khoaLoaiThongTin(entry.name);
    if (key && !index.has(key)) index.set(key, { id: entry.id, name: entry.name, deadlineGroup: nhomHanCuaMuc(entry) });
  }
  return index;
}

/**
 * The flow a record of `recordKind` with this information type follows, or `null` when the configuration has none.
 *
 *   TYPE          the text is a catalogue entry bound to a flow (also: the text is the key an entry had when it was
 *                 bound, before a rename);
 *   GROUP         a petition whose entry is not bound itself, but whose deadline group is;
 *   DEFAULT       a known entry nothing is bound to, or no information type at all: the default flow of the kind;
 *   UNKNOWN_TYPE  the text matches NO catalogue entry (raw legacy text, a composite value). The default flow is only a
 *                 PROPOSAL: the caller must not assert a legal deadline from it until a person confirms.
 *
 * Archived flows do not exist here: neither their bindings nor their default mark.
 */
export function resolveFlow(
  record: { recordKind: RecordKind; informationType: string | null | undefined },
  config: { directoryIndex: TypeIndex; bindings: readonly ResolveBinding[]; flows: readonly ResolveFlowRow[] },
): FlowResolution | null {
  const { recordKind } = record;
  const inUse = new Set(config.flows.filter((flow) => flow.status === 'ACTIVE' && flow.recordKind === recordKind).map((flow) => flow.id));
  const bindings = config.bindings.filter((binding) => binding.recordKind === recordKind && inUse.has(binding.flowId));
  const defaultFlow = config.flows.find((flow) => inUse.has(flow.id) && flow.isDefault);

  const typeKey = khoaLoaiThongTin(record.informationType);
  if (!typeKey) return defaultFlow ? { match: 'DEFAULT', flowId: defaultFlow.id } : null;

  const entry = config.directoryIndex.get(typeKey);
  const byType =
    (entry && bindings.find((binding) => binding.directoryId === entry.id)) ??
    bindings.find((binding) => binding.directoryId !== null && binding.typeKey === typeKey);
  if (byType?.directoryId) return { match: 'TYPE', flowId: byType.flowId, directoryId: byType.directoryId, typeKey };

  if (!entry) return defaultFlow ? { match: 'UNKNOWN_TYPE', flowId: defaultFlow.id, typeKey } : null;

  if (recordKind === 'PETITION') {
    const byGroup = bindings.find((binding) => binding.deadlineGroup !== null && binding.deadlineGroup === entry.deadlineGroup);
    if (byGroup) return { match: 'GROUP', flowId: byGroup.flowId, directoryId: entry.id, typeKey };
  }
  return defaultFlow ? { match: 'DEFAULT', flowId: defaultFlow.id, directoryId: entry.id, typeKey } : null;
}
