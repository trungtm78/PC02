import { useFeatureFlagsContext } from './FeatureFlagsContext';

/**
 * Returns true when the given feature key is enabled for the current user.
 *
 * Conservative default during initial load: returns `false` while flags are
 * still loading so that UI never flashes a disabled feature. Callers that
 * want optimistic rendering can read `isLoading` directly via
 * `useFeatureFlagsContext`.
 *
 * If a flag key has never been seeded (e.g. a brand new module), this
 * returns `false` because the backend does not know about it. To allow
 * unseeded features, use the `allowUnknown` option.
 */
export function useFeature(
  key: string,
  opts: { allowUnknown?: boolean } = {},
): boolean {
  const { flags, isLoading } = useFeatureFlagsContext();
  if (isLoading) return false;
  const flag = flags.get(key);
  if (!flag) return opts.allowUnknown ?? false;
  return flag.enabled;
}

/**
 * Returns all enabled flags. Useful for building a dynamic menu.
 */
export function useEnabledFeatures(): string[] {
  const { flags } = useFeatureFlagsContext();
  return Array.from(flags.values())
    .filter((f) => f.enabled)
    .map((f) => f.key);
}
