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
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { QueryIncidentsDto } from './dto/query-incidents.dto';
import { QueryIncidentsStatsDto } from './dto/query-incidents-stats.dto';
import { AssignInvestigatorDto } from './dto/assign-investigator.dto';
import { ProsecuteIncidentDto } from './dto/prosecute-incident.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { MergeIncidentDto } from './dto/merge-incident.dto';
import { TransferIncidentDto } from './dto/transfer-incident.dto';
import { Prisma, IncidentStatus, LoaiNguonTin, LyDoKhongKhoiTo } from '@prisma/client';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { buildScopeFilter } from '../common/utils/scope-filter.util';
import { TERMINAL_STATUSES, VALID_TRANSITIONS, PHASE_STATUSES } from './incidents.constants';
import { resolveGroup, countByGroup } from '../common/status-groups.util';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { ROLE_NAMES } from '../common/constants/role.constants';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';
import { BcaExcelHelper } from '../common/bca-excel.helper';
import { INCIDENT_STATUS_LABEL } from '../common/constants/status-labels.constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentAssignedEvent } from '../notifications/events/notification.events';

@Injectable()
export class IncidentsService {
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
  async getList(query: QueryIncidentsDto, dataScope?: DataScope | null) {
    const {
      search,
      status,
      phase,
      investigatorId,
      unitId,
      overdue,
      districtId,
      wardId,
      wardTeamId,
      loaiDonVu,
      benVu,
      tinhTrangHoSo,
      tinhTrangThoiHieu,
      canBoNhapId,
      fromDateRange,
      toDateRange,
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
        { doiTuongCaNhan: { contains: search, mode: 'insensitive' } },
        { doiTuongToChuc: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
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

    // Phase takes precedence over status (phase is a group of statuses)
    // If both provided, phase wins — status is ignored.
    // `resolveGroup` dùng hasOwnProperty: viết `PHASE_STATUSES[phase]` trần thì
    // `?phase=constructor` trả về hàm Object — truthy nhưng không phải mảng — rồi lọt
    // xuống Prisma thành `{ in: [Function] }` và ném lỗi 500.
    const phaseStatuses = resolveGroup(PHASE_STATUSES, phase);
    if (phaseStatuses) {
      where.status = { in: [...phaseStatuses] };
    } else if (status) {
      where.status = status;
    }
    if (investigatorId) where.investigatorId = investigatorId;
    if (unitId) where.unitId = unitId;
    if (loaiDonVu) where.loaiDonVu = loaiDonVu;
    if (benVu) where.benVu = benVu;
    if (tinhTrangHoSo) where.tinhTrangHoSo = tinhTrangHoSo;
    if (tinhTrangThoiHieu) where.tinhTrangThoiHieu = tinhTrangThoiHieu;
    if (canBoNhapId) where.canBoNhapId = canBoNhapId;

    // Date range filter on ngayDeXuat
    if (fromDateRange || toDateRange) {
      where.ngayDeXuat = {};
      if (fromDateRange) where.ngayDeXuat.gte = new Date(fromDateRange);
      if (toDateRange) where.ngayDeXuat.lte = new Date(toDateRange);
    }

    // Filter quá hạn — use TERMINAL_STATUSES constant
    if (overdue) {
      where.deadline = { lt: new Date() };
      where.status = { notIn: TERMINAL_STATUSES };
    }

    if (districtId) where.unitId = districtId;

    // v0.36.0.0: filter theo phường công tác (Team.wardId) — cross-ward view PC02/ADMIN
    if (wardTeamId) {
      where.assignedTeam = { is: { wardId: wardTeamId } };
    }
    // (wardId chưa được dùng — kept cho future Subject-level filter)
    void wardId;

    // Apply data scope filter
    const scopeFilter = buildScopeFilter(dataScope);
    if (scopeFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        scopeFilter as Prisma.IncidentWhereInput,
      ];
    }

    const allowedSortFields = [
      'createdAt', 'updatedAt', 'deadline', 'status', 'code', 'name', 'ngayDeXuat',
    ];
    const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

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
          doiTuongCaNhan: true,
          doiTuongToChuc: true,
          loaiDonVu: true,
          benVu: true,
          donViGiaiQuyet: true,
          ngayDeXuat: true,
          ketQuaXuLy: true,
          tinhTrangHoSo: true,
          tinhTrangThoiHieu: true,
          nguoiQuyetDinh: true,
          soQuyetDinh: true,
          ngayQuyetDinh: true,
          lyDoKhongKhoiTo: true,
          lyDoTamDinhChiText: true,
          lyDoTamDinhChiVuViec: true,
          diaChiXayRa: true,
          sdtNguoiToGiac: true,
          diaChiNguoiToGiac: true,
          cmndNguoiToGiac: true,
          createdAt: true,
          updatedAt: true,
          investigator: {
            select: { id: true, firstName: true, lastName: true, username: true },
          },
          canBoNhap: {
            select: { id: true, firstName: true, lastName: true, username: true },
          },
        },
        orderBy: { [orderByField]: sortOrder },
        take: limit,
        skip: offset,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return { success: true, data, total, page: Math.floor(offset / limit) + 1, pageSize: limit };
  }

  // ─────────────────────────────────────────────
  // GET DETAIL
  // ─────────────────────────────────────────────
  private checkRecordInScope(
    record: { investigatorId?: string | null; assignedTeamId?: string | null },
    dataScope?: DataScope | null,
  ) {
    if (!dataScope) return;
    if (dataScope.canDispatch) return; // dispatcher: full read access
    const { userIds, teamIds } = dataScope;
    const ownerMatch = record.investigatorId && userIds.includes(record.investigatorId);
    const teamMatch = record.assignedTeamId && teamIds.includes(record.assignedTeamId);
    const unassignedMatch = !record.assignedTeamId && teamIds.length > 0;
    if (!ownerMatch && !teamMatch && !unassignedMatch) {
      throw new ForbiddenException('Bạn không có quyền truy cập bản ghi này');
    }
  }

