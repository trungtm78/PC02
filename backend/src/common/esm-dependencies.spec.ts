import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every runtime dependency must be loadable under jest.
 *
 * ND-9 was recorded for eight months as "jest transform cache race on Windows,
 * unfixable". It was not a race. `two-fa.service.spec.ts` mocks `otplib`, so
 * the real package is normally never required — and on the runs where the mock
 * did not cover it, the require chain
 *
 *   otplib → @otplib/plugin-base32-scure → @scure/base
 *
 * reached `@scure/base/index.js`, which is `"type": "module"` with no `exports`
 * map and therefore has no CJS entry point at all. `transformIgnorePatterns`
 * allowlisted `@otplib` and `@noble` but not `@scure`, so jest handed raw ESM
 * to a CJS runtime: `SyntaxError: Unexpected token 'export'`. Intermittent
 * because it depended on the mock, not on the filesystem.
 *
 * A per-package fix would go stale the next time a dependency ships ESM-only,
 * so this asserts the property instead: every package in `dependencies` loads.
 * Add a scope to `transformIgnorePatterns` when this test names it.
 *
 * `@types/*` entries are declaration-only and have no runtime module to load.
 */
const PKG = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf8'),
) as { dependencies?: Record<string, string> };

const RUNTIME_DEPENDENCIES = Object.keys(PKG.dependencies ?? {}).filter(
  (name) => !name.startsWith('@types/'),
);

describe('runtime dependencies load under jest', () => {
  it('reads a non-empty dependency list — an empty one would pass vacuously', () => {
    expect(RUNTIME_DEPENDENCIES.length).toBeGreaterThan(30);
  });

  it.each(RUNTIME_DEPENDENCIES)('loads %s without a SyntaxError', (name) => {
    // `jest.requireActual` rather than bare `require`: it goes through the same
    // jest module runtime — so it exercises the transform config this test is
    // about — while `import()` is not supported by that runtime and bare
    // `require` trips the repo's ban on require-style imports.
    expect(() => jest.requireActual(name)).not.toThrow();
  });
});
