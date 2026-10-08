import { ForbiddenException } from '@nestjs/common';
import { KHAI_TIM_KIEM_VU_AN } from '../../common/tim-kiem/khai/vu-an.khai';
import {
  docThe,
  dungDieuKienTimKiem,
  DO_DAI_GIA_TRI_TOI_DA,
} from '../../common/tim-kiem/dieu-kien';
import { boDauTimKiem } from '../../common/tim-kiem/bo-dau';
import type { TruongTimKiem } from '../../common/tim-kiem/sinh/sinh-tim-kiem';
export const CASE_LEGACY_SEARCH_PARAMS = {
  search: '*',
  charges: 'toiDanh',
  unit: 'donViGiaiQuyet',
  stt: 'stt',
  sttCu: 'sttCu',
  donViGiao: 'donViGiao',
  investigatorName: 'dieuTraVien',
} as const;
export function caseSearchTags(query: Record<string, unknown>): string[] {
  const tags = Array.isArray(query.tk)
    ? query.tk.filter((v): v is string => typeof v === 'string')
    : typeof query.tk === 'string'
      ? [query.tk]
      : [];
  for (const [param, key] of Object.entries(CASE_LEGACY_SEARCH_PARAMS)) {
    const value = query[param];
    if (typeof value === 'string' && value.trim())
      tags.push(key + '~' + value.trim().slice(0, DO_DAI_GIA_TRI_TOI_DA));
  }
  return tags;
}
const blocked = (t: TruongTimKiem, forbidden: ReadonlySet<string>) =>
  forbidden.has(t.key) ||
  (!!t.cot && forbidden.has(t.cot)) ||
  (!!t.quanHe && forbidden.has(t.quanHe + 'Id'));
export function compileCasePolicySearch(
  query: Record<string, unknown>,
  forbidden: ReadonlySet<string>,
): Record<string, unknown>[] {
  const khai = KHAI_TIM_KIEM_VU_AN,
    tags = docThe(caseSearchTags(query), khai),
    result: Record<string, unknown>[] = [];
  for (const tag of tags) {
    if (tag.key !== '*') {
      const field = khai.truong.find((t) => t.key === tag.key);
      if (field && blocked(field, forbidden))
        throw new ForbiddenException('Protected field search denied');
      result.push(...dungDieuKienTimKiem([tag], khai, { luiCotGoc: true }));
      continue;
    }
    const terms: Record<string, unknown>[] = [];
    for (const value of tag.giaTri) {
      for (const field of khai.truong) {
        if (
          blocked(field, forbidden) ||
          field.vaoTatCa === false ||
          (field.kieu === 'quan-he' &&
            !(khai.tatCaGomQuanHe ?? []).includes(field.key)) ||
          (field.kieu === 'doi-tuong' &&
            !(khai.tatCaGomQuanHe ?? []).includes(field.key))
        )
          continue;
        let values = [value];
        if (field.kieu === 'chon') {
          const text = boDauTimKiem(value),
            codes = field.giaTriCot
              ? Object.keys(field.giaTriCot)
              : (field.giaTriHopLe ?? []);
          values = codes.filter((code) =>
            boDauTimKiem(
              (field.nhanGiaTri?.[code] ?? code) + ' ' + code,
            ).includes(text),
          );
          if (!values.length) continue;
        }
        terms.push(
          ...dungDieuKienTimKiem([{ key: field.key, giaTri: values }], khai, {
            luiCotGoc: true,
          }),
        );
      }
      for (const extra of khai.cotThemVaoTatCa ?? []) {
        const column = typeof extra === 'string' ? extra : extra.cot;
        if (!forbidden.has(column))
          terms.push({ [column]: { contains: value, mode: 'insensitive' } });
      }
    }
    result.push(terms.length ? { OR: terms } : { id: { in: [] } });
  }
  return result;
}
