import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type LoaiDon } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { LOAI_DANH_MUC_LOAI_THONG_TIN, khoaLoaiThongTin } from '../../common/utils/khoa-loai-thong-tin.util';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { CRIME_GRAVITIES, DEADLINE_GROUPS, PROCESSING_ERROR, RECORD_KINDS, type ProcessingErrorCode } from '../contract/processing-codes';
import { civilDayFromIso, civilDayOf, civilYearOf } from '../engine/civil-day';
import { buildWorkingCalendar, MAX_CALENDAR_YEAR, MIN_CALENDAR_YEAR } from '../engine/working-calendar';
import { ANCHOR_KEYS, type AnchorKey, type RecordKind } from '../gateway/record-snapshot';
import { enqueueDeadlineResync } from '../records/deadline-resync';
import {
  FlowShapeError,
  legalFingerprint,
  normaliseSteps,
  type FlowMatch,
  type FlowStatus,
  type FlowStep,
  type FlowStepParty,
  type FlowVersionStatus,
} from './flow-steps';
import { legalTemplate, LEGAL_TEMPLATES, type LegalTemplate } from './legal-templates';
import { previewSchedule, type SampleAnchors, type SampleConditions } from './preview-schedule';
import { findBindingConflicts, lockFlowKind } from './binding-conflicts';
import { readResolveConfig, STEP_INCLUDE, toFlowStep, type StepRow } from './flow-reader';
import { resolveFlow } from './resolve-flow';
import { validateSteps, type StepIssue } from './validate-steps';

export const MAX_FLOW_NAME = 200;
const MAX_FLOW_TEXT = 4_000;

// ---- what the routes answer

export interface BoundTypeDto {
  directoryId: string;
  /** The entry as it is named today. */
  name: string;
  code: string;
  isActive: boolean;
  /** The merged key the entry had when it was bound. */
  typeKey: string | null;
  /** The merged key of its name today. */
  currentTypeKey: string;
  /** The entry was renamed since it was bound: text written the old way and the new way both reach this flow. */
  renamed: boolean;
}

export interface VersionSummaryDto {
  id: string;
  versionNo: number;
  status: FlowVersionStatus;
  revision: number;
  note: string | null;
  publishedAt: string | null;
  publishedById: string | null;
  createdAt: string;
  stepCount: number;
}

export interface StepPartyDto extends FlowStepParty {
  /** The name and state of the named unit, as they are now; `null` for "the unit holding the record". */
  teamName: string | null;
  teamStatus: string | null;
}

export interface StepDto extends Omit<FlowStep, 'stepKey' | 'parties'> {
  stepKey: string;
  order: number;
  legalVerifiedAt: string | null;
  legalVerifiedById: string | null;
  parties: StepPartyDto[];
}

export interface VersionDto extends VersionSummaryDto {
  steps: StepDto[];
}

export interface FlowSummaryDto {
  id: string;
  recordKind: RecordKind;
  name: string;
  description: string | null;
  isDefault: boolean;
  status: FlowStatus;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  updatedById: string;
  boundTypes: BoundTypeDto[];
  /** Deadline groups of a petition (`LoaiDon`). */
  boundGroups: string[];
  /** The steps of the published version; of the draft while nothing is published. */
  stepCount: number;
  publishedVersionNo: number | null;
  draftVersionNo: number | null;
}

export interface FlowDetailDto extends FlowSummaryDto {
  /** Newest first. */
  versions: VersionSummaryDto[];
  draft: VersionDto | null;
  published: VersionDto | null;
}

export interface FlowResolutionDto {
  match: FlowMatch | null;
  flowId: string | null;
  flowName?: string;
  /** `null`: the flow has no published version yet, so no record can follow it. */
  publishedVersionNo?: number | null;
  directoryId?: string;
  typeKey?: string;
}

export interface SchedulePreviewDto {
  steps: Array<{
    stepIndex: number;
    stepKey: string | null;
    startAt: string | null;
    dueAt: string | null;
    provisional: boolean;
    greenFrom: string | null;
    yellowFrom: string | null;
    redFrom: string | null;
    variant: string | null;
    problem: ProcessingErrorCode | null;
  }>;
  recordDeadline: string | null;
  provisional: boolean;
  /** What would stop these steps from being published. */
  issues: StepIssue[];
}

// ---- what the routes take

export interface CreateFlowInput {
  name?: string | null;
  recordKind: RecordKind;
  description?: string | null;
  isDefault?: boolean;
  /** Start from the steps of the latest version of this flow (under new step keys). */
  copyFromFlowId?: string | null;
  /** Start from a template of the legal catalogue. */
  templateKey?: string | null;
}

/** Only what is present is changed; `description: null` clears it. */
export interface UpdateFlowInput {
  name?: string | null;
  description?: string | null;
  isDefault?: boolean;
  expectedRevision: number;
}

export interface SetBindingsInput {
  directoryIds: readonly string[];
  deadlineGroups: readonly string[];
  expectedRevision: number;
}

export interface ReplaceStepsInput {
  steps: unknown;
  /** The revision of the VERSION the steps were looked at. */
  expectedRevision: number;
}

export interface PreviewScheduleInput {
  recordKind: unknown;
  steps: unknown;
  /** `{ RECEIVED: '2026-03-02' }`: a calendar day, or an ISO instant with its offset for a date that carries a time. */
  anchors?: unknown;
  /** `{ CRIME_GRAVITY: 'NGHIEM_TRONG' }` */
  conditions?: unknown;
}

// ---- rows

type Tx = Prisma.TransactionClient;

const SUMMARY_INCLUDE = {
  bindings: { include: { directory: { select: { id: true, name: true, code: true, isActive: true } } }, orderBy: { createdAt: 'asc' } },
  versions: {
    select: {
      id: true,
      versionNo: true,
      status: true,
      revision: true,
      note: true,
      publishedAt: true,
      publishedById: true,
      createdAt: true,
      _count: { select: { steps: true } },
    },
    orderBy: { versionNo: 'desc' },
  },
} satisfies Prisma.ProcFlowInclude;

type FlowRow = Prisma.ProcFlowGetPayload<object>;
type SummaryRow = Prisma.ProcFlowGetPayload<{ include: typeof SUMMARY_INCLUDE }>;
type VersionRow = Prisma.ProcFlowVersionGetPayload<object>;

