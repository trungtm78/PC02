import { Inject } from '@nestjs/common';
import { GRAPH_PRISMA } from '../graph-access/case-graph-access.service';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
// Prisma JSON columns cross the snapshot boundary here and are checked by report rules and lineage gates.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MonthlyReportBuilderService,
  type BuildMonthlyReportInput,
} from './monthly-report-builder.service';
import { MonthlyReportExportService } from './monthly-report-export.service';
import {
  assertMonthlyReportCanTransition,
  buildMonthlyReportChecks,
  summarizeMonthlyReport,
  type MonthlyReportIssue,
  type MonthlyReportSnapshot,
  type MonthlyReportStatus,
} from './monthly-report.rules';

export interface DrilldownQuery {
  appendix: string;
  metricKey: string;
  cellKey?: string;
  entityId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class MonthlyReportPackageService {
  constructor(
    @Inject(GRAPH_PRISMA) private readonly prisma: PrismaService,
    private readonly builder: MonthlyReportBuilderService,
    private readonly exporter: MonthlyReportExportService,
  ) {}

  async create(input: BuildMonthlyReportInput, actorId: string) {
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    if (
      !Number.isFinite(periodStart.getTime()) ||
      !Number.isFinite(periodEnd.getTime()) ||
      periodStart >= periodEnd
    ) {
      throw new BadRequestException('Kỳ báo cáo không hợp lệ');
    }
    if (input.periodStart.slice(0, 7) !== input.periodEnd.slice(0, 7)) {
      throw new BadRequestException(
        'Gói báo cáo tháng phải nằm trong cùng một tháng nghiệp vụ',
      );
    }
    const built = await this.builder.build(input);
    const checks = buildMonthlyReportChecks(built.snapshot.appendices);
    const summary = summarizeMonthlyReport(built.snapshot.appendices);
    const scopeKey = `${input.unitCode ?? ''}|${[...input.teamIds].sort().join(',')}`;
    const status: MonthlyReportStatus =
      summary.unresolvedIssueCount || summary.failedCheckCount
        ? 'NEEDS_VERIFICATION'
        : 'DRAFT';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const previous = await this.prisma.monthlyReportPackage.findMany({
        where: { periodStart, periodEnd, scopeKey },
        orderBy: { version: 'desc' },
        take: 1,
        select: { id: true, version: true },
      });
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const report = await tx.monthlyReportPackage.create({
              data: {
                periodStart,
                periodEnd,
                unitCode: input.unitCode ?? null,
                scopeKey,
                unitName: input.unitName,
                teamIds: input.teamIds,
                version: (previous[0]?.version ?? 0) + 1,
                parentId: previous[0]?.id,
                templateVersion: built.snapshot.templateVersion,
                status,
                snapshot: built.snapshot as any,
                checks: checks as any,
                summary: summary as any,
                createdById: actorId,
              },
            });
            // A nested create generates one enormous Prisma query for a real unit.
            // Keep the report and all lineage atomic while bounding each insert.
            for (
              let offset = 0;
              offset < built.contributions.length;
              offset += 500
            ) {
              await tx.monthlyReportContribution.createMany({
                data: built.contributions
                  .slice(offset, offset + 500)
                  .map((item) => ({
                    ...item,
                    reportId: report.id,
                    snapshot: item.snapshot as any,
                  })),
              });
            }
            return report;
          },
          { timeout: 120_000 },
        );
      } catch (error: any) {
        if (error?.code !== 'P2002' || attempt === 2) throw error;
      }
    }
    throw new BadRequestException('Không thể cấp phiên bản báo cáo mới');
  }

  list() {
    return this.prisma.monthlyReportPackage.findMany({
      orderBy: [{ periodEnd: 'desc' }, { version: 'desc' }],
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        unitName: true,
        teamIds: true,
        createdById: true,
        version: true,
        status: true,
        summary: true,
        createdAt: true,
        finalizedAt: true,
      },
    });
  }

  async get(id: string) {
    const report = await this.prisma.monthlyReportPackage.findUnique({
      where: { id },
      include: { adjustments: { orderBy: { createdAt: 'desc' } } },
      omit: { detailWorkbook: true, summaryWorkbook: true },
    });
    if (!report)
      throw new NotFoundException('Không tìm thấy gói báo cáo tháng');
    return report;
  }

  async getAccess(id: string) {
    const report = await this.prisma.monthlyReportPackage.findUnique({
      where: { id },
      select: { id: true, teamIds: true, createdById: true },
    });
    if (!report)
      throw new NotFoundException('Không tìm thấy gói báo cáo tháng');
    return report;
  }

  async appendix(id: string, code: string) {
    const report = await this.prisma.monthlyReportPackage.findUnique({
      where: { id },
      select: {
        snapshot: true,
        status: true,
        periodStart: true,
        periodEnd: true,
      },
    });
    if (!report)
      throw new NotFoundException('Không tìm thấy gói báo cáo tháng');
    const snapshot = report.snapshot as unknown as MonthlyReportSnapshot;
    const appendix = snapshot.appendices.find((item) => item.code === code);
    if (!appendix) throw new NotFoundException('Không tìm thấy phụ lục');
    return {
      reportId: id,
      status: report.status,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      appendix,
    };
  }

  async drilldown(id: string, query: DrilldownQuery) {
    const report = await this.prisma.monthlyReportPackage.findUnique({
      where: { id },
      select: { snapshot: true, checks: true },
    });
    if (!report)
      throw new NotFoundException('Không tìm thấy gói báo cáo tháng');
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: any = {
      reportId: id,
      appendix: query.appendix,
      metricKey: query.metricKey,
      ...(query.entityId ? { entityId: query.entityId } : {}),
    };
    const conditions: any[] = [];
    if (query.cellKey && query.metricKey === 'ROW')
      conditions.push({
        OR: [
          { ruleCode: 'FIELD_AT_CUTOFF', cellKey: query.cellKey },
          { ruleCode: 'ROW_WITH_FIELDS_AT_CUTOFF' },
        ],
      });
    else if (query.cellKey) conditions.push({ cellKey: query.cellKey });
    else if (query.metricKey === 'ROW')
      conditions.push({
        ruleCode: { in: ['MEMBER_AT_CUTOFF', 'ROW_WITH_FIELDS_AT_CUTOFF'] },
      });
    if (query.q)
      conditions.push({
        OR: [
          { entityCode: { contains: query.q, mode: 'insensitive' } },
          { label: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    if (conditions.length) where.AND = conditions;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.monthlyReportContribution.findMany({
        where,
        orderBy: [{ eventAt: 'asc' }, { entityCode: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.monthlyReportContribution.count({ where }),
    ]);
    const snapshot = report.snapshot as unknown as MonthlyReportSnapshot;
    const appendix = snapshot.appendices.find(
      (item) => item.code === query.appendix,
    );
    const metric = appendix?.metrics.find(
      (item) => item.key === query.metricKey,
    );
    return {
      reportId: id,
      appendix: query.appendix,
      metricKey: query.metricKey,
      value: metric?.value ?? null,
      formula: (report.checks as any[])?.find(
        (check) =>
          check.appendix === query.appendix && check.key === query.metricKey,
      )?.formula,
      page,
      limit,
      total,
      items: items.map((item) => {
        if (item.ruleCode !== 'ROW_WITH_FIELDS_AT_CUTOFF' || !query.cellKey)
          return item;
        const source = item.snapshot as any;
        const correction = source?.corrections?.[query.cellKey];
        return {
          ...item,
          cellKey: query.cellKey,
          snapshot: {
            field: query.cellKey,
            valueAtPeriod: source?.cells?.[query.cellKey],
            currentValue: source?.cells?.[query.cellKey],
            ...correction,
          },
        };
      }),
    };
  }

  async transition(
    id: string,
    next: MonthlyReportStatus,
    actorId: string,
    reason?: string,
  ) {
    const report = await this.get(id);
    assertMonthlyReportCanTransition(report as any, next, actorId);
    const summary = report.summary as any;
    if (
      next === 'REVIEWING' &&
      (summary.unresolvedIssueCount > 0 || summary.failedCheckCount > 0)
    ) {
      throw new BadRequestException(
        'Báo cáo còn ô cần xác minh hoặc phép đối soát lỗi',
      );
    }
    if (next === 'REVIEWING' || next === 'FINALIZED')
      await this.assertCompleteLineage(
        id,
        report.snapshot as unknown as MonthlyReportSnapshot,
      );
    const data: any = { status: next };
    if (next === 'REVIEWING')
      Object.assign(data, { reviewedById: actorId, submittedAt: new Date() });
    if (next === 'APPROVED')
      Object.assign(data, { approvedById: actorId, approvedAt: new Date() });
    if (next === 'REJECTED') {
      if (!reason?.trim())
        throw new BadRequestException('Phải nhập lý do trả lại');
      Object.assign(data, { rejectionReason: reason.trim() });
    }
    if (next === 'FINALIZED') {
      const [detailWorkbook, summaryWorkbook] = await Promise.all([
        this.workbook(id, 'DETAIL'),
        this.workbook(id, 'SUMMARY'),
      ]);
      Object.assign(data, {
        detailWorkbook,
        summaryWorkbook,
        detailWorkbookSha256: this.sha256(detailWorkbook),
        summaryWorkbookSha256: this.sha256(summaryWorkbook),
        finalizedById: actorId,
        finalizedAt: new Date(),
      });
    }
    const changed = await this.prisma.monthlyReportPackage.updateMany({
      where: { id, status: report.status, lockVersion: report.lockVersion },
      data: { ...data, lockVersion: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new BadRequestException(
        'Báo cáo vừa được thay đổi bởi người khác; hãy tải lại',
      );
    return this.get(id);
  }

  async addAdjustment(
    id: string,
    input: {
      appendix: string;
      targetKey: string;
      entityId?: string;
      operation: string;
      previousValue?: unknown;
      newValue: unknown;
      reason: string;
      evidence: unknown;
      issueCode?: string;
    },
    actorId: string,
  ) {
    const report = await this.get(id);
    if (report.status === 'FINALIZED')
      throw new BadRequestException(
        'Báo cáo đã chốt là bất biến; hãy tạo phiên bản điều chỉnh',
      );
    if (!['DRAFT', 'NEEDS_VERIFICATION', 'REJECTED'].includes(report.status))
      throw new BadRequestException(
        'Chỉ được điều chỉnh báo cáo nháp, cần xác minh hoặc đã trả lại',
      );
    if (!input.reason?.trim() || input.evidence == null)
      throw new BadRequestException('Điều chỉnh phải có lý do và chứng cứ');
    if (['ADD', 'REMOVE'].includes(input.operation) && !input.entityId)
      throw new BadRequestException(
        'Điều chỉnh số lượng phải chỉ ra hồ sơ hoặc sự kiện',
      );
    if (['REPLACE', 'CONFIRM'].includes(input.operation) && !input.issueCode)
      throw new BadRequestException('Phải chỉ rõ vấn đề cần xác minh');
    if (
      input.targetKey === 'expiryDate' ||
      input.issueCode?.startsWith('STATUTORY_EXPIRY_REQUIRED')
    )
      throw new BadRequestException(
        'Hãy bổ sung thời hiệu tại hồ sơ nguồn và tạo phiên bản báo cáo mới để phân loại lại phụ lục',
      );
    const snapshot = structuredClone(
      report.snapshot as unknown as MonthlyReportSnapshot,
    );
    const appendix = snapshot.appendices.find(
      (item) => item.code === input.appendix,
    );
    if (!appendix)
      throw new BadRequestException('Phụ lục điều chỉnh không tồn tại');
    const clearIssue = (
      issues: MonthlyReportIssue[] | undefined,
    ): MonthlyReportIssue[] => {
      const list = issues ?? [];
      if (!input.issueCode) return list;
      if (
        ['ADD', 'REMOVE'].includes(input.operation) &&
        !/^(PRIMARY_REASON_REQUIRED|RECOVERY_RESULT_REQUIRED|RECOVERY_ORIGIN_UNKNOWN):/.test(
          input.issueCode,
        )
      )
        return list;
      const index = list.findIndex((issue) => issue.code === input.issueCode);
      if (index >= 0) list.splice(index, 1);
      return list;
    };
    let contributionData: any;
    const metric = appendix.metrics.find(
      (item) => item.key === input.targetKey,
    );
    if (metric && ['ADD', 'REMOVE'].includes(input.operation)) {
      const amount = Math.max(1, Math.abs(Number(input.newValue) || 1));
      const delta = input.operation === 'ADD' ? amount : -amount;
      metric.value += delta;
      metric.contributionIds.push(`ADJUSTMENT:${input.entityId}`);
      metric.issues = clearIssue(metric.issues);
      const suffix = input.targetKey.endsWith('.case')
        ? '.case'
        : input.targetKey.endsWith('.subject')
          ? '.subject'
          : '';
      const bareTarget = suffix
        ? input.targetKey.slice(0, -suffix.length)
        : input.targetKey;
      const parentKey = bareTarget.startsWith('2.')
        ? `2${suffix}`
        : bareTarget.match(/^3\.3\./)
          ? `3.3${suffix}`
          : bareTarget.match(/^5\.(6|7)\./)
            ? `${bareTarget.split('.').slice(0, 2).join('.')}${suffix}`
            : undefined;
      if (parentKey) {
        const parent = appendix.metrics.find((item) => item.key === parentKey);
        if (parent?.issues?.length) {
          parent.issues = clearIssue(parent.issues);
        }
      }
      const evidence = input.evidence as any;
      contributionData = {
        reportId: id,
        appendix: input.appendix,
        metricKey: input.targetKey,
        entityType: evidence?.entityType ?? 'RECORD',
        entityId: input.entityId!,
        entityCode: evidence?.entityCode,
        label: evidence?.label ?? input.reason.trim(),
        eventAt: evidence?.eventAt ? new Date(evidence.eventAt) : undefined,
        value: delta,
        ruleCode: 'MANUAL_ADJUSTMENT',
        snapshot: { evidence: input.evidence, actorId } as any,
      };
    } else if (metric && input.operation === 'CONFIRM') {
      metric.issues = clearIssue(metric.issues);
    } else if (
      input.operation === 'CONFIRM' &&
      input.targetKey === '__appendix__'
    ) {
      appendix.issues = clearIssue(appendix.issues);
    } else if (input.operation === 'REPLACE' && input.entityId) {
      const row = appendix.rows.find(
        (item) => item.recordId === input.entityId,
      );
      if (!row)
        throw new BadRequestException(
          'Không tìm thấy dòng hồ sơ cần điều chỉnh',
        );
      const selectedIssue = input.issueCode
        ? row.issues?.find((issue) => issue.code === input.issueCode)
        : undefined;
      const missingHistoricalValue =
        input.newValue === null ||
        input.newValue === undefined ||
        typeof input.newValue === 'object' ||
        (typeof input.newValue === 'string' && !input.newValue.trim());
      if (
        selectedIssue?.field &&
        (input.targetKey !== selectedIssue.field || missingHistoricalValue)
      )
        throw new BadRequestException(
          `Phải nhập giá trị đúng tại kỳ cho trường ${selectedIssue.field}`,
        );
      if (input.targetKey !== '__confirm_snapshot__') {
        input.previousValue ??= row.cells[input.targetKey];
        row.cells[input.targetKey] = input.newValue as any;
      }
      if (input.issueCode) row.issues = clearIssue(row.issues);
      else
        row.issues = (row.issues ?? []).filter(
          (issue) => issue.field !== input.targetKey,
        );
    } else {
      throw new BadRequestException(
        'Điều chỉnh không khớp ô số liệu hoặc trường hồ sơ',
      );
    }
    const checks = buildMonthlyReportChecks(snapshot.appendices);
    const summary = summarizeMonthlyReport(snapshot.appendices);
    const nextStatus: MonthlyReportStatus =
      summary.unresolvedIssueCount || summary.failedCheckCount
        ? 'NEEDS_VERIFICATION'
        : 'DRAFT';
    return this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.monthlyReportAdjustment.create({
        data: {
          reportId: id,
          ...input,
          reason: input.reason.trim(),
          previousValue: input.previousValue as any,
          newValue: input.newValue as any,
          evidence: input.evidence as any,
          createdById: actorId,
        },
      });
      if (contributionData)
        await tx.monthlyReportContribution.create({ data: contributionData });
      if (
        input.operation === 'REPLACE' &&
        input.entityId &&
        input.targetKey !== '__confirm_snapshot__'
      ) {
        const compact = await tx.monthlyReportContribution.findFirst({
          where: {
            reportId: id,
            appendix: input.appendix,
            metricKey: 'ROW',
            entityId: input.entityId,
            ruleCode: 'ROW_WITH_FIELDS_AT_CUTOFF',
          },
          select: { id: true, snapshot: true },
        });
        if (compact) {
          const source = compact.snapshot as any;
          if (
            !Object.prototype.hasOwnProperty.call(
              source?.cells ?? {},
              input.targetKey,
            )
          )
            throw new BadRequestException(
              'Không tìm thấy nguồn trường cần điều chỉnh',
            );
          await tx.monthlyReportContribution.update({
            where: { id: compact.id },
            data: {
              snapshot: {
                ...source,
                cells: { ...source.cells, [input.targetKey]: input.newValue },
                corrections: {
                  ...source.corrections,
                  [input.targetKey]: {
                    previousValue: input.previousValue,
                    evidence: input.evidence,
                    correctedBy: actorId,
                  },
                },
              },
            },
          });
        } else {
          const lineage = await tx.monthlyReportContribution.updateMany({
            where: {
              reportId: id,
              appendix: input.appendix,
              metricKey: 'ROW',
              entityId: input.entityId,
              cellKey: input.targetKey,
              ruleCode: 'FIELD_AT_CUTOFF',
            },
            data: {
              snapshot: {
                field: input.targetKey,
                valueAtPeriod: input.newValue,
                previousValue: input.previousValue,
                evidence: input.evidence,
                correctedBy: actorId,
              } as any,
            },
          });
          if (lineage.count !== 1)
            throw new BadRequestException(
              'Không tìm thấy nguồn trường cần điều chỉnh',
            );
        }
      }
      const changed = await tx.monthlyReportPackage.updateMany({
        where: { id, status: report.status, lockVersion: report.lockVersion },
        data: {
          snapshot: snapshot as any,
          checks: checks as any,
          summary: summary as any,
          status: nextStatus,
          detailWorkbook: null,
          summaryWorkbook: null,
          detailWorkbookSha256: null,
          summaryWorkbookSha256: null,
          lockVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new BadRequestException(
          'Báo cáo vừa được thay đổi bởi người khác; hãy tải lại',
        );
      const updated = await tx.monthlyReportPackage.findUnique({
        where: { id },
        include: { adjustments: { orderBy: { createdAt: 'desc' } } },
        omit: { detailWorkbook: true, summaryWorkbook: true },
      });
      return { adjustment, report: updated };
    });
  }

  async workbook(
    id: string,
    kind: 'DETAIL' | 'SUMMARY',
    retry = 0,
  ): Promise<Buffer> {
    if (retry >= 3)
      throw new BadRequestException('Báo cáo đang thay đổi; hãy thử tải lại');
    const column = kind === 'DETAIL' ? 'detailWorkbook' : 'summaryWorkbook';
    const report =
      kind === 'DETAIL'
        ? await this.prisma.monthlyReportPackage.findUnique({
            where: { id },
            select: { snapshot: true, lockVersion: true, detailWorkbook: true },
          })
        : await this.prisma.monthlyReportPackage.findUnique({
            where: { id },
            select: {
              snapshot: true,
              lockVersion: true,
              summaryWorkbook: true,
            },
          });
    if (!report)
      throw new NotFoundException('Không tìm thấy gói báo cáo tháng');
    const stored =
      'detailWorkbook' in report
        ? report.detailWorkbook
        : report.summaryWorkbook;
    if (stored) return Buffer.from(stored);
    const rendered = await this.exporter.render(
      kind,
      report.snapshot as unknown as MonthlyReportSnapshot,
    );
    const saved = await this.prisma.monthlyReportPackage.updateMany({
      where:
        kind === 'DETAIL'
          ? { id, lockVersion: report.lockVersion, detailWorkbook: null }
          : { id, lockVersion: report.lockVersion, summaryWorkbook: null },
      data: { [column]: rendered },
    });
    if (saved.count === 1) return rendered;
    // A concurrent edit/finalization may have replaced the snapshot.
    return this.workbook(id, kind, retry + 1);
  }

  async verification(id: string) {
    const report = await this.get(id);
    const contributions = await this.prisma.monthlyReportContribution.findMany({
      where: { reportId: id },
      orderBy: [{ appendix: 'asc' }, { metricKey: 'asc' }],
    });
    return {
      report: {
        id: report.id,
        version: report.version,
        status: report.status,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
      },
      snapshot: report.snapshot,
      checks: report.checks,
      summary: report.summary,
      adjustments: report.adjustments,
      contributions,
      hashes: {
        detail: report.detailWorkbookSha256,
        summary: report.summaryWorkbookSha256,
      },
    };
  }

  private sha256(value: Buffer) {
    return createHash('sha256').update(value).digest('hex');
  }

  private async assertCompleteLineage(
    id: string,
    snapshot: MonthlyReportSnapshot,
  ) {
    const grouped = await this.prisma.monthlyReportContribution.groupBy({
      by: ['appendix', 'metricKey'],
      where: { reportId: id },
      _sum: { value: true },
    });
    const sums = new Map(
      grouped.map((item) => [
        `${item.appendix}:${item.metricKey}`,
        item._sum.value ?? 0,
      ]),
    );
    const missing = snapshot.appendices.flatMap((appendix) =>
      appendix.metrics
        .filter(
          (metric) =>
            metric.value !== (sums.get(`${appendix.code}:${metric.key}`) ?? 0),
        )
        .map((metric) => `${appendix.code}/${metric.key}`),
    );
    if (missing.length)
      throw new BadRequestException(
        `Chỉ tiêu thiếu nguồn đóng góp: ${missing.slice(0, 10).join(', ')}`,
      );
    const fields = await this.prisma.monthlyReportContribution.findMany({
      where: {
        reportId: id,
        ruleCode: { in: ['FIELD_AT_CUTOFF', 'ROW_WITH_FIELDS_AT_CUTOFF'] },
      },
      select: {
        appendix: true,
        entityId: true,
        cellKey: true,
        ruleCode: true,
        snapshot: true,
      },
    });
    const fieldSources = new Map<string, unknown>();
    for (const item of fields) {
      if (item.ruleCode === 'ROW_WITH_FIELDS_AT_CUTOFF') {
        const cells = (item.snapshot as any)?.cells ?? {};
        for (const [cellKey, value] of Object.entries(cells))
          fieldSources.set(
            `${item.appendix}:${item.entityId}:${cellKey}`,
            value,
          );
      } else
        fieldSources.set(
          `${item.appendix}:${item.entityId}:${item.cellKey}`,
          (item.snapshot as { valueAtPeriod?: unknown } | null)?.valueAtPeriod,
        );
    }
    const missingFields = snapshot.appendices.flatMap((appendix) =>
      appendix.rows.flatMap((row) =>
        Object.entries(row.cells)
          .filter(
            ([cellKey, value]) =>
              JSON.stringify(
                fieldSources.get(`${appendix.code}:${row.recordId}:${cellKey}`),
              ) !== JSON.stringify(value),
          )
          .map(
            ([cellKey]) =>
              `${appendix.code}/${row.recordCode ?? row.recordId}/${cellKey}`,
          ),
      ),
    );
    if (missingFields.length)
      throw new BadRequestException(
        `Trường chi tiết thiếu nguồn nhất quán: ${missingFields.slice(0, 10).join(', ')}`,
      );
  }
}
