import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { escapeXlsxCell } from '../../common/utils/xlsx-formula-escape.util';
import { StatusQueryService } from './status-query.service';
import type { AssignmentStatusRow } from './status-query.service';
import {
  ListStatusQueryDto,
  ExportStatusQueryDto,
} from './dto/list-status-query.dto';

interface AuthenticatedUser {
  id: string;
  roleId: string;
}

const STATE_LABEL: Record<AssignmentStatusRow['state'], string> = {
  NOT_STARTED: 'Chưa bắt đầu',
  DRAFT: 'Đang nhập',
  SUBMITTED: 'Đã nộp',
  RETURNED: 'Bị trả lại',
  APPROVED: 'Đã duyệt',
};

const ACCESS_STATE_LABEL: Record<AssignmentStatusRow['accessState'], string> = {
  NOT_YET_OPEN: 'Chưa mở',
  OPEN: 'Đang mở',
  LOCKED: 'Đã khoá',
  REOPENED: 'Mở lại',
};

const TIMELINESS_LABEL: Record<AssignmentStatusRow['timelinessState'], string> =
  {
    NOT_YET_DUE: 'Chưa đến hạn',
    ON_TIME: 'Đúng hạn',
    LATE: 'Trễ',
    OVERDUE_NOT_DONE: 'Quá hạn chưa nộp',
  };

const EXPORT_COLUMNS: Array<{
  header: string;
  key:
    | keyof AssignmentStatusRow
    | 'stateLabel'
    | 'accessStateLabel'
    | 'timelinessLabel'
    | 'exemptLabel'
    | 'changedLabel';
}> = [
  { header: 'Báo cáo', key: 'reportName' },
  { header: 'Kỳ', key: 'periodKey' },
  { header: 'Tổ', key: 'teamName' },
  { header: 'Đơn vị cha', key: 'parentTeamName' },
  { header: 'Mức điền', key: 'dataCoverageLabel' },
  { header: 'Tiến độ', key: 'stateLabel' },
  { header: 'Đúng hạn', key: 'timelinessLabel' },
  { header: 'Quyền nhập', key: 'accessStateLabel' },
  { header: 'Nghĩa vụ', key: 'exemptLabel' },
  { header: 'Hạn gốc', key: 'dueAt' },
  { header: 'Khoá lại lúc', key: 'effectiveLockAt' },
  { header: 'Nộp lúc', key: 'submittedAt' },
  { header: 'Duyệt lúc', key: 'approvedAt' },
  { header: 'Cập nhật cuối', key: 'updatedAt' },
  { header: 'Số lần mở lại', key: 'grantCount' },
  { header: 'Thay đổi sau mở lại', key: 'changedLabel' },
];

function toExportRow(r: AssignmentStatusRow): Record<string, string | number> {
  return {
    reportName: r.reportName,
    periodKey: r.periodKey,
    teamName: r.teamName,
    parentTeamName: r.parentTeamName ?? '',
    dataCoverageLabel: r.dataCoverageLabel,
    stateLabel: STATE_LABEL[r.state],
    timelinessLabel: TIMELINESS_LABEL[r.timelinessState],
    accessStateLabel: ACCESS_STATE_LABEL[r.accessState],
    exemptLabel: r.exempt ? 'Miễn nộp' : 'Phải nộp',
    dueAt: r.dueAt,
    effectiveLockAt: r.effectiveLockAt ?? '',
    submittedAt: r.submittedAt ?? '',
    approvedAt: r.approvedAt ?? '',
    updatedAt: r.updatedAt ?? '',
    grantCount: r.grantCount,
    changedLabel: r.changedSinceReopen ? 'Có' : 'Không',
  };
}

/** Same convention `audit.controller.ts` already uses for its own CSV export. */
function sanitizeCsvCell(value: string | number): string {
  const str = escapeXlsxCell(String(value));
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * S19/S23 (spec §6.1 PR8) — `read:DynamicReport` only, same coarse
 * module-entry gate every other route in this module uses; the real
 * access boundary is `StatusQueryService`'s own report-scope resolution
 * (R13), never the app-wide DataScope.
 */
@Controller('bao-cao-dong/status')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class StatusQueryController {
  constructor(private readonly statusQueryService: StatusQueryService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async list(
    @Query() query: ListStatusQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.statusQueryService.listAssignmentStatuses(
      user.id,
      user.roleId,
      {
        reportId: query.reportId,
        periodId: query.periodId,
        teamId: query.teamId,
        state: query.state,
        overdue: query.overdue,
        reopened: query.reopened,
      },
      query.page,
      query.pageSize,
    );
  }

  /** S19 "Xuất" — same filters/scope as `list`, every matching row, no pagination. */
  @Get('export')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async export(
    @Query() query: ExportStatusQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { rows, asOf } = await this.statusQueryService.queryAllForExport(
      user.id,
      user.roleId,
      {
        reportId: query.reportId,
        periodId: query.periodId,
        teamId: query.teamId,
        state: query.state,
        overdue: query.overdue,
        reopened: query.reopened,
      },
    );
    const exportRows = rows.map(toExportRow);
    const fileStamp = asOf.slice(0, 10);

    if (query.format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Tình trạng nhập liệu');
      sheet.columns = EXPORT_COLUMNS.map((c) => ({
        header: c.header,
        key: c.key,
        width: 18,
      }));
      for (const row of exportRows) {
        sheet.addRow(
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [
              k,
              typeof v === 'string' ? escapeXlsxCell(v) : v,
            ]),
          ),
        );
      }
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="tinh-trang-nhap-lieu-${fileStamp}.xlsx"`,
      );
      res.send(buffer);
      return;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tinh-trang-nhap-lieu-${fileStamp}.csv"`,
    );
    res.write('﻿');
    res.write(
      EXPORT_COLUMNS.map((c) => sanitizeCsvCell(c.header)).join(',') + '\n',
    );
    for (const row of exportRows) {
      res.write(
        EXPORT_COLUMNS.map((c) => sanitizeCsvCell(row[c.key])).join(',') + '\n',
      );
    }
    res.end();
  }
}
