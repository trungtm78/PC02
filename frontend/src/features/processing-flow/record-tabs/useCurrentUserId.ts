import { authStore } from '@/stores/auth.store';

/** The id of the signed-in person, from the cached profile; `null` until the profile is loaded. */
export function useCurrentUserId(): string | null {
  const profile = authStore.getProfile();
  return profile?.id ?? null;
}
