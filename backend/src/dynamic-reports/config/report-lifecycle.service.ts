import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ReportConfigError } from './report-config.service';

export interface ReportDeletionImpact {
  reportId: string;
  code: string;
  name: string;
  versions: number;
  periods: number;
  finalizedPeriods: number;
  assignments: number;
  /** Submissions anyone has touched: anything past NOT_STARTED, or with a saved revision. */
  submissionsWithData: number;
  revisions: number;
  comments: number;
  unlocks: number;
  /** True when deleting would destroy figures somebody entered, reviewed or closed. */
  hasData: boolean;
}

/**
 * Design standard "created ⇒ can be edited and deleted" for the report itself.
 *
 * Three ways out, from lightest to heaviest:
 *  - archive: the report stops generating periods and drops out of the working lists, everything stays;
 *  - delete: only while nobody has entered anything (a report made by mistake, a trial), nothing is lost;
 *  - delete with data: removes the figures too — admin only, the code has to be typed back, and the act is
 *    written to the audit log (metadata only: counts, never values — R10).
 */
@Injectable()
export class ReportLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async loadReport(reportId: string) {
    const report = await this.prisma.dynReport.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new ReportConfigError('Không tìm thấy báo cáo này.', 'REPORT_NOT_FOUND');
    }
    return report;
  }

  async getDeletionImpact(reportId: string): Promise<ReportDeletionImpact> {
    const report = await this.loadReport(reportId);
    const periodWhere = { period: { reportId } };
    const [versions, periods, finalizedPeriods, assignments, submissionsWithData, revisions, comments, unlocks] =
      await Promise.all([
        this.prisma.dynReportVersion.count({ where: { reportId } }),
        this.prisma.dynReportPeriod.count({ where: { reportId } }),
        this.prisma.dynReportPeriod.count({ where: { reportId, status: 'FINALIZED' } }),
        this.prisma.dynReportAssignment.count({ where: periodWhere }),
        this.prisma.dynReportSubmission.count({
          where: {
            assignment: periodWhere,
            OR: [{ state: { not: 'NOT_STARTED' } }, { currentRevision: { gt: 0 } }],
          },
        }),
        this.prisma.dynReportRevision.count({ where: { submission: { assignment: periodWhere } } }),
        this.prisma.dynReportComment.count({ where: { assignment: periodWhere } }),
        this.prisma.dynReportUnlock.count({ where: { assignment: periodWhere } }),
      ]);
    return {
      reportId,
      code: report.code,
      name: report.name,
      versions,
      periods,
      finalizedPeriods,
      assignments,
      submissionsWithData,
      revisions,
      comments,
      unlocks,
      hasData: submissionsWithData > 0 || finalizedPeriods > 0 || comments > 0,
    };
  }

  /** Hides a report from the working lists and stops it generating periods; no data is touched. */
  async archive(reportId: string): Promise<{ status: 'ARCHIVED' }> {
    const report = await this.loadReport(reportId);
    if (report.status === 'ARCHIVED') {
      throw new ReportConfigError('Báo cáo này đã được lưu trữ.', 'INVALID_STATE');
    }
    await this.prisma.dynReport.update({
      where: { id: reportId },
      data: { status: 'ARCHIVED', configVersion: { increment: 1 } },
    });
    return { status: 'ARCHIVED' };
  }

  /** Brings an archived report back as SUSPENDED: visible again, but generating nothing until someone resumes it. */
  async unarchive(reportId: string): Promise<{ status: 'SUSPENDED' }> {
    const report = await this.loadReport(reportId);
    if (report.status !== 'ARCHIVED') {
      throw new ReportConfigError('Chỉ khôi phục được báo cáo đang được lưu trữ.', 'INVALID_STATE');
    }
    await this.prisma.dynReport.update({
      where: { id: reportId },
      data: { status: 'SUSPENDED', configVersion: { increment: 1 } },
    });
    return { status: 'SUSPENDED' };
  }

  /**
   * Deletes the report and everything under it.
   * `withData: false` refuses (HAS_DATA, with the impact attached) as soon as anything was entered.
   * `withData: true` must come with the report code typed back as `confirmCode`.
   */
  async deleteReport(
    reportId: string,
    opts: { withData: boolean; confirmCode?: string },
    actorId: string,
  ): Promise<{ deleted: true; impact: ReportDeletionImpact }> {
    const impact = await this.getDeletionImpact(reportId);
    if (impact.hasData && !opts.withData) {
      throw new ReportConfigError(
        'Báo cáo đã có số liệu nên không xoá thường được. Hãy lưu trữ báo cáo, hoặc xoá kèm số liệu (chỉ quản trị viên).',
        'HAS_DATA',
      );
    }
    if (opts.withData && opts.confirmCode !== impact.code) {
      throw new ReportConfigError(
        'Phải gõ đúng mã báo cáo để xác nhận xoá kèm số liệu.',
        'CONFIRMATION_REQUIRED',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Lock the report row so a scheduler tick or a concurrent save cannot add rows under it half-way through.
      await tx.$queryRaw`SELECT id FROM dyn_reports WHERE id = ${reportId} FOR UPDATE`;
      await this.removeAll(tx, reportId);
      await this.audit.log(
        {
          userId: actorId,
          action: opts.withData ? 'DYN_REPORT_DELETE_WITH_DATA' : 'DYN_REPORT_DELETE',
          subject: 'DynReport',
          subjectId: reportId,
          metadata: {
            code: impact.code,
            name: impact.name,
            versions: impact.versions,
            periods: impact.periods,
            assignments: impact.assignments,
            submissionsWithData: impact.submissionsWithData,
            revisions: impact.revisions,
            comments: impact.comments,
          },
        },
        tx,
      );
    });
    return { deleted: true, impact };
  }

  /** Children before parents: every relation under a report is Restrict, so the order is the whole job. */
  private async removeAll(tx: Prisma.TransactionClient, reportId: string): Promise<void> {
    const periods = await tx.dynReportPeriod.findMany({ where: { reportId }, select: { id: true } });
    const periodIds = periods.map((p) => p.id);
    const assignments = await tx.dynReportAssignment.findMany({
      where: { periodId: { in: periodIds } },
      select: { id: true },
    });
    const assignmentIds = assignments.map((a) => a.id);
    const snapshots = await tx.dynReportSnapshot.findMany({
      where: { periodId: { in: periodIds } },
      select: { id: true },
    });
    const snapshotIds = snapshots.map((s) => s.id);
    const submissions = await tx.dynReportSubmission.findMany({
      where: { assignmentId: { in: assignmentIds } },
      select: { id: true },
    });
    const submissionIds = submissions.map((s) => s.id);

    // Files made from this report's figures: by snapshot, and by the scope they were requested with.
    await tx.dynReportExport.deleteMany({
      where: {
        OR: [
          { snapshotId: { in: snapshotIds } },
          { scope: { path: ['reportId'], equals: reportId } },
          ...periodIds.map((id) => ({ scope: { path: ['periodId'], equals: id } })),
          ...assignmentIds.map((id) => ({ scope: { path: ['assignmentId'], equals: id } })),
        ],
      },
    });
    await tx.dynReportSnapshot.deleteMany({ where: { periodId: { in: periodIds } } });
    await tx.dynReportRevision.deleteMany({ where: { submissionId: { in: submissionIds } } });
    await tx.dynReportSubmission.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
    await tx.dynReportUnlock.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
    await tx.dynReportComment.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
    // Editors and reminders go with their assignment (onDelete: Cascade).
    await tx.dynReportAssignment.deleteMany({ where: { periodId: { in: periodIds } } });
    await tx.dynReportPeriod.deleteMany({ where: { reportId } });
    // Fields, rules and the cached grid go with their version (Cascade).
    await tx.dynReportVersion.deleteMany({ where: { reportId } });
    // Target editors go with their target (Cascade).
    await tx.dynReportTarget.deleteMany({ where: { reportId } });
    await tx.dynReportRole.deleteMany({ where: { reportId } });
    await tx.dynReportSchedule.deleteMany({ where: { reportId } });
    await tx.dynReport.delete({ where: { id: reportId } });
  }
}
