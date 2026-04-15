import type { FeatureModule } from './moduleTypes';

/**
 * Auto-discovers every feature module under `src/features/*`.
 *
 * Each feature folder exposes a default export from `index.ts` that
 * satisfies `FeatureModule` (manifest + renderRoutes + optional menu).
 * Adding a new feature = drop a folder and restart Vite. No registry
 * edit required.
 *
 * `import.meta.glob` is a Vite primitive resolved at build time, so all
 * feature modules are statically analyzable and tree-shakable per
 * build pack (see `ENABLED_FEATURES` env on the backend).
 */
const modules = import.meta.glob<{ default: FeatureModule }>(
  '../../features/*/index.ts',
  { eager: true },
);

const collected: FeatureModule[] = [];
const seenKeys = new Set<string>();

for (const [path, mod] of Object.entries(modules)) {
  const feature = mod.default;
  if (!feature || !feature.manifest || !feature.manifest.key) {
    // eslint-disable-next-line no-console
    console.warn(`[featureRegistry] Skipping ${path}: missing manifest`);
    continue;
  }
  if (seenKeys.has(feature.manifest.key)) {
    throw new Error(
      `[featureRegistry] Duplicate feature key "${feature.manifest.key}" at ${path}`,
    );
  }
  seenKeys.add(feature.manifest.key);
  collected.push(feature);
}

export const FEATURE_MODULES: readonly FeatureModule[] = collected;

export function getFeatureModule(key: string): FeatureModule | undefined {
  return FEATURE_MODULES.find((f) => f.manifest.key === key);
}
