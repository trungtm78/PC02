import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  parseBulkImportFile,
  splitFullName,
  normalizePhone,
  type RawRow,
} from './bulk-import.parser';
import { ROLE_NAMES } from '../../common/constants/role.constants';

export interface PreviewRow {
  rowIndex: number;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  workId: string | null;
  phone: string | null;
  email: string | null;
  roleName: string | null;
  roleId: string | null;
  departmentName: string | null;
  departmentId: string | null;
  warnings: string[];
  errors: string[];
}

export interface PreviewResult {
  previewToken: string;
  rows: PreviewRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  headerMapping: Record<string, string>;
  sheetName: string;
  globalWarnings: string[];
}

const TEMP_DIR = process.env.BULK_IMPORT_TEMP_DIR || '/tmp/pc02-bulk';
const MAX_ROWS = Number(process.env.BULK_IMPORT_MAX_ROWS || 100);
const MAX_FILE_SIZE_BYTES = Number(process.env.BULK_IMPORT_MAX_FILE_SIZE_MB || 2) * 1024 * 1024;
const PREVIEW_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 phút
const JOB_TTL_MS = 24 * 60 * 60 * 1000; // 24h

@Injectable()
export class BulkImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Parse uploaded file → validate rows → return preview JSON.
   * Lưu original file vào temp dir với previewToken làm key (TTL 30 phút).
   * Admin có thể edit rows trong UI rồi POST confirm với previewToken.
   */
  async previewUpload(
    file: { buffer: Buffer; originalname: string; size: number; mimetype: string },
    actorId: string,
  ): Promise<PreviewResult> {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File quá lớn (>${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB). Vui lòng giảm số dòng hoặc compress.`,
      );
    }

    const lowerName = file.originalname.toLowerCase();
    const isXlsx = lowerName.endsWith('.xlsx');
    const isCsv = lowerName.endsWith('.csv');
    if (!isXlsx && !isCsv) {
      throw new BadRequestException('Chỉ hỗ trợ file .xlsx hoặc .csv');
    }

    // Magic-byte validation cho xlsx (= ZIP magic 50 4B 03 04)
    if (isXlsx) {
      const magic = file.buffer.subarray(0, 4);
      if (magic[0] !== 0x50 || magic[1] !== 0x4b || magic[2] !== 0x03 || magic[3] !== 0x04) {
        throw new BadRequestException('File xlsx không hợp lệ (magic byte mismatch).');
      }
    }

    const parsed = await parseBulkImportFile(file.buffer, file.originalname);

    if (parsed.rows.length === 0) {
      throw new BadRequestException('File không có dữ liệu (0 dòng có data).');
    }
    if (parsed.rows.length > MAX_ROWS) {
      throw new BadRequestException(
        `File quá nhiều dòng (${parsed.rows.length} > ${MAX_ROWS}). Vui lòng chia nhỏ.`,
      );
    }

    // Save original file → temp dir cho confirm bước sau
    await fs.mkdir(TEMP_DIR, { recursive: true });
    const previewToken = crypto.randomUUID();
    const tempFilePath = path.join(TEMP_DIR, `${previewToken}.${isXlsx ? 'xlsx' : 'csv'}`);
    await fs.writeFile(tempFilePath, file.buffer, { mode: 0o600 });

    // Validate rows + enrich với roleId/departmentId
    const previewRows = await this.validateRows(parsed.rows);

    const errorRows = previewRows.filter((r) => r.errors.length > 0).length;
    const validRows = previewRows.length - errorRows;

    await this.audit.log({
      userId: actorId,
      action: 'BULK_IMPORT_PREVIEWED',
      subject: 'BulkImportJob',
      subjectId: previewToken,
      metadata: {
        filename: file.originalname,
        totalRows: previewRows.length,
        validRows,
        errorRows,
      },
    });

    return {
      previewToken,
      rows: previewRows,
      totalRows: previewRows.length,
      validRows,
      errorRows,
      headerMapping: parsed.headerMapping,
      sheetName: parsed.sheetName,
      globalWarnings: parsed.warnings,
    };
  }

  private async validateRows(raws: RawRow[]): Promise<PreviewRow[]> {
    // Pre-fetch DB state: existing username/email/workId
    const usernames = raws.map((r) => r.username).filter(Boolean) as string[];
    const emails = raws.map((r) => r.email).filter(Boolean) as string[];
    const workIds = raws.map((r) => r.workId).filter(Boolean) as string[];

    const orClauses: Record<string, unknown>[] = [];
    if (usernames.length) orClauses.push({ username: { in: usernames } });
    if (emails.length) orClauses.push({ email: { in: emails } });
    if (workIds.length) orClauses.push({ workId: { in: workIds } });

    const existingUsers = orClauses.length
      ? await this.prisma.user.findMany({
          where: { OR: orClauses },
          select: { username: true, email: true, workId: true },
        })
      : [];
    const existingUsernames = new Set(existingUsers.map((u) => u.username));
    const existingEmails = new Set(existingUsers.map((u) => u.email).filter(Boolean));
    const existingWorkIds = new Set(existingUsers.map((u) => u.workId).filter(Boolean));

    // Resolve role + department names
    const roles = await this.prisma.role.findMany({ select: { id: true, name: true } });
    const roleNameMap = new Map(roles.map((r) => [r.name.toLowerCase(), r.id]));
    const defaultRoleId =
      roles.find((r) => r.name === ROLE_NAMES.INVESTIGATOR)?.id ?? roles[0]?.id;

    const departments = await this.prisma.directory.findMany({
      where: { type: 'DEPARTMENT' },
      select: { id: true, name: true },
    });
    const deptNameMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));

    // Cross-batch dup tracking
    const seenUsernames = new Set<string>();
    const seenEmails = new Set<string>();
    const seenWorkIds = new Set<string>();

    return raws.map((raw): PreviewRow => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const { firstName, lastName } = splitFullName(raw.fullName);
      const phone = raw.phone ? normalizePhone(raw.phone) : null;
      if (raw.phone && !phone) {
        warnings.push(`SĐT "${raw.phone}" không đúng định dạng — bỏ qua field`);
      }

      // ≥1 of workId/phone/email
      if (!raw.workId && !phone && !raw.email) {
        errors.push('Phải có ít nhất 1 trong: số hiệu / SĐT / email');
      }

      // workId format hint (warn only)
      if (raw.workId && !/^\d{3}-\d{3}$/.test(raw.workId)) {
        warnings.push(`Số hiệu "${raw.workId}" nên dạng XXX-XXX (vd: 277-794)`);
      }

      // Username required (no auto-gen Phase 0)
      if (!raw.username) {
        errors.push('Thiếu username (tài khoản đăng nhập)');
      } else {
        if (!/^[a-z0-9_]{3,20}$/.test(raw.username)) {
          errors.push(`Username "${raw.username}" sai định dạng (3-20 ký tự chữ thường + số + _)`);
        }
        if (existingUsernames.has(raw.username)) {
          errors.push(`Username "${raw.username}" đã tồn tại trong DB`);
        }
        if (seenUsernames.has(raw.username)) {
          errors.push(`Username "${raw.username}" trùng với dòng khác trong file`);
        } else {
          seenUsernames.add(raw.username);
        }
      }

      if (raw.email) {
        if (existingEmails.has(raw.email)) {
          errors.push(`Email "${raw.email}" đã tồn tại trong DB`);
        }
        if (seenEmails.has(raw.email)) {
          errors.push(`Email "${raw.email}" trùng với dòng khác trong file`);
        } else {
          seenEmails.add(raw.email);
        }
      }

      if (raw.workId) {
        if (existingWorkIds.has(raw.workId)) {
          errors.push(`Số hiệu "${raw.workId}" đã tồn tại trong DB`);
        }
        if (seenWorkIds.has(raw.workId)) {
          errors.push(`Số hiệu "${raw.workId}" trùng với dòng khác trong file`);
        } else {
          seenWorkIds.add(raw.workId);
        }
      }

      // Resolve role
      let roleId: string | null = null;
      if (raw.roleName) {
        roleId = roleNameMap.get(raw.roleName.toLowerCase()) ?? null;
        if (!roleId) {
          warnings.push(`Vai trò "${raw.roleName}" không tồn tại — dùng mặc định OFFICER`);
          roleId = defaultRoleId ?? null;
        }
      } else {
        roleId = defaultRoleId ?? null;
      }
      if (!roleId) {
        errors.push('Không tìm thấy role nào trong DB (chưa seed?)');
      }

      // Resolve department (optional)
      let departmentId: string | null = null;
      if (raw.departmentName) {
        departmentId = deptNameMap.get(raw.departmentName.toLowerCase()) ?? null;
        if (!departmentId) {
          warnings.push(`Đơn vị "${raw.departmentName}" không tồn tại — bỏ qua`);
        }
      }

      return {
        rowIndex: raw.rowIndex,
        fullName: raw.fullName ?? null,
        firstName,
        lastName,
        username: raw.username ?? null,
        workId: raw.workId ?? null,
        phone,
        email: raw.email ?? null,
        roleName: raw.roleName ?? null,
        roleId,
        departmentName: raw.departmentName ?? null,
        departmentId,
        warnings,
        errors,
      };
    });
  }

  async loadOriginalFile(previewToken: string): Promise<Buffer | null> {
    // Validate UUID format (anti-path-traversal)
    if (!/^[0-9a-f-]{36}$/i.test(previewToken)) return null;
    for (const ext of ['xlsx', 'csv']) {
      const filePath = path.join(TEMP_DIR, `${previewToken}.${ext}`);
      try {
        const stat = await fs.stat(filePath);
        if (Date.now() - stat.mtimeMs > PREVIEW_TOKEN_TTL_MS) {
          await fs.unlink(filePath).catch(() => {});
          return null;
        }
        return await fs.readFile(filePath);
      } catch {
        // try next ext
      }
    }
    return null;
  }

  async createJobRecord(
    actorId: string,
    sourceFilename: string,
    sourceSha256: string,
    totalRows: number,
  ): Promise<{ id: string }> {
    const job = await this.prisma.bulkImportJob.create({
      data: {
        generatedBy: actorId,
        sourceFilename,
        sourceSha256,
        totalRows,
        status: 'queued',
        expiresAt: new Date(Date.now() + JOB_TTL_MS),
      },
      select: { id: true },
    });
    return job;
  }

  async getJob(jobId: string, actorId: string, isAdmin: boolean) {
    const job = await this.prisma.bulkImportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job không tồn tại');
    // IDOR fix: only generator can read job. Admin role không bypass (E6).
    if (job.generatedBy !== actorId && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền xem job này');
    }
    return job;
  }

  async incrementDownloadCount(jobId: string) {
    await this.prisma.bulkImportJob.update({
      where: { id: jobId },
      data: { downloadCount: { increment: 1 } },
    });
  }

  /**
   * Compute SHA-256 cho integrity audit.
   */
  computeSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}
