import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import { AssignCaseDto } from './dto/assign-case.dto';
import type { DeleteCasePreflightResponse } from './dto/delete-case-preflight.response';
import { Prisma, CaseStatus, PetitionStatus, LoaiDon, CapDoToiPham, LyDoTamDinhChiVuAn, KetQuaPhucHoiVuAn } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { buildScopeFilter } from '../common/utils/scope-filter.util';
import { BcaExcelHelper } from '../common/bca-excel.helper';
import { CASE_STATUS_LABEL } from '../common/constants/status-labels.constants';
import { ROLE_NAMES } from '../common/constants/role.constants';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';

type JsonInput = Prisma.InputJsonValue;
type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService, // v0.31.0.2: THOI_HAN_XOA_VU_AN
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
      capDoToiPham,
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
    if (overdue) {
      where.deadline = { lt: new Date() };
      where.status = {
        notIn: [CaseStatus.DA_KET_LUAN, CaseStatus.DA_LUU_TRU, CaseStatus.DINH_CHI],
      };
    }

    if (capDoToiPham) {
      where.capDoToiPham = capDoToiPham;
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
    if (dataScope.canDispatch) return; // dispatcher: full read access
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

  private checkWriteScope(
    record: { investigatorId?: string | null; assignedTeamId?: string | null },
    dataScope?: DataScope | null,
  ) {
    if (!dataScope) return;
    const { userIds, writableTeamIds } = dataScope;
    const ownerMatch = record.investigatorId && userIds.includes(record.investigatorId);
    const teamMatch = record.assignedTeamId && writableTeamIds.includes(record.assignedTeamId);
    const unassignedMatch = !record.assignedTeamId && writableTeamIds.length > 0;
    if (!ownerMatch && !teamMatch && !unassignedMatch) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bản ghi này');
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
    const petitionType = metadata?.petitionType as LoaiDon | undefined;

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
              createdById: actorId, // v0.31.0.2: creator track
              deadline: dto.deadline ? new Date(dto.deadline) : undefined,
              unit: dto.unit,
              ...(dto.assignedTeamId !== undefined && { assignedTeamId: dto.assignedTeamId }),
              subjectsCount: dto.subjectsCount ?? 0,
              ...(dto.capDoToiPham !== undefined && { capDoToiPham: dto.capDoToiPham }),
              ...(dto.ngayKhoiTo !== undefined && { ngayKhoiTo: new Date(dto.ngayKhoiTo) }),
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
        createdById: actorId, // v0.31.0.2: creator track
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        unit: dto.unit,
        ...(dto.assignedTeamId !== undefined && { assignedTeamId: dto.assignedTeamId }),
        subjectsCount: dto.subjectsCount ?? 0,
        ...(dto.capDoToiPham !== undefined && { capDoToiPham: dto.capDoToiPham }),
        ...(dto.ngayKhoiTo !== undefined && { ngayKhoiTo: new Date(dto.ngayKhoiTo) }),
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

    this.checkWriteScope(existing, dataScope);

    if (dto.investigatorId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.investigatorId },
      });
      if (!user) {
        throw new BadRequestException('Điều tra viên không tồn tại');
      }
    }

    // ── TAM_DINH_CHI validation & auto-fields ─────────────────────────────────
    const MIGRATION_DATE = new Date('2026-04-30');
    let tamDinhChiWarning: string | undefined;

    if (dto.status === CaseStatus.TAM_DINH_CHI && dto.status !== existing.status) {
      const lyDo = (dto as UpdateCaseDto & { lyDoTamDinhChiVuAn?: LyDoTamDinhChiVuAn }).lyDoTamDinhChiVuAn;
      if (!lyDo) {
        if (existing.createdAt < MIGRATION_DATE) {
          // Soft-warn: case pre-dates migration — allow but warn (90-day grace period)
          tamDinhChiWarning =
            'Khuyến nghị: Vui lòng cập nhật lý do tạm đình chỉ theo quy định Điều 229 BLTTHS 2015 (áp dụng bắt buộc từ 30/04/2026)';
        } else {
          throw new BadRequestException(
            'Vui lòng chọn lý do tạm đình chỉ theo quy định Điều 229 BLTTHS 2015',
          );
        }
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
      ...(dto.capDoToiPham !== undefined && { capDoToiPham: dto.capDoToiPham }),
      ...(dto.ngayKhoiTo !== undefined && {
        ngayKhoiTo: dto.ngayKhoiTo ? new Date(dto.ngayKhoiTo) : null,
      }),
      // ── TĐC fields ──────────────────────────────────────────────────────────
      ...((dto as Record<string, unknown>).lyDoTamDinhChiVuAn !== undefined && {
        lyDoTamDinhChiVuAn: (dto as Record<string, unknown>).lyDoTamDinhChiVuAn as LyDoTamDinhChiVuAn | null,
      }),
      ...((dto as Record<string, unknown>).soQuyetDinhTamDinhChi !== undefined && {
        soQuyetDinhTamDinhChi: (dto as Record<string, unknown>).soQuyetDinhTamDinhChi as string | null,
      }),
      ...((dto as Record<string, unknown>).ngayTamDinhChi !== undefined && {
        ngayTamDinhChi: (dto as Record<string, unknown>).ngayTamDinhChi
          ? new Date((dto as Record<string, unknown>).ngayTamDinhChi as string)
          : null,
      }),
      ...((dto as Record<string, unknown>).laCongNgheCao !== undefined && {
        laCongNgheCao: (dto as Record<string, unknown>).laCongNgheCao as boolean,
      }),
      ...((dto as Record<string, unknown>).soLanGiaHan !== undefined && {
        soLanGiaHan: (dto as Record<string, unknown>).soLanGiaHan as number,
      }),
      ...((dto as Record<string, unknown>).daRaSoat !== undefined && {
        daRaSoat: (dto as Record<string, unknown>).daRaSoat as boolean,
      }),
      ...((dto as Record<string, unknown>).ngayRaSoat !== undefined && {
        ngayRaSoat: (dto as Record<string, unknown>).ngayRaSoat
          ? new Date((dto as Record<string, unknown>).ngayRaSoat as string)
          : null,
      }),
      ...((dto as Record<string, unknown>).soQuyetDinhPhucHoi !== undefined && {
        soQuyetDinhPhucHoi: (dto as Record<string, unknown>).soQuyetDinhPhucHoi as string | null,
      }),
      ...((dto as Record<string, unknown>).ngayPhucHoi !== undefined && {
        ngayPhucHoi: (dto as Record<string, unknown>).ngayPhucHoi
          ? new Date((dto as Record<string, unknown>).ngayPhucHoi as string)
          : null,
      }),
      ...((dto as Record<string, unknown>).ketQuaPhucHoiVuAn !== undefined && {
        ketQuaPhucHoiVuAn: (dto as Record<string, unknown>).ketQuaPhucHoiVuAn as KetQuaPhucHoiVuAn | null,
      }),
      ...((dto as Record<string, unknown>).lyDoTamDinhChiText !== undefined && {
        lyDoTamDinhChiText: (dto as Record<string, unknown>).lyDoTamDinhChiText as string | null,
      }),
    };

    // Auto-set ngayTamDinhChi and increment soLanTamDinhChi when transitioning TO TAM_DINH_CHI
    if (dto.status === CaseStatus.TAM_DINH_CHI && dto.status !== existing.status) {
      if (!updateData.ngayTamDinhChi) {
        updateData.ngayTamDinhChi = new Date();
      }
      updateData.soLanTamDinhChi = { increment: 1 };
    }

    // v0.30: CASE_UPDATED via wrapUpdate so audit captures full before/after for inline diff.
    // The fetchFn re-reads full Case (relations included); +1 SELECT/update — negligible.
    // P2025 try/catch wraps the whole wrapUpdate call to preserve optimistic-lock translation.
    let record;
    try {
      record = await this.audit.wrapUpdate({
        fetchFn: () =>
          this.prisma.case.findUnique({
            where: { id },
            include: {
              investigator: {
                select: { id: true, firstName: true, lastName: true, username: true },
              },
            },
          }),
        updateFn: () =>
          this.prisma.case.update({
            where: {
              id,
              ...(dto.expectedUpdatedAt ? { updatedAt: new Date(dto.expectedUpdatedAt) } : {}),
            },
            data: updateData,
            include: {
              investigator: {
                select: { id: true, firstName: true, lastName: true, username: true },
              },
            },
          }),
        action: 'CASE_UPDATED',
        subject: 'Case',
        subjectId: id,
        userId: actorId,
        meta: { ipAddress: meta?.ipAddress, userAgent: meta?.userAgent },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Hồ sơ đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    // Sync petitionType with linked Petition
    const updatedMetadata = dto.metadata as Record<string, unknown> | undefined;
    const newPetitionType = updatedMetadata?.petitionType as LoaiDon | undefined;
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

    // v0.30: CASE_UPDATED audit moved into wrapUpdate above. KEEP CASE_STATUS_CHANGED + PETITION_AUTO_CREATED.

    return {
      success: true,
      data: record,
      message: 'Cập nhật vụ án thành công',
      ...(tamDinhChiWarning && { warning: tamDinhChiWarning }),
    };
  }

  // ─────────────────────────────────────────────
  // DELETE (soft delete với reason + 8-step validation chain — v0.31.0.2)
  // Mirror Incident.delete pattern (incidents.service.ts:469-563) + autoplan hardening:
  //   - Wrapped in $transaction (no orphan deletion if audit insert fails)
  //   - Atomic status TOCTOU guard via where:{status:TIEP_NHAN}
  //   - ALL linked entity counts filter deletedAt:null
  //   - Specific NULL createdById error message for legacy data
  // ─────────────────────────────────────────────
  async delete(
    id: string,
    reason: string,
    actorId: string,
    actorRole: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    // 1. Fetch with linked entity counts (ALL filtered deletedAt:null)
    const existing = await this.prisma.case.findFirst({
      where: { id, deletedAt: null },
      include: {
        subjects: { where: { deletedAt: null }, select: { id: true } },
        lawyers: { where: { deletedAt: null }, select: { id: true } },
        conclusions: { where: { deletedAt: null }, select: { id: true } },
        documents: { where: { deletedAt: null }, select: { id: true } },
        linkedIncidents: { where: { deletedAt: null }, select: { id: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Vụ án không tồn tại (id: ${id})`);
    }

    // 2. Status check — chỉ TIEP_NHAN xóa được
    if (existing.status !== CaseStatus.TIEP_NHAN) {
      throw new BadRequestException(
        'Chỉ xóa được vụ án ở trạng thái Tiếp nhận. ' +
          'Vụ án đã chuyển trạng thái không thể xóa.',
      );
    }

    // 3. Linked records check (5 entity types)
    if (existing.subjects.length > 0) {
      throw new BadRequestException(
        `Không thể xóa: vụ án có ${existing.subjects.length} đối tượng. Xóa các đối tượng trước.`,
      );
    }
    if (existing.lawyers.length > 0) {
      throw new BadRequestException(
        `Không thể xóa: vụ án có ${existing.lawyers.length} luật sư đăng ký. Xóa các luật sư trước.`,
      );
    }
    if (existing.conclusions.length > 0) {
      throw new BadRequestException(
        `Không thể xóa: vụ án có ${existing.conclusions.length} kết luận điều tra.`,
      );
    }
    if (existing.documents.length > 0) {
      throw new BadRequestException(
        `Không thể xóa: vụ án có ${existing.documents.length} tài liệu đính kèm.`,
      );
    }
    if (existing.linkedIncidents.length > 0) {
      throw new BadRequestException(
        `Không thể xóa: vụ án đang liên kết ${existing.linkedIncidents.length} vụ việc.`,
      );
    }

    // 4. Creator-or-admin check (with specific NULL message for legacy rows)
    const isAdmin = actorRole === ROLE_NAMES.ADMIN;
    if (!isAdmin) {
      if (existing.createdById === null) {
        throw new ForbiddenException(
          'Vụ án không có thông tin người tạo (dữ liệu cũ). Chỉ quản trị viên mới được xóa.',
        );
      }
      if (existing.createdById !== actorId) {
        throw new ForbiddenException(
          'Chỉ người tạo vụ án hoặc quản trị viên mới được xóa.',
        );
      }
    }

    // 5. Time window check (default 72h, configurable via SystemSetting)
    const maxHours = await this.settings.getNumericValue(
      SETTINGS_KEY.THOI_HAN_XOA_VU_AN,
      72,
    );
    const hoursElapsed =
      (Date.now() - existing.createdAt.getTime()) / 3_600_000;
    if (hoursElapsed > maxHours && !isAdmin) {
      throw new BadRequestException(
        `Đã quá ${maxHours} giờ kể từ khi tạo vụ án. Chỉ quản trị viên mới xóa được.`,
      );
    }

    // 6. Write-scope check
    this.checkWriteScope(existing, dataScope);

    // 7+8. ATOMIC transaction: re-check linked records (TOCTOU fix per codex P1)
    // + soft delete (status TOCTOU guard) + audit log
    try {
      await this.prisma.$transaction(async (tx) => {
        // Re-fetch counts inside transaction — guards against concurrent inserts of
        // subjects/lawyers/conclusions/documents/linkedIncidents between initial check
        // and transaction commit.
        const inTxCounts = await tx.case.findFirst({
          where: { id, deletedAt: null },
          select: {
            _count: {
              select: {
                subjects: { where: { deletedAt: null } },
                lawyers: { where: { deletedAt: null } },
                conclusions: { where: { deletedAt: null } },
                documents: { where: { deletedAt: null } },
                linkedIncidents: { where: { deletedAt: null } },
              },
            },
          },
        });
        if (!inTxCounts) {
          // Already soft-deleted by concurrent request — let outer P2025 path handle
          throw new Prisma.PrismaClientKnownRequestError(
            'Record to update not found',
            { code: 'P2025', clientVersion: '7.8.0' },
          );
        }
        const c = inTxCounts._count;
        if (c.subjects > 0) {
          throw new BadRequestException(
            `Không thể xóa: vụ án có ${c.subjects} đối tượng (vừa được thêm). Tải lại danh sách.`,
          );
        }
        if (c.lawyers > 0) {
          throw new BadRequestException(
            `Không thể xóa: vụ án có ${c.lawyers} luật sư (vừa được thêm). Tải lại danh sách.`,
          );
        }
        if (c.conclusions > 0) {
          throw new BadRequestException(
            `Không thể xóa: vụ án có ${c.conclusions} kết luận điều tra (vừa được thêm).`,
          );
        }
        if (c.documents > 0) {
          throw new BadRequestException(
            `Không thể xóa: vụ án có ${c.documents} tài liệu đính kèm (vừa được thêm).`,
          );
        }
        if (c.linkedIncidents > 0) {
          throw new BadRequestException(
            `Không thể xóa: vụ án vừa được liên kết với ${c.linkedIncidents} vụ việc.`,
          );
        }

        // Atomic status guard — concurrent transition out of TIEP_NHAN aborts
        await tx.case.update({
          where: {
            id,
            status: CaseStatus.TIEP_NHAN,
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });

        // Audit in same transaction — no orphan deletion possible
        await this.audit.log(
          {
            userId: actorId,
            action: 'CASE_DELETED',
            subject: 'Case',
            subjectId: id,
            metadata: {
              name: existing.name,
              reason,
              softDelete: true,
              hoursAfterCreation: Math.round(hoursElapsed),
            },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );
      });
    } catch (err) {
      // P2025: record not found by uniquely-identified `where` → status changed concurrently
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new BadRequestException(
          'Vụ án đã đổi trạng thái trong lúc thực hiện. Vui lòng tải lại danh sách.',
        );
      }
      throw err;
    }

    return { success: true, message: 'Xóa vụ án thành công' };
  }

  // ─────────────────────────────────────────────
  // DELETE PREFLIGHT — kiểm tra điều kiện xóa trước khi user nhập reason
  // ─────────────────────────────────────────────
  async previewDelete(
    id: string,
    dataScope?: DataScope | null,
  ): Promise<DeleteCasePreflightResponse> {
    const existing = await this.prisma.case.findFirst({
      where: { id, deletedAt: null },
      include: {
        subjects: { where: { deletedAt: null }, select: { id: true } },
        lawyers: { where: { deletedAt: null }, select: { id: true } },
        conclusions: { where: { deletedAt: null }, select: { id: true } },
        documents: { where: { deletedAt: null }, select: { id: true } },
        linkedIncidents: { where: { deletedAt: null }, select: { id: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Vụ án không tồn tại (id: ${id})`);
    }
    this.checkRecordInScope(existing, dataScope);

    const blockers = {
      subjects: existing.subjects.length,
      lawyers: existing.lawyers.length,
      conclusions: existing.conclusions.length,
      documents: existing.documents.length,
      linkedIncidents: existing.linkedIncidents.length,
    };

    const reasonsIfBlocked: string[] = [];
    if (existing.status !== CaseStatus.TIEP_NHAN) {
      reasonsIfBlocked.push(
        `Trạng thái hiện tại không cho phép xóa (chỉ Tiếp nhận). Hiện: ${CASE_STATUS_LABEL[existing.status] ?? existing.status}.`,
      );
    }
    if (blockers.subjects > 0) reasonsIfBlocked.push(`${blockers.subjects} đối tượng đang liên kết.`);
    if (blockers.lawyers > 0) reasonsIfBlocked.push(`${blockers.lawyers} luật sư đang liên kết.`);
    if (blockers.conclusions > 0) reasonsIfBlocked.push(`${blockers.conclusions} kết luận điều tra.`);
    if (blockers.documents > 0) reasonsIfBlocked.push(`${blockers.documents} tài liệu đính kèm.`);
    if (blockers.linkedIncidents > 0) reasonsIfBlocked.push(`${blockers.linkedIncidents} vụ việc liên kết.`);

    return {
      canDelete: reasonsIfBlocked.length === 0,
      status: existing.status,
      blockers,
      reasonsIfBlocked,
    };
  }

  // ─────────────────────────────────────────────
  // RESTORE (v0.32.0.0) — khôi phục soft-deleted Case (ADMIN only via @RequirePermissions)
  // Mirror DELETE pattern: transactional, P2025 concurrent guard, audit log với reason.
  // ─────────────────────────────────────────────
  async restore(
    id: string,
    reason: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    // 1. Fetch — chỉ records đang ở trạng thái đã xóa mềm
    const existing = await this.prisma.case.findFirst({
      where: { id, deletedAt: { not: null } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Vụ án không tồn tại hoặc chưa bị xóa (id: ${id})`,
      );
    }

    const hoursAfterDeletion =
      (Date.now() - existing.deletedAt!.getTime()) / 3_600_000;

    // 2+3. Atomic transaction: restore + audit (no orphan if audit throws)
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.case.update({
          where: { id, deletedAt: { not: null } },
          data: { deletedAt: null },
        });
        await this.audit.log(
          {
            userId: actorId,
            action: 'CASE_RESTORED',
            subject: 'Case',
            subjectId: id,
            metadata: {
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
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new BadRequestException(
          'Vụ án đã được khôi phục bởi quản trị viên khác. Tải lại danh sách.',
        );
      }
      throw err;
    }

    return { success: true, message: 'Khôi phục vụ án thành công' };
  }

  // ─────────────────────────────────────────────
  // LIST DELETED — paginated list deleted Cases + enriched delete audit
  // ─────────────────────────────────────────────
  async listDeleted(query: { limit?: number; offset?: number; search?: string }) {
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;
    const search = query.search?.trim();

    const where: Prisma.CaseWhereInput = {
      deletedAt: { not: null },
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { id: { contains: search } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.case.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        },
      }),
      this.prisma.case.count({ where }),
    ]);

    // Enrich với audit của delete gần nhất (batched, single query — no N+1)
    const ids = data.map((c) => c.id);
    const deleteAudits = ids.length > 0
      ? await this.prisma.$queryRaw<Array<{ subjectId: string; userId: string | null; metadata: unknown; createdAt: Date }>>`
          SELECT DISTINCT ON ("subjectId") "subjectId", "userId", metadata, "createdAt"
          FROM "audit_logs"
          WHERE action = 'CASE_DELETED' AND "subjectId" = ANY(${ids})
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
  // ASSIGN (dispatcher only)
  // ─────────────────────────────────────────────
  async assignCase(
    id: string,
    dto: AssignCaseDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.case.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Vụ án không tồn tại (id: ${id})`);

    const team = await this.prisma.team.findFirst({
      where: { id: dto.assignedTeamId, isActive: true },
    });
    if (!team) throw new BadRequestException(`Tổ điều tra không tồn tại hoặc đã ngừng hoạt động (id: ${dto.assignedTeamId})`);

    if (dto.investigatorId) {
      const member = await this.prisma.userTeam.findFirst({
        where: { userId: dto.investigatorId, teamId: dto.assignedTeamId },
      });
      if (!member) throw new BadRequestException('Điều tra viên không thuộc tổ được chỉ định');
    }

    try {
      await this.prisma.case.update({
        where: {
          id,
          ...(dto.expectedUpdatedAt ? { updatedAt: dto.expectedUpdatedAt } : {}),
        },
        data: {
          assignedTeamId: dto.assignedTeamId,
          investigatorId: dto.investigatorId ?? null,
        },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Vụ án đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    await this.audit.log({
      userId: actorId,
      action: 'CASE_ASSIGNED',
      subject: 'Case',
      subjectId: id,
      metadata: {
        fromTeamId: existing.assignedTeamId,
        toTeamId: dto.assignedTeamId,
        fromInvestigatorId: existing.investigatorId,
        toInvestigatorId: dto.investigatorId ?? null,
        dispatchedBy: actorId,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Phân công vụ án thành công' };
  }

  // ─────────────────────────────────────────────
  // TDC BACKFILL
  // ─────────────────────────────────────────────
  async tdcBackfill(id: string, lyDoTamDinhChiVuAn: string, userId: string) {
    const caseRecord = await this.prisma.case.findUnique({ where: { id } });
    if (!caseRecord) throw new NotFoundException('Case not found');
    return this.prisma.case.update({
      where: { id },
      data: { lyDoTamDinhChiVuAn: lyDoTamDinhChiVuAn as any },
    });
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

  // ─────────────────────────────────────────────
  // EXPORT WARD CASES (Vụ án theo phường/xã)
  // ─────────────────────────────────────────────
  async exportWardCases(
    query: { unitId?: string; fromDate?: string; toDate?: string },
    dataScope: DataScope | null | undefined,
    res: Response,
    actor?: { userId: string; ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    // Sprint 2 / S2.1 — audit log data export (PII bulk leak path)
    if (actor) {
      await this.audit.log({
        userId: actor.userId,
        action: 'CASE_EXPORTED',
        subject: 'Case',
        metadata: { format: 'xlsx', kind: 'ward', filters: query },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
    }
    await this._exportCases(
      query,
      dataScope,
      res,
      'DANH SÁCH VỤ ÁN THEO PHƯỜNG/XÃ',
      `VuAnPhuongXa_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  // ─────────────────────────────────────────────
  // EXPORT OTHER CLASSIFICATION (Phân loại khác)
  // ─────────────────────────────────────────────
  async exportOtherClassification(
    query: { fromDate?: string; toDate?: string; category?: string },
    dataScope: DataScope | null | undefined,
    res: Response,
  ): Promise<void> {
    await this._exportCases(
      query,
      dataScope,
      res,
      'PHÂN LOẠI KHÁC',
      `PhanLoaiKhac_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  private async _exportCases(
    query: { unitId?: string; fromDate?: string; toDate?: string; category?: string },
    dataScope: DataScope | null | undefined,
    res: Response,
    title: string,
    filename: string,
  ): Promise<void> {
    const where: Prisma.CaseWhereInput = { deletedAt: null };
    if (query.unitId) where.unit = query.unitId;
    if (query.category) where.crime = { contains: query.category, mode: 'insensitive' };
    if (query.fromDate) {
      where.createdAt = { ...(where.createdAt as any), gte: new Date(query.fromDate) };
    }
    if (query.toDate) {
      where.createdAt = { ...(where.createdAt as any), lte: new Date(query.toDate + 'T23:59:59.999Z') };
    }

    const scopeFilter = buildScopeFilter(dataScope);
    if (scopeFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        scopeFilter as Prisma.CaseWhereInput,
      ];
    }

    const records = await this.prisma.case.findMany({
      where,
      take: 500,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        crime: true,
        unit: true,
        createdAt: true,
        status: true,
        investigator: { select: { firstName: true, lastName: true } },
      },
    });

    const COL_COUNT = 8;
    const HEADERS = ['STT', 'Mã vụ án', 'Tên vụ án', 'Loại tội phạm', 'Phường/Xã', 'ĐTV phụ trách', 'Ngày tiếp nhận', 'Trạng thái'];
    const WIDTHS = [6, 18, 30, 20, 20, 20, 16, 20];

    const fromStr = query.fromDate ? new Date(query.fromDate).toLocaleDateString('vi-VN') : '';
    const toStr = query.toDate ? new Date(query.toDate).toLocaleDateString('vi-VN') : '';
    const period = fromStr && toStr ? `Từ ngày ${fromStr} đến ngày ${toStr}` : 'Tất cả thời gian';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh sách vụ án');

    BcaExcelHelper.addHeader(sheet, COL_COUNT, title, period);

    const headerRow = sheet.getRow(7);
    BcaExcelHelper.addColumnHeaders(headerRow, HEADERS, WIDTHS);

    records.forEach((rec, idx) => {
      const investigatorName = rec.investigator
        ? `${rec.investigator.lastName ?? ''} ${rec.investigator.firstName ?? ''}`.trim()
        : '';
      const dataRow = sheet.addRow([
        idx + 1,
        rec.id ?? '',
        rec.name ?? '',
        rec.crime ?? '',
        rec.unit ?? '',
        investigatorName,
        rec.createdAt ? rec.createdAt.toLocaleDateString('vi-VN') : '',
        CASE_STATUS_LABEL[rec.status as CaseStatus] ?? rec.status ?? '',
      ]);
      BcaExcelHelper.styleDataRow(dataRow, idx % 2 === 1, COL_COUNT);
    });

    const lastDataRow = sheet.lastRow?.number ?? 7;
    BcaExcelHelper.addFooter(sheet, lastDataRow + 2, COL_COUNT);
    BcaExcelHelper.setPrintSetup(sheet);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    try {
      await workbook.xlsx.write(res);
    } catch (err) {
      if (!res.headersSent) res.status(500).json({ error: 'Export failed' });
      else res.destroy();
    }
  }
}
