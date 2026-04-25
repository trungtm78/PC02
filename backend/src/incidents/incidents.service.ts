import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { QueryIncidentsDto } from './dto/query-incidents.dto';
import { AssignInvestigatorDto } from './dto/assign-investigator.dto';
import { ProsecuteIncidentDto } from './dto/prosecute-incident.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { MergeIncidentDto } from './dto/merge-incident.dto';
import { TransferIncidentDto } from './dto/transfer-incident.dto';
import { Prisma, IncidentStatus, LoaiNguonTin, LyDoKhongKhoiTo } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { buildScopeFilter } from '../common/utils/scope-filter.util';
import { TERMINAL_STATUSES, VALID_TRANSITIONS, PHASE_STATUSES } from './incidents.constants';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
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
    // If both provided, phase wins — status is ignored
    if (phase && PHASE_STATUSES[phase]) {
      where.status = { in: PHASE_STATUSES[phase] };
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
    if (overdue === 'true') {
      where.deadline = { lt: new Date() };
      where.status = { notIn: TERMINAL_STATUSES };
    }

    if (districtId) where.unitId = districtId;

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
          lyDoTamDinhChi: true,
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
    const { userIds, teamIds } = dataScope;
    const ownerMatch = record.investigatorId && userIds.includes(record.investigatorId);
    const teamMatch = record.assignedTeamId && teamIds.includes(record.assignedTeamId);
    const unassignedMatch = !record.assignedTeamId && teamIds.length > 0;
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
  ) {
    if (dto.fromDate && dto.toDate) {
      if (new Date(dto.fromDate) > new Date(dto.toDate)) {
        throw new BadRequestException('Từ ngày không được lớn hơn Đến ngày');
      }
    }

    if (dto.investigatorId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.investigatorId } });
      if (!user) throw new BadRequestException('Điều tra viên không tồn tại');
    }

    const code = await this.generateIncidentCode();

    // Auto-calculate deadline: ngayTiepNhan + THOI_HAN_XAC_MINH (default 20 days)
    let computedDeadline: Date | undefined;
    if (dto.deadline) {
      computedDeadline = new Date(dto.deadline);
    } else if (dto.ngayDeXuat) {
      const thoiHan = await this.settings.getNumericValue('THOI_HAN_XAC_MINH', 20);
      const d = new Date(dto.ngayDeXuat);
      d.setDate(d.getDate() + thoiHan);
      computedDeadline = d;
    }

    const record = await this.prisma.incident.create({
      data: {
        code,
        name: dto.name,
        incidentType: dto.incidentType,
        description: dto.description,
        fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
        toDate: dto.toDate ? new Date(dto.toDate) : undefined,
        deadline: computedDeadline,
        unitId: dto.unitId,
        investigatorId: dto.investigatorId,
        sourcePetitionId: dto.sourcePetitionId,
        doiTuongCaNhan: dto.doiTuongCaNhan,
        doiTuongToChuc: dto.doiTuongToChuc,
        loaiDonVu: dto.loaiDonVu,
        benVu: dto.benVu,
        donViGiaiQuyet: dto.donViGiaiQuyet,
        ngayDeXuat: dto.ngayDeXuat ? new Date(dto.ngayDeXuat) : undefined,
        canBoNhapId: dto.canBoNhapId,
        assignedTeamId: dto.assignedTeamId,
        createdById: actorId,
        soQuyetDinh: dto.soQuyetDinh,
        ngayQuyetDinh: dto.ngayQuyetDinh ? new Date(dto.ngayQuyetDinh) : undefined,
        lyDoKhongKhoiTo: dto.lyDoKhongKhoiTo,
        lyDoTamDinhChi: dto.lyDoTamDinhChi,
        diaChiXayRa: dto.diaChiXayRa,
        sdtNguoiToGiac: dto.sdtNguoiToGiac,
        diaChiNguoiToGiac: dto.diaChiNguoiToGiac,
        cmndNguoiToGiac: dto.cmndNguoiToGiac,
        ketQuaXuLy: dto.ketQuaXuLy,
        tinhTrangHoSo: dto.tinhTrangHoSo,
        tinhTrangThoiHieu: dto.tinhTrangThoiHieu,
        nguoiQuyetDinh: dto.nguoiQuyetDinh,
        status: IncidentStatus.TIEP_NHAN,
      },
      include: {
        investigator: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
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
      'doiTuongCaNhan', 'doiTuongToChuc', 'loaiDonVu', 'benVu',
      'donViGiaiQuyet', 'ketQuaXuLy', 'tinhTrangHoSo', 'tinhTrangThoiHieu',
      'nguoiQuyetDinh', 'canBoNhapId', 'assignedTeamId',
      'soQuyetDinh', 'lyDoKhongKhoiTo', 'lyDoTamDinhChi',
      'diaChiXayRa', 'sdtNguoiToGiac', 'diaChiNguoiToGiac', 'cmndNguoiToGiac',
    ];
    for (const f of fields) {
      if ((dto as Record<string, unknown>)[f] !== undefined) {
        updateData[f] = (dto as Record<string, unknown>)[f];
      }
    }

    const dateFields = ['fromDate', 'toDate', 'deadline', 'ngayDeXuat', 'ngayQuyetDinh'];
    for (const f of dateFields) {
      if ((dto as Record<string, unknown>)[f] !== undefined) {
        const val = (dto as Record<string, unknown>)[f] as string | null;
        updateData[f] = val ? new Date(val) : null;
      }
    }

    let record;
    try {
      record = await this.prisma.incident.update({
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
      action: 'INCIDENT_UPDATED',
      subject: 'Incident',
      subjectId: id,
      metadata: { changes: dto },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

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
        documents: { select: { id: true } },
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

    // 3. Linked records check
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
    if (existing.linkedCaseId) {
      throw new BadRequestException(
        'Không thể xóa: vụ việc đã liên kết với vụ án',
      );
    }

    // 4. Creator-or-admin check
    const isCreator = existing.createdById === actorId;
    const isAdmin = actorRole === 'ADMIN';
    if (!isCreator && !isAdmin) {
      throw new ForbiddenException(
        'Chỉ người tạo vụ việc hoặc quản trị viên mới được xóa',
      );
    }

    // 5. Time window check (default 72h, configurable via SystemSetting)
    const maxHours = await this.settings.getNumericValue(
      'THOI_HAN_XOA_VU_VIEC',
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

    // 7. Soft delete
    await this.prisma.incident.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // 8. Audit log with reason
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
            ...(dto.lyDoKhongKhoiTo !== undefined && { lyDoKhongKhoiTo: dto.lyDoKhongKhoiTo }),
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

    const maxExtensions = await this.settings.getNumericValue('SO_LAN_GIA_HAN_TOI_DA', 2);
    if (incident.soLanGiaHan >= maxExtensions) {
      throw new BadRequestException(
        `Đã gia hạn tối đa ${maxExtensions} lần theo Điều 147 BLTTHS 2015`,
      );
    }

    // First extension uses THOI_HAN_GIA_HAN_1, second uses THOI_HAN_GIA_HAN_2
    const settingKey = incident.soLanGiaHan === 0 ? 'THOI_HAN_GIA_HAN_1' : 'THOI_HAN_GIA_HAN_2';
    const extensionDays = await this.settings.getNumericValue(settingKey, 60);
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
    const atomicResult = await this.prisma.incident.updateMany({
      where: { id, deletedAt: null, soLanGiaHan: incident.soLanGiaHan },
      data: { deadline: newDeadline, soLanGiaHan: { increment: 1 }, ngayGiaHan: new Date() },
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
  async getStats(dataScope?: DataScope | null) {
    const where: Prisma.IncidentWhereInput = { deletedAt: null };

    const scopeFilter = buildScopeFilter(dataScope);
    if (scopeFilter) {
      where.AND = [scopeFilter as Prisma.IncidentWhereInput];
    }

    const stats = await this.prisma.incident.groupBy({
      by: ['status'],
      _count: true,
      where,
    });

    const result: Record<string, number> = {};
    for (const s of stats) {
      result[s.status] = s._count;
    }

    return { success: true, data: result };
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
    const existing = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Vụ việc không tồn tại (id: ${id})`);
    this.checkWriteScope(existing, dataScope);

    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException(
        'Không thể phân công điều tra viên cho vụ việc đã kết thúc',
      );
    }

    const investigator = await this.prisma.user.findUnique({
      where: { id: dto.investigatorId },
    });
    if (!investigator) {
      throw new BadRequestException(`Điều tra viên không tồn tại (id: ${dto.investigatorId})`);
    }

    let record;
    try {
      record = await this.prisma.incident.update({
        where: {
          id,
          ...(dto.expectedUpdatedAt ? { updatedAt: new Date(dto.expectedUpdatedAt) } : {}),
        },
        data: {
          investigatorId: dto.investigatorId,
          deadline: dto.deadline ? new Date(dto.deadline) : existing.deadline,
          status: IncidentStatus.DANG_XAC_MINH,
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
        investigatorId: dto.investigatorId,
        investigatorName: `${investigator.firstName ?? ''} ${investigator.lastName ?? ''}`.trim(),
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

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
  // FIXED: Generate unique VV-YYYY-XXXXX code (retry loop)
  // ─────────────────────────────────────────────
  private async generateIncidentCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `VV-${year}-`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const latest = await this.prisma.incident.findFirst({
        where: { code: { startsWith: prefix } },
        orderBy: { code: 'desc' },
        select: { code: true },
      });

      let seq = 1;
      if (latest) {
        const lastSeq = parseInt(latest.code.split('-')[2] ?? '0', 10);
        if (!isNaN(lastSeq)) seq = lastSeq + 1;
      }

      const candidate = `${prefix}${String(seq).padStart(5, '0')}`;

      try {
        // Validate uniqueness via a quick check
        const conflict = await this.prisma.incident.findUnique({
          where: { code: candidate },
          select: { id: true },
        });
        if (!conflict) return candidate;
      } catch {
        // Race condition — retry
      }
    }

    // Final fallback: use timestamp-based suffix
    const ts = Date.now().toString().slice(-5);
    return `${prefix}${ts}`;
  }
}
