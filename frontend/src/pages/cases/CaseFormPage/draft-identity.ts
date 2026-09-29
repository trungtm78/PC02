import type { CaseFormData, Evidence, Subject } from './types';

export const LEGACY_CASE_DRAFT_KEY = 'caseFormDraft';

export interface CaseDraftState {
  formData: CaseFormData;
  parityState: Record<string, unknown>;
  metaState: Record<string, unknown>;
  subjects: Subject[];
  evidences: Evidence[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function encodeCaseDraft(state: CaseDraftState): string {
  return JSON.stringify({ version: 1, ...state });
}

export function decodeCaseDraft(raw: string): CaseDraftState | null {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) return null;
  if (isRecord(parsed.formData)) {
    return {
      formData: parsed.formData as unknown as CaseFormData,
      parityState: isRecord(parsed.parityState) ? parsed.parityState : {},
      metaState: isRecord(parsed.metaState) ? parsed.metaState : {},
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects as Subject[] : [],
      evidences: Array.isArray(parsed.evidences) ? parsed.evidences as Evidence[] : [],
    };
  }
  if (typeof parsed.caseCode === 'string' && typeof parsed.caseProvenance === 'string') {
    return {
      formData: parsed as unknown as CaseFormData,
      parityState: {},
      metaState: {},
      subjects: [],
      evidences: [],
    };
  }
  return null;
}

export function caseDraftKey(provenance: string | null | undefined): string {
  return provenance === 'UY_THAC_DIEU_TRA'
    ? 'caseFormDraft:delegation'
    : 'caseFormDraft:regular';
}

export function keepEditedCaseCode(current: string, preview: string): string {
  return current.trim() ? current : preview;
}

export function legacyDraftMatches(value: unknown, provenance: string | null | undefined): boolean {
  if (!value || typeof value !== 'object' || !('caseProvenance' in value)) return false;
  const draftProvenance = value.caseProvenance;
  if (typeof draftProvenance !== 'string') return false;
  return caseDraftKey(draftProvenance) === caseDraftKey(provenance);
}

export function clearCaseDraft(storage: Storage, provenance: string | null | undefined): void {
  storage.removeItem(caseDraftKey(provenance));
  const legacy = storage.getItem(LEGACY_CASE_DRAFT_KEY);
  if (!legacy) return;
  try {
    if (legacyDraftMatches(JSON.parse(legacy) as unknown, provenance)) {
      storage.removeItem(LEGACY_CASE_DRAFT_KEY);
    }
  } catch (error) {
    console.warn('Unable to inspect legacy case draft', error);
  }
}
