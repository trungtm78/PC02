/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
// Prisma returns two record graphs; cutoff rules validate fields before they enter a snapshot.
import { Injectable } from '@nestjs/common';
import { DETAIL_COLUMNS } from './monthly-report-export.service';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  MonthlyAppendixCode,
  MonthlyAppendixSnapshot,
  MonthlyReportIssue,
  MonthlyReportSnapshot,
} from './monthly-report.rules';

export interface BuildMonthlyReportInput {
  periodStart: string;
  periodEnd: string;
  unitCode?: string;
  unitName: string;
  teamIds: string[];
  templateVersion?: string;
}

export interface MonthlyContributionInput {
  appendix: string;
  metricKey: string;
  cellKey?: string;
  entityType: string;
  entityId: string;
  entityCode?: string;
  label: string;
  eventAt?: Date;
  value: number;
  ruleCode: string;
  snapshot?: unknown;
}

const INCIDENT_TDC = new Set([
  'TAM_DINH_CHI',
  'TDC_HET_THOI_HIEU',
  'TDC_HTH_KHONG_KT',
]);
const INCIDENT_CLOSED = new Set([
  ...INCIDENT_TDC,
  'DA_GIAI_QUYET',
  'DA_CHUYEN_VU_AN',
  'KHONG_KHOI_TO',
  'CHUYEN_XPHC',
  'DA_CHUYEN_DON_VI',
  'DA_NHAP_VU_KHAC',
  'PHAN_LOAI_DAN_SU',
  'DINH_CHI',
]);
const CASE_CLOSED = new Set([
  'TAM_DINH_CHI',
  'DINH_CHI',
  'DA_LUU_TRU',
  'DA_KET_LUAN',
]);

