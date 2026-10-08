import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateCustomValues } from './governance/configuration.validation';
import {
  normalizeCanonicalCaseWrite,
  CASE_CANONICAL_FIELD_REGISTRY,
} from './case-canonical-fields';

const inventory = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../../../docs/requirements/case-governance/field-inventory.json',
    ),
    'utf8',
  ),
) as {
  rows: {
    key: string;
    column: string;
    kind: string;
    type: string;
    labels: string[];
  }[];
};
describe('CG01 canonical writes', () => {
  it.each(['yes', 'no'])(
    'accepts the real published select transport value %s with typed false, zero and null',
    (choice) => {
      const definition = {
        fields: [
          {
            key: 'custom_choice',
            label: 'Choice',
            type: 'select',
            required: true,
            options: ['yes', 'no'],
          },
          {
            key: 'custom_required',
            label: 'Required Boolean',
            type: 'boolean',
            required: true,
          },
          {
            key: 'custom_count',
            label: 'Count',
            type: 'number',
            required: true,
          },
          {
            key: 'custom_flag',
            label: 'Optional Boolean',
            type: 'boolean',
            required: false,
          },
        ],
      };
      const values = {
        custom_choice: choice,
        custom_required: false,
        custom_count: 0,
        custom_flag: null,
      };
      expect(validateCustomValues(definition, values)).toEqual(values);
    },
  );
  it.each([
    [
      'ngayXayRa',
      { ngayXayRa: '198X', unknown: 'keep' },
      { ngayXayRa: '1981-10-05' },
      'metadata.ngayXayRa',
    ],
    [
      'ngayXayRa',
      { ngayXayRa: '198X', unknown: 'keep' },
      { ngayXayRa: null },
      'metadata.ngayXayRa',
    ],
    [
      'statistic.ngayDangKyHoSo',
      { statistic: { ngayDangKyHoSo: '198X', sibling: 'keep' } },
      { statistic: { ngayDangKyHoSo: '1981-10-05' } },
      'metadata.statistic.ngayDangKyHoSo',
    ],
    [
      'statistic.ngayDangKyHoSo',
      { statistic: { ngayDangKyHoSo: '198X', sibling: 'keep' } },
      { statistic: { ngayDangKyHoSo: null } },
      'metadata.statistic.ngayDangKyHoSo',
    ],
  ])(
    'archives original uncertain %s on direct correction or clear without relying on the frontend',
    (column, previous, input, source) => {
      const before = structuredClone(previous);
      const output = normalizeCanonicalCaseWrite(input, previous);
      expect(
        (
          ((output.metadata as Record<string, unknown>)._canonicalDateSources ??
            {}) as Record<string, unknown>
        )[column],
      ).toEqual({ value: '198X', source, verification: 'unverified' });
      expect(previous).toEqual(before);
    },
  );
  it('retains an existing original archive through a later correction and attempted metadata overwrite', () => {
    const original = {
      value: '198X',
      source: 'metadata.ngayXayRa',
      verification: 'unverified',
    };
    const output = normalizeCanonicalCaseWrite(
      {
        ngayXayRa: null,
        metadata: {
          _canonicalDateSources: { ngayXayRa: { value: 'replacement' } },
        },
      },
      {
        ngayXayRa: '1981-10-05',
        _canonicalDateSources: { ngayXayRa: original },
      },
    );
    expect(
      (output.metadata as Record<string, unknown>)._canonicalDateSources,
    ).toEqual({ ngayXayRa: original });
    expect(output.metadata).not.toHaveProperty('ngayXayRa');
  });
  it('archives an original uncertain date supplied on a create API correction or clear', () => {
    const output = normalizeCanonicalCaseWrite({
      ngayXayRa: null,
      metadata: { ngayXayRa: '198X' },
    });
    expect(output.metadata).toHaveProperty(
      '_canonicalDateSources.ngayXayRa.value',
      '198X',
    );
    expect(output.metadata).not.toHaveProperty('ngayXayRa');
  });
  it('archives partial flat statistic/EDTF sources while leaving complete real civil dates unaltered', () => {
    const output = normalizeCanonicalCaseWrite(
      {
        statistic: { ngayDangKyHoSo: null },
        ngayVietDonEdtf: null,
        ngayKhoiTo: '2026-10-05',
      },
      {
        'statistic.ngayDangKyHoSo': '198X',
        ngayVietDonEdtf: '198X',
        ngayKhoiTo: '2026-10-04',
      },
    );
    const sources = (output.metadata as Record<string, unknown>)
      ._canonicalDateSources as Record<string, unknown>;
    expect(sources['statistic.ngayDangKyHoSo']).toEqual({
      value: '198X',
      source: 'metadata.statistic.ngayDangKyHoSo',
      verification: 'unverified',
    });
    expect(sources.ngayVietDonEdtf).toEqual({
      value: '198X',
      source: 'metadata.ngayVietDonEdtf',
      verification: 'unverified',
    });
    expect(sources).not.toHaveProperty('ngayKhoiTo');
    expect(output.ngayKhoiTo).toBe('2026-10-05');
  });
  it('preserves false and zero, removes stale cleared aliases, and retains unknown/date source data', () => {
    const result = normalizeCanonicalCaseWrite(
      {
        moTaChiTiet: null,
        laCongNgheCao: false,
        statistic: { soTienBiThietHai: 0 },
        metadata: { description: 'stale' },
      },
      {
        moTaChiTiet: 'older',
        unknown: { raw: '198X' },
        ngayVietDonEdtf: '2026-10~',
        _canonicalClears: { laCongNgheCao: true },
      },
    );
    expect(result.moTaChiTiet).toBeNull();
    expect(result.laCongNgheCao).toBe(false);
    expect(result.statistic).toEqual({ soTienBiThietHai: 0 });
    expect(result.metadata).toEqual({
      unknown: { raw: '198X' },
      ngayVietDonEdtf: '2026-10~',
      _canonicalClears: { moTaChiTiet: true },
    });
  });
  it.each(inventory.rows)(
    '$key has the exact frozen storage type and label contract',
    (row) => {
      expect(
        CASE_CANONICAL_FIELD_REGISTRY.find((field) => field.key === row.key),
      ).toEqual({
        key: row.key,
        column: row.column,
        kind: row.kind,
        type: row.type,
        labels: row.labels,
      });
    },
  );
  it.each(inventory.rows)(
    '$key clears all owned mirrors without mutating its input',
    (row) => {
      const value =
        row.kind === 'multiselect' ? [] : row.kind === 'toggle' ? false : null;
      const input = row.column.startsWith('statistic.')
        ? {
            statistic: { [row.column.slice(10)]: value },
            metadata: { [row.key]: 'stale', [row.column]: 'stale' },
          }
        : {
            [row.column]: value,
            metadata: { [row.key]: 'stale', [row.column]: 'stale' },
          };
      const before = structuredClone(input);
      const output = normalizeCanonicalCaseWrite(input);
      expect(input).toEqual(before);
      if (row.kind === 'toggle')
        expect((output.metadata as Record<string, unknown>)[row.key]).toBe(
          false,
        );
      else {
        expect(
          Object.prototype.hasOwnProperty.call(output.metadata, row.key),
        ).toBe(false);
        expect(
          (output.metadata as Record<string, unknown>)._canonicalClears,
        ).toHaveProperty([row.column], true);
      }
    },
  );
  it('never interprets the native report boolean as a text alias', () => {
    expect(
      normalizeCanonicalCaseWrite({
        baoCaoBanGiamDoc: true,
        metadata: { baoCaoBanGiamDoc: 'original text' },
      }),
    ).toEqual({
      baoCaoBanGiamDoc: true,
      metadata: { baoCaoBanGiamDoc: 'original text', _canonicalClears: {} },
    });
  });
  it('does not turn untouched metadata into a canonical write or resurrect existing tombstones', () => {
    const result = normalizeCanonicalCaseWrite(
      { metadata: { description: 'stale' } },
      { _canonicalClears: { moTaChiTiet: true }, unknown: 0 },
    );
    expect(result).not.toHaveProperty('moTaChiTiet');
    expect(result.metadata).not.toHaveProperty('description');
    expect(result.metadata).toHaveProperty('unknown', 0);
    expect(result.metadata).toHaveProperty(
      '_canonicalClears.moTaChiTiet',
      true,
    );
  });
  it('clears native identity and crime mirrors without promoting metadata-only core fields', () => {
    const result = normalizeCanonicalCaseWrite({
      crime: null,
      name: 'current',
      metadata: {
        crime: 'old crime',
        criminalType: 'old alias',
        name: 'old name',
        caseTitle: 'old title',
        status: 'legacy',
      },
    });
    expect(result.metadata).not.toHaveProperty('crime');
    expect(result.metadata).not.toHaveProperty('criminalType');
    expect(result.metadata).toHaveProperty('name', 'current');
    expect(result.metadata).toHaveProperty('caseTitle', 'current');
    expect(result.metadata).toHaveProperty('_canonicalClears.crime', true);
    expect(result).not.toHaveProperty('status');
  });
  it('removes owned nested statistic metadata without modifying unknown siblings', () => {
    const result = normalizeCanonicalCaseWrite({
      statistic: { soTienBiThietHai: null },
      metadata: { statistic: { soTienBiThietHai: 9, original: 'keep' } },
    });
    expect((result.metadata as Record<string, unknown>).statistic).toEqual({
      original: 'keep',
    });
  });
});
