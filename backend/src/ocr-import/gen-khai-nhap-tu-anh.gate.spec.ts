import * as fs from 'fs';
import * as path from 'path';
import {
  buildCatalogue,
  parseLayoutItems,
  renderCatalogue,
  type CatalogueSources,
} from '../../scripts/gen-khai-nhap-tu-anh';
import { OCR_FORM_FIELDS } from './khai-o-form.generated';
import { TRUONG_FORM_DON_THU } from '../petitions/khai-truong-form-don-thu.generated';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const NL = String.fromCharCode(10);

const SYNTHETIC_LAYOUT = [
  'export const LEGACY_FIELD_TO_COLUMN = {',
  '  description: "moTaChiTiet",',
  '};',
  '{ caption: "Ten don", field: "name", kind: "text", span: "half", required: true },',
  '{ field: "ngayThu", caption: "Ngay thu", kind: "date", span: "half" },',
  '{ caption: "Don vi", field: "unit", kind: "fk", span: "half", source: "DON_VI" },',
  '{ caption: "Mo ta", field: "description", kind: "textarea", span: "full" },',
  '{ caption: "Tien", field: "statistic.soTien", kind: "number", span: "half" },',
].join(NL);

const SYNTHETIC: CatalogueSources = {
  layout: SYNTHETIC_LAYOUT,
  petitionBinding: [
    'const CO_COT_RIENG = {',
    "  name: 'senderName',",
    '};',
    'const BO_O_DA_CO_CHO_KHAC = new Map([]);',
  ].join(NL),
  petitionRemoved: 'export const KHOA_HE_CU_DA_AN = [ "ngayThu" ];',
  incidentBinding: ['const CO_COT_RIENG = {', "  name: 'name',", '};'].join(NL),
};

describe('parseLayoutItems', () => {
  const items = parseLayoutItems(SYNTHETIC_LAYOUT);

  it('reads kind, required and source from the literal, in either key order', () => {
    expect(items.map((i) => i.field)).toEqual([
      'name',
      'ngayThu',
      'unit',
      'description',
      'statistic.soTien',
    ]);
    expect(items[0]).toMatchObject({ kind: 'text', required: true });
    expect(items[1]).toMatchObject({ kind: 'date', required: false });
    expect(items[2]).toMatchObject({ kind: 'fk', source: 'DON_VI' });
    expect(items[2].required).toBe(false);
  });

  it('rejects an item whose kind is not in the known set instead of guessing', () => {
    const bad = '{ caption: "X", field: "x", kind: "hologram", span: "half" },';
    expect(() => parseLayoutItems(bad)).toThrow(
      'unknown field kind "hologram"',
    );
  });
});

describe('buildCatalogue on a synthetic source', () => {
  const cat = buildCatalogue(SYNTHETIC);

  it('petition: drops removed fields, maps columns, falls back to the metadata key, adds petition-only fields', () => {
    const byField = Object.fromEntries(cat.petition.map((f) => [f.field, f]));
    expect(byField.ngayThu).toBeUndefined();
    expect(byField.name).toMatchObject({
      storage: 'column',
      storageKey: 'senderName',
      kind: 'text',
      required: true,
    });
    expect(byField['statistic.soTien']).toMatchObject({
      storage: 'metadata',
      storageKey: 'soTien',
    });
    expect(byField.huongXuLy).toMatchObject({
      kind: 'select',
      storage: 'column',
    });
    expect(byField.deXuat).toMatchObject({ kind: 'textarea' });
  });

  it('incident: mapped fields are columns, the rest live in metadata under the stripped key', () => {
    const byField = Object.fromEntries(cat.incident.map((f) => [f.field, f]));
    expect(byField.name).toMatchObject({
      storage: 'column',
      storageKey: 'name',
    });
    expect(byField.ngayThu).toMatchObject({
      storage: 'metadata',
      storageKey: 'ngayThu',
    });
    expect(byField['statistic.soTien']).toMatchObject({
      storage: 'metadata',
      storageKey: 'soTien',
    });
  });

  it('case: statistic. fields go to the statistic table, others use LEGACY_FIELD_TO_COLUMN or their own name', () => {
    const byField = Object.fromEntries(cat.case.map((f) => [f.field, f]));
    expect(byField['statistic.soTien']).toMatchObject({
      storage: 'statistic',
      storageKey: 'soTien',
    });
    expect(byField.description).toMatchObject({
      storage: 'column',
      storageKey: 'moTaChiTiet',
    });
    expect(byField.name).toMatchObject({
      storage: 'column',
      storageKey: 'name',
    });
    expect(byField.ngayThu).toMatchObject({
      storage: 'column',
      storageKey: 'ngayThu',
    });
  });

  it('renders deterministic output', () => {
    expect(renderCatalogue(cat)).toBe(
      renderCatalogue(buildCatalogue(SYNTHETIC)),
    );
  });
});

describe('GATE: generated field catalogue matches the form sources', () => {
  const sources: CatalogueSources = {
    layout: read('frontend/src/features/cases/legacy-form-layout.def.ts'),
    petitionBinding: read(
      'frontend/src/features/petitions/legacy-form-binding.ts',
    ),
    petitionRemoved: read('frontend/src/features/petitions/o-an.def.ts'),
    incidentBinding: read(
      'frontend/src/features/incidents/legacy-form-binding.ts',
    ),
  };

  it('the parser reads real data, so an empty parse cannot make this gate pass', () => {
    expect(parseLayoutItems(sources.layout).length).toBeGreaterThan(120);
  });

  it('re-running the generator reproduces the committed catalogue exactly', () => {
    expect(buildCatalogue(sources)).toEqual(OCR_FORM_FIELDS);
  });

  it('seeded fault: a field added to the layout makes the committed catalogue stale', () => {
    const extra =
      '{ caption: "Seeded", field: "seededField", kind: "text", span: "half" },';
    const drifted = buildCatalogue({
      ...sources,
      layout: sources.layout + NL + extra,
    });
    expect(drifted).not.toEqual(OCR_FORM_FIELDS);
    expect(drifted.case.some((f) => f.field === 'seededField')).toBe(true);
  });

  it('every entity has a real catalogue with unique field names', () => {
    for (const entity of ['petition', 'incident', 'case'] as const) {
      const fields = OCR_FORM_FIELDS[entity];
      expect(fields.length).toBeGreaterThan(120);
      expect(new Set(fields.map((f) => f.field)).size).toBe(fields.length);
      for (const f of fields) {
        expect(f.caption.trim().length).toBeGreaterThan(0);
        expect(f.storageKey.length).toBeGreaterThan(0);
      }
    }
  });

  it('the petition catalogue lists exactly the fields of the export catalogue', () => {
    expect(OCR_FORM_FIELDS.petition.map((f) => f.field)).toEqual(
      TRUONG_FORM_DON_THU.map((t) => t.field),
    );
  });
});
