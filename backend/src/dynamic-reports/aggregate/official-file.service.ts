import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { buildOfficialWorkbook } from '../export/official-workbook';
import { sanitizeFileNamePart } from '../export-filename.util';
import { ownedKeys } from './contributors';
import { AggregateService, PERIOD_CLOSED_EVENT } from './aggregate.service';
import type { PeriodClosedEvent } from './aggregate.service';

const CATCH_UP_BATCH = 5;
const SYSTEM_ACTOR = 'system';

export const OFFICIAL_FILE_ERROR = {
  PERIOD_NOT_FINALIZED: 'PERIOD_NOT_FINALIZED',
  FILE_NOT_AVAILABLE: 'OFFICIAL_FILE_NOT_AVAILABLE',
} as const;

export interface OfficialFileView {
  id: string;
  status: 'READY' | 'FAILED' | 'SUPERSEDED' | 'VOID';
  fileName: string | null;
  error: string | null;
  createdAt: string;
  endedAt: string | null;
}

/**
 * The file a closed period is kept as: sheet "Tổng hợp", then one sheet per team with only its criteria.
 *
 * Made by itself when a period is closed (the close has already committed, so a failure here never undoes it: the
 * attempt is recorded as FAILED and can be made again). It does not expire. Making it again supersedes the one
 * before; reopening the period voids them.
 */
@Injectable()
export class OfficialFileService {
  private readonly logger = new Logger(OfficialFileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregate: AggregateService,
  ) {}

