import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import { Prisma, CaseStatus, PetitionStatus } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { buildScopeFilter } from '../common/utils/scope-filter.util';

type JsonInput = Prisma.InputJsonValue;
type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────────────────────────
  // GET LIST
  // ─────────────────────────────────────────────
  async getList(query: QueryCasesDto, dataScope?: DataScope | null) {
    const {
      search,
      status,
      investigatorId,
      unit,
      fromDate,
      toDate,
      overdue,
      districtId,
      wardId,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.CaseWhereInput = {
      deletedAt: null, // Only non-deleted records
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { crime: { contains: search, mode: 'insensitive' } },
        { unit: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (investigatorId) {
      where.investigatorId = investigatorId;
    }

    if (unit) {
      where.unit = unit;
    }

    if (fromDate) {
      where.createdAt = {
        ...(where.createdAt as Prisma.DateTimeFilter | undefined),
        gte: new Date(fromDate),
      };
    }

    if (toDate) {
      where.createdAt = {
        ...(where.createdAt as Prisma.DateTimeFilter | undefined),
        lte: new Date(toDate + 'T23:59:59.999Z'),
      };
    }

    // Filter quá hạn
    if (overdue === 'true') {
      where.deadline = { lt: new Date() };
      where.status = {
        notIn: [CaseStatus.DA_KET_LUAN, CaseStatus.DA_LUU_TRU, CaseStatus.DINH_CHI],
      };
    }

    // Filter theo quận/huyện hoặc phường/xã (qua subjects)
    if (districtId || wardId) {
      where.subjects = {
        some: {
          deletedAt: null,
          ...(districtId && { districtId }),
          ...(wardId && { wardId }),
        },
      };
    }

    // Apply data scope filter
    const scopeFilter = buildScopeFilter(dataScope);
    if (scopeFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        scopeFilter as Prisma.CaseWhereInput,
      ];
    }

    // Validate sortBy against allowed fields
    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'deadline', 'status'];
    const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.case.findMany({
        where,
        select: {
          id: true,
          name: true,
          crime: true,
          status: true,
          deadline: true,
          unit: true,
          subjectsCount: true,
          createdAt: true,
          updatedAt: true,
          investigator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
        orderBy: { [orderByField]: sortOrder },
        take: limit,
        skip: offset,
      }),
      this.prisma.case.count({ where }),
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
  private checkRecordInScope(
    record: { investigatorId?: string | null; assignedTeamId?: string | null },
    dataScope?: DataScope | null,
  ) {
    if (!dataScope) return; // admin or no scope = allow
    const { userIds, teamIds } = dataScope;

    const ownerMatch =
      record.investigatorId && userIds.includes(record.investigatorId);
    const teamMatch =
      record.assignedTeamId && teamIds.includes(record.assignedTeamId);
    const unassignedMatch =
      !record.assignedTeamId && teamIds.length > 0;

    if (!ownerMatch && !teamMatch && !unassignedMatch) {
      throw new ForbiddenException('Bạn không có quyền truy cập bản ghi này');
    }
  }

  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.case.findFirst({
      where: { id, deletedAt: null },
      include: {
        investigator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            email: true,
          },
        },
        petitions: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            stt: true,
            petitionType: true,
            status: true,
            senderName: true,
            receivedDate: true,
            createdAt: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Vụ án không tồn tại (id: ${id})`);
    }

    this.checkRecordInScope(record, dataScope);

    return { success: true, data: record };
  }

  // ─────────────────────────────────────────────
  // GENERATE STT (số tiếp nhận đơn thư)
  // ─────────────────────────────────────────────
  private async generateStt(tx: PrismaTx): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DT-${year}-`;

    const latest = await tx.petition.findFirst({
      where: { stt: { startsWith: prefix } },
      orderBy: { stt: 'desc' },
      select: { stt: true },
    });

    let seq = 1;
    if (latest) {
      const parts = latest.stt.split('-');
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async create(
    dto: CreateCaseDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    // Validate investigatorId if provided
    if (dto.investigatorId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.investigatorId },
      });
      if (!user) {
        throw new BadRequestException('Điều tra viên không tồn tại');
      }
    }

    const metadata = dto.metadata as Record<string, unknown> | undefined;
    const petitionType = metadata?.petitionType as string | undefined;

    // If petitionType exists, create Case + Petition atomically
    if (petitionType) {
      const { caseRecord, petition } = await this.prisma.$transaction(
        async (tx) => {
          const newCase = await tx.case.create({
            data: {
              name: dto.name,
              crime: dto.crime,
              status: dto.status ?? CaseStatus.TIEP_NHAN,
              investigatorId: dto.investigatorId,
              deadline: dto.deadline ? new Date(dto.deadline) : undefined,
              unit: dto.unit,
              subjectsCount: dto.subjectsCount ?? 0,
              ...(dto.metadata !== undefined && {
                metadata: dto.metadata as JsonInput,
              }),
            },
            include: {
              investigator: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  username: true,
                },
              },
            },
          });

          const stt = await this.generateStt(tx);
          const reporter = (metadata?.reporter as string) || 'Chưa xác định';

          const newPetition = await tx.petition.create({
            data: {
              stt,
              receivedDate: new Date(),
              senderName: reporter,
              petitionType,
              status: PetitionStatus.MOI_TIEP_NHAN,
              linkedCaseId: newCase.id,
              enteredById: actorId,
              unit: dto.unit,
            },
          });

          return { caseRecord: newCase, petition: newPetition };
        },
      );

      await this.audit.log({
        userId: actorId,
        action: 'CASE_CREATED',
        subject: 'Case',
        subjectId: caseRecord.id,
        metadata: { name: caseRecord.name, status: caseRecord.status },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      await this.audit.log({
        userId: actorId,
        action: 'PETITION_AUTO_CREATED',
        subject: 'Petition',
        subjectId: petition.id,
        metadata: {
          stt: petition.stt,
          petitionType,
          linkedCaseId: caseRecord.id,
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      return {
        success: true,
        data: { ...caseRecord, linkedPetition: petition },
        message: 'Tạo vụ án thành công',
      };
    }

    // No petitionType — create Case only
    const record = await this.prisma.case.create({
      data: {
        name: dto.name,
        crime: dto.crime,
        status: dto.status ?? CaseStatus.TIEP_NHAN,
        investigatorId: dto.investigatorId,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        unit: dto.unit,
        subjectsCount: dto.subjectsCount ?? 0,
        ...(dto.metadata !== undefined && { metadata: dto.metadata as JsonInput }),
      },
      include: {
        investigator: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CASE_CREATED',
      subject: 'Case',
      subjectId: record.id,
      metadata: { name: record.name, status: record.status },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Tạo vụ án thành công' };
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateCaseDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const existing = await this.prisma.case.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Vụ án không tồn tại (id: ${id})`);
    }

    this.checkRecordInScope(existing, dataScope);

    if (dto.investigatorId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.investigatorId },
      });
      if (!user) {
        throw new BadRequestException('Điều tra viên không tồn tại');
      }
    }

    const updateData: Prisma.CaseUncheckedUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.crime !== undefined && { crime: dto.crime }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.investigatorId !== undefined && { investigatorId: dto.investigatorId }),
      ...(dto.deadline !== undefined && {
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      }),
      ...(dto.unit !== undefined && { unit: dto.unit }),
      ...(dto.subjectsCount !== undefined && { subjectsCount: dto.subjectsCount }),
      ...(dto.metadata !== undefined && { metadata: dto.metadata as JsonInput }),
    };

    const record = await this.prisma.case.update({
      where: { id },
      data: updateData,
      include: {
        investigator: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
    });

    // Sync petitionType with linked Petition
    const updatedMetadata = dto.metadata as Record<string, unknown> | undefined;
    const newPetitionType = updatedMetadata?.petitionType as string | undefined;
    if (newPetitionType !== undefined) {
      const linkedPetition = await this.prisma.petition.findFirst({
        where: { linkedCaseId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (linkedPetition) {
        await this.prisma.petition.update({
          where: { id: linkedPetition.id },
          data: { petitionType: newPetitionType },
        });
      } else if (newPetitionType) {
        // No linked Petition yet — create one
        const reporter =
          (updatedMetadata?.reporter as string) || 'Chưa xác định';
        await this.prisma.$transaction(async (tx) => {
          const stt = await this.generateStt(tx);
          await tx.petition.create({
            data: {
              stt,
              receivedDate: new Date(),
              senderName: reporter,
              petitionType: newPetitionType,
              status: PetitionStatus.MOI_TIEP_NHAN,
              linkedCaseId: id,
              enteredById: actorId,
              unit: record.unit,
            },
          });
        });

        await this.audit.log({
          userId: actorId,
          action: 'PETITION_AUTO_CREATED',
          subject: 'Petition',
          subjectId: id,
          metadata: { petitionType: newPetitionType, linkedCaseId: id },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
      }
    }

    // Ghi nhận riêng khi đổi trạng thái
    if (dto.status !== undefined && dto.status !== existing.status) {
      await this.prisma.caseStatusHistory.create({
        data: {
          caseId: id,
          fromStatus: existing.status,
          toStatus: dto.status,
          changedById: actorId ?? null,
        },
      });
      await this.audit.log({
        userId: actorId,
        action: 'CASE_STATUS_CHANGED',
        subject: 'Case',
        subjectId: id,
        metadata: {
          fromStatus: existing.status,
          toStatus: dto.status,
          changedAt: new Date().toISOString(),
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
    }

    await this.audit.log({
      userId: actorId,
      action: 'CASE_UPDATED',
      subject: 'Case',
      subjectId: id,
      metadata: { changes: dto },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Cập nhật vụ án thành công' };
  }

  // ─────────────────────────────────────────────
  // DELETE (soft delete)
  // ─────────────────────────────────────────────
  async delete(
    id: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const existing = await this.prisma.case.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Vụ án không tồn tại (id: ${id})`);
    }

    this.checkRecordInScope(existing, dataScope);

    await this.prisma.case.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CASE_DELETED',
      subject: 'Case',
      subjectId: id,
      metadata: { name: existing.name, softDelete: true },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa vụ án thành công' };
  }

  // ─────────────────────────────────────────────
  // STATUS HISTORY
  // ─────────────────────────────────────────────
  async getStatusHistory(caseId: string) {
    const rows = await this.prisma.caseStatusHistory.findMany({
      where: { caseId },
      orderBy: { changedAt: 'asc' },
      include: {
        changedBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
    });
    return { success: true, data: rows };
  }
}
