import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePetitionDto } from './dto/create-petition.dto';
import { UpdatePetitionDto } from './dto/update-petition.dto';
import { QueryPetitionsDto } from './dto/query-petitions.dto';
import { ConvertToIncidentDto } from './dto/convert-incident.dto';
import { ConvertToCaseDto } from './dto/convert-case.dto';
import { Prisma } from '@prisma/client';

// Enum values — inline to avoid dependency on Prisma client generation
// These must match schema.prisma enum definitions exactly
const PetitionStatus = {
  MOI_TIEP_NHAN: 'MOI_TIEP_NHAN',
  DANG_XU_LY: 'DANG_XU_LY',
  CHO_PHE_DUYET: 'CHO_PHE_DUYET',
  DA_LUU_DON: 'DA_LUU_DON',
  DA_GIAI_QUYET: 'DA_GIAI_QUYET',
  DA_CHUYEN_VU_VIEC: 'DA_CHUYEN_VU_VIEC',
  DA_CHUYEN_VU_AN: 'DA_CHUYEN_VU_AN',
} as const;
type PetitionStatus = (typeof PetitionStatus)[keyof typeof PetitionStatus];

const CaseStatus = {
  TIEP_NHAN: 'TIEP_NHAN',
} as const;
type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

@Injectable()
export class PetitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────────────────────────
  // GET LIST
  // ─────────────────────────────────────────────
  async getList(query: QueryPetitionsDto) {
    const {
      search,
      status,
      unit,
      senderName,
      fromDate,
      toDate,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.PetitionWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { stt: { contains: search, mode: 'insensitive' } },
        { senderName: { contains: search, mode: 'insensitive' } },
        { suspectedPerson: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (unit) {
      where.unit = { contains: unit, mode: 'insensitive' };
    }

    if (senderName) {
      where.senderName = { contains: senderName, mode: 'insensitive' };
    }

    if (fromDate) {
      where.receivedDate = {
        ...(where.receivedDate as Prisma.DateTimeFilter | undefined),
        gte: new Date(fromDate),
      };
    }

    if (toDate) {
      where.receivedDate = {
        ...(where.receivedDate as Prisma.DateTimeFilter | undefined),
        lte: new Date(toDate + 'T23:59:59.999Z'),
      };
    }

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'receivedDate',
      'deadline',
      'status',
      'senderName',
    ];
    const orderByField = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.petition.findMany({
        where,
        select: {
          id: true,
          stt: true,
          receivedDate: true,
          unit: true,
          senderName: true,
          suspectedPerson: true,
          status: true,
          deadline: true,
          summary: true,
          priority: true,
          petitionType: true,
          linkedCaseId: true,
          linkedIncidentId: true,
          createdAt: true,
          updatedAt: true,
          enteredBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          assignedTo: {
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
      this.prisma.petition.count({ where }),
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
    const record = await this.prisma.petition.findFirst({
      where: { id, deletedAt: null },
      include: {
        enteredBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            email: true,
          },
        },
        linkedCase: {
          select: { id: true, name: true, status: true },
        },
        linkedIncident: {
          select: { id: true, code: true, name: true, status: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Đơn thư không tồn tại (id: ${id})`);
    }

    return { success: true, data: record };
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async create(
    dto: CreatePetitionDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    // Validate receivedDate is not in the future
    const receivedDate = new Date(dto.receivedDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (receivedDate > today) {
      throw new BadRequestException(
        'Ngày tiếp nhận không được là ngày tương lai',
      );
    }

    // Check stt uniqueness
    const existing = await this.prisma.petition.findUnique({
      where: { stt: dto.stt },
    });
    if (existing) {
      throw new ConflictException(`Số tiếp nhận "${dto.stt}" đã tồn tại`);
    }

    // Validate assignedToId if provided
    if (dto.assignedToId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.assignedToId },
      });
      if (!user) {
        throw new BadRequestException('Người được giao không tồn tại');
      }
    }

    // Validate enteredById if provided
    if (dto.enteredById) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.enteredById },
      });
      if (!user) {
        throw new BadRequestException('Người nhập không tồn tại');
      }
    }

    const record = await this.prisma.petition.create({
      data: {
        stt: dto.stt,
        receivedDate: new Date(dto.receivedDate),
        senderName: dto.senderName,
        unit: dto.unit,
        enteredById: dto.enteredById ?? actorId,
        senderBirthYear: dto.senderBirthYear,
        senderAddress: dto.senderAddress,
        senderPhone: dto.senderPhone,
        senderEmail: dto.senderEmail,
        suspectedPerson: dto.suspectedPerson,
        suspectedAddress: dto.suspectedAddress,
        petitionType: dto.petitionType,
        priority: dto.priority,
        summary: dto.summary,
        detailContent: dto.detailContent,
        attachmentsNote: dto.attachmentsNote,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        assignedToId: dto.assignedToId,
        notes: dto.notes,
        status: dto.status ?? PetitionStatus.MOI_TIEP_NHAN,
      },
      include: {
        enteredBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'PETITION_CREATED',
      subject: 'Petition',
      subjectId: record.id,
      metadata: {
        stt: record.stt,
        senderName: record.senderName,
        status: record.status,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Tạo đơn thư thành công' };
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdatePetitionDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.petition.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Đơn thư không tồn tại (id: ${id})`);
    }

    // Validate receivedDate if updating
    if (dto.receivedDate) {
      const receivedDate = new Date(dto.receivedDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (receivedDate > today) {
        throw new BadRequestException(
          'Ngày tiếp nhận không được là ngày tương lai',
        );
      }
    }

    // Check stt uniqueness if changing
    if (dto.stt && dto.stt !== existing.stt) {
      const dup = await this.prisma.petition.findUnique({
        where: { stt: dto.stt },
      });
      if (dup) {
        throw new ConflictException(`Số tiếp nhận "${dto.stt}" đã tồn tại`);
      }
    }

    const record = await this.prisma.petition.update({
      where: { id },
      data: {
        ...(dto.stt !== undefined && { stt: dto.stt }),
        ...(dto.receivedDate !== undefined && {
          receivedDate: new Date(dto.receivedDate),
        }),
        ...(dto.senderName !== undefined && { senderName: dto.senderName }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.senderBirthYear !== undefined && {
          senderBirthYear: dto.senderBirthYear,
        }),
        ...(dto.senderAddress !== undefined && {
          senderAddress: dto.senderAddress,
        }),
        ...(dto.senderPhone !== undefined && { senderPhone: dto.senderPhone }),
        ...(dto.senderEmail !== undefined && { senderEmail: dto.senderEmail }),
        ...(dto.suspectedPerson !== undefined && {
          suspectedPerson: dto.suspectedPerson,
        }),
        ...(dto.suspectedAddress !== undefined && {
          suspectedAddress: dto.suspectedAddress,
        }),
        ...(dto.petitionType !== undefined && {
          petitionType: dto.petitionType,
        }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.summary !== undefined && { summary: dto.summary }),
        ...(dto.detailContent !== undefined && {
          detailContent: dto.detailContent,
        }),
        ...(dto.attachmentsNote !== undefined && {
          attachmentsNote: dto.attachmentsNote,
        }),
        ...(dto.deadline !== undefined && {
          deadline: dto.deadline ? new Date(dto.deadline) : null,
        }),
        ...(dto.assignedToId !== undefined && {
          assignedToId: dto.assignedToId,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        enteredBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'PETITION_UPDATED',
      subject: 'Petition',
      subjectId: id,
      metadata: { changes: dto },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Cập nhật đơn thư thành công',
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
    const existing = await this.prisma.petition.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Đơn thư không tồn tại (id: ${id})`);
    }

    await this.prisma.petition.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'PETITION_DELETED',
      subject: 'Petition',
      subjectId: id,
      metadata: { stt: existing.stt, softDelete: true },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa đơn thư thành công' };
  }

  // ─────────────────────────────────────────────
  // CONVERT TO INCIDENT
  // ─────────────────────────────────────────────
  async convertToIncident(
    petitionId: string,
    dto: ConvertToIncidentDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const petition = await this.prisma.petition.findFirst({
      where: { id: petitionId, deletedAt: null },
    });

    if (!petition) {
      throw new NotFoundException(`Đơn thư không tồn tại (id: ${petitionId})`);
    }

    // Prevent re-conversion if already converted
    if (petition.linkedIncidentId) {
      throw new BadRequestException(
        'Đơn thư này đã được chuyển thành Vụ việc trước đó',
      );
    }
    if (petition.linkedCaseId) {
      throw new BadRequestException(
        'Đơn thư này đã được chuyển thành Vụ án, không thể chuyển thành Vụ việc',
      );
    }

    // Validate required fields (EC-01)
    if (!dto.incidentName || !dto.incidentType) {
      throw new BadRequestException(
        'Tên vụ việc và Loại vụ việc là bắt buộc khi chuyển đổi',
      );
    }

    // Generate incident code: VV-{YEAR}-{SEQ}
    const year = new Date().getFullYear();
    const count = await this.prisma.incident.count();
    const incidentCode = `VV-${year}-${String(count + 1).padStart(5, '0')}`;

    // Create Incident and update Petition atomically
    const [incident] = await this.prisma.$transaction([
      this.prisma.incident.create({
        data: {
          code: incidentCode,
          name: dto.incidentName,
          incidentType: dto.incidentType,
          description: dto.description,
          investigatorId: dto.assignedToId,
          sourcePetitionId: petitionId,
          status: 'TIEP_NHAN',
        },
      }),
    ]);

    // Update petition: link + update status
    await this.prisma.petition.update({
      where: { id: petitionId },
      data: {
        linkedIncidentId: incident.id,
        status: PetitionStatus.DA_CHUYEN_VU_VIEC,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'PETITION_CONVERTED_TO_INCIDENT',
      subject: 'Petition',
      subjectId: petitionId,
      metadata: {
        incidentId: incident.id,
        incidentCode: incident.code,
        incidentName: incident.name,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: {
        petition: { id: petitionId, status: PetitionStatus.DA_CHUYEN_VU_VIEC },
        incident,
      },
      message: 'Chuyển thành Vụ việc thành công',
    };
  }

  // ─────────────────────────────────────────────
  // CONVERT TO CASE
  // ─────────────────────────────────────────────
  async convertToCase(
    petitionId: string,
    dto: ConvertToCaseDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const petition = await this.prisma.petition.findFirst({
      where: { id: petitionId, deletedAt: null },
    });

    if (!petition) {
      throw new NotFoundException(`Đơn thư không tồn tại (id: ${petitionId})`);
    }

    // Prevent re-conversion
    if (petition.linkedCaseId) {
      throw new BadRequestException(
        'Đơn thư này đã được chuyển thành Vụ án trước đó',
      );
    }
    if (petition.linkedIncidentId) {
      throw new BadRequestException(
        'Đơn thư này đã được chuyển thành Vụ việc, không thể chuyển thành Vụ án',
      );
    }

    // Validate required fields (EC-01, AC-03)
    if (!dto.caseName || !dto.crime || !dto.jurisdiction) {
      throw new BadRequestException(
        'Tên vụ án, Tội danh và Thẩm quyền là bắt buộc khi chuyển đổi',
      );
    }

    // Create Case and update Petition atomically
    const [caseRecord] = await this.prisma.$transaction([
      this.prisma.case.create({
        data: {
          name: dto.caseName,
          crime: dto.crime,
          unit: dto.jurisdiction,
          status: CaseStatus.TIEP_NHAN,
        },
      }),
    ]);

    // Update petition: link + update status
    await this.prisma.petition.update({
      where: { id: petitionId },
      data: {
        linkedCaseId: caseRecord.id,
        status: PetitionStatus.DA_CHUYEN_VU_AN,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'PETITION_CONVERTED_TO_CASE',
      subject: 'Petition',
      subjectId: petitionId,
      metadata: {
        caseId: caseRecord.id,
        caseName: caseRecord.name,
        crime: dto.crime,
        jurisdiction: dto.jurisdiction,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: {
        petition: { id: petitionId, status: PetitionStatus.DA_CHUYEN_VU_AN },
        case: caseRecord,
      },
      message: 'Chuyển thành Vụ án thành công',
    };
  }
}
