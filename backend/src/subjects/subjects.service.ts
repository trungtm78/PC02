import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { QuerySubjectsDto } from './dto/query-subjects.dto';
import { Prisma, SubjectStatus, SubjectType } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import {
  assertParentInScope,
  buildScopeFilter,
} from '../common/utils/scope-filter.util';

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────────────────────────
  // GET LIST
  // ─────────────────────────────────────────────
  async getList(query: QuerySubjectsDto, dataScope?: DataScope | null) {
    const {
      search,
      status,
      type,
      caseId,
      crimeId,
      districtId,
      wardId,
      fromDate,
      toDate,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.SubjectWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { idNumber: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (type) where.type = type; // TASK-2026-261225: filter by SubjectType
    if (caseId) where.caseId = caseId;
    if (crimeId) where.crimeId = crimeId;
    if (districtId) where.districtId = districtId;
    if (wardId) where.wardId = wardId;

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

    const caseScope = buildScopeFilter(dataScope);
    if (caseScope) {
      (where as any).case = caseScope;
    }

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'fullName',
      'dateOfBirth',
      'status',
    ];
    const orderByField = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.subject.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          dateOfBirth: true,
          gender: true,
          idNumber: true,
          address: true,
          phone: true,
          occupationId: true,
          nationalityId: true,
          districtId: true,
          wardId: true,
          caseId: true,
          crimeId: true,
          type: true, // TASK-2026-261225
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          case: {
            select: { id: true, name: true, status: true },
          },
        },
        orderBy: { [orderByField]: sortOrder },
        take: limit,
        skip: offset,
      }),
      this.prisma.subject.count({ where }),
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
    const record = await this.prisma.subject.findFirst({
      where: { id, deletedAt: null },
      include: {
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

    if (!record) {
      throw new NotFoundException(`Đối tượng không tồn tại (id: ${id})`);
    }

    assertParentInScope(record.case, dataScope);

    return { success: true, data: record };
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async create(
    dto: CreateSubjectDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    // EC-04: Check duplicate idNumber within same type
    // Same person can be both VICTIM and WITNESS (different type records)
    // But cannot have duplicate idNumber+type combination
    const subjectType = dto.type ?? SubjectType.SUSPECT;
    // Chỉ kiểm trùng khi CÓ số định danh. Bản ghi di trú "chưa đủ định danh" (idNumber null)
    // KHÔNG bị coi là trùng nhau — nhiều nghi can chỉ có tên vẫn cùng một vụ.
    if (dto.idNumber) {
      const existing = await this.prisma.subject.findFirst({
        where: { idNumber: dto.idNumber, type: subjectType, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(
          `Số CCCD/CMND "${dto.idNumber}" đã tồn tại với loại đối tượng này`,
        );
      }
    }

    // Validate caseId
    const caseRecord = await this.prisma.case.findFirst({
      where: { id: dto.caseId, deletedAt: null },
    });
    if (!caseRecord) {
      throw new BadRequestException(`Vụ án không tồn tại (id: ${dto.caseId})`);
    }
    // getById() and update() have checked this since they were written;
    // create() never did, so an officer could attach a suspect to another
    // team's case simply by knowing its id.
    assertParentInScope(caseRecord, dataScope, 'write');

    // Validate crimeId nếu có — FK tới master Crime (BLHS 2015). Optional: nhân chứng/bị hại bỏ trống.
    if (dto.crimeId) {
      const crimeRecord = await this.prisma.crime.findFirst({
        where: { id: dto.crimeId, isActive: true },
      });
      if (!crimeRecord) {
        throw new BadRequestException(
          `Tội danh không tồn tại (id: ${dto.crimeId})`,
        );
      }
    }

    const record = await this.prisma.subject.create({
      data: {
        fullName: dto.fullName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender ?? 'MALE',
        idNumber: dto.idNumber,
        address: dto.address,
        phone: dto.phone,
        occupationId: dto.occupationId,
        nationalityId: dto.nationalityId,
        districtId: dto.districtId,
        wardId: dto.wardId,
        districtName: dto.districtName ?? null,
        caseId: dto.caseId,
        crimeId: dto.crimeId,
        type: dto.type ?? SubjectType.SUSPECT, // TASK-2026-261225
        status: dto.status ?? SubjectStatus.INVESTIGATING,
        notes: dto.notes,
      },
      include: {
        case: { select: { id: true, name: true, status: true } },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'SUBJECT_CREATED',
      subject: 'Subject',
      subjectId: record.id,
      metadata: {
        fullName: record.fullName,
        idNumber: record.idNumber,
        caseId: record.caseId,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Tạo đối tượng thành công' };
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateSubjectDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    assertParentInScope(existing.case, dataScope, 'write');

    // Check duplicate idNumber+type (exclude self) — EC-04
    const targetType = dto.type ?? existing.type;
    if (dto.idNumber && dto.idNumber !== existing.idNumber) {
      const dup = await this.prisma.subject.findFirst({
        where: {
          idNumber: dto.idNumber,
          type: targetType,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (dup) {
        throw new ConflictException(
          `Số CCCD/CMND "${dto.idNumber}" đã tồn tại với loại đối tượng này`,
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
      // ND-18: cha MỚI cũng phải nằm trong phạm vi ghi của người gọi.
      // Trước đây chỉ kiểm cha CŨ, nên cán bộ tổ A sửa một bản ghi của mình rồi
      // gán sang vụ án của tổ B là chuyển được dữ liệu ra ngoài phạm vi — không
      // câu lệnh nào chặn, và không dấu vết nào cho thấy chuyện đó vừa xảy ra.
      assertParentInScope(caseRecord, dataScope, 'write');
    }

    // Validate crimeId if provided — FK tới master Crime (BLHS 2015).
    if (dto.crimeId) {
      const crimeRecord = await this.prisma.crime.findFirst({
        where: { id: dto.crimeId, isActive: true },
      });
      if (!crimeRecord) {
        throw new BadRequestException(
          `Tội danh không tồn tại (id: ${dto.crimeId})`,
        );
      }
    }

    const record = await this.prisma.subject.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.dateOfBirth !== undefined && {
          dateOfBirth: new Date(dto.dateOfBirth),
        }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.idNumber !== undefined && { idNumber: dto.idNumber }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.occupationId !== undefined && {
          occupationId: dto.occupationId,
        }),
        ...(dto.nationalityId !== undefined && {
          nationalityId: dto.nationalityId,
        }),
        ...(dto.districtId !== undefined && { districtId: dto.districtId }),
        ...(dto.wardId !== undefined && { wardId: dto.wardId }),
        ...(dto.districtName !== undefined && {
          districtName: dto.districtName,
        }),
        ...(dto.caseId !== undefined && { caseId: dto.caseId }),
        ...(dto.crimeId !== undefined && { crimeId: dto.crimeId }),
        ...(dto.type !== undefined && { type: dto.type }), // TASK-2026-261225
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        case: { select: { id: true, name: true, status: true } },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'SUBJECT_UPDATED',
      subject: 'Subject',
      subjectId: id,
      metadata: {
        before: {
          fullName: existing.fullName,
          idNumber: existing.idNumber,
          status: existing.status,
        },
        after: dto,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Cập nhật đối tượng thành công',
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
    assertParentInScope(existing.case, dataScope, 'write');

    await this.prisma.subject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'SUBJECT_DELETED',
      subject: 'Subject',
      subjectId: id,
      metadata: { fullName: existing.fullName, softDelete: true },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa đối tượng thành công' };
  }
}
