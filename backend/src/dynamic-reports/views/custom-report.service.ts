import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AggregateService } from '../aggregate/aggregate.service';
import { itemKeyOf, ownedKeys } from '../aggregate/contributors';
import type { SummaryMode } from '../aggregate/contributors';
import { criteriaGroupsOf } from '../config/report-config.service';
import { buildCustomWorkbook, CustomFileTooLargeError } from '../export/custom-workbook';
import { sanitizeFileNamePart } from '../export-filename.util';
import { buildCustomSummary } from './custom-summary';
import type { CustomSummary, CustomSummaryOptions } from './custom-summary';
import { looseDefinition, readStoredItemKeys, readStoredTeamIds, teamIdsOf } from './report-view';
import type { ViewDefinition, ViewDefinitionInput } from './report-view';
import { VIEW_ERROR, viewErrorToHttp } from './report-views.service';
import type { ViewActor } from './report-views.service';

/** The same life as every other export of a period. */
const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;

export const CUSTOM_REPORT_ERROR = {
  PERIOD_NOT_FOUND: 'PERIOD_NOT_FOUND',
  CUSTOM_REPORT_TOO_LARGE: 'CUSTOM_REPORT_TOO_LARGE',
  PERIOD_TEAMS_CHANGED: 'PERIOD_TEAMS_CHANGED',
} as const;

export interface CustomReportRequest {
  /** A saved view of the period's report. */
  viewId?: string | null;
  /** What to use instead of (or without) a saved view: the builder's unsaved state. Wins over the view when both come. */
  definition?: ViewDefinitionInput | null;
  /** The calculation mode of the aggregate screen. A closed period always reports its approved figures. */
  mode?: SummaryMode | null;
}

export interface CustomReportPreview extends CustomSummary {
  periodId: string;
  reportId: string;
  viewId: string | null;
}

export interface CustomReportExportResult {
  exportId: string;
  fileName: string;
}

/**
 * The custom report of ONE period: the preview on the screen and the Excel file.
 *
 * Both are made from the same `buildCustomSummary` call on the same loaded data (`summarise` below), so the file
 * cannot show a figure the preview did not. For a manager or an admin of the report, like exporting the period;
 * anybody else is told the period does not exist.
 */
