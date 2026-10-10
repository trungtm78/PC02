import { createHash } from 'node:crypto';
import * as ExcelJS from 'exceljs';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { aggregateValues } from '../engine/aggregate';
import type { Contribution } from '../engine/aggregate';
import { computeKpiSummary } from '../engine/status';
import type { AssignmentFact } from '../engine/status';
import type { SubmissionState } from '../engine/access';
import { SubmissionError } from '../submission/submission.service';
import { escapeXlsxCell } from '../../common/utils/xlsx-formula-escape.util';

/** R18 — Excel sheet names: ≤31 chars, no `* ? : \ / [ ]`. */
function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[*?:\\/[\]]/g, ' ').trim();
  return (cleaned || 'To').slice(0, 31);
}

/** R18 — file names: ASCII/Vietnamese letters, digits, dashes only. */
function sanitizeFileNamePart(value: string): string {
  const cleaned = value
    .replace(/[^a-zA-Z0-9À-ỹ\- ]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned.slice(0, 60) || 'bao-cao';
}

const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;

export type SummaryMode = 'SUBMITTED' | 'APPROVED' | 'ALL_SAVED';

export interface FieldAggregateView {
  fieldKey: string;
  sheetKey: string;
  address: string;
  label: string;
  value: string | null;
  displayNotAggregated: boolean;
  countTotal: number;
  countNonBlank: number;
  /** S18 — exactly the teams counted in `countTotal`/the aggregate above, never more. */
  contributors: FieldContributorView[];
}

export interface FieldContributorView {
  teamName: string;
  value: string | null;
  state: string;
  revision: string;
  updatedAt: string | null;
}

export interface KpiSummaryView {
  requiredCount: number;
  exemptCount: number;
  completedCount: number;
  notStartedCount: number;
  inProgressCount: number;
  overdueNotDoneCount: number;
  reopenedCount: number;
  completionRateLabel: string;
  onTimeRateLabel: string;
  dataCoverageLabel: string;
}

export interface PeriodSummaryView {
  reportId: string;
  reportName: string;
  periodId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  /** S38 — OPEN shows "Chốt kỳ"; FINALIZED shows "Mở chốt" (admin only, 404 otherwise). */
  status: 'OPEN' | 'FINALIZED';
  mode: SummaryMode;
  kpi: KpiSummaryView;
  fields: FieldAggregateView[];
  serverTime: string;
}

export interface FinalizeResultView {
  periodId: string;
  status: 'FINALIZED';
  finalizedAt: string;
  snapshotId: string;
}

export interface ReopenResultView {
  periodId: string;
  status: 'OPEN';
}

export interface ExportCreateResultView {
  exportId: string;
  fileName: string;
}

/**
 * S21 (PR7 slice 8) — metadata only, same R10 contract as S16's
 * `RevisionHistoryEntry`: never the revision's `valuesFull`/`diff`.
 */
export interface AssignmentHistoryEntry {
  revision: string;
  kind: string;
  actorName: string;
  reason: string | null;
  committedAt: string;
}

export interface AssignmentHistoryView {
  assignmentId: string;
  teamName: string;
  state: string;
  currentRevision: string;
  revisions: AssignmentHistoryEntry[];
  /**
   * Field keys whose value differs between the first-ever SUBMIT and the
   * submission's current values — `null` when the team has never submitted
   * (there is no "first submission" to compare against yet). This DOES read
   * raw values (via `valuesFull`), unlike the metadata-only `revisions`
   * array above — allowed here because this whole endpoint already re-checks
   * the caller's manager/admin standing on THIS report, same as S16/S18.
   */
  changedFieldKeysSinceFirstSubmit: string[] | null;
}

export interface ReportHistoryView {
  periodId: string;
  reportName: string;
  periodKey: string;
  assignments: AssignmentHistoryView[];
}

/** S38 — snapshot engine version tag, bumped only if the snapshot's own shape changes. */
const SNAPSHOT_ENGINE_VERSION = 'v1';

/** Which submission states count as a "live" contribution under each S15 mode (D03). */
const CONTRIBUTING_STATES: Record<SummaryMode, readonly SubmissionState[]> = {
  SUBMITTED: ['SUBMITTED', 'APPROVED'],
  APPROVED: ['APPROVED'],
  ALL_SAVED: ['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED'],
};

/**
 * S15 thu nhỏ (spec §6.1 PR7 slice 2) — tổng hợp một kỳ qua mọi tổ. Pure
 * orchestration: every real decision (KPI math, per-field SUM/AVG/MIN/MAX,
 * blank handling) lives in `engine/status.ts`/`engine/aggregate.ts` (PR1),
 * never re-derived here. D03: a team excluded from the current mode (e.g.
 * not yet APPROVED under mode=APPROVED) contributes NOTHING to that
 * field's aggregate — not even a null placeholder — because its data
 * isn't official under that mode, not because it's blank. An EXEMPT team
 * never contributes, in any mode.
 */
@Injectable()
export class AggregateService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveManagerRole(
    client: Prisma.TransactionClient | PrismaService,
    reportId: string,
    userId: string,
    roleId: string,
  ): Promise<'ADMIN' | 'MANAGER' | null> {
    const adminGrant = await client.rolePermission.findFirst({
      where: {
        roleId,
        permission: { subject: 'DynamicReport', action: 'admin' },
      },
    });
    if (adminGrant) return 'ADMIN';

    const now = new Date();
    const managerRole = await client.dynReportRole.findFirst({
      where: {
        reportId,
        userId,
        role: 'MANAGER',
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
    });
    return managerRole ? 'MANAGER' : null;
  }

  /**
   * Shared by `finalizePeriod` (the official snapshot) and `exportPeriod`
   * (the "TỔNG" sheet) — mode=APPROVED is the one "số liệu đã chốt" D03
   * meaning, so both consumers must compute it identically or an export
   * taken right after finalize could show a different TỔNG than the
   * snapshot it's supposed to represent.
   */
  private computeApprovedSnapshot(period: {
    id: string;
    versionId: string;
    version: {
      fields: Array<{
        fieldKey: string;
        aggregate: Parameters<typeof aggregateValues>[0];
        blankPolicy: Parameters<typeof aggregateValues>[1];
      }>;
    };
    assignments: Array<{
      id: string;
      teamId: string;
      obligation: string;
      submission: {
        state: string;
        values: unknown;
        currentRevision: bigint;
      } | null;
    }>;
  }): {
    snapshotValues: Record<
      string,
      { value: string | null; countTotal: number; countNonBlank: number }
    >;
    sourceRevisions: Record<string, string>;
    contributorSetHash: string;
    sourceHash: string;
  } {
    // mode=APPROVED — a team not yet APPROVED simply isn't counted, same
    // rule as getPeriodSummary's own mode=APPROVED path.
    const contributingStates = CONTRIBUTING_STATES.APPROVED;
    const contributingAssignments = period.assignments.filter(
      (a) =>
        a.obligation !== 'EXEMPT' &&
        contributingStates.includes(
          (a.submission?.state ?? 'NOT_STARTED') as SubmissionState,
        ),
    );

    const snapshotValues: Record<
      string,
      { value: string | null; countTotal: number; countNonBlank: number }
    > = {};
    for (const f of period.version.fields) {
      const contributions: Contribution[] = contributingAssignments.map((a) => {
        const values = (a.submission?.values ?? {}) as Record<
          string,
          { v: string | null } | undefined
        >;
        const raw = values[f.fieldKey]?.v ?? null;
        return { sourceId: a.id, value: raw !== null ? Number(raw) : null };
      });
      const result = aggregateValues(f.aggregate, f.blankPolicy, contributions);
      snapshotValues[f.fieldKey] = {
        value: result.value !== null ? String(result.value) : null,
        countTotal: result.countTotal,
        countNonBlank: result.countNonBlank,
      };
    }

    const sourceRevisions: Record<string, string> = {};
    for (const a of period.assignments) {
      sourceRevisions[a.id] = a.submission?.currentRevision.toString() ?? '0';
    }
    const contributorTeamIds = contributingAssignments
      .map((a) => a.teamId)
      .sort();

    const sourceHash = createHash('sha256')
      .update(
        JSON.stringify({
          periodId: period.id,
          versionId: period.versionId,
          mode: 'APPROVED',
          sourceRevisions,
        }),
      )
      .digest('hex');
    const contributorSetHash = createHash('sha256')
      .update(JSON.stringify(contributorTeamIds))
      .digest('hex');

    return { snapshotValues, sourceRevisions, contributorSetHash, sourceHash };
  }

  async getPeriodSummary(
    periodId: string,
    userId: string,
    roleId: string,
    mode: SummaryMode,
  ): Promise<PeriodSummaryView> {
    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: periodId },
      include: {
        report: true,
        version: { include: { fields: true } },
        assignments: {
          include: {
            submission: true,
            unlocks: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });
    // 404, not 403 — same anti-probe convention as the submission module
    // (AC-012/AC-035): a period the caller doesn't manage must look
    // identical to one that doesn't exist.
    if (!period) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }
    const actorRole = await this.resolveManagerRole(
      this.prisma,
      period.reportId,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }

    const now = new Date();
    const contributingStates = CONTRIBUTING_STATES[mode];

    const facts: AssignmentFact[] = period.assignments.map((a) => {
      const state = (a.submission?.state ?? 'NOT_STARTED') as SubmissionState;
      const completed = state === 'SUBMITTED' || state === 'APPROVED';
      return {
        state,
        exempt: a.obligation === 'EXEMPT',
        hasAnySavedData: !!a.submission?.firstSavedAt,
        originalDueAt: period.dueAt,
        currentCompletedAt: completed
          ? (a.submission?.submittedAt ?? null)
          : null,
        hasActiveGrant: a.unlocks.length > 0,
        now,
        periodOpen: period.status === 'OPEN',
      };
    });
    const kpi = computeKpiSummary(facts);

    const contributingAssignments = period.assignments.filter(
      (a) =>
        a.obligation !== 'EXEMPT' &&
        contributingStates.includes(
          (a.submission?.state ?? 'NOT_STARTED') as SubmissionState,
        ),
    );

    const fields: FieldAggregateView[] = period.version.fields.map((f) => {
      const contributions: Contribution[] = contributingAssignments.map((a) => {
        const values = (a.submission?.values ?? {}) as Record<
          string,
          { v: string | null } | undefined
        >;
        const raw = values[f.fieldKey]?.v ?? null;
        return {
          sourceId: a.id,
          value: raw !== null ? Number(raw) : null,
        };
      });
      const result = aggregateValues(f.aggregate, f.blankPolicy, contributions);

      // S18 — same population as `contributions` above, by construction
      // (both map `contributingAssignments` in the same order), so the
      // drill-down list always sums to exactly the aggregate shown.
      const contributors: FieldContributorView[] = contributingAssignments.map(
        (a, i) => {
          const teamSnapshot = a.teamSnapshot as { name?: string } | null;
          return {
            teamName: teamSnapshot?.name ?? '',
            value:
              contributions[i].value !== null
                ? String(contributions[i].value)
                : null,
            state: a.submission?.state ?? 'NOT_STARTED',
            revision: a.submission?.currentRevision.toString() ?? '0',
            updatedAt: a.submission?.updatedAt.toISOString() ?? null,
          };
        },
      );

      return {
        fieldKey: f.fieldKey,
        sheetKey: f.sheetKey,
        address: f.address,
        label: f.label,
        value: result.value !== null ? String(result.value) : null,
        displayNotAggregated: result.displayNotAggregated,
        countTotal: result.countTotal,
        countNonBlank: result.countNonBlank,
        contributors,
      };
    });

    return {
      reportId: period.reportId,
      reportName: period.report.name,
      periodId: period.id,
      periodKey: period.periodKey,
      periodStart: period.startDate.toISOString().slice(0, 10),
      periodEnd: period.endDate.toISOString().slice(0, 10),
      dueAt: period.dueAt.toISOString(),
      status: period.status as 'OPEN' | 'FINALIZED',
      mode,
      kpi,
      fields,
      serverTime: now.toISOString(),
    };
  }

  /**
   * S38 — chốt kỳ. R12 lock order: `FOR UPDATE` on the period row (not
   * `FOR SHARE` — this must WAIT for every in-flight save/submit/approve
   * holding `FOR SHARE` to commit first, exactly the "chờ các lần lưu
   * đang chạy xong" the spec calls for), then build the official snapshot
   * and flip `status` to FINALIZED inside the SAME transaction, so no
   * save can land between "snapshot taken" and "period locked". After
   * this, `lockForWrite`/`lockForManagerWrite`'s own
   * `period.status !== 'OPEN'` check (already in `SubmissionService`)
   * blocks every further write with no new code needed there.
   */
  async finalizePeriod(
    periodId: string,
    userId: string,
    roleId: string,
  ): Promise<FinalizeResultView> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "dyn_report_periods" WHERE id = ${periodId} FOR UPDATE`;

      const period = await tx.dynReportPeriod.findUnique({
        where: { id: periodId },
        include: {
          version: { include: { fields: true } },
          assignments: { include: { submission: true } },
        },
      });
      if (!period) {
        throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      }
      const actorRole = await this.resolveManagerRole(
        tx,
        period.reportId,
        userId,
        roleId,
      );
      if (!actorRole) {
        throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      }
      if (period.status !== 'OPEN') {
        throw new SubmissionError(
          'Kỳ đã chốt rồi.',
          'INVALID_STATE_TRANSITION',
        );
      }

      const {
        snapshotValues,
        sourceRevisions,
        contributorSetHash,
        sourceHash,
      } = this.computeApprovedSnapshot(period);

      const now = new Date();
      const snapshot = await tx.dynReportSnapshot.create({
        data: {
          periodId,
          mode: 'APPROVED',
          sourceHash,
          sourceRevisions,
          contributorSetHash,
          values: snapshotValues,
          engineVersion: SNAPSHOT_ENGINE_VERSION,
          asOf: now,
          official: true,
        },
      });

      await tx.dynReportPeriod.update({
        where: { id: periodId },
        data: { status: 'FINALIZED', finalizedAt: now, finalizedById: userId },
      });

      return {
        periodId,
        status: 'FINALIZED',
        finalizedAt: now.toISOString(),
        snapshotId: snapshot.id,
      };
    });
  }

  /**
   * S38 — mở chốt. `admin:DynamicReport` specifically (not any report
   * MANAGER) per D10: finalizing is a manager action, reopening it is
   * not — undoing a chốt is a bigger decision than making one. The
   * now-stale official snapshot is marked invalidated, never deleted
   * (spec: "giữ snapshot cũ"); a later re-finalize creates a fresh one.
   * Editing values after a reopen still goes through the normal SAVE
   * transition (kind='SAVE') — a dedicated ADJUSTMENT transition action
   * isn't wired anywhere yet (no UI can reach it), so this intentionally
   * does not fabricate one; deferred until something actually needs it.
   */
  async reopenPeriod(
    periodId: string,
    userId: string,
    roleId: string,
    reason: string,
  ): Promise<ReopenResultView> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "dyn_report_periods" WHERE id = ${periodId} FOR UPDATE`;

      const period = await tx.dynReportPeriod.findUnique({
        where: { id: periodId },
      });
      if (!period) {
        throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      }
      const adminGrant = await tx.rolePermission.findFirst({
        where: {
          roleId,
          permission: { subject: 'DynamicReport', action: 'admin' },
        },
      });
      if (!adminGrant) {
        throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      }
      if (period.status !== 'FINALIZED') {
        throw new SubmissionError(
          'Kỳ chưa chốt, không thể mở chốt.',
          'CELL_VALIDATION',
        );
      }

      const now = new Date();
      await tx.dynReportSnapshot.updateMany({
        where: { periodId, invalidatedAt: null },
        data: { invalidatedAt: now, invalidatedReason: reason },
      });
      await tx.dynReportPeriod.update({
        where: { id: periodId },
        data: { status: 'OPEN', finalizedAt: null, finalizedById: null },
      });

      return { periodId, status: 'OPEN' };
    });
  }

  /**
   * S25 — manager exports a workbook ("TỔNG" + 1 sheet/tổ + "Metadata"),
   * stored once (`DynReportExport`, TTL 24h) and downloaded through a
   * SEPARATE call (`getExportForDownload`) that re-checks standing —
   * exactly the "tải qua API có kiểm quyền lại" requirement, not just a
   * cosmetic extra step. Generated synchronously (no job queue): every
   * real template measured so far (HSLN: 258 rows × a few dozen input
   * cells) renders in well under a second, so "Job + trạng thái + retry"
   * stays deferred until an export this small has ever actually timed
   * out — building retry/polling for a problem that hasn't occurred yet
   * would be guessing at a requirement, not meeting one.
   */
  async exportPeriod(
    periodId: string,
    userId: string,
    roleId: string,
  ): Promise<ExportCreateResultView> {
    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: periodId },
      include: {
        report: true,
        version: { include: { fields: true } },
        assignments: { include: { submission: true } },
      },
    });
    if (!period) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }
    const actorRole = await this.resolveManagerRole(
      this.prisma,
      period.reportId,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }

    const computed = this.computeApprovedSnapshot(period);
    let snapshotValues = computed.snapshotValues;
    let snapshotId: string | null = null;
    if (period.status === 'FINALIZED') {
      // Once chốt, the export must show the FROZEN official numbers, not
      // a live recompute — the whole point of chốt kỳ is that the number
      // never moves again.
      const officialSnapshot = await this.prisma.dynReportSnapshot.findFirst({
        where: { periodId, official: true, invalidatedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (officialSnapshot) {
        snapshotValues = officialSnapshot.values as typeof snapshotValues;
        snapshotId = officialSnapshot.id;
      }
    }

    const workbook = new ExcelJS.Workbook();

    const totalSheet = workbook.addWorksheet('TỔNG');
    totalSheet.columns = [
      { header: 'Sheet', key: 'sheetKey', width: 20 },
      { header: 'Chỉ tiêu', key: 'label', width: 32 },
      { header: 'Giá trị tổng hợp', key: 'value', width: 18 },
      { header: 'Số tổ đóng góp', key: 'count', width: 16 },
    ];
    for (const f of period.version.fields) {
      const v = snapshotValues[f.fieldKey] as
        | { value: string | null; countTotal: number; countNonBlank: number }
        | undefined;
      totalSheet.addRow({
        sheetKey: f.sheetKey,
        label: escapeXlsxCell(f.label || f.fieldKey),
        value: v?.value ?? null,
        count: v ? `${v.countNonBlank}/${v.countTotal}` : '0/0',
      });
    }

    for (const a of period.assignments) {
      const teamSnapshot = a.teamSnapshot as { name?: string } | null;
      const teamName = teamSnapshot?.name || a.teamId;
      const sheet = workbook.addWorksheet(sanitizeSheetName(teamName));
      sheet.columns = [
        { header: 'Sheet', key: 'sheetKey', width: 20 },
        { header: 'Chỉ tiêu', key: 'label', width: 32 },
        { header: 'Giá trị', key: 'value', width: 18 },
      ];
      const values = (a.submission?.values ?? {}) as Record<
        string,
        { t: string; v: string | null } | undefined
      >;
      for (const f of period.version.fields) {
        const typed = values[f.fieldKey];
        sheet.addRow({
          sheetKey: f.sheetKey,
          label: escapeXlsxCell(f.label || f.fieldKey),
          value:
            typed?.t === 'TEXT' ? escapeXlsxCell(typed.v) : (typed?.v ?? null),
        });
      }
    }

    const metaSheet = workbook.addWorksheet('Metadata');
    metaSheet.addRow(['Báo cáo', period.report.name]);
    metaSheet.addRow(['Kỳ', period.periodKey]);
    metaSheet.addRow([
      'Khoảng thời gian',
      `${period.startDate.toISOString().slice(0, 10)} → ${period.endDate.toISOString().slice(0, 10)}`,
    ]);
    metaSheet.addRow(['Trạng thái kỳ', period.status]);
    metaSheet.addRow(['Chế độ tính', 'APPROVED']);
    metaSheet.addRow(['Xuất lúc', new Date().toISOString()]);
    metaSheet.addRow(['Phiên bản mẫu', period.versionId]);

    const fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const fileName = `${sanitizeFileNamePart(period.report.name)}-${period.periodKey}.xlsx`;

    const exportRow = await this.prisma.dynReportExport.create({
      data: {
        requestedById: userId,
        kind: 'MANAGER_FULL',
        scope: { periodId, reportId: period.reportId },
        snapshotId,
        status: 'READY',
        fileBytes: fileBuffer as unknown as Uint8Array<ArrayBuffer>,
        fileName,
        contributorSetHash: computed.contributorSetHash,
        expiresAt: new Date(Date.now() + EXPORT_TTL_MS),
      },
    });

    return { exportId: exportRow.id, fileName };
  }

  /**
   * S25 — the "kiểm quyền lại khi tải" step. Re-checks the caller still
   * manages this report, the export hasn't expired, AND (R13) the set of
   * contributing teams hasn't shrunk since the export was generated —
   * e.g. a team later marked EXEMPT — rather than silently serving bytes
   * whose scope may now exceed the caller's actual standing.
   */
  async getExportForDownload(
    exportId: string,
    userId: string,
    roleId: string,
  ): Promise<{ fileBytes: Buffer; fileName: string }> {
    const row = await this.prisma.dynReportExport.findUnique({
      where: { id: exportId },
    });
    if (!row || !row.fileBytes || !row.fileName) {
      throw new NotFoundException('Không tìm thấy file xuất này.');
    }
    const scope = row.scope as { periodId: string; reportId: string };
    const actorRole = await this.resolveManagerRole(
      this.prisma,
      scope.reportId,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy file xuất này.');
    }
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      throw new SubmissionError(
        'File xuất đã hết hạn, vui lòng xuất lại.',
        'CELL_VALIDATION',
      );
    }

    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: scope.periodId },
      include: {
        version: { include: { fields: true } },
        assignments: { include: { submission: true } },
      },
    });
    if (period) {
      const { contributorSetHash } = this.computeApprovedSnapshot(period);
      if (
        row.contributorSetHash &&
        row.contributorSetHash !== contributorSetHash
      ) {
        throw new SubmissionError(
          'Phạm vi dữ liệu đã thay đổi, vui lòng xuất lại.',
          'CELL_VALIDATION',
        );
      }
    }

    return {
      fileBytes: Buffer.from(row.fileBytes),
      fileName: row.fileName,
    };
  }

  /**
   * S21 (PR7 slice 8) — manager-scoped history/audit for the WHOLE period
   * at once (every team's assignment), not just one assignment like S16's
   * `getSubmissionForManager`. "Thay đổi so với lần nộp đầu" is computed
   * directly from the first SUBMIT revision's `valuesFull` (R9: SUBMIT
   * always writes a full snapshot, never just a diff) — no diff-replay
   * needed, because the exact row we want already holds the full values.
   */
  async getReportHistory(
    periodId: string,
    userId: string,
    roleId: string,
  ): Promise<ReportHistoryView> {
    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: periodId },
      include: {
        report: true,
        assignments: {
          include: {
            submission: {
              include: {
                revisions: {
                  orderBy: { revision: 'asc' },
                  select: {
                    revision: true,
                    kind: true,
                    reason: true,
                    committedAt: true,
                    valuesFull: true,
                    actor: {
                      select: {
                        firstName: true,
                        lastName: true,
                        username: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!period) throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');

    const actorRole = await this.resolveManagerRole(
      this.prisma,
      period.reportId,
      userId,
      roleId,
    );
    if (!actorRole)
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');

    const assignments: AssignmentHistoryView[] = period.assignments.map((a) => {
      const submission = a.submission;
      const revisions = submission?.revisions ?? [];
      const teamSnapshot = a.teamSnapshot as { name?: string } | null;

      const historyEntries: AssignmentHistoryEntry[] = revisions.map((r) => ({
        revision: r.revision.toString(),
        kind: r.kind,
        actorName:
          `${r.actor.firstName ?? ''} ${r.actor.lastName ?? ''}`.trim() ||
          r.actor.username,
        reason: r.reason,
        committedAt: r.committedAt.toISOString(),
      }));

      let changedFieldKeysSinceFirstSubmit: string[] | null = null;
      if (submission?.firstSubmittedRevision != null) {
        const firstSubmitRow = revisions.find(
          (r) => r.revision === submission.firstSubmittedRevision,
        );
        const firstValues =
          (firstSubmitRow?.valuesFull as Record<string, unknown>) ?? {};
        const currentValues =
          (submission.values as Record<string, unknown>) ?? {};
        const allKeys = new Set([
          ...Object.keys(firstValues),
          ...Object.keys(currentValues),
        ]);
        changedFieldKeysSinceFirstSubmit = Array.from(allKeys).filter(
          (k) =>
            JSON.stringify(firstValues[k] ?? null) !==
            JSON.stringify(currentValues[k] ?? null),
        );
      }

      return {
        assignmentId: a.id,
        teamName: teamSnapshot?.name ?? a.teamId,
        state: submission?.state ?? 'NOT_STARTED',
        currentRevision: (submission?.currentRevision ?? 0n).toString(),
        revisions: historyEntries,
        changedFieldKeysSinceFirstSubmit,
      };
    });

    return {
      periodId,
      reportName: period.report.name,
      periodKey: period.periodKey,
      assignments,
    };
  }
}
