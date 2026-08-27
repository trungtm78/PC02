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
import { buildPetitionCreateData } from './petition-data.builder';
import { QueryPetitionsDto } from './dto/query-petitions.dto';
import { QueryPetitionsStatsDto } from './dto/query-petitions-stats.dto';
import { ConvertToIncidentDto } from './dto/convert-incident.dto';
import { ConvertToCaseDto } from './dto/convert-case.dto';
import { AssignPetitionDto } from './dto/assign-petition.dto';
import { ExportPetitionsQueryDto } from './dto/export-petitions-query.dto';
import { Prisma, LoaiDon, PetitionStatus, CaseStatus } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { buildPetitionScopeFilter } from '../common/utils/scope-filter.util';
import { apDungKyVaoWhere } from '../common/utils/thong-ke-ky.util';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { BcaExcelHelper } from '../common/bca-excel.helper';
import { PETITION_STATUS_LABEL } from '../common/constants/status-labels.constants';
import { resolveGroup, countByGroup } from '../common/status-groups.util';
import { PETITION_STATUS_GROUPS } from './petitions.constants';
import { hoSoCodeVariants } from '../common/utils/ho-so-code.util';
import { buildListOrderBy, type ListSortOrder } from '../common/utils/list-sort.util';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PetitionAssignedEvent } from '../notifications/events/notification.events';

// Vietnamese labels for LoaiDon — Excel display consistency with PETITION_STATUS_LABEL.
// Mirror frontend LOAI_DON_LABEL exactly (no drift). FE source:
// frontend/src/shared/enums/status-labels.ts → LOAI_DON_LABEL.
const LOAI_DON_LABEL_BE: Record<LoaiDon, string> = {
  [LoaiDon.TO_CAO]: 'Tố cáo',
  [LoaiDon.KHIEU_NAI]: 'Khiếu nại',
  [LoaiDon.KIEN_NGHI]: 'Kiến nghị',
  [LoaiDon.PHAN_ANH]: 'Phản ánh',
};

