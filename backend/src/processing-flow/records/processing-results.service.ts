import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OPINION_KINDS, PROCESSING_ERROR, PROPOSAL_KINDS, type ProcessingErrorCode } from '../contract/processing-codes';
import type { RecordKind } from '../gateway/record-snapshot';
import { ProcessingCommandService, type CommandInput } from './processing-command.service';
import type { RecordFlowDto } from './record-flow.dto';
import { REPORTING_ROLES, loadRolePartiesAt, mayDecide, mayGiveOpinion, mayReport, opinionNeedsHead, roleOfOpinion, stepRolesOf, type StepRoles } from './step-roles';

type Tx = Prisma.TransactionClient;

const MAX_TEXT = 20_000;
const MAX_DOCUMENTS = 50;
const MAX_DOCUMENT_FIELD = 200;

const refuse = {
  bad: (code: ProcessingErrorCode) => new BadRequestException({ code }),
  conflict: (code: ProcessingErrorCode) => new ConflictException({ code }),
  notFound: (code: ProcessingErrorCode) => new NotFoundException({ code }),
  forbidden: (code: ProcessingErrorCode) => new ForbiddenException({ code }),
};

export interface ReportInput {
  doneWork: string;
  findings?: string | null;
  difficulties?: string | null;
  proposalKind?: string | null;
  proposalContent?: string | null;
  proposalBasis?: string | null;
  documents?: Array<{ type?: string; number?: string; date?: string }> | null;
}

export interface SubmitReportInput extends CommandInput, ReportInput {
  kind: 'PROGRESS' | 'RESULT';
}

export type OpinionKind = (typeof OPINION_KINDS)[number];

export interface ResultsDto {
  reports: Array<ReportInput & { id: string; kind: string; authorId: string; authorName: string | null; authorTeamId: string | null; revision: number; withdrawnAt: string | null; supersededAt: string | null; createdAt: string; answered: boolean; attachments: ReportAttachment[] }>;
  opinions: Array<{ id: string; kind: string; verdict: string; content: string | null; reportId: string | null; reportRevision: number | null; authorId: string; authorName: string | null; authorTeamId: string | null; withdrawnAt: string | null; createdAt: string }>;
}

/** A file attached to a report (a `Document` of the record), as the book of a step lists it. */
export interface ReportAttachment {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
  uploaderName: string | null;
}

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

/**
 * What the people around a step write and decide: the unit's reports (progress, result, with a proposal), the opinions
 * of the head of the unit, of the units that coordinate or check, and the leader's approval of a result.
 *
 * WHO may write is judged here, from the step: a report needs a unit that is a party of THIS step (MAIN or COORDINATE),
 * an opinion needs the role it speaks as (SUPERVISOR: the head of the unit that works it; COORDINATE; CHECK). The route
 * adds the permission (`report`, `opine`, `approve`) and the record's readability; neither is enough alone.
 *
 * The step follows the result: a result reported on a step that asks for approval makes it REPORTED, the leader's
 * agreement finishes it, a disagreement (or a check asking for rework) sends it back to OPEN; a result on a step that
 * asks for no approval finishes it. Everything is written under the record's lock, with the revision of the record's
 * flow, an idempotency key if the client sends one, the history and an audit row (metadata only).
 */
