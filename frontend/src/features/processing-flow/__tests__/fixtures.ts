import type { FlowDetailDto, FlowSummaryDto, StepDto, VersionDto, VersionSummaryDto, BoundTypeDto } from '../types';

/** An axios error as the server's exception filter shapes it. */
export function apiError(status: number, code: string | null, details: unknown[] = []) {
  return {
    isAxiosError: true,
    response: {
      status,
      data:
        code === null
          ? { statusCode: status, message: 'Cannot GET', error: 'Not Found' }
          : { success: false, code, error: { code, message: code, details } },
    },
  };
}

export const boundType = (name: string, over: Partial<BoundTypeDto> = {}): BoundTypeDto => ({
  directoryId: `d-${name}`,
  name,
  code: name.toUpperCase(),
  isActive: true,
  typeKey: name.toLowerCase(),
  currentTypeKey: name.toLowerCase(),
  renamed: false,
  ...over,
});

export function summary(over: Partial<FlowSummaryDto> = {}): FlowSummaryDto {
  return {
    id: 'f1',
    recordKind: 'PETITION',
    name: 'Khiếu nại',
    description: null,
    isDefault: false,
    status: 'ACTIVE',
    revision: 4,
    archivedAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    createdById: 'u1',
    updatedById: 'u1',
    boundTypes: [],
    boundGroups: [],
    stepCount: 3,
    publishedVersionNo: 2,
    draftVersionNo: null,
    ...over,
  };
}

export function stepDto(over: Partial<StepDto> = {}): StepDto {
  return {
    stepKey: 's1',
    order: 0,
    name: 'Tiếp nhận',
    description: null,
    durationValue: 3,
    durationUnit: 'DAY',
    anchor: 'RECEIVED',
    rollToWorkingDay: true,
    redDays: 1,
    yellowDays: 2,
    greenDays: 3,
    legalBasis: 'TT 28/2020',
    legalDocNumber: null,
    legalDocUrl: null,
    setsRecordDeadline: false,
    requiresApproval: false,
    maxExtensions: 0,
    extensionValue: null,
    extensionUnit: null,
    escalateAfterDays: null,
    escalateLeadershipAfterDays: null,
    legalVerifiedAt: null,
    legalVerifiedById: null,
    parties: [{ partyKind: 'RECORD_TEAM', teamId: null, role: 'MAIN', note: null, teamName: null, teamStatus: null }],
    variants: [],
    ...over,
  };
}

export function versionSummary(over: Partial<VersionSummaryDto> = {}): VersionSummaryDto {
  return {
    id: 'v1',
    versionNo: 1,
    status: 'DRAFT',
    revision: 7,
    note: null,
    publishedAt: null,
    publishedById: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    stepCount: 1,
    ...over,
  };
}

export function version(over: Partial<VersionDto> = {}, steps: StepDto[] = [stepDto()]): VersionDto {
  return { ...versionSummary({ stepCount: steps.length, ...over }), steps };
}

/** A flow with a draft and nothing published. */
export function detail(over: Partial<FlowDetailDto> = {}): FlowDetailDto {
  const draft = version({ id: 'v1', versionNo: 1, status: 'DRAFT', revision: 7 });
  return {
    ...summary({ publishedVersionNo: null, draftVersionNo: 1, stepCount: 1 }),
    versions: [versionSummary({ id: 'v1', versionNo: 1, status: 'DRAFT', revision: 7 })],
    draft,
    published: null,
    ...over,
  };
}

/** A flow whose version 2 is published and which has no draft. */
export function detailPublished(over: Partial<FlowDetailDto> = {}): FlowDetailDto {
  const published = version({ id: 'v2', versionNo: 2, status: 'PUBLISHED', revision: 3, publishedAt: '2026-11-05T03:00:00.000Z', publishedById: 'u1' });
  return {
    ...summary({ publishedVersionNo: 2, draftVersionNo: null, stepCount: 1 }),
    versions: [versionSummary({ id: 'v2', versionNo: 2, status: 'PUBLISHED', revision: 3, publishedAt: '2026-11-05T03:00:00.000Z', publishedById: 'u1' })],
    draft: null,
    published,
    ...over,
  };
}