@Injectable()
export class MonthlyReportBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async build(input: BuildMonthlyReportInput): Promise<{
    snapshot: MonthlyReportSnapshot;
    contributions: MonthlyContributionInput[];
  }> {
    const start = new Date(input.periodStart);
    const end = new Date(input.periodEnd);
    const teamWhere = input.teamIds.length
      ? { assignedTeamId: { in: input.teamIds } }
      : {};
    const [incidents, cases] = await Promise.all([
      this.prisma.incident.findMany({
        omit: { legacyRaw: true },
        where: {
          createdAt: { lte: end },
          OR: [{ deletedAt: null }, { deletedAt: { gt: start } }],
          ...teamWhere,
        },
        include: {
          statusHistory: {
            where: { createdAt: { lte: end } },
            orderBy: { createdAt: 'asc' },
          },
          actionPlans: true,
          vksMeetings: true,
          crimeChinh: { select: { name: true } },
          investigator: {
            select: { firstName: true, lastName: true, updatedAt: true },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.case.findMany({
        omit: { legacyRaw: true },
        where: {
          createdAt: { lte: end },
          OR: [{ deletedAt: null }, { deletedAt: { gt: start } }],
          caseType: 'REGULAR',
          ...teamWhere,
        },
        include: {
          statusHistory: {
            where: { changedAt: { lte: end } },
            orderBy: { changedAt: 'asc' },
          },
          subjects: {
            where: {
              type: 'SUSPECT',
              createdAt: { lte: end },
              OR: [{ deletedAt: null }, { deletedAt: { gt: start } }],
            },
          },
          actionPlans: true,
          vksMeetings: true,
          statistic: { select: { soDangKyHoSo: true, donViBaoQuanHoSo: true } },
          crimeChinh: { select: { name: true } },
          investigator: {
            select: { firstName: true, lastName: true, updatedAt: true },
          },
          evidences: {
            where: {
              createdAt: { lte: end },
              OR: [{ deletedAt: null }, { deletedAt: { gt: end } }],
            },
            select: {
              name: true,
              storageLocation: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { caseCode: 'asc' }],
      }),
    ]);

    const contributions: MonthlyContributionInput[] = [];
    const scopeMustBeVerified = input.teamIds.length > 0 && end < new Date();
    const detail = this.buildDetails(
      incidents as any[],
      cases as any[],
      end,
      contributions,
      scopeMustBeVerified,
    );
    const pl07 = this.buildSummary(
      'PL07',
      incidents as any[],
      start,
      end,
      contributions,
      false,
      scopeMustBeVerified,
    );
    const pl08 = this.buildSummary(
      'PL08',
      cases as any[],
      start,
      end,
      contributions,
      true,
      scopeMustBeVerified,
    );
    const snapshot: MonthlyReportSnapshot = {
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      unitName: input.unitName,
      templateVersion: input.templateVersion ?? '2026.09',
      appendices: [...detail, pl07, pl08],
    };
    return { snapshot, contributions };
  }

  private buildDetails(
    incidents: any[],
    cases: any[],
    cutoff: Date,
    contributions: MonthlyContributionInput[],
    scopeMustBeVerified: boolean,
  ): MonthlyAppendixSnapshot[] {
    const incidentGroups: Record<string, any[]> = {
      PL01: [],
      PL02: [],
      PL03: [],
    };
    for (const item of incidents) {
      if (item.deletedAt && new Date(item.deletedAt) <= cutoff) continue;
      const status = this.statusAt(item, cutoff);
      if (!status) {
        incidentGroups.PL01.push(item);
        continue;
      }
      if (!INCIDENT_CLOSED.has(status)) incidentGroups.PL01.push(item);
      if (INCIDENT_TDC.has(status)) {
        const expiry = item.ngayHetThoiHieuVV;
        (expiry && new Date(expiry) < cutoff
          ? incidentGroups.PL02
          : incidentGroups.PL03
        ).push(item);
      }
    }
    const caseGroups: Record<string, any[]> = { PL04: [], PL05: [], PL06: [] };
    for (const item of cases) {
      if (item.deletedAt && new Date(item.deletedAt) <= cutoff) continue;
      const status = this.statusAt(item, cutoff);
      if (!status) {
        caseGroups.PL04.push(item);
        continue;
      }
      if (!CASE_CLOSED.has(status)) caseGroups.PL04.push(item);
      if (status === 'TAM_DINH_CHI') {
        const expiry = item.ngayHetThoiHieu;
        (expiry && new Date(expiry) < cutoff
          ? caseGroups.PL05
          : caseGroups.PL06
        ).push(item);
      }
    }
    return [
      ...Object.entries(incidentGroups),
      ...Object.entries(caseGroups),
    ].map(([code, records]) => ({
      code: code as MonthlyAppendixCode,
      kind: 'DETAIL',
      metrics: [],
      issues: scopeMustBeVerified
        ? [
            {
              code: `HISTORICAL_TEAM_SCOPE_UNKNOWN:${code}`,
              severity: 'ERROR' as const,
              message:
                'Phạm vi tổ dùng phân công hiện tại; cần đối chiếu hồ sơ điều chuyển đơn vị tại kỳ báo cáo',
            },
          ]
        : [],
      rows: records.map((record) => {
        const issues = [
          ...this.historyIssues(record, cutoff),
          ...this.subjectHistoryIssues(record.subjects ?? [], cutoff, true),
        ];
        if (['PL02', 'PL03'].includes(code) && !record.ngayHetThoiHieuVV)
          issues.push({
            code: `STATUTORY_EXPIRY_REQUIRED:${record.id}`,
            severity: 'ERROR',
            field: 'expiryDate',
            message:
              'Thiếu ngày hết thời hiệu giải quyết nguồn tin; chưa thể xác định chính xác phụ lục hết/còn thời hiệu',
          });
        if (['PL05', 'PL06'].includes(code) && !record.ngayHetThoiHieu)
          issues.push({
            code: `STATUTORY_EXPIRY_REQUIRED:${record.id}`,
            severity: 'ERROR',
            field: 'expiryDate',
            message:
              'Thiếu ngày hết thời hiệu điều tra; chưa thể xác định chính xác phụ lục hết/còn thời hiệu',
          });
        const allCells = this.detailCells(record, cutoff);
        const cells = Object.fromEntries(
          (DETAIL_COLUMNS[code] ?? []).map((key) => [key, allCells[key] ?? '']),
        );
        contributions.push(
          this.contribution(code, 'ROW', record, 1, 'MEMBER_AT_CUTOFF', cutoff),
        );
        Object.entries(cells).forEach(([cellKey, value]) =>
          contributions.push({
            ...this.contribution(
              code,
              'ROW',
              record,
              1,
              'FIELD_AT_CUTOFF',
              cutoff,
            ),
            cellKey,
            snapshot: {
              field: cellKey,
              valueAtPeriod: value,
              currentValue: value,
            },
          }),
        );
        return {
          recordId: record.id,
          recordCode: record.code ?? record.caseCode ?? record.soHoSoCu,
          cells,
          issues,
        };
      }),
    }));
  }

  private buildSummary(
    code: 'PL07' | 'PL08',
    records: any[],
    start: Date,
    end: Date,
    contributions: MonthlyContributionInput[],
    includeSubjects: boolean,
    scopeMustBeVerified: boolean,
  ): MonthlyAppendixSnapshot {
    const buckets = new Map<string, any[]>();
    const issueKeys = new Map<string, MonthlyReportIssue[]>();
    const flag = (key: string, issue: MonthlyReportIssue) =>
      issueKeys.set(key, [...(issueKeys.get(key) ?? []), issue]);
    const add = (key: string, record: any) => {
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = [];
        buckets.set(key, bucket);
      }
      bucket.push(record);
    };
    const reasonOrder =
      code === 'PL08'
        ? [
            'CHUA_XAC_DINH_BI_CAN',
            'KHONG_BIET_BI_CAN_O_DAU',
            'BI_CAN_BENH_TAM_THAN',
            'CHUA_CO_KET_QUA_GIAM_DINH',
            'CHUA_CO_KET_QUA_DINH_GIA',
            'CHUA_CO_KET_QUA_TUONG_TRO',
            'BAT_KHA_KHANG',
            'KHAC',
          ]
        : [
            'CHUA_CO_KET_QUA_GIAM_DINH',
            'CHUA_CO_KET_QUA_DINH_GIA',
            'CHUA_CO_KET_QUA_TUONG_TRO',
            'YEU_CAU_TAI_LIEU_CHUA_CO',
            'BAT_KHA_KHANG',
            'CAN_CU_KHAC',
          ];
    const resultOrder =
      code === 'PL07'
        ? [
            'QUYET_DINH_KHOI_TO',
            'QUYET_DINH_KHONG_KHOI_TO',
            'TAM_DINH_CHI_LAI',
            'DANG_XAC_MINH',
            'CHUYEN_CO_QUAN_KHAC',
          ]
        : [
            'KET_LUAN_DE_NGHI_TRUY_TO',
            'DINH_CHI_DIEU_TRA',
            'TAM_DINH_CHI_LAI',
            'DANG_DIEU_TRA_XAC_MINH',
            'CHUYEN_CO_QUAN_DIEU_TRA_KHAC',
          ];
    const addRecoveryCohort = (key: '3' | '3.1' | '3.2', record: any) => {
      add(key, record);
      add('3.3', record);
      const result =
        code === 'PL07' ? record.ketQuaPhucHoiVuViec : record.ketQuaPhucHoiVuAn;
      const index = resultOrder.indexOf(result);
      if (index >= 0) add(`3.3.${index + 1}`, record);
      else
        flag('3.3', {
          code: `RECOVERY_RESULT_REQUIRED:${record.id}:${key}`,
          severity: 'ERROR',
          message: `Thiếu kết quả giải quyết hồ sơ ${record.code ?? record.caseCode ?? record.id}`,
        });
    };
    for (const record of records) {
      const before = new Date(start.getTime() - 1);
      const activeAtStart =
        new Date(record.createdAt) <= before &&
        (!record.deletedAt || new Date(record.deletedAt) > before);
      const activeAtEnd = !record.deletedAt || new Date(record.deletedAt) > end;
      const startStatus = this.statusAt(record, before);
      const endStatus = this.statusAt(record, end);
      if (!endStatus)
        flag('5', {
          code: 'HISTORICAL_STATUS_UNKNOWN',
          severity: 'ERROR',
          message: `Không xác định được trạng thái tại kỳ của hồ sơ ${record.code ?? record.caseCode ?? record.id}`,
        });
      const isTdc = (value: string | null) =>
        code === 'PL08'
          ? value === 'TAM_DINH_CHI'
          : !!value && INCIDENT_TDC.has(value);
      const tdcEvents = record.statusHistory.filter(
        (event: any) =>
          isTdc(event.toStatus) &&
          this.inRange(this.historyDate(event), start, end),
      );
      const recoveredValue =
        code === 'PL07' ? record.ngayPhucHoiVV : record.ngayPhucHoi;
      const recoveredAt = recoveredValue ? new Date(recoveredValue) : null;
      const recovered = recoveredAt && this.inRange(recoveredAt, start, end);
      const dismissedAt =
        code === 'PL07' ? record.ngayQDKhongKhoiTo : record.ngayDinhChiVuAn;
      const technology =
        code === 'PL07' ? record.laCongNgheCaoVV : record.laCongNgheCao;
      const reviewed = code === 'PL07' ? record.daRaSoatVV : record.daRaSoat;
      const paused = code === 'PL07' && record.xacDinhVuViecTamDung;
      const transferredInPeriod =
        ((code === 'PL07' && !!record.chuyenTuDonVi) ||
          (code === 'PL08' && record.caseProvenance === 'TRANSFERRED')) &&
        this.inRange(record.createdAt, start, end);
      const relevantToSummary =
        isTdc(startStatus) ||
        isTdc(endStatus) ||
        tdcEvents.length > 0 ||
        !!recovered ||
        (!!dismissedAt && this.inRange(new Date(dismissedAt), start, end));
      if (relevantToSummary && new Date(record.updatedAt) > end)
        flag('5', {
          code: `HISTORICAL_VALUE_UNKNOWN:${record.id}`,
          severity: 'ERROR',
          message: `Hồ sơ ${record.code ?? record.caseCode ?? record.id} đã thay đổi sau kỳ; cần đối chiếu lý do, kết quả và cờ thống kê tại kỳ`,
        });
      if (activeAtStart && isTdc(startStatus)) add('1', record);
      if (activeAtStart && isTdc(startStatus) && technology) add('1.1', record);
      if (activeAtStart && isTdc(startStatus) && paused) add('1.2', record);
      const expiry =
        code === 'PL07' ? record.ngayHetThoiHieuVV : record.ngayHetThoiHieu;
      if ((isTdc(startStatus) || isTdc(endStatus)) && !expiry)
        flag('5', {
          code: `STATUTORY_EXPIRY_REQUIRED:${record.id}`,
          severity: 'ERROR',
          message: `Hồ sơ ${record.code ?? record.caseCode ?? record.id} thiếu ngày hết thời hiệu nghiệp vụ`,
        });
      if (
        activeAtStart &&
        isTdc(startStatus) &&
        expiry &&
        new Date(expiry) < start
      )
        add(code === 'PL07' ? '1.3' : '1.2', record);
      if (tdcEvents.length) {
        add('2', record);
        const reasons: string[] =
          record.lyDoTamDinhChiVuAn ?? record.lyDoTamDinhChiVuViec ?? [];
        if (reasons.length !== 1)
          flag('2', {
            code: `PRIMARY_REASON_REQUIRED:${record.id}:2`,
            severity: 'ERROR',
            message: `Hồ sơ ${record.code ?? record.caseCode ?? record.id} phải xác định đúng một lý do chính tại kỳ`,
          });
        const reasonIndex = reasonOrder.indexOf(reasons[0]);
        if (reasons[0])
          add(
            `2.${reasonIndex >= 0 ? reasonIndex + 1 : reasonOrder.length}`,
            record,
          );
      }
      if (recovered && !transferredInPeriod) {
        addRecoveryCohort('3', record);
        if (!isTdc(startStatus) && !tdcEvents.length)
          flag('3', {
            code: `RECOVERY_ORIGIN_UNKNOWN:${record.id}`,
            severity: 'ERROR',
            message: `Chưa xác định nguồn chuyển sang/chuyển đến của hồ sơ ${record.code ?? record.caseCode ?? record.id}`,
          });
      }
      const carriedRecovery =
        recoveredAt &&
        recoveredAt < start &&
        !isTdc(startStatus) &&
        !this.isClosedStatus(code, startStatus) &&
        !transferredInPeriod;
      if (carriedRecovery) addRecoveryCohort('3.1', record);
      const transferredRecovery =
        transferredInPeriod && recoveredAt && recoveredAt <= end;
      if (transferredRecovery) addRecoveryCohort('3.2', record);
      if (transferredInPeriod && !recoveredAt)
        flag('3.2', {
          code: `TRANSFERRED_RECOVERY_DATE_REQUIRED:${record.id}`,
          severity: 'ERROR',
          message: `Hồ sơ ${record.code ?? record.caseCode ?? record.id} chuyển đến nhưng thiếu ngày phục hồi; chưa đưa vào số phục hồi`,
        });
      const expiredDisposition =
        code === 'PL07'
          ? record.lyDoKhongKhoiTo?.includes('HET_THOI_HIEU')
          : !!record.ngayHetThoiHieu &&
            !!dismissedAt &&
            new Date(record.ngayHetThoiHieu) <= new Date(dismissedAt);
      if (
        dismissedAt &&
        this.inRange(new Date(dismissedAt), start, end) &&
        expiredDisposition
      )
        add('4', record);
      if (activeAtEnd && isTdc(endStatus)) {
        add('5', record);
        if (technology) add('5.1', record);
        if (paused) add('5.2', record);
        if (expiry && new Date(expiry) < end)
          add(code === 'PL07' ? '5.3' : '5.2', record);
        if (reviewed) add(code === 'PL07' ? '5.4' : '5.3', record);
        const meetingKey = code === 'PL07' ? '5.5' : '5.4';
        const meetings = (record.vksMeetings ?? []).filter((item: any) =>
          this.inRange(item.ngayTrao, start, end),
        );
        if (
          meetings.some(
            (item: any) =>
              new Date(item.createdAt) <= end &&
              new Date(item.updatedAt) <= end,
          )
        )
          add(meetingKey, record);
        if (
          meetings.some(
            (item: any) =>
              new Date(item.createdAt) > end || new Date(item.updatedAt) > end,
          )
        )
          flag(meetingKey, {
            code: `HISTORICAL_MEETING_UNKNOWN:${record.id}`,
            severity: 'ERROR',
            message: `Biên bản trao đổi của hồ sơ ${record.code ?? record.caseCode ?? record.id} được tạo/sửa sau kỳ báo cáo`,
          });
        const planKey = code === 'PL07' ? '5.6' : '5.5';
        const plansAtCutoff = (record.actionPlans ?? []).filter(
          (item: any) =>
            new Date(item.ngayLap) <= end && new Date(item.createdAt) <= end,
        );
        if (
          plansAtCutoff.some(
            (item: any) =>
              item.tienDo === 'DAM_BAO' && new Date(item.updatedAt) <= end,
          )
        )
          add(planKey, record);
        if (plansAtCutoff.some((item: any) => new Date(item.updatedAt) > end))
          flag(planKey, {
            code: `HISTORICAL_ACTION_PLAN_UNKNOWN:${record.id}`,
            severity: 'ERROR',
            message: `Tiến độ khắc phục của hồ sơ ${record.code ?? record.caseCode ?? record.id} đã thay đổi sau kỳ báo cáo`,
          });
        const reasons: string[] =
          record.lyDoTamDinhChiVuAn ?? record.lyDoTamDinhChiVuViec ?? [];
        const reasonRoot = code === 'PL07' ? '5.7' : '5.6';
        add(reasonRoot, record);
        if (reasons.length !== 1)
          flag(reasonRoot, {
            code: `PRIMARY_REASON_REQUIRED:${record.id}:${reasonRoot}`,
            severity: 'ERROR',
            message: `Hồ sơ ${record.code ?? record.caseCode ?? record.id} phải xác định đúng một lý do chính tại kỳ`,
          });
        const reasonIndex = reasonOrder.indexOf(reasons[0]);
        if (reasons[0])
          add(
            `${reasonRoot}.${reasonIndex >= 0 ? reasonIndex + 1 : reasonOrder.length}`,
            record,
          );
      }
    }
    const reasonRoot = code === 'PL07' ? '5.7' : '5.6';
    const appendixIssues = scopeMustBeVerified
      ? [
          {
            code: `HISTORICAL_TEAM_SCOPE_UNKNOWN:${code}`,
            severity: 'ERROR' as const,
            message:
              'Phạm vi tổ dùng phân công hiện tại; cần đối chiếu hồ sơ điều chuyển đơn vị tại kỳ báo cáo',
          },
        ]
      : [];
    const startSubKeys =
      code === 'PL07' ? ['1.1', '1.2', '1.3'] : ['1.1', '1.2'];
    const keys = new Set<string>([
      '1',
      ...startSubKeys,
      '2',
      ...reasonOrder.map((_, i) => `2.${i + 1}`),
      '3',
      '3.1',
      '3.2',
      '3.3',
      ...resultOrder.map((_, i) => `3.3.${i + 1}`),
      '4',
      '5',
      '5.1',
      '5.2',
      '5.3',
      '5.4',
      '5.5',
      ...(code === 'PL07' ? ['5.6'] : []),
      reasonRoot,
      ...reasonOrder.map((_, i) => `${reasonRoot}.${i + 1}`),
    ]);
    const metrics: any[] = [];
    for (const key of keys) {
      const source = buckets.get(key) ?? [];
      const issues: MonthlyReportIssue[] = [...(issueKeys.get(key) ?? [])];
      const caseKey = includeSubjects ? `${key}.case` : key;
      const caseIds: string[] = [];
      source.forEach((record) => {
        const item = this.contribution(
          code,
          caseKey,
          record,
          1,
          this.ruleForMetric(key),
          this.eventForMetric(key, record, start, end),
        );
        contributions.push(item);
        caseIds.push(this.contributionIdentity(item));
      });
      metrics.push({
        key: caseKey,
        value: source.length,
        contributionIds: caseIds,
        issues,
      });
      if (includeSubjects) {
        const subjectKey = `${key}.subject`;
        const subjectIds: string[] = [];
        const subjectIssues: MonthlyReportIssue[] = [];
        for (const record of source) {
          const at = this.metricReferenceDate(key, record, start, end);
          const subjects = (record.subjects ?? []).filter((item: any) => {
            return (
              new Date(item.createdAt) <= at &&
              (!item.deletedAt || new Date(item.deletedAt) > at)
            );
          });
          subjectIssues.push(...this.subjectHistoryIssues(subjects, at));
          for (const subject of subjects) {
            const subjectValueUnknown =
              subject.updatedAt && new Date(subject.updatedAt) > at;
            const item = {
              ...this.contribution(
                code,
                subjectKey,
                subject,
                1,
                this.ruleForMetric(key),
                this.eventForMetric(key, record, start, end),
              ),
              entityType: 'SUBJECT',
              entityCode: subject.idNumber ?? subject.id,
              label: subjectValueUnknown
                ? 'Bị can cần xác minh'
                : (subject.fullName ?? subject.name ?? 'Bị can'),
              snapshot: {
                caseId: record.id,
                status: subject.status ?? null,
                fullName: subject.fullName ?? null,
                idNumber: subject.idNumber ?? null,
                updatedAt: subject.updatedAt ?? null,
              },
            };
            contributions.push(item);
            subjectIds.push(this.contributionIdentity(item));
          }
        }
        metrics.push({
          key: subjectKey,
          value: subjectIds.length,
          contributionIds: subjectIds,
          issues: [...issues, ...subjectIssues],
        });
      }
    }
    return { code, kind: 'SUMMARY', rows: [], metrics, issues: appendixIssues };
  }

  private statusAt(record: any, cutoff: Date): string | null {
    const history = (record.statusHistory ?? []).filter(
      (item: any) => this.historyDate(item) <= cutoff,
    );
    if (history.length) return history[history.length - 1].toStatus;
    return new Date(record.updatedAt) <= cutoff ? record.status : null;
  }

  private historyIssues(record: any, cutoff: Date): MonthlyReportIssue[] {
    if (new Date(record.updatedAt) <= cutoff) return [];
    return [
      {
        code: 'HISTORICAL_VALUE_UNKNOWN',
        severity: 'ERROR',
        message:
          'Hồ sơ đã thay đổi sau kỳ báo cáo; cần xác minh giá trị tại kỳ',
      },
    ];
  }

  private subjectHistoryIssues(
    subjects: any[],
    cutoff: Date,
    fieldSpecific = false,
  ): MonthlyReportIssue[] {
    const changed = subjects.filter(
      (subject: any) =>
        subject.updatedAt && new Date(subject.updatedAt) > cutoff,
    );
    if (!fieldSpecific)
      return changed.map((subject: any) => ({
        code: `HISTORICAL_SUBJECT_VALUE_UNKNOWN:${subject.id}`,
        severity: 'ERROR' as const,
        message: `Thông tin bị can ${subject.fullName ?? subject.name ?? subject.id} đã thay đổi sau kỳ báo cáo; cần xác minh giá trị tại kỳ`,
      }));
    const fields = [
      ['subjectName', 'họ tên'],
      ['birthYear', 'năm sinh'],
      ['address', 'địa chỉ'],
    ] as const;
    return changed.flatMap((subject: any) =>
      fields.map(([field, label]) => ({
        code: `HISTORICAL_SUBJECT_VALUE_UNKNOWN:${subject.id}:${field}`,
        severity: 'ERROR' as const,
        field,
        message: `${label} của bị can ${subject.fullName ?? subject.name ?? subject.id} đã thay đổi sau kỳ báo cáo; cần nhập giá trị đúng tại kỳ`,
      })),
    );
  }

  private detailCells(record: any, cutoff: Date): Record<string, any> {
    const subjects = (record.subjects ?? []).filter(
      (subject: any) =>
        new Date(subject.createdAt) <= cutoff &&
        (!subject.deletedAt || new Date(subject.deletedAt) > cutoff),
    );
    const subjectValues = (read: (subject: any) => unknown) => {
      const values = subjects
        .filter(
          (subject: any) =>
            !subject.updatedAt || new Date(subject.updatedAt) <= cutoff,
        )
        .map(read)
        .filter(
          (value: unknown) =>
            value !== null && value !== undefined && value !== '',
        );
      if (
        subjects.some(
          (subject: any) =>
            subject.updatedAt && new Date(subject.updatedAt) > cutoff,
        )
      )
        values.push('Cần xác minh');
      return values.join('; ');
    };
    const metadata =
      record.metadata && typeof record.metadata === 'object'
        ? record.metadata
        : {};
    const evidences = record.evidences ?? [];
    const evidenceText = (field: 'name' | 'storageLocation') =>
      evidences
        .map((item: any) =>
          new Date(item.updatedAt) > cutoff ? 'Cần xác minh' : item[field],
        )
        .filter(Boolean)
        .join('; ');
    const investigator =
      record.investigator && new Date(record.investigator.updatedAt) <= cutoff
        ? [record.investigator.lastName, record.investigator.firstName]
            .filter(Boolean)
            .join(' ')
        : record.investigator
          ? 'Cần xác minh'
          : undefined;
    const incident = !!record.code;
    const suspensionNumber = incident
      ? record.soQuyetDinhTamDinhChiVV
      : record.soQuyetDinhTamDinhChi;
    const suspensionDate = incident
      ? record.ngayTamDinhChiVV
      : record.ngayTamDinhChi;
    const recoveryNumber = incident
      ? record.soQuyetDinhPhucHoiVV
      : record.soQuyetDinhPhucHoi;
    const recoveryDate = incident ? record.ngayPhucHoiVV : record.ngayPhucHoi;
    return {
      crime:
        record.crime ??
        record.toiDanhBanDau ??
        record.crimeChinh?.name ??
        record.incidentType,
      receivedDate: this.date(
        record.receiveDate ??
          record.ngayDeXuat ??
          record.fromDate ??
          record.createdAt,
      ),
      reporter:
        record.benVu ??
        record.tenCungCap ??
        metadata.nguoiBaoTin ??
        metadata.nguoiToGiac,
      summary: record.moTaChiTiet ?? record.description ?? record.name,
      assignment: incident
        ? [
            record.soQDPhanCongNguonTin,
            this.date(record.ngayQDPhanCongNguonTin),
          ]
            .filter(Boolean)
            .join(' - ')
        : (record.donViGiaiQuyet ?? record.unit),
      processing: record.ketQuaXuLy ?? record.ketQuaXuLyKhac ?? record.status,
      notProsecuted: [
        record.soQDKhongKhoiTo,
        this.date(record.ngayQDKhongKhoiTo),
      ]
        .filter(Boolean)
        .join(' - '),
      transferred:
        record.chuyenDenDonVi ??
        record.chuyenVuViecDonViKhac ??
        record.chuyenVuAnChoCQK,
      suspensionDecision: [suspensionNumber, this.date(suspensionDate)]
        .filter(Boolean)
        .join(' - '),
      suspensionReason: (
        record.lyDoTamDinhChiVuAn ??
        record.lyDoTamDinhChiVuViec ??
        []
      ).join(', '),
      expiryDate: this.date(record.ngayHetThoiHieu ?? record.ngayHetThoiHieuVV),
      prosecutionDecision: [
        record.soQuyetDinhKhoiTo,
        this.date(record.ngayKhoiTo),
      ]
        .filter(Boolean)
        .join(' - '),
      investigating:
        record.status === 'DANG_DIEU_TRA' ? 'Đang điều tra, giải quyết' : '',
      conclusion: [record.soKLDT, this.date(record.ngayKLDT)]
        .filter(Boolean)
        .join(' - '),
      dismissal: [record.soQDDinhChiVuAn, this.date(record.ngayDinhChiVuAn)]
        .filter(Boolean)
        .join(' - '),
      subjectDecision: metadata.soQuyetDinhKhoiToBiCan ?? '',
      subjectSuspension: metadata.soQuyetDinhTamDinhChiBiCan ?? '',
      subjectName: subjectValues(
        (subject: any) => subject.fullName ?? subject.name,
      ),
      birthYear: subjectValues((subject: any) =>
        subject.dateOfBirth
          ? new Date(subject.dateOfBirth).getUTCFullYear()
          : subject.birthYear,
      ),
      address: subjectValues((subject: any) => subject.address),
      suspect:
        record.nghiVanDoiTuong ??
        record.doiTuongCaNhan ??
        metadata.nghiCan ??
        metadata.doiTuong,
      evidence:
        record.vatChungMoTa ||
        evidenceText('name') ||
        record.doVatTaiLieuKemTheo ||
        metadata.vatChung,
      storage:
        record.noiLuuTruBaoQuan ||
        evidenceText('storageLocation') ||
        metadata.noiBaoQuan,
      officer: record.dieuTraVien ?? investigator ?? metadata.dieuTraVien,
      registration: record.soHoSoCu ?? record.code ?? record.caseCode,
      recordState: record.tinhTrangHoSo ?? record.tinhTrang ?? record.status,
      archiveNumber: record.statistic?.soDangKyHoSo ?? metadata.soDangKyHoSo,
      archiveUnit:
        record.statistic?.donViBaoQuanHoSo ?? metadata.donViBaoQuanHoSo,
      relatedContent: record.nhapVaoVuViecSo ?? record.ghiChuNhapHoSo,
      relatedRegistration: record.sttCu,
      newOfficer: metadata.dieuTraVienMoi,
      crimeLevel: record.capDoToiPham,
      location: record.noiXayRa ?? record.noiXayRaPhuongXa ?? metadata.diaDiem,
      prosecutor: metadata.kiemSatVien,
      note: record.ghiChuKhac ?? metadata.ghiChu,
      remediationMinutes: record.tdcKhacPhucBienBan,
      remediationProgress: record.tdcKhacPhucLyDoBienPhap,
      recoveryDecision: [recoveryNumber, this.date(recoveryDate)]
        .filter(Boolean)
        .join(' - '),
      result: incident ? record.ketQuaPhucHoiVuViec : record.ketQuaPhucHoiVuAn,
    };
  }

  private contribution(
    appendix: string,
    metricKey: string,
    record: any,
    value: number,
    ruleCode: string,
    eventAt?: Date,
  ): MonthlyContributionInput {
    return {
      appendix,
      metricKey,
      entityType:
        appendix === 'PL07' ||
        (appendix.startsWith('PL0') && Number(appendix.slice(2)) <= 3)
          ? 'INCIDENT'
          : 'CASE',
      entityId: record.id,
      entityCode: record.code ?? record.caseCode ?? record.soHoSoCu,
      label:
        record.name ??
        record.fullName ??
        record.code ??
        record.caseCode ??
        record.id,
      eventAt,
      value,
      ruleCode,
      snapshot: {
        status: record.status ?? null,
        updatedAt: record.updatedAt ?? null,
        eventAt: eventAt ?? null,
        caseCode: record.caseCode ?? null,
        soHoSoCu: record.soHoSoCu ?? null,
      },
    };
  }

  private ruleForMetric(key: string) {
    return (
      (
        {
          '1': 'TDC_AT_PERIOD_START',
          '2': 'TDC_EVENT_IN_PERIOD',
          '3': 'RECOVERY_IN_PERIOD',
          '4': 'DISMISSAL_IN_PERIOD',
          '5': 'TDC_AT_PERIOD_END',
        } as Record<string, string>
      )[key.split('.')[0]] ?? 'SUMMARY_BREAKDOWN'
    );
  }
  private isClosedStatus(code: 'PL07' | 'PL08', status: string | null) {
    return status
      ? code === 'PL07'
        ? INCIDENT_CLOSED.has(status)
        : CASE_CLOSED.has(status)
      : false;
  }
  private eventForMetric(
    key: string,
    record: any,
    start: Date,
    end: Date,
  ): Date | undefined {
    if (key.startsWith('2')) {
      const event = record.statusHistory.find(
        (item: any) =>
          (item.toStatus === 'TAM_DINH_CHI' ||
            INCIDENT_TDC.has(item.toStatus)) &&
          this.inRange(this.historyDate(item), start, end),
      );
      return event ? this.historyDate(event) : undefined;
    }
    if (key.startsWith('3'))
      return record.code ? record.ngayPhucHoiVV : record.ngayPhucHoi;
    if (key.startsWith('4'))
      return record.code ? record.ngayQDKhongKhoiTo : record.ngayDinhChiVuAn;
    return undefined;
  }
  private metricReferenceDate(
    key: string,
    record: any,
    start: Date,
    end: Date,
  ): Date {
    if (key.startsWith('1')) return start;
    return this.eventForMetric(key, record, start, end) ?? end;
  }
  private contributionIdentity(item: MonthlyContributionInput) {
    return `${item.appendix}:${item.metricKey}:${item.entityType}:${item.entityId}`;
  }
  private historyDate(item: any): Date {
    return new Date(item.changedAt ?? item.createdAt);
  }
  private inRange(value: Date | string, start: Date, end: Date) {
    const date = new Date(value);
    return date >= start && date <= end;
  }
  private date(value: any) {
    return value
      ? new Date(value).toLocaleDateString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        })
      : '';
  }
}