@Injectable()
export class PetitionsService {
  private readonly logger = new Logger(PetitionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly deadlineRules: DeadlineRulesService,
    private readonly docNums: DocumentNumbersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────────────────────
  // GET LIST
  // ─────────────────────────────────────────────
  async getList(query: QueryPetitionsDto, dataScope?: DataScope | null) {
    const {
      search,
      status,
      statusGroup,
      unit,
      senderName,
      fromDate,
      toDate,
      overdue,
      wardTeamId,
      stt,
      sttCu,
      enteredById,
      limit = 20,
      offset = 0,
      sortBy, // mac dinh do buildListOrderBy quyet dinh, KHONG dat o day
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
        { soHoSoCu: { contains: search, mode: 'insensitive' } }, // truy nguyên: tìm theo STT hệ cũ
        { sttCu: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Nhóm trạng thái (drill-down thẻ thống kê) THẮNG status đơn lẻ — giống semantic
    // `phase` đã ship ở Vụ việc. `resolveGroup` chặn prototype chain, KHÔNG viết
    // `PETITION_STATUS_GROUPS[statusGroup]` trần (sẽ trả hàm Object → Prisma ném 500).
    const groupStatuses = resolveGroup(PETITION_STATUS_GROUPS, statusGroup);
    if (groupStatuses) {
      where.status = { in: [...groupStatuses] };
    } else if (status) {
      where.status = status;
    }

    // Mã hồ sơ tồn tại ở HAI dạng: hệ cũ hiện `26-11171`, hệ mới lưu `2026-11171`. Cán bộ
    // đọc quen dạng ngắn nên sẽ gõ dạng ngắn. Khớp CHÍNH XÁC theo danh sách biến thể, không
    // dùng `contains` — `contains: '26-1'` sẽ quét trúng hàng nghìn mã khác.
    const bienTheStt = hoSoCodeVariants(stt);
    if (bienTheStt.length) {
      where.stt = { in: bienTheStt };
    }

    if (sttCu?.trim()) {
      where.sttCu = { contains: sttCu.trim(), mode: 'insensitive' };
    }

    if (enteredById?.trim()) {
      where.enteredById = enteredById.trim();
    }

    if (unit) {
      // Lọc theo ĐÚNG cột mà cột "Đơn vị giải quyết" đang hiện. `unit` là đơn vị TIẾP NHẬN và
      // rỗng ở toàn bộ 46.660 đơn thư, nên lọc trên nó không bao giờ ra kết quả — cán bộ lọc
      // theo tổ sẽ tưởng tổ ấy không có hồ sơ nào. Giữ tên tham số `unit` để địa chỉ trang cũ
      // vẫn dùng được.
      where.donViGiaiQuyet = { contains: unit, mode: 'insensitive' };
    }

    if (senderName) {
      where.senderName = { contains: senderName, mode: 'insensitive' };
    }

    // Kỳ thống kê: nếu người dùng không tự đặt ngày thì áp mặc định admin cấu hình. Cùng
    // một hàm với thẻ số và badge menu, nên ba chỗ không thể lệch nhau.
    const kyThongKe = await this.settings.getKyThongKe({ truong: query.thongKeTruongNgay });
    apDungKyVaoWhere(where as Record<string, unknown>, kyThongKe, fromDate, toDate, 'receivedDate');

    if (overdue) {
      where.deadline = { lt: new Date() };
      // Guard `if (!status)` cũ KHÔNG chặn statusGroup → bấm thẻ khi đang lọc quá hạn sẽ
      // mất điều kiện nhóm. Gộp bằng notIn thay vì gán đè (Prisma cho phép in + notIn).
      const notTerminal = [
        PetitionStatus.DA_GIAI_QUYET,
        PetitionStatus.DA_CHUYEN_VU_VIEC,
        PetitionStatus.DA_CHUYEN_VU_AN,
      ];
      where.status =
        typeof where.status === 'string'
          ? { equals: where.status, notIn: notTerminal }
          : { ...(where.status ?? {}), notIn: notTerminal };
    }

    // v0.36.0.0: filter theo phường công tác (Team.wardId) — cross-ward view PC02/ADMIN
    if (wardTeamId) {
      where.assignedTeam = { is: { wardId: wardTeamId } };
    }

    // Apply data scope filter
    const scopeFilter = buildPetitionScopeFilter(dataScope);
    if (scopeFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        scopeFilter as Prisma.PetitionWhereInput,
      ];
    }

    // Mặc định sắp theo NGÀY NHẬN, không phải ngày tạo. Lý do đo được trên dữ liệu
    // thật: toàn bộ 45.459 đơn thư có CÙNG một `createdAt` (ngày di trú), nên sắp theo
    // nó cho ra thứ tự ngẫu nhiên. `receivedDate` phủ 100% và là NOT NULL.
    // Kèm lợi ích: `receivedDate` CÓ chỉ mục còn `createdAt` thì không.
    const orderBy = buildListOrderBy({
      sortBy,
      sortOrder: sortOrder as ListSortOrder,
      allowed: [
        'createdAt',
        'updatedAt',
        'receivedDate',
        'deadline',
        'status',
        'senderName',
      ],
      defaultField: 'receivedDate',
      nullableFields: ['deadline', 'sortReceivedDate'],
      // Người dùng nói "ngày nhận", nhưng SẮP theo cột sinh `sortReceivedDate`: nó bằng
      // `receivedDate` với ngày hợp lý và NULL với ngày phi lý (9 hồ sơ năm 3023, 2925,
      // 0225...). Kèm NULLS LAST thì rác chìm xuống cuối thay vì chiếm màn hình đầu.
      // Cột HIỂN THỊ vẫn là `receivedDate` gốc — không giấu dữ liệu, chỉ đổi thứ tự.
      fieldAliases: { receivedDate: 'sortReceivedDate' },
    });

    const [data, total] = await Promise.all([
      this.prisma.petition.findMany({
        where,
        select: {
          id: true,
          stt: true,
          receivedDate: true,
          unit: true,
          // Cột "Đơn vị giải quyết" của danh sách đọc trường này. Truy vấn dùng `select`
          // tường minh nên thiếu khai là cột luôn rỗng, không lỗi, không cảnh báo.
          donViGiaiQuyet: true,
          senderName: true,
          suspectedPerson: true,
          status: true,
          deadline: true,
          summary: true,
          // Ba cột hệ cũ hiển thị trên danh sách mà hệ mới chưa trả về. `summary` phủ
          // 99,99% đơn thư — thiếu nó thì cán bộ phải mở từng hồ sơ mới biết nội dung.
          nguonDon: true,
          ketQuaXuLyKhac: true,
          sttCu: true,
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
          assignedTeam: {
            select: { ward: { select: { name: true } } },
          },
        },
        orderBy,
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

  // v0.37.1 PR-PICK — list Petitions eligible for linking from a new Case.
  // Returns only: not soft-deleted + not yet linked to any Case + in user's DataScope.
  // Used by CaseFormPage Petition picker (CaseProvenancePicker → /petitions/linkable).
  async listLinkable(
    query: { search?: string; limit?: number },
    dataScope?: DataScope | null,
  ) {
    const limit = Math.min(query.limit ?? 50, 100);
    const search = (query.search ?? '').trim();

    const baseWhere: Prisma.PetitionWhereInput = {
      deletedAt: null,
      linkedCaseId: null,
    };

    // Scope filter: same OR pattern as cases.service.create (FROM_PETITION branch)
    if (dataScope && !dataScope.canDispatch) {
      const orConditions: Prisma.PetitionWhereInput[] = [];
      if (dataScope.userIds.length > 0) {
        orConditions.push({ enteredById: { in: dataScope.userIds } });
      }
      if (dataScope.writableTeamIds.length > 0) {
        orConditions.push({ assignedTeamId: { in: dataScope.writableTeamIds } });
        if (!dataScope.isWardOfficer) {
          orConditions.push({ assignedTeamId: null });
        }
      }
      if (orConditions.length === 0) {
        return { data: [] };
      }
      baseWhere.OR = orConditions;
    }

    // Search across STT (prefix-style — petitioners search by SỐ TT) and senderName (contains).
    if (search.length > 0) {
      baseWhere.AND = [
        baseWhere.OR ? { OR: baseWhere.OR } : {},
        {
          OR: [
            { stt: { startsWith: search, mode: 'insensitive' as const } },
            { senderName: { contains: search, mode: 'insensitive' as const } },
          ],
        },
      ];
      delete baseWhere.OR;
    }

    const rows = await this.prisma.petition.findMany({
      where: baseWhere,
      take: limit,
      orderBy: { receivedDate: 'desc' },
      select: {
        id: true,
        stt: true,
        senderName: true,
        receivedDate: true,
        petitionType: true,
        updatedAt: true,
      },
    });

    return { data: rows };
  }

  private checkWriteScope(
    record: { enteredById?: string | null; assignedTeamId?: string | null },
    dataScope?: DataScope | null,
  ) {
    if (!dataScope) return;
    const { userIds, writableTeamIds, isWardOfficer } = dataScope;
    const ownerMatch = record.enteredById && userIds.includes(record.enteredById);
    const teamMatch = record.assignedTeamId && writableTeamIds.includes(record.assignedTeamId);
    // P2-001 fix: ward officer EXCLUDED from intake (unassigned) per scope-filter design intent.
    // Without this, WO could convert unassigned petition if they obtain ID (even though list filter hides it).
    const unassignedMatch = !record.assignedTeamId && writableTeamIds.length > 0 && !isWardOfficer;
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
    dataScope?: DataScope | null,
  ) {
    // v0.33.0.0: ward officer auto-set assignedTeamId
    const effectiveAssignedTeamId =
      (dataScope?.isWardOfficer ? dataScope.wardTeamId : null) ?? dto.assignedTeamId;
    // Validate receivedDate is not in the future
    const receivedDate = new Date(dto.receivedDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (receivedDate > today) {
      throw new BadRequestException(
        'Ngày tiếp nhận không được là ngày tương lai',
      );
    }

    // Check manual stt uniqueness OUTSIDE tx (read-only, safe)
    if (dto.stt) {
      const dup = await this.prisma.petition.findUnique({ where: { stt: dto.stt } });
      if (dup) throw new ConflictException(`Số tiếp nhận "${dto.stt}" đã tồn tại`);
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

    // Cán bộ đề xuất (ký Phiếu đề xuất) — chặn id rác trước khi ghi FK.
    if (dto.canBoDeXuatId) {
      const canBo = await this.prisma.user.findUnique({
        where: { id: dto.canBoDeXuatId },
      });
      if (!canBo) {
        throw new BadRequestException('Cán bộ đề xuất không tồn tại');
      }
    }

    // Auto-calculate deadline by petition type — days read from SystemSettings (GAP-7)
    let computedDeadline: Date | undefined;
    let deadlineSettingKey: string | undefined;
    let deadlineDays: number | undefined;
    let deadlineRuleVersionId: string | null = null;
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
      const rule = await this.deadlineRules.getActive(settingKey);
      if (!rule) {
        throw new BadRequestException(
          `Không có quy tắc '${settingKey}' đang hiệu lực. Liên hệ admin chạy seed/migration.`,
        );
      }
      deadlineDays = rule.value;
      deadlineRuleVersionId = rule.id;
      base.setDate(base.getDate() + deadlineDays);
      computedDeadline = base;
    }

    // enteredById is always the authenticated user (prevent forgery)
    const record = await this.prisma.$transaction(async (tx: any) => {
      let resolvedStt: string;
      if (dto.stt) {
        resolvedStt = dto.stt;
      } else {
        const { number, logId } = await this.docNums.commitWithTx('PETITION', { userId: actorId }, tx);
        resolvedStt = number;
        const rec = await tx.petition.create({
          // Builder DUY NHẤT — gồm cả field v0.47 (trước bị rớt) + field-parity. Xem petition-data.builder.ts.
          data: buildPetitionCreateData(dto, {
            stt: resolvedStt,
            actorId,
            computedDeadline,
            deadlineRuleVersionId,
            effectiveAssignedTeamId,
          }),
          include: {
            enteredBy: {
              select: { id: true, firstName: true, lastName: true, username: true },
            },
            assignedTo: {
              select: { id: true, firstName: true, lastName: true, username: true },
            },
          },
        });
        await tx.documentNumberLog.update({ where: { id: logId }, data: { documentId: rec.id } });
        return rec;
      }
      return tx.petition.create({
        data: buildPetitionCreateData(dto, {
          stt: resolvedStt,
          actorId,
          computedDeadline,
          deadlineRuleVersionId,
          effectiveAssignedTeamId,
        }),
        include: {
          enteredBy: {
            select: { id: true, firstName: true, lastName: true, username: true },
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, username: true },
          },
        },
      });
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
  /**
   * Ba cột NOT NULL trong lược đồ: `stt`, `receivedDate`, `senderName`.
   *
   * Từ 26/08/2026 lớp làm sạch dữ liệu giữ nguyên `null` để thao tác xoá trắng đi được tới
   * nơi. Nhưng `UpdatePetitionDto` kế thừa `PartialType` nên mọi trường đều mang
   * `@IsOptional()`, mà `@IsOptional()` bỏ qua MỌI kiểm tra khi giá trị là `null`. Không chặn
   * ở đây thì một lời gọi sai đi thẳng tới Prisma và nổ 500 kèm vết lỗi của thư viện.
   *
   * Lời gọi sai phải trả 400 kèm tên trường.
   */
  private chanNullOCotKhongChoRong(dto: UpdatePetitionDto): void {
    const COT_KHONG_CHO_RONG = ['stt', 'receivedDate', 'senderName'] as const;
    const ban = dto as unknown as Record<string, unknown>;
    for (const cot of COT_KHONG_CHO_RONG) {
      if (ban[cot] === null) {
        throw new BadRequestException(`Truong "${cot}" khong duoc de trong`);
      }
    }
  }
  async update(
    id: string,
    dto: UpdatePetitionDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    this.chanNullOCotKhongChoRong(dto);

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

    // v0.30: PETITION_UPDATED via wrapUpdate — full before/after for inline diff.
    const petitionData = {
      ...(dto.stt !== undefined && { stt: dto.stt }),
      // MERGE metadata (dynamic legacy fields): giữ field cũ + ghi đè field sửa (an toàn data).
      ...(dto.metadata !== undefined && {
        metadata: {
          ...((existing.metadata as Record<string, unknown> | null) ?? {}),
          ...(dto.metadata as Record<string, unknown>),
        } as Prisma.InputJsonValue,
      }),
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
      // v0.47 PR3.1 — Nội dung phiếu đề xuất + cross-doc business fields
      ...(dto.canBoDeXuatId !== undefined && { canBoDeXuatId: dto.canBoDeXuatId || null }),
      ...(dto.nhanThay !== undefined && { nhanThay: dto.nhanThay }),
      ...(dto.deXuat !== undefined && { deXuat: dto.deXuat }),
      ...(dto.raSoatTrung !== undefined && { raSoatTrung: dto.raSoatTrung }),
      ...(dto.baoCaoBanGiamDoc !== undefined && {
        baoCaoBanGiamDoc: dto.baoCaoBanGiamDoc,
      }),
      ...(dto.petitionDate !== undefined && {
        petitionDate: dto.petitionDate ? new Date(dto.petitionDate) : null,
      }),
      ...(dto.nguonDon !== undefined && { nguonDon: dto.nguonDon }),
      ...(dto.subTeamAssigned !== undefined && {
        subTeamAssigned: dto.subTeamAssigned,
      }),
      ...(dto.lyDoChuyen !== undefined && { lyDoChuyen: dto.lyDoChuyen }),
      ...(dto.canCuPhapLy !== undefined && { canCuPhapLy: dto.canCuPhapLy }),
      ...(dto.huongDanKhoiKien !== undefined && {
        huongDanKhoiKien: dto.huongDanKhoiKien,
      }),
      ...(dto.lyDoTraDon !== undefined && { lyDoTraDon: dto.lyDoTraDon }),
      // ── Field-parity hệ thống cũ (giai đoạn tiếp nhận) ──
      ...(dto.senderIdNumber !== undefined && { senderIdNumber: dto.senderIdNumber }),
      ...(dto.senderIdIssueDate !== undefined && {
        senderIdIssueDate: dto.senderIdIssueDate ? new Date(dto.senderIdIssueDate) : null,
      }),
      ...(dto.senderIdIssuePlace !== undefined && { senderIdIssuePlace: dto.senderIdIssuePlace }),
      ...(dto.senderIsAnonymous !== undefined && { senderIsAnonymous: dto.senderIsAnonymous }),
      ...(dto.loaiThongTin !== undefined && { loaiThongTin: dto.loaiThongTin }),
      ...(dto.soPhieuChuyen !== undefined && { soPhieuChuyen: dto.soPhieuChuyen }),
      ...(dto.ngayPhieuChuyen !== undefined && {
        ngayPhieuChuyen: dto.ngayPhieuChuyen ? new Date(dto.ngayPhieuChuyen) : null,
      }),
      ...(dto.ngayTiepNhanNguonTin !== undefined && {
        ngayTiepNhanNguonTin: dto.ngayTiepNhanNguonTin ? new Date(dto.ngayTiepNhanNguonTin) : null,
      }),
      ...(dto.toiDanhBanDau !== undefined && { toiDanhBanDau: dto.toiDanhBanDau }),
      ...(dto.crimeChinhId !== undefined && { crimeChinhId: dto.crimeChinhId || null }),
      ...(dto.noiXayRa !== undefined && { noiXayRa: dto.noiXayRa }),
      ...(dto.noiXayRaPhuongXa !== undefined && { noiXayRaPhuongXa: dto.noiXayRaPhuongXa }),
      ...(dto.ngayXayRa !== undefined && {
        ngayXayRa: dto.ngayXayRa ? new Date(dto.ngayXayRa) : null,
      }),
      ...(dto.loaiToiPham !== undefined && { loaiToiPham: dto.loaiToiPham }),
      ...(dto.phuongThucThuDoan !== undefined && { phuongThucThuDoan: dto.phuongThucThuDoan }),
      ...(dto.ngayGiaoDonViGiaiQuyet !== undefined && {
        ngayGiaoDonViGiaiQuyet: dto.ngayGiaoDonViGiaiQuyet ? new Date(dto.ngayGiaoDonViGiaiQuyet) : null,
      }),
      ...(dto.laCongNgheCao !== undefined && { laCongNgheCao: dto.laCongNgheCao }),
      ...(dto.lanhDaoToTung !== undefined && { lanhDaoToTung: dto.lanhDaoToTung }),
      ...(dto.ketQuaXuLyKhac !== undefined && { ketQuaXuLyKhac: dto.ketQuaXuLyKhac }),
      ...(dto.thoiHanUTDT !== undefined && { thoiHanUTDT: dto.thoiHanUTDT ? new Date(dto.thoiHanUTDT) : null }),
      // Field-parity bổ sung tab "Thông tin" form cũ /doi-1/Them (2026-06-26).
      ...(dto.ngayDeXuat !== undefined && { ngayDeXuat: dto.ngayDeXuat ? new Date(dto.ngayDeXuat) : null }),
      ...(dto.phanLoaiNguonTin !== undefined && { phanLoaiNguonTin: dto.phanLoaiNguonTin }),
      ...(dto.dieuTraVien !== undefined && { dieuTraVien: dto.dieuTraVien }),
      ...(dto.donViGiaiQuyet !== undefined && { donViGiaiQuyet: dto.donViGiaiQuyet }),
      // Thẩm quyền & đơn vị xử lý (form đăng ký đơn thư).
      ...(dto.thuocThamQuyen !== undefined && { thuocThamQuyen: dto.thuocThamQuyen }),
      ...(dto.donViXuLy !== undefined && { donViXuLy: dto.donViXuLy }),
      // ── Field-parity ĐẦY ĐỦ (feat/legacy-field-parity) ──
      ...(dto.phanLoaiToiPhamLinhVuc !== undefined && { phanLoaiToiPhamLinhVuc: dto.phanLoaiToiPhamLinhVuc }),
      ...(dto.phanLoaiHoSoNoiBo !== undefined && { phanLoaiHoSoNoiBo: dto.phanLoaiHoSoNoiBo }),
      ...(dto.ghiChuKhac !== undefined && { ghiChuKhac: dto.ghiChuKhac }),
      ...(dto.yeuCauBoSung !== undefined && { yeuCauBoSung: dto.yeuCauBoSung }),
      ...(dto.soTienBiThietHai !== undefined && { soTienBiThietHai: dto.soTienBiThietHai }),
      ...(dto.soLuongBiHai !== undefined && { soLuongBiHai: dto.soLuongBiHai }),
      // ── Ô hệ cũ đưa về đúng vị trí trên form Đơn thư (26/08/2026) ──
      ...(dto.baoCaoBanGiamDocText !== undefined && { baoCaoBanGiamDocText: dto.baoCaoBanGiamDocText }),
      ...(dto.tinhTrang !== undefined && { tinhTrang: dto.tinhTrang }),
      ...(dto.soQDPhanCongNguonTin !== undefined && { soQDPhanCongNguonTin: dto.soQDPhanCongNguonTin }),
      ...(dto.ngayQDPhanCongNguonTin !== undefined && { ngayQDPhanCongNguonTin: dto.ngayQDPhanCongNguonTin ? new Date(dto.ngayQDPhanCongNguonTin) : null }),
      ...(dto.soQDTamDinhChiNguonTin !== undefined && { soQDTamDinhChiNguonTin: dto.soQDTamDinhChiNguonTin }),
      ...(dto.ngayQDTamDinhChiNguonTin !== undefined && { ngayQDTamDinhChiNguonTin: dto.ngayQDTamDinhChiNguonTin ? new Date(dto.ngayQDTamDinhChiNguonTin) : null }),
      ...(dto.canCuTamDinhChiNguonTin !== undefined && { canCuTamDinhChiNguonTin: dto.canCuTamDinhChiNguonTin }),
      ...(dto.soPhucHoiNguonTin !== undefined && { soPhucHoiNguonTin: dto.soPhucHoiNguonTin }),
      ...(dto.ngayPhucHoiNguonTin !== undefined && { ngayPhucHoiNguonTin: dto.ngayPhucHoiNguonTin ? new Date(dto.ngayPhucHoiNguonTin) : null }),
      ...(dto.sttCu !== undefined && { sttCu: dto.sttCu }),
    };
    const petitionInclude = {
      enteredBy: {
        select: { id: true, firstName: true, lastName: true, username: true },
      },
      assignedTo: {
        select: { id: true, firstName: true, lastName: true, username: true },
      },
      canBoDeXuat: {
        select: { id: true, firstName: true, lastName: true, username: true },
      },
    } as const;

    let record;
    try {
      record = await this.audit.wrapUpdate({
        fetchFn: () =>
          this.prisma.petition.findUnique({
            where: { id },
            include: petitionInclude,
          }),
        updateFn: () =>
          this.prisma.petition.update({
            where: {
              id,
              ...(dto.expectedUpdatedAt ? { updatedAt: new Date(dto.expectedUpdatedAt) } : {}),
            },
            data: petitionData,
            include: petitionInclude,
          }),
        action: 'PETITION_UPDATED',
        subject: 'Petition',
        subjectId: id,
        userId: actorId,
        meta: { ipAddress: meta?.ipAddress, userAgent: meta?.userAgent },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Đơn thư đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    if (dto.assignedToId && dto.assignedToId !== existing.assignedToId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { firstName: true, lastName: true },
      });
      const byUserName = actor ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() : '';
      const petitionTitle = existing.senderName
        ? `${existing.petitionType} - ${existing.senderName}`
        : (existing as any).stt ?? id;
      this.eventEmitter.emit('petition.assigned', new PetitionAssignedEvent(
        id, petitionTitle, dto.assignedToId, actorId, byUserName,
      ));
    }

    // Log separate PETITION_STATUS_CHANGED event for timeline queries
    if (dto.status !== undefined && dto.status !== existing.status) {
      await this.audit.log({
        userId: actorId,
        action: 'PETITION_STATUS_CHANGED',
        subject: 'Petition',
        subjectId: id,
        metadata: { fromStatus: existing.status, toStatus: dto.status },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
    }

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

    // v0.52 Cycle 4 — Document handoff: petition documents → incident.
    // Existing convertToIncident không atomic (petition.update ngoài transaction),
    // không gộp được vào array-form $transaction. Document handoff đặt sau petition.update —
    // nếu fail, petition đã link incident nhưng documents còn petitionId only.
    // Acceptable: documents vẫn truy được qua petitionId; admin có thể replay.
    await this.prisma.document.updateMany({
      where: { petitionId, deletedAt: null },
      data: { incidentId: incident.id },
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
          // v0.37.1 PR-AUDIT — close provenance gap: convertToCase was creating Case
          // without caseProvenance, which would fail NOT NULL contract in PR-PROV-2.
          caseProvenance: 'FROM_PETITION' as const,
          linkedPetitionId: petitionId,
        },
      });

      await tx.petition.update({
        where: {
          id: petitionId,
          // P1-002 fix: always-lock (was conditional). DTO requires expectedUpdatedAt.
          updatedAt: new Date(dto.expectedUpdatedAt),
        },
        data: {
          linkedCaseId: newCase.id,
          status: PetitionStatus.DA_CHUYEN_VU_AN,
        },
      });

      // v0.52 Cycle 4 — Document handoff: petition-linked tài liệu re-link sang case mới
      // trong CÙNG transaction. petitionId giữ làm provenance, caseId set để Case tab
      // "Tài liệu" hiển thị evidence của đơn gốc. Soft-deleted documents bỏ qua.
      await tx.document.updateMany({
        where: { petitionId, deletedAt: null },
        data: { caseId: newCase.id },
      });

      return [newCase];
    });
    } catch (e) {
      // P1-002: P2025 = row not found với updatedAt mismatch → race detected.
      // P2002 = unique constraint violation (partial index on linkedCaseId) → race detected at DB.
      const code = (e as { code?: string })?.code;
      if (code === 'P2025' || code === 'P2002') {
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
    // v0.36.0.0: include assignedTeam.wardId + ward để compute escalation FROM ward
    const existing = await this.prisma.petition.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignedTeam: {
          select: {
            wardId: true,
            ward: { select: { name: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException(`Đơn thư không tồn tại (id: ${id})`);

    const team = await this.prisma.team.findFirst({
      where: { id: dto.assignedTeamId, isActive: true },
    });
    if (!team) throw new BadRequestException(`Tổ không tồn tại hoặc đã ngừng hoạt động (id: ${dto.assignedTeamId})`);

    // I.1: auto-assign to leader when assignedToId not provided
    let resolvedAssignedToId: string | null = dto.assignedToId ?? null;
    if (dto.assignedToId) {
      const member = await this.prisma.userTeam.findFirst({
        where: { userId: dto.assignedToId, teamId: dto.assignedTeamId },
      });
      if (!member) throw new BadRequestException('Cán bộ xử lý không thuộc tổ được chỉ định');
    } else {
      // Auto-detect leader
      const members = await this.prisma.userTeam.findMany({
        where: { teamId: dto.assignedTeamId },
        select: { userId: true, isLeader: true },
      });
      const leader = members.find((m) => m.isLeader);
      if (leader) {
        resolvedAssignedToId = leader.userId;
      } else {
        console.warn(`[PetitionsService] assignPetition: team ${dto.assignedTeamId} has no leader — assignedToId left null`);
      }
    }

    try {
      await this.prisma.petition.update({
        where: {
          id,
          ...(dto.expectedUpdatedAt ? { updatedAt: dto.expectedUpdatedAt } : {}),
        },
        data: {
          assignedTeamId: dto.assignedTeamId,
          assignedToId: resolvedAssignedToId,
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

    // v0.36.0.0: emit PETITION_ESCALATED_FROM_WARD khi ward team → non-ward team
    const existingWithTeam = existing as typeof existing & {
      assignedTeam: { wardId: string | null; ward: { name: string } | null } | null;
    };
    const wasInWardTeam = existingWithTeam.assignedTeam?.wardId != null;
    const isReassigning = dto.assignedTeamId !== existing.assignedTeamId;
    if (wasInWardTeam && isReassigning) {
      const newTeam = await this.prisma.team.findUnique({
        where: { id: dto.assignedTeamId },
        select: { wardId: true },
      });
      if (newTeam && newTeam.wardId == null) {
        await this.audit.log({
          userId: actorId,
          action: 'PETITION_ESCALATED_FROM_WARD',
          subject: 'Petition',
          subjectId: id,
          metadata: {
            oldTeamId: existing.assignedTeamId,
            newTeamId: dto.assignedTeamId,
            oldWardId: existingWithTeam.assignedTeam!.wardId,
            oldWardName: existingWithTeam.assignedTeam!.ward?.name ?? null,
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
      }
    }

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
      // Lọc theo ĐÚNG cột mà cột "Đơn vị giải quyết" đang hiện. Trước 27/08/2026 nó lọc `unit`
      // — cột rỗng hoàn toàn — nên bộ lọc không bao giờ ra kết quả, và cán bộ tưởng đơn vị ấy
      // không có hồ sơ nào. Giữ tên tham số `unit` để địa chỉ trang cũ vẫn dùng được.
      where.donViGiaiQuyet = { contains: query.unit, mode: 'insensitive' };
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
      // Cùng thứ tự với DANH SÁCH trên màn hình: sắp theo cột sinh để 9 hồ sơ có ngày
      // phi lý (năm 3023, 2925...) chìm xuống cuối. Nếu xuất file mà thứ tự khác màn
      // hình thì cán bộ đối chiếu hai bên sẽ tưởng dữ liệu sai.
      orderBy: [{ sortReceivedDate: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
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
  // EXPORT WARD PETITIONS (Đơn thư theo phường/xã)
  // Mirror IncidentsService.exportWardIncidents — BCA-styled XLSX
  // Endpoint: GET /api/v1/petitions/export/ward
  // ─────────────────────────────────────────────
  async exportWardPetitions(
    query: { unitId?: string; fromDate?: string; toDate?: string },
    dataScope: DataScope | null | undefined,
    res: Response,
    actor?: { userId: string; ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    if (actor) {
      await this.audit.log({
        userId: actor.userId,
        action: 'PETITION_EXPORTED',
        subject: 'Petition',
        metadata: { format: 'xlsx', kind: 'ward', filters: query },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
    }

    const where: Prisma.PetitionWhereInput = { deletedAt: null };
    // Cùng lý do: cột `unit` rỗng ở mọi đơn thư nên lọc trên nó trả về danh sách trắng.
    if (query.unitId) where.donViGiaiQuyet = query.unitId;
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.fromDate);
      if (query.toDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.toDate + 'T23:59:59.999Z');
    }

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
      // Cùng thứ tự với DANH SÁCH trên màn hình: sắp theo cột sinh để 9 hồ sơ có ngày
      // phi lý (năm 3023, 2925...) chìm xuống cuối. Nếu xuất file mà thứ tự khác màn
      // hình thì cán bộ đối chiếu hai bên sẽ tưởng dữ liệu sai.
      orderBy: [{ sortReceivedDate: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      select: {
        id: true,
        stt: true,
        receivedDate: true,
        senderName: true,
        summary: true,
        petitionType: true,
        status: true,
        assignedTeam: { select: { ward: { select: { name: true } } } },
      },
    });

    const COL_COUNT = 8;
    const HEADERS = [
      'STT', 'Số đơn', 'Người gửi', 'Loại đơn', 'Tóm tắt',
      'Phường/Xã', 'Ngày tiếp nhận', 'Trạng thái',
    ];
    const WIDTHS = [6, 18, 22, 16, 40, 18, 16, 22];

    const fromStr = query.fromDate ? new Date(query.fromDate).toLocaleDateString('vi-VN') : '';
    const toStr = query.toDate ? new Date(query.toDate).toLocaleDateString('vi-VN') : '';
    const period = fromStr && toStr ? `Từ ngày ${fromStr} đến ngày ${toStr}` : 'Tất cả thời gian';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Đơn thư theo phường xã');

    BcaExcelHelper.addHeader(sheet, COL_COUNT, 'DANH SÁCH ĐƠN THƯ THEO PHƯỜNG/XÃ', period);
    const headerRow = sheet.getRow(7);
    BcaExcelHelper.addColumnHeaders(headerRow, HEADERS, WIDTHS);

    records.forEach((rec, idx) => {
      const wardName = rec.assignedTeam?.ward?.name ?? '';
      const dataRow = sheet.addRow([
        idx + 1,
        rec.stt ?? '',
        rec.senderName ?? '',
        rec.petitionType ? (LOAI_DON_LABEL_BE[rec.petitionType] ?? rec.petitionType) : '',
        rec.summary ?? '',
        wardName,
        rec.receivedDate ? rec.receivedDate.toLocaleDateString('vi-VN') : '',
        PETITION_STATUS_LABEL[rec.status as PetitionStatus] ?? rec.status ?? '',
      ]);
      BcaExcelHelper.styleDataRow(dataRow, idx % 2 === 1, COL_COUNT);
    });

    const lastDataRow = sheet.lastRow?.number ?? 7;
    BcaExcelHelper.addFooter(sheet, lastDataRow + 2, COL_COUNT);
    BcaExcelHelper.setPrintSetup(sheet);

    const filename = `DonThuPhuongXa_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    try {
      await workbook.xlsx.write(res);
    } catch (err) {
      this.logger.error('ExcelJS write failed for ward petition export', err);
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
        // Prisma v7: `not: null` bị reject trong groupBy. `notIn: ['']` (SQL NOT IN) loại cả NULL lẫn ''.
        ...where,
        [dupKey]: { notIn: [''] },
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

  /**
   * Loader trung lập (public) cho xuất chứng từ ĐỘNG (codex P1#3 — tránh DynamicExportService phụ
   * thuộc method private gây module cycle). Controller load petition + include (enteredBy, assignedTeam
   * members leader) khớp catalog DON_THU, rồi truyền record sang DynamicExportService (generic).
   */
  async loadPetitionForExport(
    id: string,
    dataScope: DataScope | null | undefined,
  ) {
    await this.getById(id, dataScope);
    const petition = await this.prisma.petition.findFirst({
      where: { id, deletedAt: null },
      include: {
        enteredBy: { select: { firstName: true, lastName: true, rank: true } },
        // Cán bộ đề xuất được CHỌN trên form — ưu tiên hơn người in khi render.
        canBoDeXuat: { select: { firstName: true, lastName: true, rank: true } },
        assignedTeam: {
          select: {
            id: true,
            code: true,
            name: true,
            members: {
              where: { isLeader: true },
              select: {
                // PHẢI select isLeader: resolver `tenPhoDoiTruong` dùng
                // members.find(m => m.isLeader); thiếu cờ này thì find() luôn
                // undefined → tên Phó đội trưởng in ra RỖNG.
                isLeader: true,
                user: {
                  select: { firstName: true, lastName: true, rank: true },
                },
              },
            },
          },
        },
      },
    });
    if (!petition) {
      throw new NotFoundException(`Đơn thư không tồn tại (id: ${id})`);
    }
    return petition;
  }

  // ─────────────────────────────────────────────
  // RESTORE (v0.32.0.0) — khôi phục soft-deleted Petition (ADMIN only)
  // ─────────────────────────────────────────────
  async restore(
    id: string,
    reason: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.petition.findFirst({
      where: { id, deletedAt: { not: null } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Đơn thư không tồn tại hoặc chưa bị xóa (id: ${id})`,
      );
    }

    const hoursAfterDeletion =
      (Date.now() - existing.deletedAt!.getTime()) / 3_600_000;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.petition.update({
          where: { id, deletedAt: { not: null } },
          data: { deletedAt: null },
        });
        await this.audit.log(
          {
            userId: actorId,
            action: 'PETITION_RESTORED',
            subject: 'Petition',
            subjectId: id,
            metadata: {
              stt: existing.stt,
              senderName: existing.senderName,
              reason,
              hoursAfterDeletion: Math.round(hoursAfterDeletion),
            },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new BadRequestException(
          'Đơn thư đã được khôi phục bởi quản trị viên khác. Tải lại danh sách.',
        );
      }
      throw err;
    }

    return { success: true, message: 'Khôi phục đơn thư thành công' };
  }

  // ─────────────────────────────────────────────
  // LIST DELETED — paginated với enriched delete audit
  // ─────────────────────────────────────────────
  async listDeleted(query: { limit?: number; offset?: number; search?: string }) {
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;
    const search = query.search?.trim();

    const where: Prisma.PetitionWhereInput = {
      deletedAt: { not: null },
      ...(search && {
        OR: [
          { senderName: { contains: search, mode: 'insensitive' } },
          { stt: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.petition.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          enteredBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        },
      }),
      this.prisma.petition.count({ where }),
    ]);

    const ids = data.map((c) => c.id);
    const deleteAudits = ids.length > 0
      ? await this.prisma.$queryRaw<Array<{ subjectId: string; userId: string | null; metadata: unknown; createdAt: Date }>>`
          SELECT DISTINCT ON ("subjectId") "subjectId", "userId", metadata, "createdAt"
          FROM "audit_logs"
          WHERE action = 'PETITION_DELETED' AND "subjectId" = ANY(${ids})
          ORDER BY "subjectId", "createdAt" DESC
        `
      : [];
    const audMap = new Map(deleteAudits.map((a) => [a.subjectId, a]));

    return {
      success: true,
      data: data.map((c) => ({ ...c, deleteAudit: audMap.get(c.id) ?? null })),
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    };
  }

  // ─────────────────────────────────────────────
  // GET STATS — PR2/T2
  // Mirror PR1 Cases + PR2/T1 Incidents pattern:
  // - Takes QueryPetitionsStatsDto (status/limit/offset/sortBy/sortOrder omitted)
  // - Returns { total, byStatus } exhaustive (every PetitionStatus key present)
  // - Total derived from groupResults loop (snapshot consistent)
  // - Strips status filter (counts BY status, not filtered by it)
  // ─────────────────────────────────────────────
  async getStats(query: QueryPetitionsStatsDto, dataScope?: DataScope | null) {
    const { search, unit, senderName, fromDate, toDate, overdue, wardTeamId } = query;

    const where: Prisma.PetitionWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { stt: { contains: search, mode: 'insensitive' } },
        { senderName: { contains: search, mode: 'insensitive' } },
        { suspectedPerson: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { soHoSoCu: { contains: search, mode: 'insensitive' } }, // truy nguyên: tìm theo STT hệ cũ
        { sttCu: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Thẻ thống kê phải đếm CÙNG tập hồ sơ mà danh sách hiện — lọc lệch cột thì số trên thẻ
    // và số dòng dưới bảng không khớp nhau.
    if (unit) where.donViGiaiQuyet = { contains: unit, mode: 'insensitive' };
    if (senderName) where.senderName = { contains: senderName, mode: 'insensitive' };

    // Kỳ thống kê: nếu người dùng không tự đặt ngày thì áp mặc định admin cấu hình. Cùng
    // một hàm với thẻ số và badge menu, nên ba chỗ không thể lệch nhau.
    const kyThongKe = await this.settings.getKyThongKe({ truong: query.thongKeTruongNgay });
    apDungKyVaoWhere(where as Record<string, unknown>, kyThongKe, fromDate, toDate, 'receivedDate');

    if (overdue) {
      where.deadline = { lt: new Date() };
      where.status = {
        notIn: [
          PetitionStatus.DA_GIAI_QUYET,
          PetitionStatus.DA_CHUYEN_VU_VIEC,
          PetitionStatus.DA_CHUYEN_VU_AN,
        ],
      };
    }

    if (wardTeamId) where.assignedTeam = { is: { wardId: wardTeamId } };

    const scopeFilter = buildPetitionScopeFilter(dataScope);
    if (scopeFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        scopeFilter as Prisma.PetitionWhereInput,
      ];
    }

    const byStatus: Record<PetitionStatus, number> = Object.values(PetitionStatus).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<PetitionStatus, number>,
    );

    const groupResults = await this.prisma.petition.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    let total = 0;
    for (const row of groupResults) {
      byStatus[row.status] = row._count._all;
      total += row._count._all;
    }

    // byGroup sinh từ CÙNG `where` với danh sách → số trên thẻ khớp số dòng theo thiết kế.
    // Nhờ vậy frontend không cần biết nhóm gồm những trạng thái nào (chống trùng lặp).
    return { total, byStatus, byGroup: countByGroup(PETITION_STATUS_GROUPS, byStatus), ky: kyThongKe };
  }

  // ── Nhóm V — Search nghi phạm theo tên/CCCD ────────────────────────────────
  async suspectSearch(
    q: string,
    _dataScope?: DataScope | null,
  ): Promise<Array<{ name: string; idNumber: string; crimes: string[]; sources: Array<{ type: string; stt: string }> }>> {
    if (!q?.trim()) return [];

    const petitions = await this.prisma.petition.findMany({
      where: {
        deletedAt: null,
        OR: [
          { senderName: { contains: q, mode: 'insensitive' } },
          { senderIdNumber: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        stt: true,
        senderName: true,
        senderIdNumber: true,
        toiDanhBanDau: true,
      },
      take: 20,
      orderBy: { receivedDate: 'desc' },
    });

    const byKey = new Map<string, { name: string; idNumber: string; crimes: string[]; sources: Array<{ type: string; stt: string }> }>();
    for (const p of petitions) {
      const key = p.senderIdNumber?.trim() || p.senderName;
      if (!byKey.has(key)) {
        byKey.set(key, { name: p.senderName, idNumber: p.senderIdNumber ?? '', crimes: [], sources: [] });
      }
      const entry = byKey.get(key)!;
      if (p.toiDanhBanDau?.trim() && !entry.crimes.includes(p.toiDanhBanDau)) {
        entry.crimes.push(p.toiDanhBanDau);
      }
      entry.sources.push({ type: 'petition', stt: p.stt });
    }

    return Array.from(byKey.values());
  }

  // ── Nhóm V — Search trùng đơn theo tên/STT/nội dung ───────────────────────
  async duplicateSearch(
    q: string,
    excludeId?: string,
    _dataScope?: DataScope | null,
  ): Promise<Array<{ id: string; stt: string; senderName: string; receivedDate: Date; summary: string | null }>> {
    if (!q?.trim()) return [];

    const where: Prisma.PetitionWhereInput = {
      deletedAt: null,
      OR: [
        { senderName: { contains: q, mode: 'insensitive' } },
        { stt: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
      ],
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    return this.prisma.petition.findMany({
      where,
      select: {
        id: true,
        stt: true,
        senderName: true,
        receivedDate: true,
        summary: true,
      },
      take: 20,
      orderBy: { receivedDate: 'desc' },
    });
  }

  // ── Nhóm I: PetitionAssignment CRUD ─────────────────────────────────────────

  async addAssignment(
    petitionId: string,
    userId: string,
    role: 'LEAD' | 'SUPPORT',
    actorId: string,
    _dataScope?: DataScope | null,
  ) {
    const petition = await this.prisma.petition.findFirst({ where: { id: petitionId, deletedAt: null } });
    if (!petition) throw new NotFoundException(`Đơn thư không tồn tại (id: ${petitionId})`);

    const existing = await this.prisma.petitionAssignment.findUnique({
      where: { petitionId_userId: { petitionId, userId } },
    });
    if (existing) throw new ConflictException(`Cán bộ đã được phân công cho đơn thư này`);

    return this.prisma.petitionAssignment.create({
      data: { petitionId, userId, role, assignedById: actorId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, username: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
    }).catch((err: any) => {
      if (err?.code === 'P2002') throw new ConflictException(`Cán bộ đã được phân công cho đơn thư này`);
      if (err?.code === 'P2003') throw new NotFoundException(`Cán bộ không tồn tại (userId: ${userId})`);
      throw err;
    });
  }

  async removeAssignment(
    petitionId: string,
    userId: string,
    _actorId: string,
  ) {
    const petition = await this.prisma.petition.findFirst({ where: { id: petitionId, deletedAt: null } });
    if (!petition) throw new NotFoundException(`Đơn thư không tồn tại (id: ${petitionId})`);

    const existing = await this.prisma.petitionAssignment.findUnique({
      where: { petitionId_userId: { petitionId, userId } },
    });
    if (!existing) throw new NotFoundException(`Cán bộ chưa được phân công cho đơn thư này`);

    await this.prisma.petitionAssignment.delete({
      where: { petitionId_userId: { petitionId, userId } },
    });
    return { success: true };
  }

  async listAssignments(
    petitionId: string,
    _dataScope?: DataScope | null,
  ) {
    const petition = await this.prisma.petition.findFirst({ where: { id: petitionId, deletedAt: null } });
    if (!petition) throw new NotFoundException(`Đơn thư không tồn tại (id: ${petitionId})`);

    return this.prisma.petitionAssignment.findMany({
      where: { petitionId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, username: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
      orderBy: { assignedAt: 'asc' },
    });
  }
}