  @OnEvent(PERIOD_CLOSED_EVENT, { async: true })
  async onPeriodClosed(event: PeriodClosedEvent): Promise<void> {
    try {
      await this.make(event.periodId, event.actorId);
    } catch (err) {
      this.logger.error(
        `Could not make the official file of period ${event.periodId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * The close commits before the file is made, and the signal between the two lives in memory: a restart in between
   * would leave a closed period with no file and no failed attempt to make again. This looks for such periods and
   * makes their file; a few at a time, oldest closure first.
   */
  @Cron('*/10 * * * *', { name: 'dynamic-reports-official-file-catch-up' })
  async catchUp(): Promise<number> {
    const missing = await this.prisma.dynReportPeriod.findMany({
      where: { status: 'FINALIZED', officialFiles: { none: {} } },
      orderBy: { finalizedAt: 'asc' },
      take: CATCH_UP_BATCH,
      select: { id: true, finalizedById: true },
    });
    for (const period of missing) {
      await this.onPeriodClosed({ periodId: period.id, actorId: period.finalizedById ?? SYSTEM_ACTOR });
    }
    return missing.length;
  }

  /** The manager's "make it again". */
  async regenerate(periodId: string, userId: string, roleId: string): Promise<OfficialFileView> {
    const period = await this.prisma.dynReportPeriod.findUnique({ where: { id: periodId }, select: { reportId: true } });
    const role = period ? await this.aggregate.accessRoleFor(period.reportId, userId, roleId) : null;
    if (!period || !role || role.role === 'VIEWER') throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    return this.make(periodId, userId);
  }

  async list(periodId: string, userId: string, roleId: string): Promise<OfficialFileView[]> {
    await this.assertMayRead(periodId, userId, roleId);
    const rows = await this.prisma.dynReportOfficialFile.findMany({
      where: { periodId },
      orderBy: { createdAt: 'desc' },
      omit: { fileBytes: true },
    });
    return rows.map(toView);
  }

  async download(fileId: string, userId: string, roleId: string): Promise<{ fileName: string; fileBuffer: Buffer }> {
    const row = await this.prisma.dynReportOfficialFile.findUnique({ where: { id: fileId } });
    if (!row) throw new NotFoundException('Không tìm thấy file này.');
    await this.assertMayRead(row.periodId, userId, roleId);
    if (!row.fileBytes || row.status === 'FAILED') {
      throw new ConflictException({ code: OFFICIAL_FILE_ERROR.FILE_NOT_AVAILABLE });
    }
    return { fileName: row.fileName ?? 'bao-cao.xlsx', fileBuffer: Buffer.from(row.fileBytes) };
  }

  /**
   * The whole file holds every team's figures: a manager or admin of the report, or a viewer of the WHOLE report. A
   * viewer limited to one team's subtree does not get it (R13); they are told "not found" like anyone outside.
   */
  private async assertMayRead(periodId: string, userId: string, roleId: string): Promise<void> {
    const period = await this.prisma.dynReportPeriod.findUnique({ where: { id: periodId }, select: { reportId: true } });
    const role = period ? await this.aggregate.accessRoleFor(period.reportId, userId, roleId) : null;
    if (!period || !role || (role.role === 'VIEWER' && role.teamScopeId !== null)) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }
  }

  /** Builds and stores the file of a CLOSED period. A failure to build is stored too (FAILED), with the reason. */
  private async make(periodId: string, actorId: string): Promise<OfficialFileView> {
    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: periodId },
      include: {
        report: { select: { name: true } },
        version: {
          select: {
            fields: {
              orderBy: [{ sheetKey: 'asc' }, { address: 'asc' }],
              select: {
                fieldKey: true,
                label: true,
                criterionCode: true,
                unit: true,
                type: true,
                aggregate: true,
                blankPolicy: true,
                address: true,
              },
            },
          },
        },
        assignments: { include: { submission: { select: { state: true, values: true } } } },
      },
    });
    if (!period) throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    if (period.status !== 'FINALIZED') {
      throw new ConflictException({ code: OFFICIAL_FILE_ERROR.PERIOD_NOT_FINALIZED });
    }
    // WHICH closure this file is of: a period can be reopened and closed again while the workbook is being written.
    const closedAt = period.finalizedAt?.getTime() ?? null;

    const nameOf = (a: (typeof period.assignments)[number]) =>
      (a.teamSnapshot as { name?: string } | null)?.name || a.teamId;
    const teams = [...period.assignments]
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'vi'))
      .map((a) => ({
        teamId: a.teamId,
        name: nameOf(a),
        obligation: a.obligation,
        state: a.submission?.state ?? 'NOT_STARTED',
        ownedFieldKeys: ownedKeys(a),
        values: Object.fromEntries(
          Object.entries((a.submission?.values ?? {}) as Record<string, { v: string | null } | undefined>).map(
            ([key, cell]) => [key, cell?.v ?? null],
          ),
        ),
      }));
    // Rows in the order of the sheet: by row number, not by the text of the address ("C10" after "C9").
    const rowOf = (address: string) => Number(/\d+$/.exec(address)?.[0] ?? 0);
    const fields = [...period.version.fields]
      .sort((a, b) => rowOf(a.address) - rowOf(b.address))
      .map((f) => ({
        fieldKey: f.fieldKey,
        label: f.label,
        code: f.criterionCode,
        unit: f.unit,
        type: f.type,
        aggregate: f.aggregate,
        blankPolicy: f.blankPolicy,
      }));

    let fileBytes: Buffer | null = null;
    let error: string | null = null;
    try {
      fileBytes = await buildOfficialWorkbook({
        reportName: period.report.name,
        periodKey: period.periodKey,
        fields,
        teams,
      });
    } catch (err) {
      error = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      this.logger.error(`Official file of period ${periodId} could not be built: ${error}`);
    }

    const fileName = `${sanitizeFileNamePart(period.report.name)}-${period.periodKey}-chinh-thuc.xlsx`;
    const row = await this.prisma.$transaction(async (tx) => {
      // Published under the period lock (the one closing and reopening take), and only if the period is still closed
      // by the SAME closure the figures were read from: a file of an earlier closure, or of a period reopened in the
      // meantime, is thrown away instead of becoming "the current file". The lock also makes two builds take turns.
      await tx.$queryRaw`SELECT id FROM "dyn_report_periods" WHERE id = ${periodId} FOR UPDATE`;
      const now = await tx.dynReportPeriod.findUnique({ where: { id: periodId }, select: { status: true, finalizedAt: true } });
      if (!now || now.status !== 'FINALIZED' || (now.finalizedAt?.getTime() ?? null) !== closedAt) {
        throw new ConflictException({ code: OFFICIAL_FILE_ERROR.PERIOD_NOT_FINALIZED });
      }
      if (fileBytes) {
        // The new file replaces the current one; a failed attempt replaces nothing.
        await tx.dynReportOfficialFile.updateMany({
          where: { periodId, status: 'READY' },
          data: { status: 'SUPERSEDED', endedAt: new Date() },
        });
      }
      return tx.dynReportOfficialFile.create({
        data: {
          periodId,
          status: fileBytes ? 'READY' : 'FAILED',
          fileBytes: fileBytes ? (fileBytes as unknown as Uint8Array<ArrayBuffer>) : null,
          fileName: fileBytes ? fileName : null,
          error,
          createdById: actorId,
        },
        omit: { fileBytes: true },
      });
    });
    return toView(row);
  }
}

function toView(row: {
  id: string;
  status: OfficialFileView['status'];
  fileName: string | null;
  error: string | null;
  createdAt: Date;
  endedAt: Date | null;
}): OfficialFileView {
  return {
    id: row.id,
    status: row.status,
    fileName: row.fileName,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  };
}
