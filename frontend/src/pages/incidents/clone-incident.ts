import type { IncidentFormData } from './incident-form.types';
import { cloneUserMetadata } from '@/shared/legacy/cloneMetadata';

export interface IncidentCloneState {
  formData: IncidentFormData;
  metaState: Record<string, unknown>;
  parityState: Record<string, unknown>;
}

/** Copy user-entered business data while clearing ownership and dispatch fields. */
export function cloneIncidentState(source: IncidentCloneState): IncidentCloneState {
  const clone = structuredClone(source);
  return {
    ...clone,
    metaState: cloneUserMetadata(source.metaState),
    formData: {
      ...clone.formData,
      assignedTeamId: '',
      investigatorId: '',
      canBoNhapId: '',
    },
  };
}
