import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { itemKeyOf } from '../aggregate/contributors';
import { sanitizeFileNamePart } from '../export-filename.util';
import {
  buildCriteriaMatrix,
  parseCriteriaMatrix,
  type MatrixCriterion,
  type MatrixError,
  type MatrixTeam,
  type MatrixTeamResult,
} from './criteria-matrix';
import { ReportConfigError } from './report-config.service';
import { ReportConfigUpdateService } from './report-config-update.service';

/** Thrown when an uploaded matrix cannot be used; the screen lists `errors` by their codes. */
export class CriteriaMatrixError extends Error {
  constructor(public readonly errors: MatrixError[]) {
    super('CRITERIA_MATRIX_INVALID');
  }
}

export interface MatrixImportResult {
  applied: boolean;
  configVersion: number;
  teams: MatrixTeamResult[];
}

/**
 * The criteria each team reports, taken out as an Excel sheet and put back. Putting it back goes through the same
 * configuration update as the edit screen (same checks, same revision guard, same rule that a running period keeps
 * what it started with), so the file is only another way to fill that form.
 */
@Injectable()
export class CriteriaMatrixService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly updates: ReportConfigUpdateService,
  ) {}

  async export(reportId: string): Promise<{ fileName: string; fileBuffer: Buffer }> {
    const state = await this.load(reportId);
    return {
      fileName: `${sanitizeFileNamePart(state.reportName)}-ma-tran-tieu-chi.xlsx`,
      fileBuffer: await buildCriteriaMatrix(state.criteria, state.teams),
    };
  }

  /**
   * `apply: false` only says what the file would change. `apply: true` changes it, and only against the revision the
   * preview was shown at: there is no "whatever it is now", or an old file would overwrite newer choices.
   */
  async import(
    reportId: string,
    file: Buffer,
    options: { apply: false } | { apply: true; expectedConfigVersion: number },
  ): Promise<MatrixImportResult> {
    const state = await this.load(reportId);
    const parsed = await parseCriteriaMatrix(file, state.criteria, state.teams);
    if (parsed.errors.length > 0) throw new CriteriaMatrixError(parsed.errors);
    if (!options.apply) return { applied: false, configVersion: state.configVersion, teams: parsed.teams };

    const wanted = new Map(parsed.teams.map((t) => [t.teamId, t.itemKeys]));
    const updated = await this.updates.updateConfig(reportId, {
      expectedConfigVersion: options.expectedConfigVersion,
      targets: state.targets.map((t) => ({
        teamId: t.teamId,
        editorUserIds: t.editorUserIds,
        itemKeys: wanted.get(t.teamId) ?? null,
      })),
    });
    return { applied: true, configVersion: updated.configVersion, teams: parsed.teams };
  }

  /** The report's teams, their editors and subsets, and the criteria of the version new periods are made from. */
  private async load(reportId: string) {
    const now = new Date();
    const inWindow = { validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] };
    const report = await this.prisma.dynReport.findUnique({
      where: { id: reportId },
      select: {
        name: true,
        configVersion: true,
        targets: {
          where: inWindow,
          select: {
            teamId: true,
            itemKeys: true,
            team: { select: { name: true } },
            editors: { where: inWindow, select: { userId: true } },
          },
        },
      },
    });
    if (!report) throw new ReportConfigError('Không tìm thấy báo cáo này.', 'REPORT_NOT_FOUND');

    const version =
      (await this.prisma.dynReportVersion.findFirst({
        where: { reportId, status: 'PUBLISHED' },
        orderBy: { version: 'desc' },
        select: { id: true },
      })) ??
      (await this.prisma.dynReportVersion.findFirst({ where: { reportId }, orderBy: { version: 'desc' }, select: { id: true } }));
    const fields = version
      ? await this.prisma.dynReportField.findMany({
          where: { versionId: version.id },
          select: { fieldKey: true, itemKey: true, criterionCode: true, label: true, address: true, sheetKey: true },
        })
      : [];
    const rowOf = (address: string) => Number(/\d+$/.exec(address)?.[0] ?? 0);
    const criteria: MatrixCriterion[] = [...fields]
      .sort((a, b) => a.sheetKey.localeCompare(b.sheetKey) || rowOf(a.address) - rowOf(b.address))
      .map((f) => ({ itemKey: itemKeyOf(f), code: f.criterionCode, label: f.label }));
    const sorted = [...report.targets].sort((a, b) => a.team.name.localeCompare(b.team.name, 'vi'));
    const teams: MatrixTeam[] = sorted.map((t) => ({
      teamId: t.teamId,
      name: t.team.name,
      itemKeys: Array.isArray(t.itemKeys) ? (t.itemKeys as string[]) : null,
    }));
    return {
      reportName: report.name,
      configVersion: report.configVersion,
      criteria,
      teams,
      targets: sorted.map((t) => ({ teamId: t.teamId, editorUserIds: t.editors.map((e) => e.userId) })),
    };
  }
}
