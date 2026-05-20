import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'AuditLog' })
  async findAll(@Query() query: QueryAuditLogsDto) {
    return this.auditService.findAll({
      action: query.action,
      userId: query.userId,
      subjectId: query.subjectId,
      subject: query.subject,
      search: query.search,
      // v0.29 fix: normalize date-only input để dateTo `2026-05-20` cover hết ngày.
      dateFrom: query.dateFrom ? normalizeStartOfDay(query.dateFrom) : undefined,
      dateTo: query.dateTo ? normalizeEndOfDay(query.dateTo) : undefined,
      limit: query.limit,
      offset: query.offset,
    });
  }

  // v0.29: detail endpoint — returns raw sanitized metadata for modal view.
  @Get('actions')
  @RequirePermissions({ action: 'read', subject: 'AuditLog' })
  async actions(): Promise<string[]> {
    return this.auditService.distinctActions();
  }

  @Get('subjects')
  @RequirePermissions({ action: 'read', subject: 'AuditLog' })
  async subjects(): Promise<string[]> {
    return this.auditService.distinctSubjects();
  }

  // v0.29: streaming CSV export with formula sanitization + 10k cap.
  @Get('export.csv')
  @RequirePermissions({ action: 'read', subject: 'AuditLog' })
  async exportCsv(
    @Query() query: QueryAuditLogsDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const userId = (req as any).user?.sub;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const { data } = await this.auditService.findAll({
      action: query.action,
      userId: query.userId,
      subjectId: query.subjectId,
      subject: query.subject,
      search: query.search,
      dateFrom: query.dateFrom ? normalizeStartOfDay(query.dateFrom) : undefined,
      dateTo: query.dateTo ? normalizeEndOfDay(query.dateTo) : undefined,
      limit: 10000,
      offset: 0,
      forExport: true,
    });

    // Audit-of-export: log this export action itself.
    await this.auditService.log({
      userId,
      action: 'AUDIT_LOG_EXPORTED',
      subject: 'AuditLog',
      metadata: { rowCount: data.length, filters: query as any },
      ipAddress,
      userAgent,
    });

    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream header + rows.
    res.write('﻿'); // BOM for Excel UTF-8
    res.write('Thời gian,Người dùng,Action,Subject,SubjectID,Số trường thay đổi,IP\n');
    for (const row of data) {
      const user = (row as any).user;
      const userName = user
        ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username || ''
        : '';
      const changedCount = (row as any).changedFields?.length ?? 0;
      const cols = [
        new Date(row.createdAt).toISOString(),
        userName,
        row.action,
        row.subject ?? '',
        row.subjectId ?? '',
        String(changedCount),
        row.ipAddress ?? '',
      ].map(sanitizeCsvCell);
      res.write(cols.join(',') + '\n');
    }
    res.end();
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'AuditLog' })
  async findById(@Param('id') id: string) {
    const row = await this.auditService.findById(id);
    if (!row) throw new NotFoundException('Audit log not found');
    return row;
  }
}

/**
 * v0.29 fix: date-only input → ISO timestamp start-of-day (UTC).
 * Ex: "2026-05-20" → "2026-05-20T00:00:00.000Z"
 */
function normalizeStartOfDay(input: string): Date {
  const d = new Date(input);
  // Nếu input đã có timezone/time → giữ nguyên. Date-only → set start of day.
  if (input.length <= 10) {
    return new Date(input + 'T00:00:00.000Z');
  }
  return d;
}

/**
 * v0.29 fix: date-only input → end-of-day (UTC). Khắc phục bug dateTo bỏ sót logs.
 */
function normalizeEndOfDay(input: string): Date {
  if (input.length <= 10) {
    return new Date(input + 'T23:59:59.999Z');
  }
  return new Date(input);
}

/**
 * v0.29: Sanitize CSV cell to prevent Excel formula injection.
 * OWASP: cells starting with =/+/-/@/tab/CR/LF can execute formulas in Excel/Sheets.
 * Strategy: prefix with single quote `'` + quote-escape.
 */
function sanitizeCsvCell(value: string): string {
  if (value == null) return '';
  const str = String(value);
  // Formula injection prefix sanitization
  const safe = /^[=+\-@\t\r]/.test(str) ? "'" + str : str;
  // CSV escape: quote field if contains comma, quote, or newline
  if (/[",\n\r]/.test(safe)) {
    return '"' + safe.replace(/"/g, '""') + '"';
  }
  return safe;
}
