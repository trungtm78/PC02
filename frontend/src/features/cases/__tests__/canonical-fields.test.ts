import { describe, expect, it } from 'vitest';
import { mergeCaseApiToFormData } from '@/pages/cases/CaseFormPage/mergeCaseApiToFormData';
import { buildCreateCasePayload } from '@/pages/cases/CaseFormPage/buildCreateCasePayload';
import { INITIAL_FORM_DATA } from '@/pages/cases/CaseFormPage/types';
import { normalizeCanonicalCasePayload } from '../canonical-fields';

describe('CG01 canonical ownership regressions', () => {
  it('does not resurrect a cleared description from metadata or previous form', () => {
    const form = mergeCaseApiToFormData({ moTaChiTiet: null, metadata: {
      description: 'stale', _canonicalClears: { moTaChiTiet: true },
    } as never }, { ...INITIAL_FORM_DATA, description: 'previous' });
    expect(form.description).toBe('');
  });
  it('preserves a literal empty canonical value ahead of a stale metadata alias', () => {
    expect(mergeCaseApiToFormData({ moTaChiTiet: '', metadata: { description: 'stale' } }, INITIAL_FORM_DATA).description).toBe('');
  });
  it('records a description tombstone and removes owned aliases while preserving unknown metadata', () => {
    const payload = buildCreateCasePayload({ ...INITIAL_FORM_DATA, description: '' }, {
      legacyMetadata: { description: 'stale', moTaChiTiet: 'stale', unknown: { source: 'legacy' } },
    });
    expect(payload.metadata).not.toHaveProperty('description');
    expect(payload.metadata).not.toHaveProperty('moTaChiTiet');
    expect(payload.metadata).toHaveProperty('_canonicalClears.moTaChiTiet', true);
    expect(payload.metadata.unknown).toEqual({ source: 'legacy' });
  });
  it('sends nullable statistic clears when editing instead of omitting the old value', () => {
    const payload = buildCreateCasePayload(INITIAL_FORM_DATA, { includeFalseStatisticFlags: true });
    expect(payload.statistic).toHaveProperty('soTienBiThietHai', null);
    expect(payload.statistic).toHaveProperty('ngayDangKyHoSo', null);
  });
  it('honors native crime clear tombstones and cannot resurrect metadata-only mirrors', () => {
    const metadata = { crime: 'stale', criminalType: 'stale alias', _canonicalClears: { crime: true } };
    expect(mergeCaseApiToFormData({ crime: null, metadata }, { ...INITIAL_FORM_DATA, criminalType: 'previous' }).criminalType).toBe('');
    expect(normalizeCanonicalCasePayload({ metadata }).metadata).not.toHaveProperty('crime');
  });
  it('removes owned nested statistic metadata mirrors while preserving unknown siblings', () => {
    const result = normalizeCanonicalCasePayload({ statistic: { soTienBiThietHai: null }, metadata: { statistic: { soTienBiThietHai: 9, original: 'keep' } } });
    expect(result.metadata.statistic).toEqual({ original: 'keep' });
  });
  it('preserves an uncertain legacy date through unrelated saves until it is explicitly cleared', () => {
    const source = { ngayXayRa: null, metadata: { ngayXayRa: '198X', original_source: { date: '198X' } } };
    const loaded = mergeCaseApiToFormData(source, INITIAL_FORM_DATA);
    expect(loaded.ngayXayRa).toBe('198X');
    const saved = buildCreateCasePayload(loaded, { legacyMetadata: source.metadata, includeFalseStatisticFlags: true });
    expect(saved).not.toHaveProperty('ngayXayRa');
    expect(saved.metadata.ngayXayRa).toBe('198X');
    expect(saved.metadata.original_source).toEqual({ date: '198X' });
    expect(mergeCaseApiToFormData(saved, INITIAL_FORM_DATA).ngayXayRa).toBe('198X');
    const cleared = buildCreateCasePayload({ ...loaded, ngayXayRa: '' }, { legacyMetadata: saved.metadata });
    expect(cleared.ngayXayRa).toBeNull();
    expect(cleared.metadata).not.toHaveProperty('ngayXayRa');
    expect(cleared.metadata).toHaveProperty('_canonicalClears.ngayXayRa', true);
    expect(cleared.metadata).toHaveProperty('_canonicalDateSources.ngayXayRa.value', '198X');
    const corrected = buildCreateCasePayload({ ...loaded, ngayXayRa: '1981-10-05' }, { legacyMetadata: saved.metadata });
    expect(corrected.ngayXayRa).toBe('1981-10-05');
    expect(corrected.metadata).toHaveProperty('_canonicalDateSources.ngayXayRa.value', '198X');
    expect(corrected.metadata.ngayXayRa).toBe('1981-10-05');
    const invalidNew = buildCreateCasePayload({ ...INITIAL_FORM_DATA, ngayXayRa: 'arbitrary invalid date' });
    expect(invalidNew.ngayXayRa).toBe('arbitrary invalid date');
  });
  it('preserves a nested uncertain statistic date and allows a later typed correction', () => {
    const metadata = { 'statistic.ngayDangKyHoSo': '200X' };
    const loaded = mergeCaseApiToFormData({ statistic: { ngayDangKyHoSo: null }, metadata }, INITIAL_FORM_DATA);
    const saved = buildCreateCasePayload(loaded, { legacyMetadata: metadata, includeFalseStatisticFlags: true });
    expect(saved.statistic).not.toHaveProperty('ngayDangKyHoSo');
    expect(saved.metadata['statistic.ngayDangKyHoSo']).toBe('200X');
    const corrected = buildCreateCasePayload({ ...loaded, statistic: { ...loaded.statistic, ngayDangKyHoSo: '2001-10-05' } }, { legacyMetadata: saved.metadata, includeFalseStatisticFlags: true });
    expect(corrected.statistic).toHaveProperty('ngayDangKyHoSo', '2001-10-05');
  });
  it.each([
    ['deXuatXuLy', 'deXuat'], ['yeuCauBoSung', 'yeuCauBoSung'], ['sttCu', 'sttCu'],
    ['phanLoaiToiPhamLinhVuc', 'phanLoaiToiPhamLinhVuc'], ['caseClassification', 'caseClassification'], ['tinhTrang', 'tinhTrang'],
  ])('clears supplemental canonical %s without resurrecting an older proposal or classification', (key, column) => {
    const loaded = mergeCaseApiToFormData({ [column]: 'old canonical', metadata: { [key]: 'stale' } }, INITIAL_FORM_DATA);
    const saved = buildCreateCasePayload({ ...loaded, [key]: '' }, { legacyMetadata: { [key]: 'stale' } });
    expect((saved as unknown as Record<string, unknown>)[column]).toBeNull();
    expect(saved.metadata._canonicalClears).toHaveProperty(column, true);
    expect((mergeCaseApiToFormData(saved, loaded) as unknown as Record<string, unknown>)[key]).toBe('');
  });
});
