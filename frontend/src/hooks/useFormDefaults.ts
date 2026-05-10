import { useMemo, useSyncExternalStore } from 'react';
import { authStore } from '@/stores/auth.store';
import { today } from '@/lib/dates';

export interface FormDefaults {
  /** Current user id, or null if profile not yet loaded. */
  userId: string | null;
  /** Primary team FK (leader-team first, else oldest joinedAt). */
  primaryTeamId: string | null;
  /** Primary team display name — for free-text fields like donViGiaiQuyet/unit. */
  primaryTeamName: string | null;
  /** False until profile is hydrated. Forms should skip applying defaults until true. */
  isLoaded: boolean;
  /** Today's date in local TZ as 'YYYY-MM-DD'. */
  today: string;
}

const EMPTY_PROFILE = '__none__';

/**
 * Returns sensible defaults for "create new" forms (today, current user, primary team).
 * Memoized; re-renders when authStore profile changes.
 *
 * Forms use the `prev.x ||` guard pattern in their useEffect so user keystrokes
 * survive re-render once profile hydrates.
 */
export function useFormDefaults(): FormDefaults {
  // Subscribe to profile changes via authStore's token-changed event.
  const profileSnapshot = useSyncExternalStore(
    (onChange) => authStore.onTokenChanged(onChange),
    () => {
      const p = authStore.getProfile();
      return p ? `${p.id}::${p.primaryTeam?.teamId ?? 'no-team'}` : EMPTY_PROFILE;
    },
    () => EMPTY_PROFILE,
  );

  return useMemo(() => {
    const profile = authStore.getProfile();
    if (!profile) {
      return {
        userId: null,
        primaryTeamId: null,
        primaryTeamName: null,
        isLoaded: false,
        today: today(),
      };
    }
    return {
      userId: profile.id,
      primaryTeamId: profile.primaryTeam?.teamId ?? null,
      primaryTeamName: profile.primaryTeam?.teamName ?? null,
      isLoaded: true,
      today: today(),
    };
    // profileSnapshot drives re-render; today() is intentionally re-computed each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileSnapshot]);
}
