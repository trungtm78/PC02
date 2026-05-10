import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { Document, Paragraph, TextRun, Packer, HeadingLevel } from 'docx';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePetitionDto } from './dto/create-petition.dto';
import { UpdatePetitionDto } from './dto/update-petition.dto';
import { QueryPetitionsDto } from './dto/query-petitions.dto';
import { ConvertToIncidentDto } from './dto/convert-incident.dto';
import { ConvertToCaseDto } from './dto/convert-case.dto';
import { AssignPetitionDto } from './dto/assign-petition.dto';
import { ExportPetitionsQueryDto } from './dto/export-petitions-query.dto';
import { Prisma, LoaiDon, PetitionStatus, CaseStatus } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { buildPetitionScopeFilter } from '../common/utils/scope-filter.util';
import { SettingsService } from '../settings/settings.service';
import { BcaExcelHelper } from '../common/bca-excel.helper';
import { PETITION_STATUS_LABEL } from '../common/constants/status-labels.constants';

@Injectable()
export class PetitionsService {
  private readonly logger = new Logger(PetitionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  // ─────────────────────────────────────────────
  // GET LIST
  // ─────────────────────────────────────────────
  async getList(query: QueryPetitionsDto, dataScope?: DataScope | null) {
    const {
      search,
      status,
      unit,
      senderName,
      fromDate,
      toDate,
      overdue,
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

    if (overdue) {
      where.deadline = { lt: new Date() };
      if (!status) {
        where.status = { notIn: [PetitionStatus.DA_GIAI_QUYET, PetitionStatus.DA_CHUYEN_VU_VIEC, PetitionStatus.DA_CHUYEN_VU_AN] };
      }
    }

    // Apply data scope filter
    const scopeFilter = buildPetitionScopeFilter(dataScope);
    if (scopeFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        scopeFilter as Prisma.PetitionWhereInput,
      ];
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

  private checkRecordInScope(
    record: { enteredById?: string | null; assignedTeamId?: string | null },
    dataScope?: DataScope | null,
  ) {
    if (!dataScope) return;
    if (dataScope.canDispatch) return; // dispatcher: full read access
    const { userIds, teamIds } = dataScope;
    const ownerMatch = record.enteredById && userIds.includes(record.enteredById);
    const teamMatch = record.assignedTeamId && teamIds.includes(record.assignedTeamId);
    const unassignedMatch = !record.assignedTeamId && teamIds.length > 0;
    if (!ownerMatch && !teamMatch && !unassignedMatch) {
      throw new ForbiddenException('Bạn không có quyền truy cập bản ghi này');
    }
  }

  private checkWriteScope(
    record: { enteredById?: string | null; assignedTeamId?: string | null },
    dataScope?: DataScope | null,
  ) {
    if (!dataScope) return;
    const { userIds, writableTeamIds } = dataScope;
    const ownerMatch = record.enteredById && userIds.includes(record.enteredById);
    const teamMatch = record.assignedTeamId && writableTeamIds.includes(record.assignedTeamId);
    const unassignedMatch = !record.assignedTeamId && writableTeamIds.length > 0;
    if (!ownerMatch && !teamMatch && !unassignedMatch) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bản ghi này');
    }
  }

  // ─────────────────────────────────────────────
  // GET DETAIL
  // ─────────────────────────────────────────────
  async getById(id: string, dataScope?: DataScope | null) {
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

    this.checkRecordInScope(record, dataScope);

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

    // Auto-calculate deadline by petition type — days read from SystemSettings (GAP-7)
    let computedDeadline: Date | undefined;
    let deadlineSettingKey: string | undefined;
    let deadlineDays: number | undefined;
    if (dto.deadline) {
      computedDeadline = new Date(dto.deadline);
    } else {
      const base = new Date(dto.receivedDate);
      let settingKey: string;
      if (dto.petitionType === LoaiDon.TO_CAO) {
        settingKey = 'THOI_HAN_TO_CAO';
      } else if (dto.petitionType === LoaiDon.KHIEU_NAI) {
        settingKey = 'THOI_HAN_KHIEU_NAI';
      } else if (dto.petitionType === LoaiDon.KIEN_NGHI) {
        settingKey = 'THOI_HAN_KIEN_NGHI';
      } else {
        settingKey = 'THOI_HAN_PHAN_ANH';
      }
      deadlineSettingKey = settingKey;
      deadlineDays = await this.settings.getNumericValue(settingKey, 15);
      base.setDate(base.getDate() + deadlineDays);
      computedDeadline = base;
    }

    // enteredById is always the authenticated user (prevent forgery)
    const record = await this.prisma.petition.create({
      data: {
        stt: dto.stt,
        receivedDate: new Date(dto.receivedDate),
        senderName: dto.senderName,
        unit: dto.unit,
        enteredById: actorId,
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
        deadline: computedDeadline,
        assignedToId: dto.assignedToId,
        ...(dto.assignedTeamId !== undefined && { assignedTeamId: dto.assignedTeamId }),
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
        ...(deadlineSettingKey !== undefined && { deadlineDays, deadlineSettingKey }),
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
    dataScope?: DataScope | null,
  ) {
    const existing = await this.prisma.petition.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Đơn thư không tồn tại (id: ${id})`);
    }

    this.checkWriteScope(existing, dataScope);

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

    let record;
    try {
      record = await this.prisma.petition.update({
        where: {
          id,
          ...(dto.expectedUpdatedAt ? { updatedAt: new Date(dto.expectedUpdatedAt) } : {}),
        },
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
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Đơn thư đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    await this.audit.log({
      userId: actorId,
      action: 'PETITION_UPDATED',
      subject: 'Petition',
      subjectId: id,
      metadata: { before: { status: existing.status, senderName: existing.senderName, assignedTeamId: existing.assignedTeamId, assignedToId: existing.assignedToId }, after: dto },
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
    dataScope?: DataScope | null,
  ) {
    const existing = await this.prisma.petition.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Đơn thư không tồn tại (id: ${id})`);
    }

    this.checkWriteScope(existing, dataScope);

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
    dataScope?: DataScope | null,
  ) {
    const petition = await this.prisma.petition.findFirst({
      where: { id: petitionId, deletedAt: null },
    });

    if (!petition) {
      throw new NotFoundException(`Đơn thư không tồn tại (id: ${petitionId})`);
    }

    this.checkWriteScope(petition, dataScope);

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
    try {
      await this.prisma.petition.update({
        where: {
          id: petitionId,
          ...(dto.expectedUpdatedAt ? { updatedAt: new Date(dto.expectedUpdatedAt) } : {}),
        },
        data: {
          linkedIncidentId: incident.id,
          status: PetitionStatus.DA_CHUYEN_VU_VIEC,
        },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Đơn thư đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

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
    dataScope?: DataScope | null,
  ) {
    const petition = await this.prisma.petition.findFirst({
      where: { id: petitionId, deletedAt: null },
    });

    if (!petition) {
      throw new NotFoundException(`Đơn thư không tồn tại (id: ${petitionId})`);
    }

    this.checkWriteScope(petition, dataScope);

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

    // Create Case and update Petition atomically in one transaction
    let caseRecord;
    try {
    [caseRecord] = await this.prisma.$transaction(async (tx) => {
      const newCase = await tx.case.create({
        data: {
          name: dto.caseName,
          crime: dto.crime,
          unit: dto.jurisdiction,
          status: CaseStatus.TIEP_NHAN,
        },
      });

      await tx.petition.update({
        where: {
          id: petitionId,
          ...(dto.expectedUpdatedAt ? { updatedAt: new Date(dto.expectedUpdatedAt) } : {}),
        },
        data: {
          linkedCaseId: newCase.id,
          status: PetitionStatus.DA_CHUYEN_VU_AN,
        },
      });

      return [newCase];
    });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Đơn thư đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

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

  // ─────────────────────────────────────────────
  // ASSIGN (dispatcher only)
  // ─────────────────────────────────────────────
  async assignPetition(
    id: string,
    dto: AssignPetitionDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.petition.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Đơn thư không tồn tại (id: ${id})`);

    const team = await this.prisma.team.findFirst({
      where: { id: dto.assignedTeamId, isActive: true },
    });
    if (!team) throw new BadRequestException(`Tổ không tồn tại hoặc đã ngừng hoạt động (id: ${dto.assignedTeamId})`);

    if (dto.assignedToId) {
      const member = await this.prisma.userTeam.findFirst({
        where: { userId: dto.assignedToId, teamId: dto.assignedTeamId },
      });
      if (!member) throw new BadRequestException('Cán bộ xử lý không thuộc tổ được chỉ định');
    }

    try {
      await this.prisma.petition.update({
        where: {
          id,
          ...(dto.expectedUpdatedAt ? { updatedAt: dto.expectedUpdatedAt } : {}),
        },
        data: {
          assignedTeamId: dto.assignedTeamId,
          assignedToId: dto.assignedToId ?? null,
          ...(dto.deadline ? { deadline: new Date(dto.deadline) } : {}),
        },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Đơn thư đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    await this.audit.log({
      userId: actorId,
      action: 'PETITION_ASSIGNED',
      subject: 'Petition',
      subjectId: id,
      metadata: {
        fromTeamId: existing.assignedTeamId ?? null,
        toTeamId: dto.assignedTeamId,
        fromAssignedToId: existing.assignedToId ?? null,
        toAssignedToId: dto.assignedToId ?? null,
        dispatchedBy: actorId,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Phân công đơn thư thành công' };
  }

  // ─────────────────────────────────────────────
  // EXPORT TO EXCEL
  // ─────────────────────────────────────────────
  async exportToExcel(
    query: ExportPetitionsQueryDto,
    dataScope: DataScope | null | undefined,
    res: Response,
    actorId?: string,
  ): Promise<void> {
    const where: Prisma.PetitionWhereInput = { deletedAt: null };

    if (query.ids) {
      where.id = { in: query.ids.split(',').map((s) => s.trim()).filter(Boolean) };
    }
    if (query.fromDate) {
      where.receivedDate = {
        ...(where.receivedDate as Prisma.DateTimeFilter | undefined),
        gte: new Date(query.fromDate),
      };
    }
    if (query.toDate) {
      where.receivedDate = {
        ...(where.receivedDate as Prisma.DateTimeFilter | undefined),
        lte: new Date(query.toDate + 'T23:59:59.999Z'),
      };
    }
    if (query.unit) {
      where.unit = { contains: query.unit, mode: 'insensitive' };
    }
    if (query.status) {
      where.status = query.status as Parameters<typeof buildPetitionScopeFilter>[0] extends never ? never : string as any;
    }

    // Apply data scope filter
    const scopeFilter = buildPetitionScopeFilter(dataScope);
    if (scopeFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        scopeFilter as Prisma.PetitionWhereInput,
      ];
    }

    const records = await this.prisma.petition.findMany({
      where,
      take: 500,
      orderBy: { receivedDate: 'desc' },
      select: {
        id: true,
        stt: true,
        receivedDate: true,
        senderName: true,
        senderAddress: true,
        summary: true,
        petitionType: true,
        status: true,
        notes: true,
        unit: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const COL_COUNT = 10;
    const COLUMN_HEADERS = [
      'STT', 'Mã đơn', 'Ngày tiếp nhận', 'Người gửi', 'Địa chỉ',
      'Nội dung tóm tắt', 'Phân loại', 'Trạng thái', 'ĐTV phụ trách', 'Ghi chú',
    ];
    const COLUMN_WIDTHS = [6, 18, 16, 20, 25, 40, 18, 20, 20, 25];

    const fromStr = query.fromDate ? new Date(query.fromDate).toLocaleDateString('vi-VN') : '';
    const toStr = query.toDate ? new Date(query.toDate).toLocaleDateString('vi-VN') : '';
    const period = fromStr && toStr ? `Từ ngày ${fromStr} đến ngày ${toStr}` : 'Tất cả thời gian';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh sách đơn thư');

    // Rows 1–6: BCA letterhead
    BcaExcelHelper.addHeader(sheet, COL_COUNT, 'DANH SÁCH ĐƠN THƯ', period);

    // Row 7: column headers
    const headerRow = sheet.getRow(7);
    BcaExcelHelper.addColumnHeaders(headerRow, COLUMN_HEADERS, COLUMN_WIDTHS);

    // Data rows from row 8
    records.forEach((rec, idx) => {
      const assignedName = rec.assignedTo
        ? `${rec.assignedTo.firstName ?? ''} ${rec.assignedTo.lastName ?? ''}`.trim()
        : '';
      const dataRow = sheet.addRow([
        idx + 1,
        rec.stt ?? '',
        rec.receivedDate ? rec.receivedDate.toLocaleDateString('vi-VN') : '',
        rec.senderName ?? '',
        rec.senderAddress ?? '',
        rec.summary ?? '',
        rec.petitionType ?? '',
        rec.status ?? '',
        assignedName,
        rec.notes ?? '',
      ]);
      BcaExcelHelper.styleDataRow(dataRow, idx % 2 === 1, COL_COUNT);
    });

    // Footer + print setup
    const lastDataRow = sheet.lastRow?.number ?? 7;
    BcaExcelHelper.addFooter(sheet, lastDataRow + 2, COL_COUNT);
    BcaExcelHelper.setPrintSetup(sheet);

    if (actorId) {
      await this.audit.log({
        userId: actorId,
        action: 'PETITION_EXPORTED',
        subject: 'Petition',
        subjectId: 'bulk',
        metadata: { count: records.length, filters: { fromDate: query.fromDate, toDate: query.toDate, unit: query.unit, status: query.status } },
      });
    }

    const filename = `DanhSachDonThu_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    try {
      await workbook.xlsx.write(res);
    } catch (err) {
      this.logger.error('ExcelJS write failed for petition export', err);
      if (!res.headersSent) res.status(500).json({ error: 'Export failed' });
      else res.destroy();
    }
  }

  // ─────────────────────────────────────────────
  // EXPORT DUPLICATES (Đơn trùng lặp)
  // ─────────────────────────────────────────────
  async exportDuplicates(
    query: { status?: string; criteria?: string; fromDate?: string; toDate?: string },
    dataScope: DataScope | null | undefined,
    res: Response,
  ): Promise<void> {
    const where: Prisma.PetitionWhereInput = { deletedAt: null };
    if (query.status && (Object.values(PetitionStatus) as string[]).includes(query.status)) {
      where.status = query.status as PetitionStatus;
    }
    if (query.fromDate) {
      where.receivedDate = { ...(where.receivedDate as any), gte: new Date(query.fromDate) };
    }
    if (query.toDate) {
      where.receivedDate = { ...(where.receivedDate as any), lte: new Date(query.toDate + 'T23:59:59.999Z') };
    }

    const scopeFilter = buildPetitionScopeFilter(dataScope);
    if (scopeFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        scopeFilter as Prisma.PetitionWhereInput,
      ];
    }

    // Resolve criteria → groupBy key. Default to senderName.
    // Accepts both English field names and Vietnamese UI labels for compatibility.
    type DupKey = 'senderName' | 'senderPhone' | 'senderAddress' | 'suspectedPerson';
    const CRITERIA_MAP: Record<string, DupKey> = {
      senderName: 'senderName',
      'Họ tên': 'senderName',
      senderPhone: 'senderPhone',
      'Số điện thoại': 'senderPhone',
      senderAddress: 'senderAddress',
      'Địa chỉ': 'senderAddress',
      suspectedPerson: 'suspectedPerson',
      'Bị đơn trùng': 'suspectedPerson',
    };
    const dupKey: DupKey = (query.criteria && CRITERIA_MAP[query.criteria]) || 'senderName';

    // Step 1: find duplicate values within the filtered scope (count >= 2, non-null/non-empty).
    const groups = await (this.prisma.petition.groupBy as any)({
      by: [dupKey],
      where: {
        ...where,
        [dupKey]: { not: null, notIn: [''] },
      },
      _count: { _all: true },
      having: { [dupKey]: { _count: { gt: 1 } } },
    });
    const dupValues: string[] = (groups as Array<Record<string, unknown>>)
      .map((g) => g[dupKey])
      .filter((v): v is string => typeof v === 'string' && v.length > 0);

    // Step 2: fetch petitions whose dupKey value is in dupValues. If no duplicate groups
    // were found, return an empty Excel rather than the entire petition list.
    const records = dupValues.length > 0
      ? await this.prisma.petition.findMany({
          where: { ...where, [dupKey]: { in: dupValues } },
          take: 500,
          orderBy: [{ [dupKey]: 'asc' }, { receivedDate: 'desc' }],
          select: {
            id: true,
            stt: true,
            senderName: true,
            summary: true,
            receivedDate: true,
            status: true,
            assignedTo: { select: { firstName: true, lastName: true } },
          },
        })
      : [];

    const COL_COUNT = 7;
    const HEADERS = ['STT', 'Mã đơn', 'Người nộp', 'Tóm tắt nội dung', 'Ngày tiếp nhận', 'Trạng thái', 'ĐTV xử lý'];
    const WIDTHS = [6, 18, 22, 45, 16, 20, 22];

    const fromStr = query.fromDate ? new Date(query.fromDate).toLocaleDateString('vi-VN') : '';
    const toStr = query.toDate ? new Date(query.toDate).toLocaleDateString('vi-VN') : '';
    const period = fromStr && toStr ? `Từ ngày ${fromStr} đến ngày ${toStr}` : 'Tất cả thời gian';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Đơn trùng lặp');

    BcaExcelHelper.addHeader(sheet, COL_COUNT, 'DANH SÁCH ĐƠN TRÙNG LẶP', period);

    const headerRow = sheet.getRow(7);
    BcaExcelHelper.addColumnHeaders(headerRow, HEADERS, WIDTHS);

    records.forEach((rec, idx) => {
      const assignedName = rec.assignedTo
        ? `${rec.assignedTo.lastName ?? ''} ${rec.assignedTo.firstName ?? ''}`.trim()
        : '';
      const dataRow = sheet.addRow([
        idx + 1,
        rec.stt ?? '',
        rec.senderName ?? '',
        rec.summary ?? '',
        rec.receivedDate ? rec.receivedDate.toLocaleDateString('vi-VN') : '',
        PETITION_STATUS_LABEL[rec.status as PetitionStatus] ?? rec.status ?? '',
        assignedName,
      ]);
      BcaExcelHelper.styleDataRow(dataRow, idx % 2 === 1, COL_COUNT);
    });

    const lastDataRow = sheet.lastRow?.number ?? 7;
    BcaExcelHelper.addFooter(sheet, lastDataRow + 2, COL_COUNT);
    BcaExcelHelper.setPrintSetup(sheet);

    const filename = `DonTrungLap_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    try {
      await workbook.xlsx.write(res);
    } catch (err) {
      this.logger.error('ExcelJS write failed for duplicate export', err);
      if (!res.headersSent) res.status(500).json({ error: 'Export failed' });
      else res.destroy();
    }
  }

  // ─────────────────────────────────────────────
  // EXPORT TO WORD
  // ─────────────────────────────────────────────
  async exportToWord(
    id: string,
    dataScope: DataScope | null | undefined,
    res: Response,
  ): Promise<void> {
    const result = await this.getById(id, dataScope);
    const petition = result.data as {
      id: string;
      stt?: string | null;
      receivedDate?: Date | null;
      senderName?: string | null;
      senderAddress?: string | null;
      petitionType?: string | null;
      summary?: string | null;
      status?: string | null;
      assignedTo?: { firstName?: string | null; lastName?: string | null } | null;
    };

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: 'PHÒNG CẢNH SÁT HÌNH SỰ — PC02',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: 'HỒ SƠ CHI TIẾT ĐƠN THƯ',
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Số đơn: ', bold: true }),
                new TextRun(petition.stt ?? ''),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Ngày tiếp nhận: ', bold: true }),
                new TextRun(
                  petition.receivedDate
                    ? new Date(petition.receivedDate).toLocaleDateString('vi-VN')
                    : '',
                ),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Người gửi: ', bold: true }),
                new TextRun(petition.senderName ?? ''),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Địa chỉ: ', bold: true }),
                new TextRun(petition.senderAddress ?? ''),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Phân loại: ', bold: true }),
                new TextRun(petition.petitionType ?? ''),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Nội dung: ', bold: true }),
                new TextRun(petition.summary ?? ''),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Trạng thái: ', bold: true }),
                new TextRun(petition.status ?? ''),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Cán bộ phụ trách: ', bold: true }),
                new TextRun(
                  petition.assignedTo
                    ? `${petition.assignedTo.firstName ?? ''} ${petition.assignedTo.lastName ?? ''}`.trim()
                    : '',
                ),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `DonThu_${(petition.stt ?? id).replace(/\//g, '_')}.docx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
