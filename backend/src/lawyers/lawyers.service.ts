import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLawyerDto } from './dto/create-lawyer.dto';
import { UpdateLawyerDto } from './dto/update-lawyer.dto';
import { QueryLawyersDto } from './dto/query-lawyers.dto';
import { Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { assertParentInScope, buildScopeFilter } from '../common/utils/scope-filter.util';

@Injectable()
export class LawyersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────────────────────────
  // GET LIST
  // ─────────────────────────────────────────────
  async getList(query: QueryLawyersDto, dataScope?: DataScope | null) {
    const {
      search,
      caseId,
      subjectId,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.LawyerWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { barNumber: { contains: search, mode: 'insensitive' } },
        { lawFirm: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (caseId) where.caseId = caseId;
    if (subjectId) where.subjectId = subjectId;

    const caseScope = buildScopeFilter(dataScope);
    if (caseScope) {
      (where as any).case = caseScope;
    }

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'fullName',
      'barNumber',
    ];
    const orderByField = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.lawyer.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          lawFirm: true,
          barNumber: true,
          phone: true,
          caseId: true,
          subjectId: true,
          createdAt: true,
          updatedAt: true,
          case: { select: { id: true, name: true, status: true } },
          subject: { select: { id: true, fullName: true, type: true } },
        },
        orderBy: { [orderByField]: sortOrder },
        take: limit,
        skip: offset,
      }),
      this.prisma.lawyer.count({ where }),
    ]);

    return {
      data,
      total,
      limit,
      offset,
    };
  }

  // ─────────────────────────────────────────────
  // GET DETAIL
  // ─────────────────────────────────────────────
  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.lawyer.findFirst({
      where: { id, deletedAt: null },
      include: {
        case: { select: { id: true, name: true, status: true, assignedTeamId: true, investigatorId: true } },
        subject: { select: { id: true, fullName: true, type: true } },
      },
    });

    if (!record) {
      throw new NotFoundException(`Luật sư không tồn tại (id: ${id})`);
    }

    assertParentInScope(record.case, dataScope);

    return { success: true, data: record };
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async create(
    dto: CreateLawyerDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    // Check duplicate barNumber
    const existing = await this.prisma.lawyer.findFirst({
      where: { barNumber: dto.barNumber, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `Số thẻ luật sư "${dto.barNumber}" đã tồn tại trong hệ thống`,
      );
    }

    // Validate caseId
    const caseRecord = await this.prisma.case.findFirst({
      where: { id: dto.caseId, deletedAt: null },
    });
    if (!caseRecord) {
      throw new BadRequestException(`Vụ án không tồn tại (id: ${dto.caseId})`);
    }

    // Validate subjectId if provided (EC-01: lawyer can defend multiple suspects — same lawyer re-assigned means new record)
    if (dto.subjectId) {
      const subjectRecord = await this.prisma.subject.findFirst({
        where: { id: dto.subjectId, caseId: dto.caseId, deletedAt: null },
      });
      if (!subjectRecord) {
        throw new BadRequestException(
          `Bị can không tồn tại trong vụ án (subjectId: ${dto.subjectId})`,
        );
      }
    }

    const record = await this.prisma.lawyer.create({
      data: {
        fullName: dto.fullName,
        lawFirm: dto.lawFirm,
        barNumber: dto.barNumber,
        phone: dto.phone,
        caseId: dto.caseId,
        subjectId: dto.subjectId ?? null,
      },
      include: {
        case: { select: { id: true, name: true, status: true } },
        subject: { select: { id: true, fullName: true, type: true } },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'LAWYER_CREATED',
      subject: 'Lawyer',
      subjectId: record.id,
      metadata: {
        fullName: record.fullName,
        barNumber: record.barNumber,
        caseId: record.caseId,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Tạo luật sư thành công' };
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateLawyerDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);

    // Check duplicate barNumber (exclude self)
    if (dto.barNumber && dto.barNumber !== existing.barNumber) {
      const dup = await this.prisma.lawyer.findFirst({
        where: { barNumber: dto.barNumber, deletedAt: null, NOT: { id } },
      });
      if (dup) {
        throw new ConflictException(
          `Số thẻ luật sư "${dto.barNumber}" đã tồn tại trong hệ thống`,
        );
      }
    }

    // Validate caseId if provided
    if (dto.caseId) {
      const caseRecord = await this.prisma.case.findFirst({
        where: { id: dto.caseId, deletedAt: null },
      });
      if (!caseRecord) {
        throw new BadRequestException(
          `Vụ án không tồn tại (id: ${dto.caseId})`,
        );
      }
    }

    // Validate subjectId if provided
    const targetCaseId = dto.caseId ?? existing.caseId;
    if (dto.subjectId) {
      const subjectRecord = await this.prisma.subject.findFirst({
        where: { id: dto.subjectId, caseId: targetCaseId, deletedAt: null },
      });
      if (!subjectRecord) {
        throw new BadRequestException(
          `Bị can không tồn tại trong vụ án (subjectId: ${dto.subjectId})`,
        );
      }
    }

    const record = await this.prisma.lawyer.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.lawFirm !== undefined && { lawFirm: dto.lawFirm }),
        ...(dto.barNumber !== undefined && { barNumber: dto.barNumber }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.caseId !== undefined && { caseId: dto.caseId }),
        ...(dto.subjectId !== undefined && {
          subjectId: dto.subjectId ?? null,
        }),
      },
      include: {
        case: { select: { id: true, name: true, status: true } },
        subject: { select: { id: true, fullName: true, type: true } },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'LAWYER_UPDATED',
      subject: 'Lawyer',
      subjectId: id,
      metadata: { changes: dto },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Cập nhật luật sư thành công',
    };
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
    const { data: existing } = await this.getById(id, dataScope);

    await this.prisma.lawyer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'LAWYER_DELETED',
      subject: 'Lawyer',
      subjectId: id,
      metadata: { fullName: existing.fullName, softDelete: true },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa luật sư thành công' };
  }
}