/** A step ready to be written: complete, with its key and its confirmation. */
type StoredStep = FlowStep & { stepKey: string; legalVerifiedAt: Date | null; legalVerifiedById: string | null };

const refuse = {
  bad: (code: ProcessingErrorCode, details?: unknown) => new BadRequestException({ code, ...(details === undefined ? {} : { details }) }),
  conflict: (code: ProcessingErrorCode, details?: unknown) => new ConflictException({ code, ...(details === undefined ? {} : { details }) }),
  notFound: (code: ProcessingErrorCode) => new NotFoundException({ code }),
};

const cleanText = (text: string | null | undefined): string | null => {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  return trimmed === '' ? null : trimmed;
};

const isRecordKind = (value: unknown): value is RecordKind => typeof value === 'string' && (RECORD_KINDS as readonly string[]).includes(value);
const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];
const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
/** How many years past the last sample date the calendar is read for: longer than any chain of steps a flow holds. */
const PREVIEW_YEARS_AHEAD = 20;

/**
 * The flow configuration: flows per record kind, what each is bound to, their versions and steps.
 *
 * Rules that span the flows of a record kind (one default flow, one name, one flow per information type and per
 * deadline group, all among the flows that are not archived) are checked under an advisory lock per record kind, taken
 * first by every write of a flow row or of its bindings. Everything about the versions of ONE flow (one draft, one
 * published version, a published version never changes) is checked under a row lock on the flow, which the writes
 * above take too, after the kind lock. Every write is one transaction and leaves its audit row inside it (which flow,
 * which version, counts; never what a step says). Refusals are `{ code }` objects; no display text travels.
 */
