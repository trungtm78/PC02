/**
 * v0.47 PR5 — Xlsx import orchestration service.
 *
 * Flow per Codex CRITICAL #3:
 *   upload buffer → SHA → dedupe check → magic bytes → size cap → zip-bomb
 *     → write immutable to disk → create XlsxImportLog (status=PARSED)
 *     → parse to staging (parser writes ONLY to xlsx_import_staging)
 *     → return logId for the eventual PR6 dual-confirm commit flow
 *
 * NO endpoint here mutates real domain tables. Commit is PR6.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadStorageService } from './upload-storage.service';
import { XlsxParserService } from './xlsx-parser.service';
import {
  assertMagicBytes,
  assertCompressedSize,
  assertNoZipBomb,
  computeSha256,
  HostileXlsxError,
} from './hostile-xlsx-guard';
import { ROLE_NAMES } from '../common/constants/role.constants';

interface ActorContext {
  id: string;
  role: string;
  unitCode?: string | null;
}

/**
 * Filename → unit code. Patterns observed in the FILE GUI PC01 sample:
 *   "DOI6 - Mẫu phụ lục 1-6.xlsx"     → DOI6
 *   "KV7 - phụ lục.xlsx"              → KV7
 *   "CS1 phụ lục 1-6 .xlsx"           → CS1
 *   "Đội 3 - mẫu.xlsx"                → DOI3
 * Returns null for unmappable filenames (caller picks up via dropdown in PR6 UI).
 */
function extractUnitCode(filename: string): string | null {
  const normalized = filename
    .normalize('NFC')
    .replace(/Đ/gi, 'D') // strip diacritics on the key letter only
    .replace(/Ộ/gi, 'O');
  const match =
    normalized.match(/\b(DOI|KV|CS|PC|CSGT)\s*(\d{1,2})\b/i) ||
    normalized.match(/\bDOI(\d{1,2})\b/i);
  if (!match) return null;
  if (match[2]) return `${match[1].toUpperCase()}${match[2]}`;
  return `DOI${match[1]}`;
}

@Injectable()
export class XlsxImportsService {
  private readonly logger = new Logger(XlsxImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: UploadStorageService,
    private readonly parser: XlsxParserService,
  ) {}

  /**
   * Ingest a freshly-uploaded xlsx buffer. Returns the XlsxImportLog row
   * (with staging row counts). Idempotent: identical content reuses
   * the prior log row, never writes a second copy.
   */
  async ingest(
    buffer: Buffer,
    originalFilename: string,
    actor: ActorContext,
  ): Promise<{
    logId: string;
    sha: string;
    dedupeHit: boolean;
    unitCodeDetected: string | null;
    succeededRows: number;
    sheetsParsed: string[];
  }> {
    // 1. RBAC — admin or records officer only. Unit-scope is enforced at
    //    commit time (PR6); upload itself is admin-gated.
    if (actor.role !== ROLE_NAMES.ADMIN) {
      throw new ForbiddenException(
        'Chỉ quản trị viên được upload xlsx import. (PR5: dual-confirm còn ở PR6.)',
      );
    }

    // 2. Validate the buffer BEFORE any disk write.
    assertCompressedSize(buffer);
    try {
      await assertMagicBytes(buffer);
      assertNoZipBomb(buffer);
    } catch (err) {
      if (err instanceof HostileXlsxError) {
        this.logger.warn(
          `Hostile xlsx rejected: code=${err.code} actor=${actor.id} file="${originalFilename}"`,
        );
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    // 3. SHA-based dedupe.
    const sha = computeSha256(buffer);
    const existing = await this.prisma.xlsxImportLog.findUnique({
      where: { fileSha: sha },
    });
    if (existing) {
      this.logger.log(
        `xlsx dedupe hit — sha=${sha.slice(0, 12)}… existingLog=${existing.id} actor=${actor.id}`,
      );
      return {
        logId: existing.id,
        sha,
        dedupeHit: true,
        unitCodeDetected: existing.unitCodeDetected,
        succeededRows: existing.succeededRows,
        sheetsParsed: [], // no re-parse on dedupe
      };
    }

    // 4. Persist immutable raw.
    await this.storage.writeImmutable(sha, buffer);

    // 5. Unit code extraction (best-effort; UI overrides at commit time).
    const unitCodeDetected = extractUnitCode(originalFilename);

    // 6. Create the XlsxImportLog row + parse to staging in one logical unit.
    //    We DO NOT wrap parse-to-staging in a single transaction because
    //    staging rows are many and exceljs streaming can take seconds —
    //    the row is created first so a long-running parse can be observed
    //    by admins; status moves PARSED → ... at PR6 commit time.
    const log = await this.prisma.xlsxImportLog.create({
      data: {
        sourceFile: originalFilename,
        fileSize: buffer.byteLength,
        fileSha: sha,
        uploadedById: actor.id,
        unitCodeDetected,
        status: 'PARSED',
        succeededRows: 0,
      },
    });

    try {
      const result = await this.parser.parseToStaging(buffer, log.id);
      await this.prisma.xlsxImportLog.update({
        where: { id: log.id },
        data: { succeededRows: result.totalRowsStaged },
      });
      this.logger.log(
        `xlsx ingest OK — logId=${log.id} sha=${sha.slice(0, 12)}… rows=${result.totalRowsStaged}`,
      );
      return {
        logId: log.id,
        sha,
        dedupeHit: false,
        unitCodeDetected,
        succeededRows: result.totalRowsStaged,
        sheetsParsed: result.sheetsParsed,
      };
    } catch (err) {
      // Parser failed mid-flight. Mark log as FAILED with error detail.
      // Staging rows from earlier sheets stay (Cascade on importLog delete
      // cleans them if admin chooses to wipe). Raw file stays for forensics.
      const message =
        err instanceof HostileXlsxError ? err.message : (err as Error).message;
      await this.prisma.xlsxImportLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          errorDetail: { code: err instanceof HostileXlsxError ? err.code : 'PARSER_ERROR', message },
        },
      });
      if (err instanceof HostileXlsxError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  /**
   * Lookup a single log + staging summary. Read-only.
   * Admin can see all; non-admin only their own uploads.
   */
  async getLog(id: string, actor: ActorContext) {
    const log = await this.prisma.xlsxImportLog.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { staging: true } },
      },
    });
    if (!log) throw new NotFoundException('Import log không tồn tại.');
    if (actor.role !== ROLE_NAMES.ADMIN && log.uploadedById !== actor.id) {
      throw new ForbiddenException('Bạn không có quyền xem import này.');
    }
    return log;
  }

  /**
   * List recent uploads. Admin: all. Non-admin: own only.
   */
  async listLogs(actor: ActorContext, limit = 50) {
    return this.prisma.xlsxImportLog.findMany({
      where: actor.role === ROLE_NAMES.ADMIN ? {} : { uploadedById: actor.id },
      orderBy: { uploadedAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { staging: true } },
      },
    });
  }
}

// Expose the filename helper for unit tests
export const _internal = { extractUnitCode };
