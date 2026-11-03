import { useContext } from 'react';
import { FeatureFlagsContext } from '@/lib/features/featureFlagsContextObject';
import { authStore } from '@/stores/auth.store';

/**
 * Whether to offer "enter from scanned images" on a form: the feature flag is on, and the signed-in role holds
 * `use:OcrImport`. Unlike other buttons this one stays hidden while the profile has not loaded, because showing it
 * only to have the server refuse would invite a click that uploads nothing useful. The server checks both again.
 */
export function useOcrAvailability(): boolean {
  const flags = useContext(FeatureFlagsContext)?.flags;
  const user = authStore.getUser();
  const permissions =
    user && 'permissions' in user && Array.isArray(user.permissions) ? user.permissions : null;
  return flags?.get('ocr_import')?.enabled === true && !!permissions?.includes('use:OcrImport');
}