@Injectable()
export class ProcessingFlowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly calendars: WorkingCalendarService,
  ) {}

  // ---- reading

  /** In use first, archived after; by record kind and name inside each. No steps: see `get`. */
  async list(opts: { recordKind?: RecordKind; includeArchived: boolean }): Promise<FlowSummaryDto[]> {
    if (opts.recordKind !== undefined && !isRecordKind(opts.recordKind)) throw refuse.bad(PROCESSING_ERROR.RECORD_KIND_INVALID);
    const rows = await this.prisma.procFlow.findMany({
      where: { ...(opts.recordKind ? { recordKind: opts.recordKind } : {}), ...(opts.includeArchived ? {} : { status: 'ACTIVE' }) },
      include: SUMMARY_INCLUDE,
      orderBy: [{ recordKind: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });
    return [...rows.filter((row) => row.status === 'ACTIVE'), ...rows.filter((row) => row.status !== 'ACTIVE')].map(toSummary);
  }

  /** The flow with its bindings, its versions, and the steps of its draft and of its published version. */
  async get(id: string): Promise<FlowDetailDto> {
    const row = await this.prisma.procFlow.findUnique({ where: { id }, include: SUMMARY_INCLUDE });
    if (!row) throw refuse.notFound(PROCESSING_ERROR.FLOW_NOT_FOUND);
    const shown = row.versions.filter((version) => version.status === 'DRAFT' || version.status === 'PUBLISHED');
    const steps = shown.length
      ? await this.prisma.procFlowStep.findMany({
          where: { versionId: { in: shown.map((version) => version.id) } },
          include: STEP_INCLUDE,
          orderBy: { order: 'asc' },
        })
      : [];
    const versions = row.versions.map(toVersionSummary);
    const withSteps = (status: FlowVersionStatus): VersionDto | null => {
      const version = versions.find((candidate) => candidate.status === status);
      return version ? { ...version, steps: steps.filter((step) => step.versionId === version.id).map(toStepDto) } : null;
    };
    return { ...toSummary(row), versions, draft: withSteps('DRAFT'), published: withSteps('PUBLISHED') };
  }

  /** The templates a flow can be started from. Pure data. */
  templates(): readonly LegalTemplate[] {
    return LEGAL_TEMPLATES;
  }

  /** The flow a record of this kind and information type follows, as the configuration stands now. */
  async resolve(recordKind: unknown, informationType: string | null | undefined): Promise<FlowResolutionDto> {
    if (!isRecordKind(recordKind)) throw refuse.bad(PROCESSING_ERROR.RECORD_KIND_INVALID);
    const config = await readResolveConfig(this.prisma, recordKind);
    const found = resolveFlow({ recordKind, informationType }, config);
    if (!found) return { match: null, flowId: null };
    const flow = config.flows.find((candidate) => candidate.id === found.flowId);
    return { ...found, flowName: flow?.name, publishedVersionNo: flow?.versions[0]?.versionNo ?? null };
  }

  /** The deadlines the steps sent would get on an imagined record, on the working calendar as stored. Writes nothing. */
  async previewSchedule(input: PreviewScheduleInput): Promise<SchedulePreviewDto> {
    if (!isRecordKind(input.recordKind)) throw refuse.bad(PROCESSING_ERROR.RECORD_KIND_INVALID);
    const steps = this.shaped(input.steps);
    const anchors = readSampleAnchors(input.anchors);
    const conditions = readSampleConditions(input.conditions);

    const years = Object.values(anchors).map((anchor) => civilYearOf(civilDayOf(anchor.at)));
    const calendar = years.length
      ? await this.calendars.load(Math.min(...years), Math.min(Math.max(...years) + PREVIEW_YEARS_AHEAD, MAX_CALENDAR_YEAR))
      : buildWorkingCalendar([]);
    const preview = previewSchedule(steps, anchors, calendar, conditions);
    return {
      steps: preview.steps.map((row) => ({
        ...row,
        startAt: iso(row.startAt),
        dueAt: iso(row.dueAt),
        greenFrom: iso(row.greenFrom),
        yellowFrom: iso(row.yellowFrom),
        redFrom: iso(row.redFrom),
      })),
      recordDeadline: iso(preview.recordDeadline),
      provisional: preview.provisional,
      issues: validateSteps(steps, input.recordKind),
    };
  }

  // ---- the flow itself

  /**
   * A new flow, in use, with a DRAFT version 1: empty, or holding the steps of a template or of another flow's latest
   * version. Copied steps get NEW keys (a step key is the identity of a step inside ONE flow) and are not verified.
   */
  async create(actorId: string, input: CreateFlowInput): Promise<FlowDetailDto> {
    if (!isRecordKind(input.recordKind)) throw refuse.bad(PROCESSING_ERROR.RECORD_KIND_INVALID);
    const { recordKind } = input;
    const name = this.checkedName(input.name);
    const description = this.checkedText(input.description);
    const copyFromFlowId = cleanText(input.copyFromFlowId);
    const templateKey = cleanText(input.templateKey);
    if (copyFromFlowId && templateKey) throw refuse.bad(PROCESSING_ERROR.FLOW_SOURCE_AMBIGUOUS);

    let fromTemplate: FlowStep[] | null = null;
    if (templateKey) {
      const template = legalTemplate(templateKey);
      if (!template) throw refuse.bad(PROCESSING_ERROR.TEMPLATE_UNKNOWN);
      if (template.recordKind !== recordKind) throw refuse.bad(PROCESSING_ERROR.SOURCE_KIND_MISMATCH);
      fromTemplate = normaliseSteps(template.steps);
    }

    const id = await this.prisma.$transaction(async (tx) => {
      await this.lockKind(tx, recordKind);
      await this.assertNameFree(tx, recordKind, name, null);
      if (input.isDefault === true) await this.assertNoDefault(tx, recordKind, null);

      let steps: FlowStep[] = fromTemplate ?? [];
      if (copyFromFlowId) {
        const source = await tx.procFlow.findUnique({ where: { id: copyFromFlowId }, select: { recordKind: true } });
        if (!source) throw refuse.notFound(PROCESSING_ERROR.FLOW_SOURCE_NOT_FOUND);
        if (source.recordKind !== recordKind) throw refuse.bad(PROCESSING_ERROR.SOURCE_KIND_MISMATCH);
        const latest = await tx.procFlowVersion.findFirst({ where: { flowId: copyFromFlowId }, orderBy: { versionNo: 'desc' }, select: { id: true } });
        steps = latest ? (await this.stepsOf(tx, latest.id)).map(toFlowStep) : [];
      }

      const flow = await tx.procFlow.create({
        data: { recordKind, name, description, isDefault: input.isDefault === true, createdById: actorId, updatedById: actorId },
      });
      const version = await tx.procFlowVersion.create({ data: { flowId: flow.id, versionNo: 1, createdById: actorId } });
      await this.writeSteps(tx, version.id, steps.map((step) => ({ ...step, stepKey: randomUUID(), legalVerifiedAt: null, legalVerifiedById: null })));
      await this.logFlow(tx, 'PROC_FLOW_CREATE', actorId, flow, {
        source: templateKey ? 'TEMPLATE' : copyFromFlowId ? 'COPY' : 'EMPTY',
        ...(templateKey ? { templateKey } : {}),
        ...(copyFromFlowId ? { copyFromFlowId } : {}),
        steps: steps.length,
      });
      return flow.id;
    });
    return this.get(id);
  }

  async update(id: string, actorId: string, input: UpdateFlowInput): Promise<FlowDetailDto> {
    this.assertRevisionGiven(input.expectedRevision);
    const name = input.name === undefined ? undefined : this.checkedName(input.name);
    const description = input.description === undefined ? undefined : this.checkedText(input.description);
    const recordKind = await this.kindOf(id);

    await this.prisma.$transaction(async (tx) => {
      await this.lockKind(tx, recordKind);
      const current = await this.lockedFlow(tx, id);
      if (current.revision !== input.expectedRevision) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      if (current.status === 'ARCHIVED') throw refuse.conflict(PROCESSING_ERROR.FLOW_ARCHIVED);
      if (name !== undefined && name !== current.name) await this.assertNameFree(tx, recordKind, name, id);
      if (input.isDefault === true && !current.isDefault) await this.assertNoDefault(tx, recordKind, id);
      const updated = await tx.procFlow.update({
        where: { id },
        data: {
          ...(name === undefined ? {} : { name }),
          ...(description === undefined ? {} : { description }),
          ...(typeof input.isDefault === 'boolean' ? { isDefault: input.isDefault } : {}),
          revision: { increment: 1 },
          updatedById: actorId,
        },
      });
      await this.logFlow(tx, 'PROC_FLOW_UPDATE', actorId, updated);
    });
    return this.get(id);
  }

  /**
   * Replaces ALL the bindings of the flow: what is not sent is removed. A binding that stays keeps the key it was made
   * with. Among the flows in use, an information type and a deadline group belong to one flow per record kind.
   */
  async setBindings(id: string, actorId: string, input: SetBindingsInput): Promise<FlowDetailDto> {
    this.assertRevisionGiven(input.expectedRevision);
    const directoryIds = unique(input.directoryIds);
    const deadlineGroups = unique(input.deadlineGroups);
    if (deadlineGroups.some((group) => !(DEADLINE_GROUPS as readonly string[]).includes(group))) throw refuse.bad(PROCESSING_ERROR.GROUP_UNKNOWN);
    const recordKind = await this.kindOf(id);
    // A deadline group is a notion of petitions; no other kind of record has one.
    if (deadlineGroups.length > 0 && recordKind !== 'PETITION') throw refuse.bad(PROCESSING_ERROR.GROUP_NOT_FOR_KIND);

    await this.prisma.$transaction(async (tx) => {
      await this.lockKind(tx, recordKind);
      const current = await this.lockedFlow(tx, id);
      if (current.revision !== input.expectedRevision) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      if (current.status === 'ARCHIVED') throw refuse.conflict(PROCESSING_ERROR.FLOW_ARCHIVED);

      const entries = directoryIds.length
        ? await tx.directory.findMany({ where: { id: { in: directoryIds }, type: LOAI_DANH_MUC_LOAI_THONG_TIN }, select: { id: true, name: true } })
        : [];
      const unknown = directoryIds.filter((directoryId) => !entries.some((entry) => entry.id === directoryId));
      if (unknown.length > 0) throw refuse.bad(PROCESSING_ERROR.TYPE_UNKNOWN, unknown);

      const existing = await tx.procFlowBinding.findMany({ where: { flowId: id } });
      const wantedTypes = directoryIds.map((directoryId) => {
        const kept = existing.find((binding) => binding.directoryId === directoryId);
        const entry = entries.find((candidate) => candidate.id === directoryId);
        return { directoryId, typeKey: kept ? kept.typeKey : khoaLoaiThongTin(entry?.name) || null, kept: kept !== undefined };
      });
      await this.assertBindingsFree(tx, recordKind, id, wantedTypes, deadlineGroups);

      const removed = existing.filter(
        (binding) =>
          (binding.directoryId !== null && !directoryIds.includes(binding.directoryId)) ||
          (binding.deadlineGroup !== null && !deadlineGroups.includes(binding.deadlineGroup)),
      );
      if (removed.length > 0) await tx.procFlowBinding.deleteMany({ where: { id: { in: removed.map((binding) => binding.id) } } });
      const added = [
        ...wantedTypes.filter((wanted) => !wanted.kept).map((wanted) => ({ flowId: id, recordKind, directoryId: wanted.directoryId, typeKey: wanted.typeKey })),
        ...deadlineGroups
          .filter((group) => !existing.some((binding) => binding.deadlineGroup === group))
          .map((group) => ({ flowId: id, recordKind, deadlineGroup: group as LoaiDon })),
      ];
      if (added.length > 0) await tx.procFlowBinding.createMany({ data: added });

      const updated = await tx.procFlow.update({ where: { id }, data: { revision: { increment: 1 }, updatedById: actorId } });
      await this.logFlow(tx, 'PROC_FLOW_BINDINGS_SET', actorId, updated, {
        types: directoryIds.length,
        groups: deadlineGroups,
        added: added.length,
        removed: removed.length,
      });
    });
    return this.get(id);
  }

  /** Out of use: its name, its default mark and what it is bound to become free. Nothing is lost: `restore` brings it back. */
  async archive(id: string, actorId: string, expectedRevision: number): Promise<FlowDetailDto> {
    this.assertRevisionGiven(expectedRevision);
    const recordKind = await this.kindOf(id);
    await this.prisma.$transaction(async (tx) => {
      await this.lockKind(tx, recordKind);
      const current = await this.lockedFlow(tx, id);
      if (current.revision !== expectedRevision) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      if (current.status === 'ARCHIVED') throw refuse.conflict(PROCESSING_ERROR.FLOW_ALREADY_ARCHIVED);
      const updated = await tx.procFlow.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date(), revision: { increment: 1 }, updatedById: actorId },
      });
      await this.logFlow(tx, 'PROC_FLOW_ARCHIVE', actorId, updated);
    });
    return this.get(id);
  }

  /**
   * The other way of archiving. Refused when what the flow held was taken while it was away: its name, the default
   * mark of its record kind, or one of its bindings. The flow in use has to give it up first.
   */
  async restore(id: string, actorId: string, expectedRevision: number): Promise<FlowDetailDto> {
    this.assertRevisionGiven(expectedRevision);
    const recordKind = await this.kindOf(id);
    await this.prisma.$transaction(async (tx) => {
      await this.lockKind(tx, recordKind);
      const current = await this.lockedFlow(tx, id);
      if (current.revision !== expectedRevision) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      if (current.status !== 'ARCHIVED') throw refuse.conflict(PROCESSING_ERROR.FLOW_NOT_ARCHIVED);
      await this.assertNameFree(tx, recordKind, current.name, id);
      if (current.isDefault) await this.assertNoDefault(tx, recordKind, id);
      const bindings = await tx.procFlowBinding.findMany({ where: { flowId: id }, orderBy: { createdAt: 'asc' } });
      await this.assertBindingsFree(
        tx,
        recordKind,
        id,
        bindings.flatMap((binding) => (binding.directoryId ? [{ directoryId: binding.directoryId, typeKey: binding.typeKey }] : [])),
        bindings.flatMap((binding) => (binding.deadlineGroup ? [binding.deadlineGroup] : [])),
      );
      const updated = await tx.procFlow.update({
        where: { id },
        data: { status: 'ACTIVE', archivedAt: null, revision: { increment: 1 }, updatedById: actorId },
      });
      await this.logFlow(tx, 'PROC_FLOW_RESTORE', actorId, updated);
    });
    return this.get(id);
  }

  /**
   * Gone for good, with its bindings, versions and steps. Only a flow that NEVER had a published version: records may
   * follow a published version, so such a flow is archived instead (`FLOW_IN_USE`). The name of the flow must be typed
   * back as `confirmName`.
   */
  async remove(id: string, actorId: string, opts: { expectedRevision: number; confirmName: string | undefined }): Promise<{ deleted: true; id: string }> {
    this.assertRevisionGiven(opts.expectedRevision);
    const recordKind = await this.kindOf(id);
    await this.prisma.$transaction(async (tx) => {
      await this.lockKind(tx, recordKind);
      const current = await this.lockedFlow(tx, id);
      if (current.revision !== opts.expectedRevision) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      const versions = await tx.procFlowVersion.findMany({ where: { flowId: id }, select: { id: true, status: true, publishedAt: true } });
      if (versions.some((version) => version.status !== 'DRAFT' || version.publishedAt !== null)) throw refuse.conflict(PROCESSING_ERROR.FLOW_IN_USE);
      if (opts.confirmName !== current.name) throw refuse.bad(PROCESSING_ERROR.CONFIRMATION_MISMATCH);

      // Children first, deepest first: every relation is RESTRICT, so the order is the whole of it.
      const versionIds = versions.map((version) => version.id);
      const steps = await this.deleteStepsOf(tx, versionIds);
      await tx.procFlowVersion.deleteMany({ where: { flowId: id } });
      const bindings = await tx.procFlowBinding.deleteMany({ where: { flowId: id } });
      await tx.procFlow.delete({ where: { id } });
      await this.logFlow(tx, 'PROC_FLOW_DELETE', actorId, current, { versions: versions.length, steps, bindings: bindings.count });
    });
    return { deleted: true, id };
  }

  // ---- versions and steps

  /**
   * A new DRAFT: a copy of the published version under the SAME step keys (and with what was verified), or empty when
   * nothing is published. A flow has one draft at a time.
   */
  async createDraft(flowId: string, actorId: string): Promise<FlowDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const flow = await this.lockedFlow(tx, flowId);
      if (flow.status === 'ARCHIVED') throw refuse.conflict(PROCESSING_ERROR.FLOW_ARCHIVED);
      const versions = await tx.procFlowVersion.findMany({ where: { flowId }, select: { id: true, versionNo: true, status: true } });
      if (versions.some((version) => version.status === 'DRAFT')) throw refuse.conflict(PROCESSING_ERROR.DRAFT_ALREADY_EXISTS);
      const published = versions.find((version) => version.status === 'PUBLISHED');
      const steps = published ? (await this.stepsOf(tx, published.id)).map(toStoredStep) : [];
      const version = await tx.procFlowVersion.create({
        data: { flowId, versionNo: Math.max(0, ...versions.map((candidate) => candidate.versionNo)) + 1, createdById: actorId },
      });
      await this.writeSteps(tx, version.id, steps);
      await this.logVersion(tx, 'PROC_FLOW_VERSION_CREATE', actorId, version, { steps: steps.length, copiedFromVersionNo: published?.versionNo ?? null });
    });
    return this.get(flowId);
  }

  /**
   * Replaces ALL the steps of a draft; their order is the order sent. A step sent with its `stepKey` keeps it (and its
   * legal confirmation, as long as the figures confirmed are unchanged); a step sent without one gets a new key.
   *
   * Refused outright only when the steps cannot be stored (`STEPS_INVALID`, `TEAM_UNKNOWN`, `STEP_KEY_UNKNOWN`). Steps
   * that break a rule of a flow are saved; what would stop them from being published comes back as `warnings`.
   */
  async replaceSteps(flowId: string, versionId: string, actorId: string, input: ReplaceStepsInput): Promise<{ flow: FlowDetailDto; warnings: StepIssue[] }> {
    this.assertRevisionGiven(input.expectedRevision);
    const steps = this.shaped(input.steps);

    const warnings = await this.prisma.$transaction(async (tx) => {
      const flow = await this.lockedFlow(tx, flowId);
      const version = await this.versionOf(tx, flowId, versionId);
      if (version.status !== 'DRAFT') throw refuse.conflict(PROCESSING_ERROR.VERSION_IMMUTABLE);
      if (version.revision !== input.expectedRevision) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      if (flow.status === 'ARCHIVED') throw refuse.conflict(PROCESSING_ERROR.FLOW_ARCHIVED);

      // Two variants for one condition cannot be stored (one row per condition of a step): said as a bad request here,
      // before any write, and not as the database's refusal of the unique index.
      const duplicates = steps.flatMap((step, stepIndex) => {
        const seen = new Set<string>();
        return step.variants.flatMap((variant, variantIndex) => {
          const condition = `${variant.conditionKey}=${variant.conditionValue}`;
          if (!seen.has(condition)) {
            seen.add(condition);
            return [];
          }
          return [{ stepIndex, field: `variants.${variantIndex}.conditionValue` }];
        });
      });
      if (duplicates.length > 0) throw refuse.bad(PROCESSING_ERROR.STEPS_INVALID, duplicates);

      const teamIds = unique(steps.flatMap((step) => step.parties.flatMap((party) => (party.teamId ? [party.teamId] : []))));
      const teams = teamIds.length ? await tx.team.findMany({ where: { id: { in: teamIds } }, select: { id: true } }) : [];
      const unknownTeams = teamIds.filter((teamId) => !teams.some((team) => team.id === teamId));
      if (unknownTeams.length > 0) throw refuse.bad(PROCESSING_ERROR.TEAM_UNKNOWN, unknownTeams);

      // A key is the identity of a step inside this flow: one that no version of the flow has ever held is not one.
      const sentKeys = steps.flatMap((step) => (step.stepKey ? [step.stepKey] : []));
      const knownKeys = sentKeys.length
        ? await tx.procFlowStep.findMany({ where: { stepKey: { in: sentKeys }, version: { flowId } }, select: { stepKey: true }, distinct: ['stepKey'] })
        : [];
      const unknownKeys = sentKeys.filter((key) => !knownKeys.some((known) => known.stepKey === key));
      if (unknownKeys.length > 0) throw refuse.bad(PROCESSING_ERROR.STEP_KEY_UNKNOWN, unknownKeys);

      const before = new Map((await this.stepsOf(tx, versionId)).map((row) => [row.stepKey, toStoredStep(row)]));
      const stored = steps.map((step): StoredStep => {
        const was = step.stepKey ? before.get(step.stepKey) : undefined;
        const confirmed = was !== undefined && legalFingerprint(was) === legalFingerprint(step);
        return {
          ...step,
          stepKey: step.stepKey ?? randomUUID(),
          legalVerifiedAt: confirmed ? was.legalVerifiedAt : null,
          legalVerifiedById: confirmed ? was.legalVerifiedById : null,
        };
      });

      await this.deleteStepsOf(tx, [versionId]);
      await this.writeSteps(tx, versionId, stored);
      const updated = await tx.procFlowVersion.update({ where: { id: versionId }, data: { revision: { increment: 1 } } });
      await this.logVersion(tx, 'PROC_FLOW_STEPS_SAVE', actorId, updated, { steps: stored.length });
      return validateSteps(stored, flow.recordKind);
    });
    return { flow: await this.get(flowId), warnings };
  }

  /**
   * Throws a draft away. `expectedRevision` is the revision of the draft the person looked at: a draft somebody saved
   * since is not thrown away under them (`REVISION_CONFLICT`).
   */
  async deleteDraft(flowId: string, versionId: string, actorId: string, expectedRevision: number): Promise<FlowDetailDto> {
    this.assertRevisionGiven(expectedRevision);
    await this.prisma.$transaction(async (tx) => {
      await this.lockedFlow(tx, flowId);
      const version = await this.versionOf(tx, flowId, versionId);
      if (version.status !== 'DRAFT') throw refuse.conflict(PROCESSING_ERROR.VERSION_IMMUTABLE);
      if (version.revision !== expectedRevision) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      const steps = await this.deleteStepsOf(tx, [versionId]);
      await tx.procFlowVersion.delete({ where: { id: versionId } });
      await this.logVersion(tx, 'PROC_FLOW_VERSION_DELETE', actorId, version, { steps });
    });
    return this.get(flowId);
  }

  /**
   * Makes a draft the version records follow. It must break no rule of a flow (`FLOW_INVALID` lists them all) and
   * name only units that are active. The version published before it becomes SUPERSEDED. From here on the version
   * never changes: a correction is a new draft.
   */
  async publish(flowId: string, versionId: string, actorId: string, expectedRevision: number): Promise<FlowDetailDto> {
    this.assertRevisionGiven(expectedRevision);
    await this.retryingOnDeadlock(() => this.publishOnce(flowId, versionId, actorId, expectedRevision));
    return this.get(flowId);
  }

  /**
   * A publish that the database picked to break a lock cycle with a team merge or switch-off (they lock units and
   * then reparent their children) wrote nothing: it is run again from the start, a few times, and only then told to
   * the caller as a conflict.
   */
  private async retryingOnDeadlock(work: () => Promise<void>): Promise<void> {
    const attempts = 3;
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await work();
      } catch (error) {
        const failure = error as { code?: string; meta?: { code?: string }; message?: string };
        const deadlock = failure.code === 'P2034' || (failure.code === 'P2010' && failure.meta?.code === '40P01') || /deadlock detected/i.test(failure.message ?? '');
        if (!deadlock) throw error;
        if (attempt >= attempts) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      }
    }
  }

  private async publishOnce(flowId: string, versionId: string, actorId: string, expectedRevision: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const flow = await this.lockedFlow(tx, flowId);
      const version = await this.versionOf(tx, flowId, versionId);
      if (version.status !== 'DRAFT') throw refuse.conflict(PROCESSING_ERROR.VERSION_IMMUTABLE);
      if (version.revision !== expectedRevision) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      if (flow.status === 'ARCHIVED') throw refuse.conflict(PROCESSING_ERROR.FLOW_ARCHIVED);

      const rows = await this.stepsOf(tx, versionId);
      const steps = rows.map(toStoredStep);
      const issues = validateSteps(steps, flow.recordKind);
      if (issues.length > 0) throw refuse.bad(PROCESSING_ERROR.FLOW_INVALID, issues);

      // The units are locked, in one order, and their status is read AFTER the lock: a unit that is being switched off
      // or merged (both take the row FOR UPDATE) is waited for, and a publish never rests on a status that has moved on.
      const unitIds = unique(rows.flatMap((row) => row.parties.flatMap((party) => (party.teamId ? [party.teamId] : [])))).sort();
      const statusOf = new Map<string, string>();
      if (unitIds.length > 0) {
        const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
          SELECT id, status::text AS status FROM teams WHERE id IN (${Prisma.join(unitIds)}) ORDER BY id FOR SHARE`;
        for (const unit of locked) statusOf.set(unit.id, unit.status);
      }
      const idle = rows.flatMap((row, stepIndex) =>
        row.parties.flatMap((party) => (party.teamId && statusOf.get(party.teamId) !== 'ACTIVE' ? [{ stepIndex, stepKey: row.stepKey, teamId: party.teamId }] : [])),
      );
      if (idle.length > 0) throw refuse.bad(PROCESSING_ERROR.TEAM_NOT_ACTIVE, idle);

      // The one before first: a flow never holds two published versions, not even inside this transaction.
      const previous = await tx.procFlowVersion.findFirst({ where: { flowId, status: 'PUBLISHED' }, select: { id: true, versionNo: true } });
      if (previous) await tx.procFlowVersion.update({ where: { id: previous.id }, data: { status: 'SUPERSEDED', revision: { increment: 1 } } });
      const updated = await tx.procFlowVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLISHED', publishedAt: new Date(), publishedById: actorId, revision: { increment: 1 } },
      });
      await this.logVersion(tx, 'PROC_FLOW_VERSION_PUBLISH', actorId, updated, { steps: steps.length, supersededVersionNo: previous?.versionNo ?? null });
    });
  }

  /**
   * A person compared the figures of a step with the source text. Allowed on a published version too: it records a
   * human check, it does not change the rule.
   */
  verifyLegal(flowId: string, versionId: string, stepKey: string, actorId: string, expectedRevision: number): Promise<FlowDetailDto> {
    return this.stampLegal(flowId, versionId, stepKey, actorId, true, expectedRevision);
  }

  /** The way back from `verifyLegal`. */
  unverifyLegal(flowId: string, versionId: string, stepKey: string, actorId: string, expectedRevision: number): Promise<FlowDetailDto> {
    return this.stampLegal(flowId, versionId, stepKey, actorId, false, expectedRevision);
  }

  /**
   * `expectedRevision` is the revision of the version the person compared with the source text. The stamp says "these
   * figures were checked": figures saved after that look are not the ones that were checked, so a stale revision is
   * refused instead of stamped.
   */
  private async stampLegal(flowId: string, versionId: string, stepKey: string, actorId: string, verified: boolean, expectedRevision: number): Promise<FlowDetailDto> {
    this.assertRevisionGiven(expectedRevision);
    await this.prisma.$transaction(async (tx) => {
      const flow = await this.lockedFlow(tx, flowId);
      const version = await this.versionOf(tx, flowId, versionId);
      if (flow.status === 'ARCHIVED') throw refuse.conflict(PROCESSING_ERROR.FLOW_ARCHIVED);
      if (version.revision !== expectedRevision) throw refuse.conflict(PROCESSING_ERROR.REVISION_CONFLICT);
      // A superseded version is history: nothing follows it any more, and nothing about it is restated.
      if (version.status === 'SUPERSEDED') throw refuse.conflict(PROCESSING_ERROR.VERSION_IMMUTABLE);
      const step = await tx.procFlowStep.findUnique({ where: { versionId_stepKey: { versionId, stepKey } } });
      if (!step) throw refuse.notFound(PROCESSING_ERROR.FLOW_STEP_NOT_FOUND);
      if (verified) {
        if (!cleanText(step.legalBasis)) throw refuse.bad(PROCESSING_ERROR.LEGAL_BASIS_REQUIRED);
        if (step.legalVerifiedAt !== null) throw refuse.conflict(PROCESSING_ERROR.LEGAL_ALREADY_VERIFIED);
      } else if (step.legalVerifiedAt === null) throw refuse.conflict(PROCESSING_ERROR.LEGAL_NOT_VERIFIED);

      await tx.procFlowStep.update({
        where: { id: step.id },
        data: verified ? { legalVerifiedAt: new Date(), legalVerifiedById: actorId } : { legalVerifiedAt: null, legalVerifiedById: null },
      });
      // The revision moves on: somebody editing this draft meanwhile is told, instead of saving over the stamp.
      const updated = await tx.procFlowVersion.update({ where: { id: versionId }, data: { revision: { increment: 1 } } });
      await this.logVersion(tx, verified ? 'PROC_FLOW_STEP_LEGAL_VERIFY' : 'PROC_FLOW_STEP_LEGAL_UNVERIFY', actorId, updated, { stepKey });

      // Records already following this version: from now on the flow keeps their deadline (when this is the step that
      // sets it), so their column is brought in line, by the outbox worker and not in this transaction. Only a
      // PUBLISHED version has records; a draft's stamp reaches records when they get the version, at application.
      //
      // Taking a verification back writes NO job: an unverified step stops writing the deadline of a record, and a
      // deadline already written is not taken back silently (the value it replaced may be older than what people have
      // done since). The column keeps what it holds and can be typed again, as for any record the flow does not keep.
      if (verified && version.status === 'PUBLISHED' && step.setsRecordDeadline) await enqueueDeadlineResync(tx, flow.recordKind, versionId);
    });
    return this.get(flowId);
  }

  // ---- shared

  private assertRevisionGiven(revision: unknown): void {
    if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) throw refuse.bad(PROCESSING_ERROR.EXPECTED_REVISION_INVALID);
  }

  private checkedName(raw: string | null | undefined): string {
    const name = cleanText(raw)?.replace(/\s+/g, ' ') ?? '';
    if (name === '' || name.length > MAX_FLOW_NAME) throw refuse.bad(PROCESSING_ERROR.FLOW_NAME_REQUIRED);
    return name;
  }

  private checkedText(raw: string | null | undefined): string | null {
    const text = cleanText(raw);
    return text === null ? null : text.slice(0, MAX_FLOW_TEXT);
  }

  /** Steps as sent, complete; a shape that is not steps becomes a 400 that says where. */
  private shaped(raw: unknown): FlowStep[] {
    try {
      return normaliseSteps(raw);
    } catch (error) {
      if (error instanceof FlowShapeError) throw refuse.bad(PROCESSING_ERROR.STEPS_INVALID, error.details);
      throw error;
    }
  }

  /** The record kind of a flow never changes, so it can be read before any lock, to know WHICH lock to take. */
  private async kindOf(id: string): Promise<RecordKind> {
    const flow = await this.prisma.procFlow.findUnique({ where: { id }, select: { recordKind: true } });
    if (!flow) throw refuse.notFound(PROCESSING_ERROR.FLOW_NOT_FOUND);
    return flow.recordKind;
  }

  /** Held to the end of the transaction: one writer at a time for the flows of this record kind. */
  private async lockKind(tx: Tx, recordKind: RecordKind): Promise<void> {
    await lockFlowKind(tx, recordKind);
  }

  /** The flow as it is NOW, under a row lock held to the end of the transaction. */
  private async lockedFlow(tx: Tx, id: string): Promise<FlowRow> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM proc_flows WHERE id = ${id} FOR UPDATE`;
    if (locked.length === 0) throw refuse.notFound(PROCESSING_ERROR.FLOW_NOT_FOUND);
    return tx.procFlow.findUniqueOrThrow({ where: { id } });
  }

  private async versionOf(tx: Tx, flowId: string, versionId: string): Promise<VersionRow> {
    const version = await tx.procFlowVersion.findUnique({ where: { id: versionId } });
    if (!version || version.flowId !== flowId) throw refuse.notFound(PROCESSING_ERROR.FLOW_VERSION_NOT_FOUND);
    return version;
  }

  private async assertNameFree(tx: Tx, recordKind: RecordKind, name: string, exceptId: string | null): Promise<void> {
    const taken = await tx.procFlow.findFirst({
      where: { recordKind, name, status: 'ACTIVE', ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (taken) throw refuse.conflict(PROCESSING_ERROR.FLOW_NAME_TAKEN);
  }

  private async assertNoDefault(tx: Tx, recordKind: RecordKind, exceptId: string | null): Promise<void> {
    const holder = await tx.procFlow.findFirst({
      where: { recordKind, isDefault: true, status: 'ACTIVE', ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true, name: true },
    });
    if (holder) throw refuse.conflict(PROCESSING_ERROR.DEFAULT_FLOW_EXISTS, { flowId: holder.id, name: holder.name });
  }

  /**
   * None of these types and groups is held by ANOTHER flow in use of the record kind (see `findBindingConflicts`:
   * the same entry, the same key at binding time, or the same key today after a rename).
   */
  private async assertBindingsFree(
    tx: Tx,
    recordKind: RecordKind,
    flowId: string,
    types: ReadonlyArray<{ directoryId: string; typeKey: string | null }>,
    groups: readonly string[],
  ): Promise<void> {
    const conflicts = await findBindingConflicts(tx, recordKind, flowId, types, groups);
    if (conflicts.length > 0) throw refuse.conflict(PROCESSING_ERROR.TYPE_ALREADY_BOUND, conflicts);
  }

  private stepsOf(tx: Tx, versionId: string): Promise<StepRow[]> {
    return tx.procFlowStep.findMany({ where: { versionId }, include: STEP_INCLUDE, orderBy: { order: 'asc' } });
  }

  /** The order of the list is the order of the steps. */
  private async writeSteps(tx: Tx, versionId: string, steps: readonly StoredStep[]): Promise<void> {
    for (const [order, step] of steps.entries()) {
      await tx.procFlowStep.create({
        data: {
          versionId,
          stepKey: step.stepKey,
          order,
          name: step.name,
          description: step.description,
          durationValue: step.durationValue,
          durationUnit: step.durationUnit,
          anchor: step.anchor,
          rollToWorkingDay: step.rollToWorkingDay,
          redDays: step.redDays,
          yellowDays: step.yellowDays,
          greenDays: step.greenDays,
          legalBasis: step.legalBasis,
          legalDocNumber: step.legalDocNumber,
          legalDocUrl: step.legalDocUrl,
          legalVerifiedAt: step.legalVerifiedAt,
          legalVerifiedById: step.legalVerifiedById,
          setsRecordDeadline: step.setsRecordDeadline,
          requiresApproval: step.requiresApproval,
          maxExtensions: step.maxExtensions,
          extensionValue: step.extensionValue,
          extensionUnit: step.extensionUnit,
          escalateAfterDays: step.escalateAfterDays,
          escalateLeadershipAfterDays: step.escalateLeadershipAfterDays,
          parties: {
            create: step.parties.map((party, index) => ({ partyKind: party.partyKind, teamId: party.teamId, role: party.role, note: party.note, order: index })),
          },
          variants: {
            create: step.variants.map((variant) => ({
              conditionKey: variant.conditionKey,
              conditionValue: variant.conditionValue,
              durationValue: variant.durationValue,
              durationUnit: variant.durationUnit,
              maxExtensions: variant.maxExtensions,
              extensionValue: variant.extensionValue,
              extensionUnit: variant.extensionUnit,
            })),
          },
        },
      });
    }
  }

  /** Variants and parties, then the steps: every relation is RESTRICT. Returns how many steps went. */
  private async deleteStepsOf(tx: Tx, versionIds: readonly string[]): Promise<number> {
    if (versionIds.length === 0) return 0;
    const ofVersions = { versionId: { in: [...versionIds] } };
    await tx.procFlowStepVariant.deleteMany({ where: { step: ofVersions } });
    await tx.procFlowStepParty.deleteMany({ where: { step: ofVersions } });
    return (await tx.procFlowStep.deleteMany({ where: ofVersions })).count;
  }

  private logFlow(tx: Tx, action: string, actorId: string, flow: FlowRow, extra: Record<string, unknown> = {}): Promise<void> {
    return this.audit.log(
      {
        userId: actorId,
        action,
        subject: 'ProcFlow',
        subjectId: flow.id,
        // Metadata only: which flow and its state. Never a description, a step or a legal text.
        metadata: { recordKind: flow.recordKind, name: flow.name, isDefault: flow.isDefault, status: flow.status, revision: flow.revision, ...extra },
      },
      tx,
    );
  }

  private logVersion(tx: Tx, action: string, actorId: string, version: VersionRow, extra: Record<string, unknown> = {}): Promise<void> {
    return this.audit.log(
      {
        userId: actorId,
        action,
        subject: 'ProcFlowVersion',
        subjectId: version.id,
        metadata: { flowId: version.flowId, versionNo: version.versionNo, status: version.status, revision: version.revision, ...extra },
      },
      tx,
    );
  }
}

// ---- rows to answers

function toVersionSummary(version: SummaryRow['versions'][number]): VersionSummaryDto {
  return {
    id: version.id,
    versionNo: version.versionNo,
    status: version.status,
    revision: version.revision,
    note: version.note,
    publishedAt: iso(version.publishedAt),
    publishedById: version.publishedById,
    createdAt: version.createdAt.toISOString(),
    stepCount: version._count.steps,
  };
}

function toSummary(row: SummaryRow): FlowSummaryDto {
  const published = row.versions.find((version) => version.status === 'PUBLISHED');
  const draft = row.versions.find((version) => version.status === 'DRAFT');
  const boundTypes = row.bindings
    .flatMap((binding): BoundTypeDto[] => {
      if (!binding.directory) return [];
      const currentTypeKey = khoaLoaiThongTin(binding.directory.name);
      return [
        {
          directoryId: binding.directory.id,
          name: binding.directory.name,
          code: binding.directory.code,
          isActive: binding.directory.isActive,
          typeKey: binding.typeKey,
          currentTypeKey,
          renamed: binding.typeKey !== null && binding.typeKey !== currentTypeKey,
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const groups = row.bindings.flatMap((binding) => (binding.deadlineGroup ? [binding.deadlineGroup as string] : []));
  return {
    id: row.id,
    recordKind: row.recordKind,
    name: row.name,
    description: row.description,
    isDefault: row.isDefault,
    status: row.status,
    revision: row.revision,
    archivedAt: iso(row.archivedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdById: row.createdById,
    updatedById: row.updatedById,
    boundTypes,
    boundGroups: DEADLINE_GROUPS.filter((group) => groups.includes(group)),
    stepCount: (published ?? draft)?._count.steps ?? 0,
    publishedVersionNo: published?.versionNo ?? null,
    draftVersionNo: draft?.versionNo ?? null,
  };
}

function toStoredStep(row: StepRow): StoredStep {
  return { ...toFlowStep(row), stepKey: row.stepKey, legalVerifiedAt: row.legalVerifiedAt, legalVerifiedById: row.legalVerifiedById };
}

function toStepDto(row: StepRow): StepDto {
  return {
    ...toFlowStep(row),
    stepKey: row.stepKey,
    order: row.order,
    legalVerifiedAt: iso(row.legalVerifiedAt),
    legalVerifiedById: row.legalVerifiedById,
    parties: row.parties.map((party) => ({
      partyKind: party.partyKind,
      teamId: party.teamId,
      teamName: party.team?.name ?? null,
      teamStatus: party.team?.status ?? null,
      role: party.role,
      note: party.note,
    })),
  };
}

// ---- the sample of a preview

function readSampleAnchors(raw: unknown): SampleAnchors {
  const invalid = () => refuse.bad(PROCESSING_ERROR.PREVIEW_ANCHORS_INVALID);
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw invalid();
  const anchors: SampleAnchors = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!(ANCHOR_KEYS as readonly string[]).includes(key) || typeof value !== 'string') throw invalid();
    let anchor: { at: Date; hasTime: boolean };
    if (ISO_DAY.test(value)) {
      if (Number.isNaN(civilDayFromIso(value))) throw invalid();
      // As a date column stores it: the calendar day at 00:00 UTC.
      anchor = { at: new Date(`${value}T00:00:00.000Z`), hasTime: false };
    } else if (ISO_INSTANT.test(value) && !Number.isNaN(new Date(value).getTime())) {
      anchor = { at: new Date(value), hasTime: true };
    } else throw invalid();
    const year = anchor.at.getUTCFullYear();
    if (year < MIN_CALENDAR_YEAR + 1 || year > MAX_CALENDAR_YEAR - 1) throw invalid();
    anchors[key as AnchorKey] = anchor;
  }
  return anchors;
}

function readSampleConditions(raw: unknown): SampleConditions {
  if (raw === undefined || raw === null) return {};
  const invalid = () => refuse.bad(PROCESSING_ERROR.PREVIEW_ANCHORS_INVALID);
  if (typeof raw !== 'object' || Array.isArray(raw)) throw invalid();
  const conditions: SampleConditions = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key !== 'CRIME_GRAVITY' || typeof value !== 'string' || !(CRIME_GRAVITIES as readonly string[]).includes(value)) throw invalid();
    conditions.CRIME_GRAVITY = value;
  }
  return conditions;
}
