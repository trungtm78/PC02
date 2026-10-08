import { CaseChildAccessService } from '../case-child-access/case-child-access.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateInvestigationSupplementDto } from './dto/create-investigation-supplement.dto';
import { Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { assertParentInScope } from '../common/utils/scope-filter.util';
import { kiemVuAnChaDeGhi } from '../common/utils/kiem-vu-an-cha';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryInvestigationSupplementsDto {
  @IsOptional() @IsString() caseId?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number = 50;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

@Injectable()
export class InvestigationSupplementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly childAccess: CaseChildAccessService,
  ) {}

  async getList(
    query: QueryInvestigationSupplementsDto,
    dataScope?: DataScope | null,
    actorId?: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    dataScope = await this.childAccess.scope(actorId, db);
    await this.childAccess.entity('Case', 'read', actorId, db);

    const { caseId, type, limit = 50, offset = 0 } = query;
    const where: Prisma.InvestigationSupplementWhereInput = {};

    if (caseId) where.caseId = caseId;
    if (type) where.type = type;

    where.case = await this.childAccess.listWhere(actorId, db);

    const [data, total] = await Promise.all([
      db.investigationSupplement.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.investigationSupplement.count({ where }),
    ]);

    return {
      success: true,
      data: await Promise.all(
        data.map((row) =>
          this.childAccess.serialize(row.caseId, row, actorId, db),
        ),
      ),
      total,
    };
  }

  async getById(
    id: string,
    dataScope?: DataScope | null,
    actorId?: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    dataScope = await this.childAccess.scope(actorId, db);
    await this.childAccess.entity('Case', 'read', actorId, db);

    const record = await db.investigationSupplement.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
        case: {
          select: {
            id: true,
            name: true,
            status: true,
            assignedTeamId: true,
            investigatorId: true,
          },
        },
      },
    });
    if (!record)
      throw new NotFoundException(
        `Quyết định điều tra bổ sung không tồn tại (id: ${id})`,
      );
    assertParentInScope(record.case, dataScope);
    await this.childAccess.read(record.caseId, actorId, db);
    return {
      success: true,
      data: await this.childAccess.serialize(
        record.caseId,
        record,
        actorId,
        db,
      ),
    };
  }

  async create(
    dto: CreateInvestigationSupplementDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    return this.childAccess.write(
      [dto.caseId],
      actorId,
      'Case',
      'write',
      async (tx) => {
        dataScope = await this.childAccess.scope(actorId, tx);

        await kiemVuAnChaDeGhi(tx, dto.caseId, dataScope);
        const record = await tx.investigationSupplement.create({
          data: {
            caseId: dto.caseId,
            type: dto.type,
            decisionNumber: dto.decisionNumber,
            decisionDate: dto.decisionDate ? new Date(dto.decisionDate) : null,
            reason: dto.reason,
            deadline: dto.deadline ? new Date(dto.deadline) : null,
            // Ba mốc ngày của bảng ĐTBS hệ cũ.
            ngayTiepNhanDTBS: dto.ngayTiepNhanDTBS
              ? new Date(dto.ngayTiepNhanDTBS)
              : null,
            ngayTraHoSoVKS: dto.ngayTraHoSoVKS
              ? new Date(dto.ngayTraHoSoVKS)
              : null,
            ngayTraHoSoToaAn: dto.ngayTraHoSoToaAn
              ? new Date(dto.ngayTraHoSoToaAn)
              : null,
            createdById: actorId,
          },
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        });

        await this.audit.log(
          {
            userId: actorId,
            action: 'INVESTIGATION_SUPPLEMENT_CREATED',
            subject: 'Case',
            subjectId: record.id,
            metadata: {
              caseId: dto.caseId,
              type: dto.type,
              decisionNumber: dto.decisionNumber,
            },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );

        return {
          success: true,
          data: record,
          message: 'Tạo quyết định điều tra bổ sung thành công',
        };
      },
    );
  }

  async delete(
    id: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope, actorId);
    return this.childAccess.write(
      [existing.caseId],
      actorId,
      'Case',
      'delete',
      async (tx, parents) => {
        dataScope = await this.childAccess.scope(actorId, tx);

        assertParentInScope(
          this.childAccess.parent(parents, existing.caseId),
          dataScope,
          'write',
        );

        await tx.investigationSupplement.delete({
          where: { id, caseId: existing.caseId },
        });

        await this.audit.log(
          {
            userId: actorId,
            action: 'INVESTIGATION_SUPPLEMENT_DELETED',
            subject: 'Case',
            subjectId: id,
            metadata: {},
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );

        return {
          success: true,
          message: 'Xóa quyết định điều tra bổ sung thành công',
        };
      },
    );
  }
}
