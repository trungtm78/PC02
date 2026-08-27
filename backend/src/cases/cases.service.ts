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
import { hoSoCodeVariants } from '../common/utils/ho-so-code.util';
import { buildListOrderBy, type ListSortOrder } from '../common/utils/list-sort.util';
import { AuditService } from '../audit/audit.service';
import { buildCaseStatisticData } from './case-statistic.builder';
import { SettingsService } from '../settings/settings.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import { QueryCasesStatsDto } from './dto/query-cases-stats.dto';
import { AssignCaseDto } from './dto/assign-case.dto';
import type { DeleteCasePreflightResponse } from './dto/delete-case-preflight.response';
import { Prisma, CaseStatus, PetitionStatus, LoaiDon, CapDoToiPham, LyDoTamDinhChiVuAn, KetQuaPhucHoiVuAn, CaseProvenance, SubjectType, CaseType } from '@prisma/client';
import { TrangThaiPhanHoi } from './dto/query-cases.dto';
import type { DataScope } from '../auth/services/unit-scope.service';
import { buildScopeFilter } from '../common/utils/scope-filter.util';
import { apDungKyVaoWhere } from '../common/utils/thong-ke-ky.util';
import { buildIncidentFromCase, shouldAutoCreateIncident } from '../common/utils/incident-factory.util';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { BcaExcelHelper } from '../common/bca-excel.helper';
import { CASE_STATUS_LABEL } from '../common/constants/status-labels.constants';
import { ROLE_NAMES } from '../common/constants/role.constants';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';
import { resolveGroup, countByGroup } from '../common/status-groups.util';
import { CASE_STATUS_GROUPS, LIST_SUSPECT_NAMES_LIMIT } from './cases.constants';
import { legacyFormParityData } from './legacy-form-parity.mapper';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CaseAssignedEvent, CaseCreatedEvent } from '../notifications/events/notification.events';

type JsonInput = Prisma.InputJsonValue;
type PrismaTx = Prisma.TransactionClient;

// ─── UTDT pure helpers (exported for testing) ────────────────────────────────

type ComputeInput = {
  ketQuaUyThac: string | null;
  ngayTraKetQua: Date | null;
  thoiHanUyThac: Date | null;
  metadata: Record<string, unknown> | null | unknown;
};

export function computeTrangThaiPhanHoi(c: ComputeInput): TrangThaiPhanHoi {
  const meta = c.metadata as Record<string, unknown> | null;
  if (meta?.lyDoKhongThucHienDuoc) return 'KHONG_THUC_HIEN_DUOC';
  if (c.ketQuaUyThac && c.ngayTraKetQua) return 'DA_PHAN_HOI';
  if (c.thoiHanUyThac && new Date() > c.thoiHanUyThac) return 'QUA_HAN';
  return 'CHUA_PHAN_HOI';
}

