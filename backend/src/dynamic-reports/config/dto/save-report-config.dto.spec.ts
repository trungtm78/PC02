import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SaveReportConfigRequestDto } from './save-report-config.dto';

/**
 * Multipart body field `config` arrives as a JSON-object string (same
 * convention as `PreviewTemplateDto.selectedSheets`) — the @Transform must
 * parse it before the nested @ValidateNested/@Type recursively validates
 * fields/schedule/roles/targets.
 */
describe('SaveReportConfigRequestDto', () => {
  const validConfig = {
    code: 'HSLN',
    name: 'Thống kê hình sự liên ngành',
    selectedSheets: ['Đội 3'],
    dateSystem: '1900',
    fields: [
      {
        sheetKey: 'Đội 3',
        address: 'C6',
        fieldKey: 'Đội 3!C6',
        label: 'Số vụ mới',
        type: 'NUM',
        aggregate: 'SUM',
        source: 'TOKEN',
      },
    ],
    layout: { sheetOrder: ['Đội 3'], sheets: [] },
    formulas: [],
    schedule: {
      periodType: 'MONTHLY',
      dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
      openRule: { kind: 'AT_PERIOD_START' },
    },
    roles: [{ userId: 'u1', role: 'MANAGER' }],
    targets: [{ teamId: 't1', editorUserIds: ['u2'] }],
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    publish: true,
    idempotencyKey: 'key-1',
  };

  const valid = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(SaveReportConfigRequestDto, data);
    return validate(dto, { whitelist: true });
  };

  it('accepts a JSON-object string (the real multipart wire format)', async () => {
    const errors = await valid({ config: JSON.stringify(validConfig) });
    expect(errors).toEqual([]);
  });

  it('accepts an already-object value (e.g. direct unit-test construction)', async () => {
    const errors = await valid({ config: validConfig });
    expect(errors).toEqual([]);
  });

  it('rejects malformed JSON — left as the raw string so @ValidateNested fails it, not silently empty', async () => {
    const errors = await valid({ config: 'not-json[' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid field type inside the nested fields array', async () => {
    const errors = await valid({
      config: {
        ...validConfig,
        fields: [{ ...validConfig.fields[0], type: 'NOT_A_TYPE' }],
      },
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid role value inside the nested roles array', async () => {
    const errors = await valid({
      config: { ...validConfig, roles: [{ userId: 'u1', role: 'NOT_A_ROLE' }] },
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing required top-level field (code)', async () => {
    const rest: Record<string, unknown> = { ...validConfig };
    delete rest.code;
    const errors = await valid({ config: rest });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an empty editorUserIds array inside targets at the DTO shape level only if not an array', async () => {
    // Empty array is DTO-valid shape (business-rule "must have ≥1 editor"
    // is enforced in ReportConfigService, not the DTO — see
    // report-config.service.spec.ts "rejects publish when a target team
    // has zero editors").
    const errors = await valid({
      config: {
        ...validConfig,
        targets: [{ teamId: 't1', editorUserIds: [] }],
      },
    });
    expect(errors).toEqual([]);
  });
});