@Injectable()
export class ProcessingResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: ProcessingCommandService,
  ) {}

  // ---- reading

  /** The book of a step: its reports and opinions, oldest first, withdrawn ones marked. */
  async results(kind: RecordKind, recordId: string, stepKey: string): Promise<ResultsDto> {
    const step = await this.prisma.procRecordStep.findFirst({ where: { recordKind: kind, recordId, stepKey }, select: { id: true } });
    if (!step) throw refuse.notFound(PROCESSING_ERROR.RECORD_STEP_NOT_FOUND);
    const [reports, opinions, answered] = await Promise.all([
      this.prisma.procStepReport.findMany({ where: { recordStepId: step.id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.procStepOpinion.findMany({ where: { recordStepId: step.id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.procStepOpinion.findMany({ where: { recordStepId: step.id, withdrawnAt: null, reportId: { not: null } }, select: { reportId: true } }),
    ]);
    const answeredIds = new Set(answered.map((row) => row.reportId));
    const names = await this.namesOf([...reports.map((r) => r.authorId), ...opinions.map((o) => o.authorId)]);
    const attachments = await this.attachmentsOf(this.prisma, reports.map((r) => r.id));
    return {
      reports: reports.map((r) => ({
        id: r.id,
        kind: r.kind,
        doneWork: r.doneWork,
        findings: r.findings,
        difficulties: r.difficulties,
        proposalKind: r.proposalKind,
        proposalContent: r.proposalContent,
        proposalBasis: r.proposalBasis,
        documents: (r.documents as ReportInput['documents']) ?? null,
        authorId: r.authorId,
        authorName: names.get(r.authorId) ?? null,
        authorTeamId: r.authorTeamId,
        revision: r.revision,
        withdrawnAt: iso(r.withdrawnAt),
        supersededAt: iso(r.supersededAt),
        createdAt: r.createdAt.toISOString(),
        answered: answeredIds.has(r.id),
        attachments: attachments[reports.indexOf(r)],
      })),
      opinions: opinions.map((o) => ({
        id: o.id,
        kind: o.kind,
        verdict: o.verdict,
        content: o.content,
        reportId: o.reportId,
        reportRevision: o.reportRevision,
        authorId: o.authorId,
        authorName: names.get(o.authorId) ?? null,
        authorTeamId: o.authorTeamId,
        withdrawnAt: iso(o.withdrawnAt),
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  /** The files attached to each of these reports (not deleted), oldest first; one list per report, in the order asked. */
  async attachmentsOf(db: Tx | PrismaService, reportIds: string[]): Promise<ReportAttachment[][]> {
    if (reportIds.length === 0) return [];
    const rows = await db.document.findMany({
      where: { procStepReportId: { in: reportIds }, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, originalName: true, size: true, createdAt: true, procStepReportId: true, uploadedBy: { select: { firstName: true, lastName: true, username: true } } },
    });
    return reportIds.map((reportId) =>
      rows
        .filter((row) => row.procStepReportId === reportId)
        .map((row) => ({
          id: row.id,
          fileName: row.originalName,
          size: row.size,
          uploadedAt: row.createdAt.toISOString(),
          uploaderName: [row.uploadedBy.firstName, row.uploadedBy.lastName].filter(Boolean).join(' ').trim() || row.uploadedBy.username,
        })),
    );
  }

  private async namesOf(ids: string[]): Promise<Map<string, string>> {
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, firstName: true, lastName: true, username: true } });
    return new Map(users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username]));
  }

  // ---- reports

  /** A unit reports on a step it is a party of. A RESULT also moves the step (see the class). */
  async submitReport(actorId: string, kind: RecordKind, recordId: string, stepKey: string, input: SubmitReportInput): Promise<RecordFlowDto> {
    const fields = checkedReport(kind, input);
    if (input.kind !== 'PROGRESS' && input.kind !== 'RESULT') throw refuse.bad(PROCESSING_ERROR.REPORT_TEXT_REQUIRED);
    return this.commands.writeStep(kind, recordId, actorId, stepKey, 'REPORT', input, async (tx, flow, step) => {
      const roles = await this.rolesOf(tx, step.id, actorId);
      if (!mayReport(roles)) throw refuse.forbidden(PROCESSING_ERROR.NOT_A_PARTY_OF_STEP);
      this.commands.actOnBehalf(tx, roles.onBehalfOf(REPORTING_ROLES));
      if (step.status !== 'OPEN') throw refuse.conflict(PROCESSING_ERROR.STEP_NOT_OPEN);
      // Only ONE result stands: an earlier one (after a disagreement or a request for rework) stays in the book, superseded.
      if (input.kind === 'RESULT') await tx.procStepReport.updateMany({ where: { recordStepId: step.id, kind: 'RESULT', withdrawnAt: null, supersededAt: null }, data: { supersededAt: this.commands.now() } });
      const report = await tx.procStepReport.create({ data: { recordStepId: step.id, recordKind: kind, recordId, kind: input.kind, ...fields, authorId: actorId, authorTeamId: roles.teamOf(REPORTING_ROLES) } });
      await this.commands.change(tx, flow, step.stepKey, input.kind === 'RESULT' ? 'RESULT_REPORTED' : 'PROGRESS_REPORTED', null, { reportId: report.id, hasProposal: fields.proposalKind !== null }, null, actorId);
      if (input.kind !== 'RESULT') return;
      // The result of the step: it waits for the leader, or finishes the step.
      if (step.step.requiresApproval) await this.commands.moveStep(tx, flow, step, 'REPORT', null, actorId);
      else await this.commands.finishStep(tx, flow, step, 'COMPLETE', actorId);
    });
  }

  /** The author corrects a report nobody has answered, while the step is still being worked. */
  async editReport(actorId: string, kind: RecordKind, recordId: string, stepKey: string, reportId: string, input: CommandInput & ReportInput): Promise<RecordFlowDto> {
    const fields = checkedReport(kind, input);
    return this.commands.writeStep(kind, recordId, actorId, stepKey, 'EDIT_REPORT', input, async (tx, flow, step) => {
      await this.assertReporter(tx, step.id, actorId);
      const report = await this.ownReport(tx, step.id, reportId, actorId);
      if (step.status !== 'OPEN') throw refuse.conflict(PROCESSING_ERROR.STEP_NOT_OPEN);
      await tx.procStepReport.update({ where: { id: report.id }, data: { ...fields, revision: { increment: 1 } } });
      await this.commands.change(tx, flow, step.stepKey, 'REPORT_EDITED', { revision: report.revision }, { revision: report.revision + 1 }, null, actorId);
    });
  }

  /**
   * The author takes a report back. It stays in the book, marked. A result that was waiting for the leader, and that
   * nobody has answered, takes the step back to OPEN with it.
   */
  async withdrawReport(actorId: string, kind: RecordKind, recordId: string, stepKey: string, reportId: string, input: CommandInput): Promise<RecordFlowDto> {
    return this.commands.writeStep(kind, recordId, actorId, stepKey, 'WITHDRAW_REPORT', input, async (tx, flow, step) => {
      await this.assertReporter(tx, step.id, actorId);
      const report = await this.ownReport(tx, step.id, reportId, actorId);
      if (step.status !== 'OPEN' && !(step.status === 'REPORTED' && report.kind === 'RESULT')) throw refuse.conflict(PROCESSING_ERROR.STEP_NOT_OPEN);
      await tx.procStepReport.update({ where: { id: report.id }, data: { withdrawnAt: this.commands.now() } });
      await this.commands.change(tx, flow, step.stepKey, 'REPORT_WITHDRAWN', { reportId: report.id }, null, null, actorId);
      // Only the standing result moves the step: an earlier one that a later result replaced is long gone from it.
      if (step.status === 'REPORTED' && report.kind === 'RESULT') await this.commands.moveStep(tx, flow, step, 'RETURN', 'The result was withdrawn', actorId);
    });
  }

  /** The caller must still be a unit that works the step (or coordinates it): leaving the unit ends the right to touch what it wrote. */
  async assertReporter(tx: Tx, stepId: string, actorId: string): Promise<void> {
    const roles = await this.rolesOf(tx, stepId, actorId);
    if (!mayReport(roles)) throw refuse.forbidden(PROCESSING_ERROR.NOT_A_PARTY_OF_STEP);
    this.commands.actOnBehalf(tx, roles.onBehalfOf(REPORTING_ROLES));
  }

  /** The report of the caller, standing (not withdrawn, not replaced) and unanswered. */
  async ownReport(tx: Tx, stepId: string, reportId: string, actorId: string) {
    const report = await tx.procStepReport.findFirst({ where: { id: reportId, recordStepId: stepId } });
    if (!report || report.withdrawnAt || report.supersededAt) throw refuse.notFound(PROCESSING_ERROR.REPORT_NOT_FOUND);
    if (report.authorId !== actorId) throw refuse.forbidden(PROCESSING_ERROR.REPORT_NOT_YOURS);
    if ((await tx.procStepOpinion.count({ where: { reportId: report.id, withdrawnAt: null } })) > 0) throw refuse.conflict(PROCESSING_ERROR.REPORT_ANSWERED);
    return report;
  }

  // ---- opinions

  /** The head of the unit that works the step, a unit that coordinates, or one that checks, gives its opinion. */
  async addOpinion(
    actorId: string,
    kind: RecordKind,
    recordId: string,
    stepKey: string,
    input: CommandInput & { kind: OpinionKind; verdict?: string; content?: string | null },
  ): Promise<RecordFlowDto> {
    const content = cleanText(input.content);
    // APPROVAL is written by the decision of the leader, NUDGE by the nudge command: neither is an opinion a person files here.
    if (input.kind === 'APPROVAL' || input.kind === 'NUDGE' || !OPINION_KINDS.includes(input.kind)) throw refuse.bad(PROCESSING_ERROR.OPINION_NOT_ALLOWED);
    const verdict = input.verdict ?? 'NOTE';
    const allowed = input.kind === 'CHECK' ? ['NOTE', 'PASS', 'REQUEST_REWORK'] : ['NOTE'];
    if (!allowed.includes(verdict)) throw refuse.bad(PROCESSING_ERROR.VERDICT_INVALID);
    if (verdict === 'NOTE' && !content) throw refuse.bad(PROCESSING_ERROR.REPORT_TEXT_REQUIRED);

    return this.commands.writeStep(kind, recordId, actorId, stepKey, 'OPINION', input, async (tx, flow, step) => {
      const roles = await this.rolesOf(tx, step.id, actorId);
      const role = roleOfOpinion(input.kind);
      if (!mayGiveOpinion(roles, input.kind)) throw refuse.forbidden(PROCESSING_ERROR.OPINION_NOT_ALLOWED);
      this.commands.actOnBehalf(tx, roles.onBehalfOf([role], opinionNeedsHead(input.kind)));
      if (step.status === 'WAITING_ANCHOR' || step.status === 'SKIPPED') throw refuse.conflict(PROCESSING_ERROR.STEP_NOT_OPEN);

      // An opinion about the result names the exact report (and its revision) it was given on.
      const result = await tx.procStepReport.findFirst({ where: { recordStepId: step.id, kind: 'RESULT', withdrawnAt: null, supersededAt: null }, orderBy: { createdAt: 'desc' } });
      if (verdict === 'PASS' && !result) throw refuse.conflict(PROCESSING_ERROR.NO_RESULT_REPORT);
      // A remark made while a result waits for the leader answers THAT result (and protects it from being taken back); a
      // remark on a step still being worked stands alone.
      const about = verdict === 'NOTE' && step.status !== 'REPORTED' ? null : result;
      await tx.procStepOpinion.create({
        data: {
          recordStepId: step.id,
          recordKind: kind,
          recordId,
          kind: input.kind,
          verdict: verdict as never,
          content,
          reportId: about?.id ?? null,
          reportRevision: about?.revision ?? null,
          authorId: actorId,
          authorTeamId: roles.teamOf([role], opinionNeedsHead(input.kind)),
        },
      });
      await this.commands.change(tx, flow, step.stepKey, 'OPINION_GIVEN', null, { kind: input.kind, verdict }, null, actorId);
      // A check that asks for rework sends a result that waits for the leader back to the unit.
      if (verdict === 'REQUEST_REWORK' && step.status === 'REPORTED') await this.commands.moveStep(tx, flow, step, 'RETURN', content, actorId);
    });
  }

  /**
   * The author takes an opinion back while nobody has spoken after it. A decision of the leader cannot be taken back.
   * A nudge that came after it answers nobody: it does not stop the author.
   */
  async withdrawOpinion(actorId: string, kind: RecordKind, recordId: string, stepKey: string, opinionId: string, input: CommandInput): Promise<RecordFlowDto> {
    return this.commands.writeStep(kind, recordId, actorId, stepKey, 'WITHDRAW_OPINION', input, async (tx, flow, step) => {
      const opinion = await tx.procStepOpinion.findFirst({ where: { id: opinionId, recordStepId: step.id } });
      if (!opinion || opinion.withdrawnAt) throw refuse.notFound(PROCESSING_ERROR.OPINION_NOT_FOUND);
      if (opinion.authorId !== actorId) throw refuse.forbidden(PROCESSING_ERROR.OPINION_NOT_YOURS);
      // A nudge cannot be taken back either: the people it pressed have been told, and the words they were told stay.
      if (opinion.kind === 'APPROVAL' || opinion.kind === 'NUDGE') throw refuse.conflict(PROCESSING_ERROR.OPINION_NOT_ALLOWED);
      const roles = await this.rolesOf(tx, step.id, actorId);
      if (!mayGiveOpinion(roles, opinion.kind)) throw refuse.forbidden(PROCESSING_ERROR.OPINION_NOT_ALLOWED);
      this.commands.actOnBehalf(tx, roles.onBehalfOf([roleOfOpinion(opinion.kind)], opinionNeedsHead(opinion.kind)));
      if ((await tx.procStepOpinion.count({ where: { recordStepId: step.id, createdAt: { gt: opinion.createdAt }, withdrawnAt: null, kind: { not: 'NUDGE' } } })) > 0) throw refuse.conflict(PROCESSING_ERROR.OPINION_ANSWERED);
      await tx.procStepOpinion.update({ where: { id: opinion.id }, data: { withdrawnAt: this.commands.now() } });
      await this.commands.change(tx, flow, step.stepKey, 'OPINION_WITHDRAWN', { opinionId: opinion.id }, null, null, actorId);
    });
  }

  /**
   * The leader decides on the result of a step that waits for approval: AGREE finishes the step (and starts the one
   * after it), DISAGREE or OTHER_DIRECTION (a text is required) sends it back to the unit. The decision names the exact
   * report revision it was given on; a report edited since cannot be approved by a decision made on the old words.
   */
  async decide(actorId: string, kind: RecordKind, recordId: string, stepKey: string, input: CommandInput & { verdict: string; content?: string | null }): Promise<RecordFlowDto> {
    const content = cleanText(input.content);
    if (!['AGREE', 'DISAGREE', 'OTHER_DIRECTION'].includes(input.verdict)) throw refuse.bad(PROCESSING_ERROR.VERDICT_INVALID);
    if (input.verdict !== 'AGREE' && !content) throw refuse.bad(PROCESSING_ERROR.REPORT_TEXT_REQUIRED);
    return this.commands.writeStep(kind, recordId, actorId, stepKey, 'DECIDE', input, async (tx, flow, step) => {
      if (!mayDecide(await this.rolesOf(tx, step.id, actorId))) throw refuse.forbidden(PROCESSING_ERROR.OPINION_NOT_ALLOWED);
      if (step.status !== 'REPORTED') throw refuse.conflict(PROCESSING_ERROR.STEP_NOT_REPORTED);
      const result = await tx.procStepReport.findFirst({ where: { recordStepId: step.id, kind: 'RESULT', withdrawnAt: null, supersededAt: null }, orderBy: { createdAt: 'desc' } });
      if (!result) throw refuse.conflict(PROCESSING_ERROR.NO_RESULT_REPORT);
      const teamId = (await tx.userTeam.findFirst({ where: { userId: actorId, team: { status: 'ACTIVE' } }, select: { teamId: true } }))?.teamId ?? null;
      await tx.procStepOpinion.create({
        data: { recordStepId: step.id, recordKind: kind, recordId, kind: 'APPROVAL', verdict: input.verdict as never, content, reportId: result.id, reportRevision: result.revision, authorId: actorId, authorTeamId: teamId },
      });
      await this.commands.change(tx, flow, step.stepKey, 'RESULT_DECIDED', null, { verdict: input.verdict, reportId: result.id, reportRevision: result.revision }, content, actorId);
      if (input.verdict === 'AGREE') await this.commands.finishStep(tx, flow, step, 'APPROVE', actorId);
      else await this.commands.moveStep(tx, flow, step, 'RETURN', content, actorId);
    });
  }

  // ---- who the person is on this step

  /**
   * The roles the person has on ONE step, a delegation in force at the clock of the command included: the rules live in
   * `step-roles.ts`, shared with the DTO's `viewer`.
   */
  private async rolesOf(tx: Tx, stepId: string, userId: string): Promise<StepRoles> {
    return stepRolesOf(await loadRolePartiesAt(tx, [stepId], userId, this.commands.now()));
  }
}

/** A text typed by a person: trimmed, bounded, `null` when empty. */
function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text === '' ? null : text.slice(0, MAX_TEXT);
}

/** The fields of a report, checked: the one required part, a proposal of the record's kind, bounded documents. */
function checkedReport(kind: RecordKind, input: ReportInput) {
  const doneWork = cleanText(input.doneWork);
  if (!doneWork) throw refuse.bad(PROCESSING_ERROR.REPORT_TEXT_REQUIRED);
  const proposalKind = typeof input.proposalKind === 'string' && input.proposalKind.trim() !== '' ? input.proposalKind.trim() : null;
  if (proposalKind !== null && !(PROPOSAL_KINDS[kind] as readonly string[]).includes(proposalKind)) throw refuse.bad(PROCESSING_ERROR.PROPOSAL_KIND_UNKNOWN);
  let documents: Prisma.InputJsonValue | typeof undefined;
  if (input.documents !== undefined && input.documents !== null) {
    if (!Array.isArray(input.documents) || input.documents.length > MAX_DOCUMENTS) throw refuse.bad(PROCESSING_ERROR.DOCUMENTS_INVALID);
    documents = input.documents.map((doc) => {
      const field = (value: unknown) => (typeof value === 'string' ? value.trim().slice(0, MAX_DOCUMENT_FIELD) : '');
      if (typeof doc !== 'object' || doc === null) throw refuse.bad(PROCESSING_ERROR.DOCUMENTS_INVALID);
      return { type: field(doc.type), number: field(doc.number), date: field(doc.date) };
    });
  }
  return {
    doneWork,
    findings: cleanText(input.findings),
    difficulties: cleanText(input.difficulties),
    proposalKind,
    proposalContent: cleanText(input.proposalContent),
    proposalBasis: cleanText(input.proposalBasis),
    documents,
  };
}
