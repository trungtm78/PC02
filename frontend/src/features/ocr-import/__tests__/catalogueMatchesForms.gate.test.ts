import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CaseFieldPath } from '@/features/cases/legacy-form-layout.def';
import { CASE_LEGACY_SPEC } from '@/features/cases/legacy-form-layout.def';
import { INCIDENT_LEGACY_SPEC, dichLuu as incidentPath } from '@/features/incidents/legacy-form-binding';
import { PETITION_LEGACY_SPEC, dichLuu as petitionPath } from '@/features/petitions/legacy-form-binding';

/**
 * GATE: every field the server may fill must land somewhere on the form it fills.
 *
 * The server names fields as the shared layout does; each form keeps its values under its own paths. When the two
 * drift (a field added to the layout, a column renamed on one form) a fill writes to a path nobody reads and the
 * value silently disappears — the screen shows "filled 14 fields" and the fields are empty. This reads the server's
 * generated catalogue and checks every name against the form it will be applied to.
 */
const catalogue = readFileSync(
  resolve(__dirname, '../../../../../backend/src/ocr-import/khai-o-form.generated.ts'),
  'utf8',
);

function serverFields(entity: 'petition' | 'incident' | 'case'): string[] {
  const start = catalogue.indexOf(`  ${entity}: [`);
  const rest = catalogue.slice(start + 1);
  const next = rest.search(/\n {2}(petition|incident|case): \[/);
  const block = next === -1 ? rest : rest.slice(0, next);
  return [...block.matchAll(/field: '([^']+)'/g)].map((m) => m[1]);
}

const pathsOf = (layout: Record<string, ReadonlyArray<{ field: string }>>) =>
  new Set(Object.values(layout).flatMap((items) => items.map((item) => item.field)));

const lands = (path: string, onForm: Set<string>) =>
  onForm.has(path) || path.startsWith('legacyExtra.');

describe('the server catalogue against the forms it fills', () => {
  it('reads a plausible number of fields for each entity (so this gate cannot pass by reading nothing)', () => {
    expect(serverFields('petition').length).toBeGreaterThan(100);
    expect(serverFields('incident').length).toBeGreaterThan(100);
    expect(serverFields('case').length).toBeGreaterThan(100);
  });

  it('the gate can fail: the layout name, untranslated, is not a place on the Petition form', () => {
    // This is the bug the translation exists to prevent: filling "tenCungCap" writes to a path nobody reads.
    expect(lands('tenCungCap', pathsOf(PETITION_LEGACY_SPEC.layout))).toBe(false);
    expect(lands(petitionPath('tenCungCap' as CaseFieldPath), pathsOf(PETITION_LEGACY_SPEC.layout))).toBe(true);
  });

  it('every Petition field maps to a place on the Petition form', () => {
    const onForm = pathsOf(PETITION_LEGACY_SPEC.layout);
    const lost = serverFields('petition').filter(
      (f) => !lands(petitionPath(f as CaseFieldPath), onForm),
    );
    expect(lost).toEqual([]);
  });

  it('every Incident field maps to a place on the Incident form', () => {
    const onForm = pathsOf(INCIDENT_LEGACY_SPEC.layout);
    const lost = serverFields('incident').filter(
      (f) => !lands(incidentPath(f as CaseFieldPath), onForm),
    );
    expect(lost).toEqual([]);
  });

  it('every Case field is a field of the Case form as named', () => {
    const onForm = pathsOf(CASE_LEGACY_SPEC.layout);
    const lost = serverFields('case').filter((f) => !onForm.has(f));
    expect(lost).toEqual([]);
  });
});