export function buildTrangThaiFilter(state: TrangThaiPhanHoi): Prisma.CaseWhereInput {
  switch (state) {
    case 'DA_PHAN_HOI':
      return { ketQuaUyThac: { not: null }, ngayTraKetQua: { not: null } };
    case 'KHONG_THUC_HIEN_DUOC':
      return {
        metadata: {
          path: ['lyDoKhongThucHienDuoc'],
          not: Prisma.JsonNull,
        },
      };
    case 'QUA_HAN':
      return {
        thoiHanUyThac: { lt: new Date() },
        ketQuaUyThac: null,
        metadata: {
          path: ['lyDoKhongThucHienDuoc'],
          equals: Prisma.JsonNull,
        },
      };
    case 'CHUA_PHAN_HOI':
      return {
        NOT: [
          { ketQuaUyThac: { not: null }, ngayTraKetQua: { not: null } },
          { metadata: { path: ['lyDoKhongThucHienDuoc'], not: Prisma.JsonNull } },
          { thoiHanUyThac: { lt: new Date() }, ketQuaUyThac: null },
        ],
      };
    default:
      return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService, // v0.31.0.2: THOI_HAN_XOA_VU_AN
    private readonly docNums: DocumentNumbersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────────────────────
  // GET LIST
  // ─────────────────────────────────────────────
  async getList(query: QueryCasesDto, dataScope?: DataScope | null) {
    const {
      search,
      status,
      statusGroup,
      charges,
      investigatorId,
      unit,
      fromDate,
      toDate,
      overdue,
      districtId,
      wardId,
      wardTeamId,
      capDoToiPham,
      caseType,
      donViGiao,
      loaiUyThac,
      trangThaiPhanHoi,
      ngayTiepNhanFrom,
      ngayTiepNhanTo,
      investigatorName,
      stt,
      sttCu,
      createdById,
      limit = 20,
      offset = 0,
      sortBy, // mac dinh do buildListOrderBy quyet dinh, KHONG dat o day
      sortOrder = 'desc',
    } = query;

    const where: Prisma.CaseWhereInput = {
      deletedAt: null,
      // Default REGULAR filter — UTDT records only visible when caseType=UY_THAC_DIEU_TRA
      caseType: caseType ?? CaseType.REGULAR,
    };

    if (search) {
      const isUtdt = (caseType ?? CaseType.REGULAR) === CaseType.UY_THAC_DIEU_TRA;
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { crime: { contains: search, mode: 'insensitive' } },
        { unit: { contains: search, mode: 'insensitive' } },
        { caseCode: { contains: search, mode: 'insensitive' } },
        { soHoSoCu: { contains: search, mode: 'insensitive' } }, // truy nguyên: tìm theo STT hệ cũ
        { sttCu: { contains: search, mode: 'insensitive' } },
        ...(isUtdt
          ? [
              { donViGiao: { contains: search, mode: 'insensitive' as const } },
              { soQuyetDinhUyThac: { contains: search, mode: 'insensitive' as const } },
              { metadata: { path: ['nghiVanDoiTuong'], string_contains: search } },
            ]
          : []),
      ];
    }

    // Nhóm trạng thái (drill-down thẻ thống kê) THẮNG status đơn lẻ — giống semantic
    // `phase` đã ship ở Vụ việc. `resolveGroup` chặn prototype chain.
    const groupStatuses = resolveGroup(CASE_STATUS_GROUPS, statusGroup);
    if (groupStatuses) {
      where.status = { in: [...groupStatuses] };
    } else if (status) {
      where.status = status;
    }

    // Tội danh — bộ lọc nâng cao "Tội danh" trước đây gửi param `charges` mà DTO KHÔNG có,
    // nên `forbidNonWhitelisted` trả 400. Nay nhận thật.
    if (charges) {
      where.crime = { contains: charges, mode: 'insensitive' };
    }

    if (investigatorId) {
      where.investigatorId = investigatorId;
    }

    // Mã hồ sơ tồn tại ở HAI dạng: hệ cũ hiện `26-9893`, hệ mới lưu `2026-9893`. Khớp
    // CHÍNH XÁC theo danh sách biến thể — `contains` sẽ quét trúng hàng nghìn mã khác.
    const bienTheMa = hoSoCodeVariants(stt);
    if (bienTheMa.length) {
      where.caseCode = { in: bienTheMa };
    }

    if (sttCu?.trim()) {
      where.sttCu = { contains: sttCu.trim(), mode: 'insensitive' };
    }

    // "Cán bộ nhập" ở Vụ án là người tạo hồ sơ.
    if (createdById?.trim()) {
      where.createdById = createdById.trim();
    }

    // Lọc theo ĐÚNG cột mà cột "Đơn vị giải quyết" đang hiện. `unit` là đơn vị TIẾP NHẬN
    // và rỗng ở toàn bộ 3.286 vụ án, nên lọc trên nó không bao giờ ra kết quả — cán bộ lọc
    // theo tổ sẽ tưởng tổ ấy không có hồ sơ nào. Giữ tên tham số `unit` để địa chỉ trang cũ
    // vẫn dùng được.
    if (unit) {
      // Khớp CHỨA, không khớp bằng: ô lọc là ô gõ chữ tự do, còn giá trị lưu là nhãn đầy đủ
      // ("Đội 1 PC02"). Gõ "PC02" mà khớp bằng thì không ra hồ sơ nào — Đơn thư và Vụ việc
      // vốn đã khớp chứa.
      where.donViGiaiQuyet = { contains: unit, mode: 'insensitive' };
    }

    // Kỳ thống kê: người dùng không tự đặt ngày thì áp mặc định admin cấu hình. Cùng một
    // hàm với thẻ số và badge menu nên ba chỗ không thể lệch nhau.
    //
    // ĐỔI CỘT LỌC: trước đây hai ô ngày của Vụ án lọc theo `createdAt`, khác hẳn Đơn thư
    // (`receivedDate`) và Vụ việc (`ngayDeXuat`). Hồ sơ di trú dồn chung MỘT ngày tạo nên
    // bộ lọc ấy gần như không lọc được gì. Nay theo `ngayDeXuat` như hai module kia; muốn
    // lọc theo ngày tạo thì chọn "Tính theo: Ngày tạo".
    const kyThongKe = await this.settings.getKyThongKe({ truong: query.thongKeTruongNgay });
    apDungKyVaoWhere(where as Record<string, unknown>, kyThongKe, fromDate, toDate, 'ngayDeXuat');

    // Filter quá hạn
    if (overdue) {
      where.deadline = { lt: new Date() };
      // KHÔNG gán đè `where.status`: làm vậy sẽ xoá sổ điều kiện statusGroup/status đã đặt
      // ở trên → bấm thẻ "Tạm đình chỉ" khi đang lọc quá hạn sẽ trả về MỌI hồ sơ quá hạn.
      // Prisma cho phép gộp in/equals + notIn trong cùng một filter.
      const notTerminal = [CaseStatus.DA_KET_LUAN, CaseStatus.DA_LUU_TRU, CaseStatus.DINH_CHI];
      where.status =
        typeof where.status === 'string'
          ? { equals: where.status, notIn: notTerminal }
          : { ...(where.status ?? {}), notIn: notTerminal };
    }

    if (capDoToiPham) {
      where.capDoToiPham = capDoToiPham;
    }

    // v0.44 — UTDT-specific filters
    if (donViGiao) {
      where.donViGiao = { contains: donViGiao, mode: 'insensitive' };
    }
    if (loaiUyThac) {
      where.loaiUyThac = loaiUyThac;
    }
    if (trangThaiPhanHoi) {
      const stateFilter = buildTrangThaiFilter(trangThaiPhanHoi);
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        stateFilter,
      ];
    }

    // v0.44.3 — UTDT date range by ngayTiepNhan
    // Guard date param không hợp lệ → bỏ qua filter (tránh Prisma 500 với Invalid Date từ input rác).
    const _from = ngayTiepNhanFrom ? new Date(ngayTiepNhanFrom) : null;
    if (_from && !Number.isNaN(_from.getTime())) {
      where.ngayTiepNhan = {
        ...(where.ngayTiepNhan as Prisma.DateTimeNullableFilter | undefined),
        gte: _from,
      };
    }
    const _to = ngayTiepNhanTo ? new Date(ngayTiepNhanTo + 'T23:59:59Z') : null;
    if (_to && !Number.isNaN(_to.getTime())) {
      where.ngayTiepNhan = {
        ...(where.ngayTiepNhan as Prisma.DateTimeNullableFilter | undefined),
        lte: _to,
      };
    }

    // v0.44.3 — investigatorName partial search (case-insensitive)
    if (investigatorName) {
      where.investigator = {
        OR: [
          { firstName: { contains: investigatorName, mode: 'insensitive' } },
          { lastName: { contains: investigatorName, mode: 'insensitive' } },
        ],
      };
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

    // v0.36.0.0: filter theo phường công tác (Team.wardId) — cross-ward view PC02/ADMIN.
    // Ward officer's scope filter (v0.33) đã restrict tới wardTeam mình → wardTeamId
    // query của ward officer effectively no-op (intersection của 2 filter cùng team).
    if (wardTeamId) {
      where.assignedTeam = {
        is: { wardId: wardTeamId },
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

    // Mặc định sắp theo NGÀY ĐỀ XUẤT. Nghe có vẻ sai so với "ngày tiếp nhận", nhưng
    // đo trên dữ liệu thật: `receiveDate` — đúng cột mang tên tiếp nhận — chỉ có
    // 2/3.304 hồ sơ (0,06%), còn `ngayDeXuat` phủ 98,8%. Sắp theo `receiveDate` sẽ cho
    // một khối rỗng khổng lồ. `createdAt` thì cả bảng chỉ có 3 ngày khác nhau (di trú).
    // UTDT dùng chung bảng và endpoint này (GET /cases?caseType=UY_THAC_DIEU_TRA) nên
    // thừa hưởng cùng thứ tự; `ngayTiepNhan` riêng của UTDT chỉ phủ 12,5%.
    const orderBy = buildListOrderBy({
      sortBy,
      sortOrder: sortOrder as ListSortOrder,
      allowed: [
        'createdAt', 'updatedAt', 'name', 'deadline', 'status',
        'ngayDeXuat', 'receiveDate', 'ngayTiepNhan', 'stt',
      ],
      // Anh yêu cầu 27/08/2026: danh sách mặc định sắp theo STT giảm dần, bấm tiêu đề đổi
      // chiều. Sắp trên cột SỐ `sttSort` do trigger giữ — sắp thẳng trên chuỗi mã thì
      // `2026-9395` đứng sau `2026-11171` dù số nhỏ hơn.
      defaultField: 'stt',
      nullableFields: ['ngayDeXuat', 'receiveDate', 'ngayTiepNhan', 'deadline', 'sttSort'],
      fieldAliases: { stt: 'sttSort' },
    });

    const [data, total] = await Promise.all([
      this.prisma.case.findMany({
        where,
        select: {
          id: true,
          caseCode: true,
          name: true,
          // Tóm tắt nội dung — cột hệ cũ hiển thị trên danh sách, phủ 98% vụ án di trú
          // nhưng API danh sách chưa hề trả về, nên cán bộ phải mở từng hồ sơ mới biết.
          moTaChiTiet: true,
          sttCu: true,
          // Hai cột hệ cũ còn lại trên bảng Vụ án (đối chiếu ảnh 25/08/2026). Độ phủ thật:
          // `nguonDon` 89,9% (3.038/3.380); `ketQuaXuLyKhac` chỉ 6,6% (222/3.380) — hiện vì
          // hệ cũ có, và ảnh hệ cũ cũng đang trống ở cột ấy.
          nguonDon: true,
          ketQuaXuLyKhac: true,
          crime: true,
          crimeChinhId: true,
          crimeChinh: { select: { id: true, code: true, name: true } },
          status: true,
          deadline: true,
          unit: true,
        // Cột "Đơn vị giải quyết" của danh sách đọc trường này. Truy vấn dùng `select`
        // tường minh nên thiếu khai là cột luôn rỗng, không lỗi, không cảnh báo.
        donViGiaiQuyet: true,
        // Cột "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại" đọc trường này. Trước
        // 27/08/2026 nó đọc `name` — TÊN VỤ ÁN — nên cột đầy dữ liệu mà khớp bản gốc 0%.
        tenCungCap: true,
          subjectsCount: true,
          // Cột "Đối tượng bị can" của bảng Vụ án hệ cũ. Lấy tên bị can đã khởi tố
          // (SUSPECT) chứ không dùng ô văn bản `nghiVanDoiTuong` — ô ấy là nghi vấn ban
          // đầu, còn cột hệ cũ in danh sách bị can. Cắt ở LIST_SUSPECT_NAMES_LIMIT và
          // hiển thị phần dư bằng `subjectsCount` ở tầng giao diện.
          subjects: {
            select: { id: true, fullName: true },
            where: { type: SubjectType.SUSPECT, deletedAt: null },
            orderBy: { createdAt: 'asc' },
            take: LIST_SUSPECT_NAMES_LIMIT,
          },
          // TỔNG số bị can, đếm đúng cùng điều kiện với danh sách tên ở trên.
          // Không dùng cột `subjectsCount`: cột ấy do cán bộ tự nhập và đếm MỌI loại đối
          // tượng (cả bị hại, nhân chứng), nên lấy nó trừ đi số tên sẽ ra "+N" sai — vừa
          // hiện "+N" khi danh sách chưa hề bị cắt, vừa thiếu "+N" khi đã cắt.
          _count: {
            select: {
              subjects: { where: { type: SubjectType.SUSPECT, deletedAt: null } },
            },
          },
          ngayDeXuat: true, // ngày tiếp nhận — trường sắp mặc định, cần cho cột danh sách
          createdAt: true,
          updatedAt: true,
          caseType: true,
          donViGiao: true,
          soQuyetDinhUyThac: true,
          ngayTiepNhan: true,
          thoiHanUyThac: true,
          loaiUyThac: true,
          ketQuaUyThac: true,
          ngayTraKetQua: true,
          loaiThongTin: true,
          metadata: true,
          investigator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.case.count({ where }),
    ]);

    return {
      success: true,
      data: data.map((item) =>
        item.caseType === CaseType.UY_THAC_DIEU_TRA
          ? { ...item, trangThaiPhanHoi: computeTrangThaiPhanHoi(item) }
          : item,
      ),
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    };
  }

  // ─────────────────────────────────────────────
  // GET STATS (PR1/T15) — counts by status, scoped to non-status filters
  // ─────────────────────────────────────────────
  //
  // Used by <ListPageShell.StatusChips> countsSource. Returns object với:
  // - total: tổng cases match active filters (excluding status)
  // - byStatus: Record<CaseStatus, number> với mỗi CaseStatus key (0 nếu không có)
  //
  // Status filter purposely STRIPPED — counts reflect cardinality across ALL
  // statuses scoped to active non-status filters. UI consumer paint chip counts
  // và highlight active chip separately.
  async getStats(query: QueryCasesStatsDto, dataScope?: DataScope | null) {
    const {
      search,
      charges,
      investigatorId,
      unit,
      fromDate,
      toDate,
      overdue,
      districtId,
      wardId,
      wardTeamId,
      capDoToiPham,
      caseType,
      donViGiao,
      loaiUyThac,
      trangThaiPhanHoi,
      ngayTiepNhanFrom,
      ngayTiepNhanTo,
      investigatorName,
    } = query;

    const where: Prisma.CaseWhereInput = {
      deletedAt: null,
      caseType: caseType ?? CaseType.REGULAR,
    };

    // PHẢI áp cùng điều kiện với getList, nếu không số trên thẻ đếm mọi tội danh trong
    // khi danh sách chỉ có tội danh đang lọc → hai số lệch nhau.
    if (charges) {
      where.crime = { contains: charges, mode: 'insensitive' };
    }

    if (search) {
      const isUtdt = (caseType ?? CaseType.REGULAR) === CaseType.UY_THAC_DIEU_TRA;
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { crime: { contains: search, mode: 'insensitive' } },
        { unit: { contains: search, mode: 'insensitive' } },
        { caseCode: { contains: search, mode: 'insensitive' } },
        { soHoSoCu: { contains: search, mode: 'insensitive' } }, // truy nguyên: tìm theo STT hệ cũ
        { sttCu: { contains: search, mode: 'insensitive' } },
        ...(isUtdt
          ? [
              { donViGiao: { contains: search, mode: 'insensitive' as const } },
              { soQuyetDinhUyThac: { contains: search, mode: 'insensitive' as const } },
              { metadata: { path: ['nghiVanDoiTuong'], string_contains: search } },
            ]
          : []),
      ];
    }

    if (investigatorId) where.investigatorId = investigatorId;
    // Lọc theo ĐÚNG cột mà cột "Đơn vị giải quyết" đang hiện. `unit` là đơn vị TIẾP NHẬN
    // và rỗng ở toàn bộ 3.286 vụ án, nên lọc trên nó không bao giờ ra kết quả — cán bộ lọc
    // theo tổ sẽ tưởng tổ ấy không có hồ sơ nào. Giữ tên tham số `unit` để địa chỉ trang cũ
    // vẫn dùng được.
    if (unit) where.donViGiaiQuyet = { contains: unit, mode: 'insensitive' };

    // Kỳ thống kê: người dùng không tự đặt ngày thì áp mặc định admin cấu hình. Cùng một
    // hàm với thẻ số và badge menu nên ba chỗ không thể lệch nhau.
    //
    // ĐỔI CỘT LỌC: trước đây hai ô ngày của Vụ án lọc theo `createdAt`, khác hẳn Đơn thư
    // (`receivedDate`) và Vụ việc (`ngayDeXuat`). Hồ sơ di trú dồn chung MỘT ngày tạo nên
    // bộ lọc ấy gần như không lọc được gì. Nay theo `ngayDeXuat` như hai module kia; muốn
    // lọc theo ngày tạo thì chọn "Tính theo: Ngày tạo".
    const kyThongKe = await this.settings.getKyThongKe({ truong: query.thongKeTruongNgay });
    apDungKyVaoWhere(where as Record<string, unknown>, kyThongKe, fromDate, toDate, 'ngayDeXuat');

    if (overdue) {
      where.deadline = { lt: new Date() };
      // KHÔNG strip status notIn vì overdue logic exclude terminal states.
      // Counts vẫn group by status, nhưng terminal states sẽ là 0 trong response.
      where.status = {
        notIn: [CaseStatus.DA_KET_LUAN, CaseStatus.DA_LUU_TRU, CaseStatus.DINH_CHI],
      };
    }

    if (capDoToiPham) where.capDoToiPham = capDoToiPham;

    if (donViGiao) where.donViGiao = { contains: donViGiao, mode: 'insensitive' };
    if (loaiUyThac) where.loaiUyThac = loaiUyThac;
    if (trangThaiPhanHoi) {
      const stateFilter = buildTrangThaiFilter(trangThaiPhanHoi);
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        stateFilter,
      ];
    }

    // Guard date param không hợp lệ → bỏ qua filter (tránh Prisma 500 với Invalid Date từ input rác).
    const _from = ngayTiepNhanFrom ? new Date(ngayTiepNhanFrom) : null;
    if (_from && !Number.isNaN(_from.getTime())) {
      where.ngayTiepNhan = {
        ...(where.ngayTiepNhan as Prisma.DateTimeNullableFilter | undefined),
        gte: _from,
      };
    }
    const _to = ngayTiepNhanTo ? new Date(ngayTiepNhanTo + 'T23:59:59Z') : null;
    if (_to && !Number.isNaN(_to.getTime())) {
      where.ngayTiepNhan = {
        ...(where.ngayTiepNhan as Prisma.DateTimeNullableFilter | undefined),
        lte: _to,
      };
    }

    if (investigatorName) {
      where.investigator = {
        OR: [
          { firstName: { contains: investigatorName, mode: 'insensitive' } },
          { lastName: { contains: investigatorName, mode: 'insensitive' } },
        ],
      };
    }

    if (districtId || wardId) {
      where.subjects = {
        some: {
          deletedAt: null,
          ...(districtId && { districtId }),
          ...(wardId && { wardId }),
        },
      };
    }

    if (wardTeamId) {
      where.assignedTeam = { is: { wardId: wardTeamId } };
    }

    const scopeFilter = buildScopeFilter(dataScope);
    if (scopeFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        scopeFilter as Prisma.CaseWhereInput,
      ];
    }

    // Initialize all CaseStatus keys to 0 → exhaustive response shape
    const byStatus: Record<CaseStatus, number> = Object.values(CaseStatus).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<CaseStatus, number>,
    );

    // /codex review fix: derive `total` từ groupResults thay vì query thứ 2.
    // groupBy + count chạy trong 2 statement riêng với READ COMMITTED isolation
    // → snapshot khác nhau khi có concurrent create/delete/status change. "Tất
    // cả" chip count có thể disagree với sum chip counts trong cùng response.
    // Vì `total = SUM(byStatus[*])` theo định nghĩa endpoint, derive directly.
    const groupResults = await this.prisma.case.groupBy({
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
    return { total, byStatus, byGroup: countByGroup(CASE_STATUS_GROUPS, byStatus), ky: kyThongKe };
  }

  // ─────────────────────────────────────────────
  // GET UTDT STATS — F2 follow-up
  // ─────────────────────────────────────────────
  //
  // UTDT chip counts grouped by computed TrangThaiPhanHoi (4 states).
  // TrangThaiPhanHoi is NOT a stored column — it's derived from
  // ketQuaUyThac + ngayTraKetQua + thoiHanUyThac + metadata.lyDoKhongThucHienDuoc
  // (see computeTrangThaiPhanHoi above). Standard groupBy can't compute it,
  // so we run 4 parallel counts using buildTrangThaiFilter as the per-state
  // WHERE predicate. Total derived from sum (snapshot-consistent under READ
  // COMMITTED — same pattern as cases/incidents/petitions stats).
  //
  // Reuses QueryCasesStatsDto for filter pass-through (search, donViGiao,
  // loaiUyThac, ngayTiepNhanFrom/To, investigatorName, etc.) but ALWAYS
  // forces caseType=UY_THAC_DIEU_TRA and strips trangThaiPhanHoi (counts BY
  // state, not filtered by it).
  async getUtdtStats(query: QueryCasesStatsDto, dataScope?: DataScope | null) {
    const {
      search,
      investigatorId,
      donViGiao,
      loaiUyThac,
      ngayTiepNhanFrom,
      ngayTiepNhanTo,
      investigatorName,
    } = query;

    // Base where: UTDT records, not deleted. Apply non-state filters.
    const baseWhere: Prisma.CaseWhereInput = {
      deletedAt: null,
      caseType: CaseType.UY_THAC_DIEU_TRA,
    };

    if (search) {
      baseWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { crime: { contains: search, mode: 'insensitive' } },
        { unit: { contains: search, mode: 'insensitive' } },
        { donViGiao: { contains: search, mode: 'insensitive' } },
        { soQuyetDinhUyThac: { contains: search, mode: 'insensitive' } },
        { metadata: { path: ['nghiVanDoiTuong'], string_contains: search } },
      ];
    }
    if (investigatorId) baseWhere.investigatorId = investigatorId;
    if (donViGiao) baseWhere.donViGiao = { contains: donViGiao, mode: 'insensitive' };
    if (loaiUyThac) baseWhere.loaiUyThac = loaiUyThac;

    if (ngayTiepNhanFrom) {
      baseWhere.ngayTiepNhan = {
        ...(baseWhere.ngayTiepNhan as Prisma.DateTimeNullableFilter | undefined),
        gte: new Date(ngayTiepNhanFrom),
      };
    }
    if (ngayTiepNhanTo) {
      baseWhere.ngayTiepNhan = {
        ...(baseWhere.ngayTiepNhan as Prisma.DateTimeNullableFilter | undefined),
        lte: new Date(ngayTiepNhanTo + 'T23:59:59Z'),
      };
    }

    if (investigatorName) {
      baseWhere.investigator = {
        OR: [
          { firstName: { contains: investigatorName, mode: 'insensitive' } },
          { lastName: { contains: investigatorName, mode: 'insensitive' } },
        ],
      };
    }

    const scopeFilter = buildScopeFilter(dataScope);
    if (scopeFilter) {
      baseWhere.AND = [scopeFilter as Prisma.CaseWhereInput];
    }

    const states: TrangThaiPhanHoi[] = [
      'DA_PHAN_HOI',
      'KHONG_THUC_HIEN_DUOC',
      'QUA_HAN',
      'CHUA_PHAN_HOI',
    ];

    // 4 parallel counts, one per state. Each merges baseWhere with state-specific
    // filter via AND-array (avoid clobbering existing baseWhere.AND).
    const counts = await Promise.all(
      states.map((state) => {
        const stateFilter = buildTrangThaiFilter(state);
        const stateWhere: Prisma.CaseWhereInput = {
          ...baseWhere,
          AND: [
            ...(Array.isArray(baseWhere.AND) ? baseWhere.AND : baseWhere.AND ? [baseWhere.AND] : []),
            stateFilter,
          ],
        };
        return this.prisma.case.count({ where: stateWhere });
      }),
    );

    const byTrangThai: Record<TrangThaiPhanHoi, number> = {
      DA_PHAN_HOI: counts[0],
      KHONG_THUC_HIEN_DUOC: counts[1],
      QUA_HAN: counts[2],
      CHUA_PHAN_HOI: counts[3],
    };
    const total = counts.reduce((a, b) => a + b, 0);

    return { total, byTrangThai };
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
        statistic: true, // Thống kê mở rộng (case_statistics) — form load round-trip
        crimeChinh: { select: { id: true, code: true, name: true, articleNo: true } }, // tội danh chính FK
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

    // Find auto-created Incident linked via Incident.linkedCaseId (Branch 3).
    // Case.linkedIncidentId is NULL for Branch 3 due to case_provenance_fk_consistency constraint.
    // Apply DataScope filter so the Incident obeys the same access rules as the Case.
    const incidentScopeFilter = buildScopeFilter(dataScope);
    const autoLinkedIncident = await this.prisma.incident.findFirst({
      where: {
        linkedCaseId: id,
        deletedAt: null,
        ...(incidentScopeFilter ?? {}),
      },
      select: { id: true, code: true, name: true },
    });

    return { success: true, data: { ...record, autoLinkedIncident: autoLinkedIncident ?? null } };
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
  // PR 1 v0.38.0.0 — Atomic sub-entity creation helper
  // Fix bug data-loss wizard "Khởi tố vụ án mới":
  //   subjects[]/evidences[]/documentIds[] được create đồng bộ trong cùng transaction
  //   với Case. All-or-nothing — nếu 1 fail → toàn bộ rollback.
  //
  //   ┌─ POST /cases ─────────────────────────────────────────────┐
  //   │  prisma.$transaction(async (tx) => {                       │
  //   │    1. tx.case.create({ baseCaseData })                     │
  //   │    2. await createSubEntitiesInTransaction(tx, caseId, dto)│
  //   │       ├─ tx.subject.createMany(subjects)                   │
  //   │       ├─ tx.evidence.createMany(evidences)                 │
  //   │       └─ tx.document.updateMany(documentIds → caseId)      │
  //   │    3. return newCase                                       │
  //   │  })                                                         │
  //   └─────────────────────────────────────────────────────────────┘
  // ─────────────────────────────────────────────
  private async createSubEntitiesInTransaction(
    tx: Prisma.TransactionClient,
    caseId: string,
    dto: CreateCaseDto,
    actorId: string,
  ): Promise<{ subjectsCreated: number; evidencesCreated: number; documentsLinked: number }> {
    let subjectsCreated = 0;
    let evidencesCreated = 0;
    let documentsLinked = 0;

    // Subjects (Bị can / Bị hại / Nhân chứng)
    //
    // Ba ô ngày sinh / CCCD / địa chỉ là TUỲ CHỌN: lược đồ cho phép trống, hộp thoại thêm
    // đối tượng chỉ bắt buộc họ tên, và dữ liệu cũ nhiều nghi can chỉ có mỗi tên. Ép
    // `new Date(undefined)` ra `Invalid Date` và Prisma từ chối cả lần lưu.
    if (dto.subjects && dto.subjects.length > 0) {
      const subjectsData = dto.subjects.map((s) => ({
        fullName: s.fullName,
        dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth) : null,
        gender: s.gender ?? 'MALE',
        idNumber: s.idNumber,
        address: s.address,
        phone: s.phone,
        occupationId: s.occupationId,
        nationalityId: s.nationalityId,
        wardId: s.wardId,
        caseId,
        crimeId: s.crimeId,
        type: (s.type as SubjectType | undefined) ?? SubjectType.SUSPECT,
        notes: s.notes,
      }));
      const result = await tx.subject.createMany({ data: subjectsData });
      subjectsCreated = result.count;
    }

    // Evidences (Vật chứng) — model mới ở PR 1
    if (dto.evidences && dto.evidences.length > 0) {
      const evidencesData = dto.evidences.map((e) => ({
        code: e.code,
        name: e.name,
        description: e.description,
        quantity: e.quantity ?? 1,
        unit: e.unit ?? 'cái',
        storageLocation: e.storageLocation,
        receivedDate: e.receivedDate ? new Date(e.receivedDate) : undefined,
        status: e.status ?? 'THU_GIU',
        evidenceType: e.evidenceType,
        entryOrder: e.entryOrder,
        warehouseReceipt: e.warehouseReceipt,
        caseId,
        createdById: actorId,
      }));
      const result = await tx.evidence.createMany({ data: evidencesData });
      evidencesCreated = result.count;
    }

    // Documents — đã upload trước qua POST /documents, giờ link caseId
    if (dto.documentIds && dto.documentIds.length > 0) {
      const result = await tx.document.updateMany({
        where: {
          id: { in: dto.documentIds },
          caseId: null, // Chỉ link document chưa thuộc Case nào, tránh hijack
          deletedAt: null,
          uploadedById: actorId, // Chỉ link document do chính user upload (auth check)
        },
        data: { caseId },
      });
      documentsLinked = result.count;
      // Strict check: nếu count < requested → có document invalid → throw để rollback
      if (documentsLinked !== dto.documentIds.length) {
        throw new BadRequestException(
          `Chỉ link được ${documentsLinked}/${dto.documentIds.length} tài liệu. ` +
            `Một số document không tồn tại, đã thuộc Case khác, hoặc không phải bạn upload.`,
        );
      }
    }

    // Thống kê mở rộng (case_statistics) — tạo cùng transaction khi có dto.statistic
    if (dto.statistic !== undefined) {
      const statData = buildCaseStatisticData(dto.statistic);
      await tx.caseStatistic.upsert({
        where: { caseId },
        create: { caseId, ...statData },
        update: statData,
      });
    }

    return { subjectsCreated, evidencesCreated, documentsLinked };
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async create(
    dto: CreateCaseDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
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

    // v0.33.0.0: nếu user là ward officer → force-set assignedTeamId = ward team
    // (silent override khi dto.assignedTeamId mismatch — UX safer per D-eng-fix M3)
    const forcedTeamId = dataScope?.isWardOfficer ? dataScope.wardTeamId : null;
    const effectiveAssignedTeamId = forcedTeamId ?? dto.assignedTeamId;

    // v0.37.2 Deploy-2 (Contract) — compat shim removed. caseProvenance now required
    // by DTO validation + DB NOT NULL constraint. Legacy `metadata.petitionType`
    // payloads return 400 from DTO @IsEnum validation upstream of this method.
    const effectiveProvenance = dto.caseProvenance;
    const scrubbedMetadata = dto.metadata;
    if (!effectiveProvenance) {
      throw new BadRequestException(
        'caseProvenance is required (BLTTHS Đ.143). Pick a value: FROM_PETITION / FROM_INCIDENT / DIRECT_DISCOVERY / TRANSFERRED / OTHER_LEGAL_SOURCE.',
      );
    }

    // Common base case data shared across all branches (caseCode injected inside each tx)
    const baseCaseData = {
      name: dto.name,
      crime: dto.crime,
      crimeChinhId: dto.crimeChinhId,
      status: dto.status ?? CaseStatus.TIEP_NHAN,
      investigatorId: dto.investigatorId,
      createdById: actorId, // v0.31.0.2: creator track
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      unit: dto.unit,
      donViGiaiQuyet: dto.donViGiaiQuyet,
      ...(effectiveAssignedTeamId !== undefined && { assignedTeamId: effectiveAssignedTeamId }),
      subjectsCount: dto.subjectsCount ?? 0,
      ...(dto.capDoToiPham !== undefined && { capDoToiPham: dto.capDoToiPham }),
      ...(dto.ngayKhoiTo !== undefined && { ngayKhoiTo: dto.ngayKhoiTo ? new Date(dto.ngayKhoiTo) : null }),
      // ── Field-parity: số QĐ giai đoạn vụ án ──
      ...(dto.soQuyetDinhKhoiTo !== undefined && { soQuyetDinhKhoiTo: dto.soQuyetDinhKhoiTo }),
      ...(dto.soQDNhapVuAn !== undefined && { soQDNhapVuAn: dto.soQDNhapVuAn }),
      ...(dto.ngayNhapVuAn !== undefined && { ngayNhapVuAn: dto.ngayNhapVuAn ? new Date(dto.ngayNhapVuAn) : null }),
      ...(dto.ghiChuNhapHoSo !== undefined && { ghiChuNhapHoSo: dto.ghiChuNhapHoSo }),
      ...(dto.soQDTachVuAn !== undefined && { soQDTachVuAn: dto.soQDTachVuAn }),
      ...(dto.ngayTachVuAn !== undefined && { ngayTachVuAn: dto.ngayTachVuAn ? new Date(dto.ngayTachVuAn) : null }),
      ...(dto.soQDTachHanhVi !== undefined && { soQDTachHanhVi: dto.soQDTachHanhVi }),
      ...(dto.ngayTachHanhVi !== undefined && { ngayTachHanhVi: dto.ngayTachHanhVi ? new Date(dto.ngayTachHanhVi) : null }),
      ...(dto.soQDDinhChiVuAn !== undefined && { soQDDinhChiVuAn: dto.soQDDinhChiVuAn }),
      ...(dto.ngayDinhChiVuAn !== undefined && { ngayDinhChiVuAn: dto.ngayDinhChiVuAn ? new Date(dto.ngayDinhChiVuAn) : null }),
      ...(dto.chuyenVuAnChoCQK !== undefined && { chuyenVuAnChoCQK: dto.chuyenVuAnChoCQK }),
      ...(dto.soBanAnCoHieuLuc !== undefined && { soBanAnCoHieuLuc: dto.soBanAnCoHieuLuc }),
      ...(dto.ngayBanAnCoHieuLuc !== undefined && { ngayBanAnCoHieuLuc: dto.ngayBanAnCoHieuLuc ? new Date(dto.ngayBanAnCoHieuLuc) : null }),
      ...(dto.canCuTamDinhChiVuAn !== undefined && { canCuTamDinhChiVuAn: dto.canCuTamDinhChiVuAn }),
      ...(dto.canCuPhucHoiVuAn !== undefined && { canCuPhucHoiVuAn: dto.canCuPhucHoiVuAn }),
      // ── PR-3 — field tab "Vụ án TĐC" (persist khi CREATE; update có ở block ~1222) ──
      ...(dto.soQuyetDinhTamDinhChi !== undefined && { soQuyetDinhTamDinhChi: dto.soQuyetDinhTamDinhChi }),
      ...(dto.ngayTamDinhChi !== undefined && { ngayTamDinhChi: dto.ngayTamDinhChi ? new Date(dto.ngayTamDinhChi) : null }),
      ...(dto.lyDoTamDinhChiVuAn !== undefined && { lyDoTamDinhChiVuAn: dto.lyDoTamDinhChiVuAn }),
      ...(dto.ngayHetThoiHieu !== undefined && { ngayHetThoiHieu: dto.ngayHetThoiHieu ? new Date(dto.ngayHetThoiHieu) : null }),
      ...(dto.soQuyetDinhPhucHoi !== undefined && { soQuyetDinhPhucHoi: dto.soQuyetDinhPhucHoi }),
      ...(dto.ngayPhucHoi !== undefined && { ngayPhucHoi: dto.ngayPhucHoi ? new Date(dto.ngayPhucHoi) : null }),
      ...(dto.tdcKhacPhucLyDoBienPhap !== undefined && { tdcKhacPhucLyDoBienPhap: dto.tdcKhacPhucLyDoBienPhap }),
      ...(dto.tdcKhacPhucBienBan !== undefined && { tdcKhacPhucBienBan: dto.tdcKhacPhucBienBan }),
      // ── Field-parity KLĐT + QĐ điều tra lại (PR-M2: trước đây RỚT ở create — update có) ──
      ...(dto.soKLDT !== undefined && { soKLDT: dto.soKLDT }),
      ...(dto.ngayKLDT !== undefined && { ngayKLDT: dto.ngayKLDT ? new Date(dto.ngayKLDT) : null }),
      ...(dto.soQDDieuTraLai !== undefined && { soQDDieuTraLai: dto.soQDDieuTraLai }),
      ...(dto.ngayQDDieuTraLai !== undefined && { ngayQDDieuTraLai: dto.ngayQDDieuTraLai ? new Date(dto.ngayQDDieuTraLai) : null }),
      // ── PR-M2: ghi chú tự do + tội danh khác (multi) ──
      ...(dto.ghiChuKhac !== undefined && { ghiChuKhac: dto.ghiChuKhac }),
      ...(dto.toiDanhKhacIds !== undefined && { toiDanhKhacIds: dto.toiDanhKhacIds }),
      ...(scrubbedMetadata !== undefined && { metadata: scrubbedMetadata as JsonInput }),
      caseProvenance: effectiveProvenance, // v0.37.2: required (Contract phase enforces non-null)
      ...(dto.sourceDocumentNote !== undefined && { sourceDocumentNote: dto.sourceDocumentNote }),
      // v0.44 — UTDT fields
      ...(dto.caseType !== undefined && { caseType: dto.caseType }),
      ...(dto.donViGiao !== undefined && { donViGiao: dto.donViGiao }),
      ...(dto.soQuyetDinhUyThac !== undefined && { soQuyetDinhUyThac: dto.soQuyetDinhUyThac }),
      ...(dto.ngayTiepNhan !== undefined && { ngayTiepNhan: dto.ngayTiepNhan ? new Date(dto.ngayTiepNhan) : null }),
      ...(dto.thoiHanUyThac !== undefined && { thoiHanUyThac: dto.thoiHanUyThac ? new Date(dto.thoiHanUyThac) : null }),
      ...(dto.loaiUyThac !== undefined && { loaiUyThac: dto.loaiUyThac }),
      ...(dto.ketQuaUyThac !== undefined && { ketQuaUyThac: dto.ketQuaUyThac }),
      ...(dto.ngayTraKetQua !== undefined && { ngayTraKetQua: dto.ngayTraKetQua ? new Date(dto.ngayTraKetQua) : null }),
      ...(dto.loaiThongTin !== undefined && { loaiThongTin: dto.loaiThongTin }),
      // ── Field-parity intake hệ cũ → cột typed (P1: trước đây RỚT ở CREATE — chỉ UPDATE có) ──
      ...(dto.ngayDeXuat !== undefined && { ngayDeXuat: dto.ngayDeXuat ? new Date(dto.ngayDeXuat) : null }),
      ...(dto.moTaChiTiet !== undefined && { moTaChiTiet: dto.moTaChiTiet }),
      ...(dto.nguonDon !== undefined && { nguonDon: dto.nguonDon }),
      ...(dto.tenCungCap !== undefined && { tenCungCap: dto.tenCungCap }),
      ...(dto.sinhNamCungCap !== undefined && { sinhNamCungCap: dto.sinhNamCungCap }),
      ...(dto.cccdCungCap !== undefined && { cccdCungCap: dto.cccdCungCap }),
      ...(dto.ngayCapCccd !== undefined && { ngayCapCccd: dto.ngayCapCccd ? new Date(dto.ngayCapCccd) : null }),
      ...(dto.noiCapCccd !== undefined && { noiCapCccd: dto.noiCapCccd }),
      ...(dto.sdtCungCap !== undefined && { sdtCungCap: dto.sdtCungCap }),
      ...(dto.diaChiCungCap !== undefined && { diaChiCungCap: dto.diaChiCungCap }),
      ...(dto.nghiVanDoiTuong !== undefined && { nghiVanDoiTuong: dto.nghiVanDoiTuong }),
      ...(dto.nhanXet !== undefined && { nhanXet: dto.nhanXet }),
      ...(dto.noiXayRa !== undefined && { noiXayRa: dto.noiXayRa }),
      ...(dto.phuongThucThuDoan !== undefined && { phuongThucThuDoan: dto.phuongThucThuDoan }),
      ...(dto.ketQuaXuLyKhac !== undefined && { ketQuaXuLyKhac: dto.ketQuaXuLyKhac }),
      ...(dto.soPhieuChuyen !== undefined && { soPhieuChuyen: dto.soPhieuChuyen }),
      ...(dto.ngayPhieuChuyen !== undefined && { ngayPhieuChuyen: dto.ngayPhieuChuyen ? new Date(dto.ngayPhieuChuyen) : null }),
      ...(dto.doVatTaiLieuKemTheo !== undefined && { doVatTaiLieuKemTheo: dto.doVatTaiLieuKemTheo }),
      ...(dto.ngayVietDon !== undefined && { ngayVietDon: dto.ngayVietDon ? new Date(dto.ngayVietDon) : null }),
      ...(dto.ghiChuTrungDon !== undefined && { ghiChuTrungDon: dto.ghiChuTrungDon }),
      ...(dto.baoCaoBanGiamDoc !== undefined && { baoCaoBanGiamDoc: dto.baoCaoBanGiamDoc }),
      ...(dto.ngayGiaoDonViGiaiQuyet !== undefined && { ngayGiaoDonViGiaiQuyet: dto.ngayGiaoDonViGiaiQuyet ? new Date(dto.ngayGiaoDonViGiaiQuyet) : null }),
      ...(dto.lanhDaoToTung !== undefined && { lanhDaoToTung: dto.lanhDaoToTung }),
      ...(dto.dieuTraVien !== undefined && { dieuTraVien: dto.dieuTraVien }),
      ...(dto.phanLoaiToiPhamLinhVuc !== undefined && { phanLoaiToiPhamLinhVuc: dto.phanLoaiToiPhamLinhVuc }),
      ...(dto.phanLoaiHoSoNoiBo !== undefined && { phanLoaiHoSoNoiBo: dto.phanLoaiHoSoNoiBo }),
      ...(dto.deXuat !== undefined && { deXuat: dto.deXuat }),
      ...(dto.yeuCauBoSung !== undefined && { yeuCauBoSung: dto.yeuCauBoSung }),
      // ── Consolidate epic: native metadata → cột typed (plan A0 loại N) ──
      ...(dto.reporterDateOfBirth !== undefined && { reporterDateOfBirth: dto.reporterDateOfBirth ? new Date(dto.reporterDateOfBirth) : null }),
      ...(dto.reporterDateOfBirthPrecision !== undefined && { reporterDateOfBirthPrecision: dto.reporterDateOfBirthPrecision }),
      ...(dto.receiveDate !== undefined && { receiveDate: dto.receiveDate ? new Date(dto.receiveDate) : null }),
      ...(dto.caseClassification !== undefined && { caseClassification: dto.caseClassification }),
      ...(dto.tinhTrang !== undefined && { tinhTrang: dto.tinhTrang }),
      ...(dto.toiDanhBanDau !== undefined && { toiDanhBanDau: dto.toiDanhBanDau }),
      // Ô hệ cũ đưa về đúng vị trí trên form (26/08/2026) — dùng chung hàm ánh xạ với
      // nhánh chỉnh sửa để hai đường không thể lệch nhau.
      ...legacyFormParityData(dto as unknown as Record<string, unknown>),
    };

    const caseInclude = {
      investigator: {
        select: { id: true, firstName: true, lastName: true, username: true },
      },
    };

    // ── FROM_PETITION: link existing Petition (IDOR-safe + optimistic lock) ──
    if (effectiveProvenance === CaseProvenance.FROM_PETITION) {
      // Build scope filter for Petition (DataScope): same OR conditions as petitions.service checkWriteScope
      const petitionScopeOR: Prisma.PetitionWhereInput[] = [];
      if (dataScope && !dataScope.canDispatch) {
        if (dataScope.userIds.length > 0) {
          petitionScopeOR.push({ enteredById: { in: dataScope.userIds } });
        }
        if (dataScope.writableTeamIds.length > 0) {
          petitionScopeOR.push({ assignedTeamId: { in: dataScope.writableTeamIds } });
          if (!dataScope.isWardOfficer) {
            petitionScopeOR.push({ assignedTeamId: null });
          }
        }
      }

      const caseRecord = await this.prisma.$transaction(async (tx) => {
        const { number: caseCode, logId: caseCodeLogId } = await this.docNums.commitWithTx('CASE', { userId: actorId }, tx);

        const petition = await tx.petition.findFirst({
          where: {
            id: dto.linkedPetitionId!,
            deletedAt: null,
            ...(petitionScopeOR.length > 0 ? { OR: petitionScopeOR } : {}),
          },
        });
        if (!petition) {
          // Consistent 404 — no enumeration leak (not-found vs out-of-scope indistinguishable)
          throw new NotFoundException('Đơn thư không tồn tại hoặc không nằm trong phạm vi của bạn');
        }
        if (petition.linkedCaseId) {
          // Đơn thư trong phạm vi nhưng đã liên kết vụ án khác → 409 (rõ nghĩa hơn 404)
          throw new ConflictException('Đơn thư đã được liên kết với vụ án khác');
        }

        const newCase = await tx.case.create({
          data: { ...baseCaseData, caseCode, linkedPetitionId: petition.id },
          include: caseInclude,
        });

        await tx.documentNumberLog.update({ where: { id: caseCodeLogId }, data: { documentId: newCase.id } });

        // PR 1 v0.38.0.0: atomic create sub-entities trong cùng transaction
        await this.createSubEntitiesInTransaction(tx, newCase.id, dto, actorId);

        // Atomic state check via WHERE updatedAt + linkedCaseId=null
        try {
          await tx.petition.update({
            where: {
              id: petition.id,
              updatedAt: new Date(dto.expectedPetitionUpdatedAt!),
            },
            data: {
              linkedCaseId: newCase.id,
              status: PetitionStatus.DA_CHUYEN_VU_AN,
            },
          });
        } catch (e) {
          const code = (e as { code?: string })?.code;
          if (code === 'P2025' || code === 'P2002') {
            throw new ConflictException(
              'Đơn thư đã được chỉnh sửa hoặc link bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
            );
          }
          throw e;
        }

        return newCase;
      });

      await this.audit.log({
        userId: actorId,
        action: 'CASE_CREATED',
        subject: 'Case',
        subjectId: caseRecord.id,
        metadata: { name: caseRecord.name, status: caseRecord.status, caseProvenance: effectiveProvenance, linkedPetitionId: dto.linkedPetitionId },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      this.eventEmitter.emit('case.created', new CaseCreatedEvent(caseRecord.id, caseRecord.caseCode ?? '', actorId));
      return { success: true, data: caseRecord, message: 'Tạo vụ án thành công' };
    }

    // ── FROM_INCIDENT: link existing Incident (IDOR-safe + optimistic lock) ──
    if (effectiveProvenance === CaseProvenance.FROM_INCIDENT) {
      const incidentScopeOR: Prisma.IncidentWhereInput[] = [];
      if (dataScope && !dataScope.canDispatch) {
        if (dataScope.userIds.length > 0) {
          incidentScopeOR.push({ investigatorId: { in: dataScope.userIds } });
        }
        if (dataScope.writableTeamIds.length > 0) {
          incidentScopeOR.push({ assignedTeamId: { in: dataScope.writableTeamIds } });
          if (!dataScope.isWardOfficer) {
            incidentScopeOR.push({ assignedTeamId: null });
          }
        }
      }

      const caseRecord = await this.prisma.$transaction(async (tx) => {
        const { number: caseCode, logId: caseCodeLogId } = await this.docNums.commitWithTx('CASE', { userId: actorId }, tx);

        const incident = await tx.incident.findFirst({
          where: {
            id: dto.linkedIncidentId!,
            deletedAt: null,
            linkedCaseId: null,
            ...(incidentScopeOR.length > 0 ? { OR: incidentScopeOR } : {}),
          },
        });
        if (!incident) {
          throw new NotFoundException('Vụ việc không tồn tại hoặc không nằm trong phạm vi của bạn');
        }

        const newCase = await tx.case.create({
          data: { ...baseCaseData, caseCode, linkedIncidentId: incident.id },
          include: caseInclude,
        });

        await tx.documentNumberLog.update({ where: { id: caseCodeLogId }, data: { documentId: newCase.id } });

        // PR 1 v0.38.0.0: atomic create sub-entities trong cùng transaction
        await this.createSubEntitiesInTransaction(tx, newCase.id, dto, actorId);

        try {
          await tx.incident.update({
            where: {
              id: incident.id,
              updatedAt: new Date(dto.expectedIncidentUpdatedAt!),
            },
            data: { linkedCaseId: newCase.id },
          });
        } catch (e) {
          const code = (e as { code?: string })?.code;
          if (code === 'P2025' || code === 'P2002') {
            throw new ConflictException(
              'Vụ việc đã được chỉnh sửa hoặc link bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
            );
          }
          throw e;
        }

        return newCase;
      });

      await this.audit.log({
        userId: actorId,
        action: 'CASE_CREATED',
        subject: 'Case',
        subjectId: caseRecord.id,
        metadata: { name: caseRecord.name, status: caseRecord.status, caseProvenance: effectiveProvenance, linkedIncidentId: dto.linkedIncidentId },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      this.eventEmitter.emit('case.created', new CaseCreatedEvent(caseRecord.id, caseRecord.caseCode ?? '', actorId));
      return { success: true, data: caseRecord, message: 'Tạo vụ án thành công' };
    }

    // ── DIRECT_DISCOVERY / TRANSFERRED / OTHER_LEGAL_SOURCE ──
    // v0.40: Branch 3 now wrapped in $transaction (atomic). Auto-creates Incident
    // when Tab Vụ việc has incidentDate/incidentType/incidentDescription/incidentLocation.
    // CRITICAL: Do NOT set baseCaseData.linkedIncidentId — violates case_provenance_fk_consistency.
    // Link is stored one-way: Incident.linkedCaseId = caseRecord.id (set after Case creation).
    // NOTE: audit log fires outside the transaction (post-commit side-effect). This is intentional:
    // the incident exists at that point, so the audit is accurate even if the process crashes here.
    const needsAutoIncident =
      shouldAutoCreateIncident(effectiveProvenance, (dto.metadata ?? {}) as Record<string, unknown>);

    let autoIncidentId: string | null = null;
    let autoIncidentCode: string | null = null;
    let autoIncidentName: string | null = null;
    let record!: Awaited<ReturnType<typeof this.prisma.case.create>>;
    try {
      record = await this.prisma.$transaction(async (tx: any) => {
        // MỘT bộ đếm cho MỘT không gian mã. `cases.caseCode` là @unique trên toàn bảng, nên
        // vụ án và ủy thác dùng chung không gian mã; cấp số từ hai bộ đếm độc lập vào đó là
        // sai về cấu trúc — trước đây chỉ chưa vỡ vì tiền tố `VA-`/`UTDT-` làm hai chuỗi
        // khác nhau. Nay mã thống nhất `năm-stt` (khớp hệ cũ, và 1.611/1.632 hồ sơ ủy thác
        // đã mang dạng ấy) nên tiền tố không còn che được nữa. Đây là ĐẢO quyết định v0.68.
        const { number: caseCode, logId: caseCodeLogId } = await this.docNums.commitWithTx('CASE', { userId: actorId }, tx);

        let incidentLogId: string | null = null;
        if (needsAutoIncident) {
          const { number: incCode, logId: incLogId } = await this.docNums.commitWithTx('INCIDENT', { userId: actorId }, tx);
          incidentLogId = incLogId;
          const incData = buildIncidentFromCase({
            rawName: dto.name,
            meta: (dto.metadata ?? {}) as Record<string, unknown>,
            code: incCode,
            userId: actorId,
            investigatorId: actorId,
            assignedTeamId: dto.assignedTeamId ?? undefined,
          });
          const newInc = await tx.incident.create({ data: incData });
          autoIncidentId = newInc.id;
          autoIncidentCode = incCode;
          autoIncidentName = newInc.name;
          await tx.documentNumberLog.update({ where: { id: incidentLogId }, data: { documentId: newInc.id } });
        }
        const caseRecord = await tx.case.create({ data: { ...baseCaseData, caseCode }, include: caseInclude });
        await tx.documentNumberLog.update({ where: { id: caseCodeLogId }, data: { documentId: caseRecord.id } });
        await this.createSubEntitiesInTransaction(tx, caseRecord.id, dto, actorId);
        if (autoIncidentId) {
          await tx.incident.update({
            where: { id: autoIncidentId },
            data: { linkedCaseId: caseRecord.id },
          });
        }
        return caseRecord;
      });
    } catch (e: any) {
      // P2002 = unique constraint: trùng mã vụ việc (concurrent) HOẶC số quyết định ủy thác (Mẫu 58)
      if (e?.code === 'P2002') throw new ConflictException('Trùng mã vụ việc hoặc số quyết định ủy thác');
      throw e;
    }

    if (autoIncidentId) {
      await this.audit.log({
        userId: actorId,
        action: 'INCIDENT_AUTO_CREATED',
        subject: 'Incident',
        subjectId: autoIncidentId,
        metadata: { triggeredByCaseId: record.id, caseName: record.name },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
    }

    await this.audit.log({
      userId: actorId,
      action: 'CASE_CREATED',
      subject: 'Case',
      subjectId: record.id,
      metadata: { name: record.name, status: record.status, caseProvenance: effectiveProvenance },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    this.eventEmitter.emit('case.created', new CaseCreatedEvent(record.id, (record as any).caseCode ?? '', actorId));

    const autoLinkedIncident = autoIncidentId
      ? { id: autoIncidentId, code: autoIncidentCode ?? '', name: autoIncidentName ?? dto.name }
      : null;
    return { success: true, data: { ...record, autoLinkedIncident }, message: 'Tạo vụ án thành công' };
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
      const lyDo = (dto as UpdateCaseDto & { lyDoTamDinhChiVuAn?: LyDoTamDinhChiVuAn[] }).lyDoTamDinhChiVuAn;
      if (!lyDo || lyDo.length === 0) {
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
      ...(dto.crimeChinhId !== undefined && { crimeChinhId: dto.crimeChinhId || null }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.investigatorId !== undefined && { investigatorId: dto.investigatorId }),
      ...(dto.deadline !== undefined && {
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      }),
      ...(dto.unit !== undefined && { unit: dto.unit }),
      // Sửa hồ sơ cũng phải ghi được ô "Đơn vị giải quyết". Thiếu dòng này thì cán bộ sửa,
      // bấm Lưu, thấy báo thành công — và giá trị cũ vẫn nguyên.
      ...(dto.donViGiaiQuyet !== undefined && { donViGiaiQuyet: dto.donViGiaiQuyet }),
      ...(dto.subjectsCount !== undefined && { subjectsCount: dto.subjectsCount }),
      // MERGE (không REPLACE): giữ mọi field metadata cũ (di trú) + ghi đè field được sửa
      // → sửa 1 field KHÔNG bao giờ xóa field khác (an toàn data pháp lý).
      ...(dto.metadata !== undefined && {
        metadata: {
          ...((existing.metadata as Record<string, unknown> | null) ?? {}),
          ...(dto.metadata as Record<string, unknown>),
        } as JsonInput,
      }),
      ...(dto.capDoToiPham !== undefined && { capDoToiPham: dto.capDoToiPham }),
      ...(dto.ngayKhoiTo !== undefined && {
        ngayKhoiTo: dto.ngayKhoiTo ? new Date(dto.ngayKhoiTo) : null,
      }),
      // ── Field-parity: số QĐ giai đoạn vụ án ──
      ...(dto.soQuyetDinhKhoiTo !== undefined && { soQuyetDinhKhoiTo: dto.soQuyetDinhKhoiTo }),
      ...(dto.soQDNhapVuAn !== undefined && { soQDNhapVuAn: dto.soQDNhapVuAn }),
      ...(dto.ngayNhapVuAn !== undefined && { ngayNhapVuAn: dto.ngayNhapVuAn ? new Date(dto.ngayNhapVuAn) : null }),
      ...(dto.ghiChuNhapHoSo !== undefined && { ghiChuNhapHoSo: dto.ghiChuNhapHoSo }),
      ...(dto.soQDTachVuAn !== undefined && { soQDTachVuAn: dto.soQDTachVuAn }),
      ...(dto.ngayTachVuAn !== undefined && { ngayTachVuAn: dto.ngayTachVuAn ? new Date(dto.ngayTachVuAn) : null }),
      ...(dto.soQDTachHanhVi !== undefined && { soQDTachHanhVi: dto.soQDTachHanhVi }),
      ...(dto.ngayTachHanhVi !== undefined && { ngayTachHanhVi: dto.ngayTachHanhVi ? new Date(dto.ngayTachHanhVi) : null }),
      ...(dto.soQDDinhChiVuAn !== undefined && { soQDDinhChiVuAn: dto.soQDDinhChiVuAn }),
      ...(dto.ngayDinhChiVuAn !== undefined && { ngayDinhChiVuAn: dto.ngayDinhChiVuAn ? new Date(dto.ngayDinhChiVuAn) : null }),
      ...(dto.chuyenVuAnChoCQK !== undefined && { chuyenVuAnChoCQK: dto.chuyenVuAnChoCQK }),
      ...(dto.soBanAnCoHieuLuc !== undefined && { soBanAnCoHieuLuc: dto.soBanAnCoHieuLuc }),
      ...(dto.ngayBanAnCoHieuLuc !== undefined && { ngayBanAnCoHieuLuc: dto.ngayBanAnCoHieuLuc ? new Date(dto.ngayBanAnCoHieuLuc) : null }),
      ...(dto.canCuTamDinhChiVuAn !== undefined && { canCuTamDinhChiVuAn: dto.canCuTamDinhChiVuAn }),
      ...(dto.canCuPhucHoiVuAn !== undefined && { canCuPhucHoiVuAn: dto.canCuPhucHoiVuAn }),
      // ── Field-parity KLĐT + QĐ điều tra lại ──
      ...(dto.soKLDT !== undefined && { soKLDT: dto.soKLDT }),
      ...(dto.ngayKLDT !== undefined && { ngayKLDT: dto.ngayKLDT ? new Date(dto.ngayKLDT) : null }),
      ...(dto.soQDDieuTraLai !== undefined && { soQDDieuTraLai: dto.soQDDieuTraLai }),
      ...(dto.ngayQDDieuTraLai !== undefined && { ngayQDDieuTraLai: dto.ngayQDDieuTraLai ? new Date(dto.ngayQDDieuTraLai) : null }),
      // ── PR-M2: ghi chú tự do + tội danh khác (multi) ──
      ...(dto.ghiChuKhac !== undefined && { ghiChuKhac: dto.ghiChuKhac }),
      ...(dto.toiDanhKhacIds !== undefined && { toiDanhKhacIds: dto.toiDanhKhacIds }),
      // ── TĐC fields ──────────────────────────────────────────────────────────
      ...((dto as Record<string, unknown>).lyDoTamDinhChiVuAn !== undefined && {
        lyDoTamDinhChiVuAn: (dto as Record<string, unknown>).lyDoTamDinhChiVuAn as LyDoTamDinhChiVuAn[],
      }),
      ...((dto as Record<string, unknown>).soQuyetDinhTamDinhChi !== undefined && {
        soQuyetDinhTamDinhChi: (dto as Record<string, unknown>).soQuyetDinhTamDinhChi as string | null,
      }),
      ...((dto as Record<string, unknown>).ngayTamDinhChi !== undefined && {
        ngayTamDinhChi: (dto as Record<string, unknown>).ngayTamDinhChi
          ? new Date((dto as Record<string, unknown>).ngayTamDinhChi as string)
          : null,
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
      // Field-parity tab "Vụ án TĐC" — persist khi EDIT (trước service chưa spread → không lưu được).
      ...((dto as Record<string, unknown>).ngayHetThoiHieu !== undefined && {
        ngayHetThoiHieu: (dto as Record<string, unknown>).ngayHetThoiHieu
          ? new Date((dto as Record<string, unknown>).ngayHetThoiHieu as string)
          : null,
      }),
      ...((dto as Record<string, unknown>).tdcKhacPhucLyDoBienPhap !== undefined && {
        tdcKhacPhucLyDoBienPhap: (dto as Record<string, unknown>).tdcKhacPhucLyDoBienPhap as string | null,
      }),
      ...((dto as Record<string, unknown>).tdcKhacPhucBienBan !== undefined && {
        tdcKhacPhucBienBan: (dto as Record<string, unknown>).tdcKhacPhucBienBan as string | null,
      }),
      // v0.44.2 — UTDT top-level fields (persist through edit mode)
      ...(dto.caseType !== undefined && { caseType: dto.caseType }),
      ...(dto.donViGiao !== undefined && { donViGiao: dto.donViGiao }),
      ...(dto.soQuyetDinhUyThac !== undefined && { soQuyetDinhUyThac: dto.soQuyetDinhUyThac }),
      ...(dto.ngayTiepNhan !== undefined && {
        ngayTiepNhan: dto.ngayTiepNhan ? new Date(dto.ngayTiepNhan) : null,
      }),
      ...(dto.thoiHanUyThac !== undefined && {
        thoiHanUyThac: dto.thoiHanUyThac ? new Date(dto.thoiHanUyThac) : null,
      }),
      ...(dto.loaiUyThac !== undefined && { loaiUyThac: dto.loaiUyThac }),
      ...(dto.ketQuaUyThac !== undefined && { ketQuaUyThac: dto.ketQuaUyThac }),
      ...(dto.ngayTraKetQua !== undefined && {
        ngayTraKetQua: dto.ngayTraKetQua ? new Date(dto.ngayTraKetQua) : null,
      }),
      ...(dto.loaiThongTin !== undefined && { loaiThongTin: dto.loaiThongTin }),
      // ── Field-parity ĐẦY ĐỦ (feat/legacy-field-parity): field intake hệ cũ → cột typed ──
      ...(dto.ngayDeXuat !== undefined && { ngayDeXuat: dto.ngayDeXuat ? new Date(dto.ngayDeXuat) : null }),
      ...(dto.moTaChiTiet !== undefined && { moTaChiTiet: dto.moTaChiTiet }),
      ...(dto.nguonDon !== undefined && { nguonDon: dto.nguonDon }),
      ...(dto.tenCungCap !== undefined && { tenCungCap: dto.tenCungCap }),
      ...(dto.sinhNamCungCap !== undefined && { sinhNamCungCap: dto.sinhNamCungCap }),
      ...(dto.cccdCungCap !== undefined && { cccdCungCap: dto.cccdCungCap }),
      ...(dto.ngayCapCccd !== undefined && { ngayCapCccd: dto.ngayCapCccd ? new Date(dto.ngayCapCccd) : null }),
      ...(dto.noiCapCccd !== undefined && { noiCapCccd: dto.noiCapCccd }),
      ...(dto.sdtCungCap !== undefined && { sdtCungCap: dto.sdtCungCap }),
      ...(dto.diaChiCungCap !== undefined && { diaChiCungCap: dto.diaChiCungCap }),
      ...(dto.nghiVanDoiTuong !== undefined && { nghiVanDoiTuong: dto.nghiVanDoiTuong }),
      ...(dto.nhanXet !== undefined && { nhanXet: dto.nhanXet }),
      ...(dto.noiXayRa !== undefined && { noiXayRa: dto.noiXayRa }),
      ...(dto.phuongThucThuDoan !== undefined && { phuongThucThuDoan: dto.phuongThucThuDoan }),
      ...(dto.ketQuaXuLyKhac !== undefined && { ketQuaXuLyKhac: dto.ketQuaXuLyKhac }),
      ...(dto.soPhieuChuyen !== undefined && { soPhieuChuyen: dto.soPhieuChuyen }),
      ...(dto.ngayPhieuChuyen !== undefined && { ngayPhieuChuyen: dto.ngayPhieuChuyen ? new Date(dto.ngayPhieuChuyen) : null }),
      ...(dto.doVatTaiLieuKemTheo !== undefined && { doVatTaiLieuKemTheo: dto.doVatTaiLieuKemTheo }),
      ...(dto.ngayVietDon !== undefined && { ngayVietDon: dto.ngayVietDon ? new Date(dto.ngayVietDon) : null }),
      ...(dto.ghiChuTrungDon !== undefined && { ghiChuTrungDon: dto.ghiChuTrungDon }),
      ...(dto.baoCaoBanGiamDoc !== undefined && { baoCaoBanGiamDoc: dto.baoCaoBanGiamDoc }),
      ...(dto.ngayGiaoDonViGiaiQuyet !== undefined && { ngayGiaoDonViGiaiQuyet: dto.ngayGiaoDonViGiaiQuyet ? new Date(dto.ngayGiaoDonViGiaiQuyet) : null }),
      ...(dto.lanhDaoToTung !== undefined && { lanhDaoToTung: dto.lanhDaoToTung }),
      ...(dto.dieuTraVien !== undefined && { dieuTraVien: dto.dieuTraVien }),
      ...(dto.phanLoaiToiPhamLinhVuc !== undefined && { phanLoaiToiPhamLinhVuc: dto.phanLoaiToiPhamLinhVuc }),
      ...(dto.phanLoaiHoSoNoiBo !== undefined && { phanLoaiHoSoNoiBo: dto.phanLoaiHoSoNoiBo }),
      ...(dto.deXuat !== undefined && { deXuat: dto.deXuat }),
      ...(dto.yeuCauBoSung !== undefined && { yeuCauBoSung: dto.yeuCauBoSung }),
      // ── Consolidate epic: native metadata → cột typed (plan A0 loại N) ──
      ...((dto as Record<string, unknown>).reporterDateOfBirth !== undefined && {
        reporterDateOfBirth: (dto as Record<string, unknown>).reporterDateOfBirth
          ? new Date((dto as Record<string, unknown>).reporterDateOfBirth as string)
          : null,
      }),
      ...((dto as Record<string, unknown>).reporterDateOfBirthPrecision !== undefined && {
        reporterDateOfBirthPrecision: (dto as Record<string, unknown>).reporterDateOfBirthPrecision as string | null,
      }),
      ...((dto as Record<string, unknown>).receiveDate !== undefined && {
        receiveDate: (dto as Record<string, unknown>).receiveDate
          ? new Date((dto as Record<string, unknown>).receiveDate as string)
          : null,
      }),
      ...((dto as Record<string, unknown>).caseClassification !== undefined && {
        caseClassification: (dto as Record<string, unknown>).caseClassification as string | null,
      }),
      ...((dto as Record<string, unknown>).tinhTrang !== undefined && {
        tinhTrang: (dto as Record<string, unknown>).tinhTrang as string | null,
      }),
      ...((dto as Record<string, unknown>).toiDanhBanDau !== undefined && {
        toiDanhBanDau: (dto as Record<string, unknown>).toiDanhBanDau as string | null,
      }),
      // Ô hệ cũ đưa về đúng vị trí trên form (26/08/2026) — cùng hàm ánh xạ với nhánh tạo
      // mới, nên tạo được thì sửa cũng được.
      ...legacyFormParityData(dto as unknown as Record<string, unknown>),
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

    // Thống kê mở rộng (hybrid) — upsert bảng case_statistics khi có dto.statistic.
    if (dto.statistic !== undefined) {
      const statData = buildCaseStatisticData(dto.statistic);
      await this.prisma.caseStatistic.upsert({
        where: { caseId: id },
        create: { caseId: id, ...statData },
        update: statData,
      });
    }

    // v0.37.2.5: Sync petitionType with EXISTING linked Petition only.
    // Phantom Petition auto-create REMOVED (BLTTHS Đ.143 compliance — provenance
    // model in v0.37.1 forbids creating Petition records as a side-effect of
    // Case mutations). If a caller sends metadata.petitionType but no Petition
    // is linked, the value is silently ignored.
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
      }
      // else: silently ignore — no phantom Petition created.
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
    // linkedIncidents: SetNull on delete (not a blocker — v0.43)

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
        // v0.43: SetNull Incidents linked to this Case (Branch-3: Incident.linkedCaseId)
        // Must run BEFORE in-tx re-check so counts don't interfere.
        await tx.incident.updateMany({
          where: { linkedCaseId: id, deletedAt: null },
          data: { linkedCaseId: null },
        });
        // v0.43: Clear Case.linkedIncidentId if Case was created from an Incident (Branch-2)
        if (existing.linkedIncidentId) {
          await tx.case.update({
            where: { id },
            data: { linkedIncidentId: null },
          });
        }

        // Re-fetch counts inside transaction — guards against concurrent inserts of
        // subjects/lawyers/conclusions/documents between initial check and transaction commit.
        const inTxCounts = await tx.case.findFirst({
          where: { id, deletedAt: null },
          select: {
            _count: {
              select: {
                subjects: { where: { deletedAt: null } },
                lawyers: { where: { deletedAt: null } },
                conclusions: { where: { deletedAt: null } },
                documents: { where: { deletedAt: null } },
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
              unlinkedIncidentIds: existing.linkedIncidents.map((i) => i.id),
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
        linkedIncidents: { where: { deletedAt: null }, select: { id: true, code: true, name: true } },
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

    return {
      canDelete: reasonsIfBlocked.length === 0,
      status: existing.status,
      blockers,
      willUnlink: {
        incidents: existing.linkedIncidents as Array<{ id: string; code: string; name: string }>,
      },
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
    // v0.35a: include assignedTeam.wardId + ward để compute escalation FROM ward (Phase 3 Codex #2)
    const existing = await this.prisma.case.findFirst({
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

    if (dto.investigatorId && dto.investigatorId !== existing.investigatorId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { firstName: true, lastName: true },
      });
      const byUserName = actor ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() : '';
      this.eventEmitter.emit('case.assigned', new CaseAssignedEvent(
        id, existing.caseCode ?? '', dto.investigatorId, actorId, byUserName,
      ));
    }

    // v0.35a: emit CASE_ESCALATED_FROM_WARD nếu ward team → non-ward team.
    // Scope filter (v0.33) tự lock CAP ra khỏi access. Audit cho supervisor visibility.
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
          action: 'CASE_ESCALATED_FROM_WARD',
          subject: 'Case',
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
      // PR-8: cột nay là mảng — wrap giá trị đơn vào mảng 1 phần tử.
      data: { lyDoTamDinhChiVuAn: [lyDoTamDinhChiVuAn] as any },
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
    // Cùng lý do: cột `unit` rỗng ở mọi vụ án nên lọc trên nó trả về danh sách trắng.
    if (query.unitId) where.donViGiaiQuyet = query.unitId;
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
