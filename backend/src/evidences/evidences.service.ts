import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { UpdateEvidenceDto } from './dto/update-evidence.dto';
import { QueryEvidencesDto } from './dto/query-evidences.dto';
import { EVIDENCE_STATUS } from '../common/constants/evidence-status.constants';
import type { DataScope } from '../auth/services/unit-scope.service';
import {
  assertParentInScope,
  buildScopeFilter,
} from '../common/utils/scope-filter.util';

/**
 * Vật chứng (physical evidence held against a case).
 *
 * Context for why this module exists at all: `Evidence` rows have been written
 * since the case-creation form shipped (`cases.service.ts`
 * createSubEntitiesInTransaction), but nothing ever read them back. There was
 * no `include: { evidences: ... }` anywhere in the codebase, so an officer
 * could record seized items and never see them again.
 */
@Injectable()
export class EvidencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * A soft-deleted case takes its evidence with it.
   *
   * Without this, deleting a case left its seized items listable, editable and
   * restorable — and a restore could put a live child under a parent that no
   * longer exists as far as every other screen is concerned. `case` is a
   * required relation on Evidence, so filtering on it never hides an orphan.
   */
  private static readonly LIVE_CASE = { case: { deletedAt: null } } as const;

  /** Shared shape so list, detail and mutations agree on what a client gets. */
  private static readonly SELECT = {
    id: true,
    code: true,
    name: true,
    description: true,
    quantity: true,
    unit: true,
    storageLocation: true,
    receivedDate: true,
    status: true,
    evidenceType: true,
    entryOrder: true,
    warehouseReceipt: true,
    caseId: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
    case: { select: { id: true, name: true, caseCode: true, status: true } },
  } satisfies Prisma.EvidenceSelect;

  /** Parent-case predicate: live case, plus the caller's scope when they have one. */
  private static caseFilter(
    dataScope?: DataScope | null,
  ): Prisma.CaseWhereInput {
    const scope = buildScopeFilter(dataScope);
    return scope
      ? { AND: [scope, EvidencesService.LIVE_CASE.case] }
      : { ...EvidencesService.LIVE_CASE.case };
  }

  // ─────────────────────────────────────────────
  // GET LIST
  // ─────────────────────────────────────────────
  async getList(query: QueryEvidencesDto, dataScope?: DataScope | null) {
    const {
      search,
      caseId,
      status,
      evidenceType,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.EvidenceWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { storageLocation: { contains: search, mode: 'insensitive' } },
        { warehouseReceipt: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (caseId) where.caseId = caseId;
    if (status) where.status = status;
    if (evidenceType) where.evidenceType = evidenceType;

    where.case = EvidencesService.caseFilter(dataScope);

    const [data, total] = await Promise.all([
      this.prisma.evidence.findMany({
        where,
        select: EvidencesService.SELECT,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
      }),
      this.prisma.evidence.count({ where }),
    ]);

    return {
      success: true,
      data,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    };
  }

  // ─────────────────────────────────────────────
  // GET DETAIL
  // ─────────────────────────────────────────────
  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.evidence.findFirst({
      where: { id, deletedAt: null, ...EvidencesService.LIVE_CASE },
      include: {
        case: {
          select: {
            id: true,
            name: true,
            caseCode: true,
            status: true,
            assignedTeamId: true,
            investigatorId: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Vật chứng không tồn tại (id: ${id})`);
    }

    assertParentInScope(record.case, dataScope);

    return { success: true, data: record };
  }

  /**
   * Serialise evidence writes within one case, then run `fn`.
   *
   * `code` is unique per case, but that invariant lives in application code:
   * `Evidence` has no partial unique index, and adding one would fail the
   * migration outright if any of the 53k legacy rows already collide — a
   * reconciliation decision that belongs to the people who own the records,
   * not to this PR. See PROGRESS.md ND-13.
   *
   * Without serialisation the check and the write are two statements, so two
   * concurrent requests both read "no duplicate" and both insert. Taking a row
   * lock on the parent case makes evidence writes for that case queue behind
   * each other; writes to other cases are unaffected.
   */
  private async withCaseLock<T>(
    caseId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM cases WHERE id = ${caseId} FOR UPDATE`;
      return fn(tx);
    });
  }

  /** Load the parent case and assert the caller may write to it. */
  private async assertCaseWritable(
    caseId: string,
    dataScope?: DataScope | null,
  ) {
    const parentCase = await this.prisma.case.findFirst({
      where: { id: caseId, deletedAt: null },
      select: {
        id: true,
        name: true,
        assignedTeamId: true,
        investigatorId: true,
      },
    });
    if (!parentCase) {
      throw new BadRequestException(`Vụ án không tồn tại (id: ${caseId})`);
    }
    assertParentInScope(parentCase, dataScope, 'write');
    return parentCase;
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async create(
    dto: CreateEvidenceDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    await this.assertCaseWritable(dto.caseId, dataScope);

    // Mã vật chứng phải duy nhất trong phạm vi một vụ án — hai vụ khác nhau
    // được phép đánh trùng số, nhưng trùng trong cùng hồ sơ thì không phân biệt
    // nổi khi đối chiếu với biên bản nhập kho.
    const record = await this.withCaseLock(dto.caseId, async (tx) => {
      const duplicate = await tx.evidence.findFirst({
        where: { caseId: dto.caseId, code: dto.code, deletedAt: null },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(
          `Mã vật chứng "${dto.code}" đã tồn tại trong vụ án này`,
        );
      }

      return tx.evidence.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          quantity: dto.quantity ?? 1,
          unit: dto.unit ?? 'cái',
          storageLocation: dto.storageLocation,
          receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : null,
          status: dto.status ?? EVIDENCE_STATUS.THU_GIU,
          evidenceType: dto.evidenceType,
          entryOrder: dto.entryOrder,
          warehouseReceipt: dto.warehouseReceipt,
          caseId: dto.caseId,
          createdById: actorId,
        },
        select: EvidencesService.SELECT,
      });
    });

    await this.audit.log({
      userId: actorId,
      action: 'EVIDENCE_CREATED',
      subject: 'Evidence',
      subjectId: record.id,
      metadata: { code: record.code, name: record.name, caseId: record.caseId },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Thêm vật chứng thành công',
    };
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateEvidenceDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    assertParentInScope(existing.case, dataScope, 'write');

    const record = await this.withCaseLock(existing.caseId, async (tx) => {
      if (dto.code && dto.code !== existing.code) {
        const duplicate = await tx.evidence.findFirst({
          where: {
            caseId: existing.caseId,
            code: dto.code,
            deletedAt: null,
            NOT: { id },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new ConflictException(
            `Mã vật chứng "${dto.code}" đã tồn tại trong vụ án này`,
          );
        }
      }

      return tx.evidence.update({
        where: { id },
        data: {
          ...(dto.code !== undefined && { code: dto.code }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.quantity !== undefined && { quantity: dto.quantity }),
          ...(dto.unit !== undefined && { unit: dto.unit }),
          ...(dto.storageLocation !== undefined && {
            storageLocation: dto.storageLocation,
          }),
          ...(dto.receivedDate !== undefined && {
            receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : null,
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.evidenceType !== undefined && {
            evidenceType: dto.evidenceType,
          }),
          ...(dto.entryOrder !== undefined && { entryOrder: dto.entryOrder }),
          ...(dto.warehouseReceipt !== undefined && {
            warehouseReceipt: dto.warehouseReceipt,
          }),
        },
        select: EvidencesService.SELECT,
      });
    });

    await this.audit.log({
      userId: actorId,
      action: 'EVIDENCE_UPDATED',
      subject: 'Evidence',
      subjectId: id,
      metadata: {
        before: {
          code: existing.code,
          name: existing.name,
          status: existing.status,
          quantity: existing.quantity,
        },
        after: dto,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Cập nhật vật chứng thành công',
    };
  }

  // ─────────────────────────────────────────────
  // DELETE (soft)
  // ─────────────────────────────────────────────
  async delete(
    id: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    assertParentInScope(existing.case, dataScope, 'write');

    await this.prisma.evidence.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'EVIDENCE_DELETED',
      subject: 'Evidence',
      subjectId: id,
      metadata: {
        code: existing.code,
        name: existing.name,
        caseId: existing.caseId,
        softDelete: true,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Đã xóa vật chứng' };
  }

  // ─────────────────────────────────────────────
  // RESTORE
  // ─────────────────────────────────────────────
  // Evidence is legal proof. Without an undo path a mis-click means opening a
  // ticket for somebody with SSH access to run UPDATE on production — the exact
  // situation TODOS RESTORE-001 describes for the nine child entities that
  // shipped without one. This module does not add a tenth.

  async listDeleted(
    query: { limit?: number; offset?: number; search?: string },
    dataScope?: DataScope | null,
  ) {
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;
    const search = query.search?.trim();

    const where: Prisma.EvidenceWhereInput = {
      deletedAt: { not: null },
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    where.case = EvidencesService.caseFilter(dataScope);

    const [data, total] = await Promise.all([
      this.prisma.evidence.findMany({
        where,
        select: { ...EvidencesService.SELECT, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.evidence.count({ where }),
    ]);

    return { success: true, data, total, limit, offset };
  }

  async restore(
    id: string,
    reason: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const existing = await this.prisma.evidence.findFirst({
      where: {
        id,
        deletedAt: { not: null },
        // Restoring under a deleted case would produce a live child nothing
        // can navigate to. Undelete the case first.
        ...EvidencesService.LIVE_CASE,
      },
      include: {
        case: {
          select: {
            id: true,
            name: true,
            assignedTeamId: true,
            investigatorId: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(
        `Vật chứng không tồn tại hoặc chưa bị xóa (id: ${id})`,
      );
    }

    assertParentInScope(existing.case, dataScope, 'write');

    const hoursAfterDeletion =
      (Date.now() - existing.deletedAt!.getTime()) / 3_600_000;

    // One transaction, holding the case lock: the clash check and the restore
    // must not be separable, or a concurrent create can take the code between
    // them. The audit entry belongs in here too — a restore without one is
    // worse than no restore, because the record reappears unexplained.
    await this.withCaseLock(existing.caseId, async (tx) => {
      // Uniqueness is checked among live rows only, so a replacement can be
      // created under the same code while the original sits soft-deleted.
      // Restoring blindly would then leave two live VC-001 in one case, which
      // is exactly what the rule exists to prevent.
      const clash = await tx.evidence.findFirst({
        where: {
          caseId: existing.caseId,
          code: existing.code,
          deletedAt: null,
          NOT: { id },
        },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException(
          `Không thể khôi phục: mã vật chứng "${existing.code}" đang được dùng bởi một bản ghi khác trong vụ án này. Hãy đổi mã bản ghi đó trước.`,
        );
      }

      await tx.evidence.update({
        where: { id, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      await this.audit.log(
        {
          userId: actorId,
          action: 'EVIDENCE_RESTORED',
          subject: 'Evidence',
          subjectId: id,
          metadata: {
            code: existing.code,
            name: existing.name,
            reason,
            hoursAfterDeletion: Math.round(hoursAfterDeletion),
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );
    });

    return { success: true, message: 'Đã khôi phục vật chứng' };
  }
}
