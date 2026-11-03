/**
 * Generates the server-side catalogue of form fields for scan-image intake.
 *
 * The three create forms (Petition, Incident, Case) share one legacy layout in the frontend
 * (`features/cases/legacy-form-layout.def.ts`) and differ only in where each field is stored. The
 * intake pipeline must know every field the open form accepts, with its kind and storage, so the
 * schema it asks the model to fill is derived from the forms rather than hand-copied three times.
 * Same pattern and gate as `gen-khai-xuat-day-du.ts` (petition export catalogue).
 *
 * Run: `npm run gen:khai-nhap-tu-anh`
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  docAnhXaCot,
  docMucThoBoCuc,
  dungDanhMuc,
} from './gen-khai-xuat-day-du';

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(
  ROOT,
  'backend',
  'src',
  'ocr-import',
  'khai-o-form.generated.ts',
);

export const FIELD_KINDS = [
  'text',
  'date',
  'textarea',
  'number',
  'select',
  'multiselect',
  'toggle',
  'crime',
  'fk',
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];
export type FormEntity = 'petition' | 'incident' | 'case';
export type StorageKind = 'column' | 'metadata' | 'statistic';

export interface OcrFormField {
  /** Path the form's `LegacyFormSpec.read/write` use for this field. */
  field: string;
  /** Verbatim on-screen caption. */
  caption: string;
  kind: FieldKind;
  required: boolean;
  /** Directory type for `fk`, or catalog key for `multiselect`. */
  source?: string;
  storage: StorageKind;
  /** Column name, `metadata` key, or `statistic` column, depending on `storage`. */
  storageKey: string;
}

export interface LayoutItem {
  field: string;
  caption: string;
  kind: FieldKind;
  required: boolean;
  source?: string;
}

export interface CatalogueSources {
  /** `frontend/src/features/cases/legacy-form-layout.def.ts` */
  layout: string;
  /** `frontend/src/features/petitions/legacy-form-binding.ts` */
  petitionBinding: string;
  /** `frontend/src/features/petitions/o-an.def.ts` */
  petitionRemoved: string;
  /** `frontend/src/features/incidents/legacy-form-binding.ts` */
  incidentBinding: string;
}

const STATISTIC_PREFIX = 'statistic.';

export function parseLayoutItems(layout: string): LayoutItem[] {
  return docMucThoBoCuc(layout).map(({ field, caption, raw }) => {
    const kind = /kind:\s*"([a-z]+)"/.exec(raw)?.[1];
    if (!kind || !(FIELD_KINDS as readonly string[]).includes(kind)) {
      throw new Error(`unknown field kind "${kind}" on field ${field}`);
    }
    const source = /source:\s*"([^"]+)"/.exec(raw)?.[1];
    return {
      field,
      caption,
      kind: kind as FieldKind,
      required: /required:\s*true/.test(raw),
      ...(source ? { source } : {}),
    };
  });
}

/** Fields only the Petition form has: they are not in the shared legacy layout. */
const PETITION_ONLY: Readonly<
  Record<string, { kind: FieldKind; source?: string }>
> = {
  huongXuLy: { kind: 'select' },
  donViGiaiQuyet: { kind: 'fk', source: 'DON_VI' },
  deXuat: { kind: 'textarea' },
};

const withoutStatistic = (field: string) =>
  field.startsWith(STATISTIC_PREFIX)
    ? field.slice(STATISTIC_PREFIX.length)
    : field;

function petitionCatalogue(
  src: CatalogueSources,
  items: Map<string, LayoutItem>,
): OcrFormField[] {
  return dungDanhMuc(
    src.layout,
    src.petitionBinding,
    src.petitionRemoved,
    src.petitionBinding,
  ).map((t): OcrFormField => {
    const item = items.get(t.field);
    const only = PETITION_ONLY[t.field];
    const kind = item?.kind ?? only?.kind;
    if (!kind) throw new Error(`petition field ${t.field} has no kind`);
    const source = item?.source ?? only?.source;
    return {
      field: t.field,
      caption: t.caption,
      kind,
      required: item?.required ?? false,
      ...(source ? { source } : {}),
      storage: t.cot ? 'column' : 'metadata',
      storageKey: t.khoaLuu,
    };
  });
}

function incidentCatalogue(
  src: CatalogueSources,
  all: LayoutItem[],
): OcrFormField[] {
  const columns = docAnhXaCot(src.incidentBinding);
  return all.map((item) => {
    const column = columns[item.field];
    return {
      ...item,
      storage: column ? 'column' : 'metadata',
      storageKey: column ?? withoutStatistic(item.field),
    };
  });
}

function caseCatalogue(
  src: CatalogueSources,
  all: LayoutItem[],
): OcrFormField[] {
  const renamed = docAnhXaCot(src.layout, 'LEGACY_FIELD_TO_COLUMN');
  return all.map((item) =>
    item.field.startsWith(STATISTIC_PREFIX)
      ? {
          ...item,
          storage: 'statistic',
          storageKey: withoutStatistic(item.field),
        }
      : {
          ...item,
          storage: 'column',
          storageKey: renamed[item.field] ?? item.field,
        },
  );
}

export function buildCatalogue(
  src: CatalogueSources,
): Record<FormEntity, OcrFormField[]> {
  const all = parseLayoutItems(src.layout);
  const items = new Map(all.map((i) => [i.field, i]));
  return {
    petition: petitionCatalogue(src, items),
    incident: incidentCatalogue(src, all),
    case: caseCatalogue(src, all),
  };
}

export function renderCatalogue(
  catalogue: Record<FormEntity, OcrFormField[]>,
): string {
  return `/* GENERATED - do not edit by hand. Re-run: npm run gen:khai-nhap-tu-anh */
/* Sources: frontend/src/features/cases/legacy-form-layout.def.ts (shared layout),
   petitions/legacy-form-binding.ts + petitions/o-an.def.ts, incidents/legacy-form-binding.ts. */

export type FormEntity = 'petition' | 'incident' | 'case';

export interface OcrFormField {
  /** Path the form's LegacyFormSpec.read/write use for this field. */
  field: string;
  /** Verbatim on-screen caption. */
  caption: string;
  kind: 'text' | 'date' | 'textarea' | 'number' | 'select' | 'multiselect' | 'toggle' | 'crime' | 'fk';
  required: boolean;
  /** Directory type for fk, or catalog key for multiselect. */
  source?: string;
  storage: 'column' | 'metadata' | 'statistic';
  /** Column name, metadata key, or statistic column, depending on storage. */
  storageKey: string;
}

export const OCR_FORM_FIELDS: Record<FormEntity, readonly OcrFormField[]> = ${JSON.stringify(catalogue, null, 2)};
`;
}

if (require.main === module) {
  const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const catalogue = buildCatalogue({
    layout: read('frontend/src/features/cases/legacy-form-layout.def.ts'),
    petitionBinding: read(
      'frontend/src/features/petitions/legacy-form-binding.ts',
    ),
    petitionRemoved: read('frontend/src/features/petitions/o-an.def.ts'),
    incidentBinding: read(
      'frontend/src/features/incidents/legacy-form-binding.ts',
    ),
  });
  fs.writeFileSync(OUT, renderCatalogue(catalogue), 'utf8');
  console.log(
    `[gen-khai-nhap-tu-anh] petition ${catalogue.petition.length}, incident ${catalogue.incident.length}, case ${catalogue.case.length} fields -> ${path.relative(ROOT, OUT)}`,
  );
}
