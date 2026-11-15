/**
 * The address of a record's form opened on one of the two processing tabs: `?tab=phan-cong-xu-ly`. The three forms read
 * the parameter ONCE, when they mount; after that the tab is the form's own state and the address is left alone.
 */
import type { RecordKind } from '../types';
import { RECORD_TAB_IDS, type RecordTabId } from './tabAvailability';

export const RECORD_TAB_PARAM = 'tab';

/** The record tab an address asks for; `null` when it asks for none (or for something that is not a record tab). */
export function recordTabFromSearch(search: string): RecordTabId | null {
  const asked = new URLSearchParams(search).get(RECORD_TAB_PARAM);
  return RECORD_TAB_IDS.find((id) => id === asked) ?? null;
}

/**
 * Where a record opens. A petition and an incident open on their read-only form (it carries the tabs and the step
 * buttons follow the STEP permissions); a case has its tabs on the edit form only, which shows itself read-only to a
 * person who may not write the case.
 */
const FORM_PATH: Record<RecordKind, (id: string) => string> = {
  PETITION: (id) => `/petitions/${encodeURIComponent(id)}`,
  INCIDENT: (id) => `/incidents/${encodeURIComponent(id)}`,
  CASE: (id) => `/cases/${encodeURIComponent(id)}/edit`,
};

export function recordTabHref(kind: RecordKind, recordId: string, tab: RecordTabId = 'phan-cong-xu-ly'): string {
  return `${FORM_PATH[kind](recordId)}?${RECORD_TAB_PARAM}=${tab}`;
}
