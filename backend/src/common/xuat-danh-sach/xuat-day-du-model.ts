import { Prisma } from '@prisma/client';
import type { KhaiCotXuat } from './xuat-danh-sach';
import { ngayVN } from './dinh-dang';
import { escapeXlsxCell } from '../utils/xlsx-formula-escape.util';

export interface DongXuatDayDuModel {
  id: string;
  [key: string]: unknown;
}

export function readValue(value: unknown): string | number {
  if (value == null) return '';
  if (value instanceof Date) return ngayVN(value);
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return value;
  if (typeof value === 'object')
    return escapeXlsxCell(JSON.stringify(value) ?? '');
  if (typeof value === 'string' || typeof value === 'bigint') {
    return escapeXlsxCell(String(value));
  }
  return '';
}

export interface TruongFormHoSo {
  key: string;
  caption: string;
  source: 'scalar' | 'metadata' | 'statistic';
  path: string;
}

/** The form layout is generated into a backend manifest at build time. */
export function buildFormExport(
  modelName: 'Case' | 'Incident',
  fields: readonly TruongFormHoSo[],
): {
  columns: readonly KhaiCotXuat<DongXuatDayDuModel>[];
  select: Readonly<Record<string, true>>;
} {
  const model = Prisma.dmmf.datamodel.models.find(
    (item) => item.name === modelName,
  );
  if (!model) throw new Error(`Missing Prisma model: ${modelName}`);
  const scalars = new Set(
    model.fields.filter((f) => f.kind !== 'object').map((f) => f.name),
  );
  const selected = new Set<string>(['id']);
  for (const field of fields) {
    if (field.source === 'scalar') {
      if (!scalars.has(field.path))
        throw new Error(`Missing ${modelName}.${field.path}`);
      selected.add(field.path);
    } else if (field.source === 'statistic') {
      if (modelName !== 'Case')
        throw new Error('Incident has no statistic relation');
      selected.add('statistic');
    } else selected.add('metadata');
  }
  return {
    columns: fields.map((field) => ({
      key: field.key,
      tieuDe: field.caption,
      rong: 24,
      doc: (row) => {
        const container =
          field.source === 'scalar'
            ? row
            : (row[field.source] as Record<string, unknown> | null);
        return readValue(container?.[field.path]);
      },
    })),
    select: Object.fromEntries([...selected].map((key) => [key, true])),
  };
}
