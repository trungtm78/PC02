import { CaseProvenance } from '@prisma/client';
import { shouldAutoCreateIncident, buildIncidentFromCase } from './incident-factory.util';

describe('shouldAutoCreateIncident', () => {
  it.each([
    [CaseProvenance.DIRECT_DISCOVERY,    { incidentDate: '2026-01-01' },     true],
    [CaseProvenance.TRANSFERRED,          { incidentType: 'Trộm cắp' },      true],
    [CaseProvenance.SELF_SURRENDER,       { incidentDescription: 'Mô tả' },  true],
    [CaseProvenance.PROSECUTOR_PROPOSAL,  { incidentLocation: '123 Đường' }, true],
    [CaseProvenance.OTHER_LEGAL_SOURCE,   { incidentDate: '2026-01-01' },    true],
    ['FROM_INCIDENT',                     { incidentDate: '2026-01-01' },    false],
    ['FROM_PETITION',                     { incidentDate: '2026-01-01' },    false],
    [CaseProvenance.DIRECT_DISCOVERY,    {},                                  false],
    [CaseProvenance.DIRECT_DISCOVERY,    null,                                false],
  ] as const)('%s + meta present=%s → %s', (provenance, meta, expected) => {
    expect(shouldAutoCreateIncident(provenance as string, meta as any)).toBe(expected);
  });
});

describe('buildIncidentFromCase', () => {
  const baseInput = {
    rawName: 'Test Case',
    meta: {} as Record<string, unknown>,
    code: 'VV-2026-00001',
    userId: 'user-1',
    investigatorId: 'investigator-1',
  };

  it('uses name as-is when >= 5 chars', () => {
    const result = buildIncidentFromCase({ ...baseInput, rawName: 'Valid' });
    expect(result.name).toBe('Valid');
  });

  it('prepends "Vụ việc - " when name < 5 chars', () => {
    const result = buildIncidentFromCase({ ...baseInput, rawName: 'AB' });
    expect(result.name).toBe('Vụ việc - AB');
  });

  it('joins all 3 description parts with double newline', () => {
    const result = buildIncidentFromCase({
      ...baseInput,
      meta: {
        incidentDescription: 'Mô tả',
        incidentCause: 'Nguyên nhân A',
        incidentMethod: 'Phương thức B',
      },
    });
    expect(result.description).toBe(
      'Mô tả\n\nNguyên nhân: Nguyên nhân A\n\nPhương thức: Phương thức B',
    );
  });

  it('returns description = undefined when no parts present', () => {
    const result = buildIncidentFromCase({ ...baseInput, meta: {} });
    expect(result.description).toBeUndefined();
  });

  it('maps incidentDate to fromDate as Date object', () => {
    const result = buildIncidentFromCase({ ...baseInput, meta: { incidentDate: '2026-01-15' } });
    expect(result.fromDate).toEqual(new Date('2026-01-15'));
  });

  it('returns fromDate = undefined when incidentDate is absent', () => {
    const result = buildIncidentFromCase({ ...baseInput, meta: {} });
    expect(result.fromDate).toBeUndefined();
  });

  it('returns fromDate = undefined when incidentDate is an invalid string (guards Prisma 500)', () => {
    const result = buildIncidentFromCase({ ...baseInput, meta: { incidentDate: 'not-a-date' } });
    expect(result.fromDate).toBeUndefined();
  });

  it('maps incidentLocation to diaChiXayRa', () => {
    const result = buildIncidentFromCase({ ...baseInput, meta: { incidentLocation: '123 Đường Abc' } });
    expect(result.diaChiXayRa).toBe('123 Đường Abc');
  });

  it('sets investigatorId from input.investigatorId', () => {
    const result = buildIncidentFromCase({ ...baseInput, investigatorId: 'inv-id-42' });
    expect(result.investigatorId).toBe('inv-id-42');
  });

  it('sets assignedTeamId from input.assignedTeamId when provided', () => {
    const result = buildIncidentFromCase({ ...baseInput, assignedTeamId: 'team-99' });
    expect(result.assignedTeamId).toBe('team-99');
  });

  it('sets assignedTeamId to null when not provided', () => {
    const result = buildIncidentFromCase({ ...baseInput });
    expect(result.assignedTeamId).toBeNull();
  });

  it('sets canBoNhapId and createdById from userId', () => {
    const result = buildIncidentFromCase({ ...baseInput, userId: 'creator-1' });
    expect(result.canBoNhapId).toBe('creator-1');
    expect(result.createdById).toBe('creator-1');
  });

  it('sets code from input.code', () => {
    const result = buildIncidentFromCase({ ...baseInput, code: 'VV-2026-00099' });
    expect(result.code).toBe('VV-2026-00099');
  });
});