@Injectable()
export class CustomReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregate: AggregateService,
    private readonly audit: AuditService,
  ) {}

  async preview(periodId: string, actor: ViewActor, request: CustomReportRequest): Promise<CustomReportPreview> {
    // A selection of which nothing is left in this period is still answered: the screen shows what was left out.
    const { summary, period, view } = await this.summarise(periodId, actor, request, { allowNothingLeft: true });
    return { ...summary, periodId, reportId: period.reportId, viewId: view?.id ?? null };
  }

  /** Stores the file as an export of the period; it is taken through the existing download of exports. */
  async export(periodId: string, actor: ViewActor, request: CustomReportRequest): Promise<CustomReportExportResult> {
    // No file is made of nothing: a selection with no criterion or no team left is refused.
    const { summary, titleTyped, period, view } = await this.summarise(periodId, actor, request, { allowNothingLeft: false });

    let fileBuffer: Buffer;
    try {
      fileBuffer = await buildCustomWorkbook(summary);
    } catch (err) {
      if (err instanceof CustomFileTooLargeError) {
        throw new BadRequestException({ code: CUSTOM_REPORT_ERROR.CUSTOM_REPORT_TOO_LARGE });
      }
      throw err;
    }
    // Named after the saved view, else the title typed, else the report (marked as a custom one).
    const stem = view?.name ?? titleTyped;
    const fileName = stem
      ? `${sanitizeFileNamePart(stem)}-${period.periodKey}.xlsx`
      : `${sanitizeFileNamePart(period.report.name)}-${period.periodKey}-tuy-chon.xlsx`;

    // The teams the file was made from: what the download checks again (a team left out is not part of it).
    const teamIds = summary.teams.map((t) => t.teamId);
    const selected = new Set(teamIds);
    const contributorSetHash = this.aggregate.contributorSetHashOf(
      { ...period, assignments: period.assignments.filter((a) => selected.has(a.teamId)) },
      summary.mode,
    );
    const assignmentIdsAtRead = period.assignments.map((a) => a.id).sort().join(',');

    const exportRow = await this.prisma.$transaction(async (tx) => {
      // Same guard as the export of a period: deleting the report takes the period FOR UPDATE, so either this row
      // lands before the delete (which then removes it) or the period is gone and nothing is written.
      const alive = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM dyn_report_periods WHERE id = ${periodId} FOR SHARE
      `;
      if (alive.length === 0) throw new NotFoundException({ code: CUSTOM_REPORT_ERROR.PERIOD_NOT_FOUND });
      const nowIds = (await tx.dynReportAssignment.findMany({ where: { periodId }, select: { id: true } }))
        .map((a) => a.id)
        .sort()
        .join(',');
      if (nowIds !== assignmentIdsAtRead) throw new ConflictException({ code: CUSTOM_REPORT_ERROR.PERIOD_TEAMS_CHANGED });

      const created = await tx.dynReportExport.create({
        data: {
          requestedById: actor.id,
          kind: 'MANAGER_CUSTOM',
          scope: { periodId, reportId: period.reportId, viewId: view?.id ?? null, mode: summary.mode, teamIds },
          status: 'READY',
          fileBytes: fileBuffer as unknown as Uint8Array<ArrayBuffer>,
          fileName,
          contributorSetHash,
          expiresAt: new Date(Date.now() + EXPORT_TTL_MS),
        },
        select: { id: true },
      });
      await this.audit.log(
        {
          userId: actor.id,
          action: 'DYN_REPORT_VIEW_EXPORT',
          subject: 'DynReportExport',
          subjectId: created.id,
          // Metadata only: what was exported and how much of it. Never a figure.
          metadata: {
            reportId: period.reportId,
            periodId,
            periodKey: period.periodKey,
            viewId: view?.id ?? null,
            viewName: view?.name ?? null,
            mode: summary.mode,
            criteria: summary.counts.criteria.selected,
            teams: summary.counts.teams.selected,
            fileName,
          },
        },
        tx,
      );
      return created;
    });
    return { exportId: exportRow.id, fileName };
  }

  /** Loads the period, decides the definition and the mode, and builds THE summary both callers use. */
  private async summarise(periodId: string, actor: ViewActor, request: CustomReportRequest, options: CustomSummaryOptions) {
    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: periodId },
      include: {
        report: { select: { name: true } },
        version: { omit: { fileBytes: true, sourceFileBytes: true }, include: { fields: true } },
        assignments: { include: { submission: true } },
      },
    });
    // 404, not 403: a period the caller does not manage looks like one that does not exist.
    const role = period ? await this.aggregate.accessRoleFor(period.reportId, actor.id, actor.roleId) : null;
    if (!period || !role || role.role === 'VIEWER') {
      throw new NotFoundException({ code: CUSTOM_REPORT_ERROR.PERIOD_NOT_FOUND });
    }

    const view = request.viewId
      ? await this.prisma.dynReportView.findFirst({ where: { id: request.viewId, reportId: period.reportId } })
      : null;
    if (request.viewId && !view) throw new NotFoundException({ code: VIEW_ERROR.VIEW_NOT_FOUND });

    let definition: ViewDefinition;
    let knownItemKeysAtSave: string[] | null = null;
    if (request.definition) {
      try {
        definition = looseDefinition(request.definition);
      } catch (err) {
        throw viewErrorToHttp(err);
      }
    } else if (view) {
      const stored = readStoredItemKeys(view.itemKeys);
      knownItemKeysAtSave = stored.known;
      definition = {
        title: view.title,
        showFilterLine: view.showFilterLine,
        itemKeys: stored.selected,
        teamIds: readStoredTeamIds(teamIdsOf(view)),
        teamColumns: view.teamColumns,
      };
    } else {
      definition = looseDefinition({});
    }

    // A closed period reports its official figures: the approved teams', whatever the screen was showing.
    const mode: SummaryMode = period.status === 'FINALIZED' ? 'APPROVED' : (request.mode ?? 'SUBMITTED');

    const rowOf = (address: string) => Number(/\d+$/.exec(address)?.[0] ?? 0);
    const fields = [...period.version.fields]
      .sort((a, b) => a.sheetKey.localeCompare(b.sheetKey) || rowOf(a.address) - rowOf(b.address) || a.address.localeCompare(b.address))
      .map((f) => ({
        fieldKey: f.fieldKey,
        itemKey: itemKeyOf(f),
        code: f.criterionCode,
        label: f.label,
        unit: f.unit,
        type: f.type,
        aggregate: f.aggregate,
        blankPolicy: f.blankPolicy,
        parentItemKey: f.parentItemKey,
      }));
    const inOrder = await this.aggregate.assignmentsInTeamOrder(period.assignments);
    const teams = inOrder.map((a) => ({
      teamId: a.teamId,
      name: (a.teamSnapshot as { name?: string } | null)?.name || a.teamId,
      obligation: a.obligation,
      state: a.submission?.state ?? 'NOT_STARTED',
      ownedFieldKeys: ownedKeys(a),
      values: Object.fromEntries(
        Object.entries((a.submission?.values ?? {}) as Record<string, { v: string | null } | undefined>).map(
          ([key, cell]) => [key, cell?.v ?? null],
        ),
      ),
    }));

    // Teams the selection names that this period does not have: named in the answer when they belong to the report.
    const inPeriod = new Set(teams.map((t) => t.teamId));
    const absent = (teamIdsOf(definition) ?? []).filter((id) => !inPeriod.has(id));
    const otherTeamNames = await this.namesOfReportTeams(period.reportId, absent);

    let built: CustomSummary;
    try {
      built = buildCustomSummary(
        {
          reportName: period.report.name,
          periodKey: period.periodKey,
          periodStatus: period.status,
          mode,
          fields,
          // A report made from an Excel template has no headings of this kind: plain rows.
          groups: period.version.sourceKind === 'CRITERIA' ? criteriaGroupsOf(period.version.sourceSelection) : [],
          teams,
          definition,
          knownItemKeysAtSave,
          otherTeamNames,
        },
        options,
      );
    } catch (err) {
      throw viewErrorToHttp(err);
    }
    return { summary: built, titleTyped: definition.title, period, view };
  }

  /**
   * The names of the teams among `teamIds` that belong to THIS report, by id. A team belongs to it when it has an
   * assignment in any of the report's periods (it is then named as the most recent of those periods knew it) or is one
   * of the report's targets. Any other id gets no name: a manager of one report is not told what a team is called
   * just for knowing its id.
   */
  private async namesOfReportTeams(reportId: string, teamIds: readonly string[]): Promise<Record<string, string>> {
    if (teamIds.length === 0) return {};
    const ids = [...new Set(teamIds)];
    const names: Record<string, string> = {};

    const assignments = await this.prisma.dynReportAssignment.findMany({
      where: { teamId: { in: ids }, period: { reportId } },
      orderBy: [{ period: { startDate: 'desc' } }, { createdAt: 'desc' }],
      select: { teamId: true, teamSnapshot: true },
    });
    const ofReport = new Set<string>();
    for (const assignment of assignments) {
      ofReport.add(assignment.teamId);
      const name = (assignment.teamSnapshot as { name?: unknown } | null)?.name;
      // The first one met is the most recent period's.
      if (names[assignment.teamId] === undefined && typeof name === 'string' && name !== '') names[assignment.teamId] = name;
    }

    const targets = await this.prisma.dynReportTarget.findMany({
      where: { reportId, teamId: { in: ids } },
      select: { teamId: true, team: { select: { name: true } } },
    });
    for (const target of targets) {
      ofReport.add(target.teamId);
      if (names[target.teamId] === undefined) names[target.teamId] = target.team.name;
    }

    // A team of the report whose snapshot carries no name (and which is not a target): its present name.
    const unnamed = [...ofReport].filter((id) => names[id] === undefined);
    if (unnamed.length > 0) {
      const found = await this.prisma.team.findMany({ where: { id: { in: unnamed } }, select: { id: true, name: true } });
      for (const t of found) names[t.id] = t.name;
    }
    return names;
  }
}
