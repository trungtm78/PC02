/**
 * Whether a form shows the two tabs "Phân công xử lý" and "Kết quả xử lý": only when the backend switch
 * `processing_flow_records` is ON, the record is SAVED (it has an id) and the person holds `read:ProcessingStep`.
 * Otherwise the tabs do not exist at all (no button, no body, no request).
 */
import { useContext } from 'react';
import { FeatureFlagsContext } from '@/lib/features/featureFlagsContextObject';
import { usePermission } from '@/hooks/usePermission';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { PERMISSION } from '../usePermissions';

/** The key of the switch, as the backend declares it (`feature_flags.key`). */
export const RECORDS_FEATURE_KEY = 'processing_flow_records';

export type RecordTabId = 'phan-cong-xu-ly' | 'ket-qua-xu-ly';

export const RECORD_TAB_IDS: readonly RecordTabId[] = ['phan-cong-xu-ly', 'ket-qua-xu-ly'];

export const RECORD_TAB_LABEL: Record<RecordTabId, string> = {
  'phan-cong-xu-ly': L.recordTabs.tabs.assignment,
  'ket-qua-xu-ly': L.recordTabs.tabs.results,
};

/** The two tabs as `{ id, label }`, for a tab bar that takes a list. */
export const recordTabItems = (): Array<{ id: RecordTabId; label: string }> => RECORD_TAB_IDS.map((id) => ({ id, label: RECORD_TAB_LABEL[id] }));

/**
 * A form rendered with no provider of the switches (a test, an embedded view) has the tabs OFF: they replace nothing,
 * so "not known" must mean "not there". The profile not loaded yet hides them too; they appear when it loads.
 */
export function useRecordTabsAvailable(recordId: string | null | undefined): boolean {
  const flags = useContext(FeatureFlagsContext);
  const { permissions } = usePermission();
  if (!recordId) return false;
  if (flags?.flags.get(RECORDS_FEATURE_KEY)?.enabled !== true) return false;
  return permissions !== null && permissions.includes(PERMISSION.stepRead);
}
