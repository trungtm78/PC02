/**
 * v0.47 PR6 — Track B Import Part 2: dry-run + dual-confirm commit + rollback.
 *
 * Iron rules (per Codex CRITICAL final review):
 *   1. Commit requires TWO different admins approving within 24h (Codex #7).
 *   2. Every materialised Case/Incident row carries importLogId (provenance).
 *   3. Rollback cascades delete via importLogId on the row, NOT on log delete.
 *      (Schema is SetNull on log delete so we never orphan investigations
 *      after a log row gets wiped.) We delete the rows explicitly here.
 *   4. Dry-run preview MUST match commit output (snapshot invariant). The
 *      same `mapSheetToSkeletons` runs in both paths.
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
import { ROLE_NAMES } from '../common/constants/role.constants';
import {
  DUAL_CONFIRM_TTL_MS,
  DRYRUN_SAMPLE_ROWS_PER_SHEET,
  IMPORT_SOURCE_TAG,
  IMPORT_DEFAULT_CASE_PROVENANCE,
  XLSX_IMPORT_STATUS,
} from './commit.constants';
import { mapSheetToSkeletons, SkeletonRow } from './payload-mapper';

interface ActorContext {
  id: string;
  role: string;
  unitCode?: string | null;
}

interface SheetPreview {
  sheetName: string;
  detectedType: string | null;
  rowCount: number;
  sample: Array<{ rowIndex: number; payload: Record<string, unknown> }>;
}

interface ConflictRow {
  rowIndex: number;
  sheetName: string;
  reason: string;
  candidateCode?: string;
  existingId?: string;
}

export interface DryRunResult {
  logId: string;
  status: string;
  sourceFile: string;
  unitCodeDetected: string | null;
  uploadedBy: { id: string; firstName: string | null; lastName: string | null };
  uploadedAt: Date;
  totalRows: number;
  sheets: SheetPreview[];
  conflicts: ConflictRow[];
  firstConfirm: { byId: string; at: Date } | null;
  secondConfirmEligibleAt: Date | null;
}

@Injectable()
export class XlsxImportCommitService {
  private readonly logger = new Logger(XlsxImportCommitService.name);

  constructor(private readonly prisma: PrismaService) {}

  private requireAdmin(actor: ActorContext) {
    if (actor.role !== ROLE_NAMES.ADMIN) {
      throw new ForbiddenException(
        'Chỉ quản trị viên được xử lý xlsx import (PR6 commit/rollback).',
      );
    }
  }

  /**
   * Read staging rows + detect conflicts. Does not mutate anything.
   */
  async dryRun(logId: string, actor: ActorContext): Promise<DryRunResult> {
    this.requireAdmin(actor);

    const log = await this.prisma.xlsxImportLog.findUnique({
      where: { id: logId },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!log) throw new NotFoundException('Import log không tồn tại.');

    const staging = await this.prisma.xlsxImportStaging.findMany({
      where: { importLogId: logId },
      orderBy: [{ sheetName: 'asc' }, { rowIndex: 'asc' }],
    });

    // Group by sheet
    const bySheet = new Map<
      string,
      Array<{
        rowIndex: number;
        payload: Record<string, unknown>;
        detectedType: string | null;
      }>
    >();
    for (const row of staging) {
      const list = bySheet.get(row.sheetName) ?? [];
      list.push({
        rowIndex: row.rowIndex,
        payload: row.payload as Record<string, unknown>,
        detectedType: row.detectedType,
      });
      bySheet.set(row.sheetName, list);
    }

    const sheets: SheetPreview[] = [];
    const conflicts: ConflictRow[] = [];

    for (const [sheetName, rows] of bySheet.entries()) {
      const detectedType = rows[0]?.detectedType ?? null;
      sheets.push({
        sheetName,
        detectedType,
        rowCount: rows.length,
        sample: rows.slice(0, DRYRUN_SAMPLE_ROWS_PER_SHEET).map((r) => ({
          rowIndex: r.rowIndex,
          payload: r.payload,
        })),
      });

      // Conflict detection — duplicate caseCode/incidentCode against existing rows
      const skeletons = mapSheetToSkeletons(rows);
      const codes = skeletons.map((s) => s.code).filter((c): c is string => !!c);
      if (codes.length > 0) {
        if (detectedType === 'Case') {
          const existing = await this.prisma.case.findMany({
            where: { caseCode: { in: codes }, deletedAt: null },
            select: { id: true, caseCode: true, unit: true },
          });
          for (const e of existing) {
            const skel = skeletons.find((s) => s.code === e.caseCode);
            if (!skel) continue;
            const reason =
              e.unit && log.unitCodeDetected && e.unit !== log.unitCodeDetected
                ? 'unit_mismatch'
                : 'duplicate_id';
            conflicts.push({
              rowIndex: skel.rowIndex,
              sheetName,
              reason,
              candidateCode: e.caseCode ?? undefined,
              existingId: e.id,
            });
          }
        } else if (detectedType === 'Incident') {
          const existing = await this.prisma.incident.findMany({
            where: { code: { in: codes } },
            select: { id: true, code: true, unitId: true },
          });
          for (const e of existing) {
            const skel = skeletons.find((s) => s.code === e.code);
            if (!skel) continue;
            conflicts.push({
              rowIndex: skel.rowIndex,
              sheetName,
              reason: 'duplicate_id',
              candidateCode: e.code,
              existingId: e.id,
            });
          }
        }
      }
    }

    return {
      logId: log.id,
      status: log.status,
      sourceFile: log.sourceFile,
      unitCodeDetected: log.unitCodeDetected,
      uploadedBy: log.uploadedBy,
      uploadedAt: log.uploadedAt,
      totalRows: staging.length,
      sheets,
      conflicts,
      firstConfirm: log.firstConfirmById
        ? { byId: log.firstConfirmById, at: log.firstConfirmAt! }
        : null,
      secondConfirmEligibleAt: log.firstConfirmAt
        ? new Date(log.firstConfirmAt.getTime() + DUAL_CONFIRM_TTL_MS)
        : null,
    };
  }

  /**
   * Dual-confirm commit.
   *
   * - Call 1 by admin A: log status → PENDING_SECOND_CONFIRM, firstConfirmBy/At set.
   * - Call 2 by admin B (B ≠ A, within 24h): materialise staging → Case/Incident,
   *   set status COMMITTED + secondConfirmBy/At + succeededRows. Same admin
   *   cannot self-confirm. Window past 24h rejects with 410 — must re-stage.
   */
  async commit(
    logId: string,
    actor: ActorContext,
  ): Promise<{
    status: string;
    requiresSecondConfirm: boolean;
    materialisedCases: number;
    materialisedIncidents: number;
  }> {
    this.requireAdmin(actor);

    const log = await this.prisma.xlsxImportLog.findUnique({ where: { id: logId } });
    if (!log) throw new NotFoundException('Import log không tồn tại.');

    if (log.status === XLSX_IMPORT_STATUS.COMMITTED) {
      throw new ConflictException('Import này đã commit. Dùng rollback nếu cần huỷ.');
    }
    if (log.status === XLSX_IMPORT_STATUS.ROLLED_BACK) {
      throw new ConflictException('Import này đã rollback — không thể commit lại. Upload lại file.');
    }
    if (log.status === XLSX_IMPORT_STATUS.FAILED) {
      throw new ConflictException(
        'Parser thất bại trên import này — staging rỗng, không thể commit.',
      );
    }

    // First confirm path
    if (log.status === XLSX_IMPORT_STATUS.PARSED) {
      await this.prisma.xlsxImportLog.update({
        where: { id: logId },
        data: {
          status: XLSX_IMPORT_STATUS.PENDING_SECOND_CONFIRM,
          firstConfirmById: actor.id,
          firstConfirmAt: new Date(),
        },
      });
      this.logger.log(
        `xlsx import first-confirm — logId=${logId} admin=${actor.id} (awaiting second)`,
      );
      return {
        status: XLSX_IMPORT_STATUS.PENDING_SECOND_CONFIRM,
        requiresSecondConfirm: true,
        materialisedCases: 0,
        materialisedIncidents: 0,
      };
    }

    // PENDING_SECOND_CONFIRM path — verify dual-confirm rules
    if (log.status !== XLSX_IMPORT_STATUS.PENDING_SECOND_CONFIRM) {
      throw new ConflictException(`Trạng thái không hợp lệ: ${log.status}`);
    }
    if (!log.firstConfirmById || !log.firstConfirmAt) {
      throw new ConflictException(
        'Trạng thái PENDING_SECOND_CONFIRM nhưng thiếu firstConfirm — dữ liệu hỏng.',
      );
    }
    if (log.firstConfirmById === actor.id) {
      throw new ConflictException(
        'Cùng một quản trị viên không thể tự xác nhận lần 2. Yêu cầu admin khác.',
      );
    }
    const elapsedMs = Date.now() - log.firstConfirmAt.getTime();
    if (elapsedMs > DUAL_CONFIRM_TTL_MS) {
      // 410 Gone semantically — but Nest's ConflictException is closer to 409
      // and admins UI can map either way. We use 410 via Bad Request with a
      // specific code so the frontend can prompt to re-stage.
      throw new BadRequestException({
        code: 'DUAL_CONFIRM_TTL_EXPIRED',
        message:
          'Quá 24h từ xác nhận lần 1 — buộc phải upload lại file để xác nhận mới.',
      });
    }

    // Materialise staging → Case/Incident in a single transaction so rollback is atomic.
    const staging = await this.prisma.xlsxImportStaging.findMany({
      where: { importLogId: logId },
      orderBy: [{ sheetName: 'asc' }, { rowIndex: 'asc' }],
    });

    const bySheet = new Map<
      string,
      Array<{
        rowIndex: number;
        payload: Record<string, unknown>;
        detectedType: string | null;
      }>
    >();
    for (const row of staging) {
      const list = bySheet.get(row.sheetName) ?? [];
      list.push({
        rowIndex: row.rowIndex,
        payload: row.payload as Record<string, unknown>,
        detectedType: row.detectedType,
      });
      bySheet.set(row.sheetName, list);
    }

    let materialisedCases = 0;
    let materialisedIncidents = 0;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const [sheetName, rows] of bySheet.entries()) {
        const detectedType = rows[0]?.detectedType;
        if (!detectedType) continue; // skip unmappable sheets entirely

        const skeletons = mapSheetToSkeletons(rows);
        for (const skel of skeletons) {
          if (detectedType === 'Case') {
            await tx.case.create({
              data: {
                name: skel.name,
                caseProvenance: IMPORT_DEFAULT_CASE_PROVENANCE as 'TRANSFERRED',
                caseCode: skel.code ?? null,
                metadata: skel.metadata as never,
                unit: log.unitCodeDetected,
                importedFrom: IMPORT_SOURCE_TAG,
                importedAt: now,
                importedById: actor.id,
                sourceFile: log.sourceFile,
                importLogId: logId,
              },
            });
            materialisedCases++;
          } else if (detectedType === 'Incident') {
            await tx.incident.create({
              data: {
                name: skel.name,
                // Incident.code is @unique — fall back to a deterministic
                // import-tagged code if the xlsx didn't supply one.
                code: skel.code ?? `VV-IMP-${logId.slice(0, 8)}-${skel.rowIndex}`,
                importedFrom: IMPORT_SOURCE_TAG,
                importedAt: now,
                importedById: actor.id,
                sourceFile: log.sourceFile,
                importLogId: logId,
              },
            });
            materialisedIncidents++;
          }
        }
      }

      await tx.xlsxImportLog.update({
        where: { id: logId },
        data: {
          status: XLSX_IMPORT_STATUS.COMMITTED,
          secondConfirmById: actor.id,
          secondConfirmAt: now,
          succeededRows: materialisedCases + materialisedIncidents,
        },
      });
    });

    this.logger.log(
      `xlsx import COMMITTED — logId=${logId} firstAdmin=${log.firstConfirmById} secondAdmin=${actor.id} cases=${materialisedCases} incidents=${materialisedIncidents}`,
    );

    return {
      status: XLSX_IMPORT_STATUS.COMMITTED,
      requiresSecondConfirm: false,
      materialisedCases,
      materialisedIncidents,
    };
  }

  /**
   * Rollback a previously committed import. Cascades delete on Case/Incident
   * rows tagged with this importLogId, then marks the log ROLLED_BACK with
   * the actor + timestamp in the audit fields.
   *
   * Only PARSED, PENDING_SECOND_CONFIRM, or COMMITTED logs can be rolled back.
   * FAILED logs are already cleaned up (no staging rows, no domain rows).
   * ROLLED_BACK logs cannot be rolled back twice.
   */
  async rollback(
    logId: string,
    actor: ActorContext,
  ): Promise<{
    status: string;
    deletedCases: number;
    deletedIncidents: number;
    deletedStaging: number;
  }> {
    this.requireAdmin(actor);

    const log = await this.prisma.xlsxImportLog.findUnique({ where: { id: logId } });
    if (!log) throw new NotFoundException('Import log không tồn tại.');

    if (log.status === XLSX_IMPORT_STATUS.ROLLED_BACK) {
      throw new ConflictException('Import này đã rollback rồi.');
    }
    if (log.status === XLSX_IMPORT_STATUS.FAILED) {
      throw new ConflictException(
        'Parser thất bại — không có dữ liệu để rollback. Có thể xoá log thẳng.',
      );
    }

    let deletedCases = 0;
    let deletedIncidents = 0;
    let deletedStaging = 0;

    await this.prisma.$transaction(async (tx) => {
      const caseDel = await tx.case.deleteMany({ where: { importLogId: logId } });
      deletedCases = caseDel.count;
      const incidentDel = await tx.incident.deleteMany({ where: { importLogId: logId } });
      deletedIncidents = incidentDel.count;
      const stagingDel = await tx.xlsxImportStaging.deleteMany({ where: { importLogId: logId } });
      deletedStaging = stagingDel.count;

      await tx.xlsxImportLog.update({
        where: { id: logId },
        data: {
          status: XLSX_IMPORT_STATUS.ROLLED_BACK,
          rolledBackById: actor.id,
          rolledBackAt: new Date(),
        },
      });
    });

    this.logger.log(
      `xlsx import ROLLED_BACK — logId=${logId} admin=${actor.id} cases=${deletedCases} incidents=${deletedIncidents} staging=${deletedStaging}`,
    );

    return {
      status: XLSX_IMPORT_STATUS.ROLLED_BACK,
      deletedCases,
      deletedIncidents,
      deletedStaging,
    };
  }
}
