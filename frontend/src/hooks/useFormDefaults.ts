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
  // v0.35a: ward officer identity for form pre-fill + disable
  isWardOfficer: boolean;
  /** Ward team FK if user thuộc Tổ Phường — takes priority over primaryTeamId in form defaults */
  wardTeamId: string | null;
  /** Ward team display name */
  wardTeamName: string | null;
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
        isWardOfficer: false,
        wardTeamId: null,
        wardTeamName: null,
      };
    }
    // v0.35a: ward team takes priority over primaryTeamId for form assignedTeamId default.
    // Backend force-set still runs (defense in depth) — frontend pre-fill prevents
    // confusing "submit shows different team" UX.
    const wardTeamId = profile.wardTeam?.id ?? null;
    const wardTeamName = profile.wardTeam?.name ?? null;
    const primaryTeamId = profile.primaryTeam?.teamId ?? null;
    return {
      userId: profile.id,
      primaryTeamId: wardTeamId ?? primaryTeamId,
      primaryTeamName: wardTeamName ?? profile.primaryTeam?.teamName ?? null,
      isLoaded: true,
      today: today(),
      isWardOfficer: profile.isWardOfficer === true,
      wardTeamId,
      wardTeamName,
    };
    // profileSnapshot drives re-render; today() is intentionally re-computed each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileSnapshot]);
}
