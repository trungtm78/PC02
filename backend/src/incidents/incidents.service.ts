import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { QueryIncidentsDto } from './dto/query-incidents.dto';
import { AssignInvestigatorDto } from './dto/assign-investigator.dto';
import { ProsecuteIncidentDto } from './dto/prosecute-incident.dto';
import { Prisma, IncidentStatus } from '@prisma/client';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────────────────────────
  // GET LIST (AC-01)
  // ─────────────────────────────────────────────
  async getList(query: QueryIncidentsDto) {
    const {
      search,
      status,
      investigatorId,
      unitId,
      overdue,
      districtId,
      wardId,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.IncidentWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        {
          investigator: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (investigatorId) {
      where.investigatorId = investigatorId;
    }

    if (unitId) {
      where.unitId = unitId;
    }

    // Filter quá hạn
    if (overdue === 'true') {
      where.deadline = { lt: new Date() };
      where.status = {
        notIn: [IncidentStatus.DA_GIAI_QUYET, IncidentStatus.DA_CHUYEN_VU_AN],
      };
    }

    // Incidents không có wardId/districtId trực tiếp
    // Filter theo unitId nếu districtId được dùng như alias
    if (districtId) {
      where.unitId = districtId;
    }

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'deadline',
      'status',
      'code',
      'name',
    ];
    const orderByField = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          incidentType: true,
          description: true,
          fromDate: true,
          toDate: true,
          deadline: true,
          unitId: true,
          status: true,
          sourcePetitionId: true,
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
      this.prisma.incident.count({ where }),
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
  async getById(id: string) {
    const record = await this.prisma.incident.findFirst({
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
          select: {
            id: true,
            stt: true,
            senderName: true,
            status: true,
            receivedDate: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    }

    return { success: true, data: record };
  }

  // ─────────────────────────────────────────────
  // CREATE (AC-02: auto-generate code VV-YYYY-XXX)
  // ─────────────────────────────────────────────
  async create(
    dto: CreateIncidentDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    // EC-05: Validate fromDate <= toDate
    if (dto.fromDate && dto.toDate) {
      const from = new Date(dto.fromDate);
      const to = new Date(dto.toDate);
      if (from > to) {
        throw new BadRequestException(
          'Từ ngày không được lớn hơn Đến ngày (EC-05)',
        );
      }
    }

    // Validate investigatorId if provided
    if (dto.investigatorId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.investigatorId },
      });
      if (!user) {
        throw new BadRequestException('Điều tra viên không tồn tại');
      }
    }

    // Generate unique incident code: VV-{YEAR}-{SEQ} (AC-02)
    const code = await this.generateIncidentCode();

    const record = await this.prisma.incident.create({
      data: {
        code,
        name: dto.name,
        incidentType: dto.incidentType,
        description: dto.description,
        fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
        toDate: dto.toDate ? new Date(dto.toDate) : undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        unitId: dto.unitId,
        investigatorId: dto.investigatorId,
        sourcePetitionId: dto.sourcePetitionId,
        status: IncidentStatus.TIEP_NHAN,
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

    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_CREATED',
      subject: 'Incident',
      subjectId: record.id,
      metadata: {
        code: record.code,
        name: record.name,
        status: record.status,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Tạo vụ việc thành công' };
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateIncidentDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    }

    // EC-05: Validate fromDate <= toDate
    const fromDate = dto.fromDate ?? existing.fromDate?.toISOString();
    const toDate = dto.toDate ?? existing.toDate?.toISOString();
    if (fromDate && toDate) {
      if (new Date(fromDate) > new Date(toDate)) {
        throw new BadRequestException(
          'Từ ngày không được lớn hơn Đến ngày (EC-05)',
        );
      }
    }

    // Validate investigatorId if updating
    if (dto.investigatorId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.investigatorId },
      });
      if (!user) {
        throw new BadRequestException('Điều tra viên không tồn tại');
      }
    }

    const record = await this.prisma.incident.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.incidentType !== undefined && {
          incidentType: dto.incidentType,
        }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.fromDate !== undefined && {
          fromDate: dto.fromDate ? new Date(dto.fromDate) : null,
        }),
        ...(dto.toDate !== undefined && {
          toDate: dto.toDate ? new Date(dto.toDate) : null,
        }),
        ...(dto.deadline !== undefined && {
          deadline: dto.deadline ? new Date(dto.deadline) : null,
        }),
        ...(dto.unitId !== undefined && { unitId: dto.unitId }),
        ...(dto.investigatorId !== undefined && {
          investigatorId: dto.investigatorId,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
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

    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_UPDATED',
      subject: 'Incident',
      subjectId: id,
      metadata: { changes: dto },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Cập nhật vụ việc thành công',
    };
  }

  // ─────────────────────────────────────────────
  // DELETE (soft delete)
  // ─────────────────────────────────────────────
  async delete(
    id: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    }

    await this.prisma.incident.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_DELETED',
      subject: 'Incident',
      subjectId: id,
      metadata: { code: existing.code, softDelete: true },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa vụ việc thành công' };
  }

  // ─────────────────────────────────────────────
  // ASSIGN INVESTIGATOR (AC-03)
  // EC-02: Không phân công cho vụ việc ĐÃ KẾT THÚC (DA_GIAI_QUYET)
  // ─────────────────────────────────────────────
  async assignInvestigator(
    id: string,
    dto: AssignInvestigatorDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    }

    // EC-02: Ngăn phân công cho vụ việc ĐÃ KẾT THÚC
    if (existing.status === IncidentStatus.DA_GIAI_QUYET) {
      throw new BadRequestException(
        'Không thể phân công điều tra viên cho vụ việc đã ở trạng thái ĐÃ GIẢI QUYẾT (EC-02)',
      );
    }

    // Also block assign for converted-to-case
    if (existing.status === IncidentStatus.DA_CHUYEN_VU_AN) {
      throw new BadRequestException(
        'Không thể phân công điều tra viên cho vụ việc đã được chuyển thành vụ án',
      );
    }

    // Validate investigator exists
    const investigator = await this.prisma.user.findUnique({
      where: { id: dto.investigatorId },
    });
    if (!investigator) {
      throw new BadRequestException(
        `Điều tra viên không tồn tại (id: ${dto.investigatorId})`,
      );
    }

    const record = await this.prisma.incident.update({
      where: { id },
      data: {
        investigatorId: dto.investigatorId,
        deadline: dto.deadline ? new Date(dto.deadline) : existing.deadline,
        // Transition to DANG_XAC_MINH when assigned
        status: IncidentStatus.DANG_XAC_MINH,
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

    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_ASSIGNED',
      subject: 'Incident',
      subjectId: id,
      metadata: {
        investigatorId: dto.investigatorId,
        investigatorName: `${investigator.firstName ?? ''} ${investigator.lastName ?? ''}`.trim(),
        deadline: dto.deadline,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Phân công điều tra viên thành công',
    };
  }

  // ─────────────────────────────────────────────
  // PROSECUTE (AC-04) — Khởi tố → tạo Case
  // EC-01: Case code trùng → lỗi hợp lệ
  // ─────────────────────────────────────────────
  async prosecute(
    id: string,
    dto: ProsecuteIncidentDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    }

    // Chỉ cho khởi tố khi DANG_XAC_MINH (UI_Specs Table 2.2.B)
    if (existing.status !== IncidentStatus.DANG_XAC_MINH) {
      throw new BadRequestException(
        'Chỉ có thể khởi tố vụ việc đang ở trạng thái ĐANG XÁC MINH',
      );
    }

    // Create Case atomically
    let caseRecord: Awaited<ReturnType<typeof this.prisma.case.create>>;
    try {
      caseRecord = await this.prisma.case.create({
        data: {
          name: dto.caseName,
          crime: dto.crime,
          status: 'TIEP_NHAN',
          investigatorId: existing.investigatorId,
        },
      });
    } catch (err: unknown) {
      // EC-01: Handle unique constraint violation on case code
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Mã vụ án bị trùng, vui lòng thử lại (EC-01)',
        );
      }
      throw err;
    }

    // Update incident status → DA_CHUYEN_VU_AN
    await this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.DA_CHUYEN_VU_AN,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_PROSECUTED',
      subject: 'Incident',
      subjectId: id,
      metadata: {
        caseId: caseRecord.id,
        caseName: caseRecord.name,
        prosecutionDecision: dto.prosecutionDecision,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: {
        incident: { id, status: IncidentStatus.DA_CHUYEN_VU_AN },
        case: caseRecord,
      },
      message: 'Khởi tố vụ việc thành vụ án thành công',
    };
  }

  // ─────────────────────────────────────────────
  // GET USERS (for investigator FK select dropdown)
  // ─────────────────────────────────────────────
  async getInvestigators(search?: string) {
    const where: Prisma.UserWhereInput = {
      isActive: true,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        email: true,
        workId: true,
      },
      take: 50,
      orderBy: { lastName: 'asc' },
    });

    return { success: true, data: users };
  }

  // ─────────────────────────────────────────────
  // Private: Generate unique VV-YYYY-XXXXX code
  // ─────────────────────────────────────────────
  private async generateIncidentCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `VV-${year}-`;

    // Count incidents for this year
    const count = await this.prisma.incident.count({
      where: {
        code: { startsWith: prefix },
      },
    });

    const seq = count + 1;
    const candidate = `${prefix}${String(seq).padStart(5, '0')}`;

    // Check uniqueness (race-condition safe)
    const conflict = await this.prisma.incident.findUnique({
      where: { code: candidate },
    });

    if (conflict) {
      // Fallback: find highest sequence and increment
      const latest = await this.prisma.incident.findFirst({
        where: { code: { startsWith: prefix } },
        orderBy: { code: 'desc' },
        select: { code: true },
      });
      if (latest) {
        const lastSeq = parseInt(latest.code.split('-')[2] ?? '0', 10);
        return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`;
      }
    }

    return candidate;
  }
}
