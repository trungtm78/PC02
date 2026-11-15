import { describe, it, expect } from 'vitest';
import raw from '@/shared/processing/processing-codes.generated.json';
import { errorText, processingFlow } from '@/locales/processingFlow.vi';
import {
  ANCHOR_KINDS,
  CALENDAR_DAY_KINDS,
  CALENDAR_YEAR_STATUSES,
  CRIME_GRAVITIES,
  DEADLINE_GROUPS,
  DURATION_UNITS,
  ERROR_CODES,
  PARTY_ROLES,
  RECORD_KINDS,
} from '../codes';

describe('the words of every code the server can answer with', () => {
  it.each(raw.errorCodes)('error %s has its own sentence', (code) => {
    const text = errorText(code, code);
    expect(text).not.toBe(code);
    expect(text).not.toBe(processingFlow.errorFallback);
    expect(text.trim().length).toBeGreaterThan(10);
  });

  it('has no sentence for a code the contract does not know (a stale entry would hide a rename)', () => {
    expect(Object.keys(processingFlow.errors).filter((c) => !ERROR_CODES.includes(c))).toEqual([]);
  });

  it('an unknown code is never shown raw; with no code the server message is shown', () => {
    expect(errorText('SOMETHING_NEW', 'SOMETHING_NEW')).toBe(processingFlow.errorFallback);
    expect(errorText(undefined, 'Mất kết nối')).toBe('Mất kết nối');
    expect(errorText(undefined)).toBe(processingFlow.errorFallback);
  });

  it('REVISION_CONFLICT says somebody else changed it and to reload', () => {
    const text = errorText('REVISION_CONFLICT');
    expect(text).toMatch(/Người khác/);
    expect(text).toMatch(/tải lại/);
  });
});

describe('the words of every list of the contract', () => {
  const covers = (labels: Record<string, string>, codes: readonly string[]) => expect(codes.filter((c) => !labels[c])).toEqual([]);

  it('record kinds, roles, units, anchors, gravities, groups, day kinds and year statuses are all worded', () => {
    covers(processingFlow.recordKinds, RECORD_KINDS);
    covers(processingFlow.roles, PARTY_ROLES);
    covers(processingFlow.units, DURATION_UNITS);
    covers(processingFlow.anchors, ANCHOR_KINDS);
    covers(processingFlow.crimeGravities, CRIME_GRAVITIES);
    covers(processingFlow.deadlineGroups, DEADLINE_GROUPS);
    covers(processingFlow.calendar.kinds, CALENDAR_DAY_KINDS);
    covers(processingFlow.calendar.status, CALENDAR_YEAR_STATUSES);
  });

  it('the typed lists are the generated ones, not a copy that can drift', () => {
    expect([...RECORD_KINDS]).toEqual(raw.recordKinds);
    expect([...ANCHOR_KINDS]).toEqual(raw.anchorKinds);
    expect([...DURATION_UNITS]).toEqual(raw.durationUnits);
    expect([...PARTY_ROLES]).toEqual(raw.partyRoles);
  });

  it('the names of the Vietnamese kinds and roles are the ones the mockup the owner accepted uses', () => {
    expect(processingFlow.recordKinds).toMatchObject({ PETITION: 'Đơn thư', INCIDENT: 'Vụ việc', CASE: 'Vụ án' });
    expect(processingFlow.roles).toMatchObject({ MAIN: 'xử lý chính', CHECK: 'kiểm tra', COORDINATE: 'phối hợp', INFORM: 'xem để biết' });
    expect(processingFlow.units.WORKING_DAY).toBe('ngày làm việc');
    expect(processingFlow.anchors.ASSIGNED_TO_UNIT).toBe('Ngày giao đơn vị');
  });
});
