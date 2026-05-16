import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs/promises';
import type { Response, Request } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { AuditService } from '../../audit/audit.service';
import { ROLE_NAMES } from '../../common/constants/role.constants';
import { BulkImportService } from './bulk-import.service';
import { BulkImportProcessor } from './bulk-import.processor';
import { BulkImportConfirmDto } from '../dto/bulk-import.dto';

const MAX_FILE_SIZE_BYTES = Number(process.env.BULK_IMPORT_MAX_FILE_SIZE_MB || 2) * 1024 * 1024;

@Controller('admin/users/bulk-import')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BulkImportController {
  constructor(
    private readonly bulkService: BulkImportService,
    private readonly processor: BulkImportProcessor,
    private readonly audit: AuditService,
  ) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'User' })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async preview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Thiếu file upload (field "file")');
    return this.bulkService.previewUpload(file, user.id);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions({ action: 'write', subject: 'User' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async confirm(@Body() dto: BulkImportConfirmDto, @CurrentUser() user: AuthUser) {
    const originalBuffer = await this.bulkService.loadOriginalFile(dto.previewToken);
    if (!originalBuffer) {
      throw new NotFoundException('Preview token hết hạn hoặc không tồn tại. Vui lòng upload lại.');
    }

    const sha256 = this.bulkService.computeSha256(originalBuffer);
    const job = await this.bulkService.createJobRecord(
      user.id,
      `bulk-${dto.previewToken}.xlsx`,
      sha256,
      dto.rows.length,
    );

    // Map confirm DTO → PreviewRow shape (admin có thể đã edit)
    const previewRows = dto.rows.map((r) => ({
      rowIndex: r.rowIndex,
      fullName: r.fullName ?? null,
      firstName: r.firstName ?? null,
      lastName: r.lastName ?? null,
      username: r.username,
      workId: r.workId ?? null,
      phone: r.phone ?? null,
      email: r.email ?? null,
      roleName: null,
      roleId: r.roleId,
      departmentName: null,
      departmentId: r.departmentId ?? null,
      warnings: [],
      errors: [],
    }));

    // Resolve temp file ext
    const fs2 = await import('fs/promises');
    const path2 = await import('path');
    const TEMP_DIR = process.env.BULK_IMPORT_TEMP_DIR || '/tmp/pc02-bulk';
    let originalPath = '';
    let format: 'xlsx' | 'csv' = 'xlsx';
    for (const ext of ['xlsx', 'csv'] as const) {
      const p = path2.join(TEMP_DIR, `${dto.previewToken}.${ext}`);
      try {
        await fs2.stat(p);
        originalPath = p;
        format = ext;
        break;
      } catch {
        /* try next */
      }
    }

    this.processor.enqueue(
      job.id,
      previewRows,
      user.id,
      originalPath,
      format,
      dto.generatePdfs ?? true,
    );

    await this.audit.log({
      userId: user.id,
      action: 'BULK_IMPORT_CONFIRMED',
      subject: 'BulkImportJob',
      subjectId: job.id,
      metadata: { rowCount: dto.rows.length, previewToken: dto.previewToken },
    });

    return { jobId: job.id, status: 'queued' };
  }
}

@Controller('admin/users/bulk-jobs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BulkJobsController {
  constructor(
    private readonly bulkService: BulkImportService,
    private readonly audit: AuditService,
  ) {}

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'User' })
  async getJob(@Param('id') jobId: string, @CurrentUser() user: AuthUser) {
    const isAdmin = user.role === ROLE_NAMES.ADMIN;
    const job = await this.bulkService.getJob(jobId, user.id, isAdmin);
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      totalRows: job.totalRows,
      successRows: job.successRows,
      errorRows: job.errorRows,
      rowOutcomes: job.rowOutcomes,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      hasEnriched: !!job.enrichedFilePath,
    };
  }

  @Get(':id/enriched.xlsx')
  @RequirePermissions({ action: 'read', subject: 'User' })
  async downloadEnriched(
    @Param('id') jobId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    // IDOR fix per autoplan E6: ONLY generator can download. Admin role no bypass.
    const job = await this.bulkService.getJob(jobId, user.id, false);
    if (!job.enrichedFilePath) {
      throw new NotFoundException('File chưa sẵn sàng. Job đang xử lý hoặc đã hết hạn.');
    }

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(job.enrichedFilePath);
    } catch {
      throw new NotFoundException('File đã hết hạn (TTL 24h) hoặc bị xóa.');
    }

    await this.bulkService.incrementDownloadCount(jobId);
    await this.audit.log({
      userId: user.id,
      action: 'ENROLLMENT_LINKS_EXPORTED',
      subject: 'BulkImportJob',
      subjectId: jobId,
      metadata: {
        fileType: 'enriched',
        linkCount: job.successRows,
        downloadCount: job.downloadCount + 1,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Per E6: Content-Disposition attachment để chặn xlsx ZIP polyglot
    const isCsv = job.enrichedFilePath.endsWith('.csv');
    res.set({
      'Content-Type': isCsv
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="pc02-bulk-${jobId}.${isCsv ? 'csv' : 'xlsx'}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  }

  @Get(':id/handover-pdfs.zip')
  @RequirePermissions({ action: 'read', subject: 'User' })
  async downloadHandoverZip(
    @Param('id') jobId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const job = await this.bulkService.getJob(jobId, user.id, false);
    const path2 = await import('path');
    const TEMP_DIR = process.env.BULK_IMPORT_TEMP_DIR || '/tmp/pc02-bulk';
    const zipPath = path2.join(TEMP_DIR, `${jobId}-handover.zip`);

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(zipPath);
    } catch {
      throw new NotFoundException('File ZIP chưa sẵn sàng hoặc đã hết hạn.');
    }

    await this.bulkService.incrementDownloadCount(jobId);
    await this.audit.log({
      userId: user.id,
      action: 'ENROLLMENT_LINKS_EXPORTED',
      subject: 'BulkImportJob',
      subjectId: jobId,
      metadata: { fileType: 'pdf_zip', linkCount: job.successRows },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="pc02-handover-${jobId}.zip"`,
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  }
}

@Controller('admin/users/bulk-import')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BulkImportTemplateController {
  @Get('template.xlsx')
  @RequirePermissions({ action: 'write', subject: 'User' })
  async downloadTemplate(@Res({ passthrough: false }) res: Response) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Danh sách');
    ws.columns = [
      { header: 'Họ tên', key: 'fullName', width: 22 },
      { header: 'Số hiệu', key: 'workId', width: 12 },
      { header: 'SĐT', key: 'phone', width: 14 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Username', key: 'username', width: 18 },
      { header: 'Vai trò', key: 'role', width: 14 },
      { header: 'Đơn vị', key: 'department', width: 22 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.addRow({
      fullName: 'Hoàng Công Tùng',
      workId: '277-794',
      phone: '0909225525',
      email: 'tung@pc02.local',
      username: 'tungh',
      role: 'OFFICER',
      department: 'Tổ 2 Đội 1',
    });
    ws.addRow({
      fullName: 'Trần Văn A',
      workId: '277-001',
      phone: '0903389799',
      username: 'avantran',
      role: 'OFFICER',
      department: 'Tổ 2 Đội 1',
    });

    const guide = wb.addWorksheet('Hướng dẫn');
    guide.addRow(['HƯỚNG DẪN IMPORT USER']);
    guide.addRow(['']);
    guide.addRow(['1. Điền danh sách cán bộ vào sheet "Danh sách"']);
    guide.addRow(['2. Bắt buộc: Username + ít nhất 1 trong (Số hiệu / SĐT / Email)']);
    guide.addRow(['3. Vai trò: OFFICER, INVESTIGATOR, TEAM_LEADER, ADMIN (theo seed)']);
    guide.addRow(['4. Upload file → preview → confirm → tải file Excel có link đăng ký']);
    guide.addRow(['5. Link hết hạn sau 72h — copy paste vào Zalo/SMS gửi cán bộ ngay']);

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="pc02-user-import-template.xlsx"',
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  }
}