  // v0.37.1.1 PROV-004 — list Incidents eligible for linking from a new Case.
  // Returns only: not soft-deleted + not yet linked to any Case + in user's DataScope.
  // Used by CaseFormPage Incident picker (CaseProvenancePicker → /incidents/linkable).
  // Mirror of petitions.service.listLinkable.
  async listLinkable(
    query: { search?: string; limit?: number },
    dataScope?: DataScope | null,
  ) {
    const limit = Math.min(query.limit ?? 50, 100);
    const search = (query.search ?? '').trim();

    const baseWhere: Prisma.IncidentWhereInput = {
      deletedAt: null,
      linkedCaseId: null,
    };

    if (dataScope && !dataScope.canDispatch) {
      const orConditions: Prisma.IncidentWhereInput[] = [];
      if (dataScope.userIds.length > 0) {
        orConditions.push({ investigatorId: { in: dataScope.userIds } });
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

    // Search across code (prefix) + name (contains)
    if (search.length > 0) {
      baseWhere.AND = [
        baseWhere.OR ? { OR: baseWhere.OR } : {},
        {
          OR: [
            { code: { startsWith: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        },
      ];
      delete baseWhere.OR;
    }

    const rows = await this.prisma.incident.findMany({
      where: baseWhere,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        ngayDeXuat: true,
        updatedAt: true,
      },
    });

    return { data: rows };
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
    const record = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
      include: {
        investigator: {
          select: { id: true, firstName: true, lastName: true, username: true, email: true },
        },
        canBoNhap: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
        linkedCase: {
          select: { id: true, name: true, status: true },
        },
        mergedInto: {
          select: { id: true, code: true, name: true },
        },
        petitions: {
          where: { deletedAt: null },
          select: { id: true, stt: true, senderName: true, status: true, receivedDate: true },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            changedBy: {
              select: { id: true, firstName: true, lastName: true, username: true },
            },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    }

    this.checkRecordInScope(record, dataScope);

    return { success: true, data: record };
  }

  // ─────────────────────────────────────────────
  // CREATE (auto-generate code VV-YYYY-XXX)
  // ─────────────────────────────────────────────
  async create(
    dto: CreateIncidentDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    // v0.33.0.0: ward officer auto-set assignedTeamId
    const effectiveAssignedTeamId =
      (dataScope?.isWardOfficer ? dataScope.wardTeamId : null) ?? dto.assignedTeamId;
    if (dto.fromDate && dto.toDate) {
      if (new Date(dto.fromDate) > new Date(dto.toDate)) {
        throw new BadRequestException('Từ ngày không được lớn hơn Đến ngày');
      }
    }

    if (dto.investigatorId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.investigatorId } });
      if (!user) throw new BadRequestException('Điều tra viên không tồn tại');
    }

    // Auto-calculate deadline: ngayTiepNhan + THOI_HAN_XAC_MINH (via versioning workflow)
    // Snapshot the active rule version's id + max-extensions count so future
    // policy changes don't retroactively alter this incident's deadline math.
    let computedDeadline: Date | undefined;
    let deadlineRuleVersionId: string | null = null;
    let maxExtensionsSnapshot: number | null = null;
    if (dto.deadline) {
      computedDeadline = new Date(dto.deadline);
    } else if (dto.ngayDeXuat) {
      const xacMinhRule = await this.deadlineRules.getActive('THOI_HAN_XAC_MINH');
      if (!xacMinhRule) {
        throw new BadRequestException(
          'Không có quy tắc THOI_HAN_XAC_MINH đang hiệu lực. Liên hệ admin chạy seed/migration.',
        );
      }
      const d = new Date(dto.ngayDeXuat);
      d.setDate(d.getDate() + xacMinhRule.value);
      computedDeadline = d;
      deadlineRuleVersionId = xacMinhRule.id;
    }

    // Always snapshot max-extensions count at creation time (frozen even when admin lowers limit later)
    const maxExtRule = await this.deadlineRules.getActive('SO_LAN_GIA_HAN_TOI_DA');
    if (maxExtRule) maxExtensionsSnapshot = maxExtRule.value;

    const record = await this.prisma.$transaction(async (tx: any) => {
      const { number: code, logId } = await this.docNums.commitWithTx('INCIDENT', { userId: actorId }, tx);
      const rec = await tx.incident.create({
        data: {
          code,
          name: dto.name,
          incidentType: dto.incidentType,
          description: dto.description,
          fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
          toDate: dto.toDate ? new Date(dto.toDate) : undefined,
          deadline: computedDeadline,
          deadlineRuleVersionId: deadlineRuleVersionId ?? undefined,
          maxExtensionsSnapshot: maxExtensionsSnapshot ?? undefined,
          unitId: dto.unitId,
          investigatorId: dto.investigatorId,
          sourcePetitionId: dto.sourcePetitionId,
          doiTuongCaNhan: dto.doiTuongCaNhan,
          doiTuongToChuc: dto.doiTuongToChuc,
          loaiDonVu: dto.loaiDonVu,
          nguonPhatTin: dto.nguonPhatTin,
          phuongThucTiepNhan: dto.phuongThucTiepNhan,
          benVu: dto.benVu,
          donViGiaiQuyet: dto.donViGiaiQuyet,
          ngayDeXuat: dto.ngayDeXuat ? new Date(dto.ngayDeXuat) : undefined,
          canBoNhapId: dto.canBoNhapId,
          assignedTeamId: effectiveAssignedTeamId, // v0.33: ward officer override
          createdById: actorId,
          soQuyetDinh: dto.soQuyetDinh,
          ngayQuyetDinh: dto.ngayQuyetDinh ? new Date(dto.ngayQuyetDinh) : undefined,
          soQDPhanCongNguonTin: dto.soQDPhanCongNguonTin,
          ngayQDPhanCongNguonTin: dto.ngayQDPhanCongNguonTin ? new Date(dto.ngayQDPhanCongNguonTin) : undefined,
          canCuKhongKhoiTo: dto.canCuKhongKhoiTo,
          canCuTamDinhChi: dto.canCuTamDinhChi,
          phanLoaiDanSuText: dto.phanLoaiDanSuText,
          lyDoKhongKhoiTo: dto.lyDoKhongKhoiTo,
          lyDoTamDinhChiVuViec: dto.lyDoTamDinhChiVuViec, // PR-8 multi
          lyDoTamDinhChiText: (dto as any).lyDoTamDinhChiText ?? (dto as any).lyDoTamDinhChi,
          diaChiXayRa: dto.diaChiXayRa,
          sdtNguoiToGiac: dto.sdtNguoiToGiac,
          diaChiNguoiToGiac: dto.diaChiNguoiToGiac,
          cmndNguoiToGiac: dto.cmndNguoiToGiac,
          ketQuaXuLy: dto.ketQuaXuLy,
          // PR 5 hotfix #111: codex post-merge phát hiện 2 fields bị silently dropped.
          // Regression tested: incidents.service.spec.ts "hotfix #111 regression".
          loaiKetQua: dto.loaiKetQua,
          canCuKhoiToCode: dto.canCuKhoiToCode,
          tinhTrangHoSo: dto.tinhTrangHoSo,
          tinhTrangThoiHieu: dto.tinhTrangThoiHieu,
          nguoiQuyetDinh: dto.nguoiQuyetDinh,
          tienDoKhacPhucTDC: dto.tienDoKhacPhucTDC,
          tdcKhacPhucLyDoBienPhap: dto.tdcKhacPhucLyDoBienPhap,
          tdcKhacPhucBienBan: dto.tdcKhacPhucBienBan,
          soQuyetDinhTamDinhChiVV: dto.soQuyetDinhTamDinhChiVV,
          ngayTamDinhChiVV: dto.ngayTamDinhChiVV ? new Date(dto.ngayTamDinhChiVV) : undefined,
          soQuyetDinhPhucHoiVV: dto.soQuyetDinhPhucHoiVV,
          ngayPhucHoiVV: dto.ngayPhucHoiVV ? new Date(dto.ngayPhucHoiVV) : undefined,
          ngayHetThoiHieuVV: dto.ngayHetThoiHieuVV ? new Date(dto.ngayHetThoiHieuVV) : undefined,
          soQDKhongKhoiTo: dto.soQDKhongKhoiTo,
          ngayQDKhongKhoiTo: dto.ngayQDKhongKhoiTo ? new Date(dto.ngayQDKhongKhoiTo) : undefined,
          xacDinhVuViecTamDung: dto.xacDinhVuViecTamDung,
          laCongNgheCaoVV: dto.laCongNgheCaoVV,
          status: IncidentStatus.TIEP_NHAN,
        },
        include: {
          investigator: {
            select: { id: true, firstName: true, lastName: true, username: true },
          },
        },
      });
      await tx.documentNumberLog.update({ where: { id: logId }, data: { documentId: rec.id } });
      return rec;
    });

    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_CREATED',
      subject: 'Incident',
      subjectId: record.id,
      metadata: { code: record.code, name: record.name, status: record.status },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Tạo vụ việc thành công' };
  }

  // ─────────────────────────────────────────────
  // UPDATE (status removed — use updateStatus)
  // ─────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateIncidentDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const existing = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    this.checkWriteScope(existing, dataScope);

    const fromDate = dto.fromDate ?? existing.fromDate?.toISOString();
    const toDate = dto.toDate ?? existing.toDate?.toISOString();
    if (fromDate && toDate) {
      if (new Date(fromDate) > new Date(toDate)) {
        throw new BadRequestException('Từ ngày không được lớn hơn Đến ngày');
      }
    }

    if (dto.investigatorId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.investigatorId } });
      if (!user) throw new BadRequestException('Điều tra viên không tồn tại');
    }

    const updateData: Record<string, unknown> = {};
    const fields = [
      'name', 'incidentType', 'description', 'unitId', 'investigatorId',
      'doiTuongCaNhan', 'doiTuongToChuc', 'loaiDonVu', 'nguonPhatTin', 'phuongThucTiepNhan', 'benVu',
      'donViGiaiQuyet', 'ketQuaXuLy', 'tinhTrangHoSo', 'tinhTrangThoiHieu',
      'nguoiQuyetDinh', 'canBoNhapId', 'assignedTeamId',
      // PR 5 hotfix #111: codex post-merge phát hiện whitelist thiếu — PUT silently dropped.
      // Regression tested: incidents.service.spec.ts "update whitelist persists" test.
      'loaiKetQua', 'canCuKhoiToCode',
      'soQuyetDinh', 'lyDoKhongKhoiTo', 'lyDoTamDinhChiText',
      'diaChiXayRa', 'sdtNguoiToGiac', 'diaChiNguoiToGiac', 'cmndNguoiToGiac',
      // ── TĐC VuViec fields ──────────────────────────────────────────────────
      'lyDoTamDinhChiVuViec', 'laCongNgheCaoVV', 'daRaSoatVV', 'ketQuaPhucHoiVuViec',
      // ── Field-parity hệ thống cũ (giai đoạn nguồn tin) ──
      'soQDPhanCongNguonTin', 'canCuKhongKhoiTo', 'canCuTamDinhChi', 'phanLoaiDanSuText',
      // ── Field-parity TĐC tracking + tiến độ khắc phục ──
      'tienDoKhacPhucTDC', 'tdcKhacPhucLyDoBienPhap', 'tdcKhacPhucBienBan',
      'soQuyetDinhTamDinhChiVV', 'soQuyetDinhPhucHoiVV',
      // PR-6 — QĐ không khởi tố riêng + cờ tạm dừng
      'soQDKhongKhoiTo', 'xacDinhVuViecTamDung',
    ];
    for (const f of fields) {
      if ((dto as Record<string, unknown>)[f] !== undefined) {
        updateData[f] = (dto as Record<string, unknown>)[f];
      }
    }

    const dateFields = ['fromDate', 'toDate', 'deadline', 'ngayDeXuat', 'ngayQuyetDinh', 'ngayQDPhanCongNguonTin', 'ngayTamDinhChiVV', 'ngayPhucHoiVV', 'ngayHetThoiHieuVV', 'ngayQDKhongKhoiTo'];
    for (const f of dateFields) {
      if ((dto as Record<string, unknown>)[f] !== undefined) {
        const val = (dto as Record<string, unknown>)[f] as string | null;
        updateData[f] = val ? new Date(val) : null;
      }
    }

    // Alias: form gửi `lyDoTamDinhChi` → cột `lyDoTamDinhChiText` (mirror create ~422).
    // Trước đây update whitelist chỉ có lyDoTamDinhChiText → giá trị bị drop thầm khi EDIT.
    const lyDoTDC = (dto as Record<string, unknown>).lyDoTamDinhChi;
    if (lyDoTDC !== undefined) {
      updateData.lyDoTamDinhChiText = lyDoTDC;
    }


    // v0.30: INCIDENT_UPDATED via wrapUpdate — full before/after snapshot for inline diff.
    let record;
    try {
      record = await this.audit.wrapUpdate({
        fetchFn: () =>
          this.prisma.incident.findUnique({
            where: { id },
            include: {
              investigator: {
                select: { id: true, firstName: true, lastName: true, username: true },
              },
            },
          }),
        updateFn: () =>
          this.prisma.incident.update({
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
        action: 'INCIDENT_UPDATED',
        subject: 'Incident',
        subjectId: id,
        userId: actorId,
        meta: { ipAddress: meta?.ipAddress, userAgent: meta?.userAgent },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Vụ việc đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    return { success: true, data: record, message: 'Cập nhật vụ việc thành công' };
  }

  // ─────────────────────────────────────────────
  // DELETE (soft delete)
  // ─────────────────────────────────────────────
  async delete(
    id: string,
    reason: string,
    actorId: string,
    actorRole: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    // 1. Fetch record with linked entities
    const existing = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
      include: {
        petitions: { where: { deletedAt: null }, select: { id: true } },
        documents: { where: { deletedAt: null }, select: { id: true } },
        linkedCase: { select: { id: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    }

    // 2. Status check — only TIEP_NHAN can be deleted
    if (existing.status !== IncidentStatus.TIEP_NHAN) {
      throw new BadRequestException(
        'Chỉ xóa được vụ việc ở trạng thái Tiếp nhận. ' +
          'Vụ việc đã chuyển trạng thái không thể xóa.',
      );
    }

    // 3. Linked records check (petitions + documents remain blockers; linkedCaseId → SetNull v0.43)
    if (existing.petitions.length > 0) {
      throw new BadRequestException(
        `Không thể xóa: vụ việc đang liên kết ${existing.petitions.length} đơn thư`,
      );
    }
    if (existing.documents.length > 0) {
      throw new BadRequestException(
        `Không thể xóa: vụ việc có ${existing.documents.length} tài liệu đính kèm`,
      );
    }
    // linkedCaseId: SetNull on delete (not a blocker — v0.43)

    // 4. Creator-or-admin check
    const isCreator = existing.createdById === actorId;
    const isAdmin = actorRole === ROLE_NAMES.ADMIN;
    if (!isCreator && !isAdmin) {
      throw new ForbiddenException(
        'Chỉ người tạo vụ việc hoặc quản trị viên mới được xóa',
      );
    }

    // 5. Time window check (default 72h, configurable via SystemSetting)
    const maxHours = await this.settings.getNumericValue(
      SETTINGS_KEY.THOI_HAN_XOA_VU_VIEC,
      72,
    );
    const hoursElapsed =
      (Date.now() - existing.createdAt.getTime()) / 3_600_000;
    if (hoursElapsed > maxHours && !isAdmin) {
      throw new BadRequestException(
        `Đã quá ${maxHours} giờ kể từ khi tạo. Chỉ quản trị viên mới xóa được.`,
      );
    }

    // 6. Write-scope check
    this.checkWriteScope(existing, dataScope);

    // 7+8. Atomic transaction: SetNull + soft delete
    // v0.43: multi-write must be atomic — wrap in $transaction
    try {
      await this.prisma.$transaction(async (tx) => {
        // Clear Case.linkedIncidentId for Cases sourced from this Incident (Branch-2 direction).
        // Run unconditionally — no-op if no Case has linkedIncidentId = id.
        // Two FK directions are independent: don't guard on existing.linkedCaseId.
        await tx.case.updateMany({
          where: { linkedIncidentId: id },
          data: { linkedIncidentId: null },
        });

        // Soft delete Incident; also clear linkedCaseId on the tombstone for data hygiene
        await tx.incident.update({
          where: { id },
          data: { deletedAt: new Date(), linkedCaseId: null },
        });
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'P2025') {
        throw new BadRequestException(
          'Vụ việc đã được chỉnh sửa hoặc xóa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    // Audit log outside transaction (audit failure should not rollback delete)
    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_DELETED',
      subject: 'Incident',
      subjectId: id,
      metadata: {
        code: existing.code,
        name: existing.name,
        reason,
        softDelete: true,
        hoursAfterCreation: Math.round(hoursElapsed),
        unlinkedCaseId: existing.linkedCaseId ?? null,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      message: `Đã xóa vụ việc ${existing.code}`,
    };
  }

  // ─────────────────────────────────────────────
  // DELETE PREFLIGHT (v0.43) — kiểm tra điều kiện xóa Vụ việc
  // ─────────────────────────────────────────────
  async previewDelete(id: string, dataScope?: DataScope | null) {
    const existing = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
      include: {
        linkedCase: { select: { id: true, name: true, caseCode: true } },
        petitions: { where: { deletedAt: null }, select: { id: true } },
        documents: { where: { deletedAt: null }, select: { id: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    }
    this.checkRecordInScope(existing, dataScope);

    const reasonsIfBlocked: string[] = [];
    if (existing.status !== IncidentStatus.TIEP_NHAN) {
      reasonsIfBlocked.push(`Trạng thái ${existing.status} không cho phép xóa.`);
    }
    if (existing.petitions.length > 0) {
      reasonsIfBlocked.push(`${existing.petitions.length} đơn thư đang liên kết.`);
    }
    if (existing.documents.length > 0) {
      reasonsIfBlocked.push(`${existing.documents.length} tài liệu đính kèm.`);
    }

    return {
      canDelete: reasonsIfBlocked.length === 0,
      status: existing.status,
      blockers: {
        petitions: existing.petitions.length,
        documents: existing.documents.length,
      },
      willUnlink: {
        case: existing.linkedCase ?? null,
      },
      reasonsIfBlocked,
    };
  }

  // ─────────────────────────────────────────────
  // UPDATE STATUS (with transition validation)
  // ─────────────────────────────────────────────
  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const existing = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    this.checkWriteScope(existing, dataScope);

    // Validate transition
    const allowed = VALID_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Không thể chuyển từ trạng thái ${existing.status} sang ${dto.status}`,
      );
    }

    // GAP-6: lyDoKhongKhoiTo required when transitioning to KHONG_KHOI_TO (Điều 157)
    // UpdateStatusDto vẫn single (modal đổi trạng thái chọn 1 căn cứ) — cột là mảng nên wrap khi ghi.
    if (dto.status === IncidentStatus.KHONG_KHOI_TO && !dto.lyDoKhongKhoiTo) {
      throw new BadRequestException(
        'Bắt buộc cung cấp lý do không khởi tố (lyDoKhongKhoiTo) theo Điều 157 BLTTHS 2015',
      );
    }

    let record;
    try {
      [record] = await this.prisma.$transaction([
        this.prisma.incident.update({
          where: {
            id,
            ...(dto.expectedUpdatedAt ? { updatedAt: new Date(dto.expectedUpdatedAt) } : {}),
          },
          data: {
            status: dto.status,
            ...(dto.lyDoKhongKhoiTo !== undefined && { lyDoKhongKhoiTo: [dto.lyDoKhongKhoiTo] }),
          },
          include: {
            investigator: {
              select: { id: true, firstName: true, lastName: true, username: true },
            },
          },
        }),
        this.prisma.incidentStatusHistory.create({
          data: {
            incidentId: id,
            fromStatus: existing.status,
            toStatus: dto.status,
            changedById: actorId,
            note: dto.note,
          },
        }),
      ]);
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Vụ việc đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_STATUS_CHANGED',
      subject: 'Incident',
      subjectId: id,
      metadata: { from: existing.status, to: dto.status, note: dto.note },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Cập nhật trạng thái thành công' };
  }

  // ─────────────────────────────────────────────
  // EXTEND DEADLINE (Điều 147 khoản 2-3 BLTTHS 2015)
  // ─────────────────────────────────────────────
  async extendDeadline(
    id: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
    });
    if (!incident) throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    this.checkWriteScope(incident, dataScope);

    // Max-extensions: use snapshot taken at incident creation (frozen). Falls
    // back to current active rule for incidents created before the migration
    // (will already be backfilled but defensive).
    let maxExtensions = incident.maxExtensionsSnapshot;
    if (maxExtensions == null) {
      maxExtensions = await this.deadlineRules.getActiveValue('SO_LAN_GIA_HAN_TOI_DA', 2);
    }
    if (incident.soLanGiaHan >= maxExtensions) {
      throw new BadRequestException(
        `Đã gia hạn tối đa ${maxExtensions} lần theo Điều 147 BLTTHS 2015`,
      );
    }

    // Extension days: live-read active rule (admin policy for extensions follows current rule).
    // Snapshot the rule version id used into giaHan1/2RuleVersionId so the historical
    // chain is preserved for VKS audit reconstruction.
    const settingKey = incident.soLanGiaHan === 0 ? 'THOI_HAN_GIA_HAN_1' : 'THOI_HAN_GIA_HAN_2';
    const extensionRule = await this.deadlineRules.getActive(settingKey);
    if (!extensionRule) {
      throw new BadRequestException(`Không có quy tắc ${settingKey} đang hiệu lực`);
    }
    const extensionDays = extensionRule.value;
    if (extensionDays <= 0) {
      throw new BadRequestException(`Cấu hình ${settingKey} không hợp lệ (giá trị phải > 0)`);
    }

    if (!incident.deadline) {
      throw new BadRequestException('Vụ việc chưa có thời hạn — không thể gia hạn');
    }
    const currentDeadline = incident.deadline;
    const newDeadline = new Date(currentDeadline);
    newDeadline.setDate(newDeadline.getDate() + extensionDays);

    // Atomic: only update if soLanGiaHan hasn't changed since we read it (prevents double-extension race)
    const snapshotField = incident.soLanGiaHan === 0 ? 'giaHan1RuleVersionId' : 'giaHan2RuleVersionId';
    const atomicResult = await this.prisma.incident.updateMany({
      where: { id, deletedAt: null, soLanGiaHan: incident.soLanGiaHan },
      data: {
        deadline: newDeadline,
        soLanGiaHan: { increment: 1 },
        ngayGiaHan: new Date(),
        [snapshotField]: extensionRule.id,
      } as Prisma.IncidentUncheckedUpdateManyInput,
    });
    if (atomicResult.count === 0) {
      throw new BadRequestException('Gia hạn thất bại — vui lòng thử lại (concurrent request detected)');
    }
    const updated = await this.prisma.incident.findFirst({
      where: { id },
      include: {
        investigator: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
    });
    if (!updated) throw new NotFoundException(`Vụ việc không tồn tại sau khi cập nhật (id: ${id})`);

    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_DEADLINE_EXTENDED',
      subject: 'Incident',
      subjectId: id,
      metadata: {
        soLanGiaHan: updated.soLanGiaHan,
        extensionDays,
        extensionRuleVersionId: extensionRule.id,
        newDeadline: updated.deadline,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: updated, message: `Gia hạn lần ${updated.soLanGiaHan} thành công` };
  }

  // ─────────────────────────────────────────────
  // GET STATS (count by status)
  // ─────────────────────────────────────────────
  // PR2/T1 — refactored để match PR1 Cases stats pattern:
  // - Takes QueryIncidentsStatsDto (status/limit/offset/sortBy/sortOrder omitted via OmitType)
  // - Returns { total, byStatus } exhaustive (every IncidentStatus key present, 0 if missing)
  // - Total derived from groupResults (single statement, snapshot consistent
  //   — /codex review P2 fix pattern applied here too)
  // - Strips status filter từ where (counts BY status, not filtered by it)
  async getStats(query: QueryIncidentsStatsDto, dataScope?: DataScope | null) {
    const {
      search,
      // `phase` cố tình KHÔNG destructure — DTO đã chặn ở cổng, và thẻ thống kê phải
      // đếm toàn bộ dataset chứ không tự lọc theo giai đoạn đang chọn.
      investigatorId,
      unitId,
      overdue,
      districtId,
      wardId,
      wardTeamId,
      loaiDonVu,
      benVu,
      tinhTrangHoSo,
      tinhTrangThoiHieu,
      canBoNhapId,
      fromDateRange,
      toDateRange,
    } = query;

    const where: Prisma.IncidentWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { doiTuongCaNhan: { contains: search, mode: 'insensitive' } },
        { doiTuongToChuc: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
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

    // KHÔNG lọc theo `phase` ở stats. Thẻ thống kê phải đếm TOÀN BỘ dataset, nếu không
    // thì chọn 1 giai đoạn sẽ khiến 3 thẻ kia về 0 — người dùng hết chỗ bấm sang giai
    // đoạn khác, drill-down mất ý nghĩa. `phase` cũng đã bị OmitType chặn ở DTO stats.
    if (investigatorId) where.investigatorId = investigatorId;
    if (unitId) where.unitId = unitId;
    if (loaiDonVu) where.loaiDonVu = loaiDonVu;
    if (benVu) where.benVu = benVu;
    if (tinhTrangHoSo) where.tinhTrangHoSo = tinhTrangHoSo;
    if (tinhTrangThoiHieu) where.tinhTrangThoiHieu = tinhTrangThoiHieu;
    if (canBoNhapId) where.canBoNhapId = canBoNhapId;

    if (fromDateRange || toDateRange) {
      where.ngayDeXuat = {};
      if (fromDateRange) where.ngayDeXuat.gte = new Date(fromDateRange);
      if (toDateRange) where.ngayDeXuat.lte = new Date(toDateRange);
    }

    if (overdue) {
      where.deadline = { lt: new Date() };
      where.status = { notIn: TERMINAL_STATUSES };
    }

    // Mirror getList: districtId maps to unitId; wardId currently unused
    // (Incident has no Subject relation). Reserved for future Subject-level filter.
    if (districtId) where.unitId = districtId;
    void wardId;

    if (wardTeamId) {
      where.assignedTeam = { is: { wardId: wardTeamId } };
    }

    const scopeFilter = buildScopeFilter(dataScope);
    if (scopeFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        scopeFilter as Prisma.IncidentWhereInput,
      ];
    }

    // Initialize all IncidentStatus keys to 0 → exhaustive response shape
    const byStatus: Record<IncidentStatus, number> = Object.values(IncidentStatus).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<IncidentStatus, number>,
    );

    const groupResults = await this.prisma.incident.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    let total = 0;
    for (const row of groupResults) {
      byStatus[row.status] = row._count._all;
      total += row._count._all;
    }

    // byGroup dùng chính PHASE_STATUSES — 4 thẻ thống kê Vụ việc trùng khít 4 giai đoạn BCA,
    // nên không cần bộ nhóm riêng.
    return { total, byStatus, byGroup: countByGroup(PHASE_STATUSES, byStatus) };
  }

  // ─────────────────────────────────────────────
  // MERGE INTO (nhập vào vụ khác)
  // ─────────────────────────────────────────────
  async mergeInto(
    id: string,
    dto: MergeIncidentDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    if (id === dto.targetId) {
      throw new BadRequestException('Không thể nhập vụ việc vào chính nó');
    }

    const [source, target] = await Promise.all([
      this.prisma.incident.findFirst({ where: { id, deletedAt: null } }),
      this.prisma.incident.findFirst({ where: { id: dto.targetId, deletedAt: null } }),
    ]);

    if (!source) throw new NotFoundException(`Vụ việc nguồn không tồn tại (id: ${id})`);
    if (!target) throw new NotFoundException(`Vụ việc đích không tồn tại (id: ${dto.targetId})`);
    this.checkWriteScope(source, dataScope);

    if (source.status === IncidentStatus.DA_NHAP_VU_KHAC) {
      throw new BadRequestException('Vụ việc này đã được nhập vào vụ khác');
    }

    try {
    await this.prisma.$transaction([
      // Update source status + link
      this.prisma.incident.update({
        where: {
          id,
          ...(dto.expectedUpdatedAt ? { updatedAt: new Date(dto.expectedUpdatedAt) } : {}),
        },
        data: {
          status: IncidentStatus.DA_NHAP_VU_KHAC,
          mergedIntoId: dto.targetId,
        },
      }),
      // Re-link petitions from source to target
      this.prisma.petition.updateMany({
        where: { linkedIncidentId: id },
        data: { linkedIncidentId: dto.targetId },
      }),
      // Re-link documents from source to target
      this.prisma.document.updateMany({
        where: { incidentId: id },
        data: { incidentId: dto.targetId },
      }),
      // Status history
      this.prisma.incidentStatusHistory.create({
        data: {
          incidentId: id,
          fromStatus: source.status,
          toStatus: IncidentStatus.DA_NHAP_VU_KHAC,
          changedById: actorId,
          note: `Nhập vào vụ việc ${target.code}`,
        },
      }),
    ]);
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Vụ việc đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_MERGED',
      subject: 'Incident',
      subjectId: id,
      metadata: { targetId: dto.targetId, targetCode: target.code },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: `Đã nhập vụ việc vào ${target.code}` };
  }

  // ─────────────────────────────────────────────
  // TRANSFER UNIT (chuyển đơn vị)
  // ─────────────────────────────────────────────
  async transferUnit(
    id: string,
    dto: TransferIncidentDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const existing = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    this.checkWriteScope(existing, dataScope);

    try {
    await this.prisma.$transaction([
      this.prisma.incident.update({
        where: {
          id,
          ...(dto.expectedUpdatedAt ? { updatedAt: new Date(dto.expectedUpdatedAt) } : {}),
        },
        data: {
          status: IncidentStatus.DA_CHUYEN_DON_VI,
          chuyenDenDonVi: dto.donViMoi,
          chuyenTuDonVi: existing.unitId ?? existing.donViGiaiQuyet,
        },
      }),
      this.prisma.incidentStatusHistory.create({
        data: {
          incidentId: id,
          fromStatus: existing.status,
          toStatus: IncidentStatus.DA_CHUYEN_DON_VI,
          changedById: actorId,
          note: `Chuyển đến đơn vị: ${dto.donViMoi}`,
        },
      }),
    ]);
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Vụ việc đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_TRANSFERRED',
      subject: 'Incident',
      subjectId: id,
      metadata: { donViMoi: dto.donViMoi, donViCu: existing.unitId },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: `Đã chuyển vụ việc đến ${dto.donViMoi}` };
  }

  // ─────────────────────────────────────────────
  // ASSIGN INVESTIGATOR
  // ─────────────────────────────────────────────
  async assignInvestigator(
    id: string,
    dto: AssignInvestigatorDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    // v0.36.0.0: include assignedTeam.wardId + ward để compute escalation FROM ward
    const existing = await this.prisma.incident.findFirst({
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
    if (!existing) throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    if (!dataScope?.canDispatch) {
      this.checkWriteScope(existing, dataScope);
    }

    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException(
        'Không thể phân công điều tra viên cho vụ việc đã kết thúc',
      );
    }

    let investigator: { firstName: string | null; lastName: string | null } | null = null;
    if (dto.investigatorId) {
      investigator = await this.prisma.user.findUnique({
        where: { id: dto.investigatorId },
      });
      if (!investigator) {
        throw new BadRequestException(`Điều tra viên không tồn tại (id: ${dto.investigatorId})`);
      }
    }

    if (dto.assignedTeamId) {
      const teamExists = await this.prisma.team.findFirst({
        where: { id: dto.assignedTeamId, isActive: true },
      });
      if (!teamExists) throw new BadRequestException(`Tổ điều tra không tồn tại hoặc đã ngừng hoạt động (id: ${dto.assignedTeamId})`);
      if (dto.investigatorId) {
        const member = await this.prisma.userTeam.findFirst({
          where: { userId: dto.investigatorId, teamId: dto.assignedTeamId },
        });
        if (!member) throw new BadRequestException('Điều tra viên không thuộc tổ được chỉ định');
      }
    }

    let record;
    try {
      record = await this.prisma.incident.update({
        where: {
          id,
          ...(dto.expectedUpdatedAt ? { updatedAt: new Date(dto.expectedUpdatedAt) } : {}),
        },
        data: {
          ...(dto.assignedTeamId ? { assignedTeamId: dto.assignedTeamId } : {}),
          ...(dto.investigatorId !== undefined ? { investigatorId: dto.investigatorId } : {}),
          deadline: dto.deadline ? new Date(dto.deadline) : existing.deadline,
          status: dto.investigatorId ? IncidentStatus.DANG_XAC_MINH : existing.status,
        },
        include: {
          investigator: {
            select: { id: true, firstName: true, lastName: true, username: true },
          },
        },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Vụ việc đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_ASSIGNED',
      subject: 'Incident',
      subjectId: id,
      metadata: {
        fromTeamId: existing.assignedTeamId ?? null,
        toTeamId: dto.assignedTeamId ?? existing.assignedTeamId ?? null,
        fromInvestigatorId: existing.investigatorId ?? null,
        toInvestigatorId: dto.investigatorId,
        investigatorName: investigator ? `${investigator.firstName ?? ''} ${investigator.lastName ?? ''}`.trim() : null,
        dispatchedBy: actorId,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    if (dto.investigatorId && dto.investigatorId !== existing.investigatorId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { firstName: true, lastName: true },
      });
      const byUserName = actor ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() : '';
      this.eventEmitter.emit('incident.assigned', new IncidentAssignedEvent(
        id, existing.name, dto.investigatorId, actorId, byUserName,
      ));
    }

    // v0.36.0.0: emit INCIDENT_ESCALATED_FROM_WARD khi ward team → non-ward team
    const existingWithTeam = existing as typeof existing & {
      assignedTeam: { wardId: string | null; ward: { name: string } | null } | null;
    };
    const wasInWardTeam = existingWithTeam.assignedTeam?.wardId != null;
    const isReassigning = dto.assignedTeamId && dto.assignedTeamId !== existing.assignedTeamId;
    if (wasInWardTeam && isReassigning) {
      const newTeam = await this.prisma.team.findUnique({
        where: { id: dto.assignedTeamId! },
        select: { wardId: true },
      });
      if (newTeam && newTeam.wardId == null) {
        await this.audit.log({
          userId: actorId,
          action: 'INCIDENT_ESCALATED_FROM_WARD',
          subject: 'Incident',
          subjectId: id,
          metadata: {
            oldTeamId: existing.assignedTeamId,
            newTeamId: dto.assignedTeamId!,
            oldWardId: existingWithTeam.assignedTeam!.wardId,
            oldWardName: existingWithTeam.assignedTeam!.ward?.name ?? null,
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
      }
    }

    return { success: true, data: record, message: 'Phân công điều tra viên thành công' };
  }

  // ─────────────────────────────────────────────
  // PROSECUTE — Khởi tố → tạo Case (FIXED: transactional)
  // ─────────────────────────────────────────────
  async prosecute(
    id: string,
    dto: ProsecuteIncidentDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const existing = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    this.checkWriteScope(existing, dataScope);

    if (existing.status !== IncidentStatus.DANG_XAC_MINH &&
        existing.status !== IncidentStatus.DA_PHAN_CONG) {
      throw new BadRequestException(
        'Chỉ có thể khởi tố vụ việc đang ở trạng thái ĐANG XÁC MINH hoặc ĐÃ PHÂN CÔNG',
      );
    }

    // FIXED: wrap in transaction for atomicity
    let result;
    try {
    result = await this.prisma.$transaction(async (tx) => {
      let caseRecord;
      try {
        caseRecord = await tx.case.create({
          data: {
            name: dto.caseName,
            crime: dto.crime,
            status: 'TIEP_NHAN',
            investigatorId: existing.investigatorId,
            // v0.37.1 PR-INC — provenance gap fix per eng review HIGH finding:
            // Incident prosecution path was creating Case without caseProvenance,
            // which would fail the NOT NULL constraint in PR-PROV-2 (Contract).
            caseProvenance: 'FROM_INCIDENT' as const,
            linkedIncidentId: id,
          },
        });
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException('Mã vụ án bị trùng, vui lòng thử lại');
        }
        throw err;
      }

      await tx.incident.update({
        where: {
          id,
          ...(dto.expectedUpdatedAt ? { updatedAt: new Date(dto.expectedUpdatedAt) } : {}),
        },
        data: {
          status: IncidentStatus.DA_CHUYEN_VU_AN,
          linkedCaseId: caseRecord.id,
        },
      });

      await tx.incidentStatusHistory.create({
        data: {
          incidentId: id,
          fromStatus: existing.status,
          toStatus: IncidentStatus.DA_CHUYEN_VU_AN,
          changedById: actorId,
          note: `Khởi tố thành vụ án: ${caseRecord.name}`,
        },
      });

      return caseRecord;
    });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025' && dto.expectedUpdatedAt) {
        throw new ConflictException(
          'Vụ việc đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    await this.audit.log({
      userId: actorId,
      action: 'INCIDENT_PROSECUTED',
      subject: 'Incident',
      subjectId: id,
      metadata: { caseId: result.id, caseName: result.name },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: { incident: { id, status: IncidentStatus.DA_CHUYEN_VU_AN }, case: result },
      message: 'Khởi tố vụ việc thành vụ án thành công',
    };
  }

  // ─────────────────────────────────────────────
  // GET INVESTIGATORS (for FK select dropdown)
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
  // EXPORT WARD INCIDENTS (Vụ việc theo phường/xã)
  // ─────────────────────────────────────────────
  async exportWardIncidents(
    query: { unitId?: string; fromDate?: string; toDate?: string },
    dataScope: DataScope | null | undefined,
    res: Response,
    actor?: { userId: string; ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    // Sprint 2 / S2.1 — audit log data export
    if (actor) {
      await this.audit.log({
        userId: actor.userId,
        action: 'INCIDENT_EXPORTED',
        subject: 'Incident',
        metadata: { format: 'xlsx', kind: 'ward', filters: query },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
    }
    const where: Prisma.IncidentWhereInput = { deletedAt: null };
    if (query.unitId) where.unitId = query.unitId;
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
        scopeFilter as Prisma.IncidentWhereInput,
      ];
    }

    const records = await this.prisma.incident.findMany({
      where,
      take: 500,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        incidentType: true,
        description: true,
        diaChiXayRa: true,
        createdAt: true,
        status: true,
        unitId: true,
        investigator: { select: { firstName: true, lastName: true } },
      },
    });

    const COL_COUNT = 8;
    const HEADERS = ['STT', 'Tên vụ việc', 'Loại', 'Địa điểm', 'ĐTV phụ trách', 'Ngày tiếp nhận', 'Trạng thái', 'Đơn vị'];
    const WIDTHS = [6, 30, 20, 25, 20, 16, 20, 20];

    const fromStr = query.fromDate ? new Date(query.fromDate).toLocaleDateString('vi-VN') : '';
    const toStr = query.toDate ? new Date(query.toDate).toLocaleDateString('vi-VN') : '';
    const period = fromStr && toStr ? `Từ ngày ${fromStr} đến ngày ${toStr}` : 'Tất cả thời gian';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Vụ việc theo phường xã');

    BcaExcelHelper.addHeader(sheet, COL_COUNT, 'DANH SÁCH VỤ VIỆC THEO PHƯỜNG/XÃ', period);

    const headerRow = sheet.getRow(7);
    BcaExcelHelper.addColumnHeaders(headerRow, HEADERS, WIDTHS);

    records.forEach((rec, idx) => {
      const investigatorName = rec.investigator
        ? `${rec.investigator.lastName ?? ''} ${rec.investigator.firstName ?? ''}`.trim()
        : '';
      const dataRow = sheet.addRow([
        idx + 1,
        rec.name ?? '',
        rec.incidentType ?? '',
        rec.diaChiXayRa ?? '',
        investigatorName,
        rec.createdAt ? rec.createdAt.toLocaleDateString('vi-VN') : '',
        INCIDENT_STATUS_LABEL[rec.status as IncidentStatus] ?? rec.status ?? '',
        rec.unitId ?? '',
      ]);
      BcaExcelHelper.styleDataRow(dataRow, idx % 2 === 1, COL_COUNT);
    });

    const lastDataRow = sheet.lastRow?.number ?? 7;
    BcaExcelHelper.addFooter(sheet, lastDataRow + 2, COL_COUNT);
    BcaExcelHelper.setPrintSetup(sheet);

    const filename = `VuViecPhuongXa_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    try {
      await workbook.xlsx.write(res);
    } catch (err) {
      if (!res.headersSent) res.status(500).json({ error: 'Export failed' });
      else res.destroy();
    }
  }

  // ─────────────────────────────────────────────
  // RESTORE (v0.32.0.0) — khôi phục soft-deleted Incident (ADMIN only)
  // ─────────────────────────────────────────────
  async restore(
    id: string,
    reason: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.incident.findFirst({
      where: { id, deletedAt: { not: null } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Vụ việc không tồn tại hoặc chưa bị xóa (id: ${id})`,
      );
    }

    const hoursAfterDeletion =
      (Date.now() - existing.deletedAt!.getTime()) / 3_600_000;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.incident.update({
          where: { id, deletedAt: { not: null } },
          data: { deletedAt: null },
        });
        await this.audit.log(
          {
            userId: actorId,
            action: 'INCIDENT_RESTORED',
            subject: 'Incident',
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
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new BadRequestException(
          'Vụ việc đã được khôi phục bởi quản trị viên khác. Tải lại danh sách.',
        );
      }
      throw err;
    }

    return { success: true, message: 'Khôi phục vụ việc thành công' };
  }

  // ─────────────────────────────────────────────
  // LIST DELETED — paginated với enriched delete audit
  // ─────────────────────────────────────────────
  async listDeleted(query: { limit?: number; offset?: number; search?: string }) {
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;
    const search = query.search?.trim();

    const where: Prisma.IncidentWhereInput = {
      deletedAt: { not: null },
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        },
      }),
      this.prisma.incident.count({ where }),
    ]);

    const ids = data.map((c) => c.id);
    const deleteAudits = ids.length > 0
      ? await this.prisma.$queryRaw<Array<{ subjectId: string; userId: string | null; metadata: unknown; createdAt: Date }>>`
          SELECT DISTINCT ON ("subjectId") "subjectId", "userId", metadata, "createdAt"
          FROM "audit_logs"
          WHERE action = 'INCIDENT_DELETED' AND "subjectId" = ANY(${ids})
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
}
