/**
 * Type declarations for the CommonJS governance scripts under
 * `scripts/governance/`.
 *
 * They are plain .cjs on purpose — the CI job runs them before `npm ci`, so
 * they must work with nothing but node. Declaring their shape here lets the
 * specs `import` them normally instead of reaching for an untyped `require()`,
 * which is what forced a pile of no-unsafe-* suppressions.
 */

declare module '*/check-enum-literals.cjs' {
  export interface EnumLiteralViolation {
    file: string;
    line: number;
    value: string;
    text: string;
  }

  export function parseEnumValues(schemaSource: string): Set<string>;

  export function findViolations(
    enumValues: Set<string>,
    roots?: string[],
    baseDir?: string,
  ): EnumLiteralViolation[];
}

declare module '*/lint-changed.cjs' {
  export interface LintWorkspace {
    prefix: string;
    dir: string;
    scan: string[];
  }

  export const WORKSPACES: LintWorkspace[];

  export function ownedBy(
    ws: Pick<LintWorkspace, 'prefix' | 'scan'>,
    relPath: string,
  ): boolean;

  export function lintCounts(
    ws: Pick<LintWorkspace, 'dir' | 'prefix'>,
    targets: string[],
  ): Record<string, number>;

  export function resolveBaseRef(explicit?: string): string | null;

  export function changedFiles(baseRef: string): string[];
}

declare module '*/generate-shared-enums.cjs' {
  export const SHARED_ENUMS: string[];
  export function parseEnums(schemaSource: string): Record<string, string[]>;
}
