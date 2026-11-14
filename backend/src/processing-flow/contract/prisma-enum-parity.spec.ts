import {
  CapDoToiPham,
  LoaiDon,
  ProcAnchorKind,
  ProcCalendarDayKind,
  ProcCalendarYearStatus,
  ProcConditionKey,
  ProcDurationUnit,
  ProcFlowStatus,
  ProcFlowVersionStatus,
  ProcPartyKind,
  ProcPartyRole,
  ProcRecordKind,
} from '@prisma/client';
import { RECORD_KINDS as GATEWAY_RECORD_KINDS } from '../gateway/record-snapshot';
import {
  ANCHOR_KINDS,
  CALENDAR_DAY_KINDS,
  CALENDAR_YEAR_STATUSES,
  CONDITION_KEYS,
  CRIME_GRAVITIES,
  DEADLINE_GROUPS,
  DURATION_UNITS,
  FLOW_STATUSES,
  FLOW_VERSION_STATUSES,
  PARTY_KINDS,
  PARTY_ROLES,
  RECORD_KINDS,
} from './processing-codes';

/**
 * The database enums and the lists the engine, the web and Flutter read are the same values in the same order. A value
 * added on one side only would be stored and never understood, or offered and refused by the database.
 */
describe('the Prisma enums of the processing flow are the lists of the contract', () => {
  it.each([
    ['ProcRecordKind', ProcRecordKind, RECORD_KINDS],
    ['ProcDurationUnit', ProcDurationUnit, DURATION_UNITS],
    ['ProcAnchorKind', ProcAnchorKind, ANCHOR_KINDS],
    ['ProcPartyRole', ProcPartyRole, PARTY_ROLES],
    ['ProcPartyKind', ProcPartyKind, PARTY_KINDS],
    ['ProcConditionKey', ProcConditionKey, CONDITION_KEYS],
    ['ProcFlowStatus', ProcFlowStatus, FLOW_STATUSES],
    ['ProcFlowVersionStatus', ProcFlowVersionStatus, FLOW_VERSION_STATUSES],
    ['ProcCalendarYearStatus', ProcCalendarYearStatus, CALENDAR_YEAR_STATUSES],
    ['ProcCalendarDayKind', ProcCalendarDayKind, CALENDAR_DAY_KINDS],
    // Not enums of this module: the gravity of a crime (a case) and the deadline group (a petition) are read from theirs.
    ['CapDoToiPham', CapDoToiPham, CRIME_GRAVITIES],
    ['LoaiDon', LoaiDon, DEADLINE_GROUPS],
  ] as const)('%s', (_name, prismaEnum, list) => {
    expect(prismaEnum).toBeDefined();
    expect(Object.values(prismaEnum)).toEqual([...list]);
  });

  it('the record kinds of the gateway are the list of the contract itself', () => {
    expect(GATEWAY_RECORD_KINDS).toBe(RECORD_KINDS);
  });
});
