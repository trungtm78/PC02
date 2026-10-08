import {
  redactNativeFields,
  validateNativePolicies,
  assertNativeFieldWrites,
} from './case-native-field-policy';
import type { NativeFieldPolicy } from './case-native-field-policy';
import { Prisma } from '@prisma/client';
const policies: NativeFieldPolicy[] = [
  { key: 'sdtCungCap', sensitivity: 'RESTRICTED' },
  { key: 'cccdCungCap', sensitivity: 'RESTRICTED' },
  {
    key: 'statistic.soTienBiThietHai',
    sensitivity: 'RESTRICTED',
    searchable: false,
  },
];
describe('CG-FP01 native132 governed sensitivity', () => {
  it('publishes registered canonical policies without redefining storage or metadata keys', () => {
    expect(() => validateNativePolicies(policies)).not.toThrow();
    expect(() =>
      validateNativePolicies([{ key: 'arbitrary', sensitivity: 'RESTRICTED' }]),
    ).toThrow();
    expect(() =>
      validateNativePolicies([
        { key: 'cccdCungCap', sensitivity: 'RESTRICTED', column: 'status' },
      ]),
    ).toThrow();
  });
  it('redacts native columns, owned metadata aliases, statistic and legacy snapshots without changing persisted original', () => {
    const record = {
      id: 'case',
      sdtCungCap: 'secret-phone',
      cccdCungCap: 'secret-id',
      name: 'Visible',
      statistic: { soTienBiThietHai: 999, soLuongNguoiChet: 1 },
      metadata: {
        reporterIdNumber: 'secret-id',
        sdtCungCap: 'secret-phone',
        damageAmount: 999,
        statistic: { soTienBiThietHai: 999 },
        legacyRaw: { old_phone: 'secret-phone' },
        sourceSnapshot: { old_id: 'secret-id' },
        unknown: 'preserve',
      },
    };
    const sanitized = redactNativeFields(record, policies, false);
    expect(JSON.stringify(sanitized)).not.toContain('secret');
    expect(sanitized.statistic).toEqual({ soLuongNguoiChet: 1 });
    expect(sanitized.metadata).not.toHaveProperty('damageAmount');
    expect(sanitized.metadata.unknown).toBe('preserve');
    expect(record.cccdCungCap).toBe('secret-id');
    expect(redactNativeFields(record, policies, true)).toEqual(record);
  });
  it('rejects direct/alias/statistic metadata spoofing but permits omitted or unchanged protected values', () => {
    const existing = {
      sdtCungCap: 'secret',
      cccdCungCap: '123',
      statistic: { soTienBiThietHai: 999 },
      metadata: { reporterIdNumber: '123' },
    };
    expect(() =>
      assertNativeFieldWrites({ name: 'New' }, existing, policies, false),
    ).not.toThrow();
    expect(() =>
      assertNativeFieldWrites(
        { sdtCungCap: 'secret' },
        existing,
        policies,
        false,
      ),
    ).not.toThrow();
    for (const input of [
      { sdtCungCap: 'changed' },
      { metadata: { reporterIdNumber: 'changed' } },
      { statistic: { soTienBiThietHai: 1 } },
      { metadata: { damageAmount: 1 } },
      { metadata: { statistic: { soTienBiThietHai: 1 } } },
    ])
      expect(() =>
        assertNativeFieldWrites(input, existing, policies, false),
      ).toThrow();
    expect(() =>
      assertNativeFieldWrites({ cccdCungCap: 'new' }, existing, policies, true),
    ).not.toThrow();
  });
  it('exportable false remains enforced for a sensitive business actor', () => {
    const p: NativeFieldPolicy[] = [
      { key: 'cccdCungCap', sensitivity: 'NORMAL', exportable: false },
    ];
    expect(
      redactNativeFields({ cccdCungCap: 'secret' }, p, true, 'export'),
    ).toEqual({});
  });
  it('preserves unprotected Prisma Decimal values while redacting other native fields', () => {
    const currency = new Prisma.Decimal(10),
      result = redactNativeFields(
        { cccdCungCap: 'private', statistic: { soTienThuHoi: currency } },
        policies,
        false,
      );
    expect(result.statistic.soTienThuHoi).toBeInstanceOf(Prisma.Decimal);
    expect(JSON.stringify(result)).toBe('{"statistic":{"soTienThuHoi":"10"}}');
  });
});
