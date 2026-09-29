import { Prisma } from '@prisma/client';
import type { KhaiCotXuat } from './xuat-danh-sach';
import { ngayVN } from './dinh-dang';
import { escapeXlsxCell } from '../utils/xlsx-formula-escape.util';

export interface DongXuatDayDuModel {
  id: string;
  [key: string]: unknown;
}

const SEARCH_SHADOW_FIELDS = new Set(['timKiemBd', 'sttSort']);

function isSearchShadow(name: string): boolean {
  return SEARCH_SHADOW_FIELDS.has(name) || name.endsWith('Bd');
}

function readValue(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return ngayVN(value);
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'object') return JSON.stringify(value) ?? '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  ) {
    return escapeXlsxCell(String(value));
  }
  return '';
}

/**
 * Prisma's scalar model is the storage contract for form fields. Keeping this
 * registry derived from the model makes new typed fields visible in the full
 * export; JSON fields preserve every metadata and legacy key without loss.
 */
export function buildFullModelExport(
  modelName: 'Case' | 'Incident',
  relationNames: readonly string[] = [],
): {
  columns: readonly KhaiCotXuat<DongXuatDayDuModel>[];
  select: Readonly<Record<string, true>>;
} {
  const model = Prisma.dmmf.datamodel.models.find(
    (item) => item.name === modelName,
  );
  if (!model) throw new Error(`Missing Prisma model: ${modelName}`);
  const relations = new Set(relationNames);
  const fields = model.fields.filter((field) =>
    field.kind === 'object'
      ? relations.has(field.name)
      : !isSearchShadow(field.name),
  );
  for (const relation of relations) {
    if (!fields.some((field) => field.name === relation)) {
      throw new Error(`Missing ${modelName} export relation: ${relation}`);
    }
  }
  return {
    columns: fields.map((field) => ({
      key: field.name,
      tieuDe: field.name,
      rong: 22,
      doc: (row) => readValue(row[field.name]),
    })),
    select: Object.fromEntries(fields.map((field) => [field.name, true])),
  };
}
