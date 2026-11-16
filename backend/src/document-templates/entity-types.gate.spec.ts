import * as fs from 'fs';
import * as path from 'path';
import { ENTITY_TYPES } from './document-template.constants';
import { ENTITY_DB } from './dynamic-export.service';
import { DYNAMIC_EXPORT_SAVABLE } from './entity-placeholders';
import { FIELD_CATALOG } from './field-catalog';
import { THUC_THE_HOP_LE } from '../user-export-preferences/user-export-preferences.service';

/**
 * GATE (A9): the entity types of the template platform are declared in one list (`ENTITY_TYPES`) and looked up in
 * tables spread over the backend and the admin screen. A type missing from one table does not fail anything: its
 * templates print blank (no catalogue), its render log loses its record (no `ENTITY_DB`), its admin screen cannot pick
 * it. So every table is read here and must carry every key of the list, and nothing else.
 */
const FRONTEND = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'features', 'document-templates');
const read = (rel: string) => fs.readFileSync(path.join(FRONTEND, rel), 'utf8');

/** The keys of each table, as the code holds them. */
function tables(): Record<string, string[]> {
  const types = read('types.ts');
  const union = /export type EntityType = ([^;]+);/.exec(types)?.[1] ?? '';
  const list = /ENTITY_TYPE_LIST[^=]*=\s*\[([^\]]*)\]/.exec(types)?.[1] ?? '';
  const form = read(path.join('components', 'TemplateFormModal.tsx'));
  const page = read(path.join('pages', 'DocumentTemplatesPage.tsx'));
  const label = /const ENTITY_LABEL[^{]*\{([^}]*)\}/.exec(page)?.[1] ?? '';
  const quoted = (text: string) => [...text.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  return {
    FIELD_CATALOG: Object.keys(FIELD_CATALOG),
    ENTITY_DB: Object.keys(ENTITY_DB),
    DYNAMIC_EXPORT_SAVABLE: Object.keys(DYNAMIC_EXPORT_SAVABLE),
    THUC_THE_HOP_LE: [...THUC_THE_HOP_LE],
    'frontend EntityType': quoted(union),
    'frontend ENTITY_TYPE_LIST': quoted(list),
    'frontend TemplateFormModal options': [...form.matchAll(/value:\s*'([A-Z_]+)'/g)].map((m) => m[1]),
    'frontend ENTITY_LABEL': [...label.matchAll(/^\s*([A-Z_]+):/gm)].map((m) => m[1]),
    'frontend filter options': [...page.matchAll(/<option value="([A-Z_]+)">/g)].map((m) => m[1]),
  };
}

/** The tables that lack a key of the list, or carry one that is not in it. */
export function mismatches(list: readonly string[], found: Record<string, string[]>): string[] {
  const out: string[] = [];
  for (const [name, keys] of Object.entries(found)) {
    for (const k of list) if (!keys.includes(k)) out.push(`${name} lacks ${k}`);
    for (const k of keys) if (!list.includes(k)) out.push(`${name} has unknown ${k}`);
  }
  return out;
}

describe('GATE: every table keyed by entity type has every entity type', () => {
  it('reads every table (it is not looking at nothing)', () => {
    const found = tables();
    for (const [name, keys] of Object.entries(found)) expect({ name, atLeastThree: keys.length >= 3 }).toEqual({ name, atLeastThree: true });
    expect(ENTITY_TYPES).toContain('HO_SO_PHAN_CONG');
  });

  it('no table lacks a type, none has an unknown one', () => {
    expect(mismatches(ENTITY_TYPES, tables())).toEqual([]);
  });

  it('every type has a catalogue with fields (a template of it can print something)', () => {
    for (const t of ENTITY_TYPES) expect(FIELD_CATALOG[t].length).toBeGreaterThan(0);
  });

  it('negative control: a type added to the list only is caught in every table', () => {
    const found = tables();
    const problems = mismatches([...ENTITY_TYPES, 'LOAI_MOI'], found);
    expect(problems).toHaveLength(Object.keys(found).length);
    expect(problems.every((p) => p.endsWith('lacks LOAI_MOI'))).toBe(true);
  });
});
