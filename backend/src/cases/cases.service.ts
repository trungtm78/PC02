import { CaseOperationsService } from './governance/case-operations.service';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import {
  machMocGiaiQuyet,
  TRANG_THAI_KET_THUC,
} from '../common/trang-thai/trang-thai-ket-thuc';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { KHOA_TAT_CA, noiVaoWhere } from '../common/tim-kiem/dieu-kien';
import { BoTimKiem } from '../common/tim-kiem/bo-tim-kiem';
import { KHAI_TIM_KIEM_VU_AN } from '../common/tim-kiem/khai/vu-an.khai';
import { boDauTimKiem, thoatLike } from '../common/tim-kiem/bo-dau';
import { assertReviewedCandidates } from '../common/duplicate-review/acknowledge';
import {
  buildListOrderBy,
  type ListSortOrder,
} from '../common/utils/list-sort.util';
import { dieuKienToPhuong } from '../common/utils/to-phuong.util';
import { AuditService } from '../audit/audit.service';
import {
  validateIncidentProsecution,
  incidentSourceToCase,
  incidentSourceSnapshot,
} from '../incidents/incident-prosecution-contract';
import { buildCaseStatisticData } from './case-statistic.builder';
import { SettingsService } from '../settings/settings.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import { QueryCasesStatsDto } from './dto/query-cases-stats.dto';
import { AssignCaseDto } from './dto/assign-case.dto';
import type { DeleteCasePreflightResponse } from './dto/delete-case-preflight.response';
import {
  Prisma,
  CaseSensitivity,
  CaseStatus,
  IncidentStatus,
  PetitionStatus,
  LoaiDon,
  LyDoTamDinhChiVuAn,
  KetQuaPhucHoiVuAn,
  CaseProvenance,
  SubjectType,
  CaseType,
  Incident,
  Petition,
} from '@prisma/client';
import { TrangThaiPhanHoi } from './dto/query-cases.dto';
import type { DataScope } from '../auth/services/unit-scope.service';
import { buildScopeFilter } from '../common/utils/scope-filter.util';
import {
  apDungKyVaoWhere,
  phuDeKyXuat,
} from '../common/utils/thong-ke-ky.util';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { BcaExcelHelper } from '../common/bca-excel.helper';
import { CASE_STATUS_LABEL } from '../common/constants/status-labels.constants';
import { ROLE_NAMES } from '../common/constants/role.constants';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';
import { resolveGroup, countByGroup } from '../common/status-groups.util';
import {
  CASE_STATUS_GROUPS,
  LIST_SUSPECT_NAMES_LIMIT,
} from './cases.constants';
import { normalizeCanonicalCaseWrite } from './case-canonical-fields';
import { CaseFieldSchemaService } from './governance/case-field-schema.service';
import { civilDate } from './governance/legal-workflow.validation';
import { CaseGovernanceService } from './governance/case-governance.service';
import { legacyFormParityData } from './legacy-form-parity.mapper';
import { CASE_MESSAGES } from './cases.messages';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CaseAssignedEvent,
  CaseCreatedEvent,
} from '../notifications/events/notification.events';
import { CHON_CAN_BO_IN } from '../document-templates/chon-can-bo-in';
import { CaseSourceCreationService } from '../case-child-access/case-source-creation.service';
import {
  chonCotXuat,
  xuatDanhSachExcel,
} from '../common/xuat-danh-sach/xuat-danh-sach';
import {
  tachCotXuat,
  type CotXuatDto,
} from '../common/xuat-danh-sach/cot-xuat.dto';
import {
  KHAI_COT_XUAT_VU_AN,
  KHAI_COT_XUAT_VU_AN_PHUONG,
  delegationExportColumns,
} from './xuat-danh-sach-vu-an';
import {
  COT_CAN_CHO_XUAT_DAY_DU_VU_AN,
  COT_DOI_TUONG,
  COT_VAT_CHUNG,
  COT_TAI_LIEU,
  KHAI_COT_XUAT_VU_AN_DAY_DU,
} from './xuat-day-du-vu-an';
import type { DongXuatDayDuModel } from '../common/xuat-danh-sach/xuat-day-du-model';

type JsonInput = Prisma.InputJsonValue;
type PrismaTx = Prisma.TransactionClient;

// ─── UTDT pure helpers (exported for testing) ────────────────────────────────

type ComputeInput = {
  ketQuaUyThac: string | null;
  ngayTraKetQua: Date | null;
  thoiHanUyThac: Date | null;
  metadata: unknown;
};

type ReplyConflictInput = Pick<ComputeInput, 'metadata' | 'ketQuaUyThac'>;

function replyReason(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
    return '';
  const value =
    'lyDoKhongThucHienDuoc' in metadata
      ? metadata.lyDoKhongThucHienDuoc
      : undefined;
  return typeof value === 'string' ? value.trim() : '';
}

export function hasUtdtReplyConflict(value: ReplyConflictInput): boolean {
  return (
    replyReason(value.metadata).length > 0 &&
    Boolean(value.ketQuaUyThac?.trim())
  );
}

export function shouldRejectUtdtReplyConflict(
  previous: ReplyConflictInput | null,
  next: ReplyConflictInput,
): boolean {
  if (!hasUtdtReplyConflict(next)) return false;
  if (!previous || !hasUtdtReplyConflict(previous)) return true;
  return (
    replyReason(previous.metadata) !== replyReason(next.metadata) ||
    previous.ketQuaUyThac?.trim() !== next.ketQuaUyThac?.trim()
  );
}

const bangkokDateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function startsAfterBangkokBusinessDay(deadline: Date, now: Date): boolean {
  const parts = Object.fromEntries(
    bangkokDateParts
      .formatToParts(deadline)
      .map(({ type, value }) => [type, value]),
  );
  const nextDayStart = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    17,
  );
  return now.getTime() >= nextDayStart;
}

export function computeTrangThaiPhanHoi(
  c: ComputeInput,
  now: Date = new Date(),
): TrangThaiPhanHoi {
  if (replyReason(c.metadata)) return 'KHONG_THUC_HIEN_DUOC';
  if (c.ketQuaUyThac?.trim() && c.ngayTraKetQua) return 'DA_PHAN_HOI';
  if (c.thoiHanUyThac && startsAfterBangkokBusinessDay(c.thoiHanUyThac, now))
    return 'QUA_HAN';
  return 'CHUA_PHAN_HOI';
}

function bangkokDayStart(now: Date): Date {
  const parts = Object.fromEntries(
    bangkokDateParts.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day) - 1,
      17,
    ),
  );
}

export function buildTrangThaiFilter(
  state: TrangThaiPhanHoi,
  now: Date = new Date(),
): Prisma.CaseWhereInput {
  const completed: Prisma.CaseWhereInput = {
    utdtHasReplyResult: true,
    ngayTraKetQua: { not: null },
  };
  const notCompleted: Prisma.CaseWhereInput = { NOT: completed };
  const dueBefore = bangkokDayStart(now);
  switch (state) {
    case 'DA_PHAN_HOI':
      return { utdtHasFailureReason: false, ...completed };
    case 'KHONG_THUC_HIEN_DUOC':
      return { utdtHasFailureReason: true };
    case 'QUA_HAN':
      return {
        utdtHasFailureReason: false,
        thoiHanUyThac: { lt: dueBefore },
        ...notCompleted,
      };
    case 'CHUA_PHAN_HOI':
      return {
        utdtHasFailureReason: false,
        ...notCompleted,
        OR: [{ thoiHanUyThac: null }, { thoiHanUyThac: { gte: dueBefore } }],
      };
    default:
      return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tham số lọc chữ cũ của Vụ án / UTDT → khoá thẻ (đường dẫn cũ, GlobalSearchBar, bộ lọc nâng cao,
 * trang UTDT…). `search` cũ gồm cả cột riêng UTDT (đơn vị giao, số QĐ, đối tượng nghi vấn) — cột
 * ghép "tất cả các cột" của `cases` đã gồm các cột ấy. `unit` là "Đơn vị giải quyết" (`unit` thật
 * rỗng ở mọi vụ án). `investigatorName` qua thẻ Điều tra viên (họ tên + tài khoản, bỏ dấu).
 */
const THAM_SO_CU_VU_AN = {
  search: KHOA_TAT_CA,
  charges: 'toiDanh',
  unit: 'donViGiaiQuyet',
  stt: 'stt',
  sttCu: 'sttCu',
  donViGiao: 'donViGiao',
  investigatorName: 'dieuTraVien',
} as const;

/**
 * Cột một dòng danh sách Vụ án — dùng CHUNG cho màn danh sách và tệp Excel xuất theo bộ lọc, để hai
 * nơi đọc đúng một bộ trường (18/09/2026).
 */
const CHON_DONG_DANH_SACH_VU_AN = {
  fieldDefinitionVersionId: true,
  intakeStage: true,
  investigationPhase: true,
  sensitivity: true,
  governanceRevision: true,
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
  // Khoá sắp thứ hai của danh sách (cùng ngày đề xuất thì STT số giảm dần). Màn Chuyển đội / Trả hồ sơ
  // gộp ba nguồn phải sắp lại theo ĐÚNG khoá này, nếu không trang 2 lặp/mất dòng (workflow.service.ts).
  sttSort: true,
  // Cột "Nguồn hồ sơ" của màn Hồ sơ mới tiếp nhận (trước 17/09/2026 màn đọc trường này nhưng API
  // không trả → mọi hồ sơ rơi về "Vụ án").
  caseProvenance: true,
  createdAt: true,
  updatedAt: true,
  caseType: true,
  donViGiao: true,
  // Cột "Đối tượng nghi vấn" của màn UTDT — CÙNG cột mà thẻ `doiTuongNghiVan` lọc.
  nghiVanDoiTuong: true,
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
  // Cột "Người nhập": họ tên, thiếu thì tên đăng nhập (như màn) — cần `username`.
  createdBy: {
    select: { id: true, firstName: true, lastName: true, username: true },
  },
  // Cột "Phường/Xã" của màn Vụ án phường/xã: phường của TỔ thụ lý — cùng trường mà tham số
  // `wardTeamId` lọc. `unit` rỗng ở mọi vụ án, đọc nó là cột trắng.
  assignedTeam: {
    select: { id: true, name: true, ward: { select: { name: true } } },
  },
  /*
    Cột ngày mở cho tìm kiếm 21/09/2026 (đo riêng từng màn). Cột hiển thị ẩn sẵn trên bảng,
    nhưng PHẢI trả về ở đây — cột hiện ra rỗng vì API không trả là lớp hỏng im lặng dự án đã
    vấp nhiều lần.
  */
  receiveDate: true,
  ngayPhieuChuyen: true,
  ngayKhoiTo: true,
  ngayVietDon: true,
  // Thiếu hai cột này thì hồ sơ chỉ có ngày THIẾU thành phần hoặc chỉ có chữ nguyên văn
  // sẽ hiện trống ở cột "Ngày viết đơn" — mất im lặng ngay trên màn danh sách.
  ngayVietDonEdtf: true,
  ngayVietDonChu: true,
  ngayCapCccd: true,
} satisfies Prisma.CaseSelect;

/** Một dòng danh sách Vụ án như `getList` trả (trước khi gắn `trangThaiPhanHoi` cho UTDT). */
export type DongDanhSachVuAn = Prisma.CaseGetPayload<{
  select: typeof CHON_DONG_DANH_SACH_VU_AN;
}>;

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService, // v0.31.0.2: THOI_HAN_XOA_VU_AN
    private readonly docNums: DocumentNumbersService,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    private readonly governedSourceCreation?: CaseSourceCreationService,
  ) {}

  private async lockCase(tx: PrismaTx, id: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM cases WHERE id=${id} FOR UPDATE`;
  }
  private async prepareCreateFields(
    tx: PrismaTx,
    dto: CreateCaseDto,
    actorId: string,
  ) {
    if (!dto.cloneSourceCaseId) {
      if (dto.expectedCloneSourceUpdatedAt !== undefined)
        throw new BadRequestException('Clone source required');
      return this.fieldSchema.validateForWrite(
        tx,
        dto as unknown as Record<string, unknown>,
        null,
        { actorId },
      );
    }
    if (dto.linkedIncidentId || dto.linkedPetitionId)
      throw new BadRequestException('Clone must reset source links');
    const expected = new Date(dto.expectedCloneSourceUpdatedAt ?? '');
    if (!Number.isFinite(expected.getTime()))
      throw new BadRequestException('Clone source version required');
    await this.lockCase(tx, dto.cloneSourceCaseId);
    const source = await this.governance.assertCaseReadable(
      tx,
      dto.cloneSourceCaseId,
      { actorId },
    );
    if (source.updatedAt.getTime() !== expected.getTime())
      throw new ConflictException('Clone source changed');
    const sourceMetadata = source.metadata as Record<string, unknown> | null;
    const labels = [sourceMetadata?.sensitivity, sourceMetadata?._sensitivity];
    const sensitivity: CaseSensitivity =
      source.sensitivity === 'RESTRICTED' || labels.includes('RESTRICTED')
        ? 'RESTRICTED'
        : 'NORMAL';
    if (
      sensitivity === 'RESTRICTED' &&
      !(await this.governance.hasCapability(tx, actorId, 'read_sensitive'))
    )
      throw new ForbiddenException(
        'Source-only sensitive grants cannot authorize a restricted copy',
      );
    const readable = await this.fieldSchema.filterCustomFields(
      source,
      { actorId },
      tx,
    );
    const fields = await this.fieldSchema.validateForWrite(
      tx,
      dto as unknown as Record<string, unknown>,
      readable,
      { actorId },
    );
    return { ...fields, sensitivity };
  }
  private get fieldSchema(): CaseFieldSchemaService {
    return new CaseFieldSchemaService(this.prisma, this.governance);
  }
  private get sourceCreation(): CaseSourceCreationService {
    return (
      this.governedSourceCreation ??
      new CaseSourceCreationService(
        this.prisma,
        this.governance,
        this.fieldSchema,
      )
    );
  }
  private async authorizeHydratedRows<
    T extends {
      id: string;
      metadata?: unknown;
      fieldDefinitionVersionId?: string | null;
    },
  >(rows: T[], actorId?: string): Promise<T[]> {
    const result: T[] = [];
    for (const row of rows) {
      await this.authorizeRead(row.id, actorId);
      result.push(await this.serializeCase(row, actorId, 'export'));
    }
    return result;
  }
  private async serializeCase<
    T extends {
      id: string;
      metadata?: unknown;
      fieldDefinitionVersionId?: string | null;
    },
  >(
    record: T,
    actorId?: string,
    purpose: 'read' | 'export' = 'read',
  ): Promise<T> {
    return this.fieldSchema.filterCustomFields(
      record,
      {
        actorId: actorId ?? '',
      },
      this.prisma,
      purpose,
    );
  }
  private get governance(): CaseGovernanceService {
    return new CaseGovernanceService(this.prisma);
  }
  private async authorizeRead(id: string, actorId?: string) {
    if (actorId)
      return this.governance.assertCaseReadable(this.prisma, id, { actorId });
    const record = await this.prisma.case.findFirst({
      where: { id, deletedAt: null },
    });
    const label = (record?.metadata as Record<string, unknown> | null)
      ?.sensitivity;
    if (
      record &&
      ((record.sensitivity && record.sensitivity !== 'NORMAL') ||
        (label !== undefined && label !== null && label !== 'NORMAL'))
    )
      throw new ForbiddenException(
        'Authenticated sensitive authority required',
      );
    return record;
  }
  private async visibilityWhere(
    actorId?: string,
  ): Promise<Prisma.CaseWhereInput> {
    if (actorId)
      return this.governance.readableCaseWhere(this.prisma, { actorId });
    // Internal callers without actor identity cannot inherit administrator sensitivity.
    const legacy = this.prisma.$queryRaw
      ? await this.prisma.$queryRaw<
          { id: string }[]
        >`SELECT id FROM cases WHERE metadata->>'sensitivity' IS NOT NULL AND metadata->>'sensitivity' <> 'NORMAL'`
      : [];
    return {
      sensitivity: 'NORMAL',
      id: { notIn: (legacy ?? []).map((x) => x.id) },
    };
  }

  private boTimKiem?: BoTimKiem;

  /**
   * Tìm kiếm dạng thẻ của bảng `cases` (Vụ án + UTDT) — lớp dùng chung với Đơn thư/Vụ việc. Tạo LƯỜI:
   * khởi tạo ở khai báo field thì `this.prisma` có thể chưa gán.
   */
  private get timKiem(): BoTimKiem {
    return (this.boTimKiem ??= new BoTimKiem(
      this.prisma,
      KHAI_TIM_KIEM_VU_AN,
      THAM_SO_CU_VU_AN,
    ));
  }

  async findNameSuggestions(
    q: string,
    caseType: CaseType,
    dataScope?: DataScope | null,
    actorId?: string,
  ) {
    if (actorId)
      await this.fieldSchema.assertQueryReadable(
        this.prisma,
        { actorId },
        { name: q, caseType },
      );
    const normalized = boDauTimKiem(q ?? '').trim();
    if (normalized.length < 2) return [];

    const where: Prisma.CaseWhereInput = {
      deletedAt: null,
      caseType,
      nameBd: { contains: thoatLike(normalized) },
    };
    const scopeFilter = buildScopeFilter(dataScope);
    if (scopeFilter) {
      noiVaoWhere(where as Record<string, unknown>, [
        scopeFilter as Prisma.CaseWhereInput,
      ]);
    }
    noiVaoWhere(where as Record<string, unknown>, [
      await this.visibilityWhere(actorId),
    ]);
    const groups = await this.prisma.case.groupBy({
      by: ['name'],
      where,
      _count: { _all: true },
    });
    return groups
      .map((group) => ({ name: group.name, count: group._count._all }))
      .filter((group) => group.name.trim().length > 0)
      .sort(
        (left, right) =>
          right.count - left.count || left.name.localeCompare(right.name, 'vi'),
      )
      .slice(0, 10);
  }

  async findDuplicateCandidates(
    name: string,
    caseType: CaseType,
    excludeId?: string,
    dataScope?: DataScope | null,
    decisionNumber?: string,
    actorId?: string,
  ) {
    if (actorId)
      await this.fieldSchema.assertQueryReadable(
        this.prisma,
        { actorId },
        { name, caseType, soQuyetDinhUyThac: decisionNumber },
      );
    const normalized = boDauTimKiem(name ?? '').trim();
    const exactDecisionNumber =
      caseType === CaseType.UY_THAC_DIEU_TRA
        ? decisionNumber?.trim()
        : undefined;
    if (normalized.length < 2 && !exactDecisionNumber) return [];

    const where: Prisma.CaseWhereInput = {
      deletedAt: null,
      caseType,
      ...(excludeId && { id: { not: excludeId } }),
      ...(exactDecisionNumber
        ? {
            OR: [
              ...(normalized.length >= 2
                ? [{ nameBd: { contains: thoatLike(normalized) } }]
                : []),
              { soQuyetDinhUyThac: exactDecisionNumber },
            ],
          }
        : { nameBd: { contains: thoatLike(normalized) } }),
    };
    const scopeFilter = buildScopeFilter(dataScope);
    if (scopeFilter) {
      noiVaoWhere(where as Record<string, unknown>, [
        scopeFilter as Prisma.CaseWhereInput,
      ]);
    }
    const exactWhere: Prisma.CaseWhereInput = exactDecisionNumber
      ? {
          ...where,
          OR: [
            ...(normalized.length >= 2
              ? [{ nameBd: { equals: ` ${normalized}` } }]
              : []),
            { soQuyetDinhUyThac: exactDecisionNumber },
          ],
        }
      : { ...where, nameBd: { equals: ` ${normalized}` } };
    const select = {
      id: true,
      caseCode: true,
      name: true,
      soQuyetDinhUyThac: true,
      ngayDeXuat: true,
      status: true,
    } as const;
    const profile = actorId
      ? await this.governance.accessProfile(this.prisma, { actorId })
      : null;
    const orderBy: Prisma.CaseOrderByWithRelationInput =
      profile?.caseAccessMode === 'REPRESENTATION_ONLY'
        ? { name: 'asc' }
        : { ngayDeXuat: 'desc' };
    if (actorId && exactDecisionNumber) {
      const policy = await this.fieldSchema.policyAwareSearchWhere(
        this.prisma,
        { actorId },
        { soQuyetDinhUyThac: exactDecisionNumber },
      );
      if (policy) {
        noiVaoWhere(exactWhere as Record<string, unknown>, [policy]);
        noiVaoWhere(where as Record<string, unknown>, [policy]);
      }
    }
    noiVaoWhere(exactWhere as Record<string, unknown>, [
      await this.visibilityWhere(actorId),
    ]);
    noiVaoWhere(where as Record<string, unknown>, [
      await this.visibilityWhere(actorId),
    ]);
    const exact = await this.prisma.case.findMany({
      where: exactWhere,
      select,
      orderBy,
    });
    const remaining = Math.max(0, 20 - exact.length);
    const partial =
      remaining > 0
        ? await this.prisma.case.findMany({
            where: exact.length
              ? {
                  ...where,
                  id: {
                    notIn: [
                      ...exact.map((candidate) => candidate.id),
                      ...(excludeId ? [excludeId] : []),
                    ],
                  },
                }
              : where,
            select,
            orderBy,
            take: remaining,
          })
        : [];
    const seen = new Set<string>();
    const candidates = [...exact, ...partial]
      .filter((candidate) => {
        if (seen.has(candidate.id)) return false;
        seen.add(candidate.id);
        return true;
      })
      .slice(0, Math.max(20, exact.length));
    return Promise.all(
      candidates.map(async (candidate) => {
        const decisionMatches = Boolean(
          exactDecisionNumber &&
          candidate.soQuyetDinhUyThac?.trim() === exactDecisionNumber,
        );
        const nameMatches =
          normalized.length >= 2 && boDauTimKiem(candidate.name) === normalized;
        const confidence: 'HIGH' | 'MEDIUM' =
          decisionMatches || nameMatches ? 'HIGH' : 'MEDIUM';
        const reasons = [
          ...(decisionMatches ? ['DECISION_NUMBER_MATCH'] : []),
          ...(nameMatches || !decisionMatches ? ['NAME_MATCH'] : []),
        ];
        const visible = actorId
          ? await this.governance.serializeCaseList(this.prisma, candidate, {
              actorId,
            })
          : candidate;
        return { ...visible, confidence, reasons };
      }),
    );
  }

  // ─────────────────────────────────────────────
  // GET LIST
  // ─────────────────────────────────────────────
  /**
   * MỘT nguồn điều kiện lọc cho danh sách, thẻ số và xuất Excel (18/09/2026) — cùng cách làm với
   * Đơn thư. Trước đây `getStats` chép tay toàn bộ điều kiện của `getList`: thêm bộ lọc mà quên sửa
   * một nơi là thẻ số lệch bảng (đã từng sót `createdById`). Gộp một chỗ thì ba đường không thể lệch.
   *
   * `boTrangThai`: thẻ số bỏ điều kiện trạng thái/nhóm trạng thái đang chọn, để các chip vẫn đếm MỌI
   * trạng thái (drill-down). Mọi điều kiện khác giữ nguyên.
   */
  async dungWhereDanhSach(
    query: QueryCasesDto | QueryCasesStatsDto,
    dataScope?: DataScope | null,
    {
      boTrangThai = false,
      now = new Date(),
      actorId,
    }: { boTrangThai?: boolean; now?: Date; actorId?: string } = {},
  ) {
    await this.fieldSchema.assertQueryReadable(
      this.prisma,
      { actorId: actorId ?? '' },
      query as unknown as Record<string, unknown>,
      'read',
      await this.visibilityWhere(actorId),
    );
    const {
      status,
      statusGroup,
      investigatorId,
      fromDate,
      toDate,
      overdue,
      districtId,
      wardId,
      wardTeamId,
      capDoToiPham,
      caseType,
      loaiUyThac,
      trangThaiPhanHoi,
      ngayTiepNhanFrom,
      ngayTiepNhanTo,
      createdById,
    } = query as QueryCasesDto;

    const where: Prisma.CaseWhereInput = {
      deletedAt: null,
      // Default REGULAR filter — UTDT records only visible when caseType=UY_THAC_DIEU_TRA
      caseType: caseType ?? CaseType.REGULAR,
    };

    const kyThongKe = this.timKiem.kyApDung(
      await this.settings.getKyThongKe({ truong: query.thongKeTruongNgay }),
      query.tk,
    );
    // The configured date is an input to the policy partitions. Applying it
    // globally would expose private dates through list/count membership.
    const periodWhere: Prisma.CaseWhereInput = {};
    apDungKyVaoWhere(
      periodWhere as Record<string, unknown>,
      kyThongKe,
      fromDate,
      toDate,
      'ngayDeXuat',
    );
    const periodField = Object.keys(periodWhere)[0];

    // Thẻ tìm kiếm + tham số lọc chữ cũ (search/charges/unit/stt/sttCu/donViGiao/investigatorName)
    // — CÙNG helper cho danh sách lẫn thống kê. Đọc TRƯỚC mọi truy vấn: khoá lạ là 400.
    const policySearch = await this.fieldSchema.policyAwareSearchWhere(
      this.prisma,
      { actorId: actorId ?? '' },
      query as unknown as Record<string, unknown>,
      await this.visibilityWhere(actorId),
      false,
      periodField ? { field: periodField, where: periodWhere } : undefined,
    );
    noiVaoWhere(
      where as Record<string, unknown>,
      policySearch ? [policySearch] : await this.timKiem.dieuKien(query),
    );

    if (!boTrangThai) {
      // Nhóm trạng thái (drill-down thẻ thống kê) THẮNG status đơn lẻ — giống semantic
      // `phase` đã ship ở Vụ việc. `resolveGroup` chặn prototype chain.
      const groupStatuses = resolveGroup(CASE_STATUS_GROUPS, statusGroup);
      if (groupStatuses) {
        where.status = { in: [...groupStatuses] };
      } else if (status) {
        where.status = status;
      }
    }

    if (investigatorId) {
      where.investigatorId = investigatorId;
    }

    // `stt` (mã hồ sơ, khớp đúng biến thể `26-9893`/`2026-9893`), `sttCu` (nhận `208` lẫn
    // `2016-208`) và Tội danh (`charges`) đã đi qua thẻ ở trên.

    // "Cán bộ nhập" ở Vụ án là người tạo hồ sơ.
    if (createdById?.trim()) {
      where.createdById = createdById.trim();
    }

    // `unit` cũ = "Đơn vị giải quyết" (cột `donViGiaiQuyet` đang hiện; `unit` thật rỗng ở mọi vụ
    // án) — đi qua thẻ `donViGiaiQuyet` ở trên, khớp CHỨA bỏ dấu.

    // Kỳ thống kê: người dùng không tự đặt ngày thì áp mặc định admin cấu hình. Cùng một
    // hàm với thẻ số và badge menu nên ba chỗ không thể lệch nhau.
    //
    // ĐỔI CỘT LỌC: trước đây hai ô ngày của Vụ án lọc theo `createdAt`, khác hẳn Đơn thư
    // (`receivedDate`) và Vụ việc (`ngayDeXuat`). Hồ sơ di trú dồn chung MỘT ngày tạo nên
    // bộ lọc ấy gần như không lọc được gì. Nay theo `ngayDeXuat` như hai module kia; muốn
    // lọc theo ngày tạo thì chọn "Tính theo: Ngày tạo".
    // Có thẻ ngày thì bỏ kỳ MẶC ĐỊNH (giao với thẻ ra 0 dòng) và báo "tất cả" cho nhãn kỳ.

    // Filter quá hạn
    if (overdue) {
      noiVaoWhere(where as Record<string, unknown>, [
        await this.fieldSchema.readableNativeWhere(
          this.prisma,
          { actorId: actorId ?? '' },
          ['deadline', 'status'],
          await this.visibilityWhere(actorId),
        ),
      ]);
      where.deadline = { lt: caseCivilDayStart(now ?? new Date()) };
      // KHÔNG gán đè `where.status`: làm vậy sẽ xoá sổ điều kiện statusGroup/status đã đặt
      // ở trên → bấm thẻ "Tạm đình chỉ" khi đang lọc quá hạn sẽ trả về MỌI hồ sơ quá hạn.
      // Prisma cho phép gộp in/equals + notIn trong cùng một filter.
      const notTerminal = TRANG_THAI_KET_THUC.case;
      where.status =
        typeof where.status === 'string'
          ? { equals: where.status, notIn: notTerminal }
          : { ...(where.status ?? {}), notIn: notTerminal };
    }

    if (capDoToiPham) {
      where.capDoToiPham = capDoToiPham;
    }

    // v0.44 — UTDT-specific filters (`donViGiao` chữ tự do đã đi qua thẻ ở trên)
    if (loaiUyThac) {
      where.loaiUyThac = loaiUyThac;
    }
    if (trangThaiPhanHoi) {
      const stateFilter = buildTrangThaiFilter(trangThaiPhanHoi, now);
      noiVaoWhere(where as Record<string, unknown>, [stateFilter]);
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

    // `investigatorName` cũ đã đi qua thẻ Điều tra viên ở trên (họ tên + tài khoản, bỏ dấu, trong AND).

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
    const toPhuong = dieuKienToPhuong(wardTeamId, query.chiToPhuong);
    if (toPhuong) where.assignedTeam = toPhuong;

    // Apply data scope filter
    const scopeFilter = buildScopeFilter(dataScope);
    if (scopeFilter) {
      noiVaoWhere(where as Record<string, unknown>, [
        scopeFilter as Prisma.CaseWhereInput,
      ]);
    }

    noiVaoWhere(where as Record<string, unknown>, [
      await this.visibilityWhere(actorId),
    ]);

    const governanceFilter = await new CaseOperationsService(
      this.prisma,
      this.governance,
    ).caseFilters(
      query as unknown as Record<string, unknown>,
      { actorId: actorId ?? '' },
      now,
    );
    if (Object.keys(governanceFilter).length)
      noiVaoWhere(where as Record<string, unknown>, [governanceFilter]);
    return { where, ky: kyThongKe };
  }

  /** Thứ tự danh sách Vụ án — CHUNG cho màn và tệp xuất, để thứ tự trong tệp khớp màn hình. */
  private async thuTuDanhSach(
    sortBy: string | undefined,
    sortOrder: ListSortOrder,
    actorId?: string,
  ): Promise<
    Prisma.CaseOrderByWithRelationInput | Prisma.CaseOrderByWithRelationInput[]
  > {
    if (!sortBy && actorId) {
      if (
        (await this.governance.accessProfile(this.prisma, { actorId }))
          .caseAccessMode === 'REPRESENTATION_ONLY'
      )
        return { id: 'asc' };
      try {
        await this.fieldSchema.assertQueryReadable(
          this.prisma,
          { actorId },
          { sortBy: 'ngayDeXuat' },
        );
      } catch (error) {
        if (error instanceof ForbiddenException) return { id: 'asc' };
        throw error;
      }
    }
    // Mặc định sắp theo NGÀY ĐỀ XUẤT. Nghe có vẻ sai so với "ngày tiếp nhận", nhưng
    // đo trên dữ liệu thật: `receiveDate` — đúng cột mang tên tiếp nhận — chỉ có
    // 2/3.304 hồ sơ (0,06%), còn `ngayDeXuat` phủ 98,8%. Sắp theo `receiveDate` sẽ cho
    // một khối rỗng khổng lồ. `createdAt` thì cả bảng chỉ có 3 ngày khác nhau (di trú).
    // UTDT dùng chung bảng và endpoint này (GET /cases?caseType=UY_THAC_DIEU_TRA) nên
    // thừa hưởng cùng thứ tự; `ngayTiepNhan` riêng của UTDT chỉ phủ 12,5%.
    return buildListOrderBy({
      sortBy,
      sortOrder,
      allowed: [
        'createdAt',
        'updatedAt',
        'name',
        'deadline',
        'status',
        'ngayDeXuat',
        'receiveDate',
        'ngayTiepNhan',
        'stt',
      ],
      // Anh yêu cầu 19/09/2026: "ngày đề xuất phải được order by theo giảm dần" — thay mặc định STT
      // của 27/08. Cùng một ngày (hệ cũ nhập theo ngày, không theo giờ) thì STT giảm dần làm khoá thứ
      // hai, rồi mới tới `id`. STT sắp trên cột SỐ `sttSort` do trigger giữ — sắp thẳng trên chuỗi
      // mã thì `2026-9395` đứng sau `2026-11171` dù số nhỏ hơn. Bấm tiêu đề cột STT vẫn đổi được.
      // Chỉ mục khớp đúng thứ tự này: migration `*_sap_ngay_de_xuat_stt`.
      defaultField: 'ngayDeXuat',
      thenBy: ['stt'],
      nullableFields: [
        'ngayDeXuat',
        'receiveDate',
        'ngayTiepNhan',
        'deadline',
        'sttSort',
      ],
      fieldAliases: { stt: 'sttSort' },
    });
  }

  async getList(
    query: QueryCasesDto,
    dataScope?: DataScope | null,
    actorId?: string,
  ) {
    const now = new Date();
    const {
      limit = 20,
      offset = 0,
      sortBy, // mac dinh do buildListOrderBy quyet dinh, KHONG dat o day
      sortOrder = 'desc',
    } = query;

    const { where } = await this.dungWhereDanhSach(query, dataScope, {
      now,
      actorId,
    });

    const orderBy = await this.thuTuDanhSach(
      sortBy,
      sortOrder as ListSortOrder,
      actorId,
    );

    const [data, total] = await Promise.all([
      this.prisma.case.findMany({
        where,
        select: CHON_DONG_DANH_SACH_VU_AN,
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.case.count({ where }),
    ]);

    for (let index = 0; index < data.length; index++) {
      const visible = actorId
        ? await this.governance.serializeCaseList(this.prisma, data[index], {
            actorId,
          })
        : data[index];
      data[index] = await this.serializeCase(visible, actorId);
    }
    return {
      success: true,
      data: data.map((item) => {
        const quyenGhi =
          (item as unknown as { quyenGhi?: boolean }).quyenGhi === false
            ? false
            : this.coQuyenGhi(
                {
                  investigatorId: item.investigator?.id,
                  assignedTeamId: item.assignedTeam?.id,
                  intakeStage: item.intakeStage,
                },
                dataScope,
              );
        return item.caseType === CaseType.UY_THAC_DIEU_TRA
          ? {
              ...item,
              quyenGhi,
              trangThaiPhanHoi: computeTrangThaiPhanHoi(item, now),
              utdtReplyConflict: hasUtdtReplyConflict(item),
            }
          : { ...item, quyenGhi };
      }),
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
  async getStats(
    query: QueryCasesStatsDto,
    dataScope?: DataScope | null,
    actorId?: string,
  ) {
    // Thẻ thống kê phải đếm CÙNG tập hồ sơ mà danh sách hiện — CÙNG hàm với getList và xuất Excel,
    // chỉ bỏ điều kiện trạng thái để các chip vẫn đếm mọi trạng thái.
    const { where, ky: kyThongKe } = await this.dungWhereDanhSach(
      query,
      dataScope,
      { boTrangThai: true, actorId },
    );

    // Initialize all CaseStatus keys to 0 → exhaustive response shape
    const byStatus: Record<CaseStatus, number> = Object.values(
      CaseStatus,
    ).reduce(
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
    return {
      total,
      byStatus,
      byGroup: countByGroup(CASE_STATUS_GROUPS, byStatus),
      ky: kyThongKe,
    };
  }

  // ─────────────────────────────────────────────
  // GET UTDT STATS — F2 follow-up
  // ─────────────────────────────────────────────
  //
  // UTDT chip counts grouped by computed TrangThaiPhanHoi (4 states).
  // TrangThaiPhanHoi is NOT a stored column — it's derived from
  // ketQuaUyThac + ngayTraKetQua + thoiHanUyThac + metadata.lyDoKhongThucHienDuoc
  // (see computeTrangThaiPhanHoi above). Standard groupBy can't compute it,
  // so we run 4 counts using buildTrangThaiFilter as the per-state WHERE
  // predicate in one repeatable-read snapshot. Total is their sum.
  //
  // Reuses QueryCasesStatsDto for filter pass-through (search, donViGiao,
  // loaiUyThac, ngayTiepNhanFrom/To, investigatorName, etc.) but ALWAYS
  // forces caseType=UY_THAC_DIEU_TRA and strips trangThaiPhanHoi (counts BY
  // state, not filtered by it).
  async getUtdtStats(
    query: QueryCasesStatsDto,
    dataScope?: DataScope | null,
    actorId?: string,
  ) {
    const now = new Date();
    const { where: baseWhere, ky: kyThongKe } = await this.dungWhereDanhSach(
      {
        ...query,
        caseType: CaseType.UY_THAC_DIEU_TRA,
        trangThaiPhanHoi: undefined,
      },
      dataScope,
      { boTrangThai: true, actorId, now },
    );

    const states: TrangThaiPhanHoi[] = [
      'DA_PHAN_HOI',
      'KHONG_THUC_HIEN_DUOC',
      'QUA_HAN',
      'CHUA_PHAN_HOI',
    ];

    // 4 parallel counts, one per state. Each merges baseWhere with state-specific
    // filter via AND-array (avoid clobbering existing baseWhere.AND).
    const counts = await this.prisma.$transaction(
      (tx) =>
        Promise.all(
          states.map((state) => {
            const stateFilter = buildTrangThaiFilter(state, now);
            const stateWhere: Prisma.CaseWhereInput = {
              ...baseWhere,
              AND: [
                ...(Array.isArray(baseWhere.AND)
                  ? baseWhere.AND
                  : baseWhere.AND
                    ? [baseWhere.AND]
                    : []),
                stateFilter,
              ],
            };
            return tx.case.count({ where: stateWhere });
          }),
        ),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    const byTrangThai: Record<TrangThaiPhanHoi, number> = {
      DA_PHAN_HOI: counts[0],
      KHONG_THUC_HIEN_DUOC: counts[1],
      QUA_HAN: counts[2],
      CHUA_PHAN_HOI: counts[3],
    };
    const total = counts.reduce((a, b) => a + b, 0);

    return { total, byTrangThai, ky: kyThongKe };
  }

  // ─────────────────────────────────────────────
  // GET DETAIL
  // ─────────────────────────────────────────────
  private checkRecordInScope(
    record: {
      investigatorId?: string | null;
      assignedTeamId?: string | null;
      intakeStage?: string | null;
    },
    dataScope?: DataScope | null,
  ) {
    if (!dataScope) return; // admin or no scope = allow
    if (dataScope.canDispatch) return; // dispatcher: full read access
    const { userIds, teamIds, isWardOfficer } = dataScope;

    const ownerMatch =
      record.investigatorId && userIds.includes(record.investigatorId);
    const teamMatch =
      record.assignedTeamId && teamIds.includes(record.assignedTeamId);
    // Cán bộ phường KHÔNG thấy hồ sơ chưa giao tổ (luật v0.33 "Crit 1") — danh sách đã ẩn; trang chi tiết cũng
    // phải chặn, nếu không biết id là mở được (rà độc lập 19/09/2026).
    const unassignedMatch =
      !record.assignedTeamId && teamIds.length > 0 && !isWardOfficer;

    if (!ownerMatch && !teamMatch && !unassignedMatch) {
      throw new ForbiddenException('Bạn không có quyền truy cập bản ghi này');
    }
  }

  /**
   * Người xem có GHI được vụ án này không — luật DUY NHẤT dùng cho cả chặn ghi (checkWriteScope) lẫn cờ `quyenGhi`
   * trả về cho trang chi tiết (ẩn nút ghi khi chỉ xem được, 20/09/2026).
   */
  private coQuyenGhi(
    record: {
      investigatorId?: string | null;
      assignedTeamId?: string | null;
      intakeStage?: string | null;
    },
    dataScope?: DataScope | null,
  ): boolean {
    if (record.intakeStage === 'CHO_NHAN') return false;
    if (!dataScope) return true;
    // Người GHI được (không gồm thành viên tổ chỉ-xem); xem `DataScope.writableUserIds`.
    const {
      writableUserIds: userIds,
      writableTeamIds,
      isWardOfficer,
    } = dataScope;
    const ownerMatch =
      record.investigatorId && userIds.includes(record.investigatorId);
    const teamMatch =
      record.assignedTeamId && writableTeamIds.includes(record.assignedTeamId);
    // Cán bộ phường không ghi hồ sơ chưa giao tổ — khớp bộ lọc ghi dùng chung và checkWriteScope của đơn thư
    // (trước 19/09/2026 sửa/xoá lẻ được, xoá hàng loạt thì bị chặn).
    const unassignedMatch =
      !record.assignedTeamId && writableTeamIds.length > 0 && !isWardOfficer;
    return Boolean(ownerMatch || teamMatch || unassignedMatch);
  }

  private checkWriteScope(
    record: {
      investigatorId?: string | null;
      assignedTeamId?: string | null;
      intakeStage?: string | null;
    },
    dataScope?: DataScope | null,
  ) {
    if (record.intakeStage === 'CHO_NHAN')
      throw new ConflictException('Pending handoff protects this case');
    if (!this.coQuyenGhi(record, dataScope)) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bản ghi này');
    }
  }

  async getById(
    id: string,
    dataScope?: DataScope | null,
    actorId?: string,
    purpose: 'read' | 'export' = 'read',
  ) {
    if (purpose === 'export' && actorId)
      await this.governance.assertGeneralExport(this.prisma, { actorId });
    await this.authorizeRead(id, actorId);
    const record = await this.prisma.case.findFirst({
      where: { id, deletedAt: null },
      include: {
        statistic: true, // Thống kê mở rộng (case_statistics) — form load round-trip
        crimeChinh: {
          select: { id: true, code: true, name: true, articleNo: true },
        }, // tội danh chính FK
        // Bị can: mẫu "QĐ khởi tố bị can", "Kết luận điều tra", "Biên bản hỏi cung" điền
        // `hoTenBiCan`/`namSinh` từ đây. Thiếu thì ba mẫu ấy in ra ô trống dù vụ án đã có bị
        // can — hỏng im lặng, tệ hơn báo thiếu.
        subjects: {
          where: { deletedAt: null },
          select: { id: true, fullName: true, dateOfBirth: true, type: true },
          orderBy: { createdAt: 'asc' },
        },
        investigator: { select: CHON_CAN_BO_IN },
        createdBy: { select: CHON_CAN_BO_IN },
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

    return {
      success: true,
      data: {
        ...(await this.serializeCase(record, actorId, purpose)),
        utdtReplyConflict:
          record.caseType === CaseType.UY_THAC_DIEU_TRA
            ? hasUtdtReplyConflict(record)
            : false,
        autoLinkedIncident: autoLinkedIncident ?? null,
        // Giao diện ẩn nút ghi khi false — cùng luật với checkWriteScope (máy chủ vẫn chặn ghi như cũ).
        quyenGhi: actorId
          ? await this.governance.canCaseEdit(this.prisma, id, { actorId })
          : this.coQuyenGhi(record, dataScope),
      },
    };
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
  ): Promise<{
    subjectsCreated: number;
    evidencesCreated: number;
    documentsLinked: number;
  }> {
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
    if (
      dto.metadata?.sensitivity !== undefined &&
      dto.metadata.sensitivity !== 'NORMAL'
    )
      throw new BadRequestException('Classify sensitivity through governance');
    if (
      dto.cloneSourceCaseId &&
      (dto.linkedIncidentId ||
        dto.linkedPetitionId ||
        dto.caseProvenance === CaseProvenance.FROM_INCIDENT ||
        dto.caseProvenance === CaseProvenance.FROM_PETITION)
    )
      throw new BadRequestException('Clone must reset source provenance links');
    dto = normalizeCanonicalCaseWrite(
      dto as unknown as Record<string, unknown>,
    ) as unknown as CreateCaseDto;
    const reviewedDuplicateIds = assertReviewedCandidates(
      await this.findDuplicateCandidates(
        dto.name,
        dto.caseType ?? CaseType.REGULAR,
        undefined,
        dataScope,
        dto.soQuyetDinhUyThac,
        actorId,
      ),
      dto.acknowledgedDuplicateIds,
    );
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
    if (
      dto.caseType === CaseType.UY_THAC_DIEU_TRA &&
      shouldRejectUtdtReplyConflict(null, {
        metadata: scrubbedMetadata,
        ketQuaUyThac: dto.ketQuaUyThac ?? null,
      })
    ) {
      throw new BadRequestException(CASE_MESSAGES.utdt.replyConflict);
    }
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
      // Đăng ký hồ sơ lịch sử không phải là một quyết định tố tụng. Nếu ngày giải
      // quyết chưa được xác minh thì phải giữ UNKNOWN; chỉ nghiệp vụ quyết định có
      // ngày hiệu lực thực tế mới được đóng mốc này.
      investigatorId: dto.investigatorId,
      createdById: actorId, // v0.31.0.2: creator track
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      unit: dto.unit,
      donViGiaiQuyet: dto.donViGiaiQuyet,
      ...(effectiveAssignedTeamId !== undefined && {
        assignedTeamId: effectiveAssignedTeamId,
      }),
      subjectsCount: dto.subjectsCount ?? 0,
      ...(dto.capDoToiPham !== undefined && { capDoToiPham: dto.capDoToiPham }),
      ...(dto.ngayKhoiTo !== undefined && {
        ngayKhoiTo: dto.ngayKhoiTo ? new Date(dto.ngayKhoiTo) : null,
      }),
      // ── Field-parity: số QĐ giai đoạn vụ án ──
      ...(dto.soQuyetDinhKhoiTo !== undefined && {
        soQuyetDinhKhoiTo: dto.soQuyetDinhKhoiTo,
      }),
      ...(dto.soQDNhapVuAn !== undefined && { soQDNhapVuAn: dto.soQDNhapVuAn }),
      ...(dto.ngayNhapVuAn !== undefined && {
        ngayNhapVuAn: dto.ngayNhapVuAn ? new Date(dto.ngayNhapVuAn) : null,
      }),
      ...(dto.ghiChuNhapHoSo !== undefined && {
        ghiChuNhapHoSo: dto.ghiChuNhapHoSo,
      }),
      ...(dto.soQDTachVuAn !== undefined && { soQDTachVuAn: dto.soQDTachVuAn }),
      ...(dto.ngayTachVuAn !== undefined && {
        ngayTachVuAn: dto.ngayTachVuAn ? new Date(dto.ngayTachVuAn) : null,
      }),
      ...(dto.soQDTachHanhVi !== undefined && {
        soQDTachHanhVi: dto.soQDTachHanhVi,
      }),
      ...(dto.ngayTachHanhVi !== undefined && {
        ngayTachHanhVi: dto.ngayTachHanhVi
          ? new Date(dto.ngayTachHanhVi)
          : null,
      }),
      ...(dto.soQDDinhChiVuAn !== undefined && {
        soQDDinhChiVuAn: dto.soQDDinhChiVuAn,
      }),
      ...(dto.ngayDinhChiVuAn !== undefined && {
        ngayDinhChiVuAn: dto.ngayDinhChiVuAn
          ? new Date(dto.ngayDinhChiVuAn)
          : null,
      }),
      ...(dto.chuyenVuAnChoCQK !== undefined && {
        chuyenVuAnChoCQK: dto.chuyenVuAnChoCQK,
      }),
      ...(dto.soBanAnCoHieuLuc !== undefined && {
        soBanAnCoHieuLuc: dto.soBanAnCoHieuLuc,
      }),
      ...(dto.ngayBanAnCoHieuLuc !== undefined && {
        ngayBanAnCoHieuLuc: dto.ngayBanAnCoHieuLuc
          ? new Date(dto.ngayBanAnCoHieuLuc)
          : null,
      }),
      ...(dto.canCuTamDinhChiVuAn !== undefined && {
        canCuTamDinhChiVuAn: dto.canCuTamDinhChiVuAn,
      }),
      ...(dto.canCuPhucHoiVuAn !== undefined && {
        canCuPhucHoiVuAn: dto.canCuPhucHoiVuAn,
      }),
      // ── PR-3 — field tab "Vụ án TĐC" (persist khi CREATE; update có ở block ~1222) ──
      ...(dto.soQuyetDinhTamDinhChi !== undefined && {
        soQuyetDinhTamDinhChi: dto.soQuyetDinhTamDinhChi,
      }),
      ...(dto.ngayTamDinhChi !== undefined && {
        ngayTamDinhChi: dto.ngayTamDinhChi
          ? new Date(dto.ngayTamDinhChi)
          : null,
      }),
      ...(dto.lyDoTamDinhChiVuAn !== undefined && {
        lyDoTamDinhChiVuAn: dto.lyDoTamDinhChiVuAn,
      }),
      ...(dto.ngayHetThoiHieu !== undefined && {
        ngayHetThoiHieu: dto.ngayHetThoiHieu
          ? new Date(dto.ngayHetThoiHieu)
          : null,
      }),
      ...(dto.soQuyetDinhPhucHoi !== undefined && {
        soQuyetDinhPhucHoi: dto.soQuyetDinhPhucHoi,
      }),
      ...(dto.ngayPhucHoi !== undefined && {
        ngayPhucHoi: dto.ngayPhucHoi ? new Date(dto.ngayPhucHoi) : null,
      }),
      ...(dto.tdcKhacPhucLyDoBienPhap !== undefined && {
        tdcKhacPhucLyDoBienPhap: dto.tdcKhacPhucLyDoBienPhap,
      }),
      ...(dto.tdcKhacPhucBienBan !== undefined && {
        tdcKhacPhucBienBan: dto.tdcKhacPhucBienBan,
      }),
      // ── Field-parity KLĐT + QĐ điều tra lại (PR-M2: trước đây RỚT ở create — update có) ──
      ...(dto.soKLDT !== undefined && { soKLDT: dto.soKLDT }),
      ...(dto.ngayKLDT !== undefined && {
        ngayKLDT: dto.ngayKLDT ? new Date(dto.ngayKLDT) : null,
      }),
      ...(dto.soQDDieuTraLai !== undefined && {
        soQDDieuTraLai: dto.soQDDieuTraLai,
      }),
      ...(dto.ngayQDDieuTraLai !== undefined && {
        ngayQDDieuTraLai: dto.ngayQDDieuTraLai
          ? new Date(dto.ngayQDDieuTraLai)
          : null,
      }),
      // ── PR-M2: ghi chú tự do + tội danh khác (multi) ──
      ...(dto.ghiChuKhac !== undefined && { ghiChuKhac: dto.ghiChuKhac }),
      ...(dto.toiDanhKhacIds !== undefined && {
        toiDanhKhacIds: dto.toiDanhKhacIds,
      }),
      ...(scrubbedMetadata !== undefined && {
        metadata: scrubbedMetadata as JsonInput,
      }),
      caseProvenance: effectiveProvenance, // v0.37.2: required (Contract phase enforces non-null)
      ...(dto.sourceDocumentNote !== undefined && {
        sourceDocumentNote: dto.sourceDocumentNote,
      }),
      // v0.44 — UTDT fields
      ...(dto.caseType !== undefined && { caseType: dto.caseType }),
      ...(dto.donViGiao !== undefined && { donViGiao: dto.donViGiao }),
      ...(dto.soQuyetDinhUyThac !== undefined && {
        soQuyetDinhUyThac: dto.soQuyetDinhUyThac,
      }),
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
      // ── Field-parity intake hệ cũ → cột typed (P1: trước đây RỚT ở CREATE — chỉ UPDATE có) ──
      ...(dto.ngayDeXuat !== undefined && {
        ngayDeXuat: dto.ngayDeXuat ? new Date(dto.ngayDeXuat) : null,
      }),
      ...(dto.moTaChiTiet !== undefined && { moTaChiTiet: dto.moTaChiTiet }),
      ...(dto.nguonDon !== undefined && { nguonDon: dto.nguonDon }),
      ...(dto.tenCungCap !== undefined && { tenCungCap: dto.tenCungCap }),
      ...(dto.sinhNamCungCap !== undefined && {
        sinhNamCungCap: dto.sinhNamCungCap,
      }),
      ...(dto.cccdCungCap !== undefined && { cccdCungCap: dto.cccdCungCap }),
      ...(dto.ngayCapCccd !== undefined && {
        ngayCapCccd: dto.ngayCapCccd ? new Date(dto.ngayCapCccd) : null,
      }),
      ...(dto.noiCapCccd !== undefined && { noiCapCccd: dto.noiCapCccd }),
      ...(dto.sdtCungCap !== undefined && { sdtCungCap: dto.sdtCungCap }),
      ...(dto.diaChiCungCap !== undefined && {
        diaChiCungCap: dto.diaChiCungCap,
      }),
      ...(dto.nghiVanDoiTuong !== undefined && {
        nghiVanDoiTuong: dto.nghiVanDoiTuong,
      }),
      ...(dto.nhanXet !== undefined && { nhanXet: dto.nhanXet }),
      ...(dto.noiXayRa !== undefined && { noiXayRa: dto.noiXayRa }),
      ...(dto.phuongThucThuDoan !== undefined && {
        phuongThucThuDoan: dto.phuongThucThuDoan,
      }),
      ...(dto.ketQuaXuLyKhac !== undefined && {
        ketQuaXuLyKhac: dto.ketQuaXuLyKhac,
      }),
      ...(dto.soPhieuChuyen !== undefined && {
        soPhieuChuyen: dto.soPhieuChuyen,
      }),
      ...(dto.ngayPhieuChuyen !== undefined && {
        ngayPhieuChuyen: dto.ngayPhieuChuyen
          ? new Date(dto.ngayPhieuChuyen)
          : null,
      }),
      ...(dto.doVatTaiLieuKemTheo !== undefined && {
        doVatTaiLieuKemTheo: dto.doVatTaiLieuKemTheo,
      }),
      ...(dto.ngayVietDon !== undefined && {
        ngayVietDon: dto.ngayVietDon ? new Date(dto.ngayVietDon) : null,
      }),
      /*
        Hai cột ngày viết đơn kiểu CHỮ — phải ghi cùng chỗ với cột ngày trơn, không tách ra.

        Bỏ sót chúng ở đây là lỗi lượt soát bắt 21/09/2026, và nó không chỉ làm tính năng chết:
        ô nhập ghi `ngayVietDon = ""` khi chữ không đọc ra ngày, nên cán bộ mở hồ sơ CÓ ngày,
        gõ "Không ghi ngày" rồi Lưu là ngày cũ bị xoá NULL còn chữ thay thế không được ghi.
        DTO đã khai hai cột nên `forbidNonWhitelisted` cho qua — không 400, không log, chỉ mất.
      */
      ...(dto.ngayVietDonEdtf !== undefined && {
        ngayVietDonEdtf: dto.ngayVietDonEdtf || null,
      }),
      ...(dto.ngayVietDonChu !== undefined && {
        ngayVietDonChu: dto.ngayVietDonChu?.trim() || null,
      }),
      ...(dto.ghiChuTrungDon !== undefined && {
        ghiChuTrungDon: dto.ghiChuTrungDon,
      }),
      ...(dto.baoCaoBanGiamDoc !== undefined && {
        baoCaoBanGiamDoc: dto.baoCaoBanGiamDoc,
      }),
      ...(dto.ngayGiaoDonViGiaiQuyet !== undefined && {
        ngayGiaoDonViGiaiQuyet: dto.ngayGiaoDonViGiaiQuyet
          ? new Date(dto.ngayGiaoDonViGiaiQuyet)
          : null,
      }),
      ...(dto.lanhDaoToTung !== undefined && {
        lanhDaoToTung: dto.lanhDaoToTung,
      }),
      ...(dto.dieuTraVien !== undefined && { dieuTraVien: dto.dieuTraVien }),
      ...(dto.phanLoaiToiPhamLinhVuc !== undefined && {
        phanLoaiToiPhamLinhVuc: dto.phanLoaiToiPhamLinhVuc,
      }),
      ...(dto.phanLoaiHoSoNoiBo !== undefined && {
        phanLoaiHoSoNoiBo: dto.phanLoaiHoSoNoiBo,
      }),
      ...(dto.deXuat !== undefined && { deXuat: dto.deXuat }),
      ...(dto.yeuCauBoSung !== undefined && { yeuCauBoSung: dto.yeuCauBoSung }),
      // ── Consolidate epic: native metadata → cột typed (plan A0 loại N) ──
      ...(dto.reporterDateOfBirth !== undefined && {
        reporterDateOfBirth: dto.reporterDateOfBirth
          ? new Date(dto.reporterDateOfBirth)
          : null,
      }),
      ...(dto.reporterDateOfBirthPrecision !== undefined && {
        reporterDateOfBirthPrecision: dto.reporterDateOfBirthPrecision,
      }),
      ...(dto.receiveDate !== undefined && {
        receiveDate: dto.receiveDate ? new Date(dto.receiveDate) : null,
      }),
      ...(dto.caseClassification !== undefined && {
        caseClassification: dto.caseClassification,
      }),
      ...(dto.tinhTrang !== undefined && { tinhTrang: dto.tinhTrang }),
      ...(dto.toiDanhBanDau !== undefined && {
        toiDanhBanDau: dto.toiDanhBanDau,
      }),
      // Ô hệ cũ đưa về đúng vị trí trên form (26/08/2026) — dùng chung hàm ánh xạ với
      // nhánh chỉnh sửa để hai đường không thể lệch nhau.
      ...legacyFormParityData(dto as unknown as Record<string, unknown>),
    };

    const caseInclude = {
      investigator: {
        select: { id: true, firstName: true, lastName: true, username: true },
      },
    };

    // Legacy POST /cases source paths use the same current-authority,
    // idempotency, event/outbox and serialization boundary as the dedicated
    // Petition/Incident conversion endpoints.
    if (effectiveProvenance === CaseProvenance.FROM_PETITION) {
      const creation = await this.sourceCreation
        .execute(
          {
            kind: 'Petition',
            sourceId: dto.linkedPetitionId!,
            expectedUpdatedAt: dto.expectedPetitionUpdatedAt,
            payload: { ...dto },
          },
          actorId,
          async (tx, currentSource, context) => {
            const petition = currentSource as Petition;
            if (petition.linkedCaseId)
              throw new ConflictException(
                'Đơn thư đã được liên kết với vụ án khác',
              );

            const manualCaseCode = dto.caseCode?.trim();
            const committedCaseCode = manualCaseCode
              ? await this.docNums.commitWithTx(
                  'CASE',
                  { userId: actorId },
                  tx,
                  { suppliedNumber: manualCaseCode },
                )
              : await this.docNums.commitWithTx(
                  'CASE',
                  { userId: actorId },
                  tx,
                );
            const custom = await this.prepareCreateFields(tx, dto, actorId);
            const newCase = await tx.case.create({
              data: await context.prepare({
                ...baseCaseData,
                ...custom,
                metadata: custom.metadata as JsonInput,
                caseCode: manualCaseCode || committedCaseCode.number,
                linkedPetitionId: petition.id,
              }),
              include: caseInclude,
            });
            await tx.documentNumberLog.update({
              where: { id: committedCaseCode.logId },
              data: { documentId: newCase.id },
            });
            await this.createSubEntitiesInTransaction(
              tx,
              newCase.id,
              dto,
              actorId,
            );
            await tx.petition.update({
              where: {
                id: petition.id,
                updatedAt: petition.updatedAt,
                linkedCaseId: null,
              },
              data: {
                linkedCaseId: newCase.id,
                status: PetitionStatus.DA_CHUYEN_VU_AN,
                ...machMocGiaiQuyet(
                  'petition',
                  petition.status,
                  PetitionStatus.DA_CHUYEN_VU_AN,
                  petition.ngayGiaiQuyet,
                ),
              },
            });
            await this.audit.log(
              {
                userId: actorId,
                action: 'CASE_CREATED',
                subject: 'Case',
                subjectId: newCase.id,
                metadata: {
                  name: newCase.name,
                  status: newCase.status,
                  caseProvenance: effectiveProvenance,
                  linkedPetitionId: petition.id,
                },
                ipAddress: meta?.ipAddress,
                userAgent: meta?.userAgent,
              },
              tx,
            );
            return newCase;
          },
        )
        .catch((error: unknown) => {
          const code = (error as { code?: string })?.code;
          if (code === 'P2002' && dto.caseCode)
            throw new ConflictException('Mã hồ sơ đã tồn tại');
          if (code === 'P2025' || code === 'P2002')
            throw new ConflictException(
              'Đơn thư đã được chỉnh sửa hoặc liên kết; vui lòng tải lại',
            );
          throw error;
        });
      if (!creation.replayed)
        this.eventEmitter.emit(
          'case.created',
          new CaseCreatedEvent(
            creation.caseRecord.id,
            creation.caseRecord.caseCode ?? '',
            actorId,
          ),
        );
      return {
        success: true,
        data: creation.caseRecord,
        message: 'Tạo vụ án thành công',
      };
    }

    if (effectiveProvenance === CaseProvenance.FROM_INCIDENT) {
      const creation = await this.sourceCreation
        .execute(
          {
            kind: 'Incident',
            sourceId: dto.linkedIncidentId!,
            expectedUpdatedAt: dto.expectedIncidentUpdatedAt,
            payload: { ...dto },
          },
          actorId,
          async (tx, currentSource, context) => {
            const incident = currentSource as Incident;
            if (incident.linkedCaseId)
              throw new ConflictException(
                'Vụ việc đã được liên kết với vụ án khác',
              );
            validateIncidentProsecution(
              incident,
              dto.soQuyetDinhKhoiTo,
              dto.ngayKhoiTo,
            );

            const manualCaseCode = dto.caseCode?.trim();
            const committedCaseCode = manualCaseCode
              ? await this.docNums.commitWithTx(
                  'CASE',
                  { userId: actorId },
                  tx,
                  { suppliedNumber: manualCaseCode },
                )
              : await this.docNums.commitWithTx(
                  'CASE',
                  { userId: actorId },
                  tx,
                );
            const custom = await this.prepareCreateFields(tx, dto, actorId);
            const newCase = await tx.case.create({
              data: await context.prepare({
                ...incidentSourceToCase(incident),
                ...baseCaseData,
                ...custom,
                moTaChiTiet: dto.moTaChiTiet ?? incident.description,
                crimeChinhId: dto.crimeChinhId ?? incident.crimeChinhId,
                donViGiaiQuyet:
                  dto.donViGiaiQuyet ?? incident.donViGiaiQuyet,
                metadata: {
                  ...custom.metadata,
                  incidentSourceSnapshot: incidentSourceSnapshot(incident),
                },
                soQuyetDinhKhoiTo: dto.soQuyetDinhKhoiTo!.trim(),
                caseCode: manualCaseCode || committedCaseCode.number,
                linkedIncidentId: incident.id,
              }),
              include: caseInclude,
            });
            await tx.documentNumberLog.update({
              where: { id: committedCaseCode.logId },
              data: { documentId: newCase.id },
            });
            await this.createSubEntitiesInTransaction(
              tx,
              newCase.id,
              dto,
              actorId,
            );
            await tx.incident.update({
              where: {
                id: incident.id,
                updatedAt: incident.updatedAt,
                linkedCaseId: null,
                deletedAt: null,
                intakeStage: incident.intakeStage,
                status: incident.status,
                assignedTeamId: incident.assignedTeamId,
                investigatorId: incident.investigatorId,
              },
              data: {
                linkedCaseId: newCase.id,
                status: IncidentStatus.DA_CHUYEN_VU_AN,
                ...machMocGiaiQuyet(
                  'incident',
                  incident.status,
                  IncidentStatus.DA_CHUYEN_VU_AN,
                  incident.ngayGiaiQuyet,
                ),
              },
            });
            await tx.incidentStatusHistory.create({
              data: {
                incidentId: incident.id,
                fromStatus: incident.status,
                toStatus: IncidentStatus.DA_CHUYEN_VU_AN,
                changedById: actorId,
                note: `Khởi tố thành vụ án: ${newCase.name}`,
              },
            });
            await this.audit.log(
              {
                userId: actorId,
                action: 'INCIDENT_PROSECUTED',
                subject: 'Incident',
                subjectId: incident.id,
                metadata: { caseId: newCase.id, caseName: newCase.name },
                ipAddress: meta?.ipAddress,
                userAgent: meta?.userAgent,
              },
              tx,
            );
            await this.audit.log(
              {
                userId: actorId,
                action: 'CASE_CREATED',
                subject: 'Case',
                subjectId: newCase.id,
                metadata: {
                  name: newCase.name,
                  status: newCase.status,
                  caseProvenance: effectiveProvenance,
                  linkedIncidentId: incident.id,
                },
                ipAddress: meta?.ipAddress,
                userAgent: meta?.userAgent,
              },
              tx,
            );
            return newCase;
          },
        )
        .catch((error: unknown) => {
          const code = (error as { code?: string })?.code;
          if (code === 'P2002' && dto.caseCode)
            throw new ConflictException('Mã hồ sơ đã tồn tại');
          if (code === 'P2025' || code === 'P2002')
            throw new ConflictException(
              'Vụ việc đã được chỉnh sửa hoặc liên kết; vui lòng tải lại',
            );
          throw error;
        });
      if (!creation.replayed)
        this.eventEmitter.emit(
          'case.created',
          new CaseCreatedEvent(
            creation.caseRecord.id,
            creation.caseRecord.caseCode ?? '',
            actorId,
          ),
        );
      return {
        success: true,
        data: creation.caseRecord,
        message: 'Tạo vụ án thành công',
      };
    }

    // ── DIRECT_DISCOVERY / TRANSFERRED / OTHER_LEGAL_SOURCE ──
    // New Case registration keeps source creation explicit; no tab-save side effects.
    let record!: Awaited<ReturnType<typeof this.prisma.case.create>>;
    try {
      record = await this.prisma.$transaction(async (tx: PrismaTx) => {
        // MỘT bộ đếm cho MỘT không gian mã. `cases.caseCode` là @unique trên toàn bảng, nên
        // vụ án và ủy thác dùng chung không gian mã; cấp số từ hai bộ đếm độc lập vào đó là
        // sai về cấu trúc — trước đây chỉ chưa vỡ vì tiền tố `VA-`/`UTDT-` làm hai chuỗi
        // khác nhau. Nay mã thống nhất `năm-stt` (khớp hệ cũ, và 1.611/1.632 hồ sơ ủy thác
        // đã mang dạng ấy) nên tiền tố không còn che được nữa. Đây là ĐẢO quyết định v0.68.
        const manualCaseCode = dto.caseCode?.trim();
        const committedCaseCode = manualCaseCode
          ? await this.docNums.commitWithTx('CASE', { userId: actorId }, tx, {
              suppliedNumber: manualCaseCode,
            })
          : await this.docNums.commitWithTx('CASE', { userId: actorId }, tx);
        const caseCode = manualCaseCode || committedCaseCode.number;

        await this.governance.assertCaseCreation(
          tx,
          { actorId },
          {
            assignedTeamId: baseCaseData.assignedTeamId as
              | string
              | null
              | undefined,
            investigatorId: baseCaseData.investigatorId as
              | string
              | null
              | undefined,
          },
        );
        const custom = await this.prepareCreateFields(tx, dto, actorId);
        const caseRecord = await tx.case.create({
          data: {
            ...baseCaseData,
            ...custom,
            metadata: custom.metadata as JsonInput,
            caseCode,
          },
          include: caseInclude,
        });
        await tx.documentNumberLog.update({
          where: { id: committedCaseCode.logId },
          data: { documentId: caseRecord.id },
        });
        await this.createSubEntitiesInTransaction(
          tx,
          caseRecord.id,
          dto,
          actorId,
        );
        return caseRecord;
      });
    } catch (e: unknown) {
      // P2002 = unique constraint: trùng mã vụ việc (concurrent) HOẶC số quyết định ủy thác (Mẫu 58)
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException(
          'Trùng mã vụ việc hoặc số quyết định ủy thác',
        );
      throw e;
    }

    await this.audit.log({
      userId: actorId,
      action: 'CASE_CREATED',
      subject: 'Case',
      subjectId: record.id,
      metadata: {
        name: record.name,
        status: record.status,
        caseProvenance: effectiveProvenance,
        duplicateAcknowledgedIds: reviewedDuplicateIds,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    this.eventEmitter.emit(
      'case.created',
      new CaseCreatedEvent(record.id, record.caseCode ?? '', actorId),
    );

    const autoLinkedIncident = null;
    return {
      success: true,
      data: {
        ...(await this.serializeCase(record, actorId)),
        autoLinkedIncident,
      },
      message: 'Tạo vụ án thành công',
    };
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
    if (
      dto.name !== undefined &&
      (typeof dto.name !== 'string' || !dto.name.trim())
    )
      throw new BadRequestException('Case name is required');
    const existing = await this.prisma.case.findFirst({
      where: { id, deletedAt: null },
      include: { statistic: true },
    });

    if (!existing) {
      throw new NotFoundException(`Vụ án không tồn tại (id: ${id})`);
    }

    this.checkWriteScope(existing, dataScope);
    if (
      dto.metadata &&
      Object.prototype.hasOwnProperty.call(dto.metadata, 'sensitivity') &&
      dto.metadata.sensitivity !==
        (existing.metadata as Record<string, unknown> | null)?.sensitivity
    )
      throw new BadRequestException('Classify sensitivity through governance');
    dto = normalizeCanonicalCaseWrite(
      dto as unknown as Record<string, unknown>,
      existing.metadata,
    ) as unknown as UpdateCaseDto;

    let reviewedDuplicateIds: string[] = [];
    const nameChanged = Boolean(
      dto.name && boDauTimKiem(dto.name) !== boDauTimKiem(existing.name),
    );
    const decisionChanged =
      dto.soQuyetDinhUyThac !== undefined &&
      dto.soQuyetDinhUyThac?.trim() !== existing.soQuyetDinhUyThac?.trim();
    if (nameChanged || decisionChanged) {
      reviewedDuplicateIds = assertReviewedCandidates(
        await this.findDuplicateCandidates(
          dto.name ?? existing.name,
          existing.caseType,
          id,
          dataScope,
          dto.soQuyetDinhUyThac ?? existing.soQuyetDinhUyThac ?? undefined,
          actorId,
        ),
        dto.acknowledgedDuplicateIds,
      );
    }

    if (existing.caseType === CaseType.UY_THAC_DIEU_TRA) {
      const nextMetadata =
        dto.metadata === undefined
          ? existing.metadata
          : {
              ...((existing.metadata as Record<string, unknown> | null) ?? {}),
              ...dto.metadata,
            };
      if (
        shouldRejectUtdtReplyConflict(existing, {
          metadata: nextMetadata,
          ketQuaUyThac:
            dto.ketQuaUyThac === undefined
              ? existing.ketQuaUyThac
              : dto.ketQuaUyThac,
        })
      ) {
        throw new BadRequestException(CASE_MESSAGES.utdt.replyConflict);
      }
    }

    if (dto.investigatorId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.investigatorId },
      });
      if (!user) {
        throw new BadRequestException('Điều tra viên không tồn tại');
      }
    }

    // ── TAM_DINH_CHI validation & auto-fields ─────────────────────────────────
    if (
      dto.status === CaseStatus.TAM_DINH_CHI &&
      dto.status !== existing.status
    ) {
      if (!dto.lyDoTamDinhChiVuAn?.length)
        throw new BadRequestException('Suspension reason required');
      civilDate(dto.ngayTamDinhChi);
    }

    const updateData: Prisma.CaseUncheckedUpdateInput = {
      ...(dto.caseCode !== undefined && { caseCode: dto.caseCode.trim() }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.crime !== undefined && { crime: dto.crime }),
      ...(dto.crimeChinhId !== undefined && {
        crimeChinhId: dto.crimeChinhId || null,
      }),
      ...(dto.status !== undefined && { status: dto.status }),
      // Đóng mốc giải quyết cùng lúc với trạng thái. Báo cáo "đã giải quyết" đọc cột này;
      // đổi trạng thái mà quên mốc thì hồ sơ xong việc vẫn không vào kỳ nào.
      ...(dto.status !== undefined &&
        machMocGiaiQuyet(
          'case',
          existing.status,
          dto.status,
          existing.ngayGiaiQuyet,
        )),
      ...(dto.investigatorId !== undefined && {
        investigatorId: dto.investigatorId,
      }),
      ...(dto.deadline !== undefined && {
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      }),
      ...(dto.unit !== undefined && { unit: dto.unit }),
      // Sửa hồ sơ cũng phải ghi được ô "Đơn vị giải quyết". Thiếu dòng này thì cán bộ sửa,
      // bấm Lưu, thấy báo thành công — và giá trị cũ vẫn nguyên.
      ...(dto.donViGiaiQuyet !== undefined && {
        donViGiaiQuyet: dto.donViGiaiQuyet,
      }),
      ...(dto.subjectsCount !== undefined && {
        subjectsCount: dto.subjectsCount,
      }),
      // MERGE (không REPLACE): giữ mọi field metadata cũ (di trú) + ghi đè field được sửa
      // → sửa 1 field KHÔNG bao giờ xóa field khác (an toàn data pháp lý).
      ...(dto.metadata !== undefined && {
        metadata: dto.metadata as JsonInput,
      }),
      ...(dto.capDoToiPham !== undefined && { capDoToiPham: dto.capDoToiPham }),
      ...(dto.ngayKhoiTo !== undefined && {
        ngayKhoiTo: dto.ngayKhoiTo ? new Date(dto.ngayKhoiTo) : null,
      }),
      // ── Field-parity: số QĐ giai đoạn vụ án ──
      ...(dto.soQuyetDinhKhoiTo !== undefined && {
        soQuyetDinhKhoiTo: dto.soQuyetDinhKhoiTo,
      }),
      ...(dto.soQDNhapVuAn !== undefined && { soQDNhapVuAn: dto.soQDNhapVuAn }),
      ...(dto.ngayNhapVuAn !== undefined && {
        ngayNhapVuAn: dto.ngayNhapVuAn ? new Date(dto.ngayNhapVuAn) : null,
      }),
      ...(dto.ghiChuNhapHoSo !== undefined && {
        ghiChuNhapHoSo: dto.ghiChuNhapHoSo,
      }),
      ...(dto.soQDTachVuAn !== undefined && { soQDTachVuAn: dto.soQDTachVuAn }),
      ...(dto.ngayTachVuAn !== undefined && {
        ngayTachVuAn: dto.ngayTachVuAn ? new Date(dto.ngayTachVuAn) : null,
      }),
      ...(dto.soQDTachHanhVi !== undefined && {
        soQDTachHanhVi: dto.soQDTachHanhVi,
      }),
      ...(dto.ngayTachHanhVi !== undefined && {
        ngayTachHanhVi: dto.ngayTachHanhVi
          ? new Date(dto.ngayTachHanhVi)
          : null,
      }),
      ...(dto.soQDDinhChiVuAn !== undefined && {
        soQDDinhChiVuAn: dto.soQDDinhChiVuAn,
      }),
      ...(dto.ngayDinhChiVuAn !== undefined && {
        ngayDinhChiVuAn: dto.ngayDinhChiVuAn
          ? new Date(dto.ngayDinhChiVuAn)
          : null,
      }),
      ...(dto.chuyenVuAnChoCQK !== undefined && {
        chuyenVuAnChoCQK: dto.chuyenVuAnChoCQK,
      }),
      ...(dto.soBanAnCoHieuLuc !== undefined && {
        soBanAnCoHieuLuc: dto.soBanAnCoHieuLuc,
      }),
      ...(dto.ngayBanAnCoHieuLuc !== undefined && {
        ngayBanAnCoHieuLuc: dto.ngayBanAnCoHieuLuc
          ? new Date(dto.ngayBanAnCoHieuLuc)
          : null,
      }),
      ...(dto.canCuTamDinhChiVuAn !== undefined && {
        canCuTamDinhChiVuAn: dto.canCuTamDinhChiVuAn,
      }),
      ...(dto.canCuPhucHoiVuAn !== undefined && {
        canCuPhucHoiVuAn: dto.canCuPhucHoiVuAn,
      }),
      // ── Field-parity KLĐT + QĐ điều tra lại ──
      ...(dto.soKLDT !== undefined && { soKLDT: dto.soKLDT }),
      ...(dto.ngayKLDT !== undefined && {
        ngayKLDT: dto.ngayKLDT ? new Date(dto.ngayKLDT) : null,
      }),
      ...(dto.soQDDieuTraLai !== undefined && {
        soQDDieuTraLai: dto.soQDDieuTraLai,
      }),
      ...(dto.ngayQDDieuTraLai !== undefined && {
        ngayQDDieuTraLai: dto.ngayQDDieuTraLai
          ? new Date(dto.ngayQDDieuTraLai)
          : null,
      }),
      // ── PR-M2: ghi chú tự do + tội danh khác (multi) ──
      ...(dto.ghiChuKhac !== undefined && { ghiChuKhac: dto.ghiChuKhac }),
      ...(dto.toiDanhKhacIds !== undefined && {
        toiDanhKhacIds: dto.toiDanhKhacIds,
      }),
      // ── TĐC fields ──────────────────────────────────────────────────────────
      ...((dto as Record<string, unknown>).lyDoTamDinhChiVuAn !== undefined && {
        lyDoTamDinhChiVuAn: (dto as Record<string, unknown>)
          .lyDoTamDinhChiVuAn as LyDoTamDinhChiVuAn[],
      }),
      ...((dto as Record<string, unknown>).soQuyetDinhTamDinhChi !==
        undefined && {
        soQuyetDinhTamDinhChi: (dto as Record<string, unknown>)
          .soQuyetDinhTamDinhChi as string | null,
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
        soQuyetDinhPhucHoi: (dto as Record<string, unknown>)
          .soQuyetDinhPhucHoi as string | null,
      }),
      ...((dto as Record<string, unknown>).ngayPhucHoi !== undefined && {
        ngayPhucHoi: (dto as Record<string, unknown>).ngayPhucHoi
          ? new Date((dto as Record<string, unknown>).ngayPhucHoi as string)
          : null,
      }),
      ...((dto as Record<string, unknown>).ketQuaPhucHoiVuAn !== undefined && {
        ketQuaPhucHoiVuAn: (dto as Record<string, unknown>)
          .ketQuaPhucHoiVuAn as KetQuaPhucHoiVuAn | null,
      }),
      ...((dto as Record<string, unknown>).lyDoTamDinhChiText !== undefined && {
        lyDoTamDinhChiText: (dto as Record<string, unknown>)
          .lyDoTamDinhChiText as string | null,
      }),
      // Field-parity tab "Vụ án TĐC" — persist khi EDIT (trước service chưa spread → không lưu được).
      ...((dto as Record<string, unknown>).ngayHetThoiHieu !== undefined && {
        ngayHetThoiHieu: (dto as Record<string, unknown>).ngayHetThoiHieu
          ? new Date((dto as Record<string, unknown>).ngayHetThoiHieu as string)
          : null,
      }),
      ...((dto as Record<string, unknown>).tdcKhacPhucLyDoBienPhap !==
        undefined && {
        tdcKhacPhucLyDoBienPhap: (dto as Record<string, unknown>)
          .tdcKhacPhucLyDoBienPhap as string | null,
      }),
      ...((dto as Record<string, unknown>).tdcKhacPhucBienBan !== undefined && {
        tdcKhacPhucBienBan: (dto as Record<string, unknown>)
          .tdcKhacPhucBienBan as string | null,
      }),
      // v0.44.2 — UTDT top-level fields (persist through edit mode)
      ...(dto.caseType !== undefined && { caseType: dto.caseType }),
      ...(dto.donViGiao !== undefined && { donViGiao: dto.donViGiao }),
      ...(dto.soQuyetDinhUyThac !== undefined && {
        soQuyetDinhUyThac: dto.soQuyetDinhUyThac,
      }),
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
      ...(dto.ngayDeXuat !== undefined && {
        ngayDeXuat: dto.ngayDeXuat ? new Date(dto.ngayDeXuat) : null,
      }),
      ...(dto.moTaChiTiet !== undefined && { moTaChiTiet: dto.moTaChiTiet }),
      ...(dto.nguonDon !== undefined && { nguonDon: dto.nguonDon }),
      ...(dto.tenCungCap !== undefined && { tenCungCap: dto.tenCungCap }),
      ...(dto.sinhNamCungCap !== undefined && {
        sinhNamCungCap: dto.sinhNamCungCap,
      }),
      ...(dto.cccdCungCap !== undefined && { cccdCungCap: dto.cccdCungCap }),
      ...(dto.ngayCapCccd !== undefined && {
        ngayCapCccd: dto.ngayCapCccd ? new Date(dto.ngayCapCccd) : null,
      }),
      ...(dto.noiCapCccd !== undefined && { noiCapCccd: dto.noiCapCccd }),
      ...(dto.sdtCungCap !== undefined && { sdtCungCap: dto.sdtCungCap }),
      ...(dto.diaChiCungCap !== undefined && {
        diaChiCungCap: dto.diaChiCungCap,
      }),
      ...(dto.nghiVanDoiTuong !== undefined && {
        nghiVanDoiTuong: dto.nghiVanDoiTuong,
      }),
      ...(dto.nhanXet !== undefined && { nhanXet: dto.nhanXet }),
      ...(dto.noiXayRa !== undefined && { noiXayRa: dto.noiXayRa }),
      ...(dto.phuongThucThuDoan !== undefined && {
        phuongThucThuDoan: dto.phuongThucThuDoan,
      }),
      ...(dto.ketQuaXuLyKhac !== undefined && {
        ketQuaXuLyKhac: dto.ketQuaXuLyKhac,
      }),
      ...(dto.soPhieuChuyen !== undefined && {
        soPhieuChuyen: dto.soPhieuChuyen,
      }),
      ...(dto.ngayPhieuChuyen !== undefined && {
        ngayPhieuChuyen: dto.ngayPhieuChuyen
          ? new Date(dto.ngayPhieuChuyen)
          : null,
      }),
      ...(dto.doVatTaiLieuKemTheo !== undefined && {
        doVatTaiLieuKemTheo: dto.doVatTaiLieuKemTheo,
      }),
      ...(dto.ngayVietDon !== undefined && {
        ngayVietDon: dto.ngayVietDon ? new Date(dto.ngayVietDon) : null,
      }),
      /*
        Hai cột ngày viết đơn kiểu CHỮ — phải ghi cùng chỗ với cột ngày trơn, không tách ra.

        Bỏ sót chúng ở đây là lỗi lượt soát bắt 21/09/2026, và nó không chỉ làm tính năng chết:
        ô nhập ghi `ngayVietDon = ""` khi chữ không đọc ra ngày, nên cán bộ mở hồ sơ CÓ ngày,
        gõ "Không ghi ngày" rồi Lưu là ngày cũ bị xoá NULL còn chữ thay thế không được ghi.
        DTO đã khai hai cột nên `forbidNonWhitelisted` cho qua — không 400, không log, chỉ mất.
      */
      ...(dto.ngayVietDonEdtf !== undefined && {
        ngayVietDonEdtf: dto.ngayVietDonEdtf || null,
      }),
      ...(dto.ngayVietDonChu !== undefined && {
        ngayVietDonChu: dto.ngayVietDonChu?.trim() || null,
      }),
      ...(dto.ghiChuTrungDon !== undefined && {
        ghiChuTrungDon: dto.ghiChuTrungDon,
      }),
      ...(dto.baoCaoBanGiamDoc !== undefined && {
        baoCaoBanGiamDoc: dto.baoCaoBanGiamDoc,
      }),
      ...(dto.ngayGiaoDonViGiaiQuyet !== undefined && {
        ngayGiaoDonViGiaiQuyet: dto.ngayGiaoDonViGiaiQuyet
          ? new Date(dto.ngayGiaoDonViGiaiQuyet)
          : null,
      }),
      ...(dto.lanhDaoToTung !== undefined && {
        lanhDaoToTung: dto.lanhDaoToTung,
      }),
      ...(dto.dieuTraVien !== undefined && { dieuTraVien: dto.dieuTraVien }),
      ...(dto.phanLoaiToiPhamLinhVuc !== undefined && {
        phanLoaiToiPhamLinhVuc: dto.phanLoaiToiPhamLinhVuc,
      }),
      ...(dto.phanLoaiHoSoNoiBo !== undefined && {
        phanLoaiHoSoNoiBo: dto.phanLoaiHoSoNoiBo,
      }),
      ...(dto.deXuat !== undefined && { deXuat: dto.deXuat }),
      ...(dto.yeuCauBoSung !== undefined && { yeuCauBoSung: dto.yeuCauBoSung }),
      // ── Consolidate epic: native metadata → cột typed (plan A0 loại N) ──
      ...((dto as Record<string, unknown>).reporterDateOfBirth !==
        undefined && {
        reporterDateOfBirth: (dto as Record<string, unknown>)
          .reporterDateOfBirth
          ? new Date(
              (dto as Record<string, unknown>).reporterDateOfBirth as string,
            )
          : null,
      }),
      ...((dto as Record<string, unknown>).reporterDateOfBirthPrecision !==
        undefined && {
        reporterDateOfBirthPrecision: (dto as Record<string, unknown>)
          .reporterDateOfBirthPrecision as string | null,
      }),
      ...((dto as Record<string, unknown>).receiveDate !== undefined && {
        receiveDate: (dto as Record<string, unknown>).receiveDate
          ? new Date((dto as Record<string, unknown>).receiveDate as string)
          : null,
      }),
      ...((dto as Record<string, unknown>).caseClassification !== undefined && {
        caseClassification: (dto as Record<string, unknown>)
          .caseClassification as string | null,
      }),
      ...((dto as Record<string, unknown>).tinhTrang !== undefined && {
        tinhTrang: (dto as Record<string, unknown>).tinhTrang as string | null,
      }),
      ...((dto as Record<string, unknown>).toiDanhBanDau !== undefined && {
        toiDanhBanDau: (dto as Record<string, unknown>).toiDanhBanDau as
          | string
          | null,
      }),
      // Ô hệ cũ đưa về đúng vị trí trên form (26/08/2026) — cùng hàm ánh xạ với nhánh tạo
      // mới, nên tạo được thì sửa cũng được.
      ...legacyFormParityData(dto as unknown as Record<string, unknown>),
    };

    // Auto-set ngayTamDinhChi and increment soLanTamDinhChi when transitioning TO TAM_DINH_CHI
    if (
      dto.status === CaseStatus.TAM_DINH_CHI &&
      dto.status !== existing.status
    ) {
      if (
        !updateData.ngayTamDinhChi ||
        !Number.isFinite(
          new Date(updateData.ngayTamDinhChi as string).getTime(),
        )
      ) {
        throw new BadRequestException(
          'A real suspension decision date is required',
        );
      }
      updateData.soLanTamDinhChi = { increment: 1 };
    }

    // v0.30: CASE_UPDATED via wrapUpdate so audit captures full before/after for inline diff.
    // The fetchFn re-reads full Case (relations included); +1 SELECT/update — negligible.
    // P2025 try/catch wraps the whole wrapUpdate call to preserve optimistic-lock translation.
    // MỘT giao dịch: vụ án + nhật ký sửa + mục con THÊM trong lúc sửa (đối tượng, vật chứng, tài liệu) + thống
    // kê mở rộng. Trước 19/09/2026 `update` không đọc ba mảng mục con — form sửa báo "Cập nhật thành công" mà
    // mục vừa thêm biến mất (tồn đọng PR #217/#220). Mảng trong PUT là mục THÊM MỚI: form sửa không nạp mục cũ
    // vào tab nên không bao giờ gửi lại chúng. Hỏng một mục thì vụ án cũng không đổi.
    const chonDieuTraVien = {
      investigator: {
        select: { id: true, firstName: true, lastName: true, username: true },
      },
    } as const;
    // Khoá lạc quan: chỉ ghi khi vụ án chưa bị ai sửa từ lúc form mở (P2025 → 409 bên dưới).
    const mocDaMo = dto.expectedUpdatedAt;
    const khoaLacQuan = {
      updatedAt: mocDaMo ? new Date(mocDaMo) : existing.updatedAt,
      status: existing.status,
      intakeStage: existing.intakeStage,
      investigatorId: existing.investigatorId,
      assignedTeamId: existing.assignedTeamId,
      deletedAt: null,
      governanceRevision: existing.governanceRevision,
      sensitivity: existing.sensitivity,
    };
    let record: Prisma.CaseGetPayload<{ include: typeof chonDieuTraVien }>;
    try {
      record = await this.prisma.$transaction(async (tx) => {
        await this.lockCase(tx, id);
        const currentCase = await this.governance.assertCaseWritable(tx, id, {
          actorId,
        });
        const flag = await tx.featureFlag.findUnique({
          where: { key: 'CASE_GOVERNANCE_V1' },
        });
        const adopted =
          !!currentCase.governanceRuleVersionId ||
          !!currentCase.fieldDefinitionVersionId ||
          currentCase.governanceRevision > 0;
        if (
          adopted &&
          dto.status !== undefined &&
          dto.status !== currentCase.status
        )
          throw new BadRequestException(
            'Use a governed legal action; recovery mode preserves adopted Case state',
          );
        if (adopted) {
          const legalColumns = [
            'deadline',
            'ngayKhoiTo',
            'ngayTamDinhChi',
            'ngayPhucHoi',
            'ngayDinhChiVuAn',
            'ngayKLDT',
            'ngayQDDieuTraLai',
            'ngayTachVuAn',
            'ngayTachHanhVi',
            'soLanTamDinhChi',
            'soLanGiaHan',
            'lyDoTamDinhChiVuAn',
            'lyDoTamDinhChiText',
            'canCuTamDinhChiVuAn',
            'canCuPhucHoiVuAn',
            'ketQuaPhucHoiVuAn',
            'soQuyetDinhTamDinhChi',
            'soQuyetDinhPhucHoi',
            'soQDDinhChiVuAn',
            'soKLDT',
            'soQDDieuTraLai',
            'soQDTachVuAn',
            'soQDTachHanhVi',
            'chuyenVuAnChoCQK',
          ];
          const before = currentCase as unknown as Record<string, unknown>;
          const next = updateData as unknown as Record<string, unknown>;
          const normalized = (value: unknown) =>
            value instanceof Date
              ? value.toISOString()
              : JSON.stringify(value ?? null);
          if (
            legalColumns.some(
              (key) =>
                next[key] !== undefined &&
                normalized(next[key]) !== normalized(before[key]),
            )
          )
            throw new BadRequestException(
              'Use a governed legal action to change adopted legal dates, reasons or deadlines',
            );
        }
        const ownerChanged =
          (dto.investigatorId !== undefined &&
            dto.investigatorId !== existing.investigatorId) ||
          (dto.assignedTeamId !== undefined &&
            dto.assignedTeamId !== existing.assignedTeamId);
        if (ownerChanged) {
          if (flag?.enabled)
            throw new BadRequestException(
              'Use the assignment action for investigators or handoff for another team',
            );
          await this.governance.assertCaseAssignable(tx, id, { actorId });
          const targetTeam =
            dto.assignedTeamId === undefined
              ? existing.assignedTeamId
              : dto.assignedTeamId;
          const targetInvestigator =
            dto.investigatorId === undefined
              ? existing.investigatorId
              : dto.investigatorId;
          await this.governance.validateAssignmentTarget(
            tx,
            targetTeam ?? null,
            targetInvestigator ?? null,
          );
          if (dto.assignedTeamId !== undefined)
            updateData.assignedTeamId = dto.assignedTeamId;
          await this.audit.log(
            {
              userId: actorId,
              action: 'CASE_ASSIGNED',
              subject: 'Case',
              subjectId: id,
              metadata: {
                fromTeamId: existing.assignedTeamId,
                toTeamId: targetTeam ?? null,
                fromInvestigatorId: existing.investigatorId,
                toInvestigatorId: targetInvestigator ?? null,
              },
            },
            tx,
          );
        }
        if (
          flag?.enabled &&
          (!dto.expectedUpdatedAt ||
            (dto.status !== undefined && dto.status !== existing.status))
        )
          throw new BadRequestException(
            'Governed Case changes require versioned legal commands',
          );
        const custom = await this.fieldSchema.validateForWrite(
          tx,
          dto as unknown as {
            metadata?: unknown;
            fieldDefinitionVersionId?: unknown;
          },
          existing,
          { actorId },
        );
        updateData.metadata = custom.metadata as JsonInput;
        updateData.fieldDefinitionVersionId = custom.fieldDefinitionVersionId;
        const sau = await this.audit.wrapUpdate<
          Prisma.CaseGetPayload<{
            include: typeof chonDieuTraVien;
          }>
        >({
          fetchFn: async () => {
            const before = await tx.case.findUnique({
              where: { id },
              include: chonDieuTraVien,
            });
            if (!before) throw new NotFoundException('Case not found');
            return before;
          },
          updateFn: () =>
            tx.case.update({
              where: { id, ...khoaLacQuan },
              data: updateData,
              include: chonDieuTraVien,
            }),
          action: 'CASE_UPDATED',
          subject: 'Case',
          subjectId: id,
          userId: actorId,
          meta: { ipAddress: meta?.ipAddress, userAgent: meta?.userAgent },
          tx,
        });
        await this.createSubEntitiesInTransaction(
          tx,
          id,
          dto as CreateCaseDto,
          actorId,
        );
        // Ghi nhận riêng khi đổi trạng thái
        if (dto.status !== undefined && dto.status !== existing.status) {
          await tx.caseStatusHistory.create({
            data: {
              caseId: id,
              fromStatus: existing.status,
              toStatus: dto.status,
              changedById: actorId ?? null,
            },
          });
          await this.audit.log(
            {
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
            },
            tx,
          );
        }

        return sau;
      });
    } catch (e) {
      if (
        (e as { code?: string })?.code === 'P2002' &&
        dto.caseCode !== undefined
      ) {
        throw new ConflictException('Mã hồ sơ đã tồn tại');
      }
      if ((e as { code?: string })?.code === 'P2025') {
        throw new ConflictException(
          'Hồ sơ đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    // v0.37.2.5: Sync petitionType with EXISTING linked Petition only.
    // Phantom Petition auto-create REMOVED (BLTTHS Đ.143 compliance — provenance
    // model in v0.37.1 forbids creating Petition records as a side-effect of
    // Case mutations). If a caller sends metadata.petitionType but no Petition
    // is linked, the value is silently ignored.
    const updatedMetadata = dto.metadata;
    const newPetitionType = updatedMetadata?.petitionType as
      | LoaiDon
      | undefined;
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

    // v0.30: CASE_UPDATED audit moved into wrapUpdate above. KEEP CASE_STATUS_CHANGED + PETITION_AUTO_CREATED.

    if (reviewedDuplicateIds.length > 0) {
      await this.audit.log({
        userId: actorId,
        action: 'CASE_DUPLICATE_REVIEW_ACKNOWLEDGED',
        subject: 'Case',
        subjectId: id,
        metadata: { candidateIds: reviewedDuplicateIds },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
    }

    return {
      success: true,
      data: await this.serializeCase(record, actorId),
      message: 'Cập nhật vụ án thành công',
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
        await this.lockCase(tx, id);
        await this.governance.assertCaseWritable(tx, id, { actorId });
        if (
          await tx.caseEvidenceHold.count({
            where: { caseId: id, releasedAt: null },
          })
        )
          throw new ConflictException(
            'Active evidence hold protects this case',
          );
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
    actorId?: string,
  ): Promise<DeleteCasePreflightResponse> {
    await this.authorizeRead(id, actorId);
    const existing = await this.prisma.case.findFirst({
      where: { id, deletedAt: null },
      include: {
        subjects: { where: { deletedAt: null }, select: { id: true } },
        lawyers: { where: { deletedAt: null }, select: { id: true } },
        conclusions: { where: { deletedAt: null }, select: { id: true } },
        documents: { where: { deletedAt: null }, select: { id: true } },
        linkedIncidents: {
          where: { deletedAt: null },
          select: { id: true, code: true, name: true },
        },
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
    if (blockers.subjects > 0)
      reasonsIfBlocked.push(`${blockers.subjects} đối tượng đang liên kết.`);
    if (blockers.lawyers > 0)
      reasonsIfBlocked.push(`${blockers.lawyers} luật sư đang liên kết.`);
    if (blockers.conclusions > 0)
      reasonsIfBlocked.push(`${blockers.conclusions} kết luận điều tra.`);
    if (blockers.documents > 0)
      reasonsIfBlocked.push(`${blockers.documents} tài liệu đính kèm.`);

    return {
      canDelete: reasonsIfBlocked.length === 0,
      status: existing.status,
      blockers,
      willUnlink: {
        incidents: existing.linkedIncidents as Array<{
          id: string;
          code: string;
          name: string;
        }>,
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
        await this.lockCase(tx, id);
        await this.governance.assertCaseRestorable(tx, id, { actorId });
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
  async listDeleted(
    query: {
      limit?: number;
      offset?: number;
      search?: string;
      tk?: string[];
    },
    actorId?: string,
  ) {
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;

    const where: Prisma.CaseWhereInput = { deletedAt: { not: null } };
    // CÙNG helper với danh sách chính (gồm mã hồ sơ — bản cũ tìm `id` thay cho mã): `search` cũ → thẻ
    // "*", `tk` → thẻ theo cột (màn Khôi phục), khoá lạ 400. Hồ sơ đã xoá vẫn có cột bóng do trigger giữ.
    noiVaoWhere(
      where as Record<string, unknown>,
      await this.timKiem.dieuKien({ search: query.search, tk: query.tk }),
    );

    if (actorId)
      noiVaoWhere(where as Record<string, unknown>, [
        await this.governance.readableCaseWhere(
          this.prisma,
          { actorId },
          { includeDeleted: true },
        ),
      ]);
    else
      noiVaoWhere(where as Record<string, unknown>, [
        await this.visibilityWhere(),
      ]);
    const [data, total] = await Promise.all([
      this.prisma.case.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip: offset,
        take: limit,
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
      }),
      this.prisma.case.count({ where }),
    ]);

    // Enrich với audit của delete gần nhất (batched, single query — no N+1)
    const ids = data.map((c) => c.id);
    const deleteAudits =
      ids.length > 0
        ? await this.prisma.$queryRaw<
            Array<{
              subjectId: string;
              userId: string | null;
              metadata: unknown;
              createdAt: Date;
            }>
          >`
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
    if (!existing)
      throw new NotFoundException(`Vụ án không tồn tại (id: ${id})`);

    const governanceFlag = await this.prisma.featureFlag.findUnique({
      where: { key: 'CASE_GOVERNANCE_V1' },
    });
    if (governanceFlag?.enabled) {
      const caseVersion = dto.expectedUpdatedAt;
      if (!caseVersion || !Number.isFinite(new Date(caseVersion).getTime()))
        throw new BadRequestException('Assignment case version required');
      return this.governance.mutateAssignment(
        {
          caseId: id,
          operation: 'CASE_ASSIGN',
          requestKey: dto.requestKey ?? '',
          expectedUpdatedAt: new Date(caseVersion).toISOString(),
          payload: {
            assignedTeamId: dto.assignedTeamId,
            investigatorId: dto.investigatorId ?? null,
          },
        },
        { actorId },
        async (tx, { caseRecord, operationId }) => {
          if (
            caseRecord.assignedTeamId &&
            caseRecord.assignedTeamId !== dto.assignedTeamId
          )
            throw new BadRequestException('Use handoff for a different team');
          await this.governance.validateAssignmentTarget(
            tx,
            dto.assignedTeamId,
            dto.investigatorId ?? null,
          );
          const assigned = await tx.case.update({
            where: { id },
            data: {
              assignedTeamId: dto.assignedTeamId,
              investigatorId: dto.investigatorId ?? null,
            },
          });
          await this.governance.recordEvent(
            tx,
            id,
            operationId,
            actorId,
            'ASSIGNED',
            {
              fromTeamId: caseRecord.assignedTeamId,
              toTeamId: dto.assignedTeamId,
              fromInvestigatorId: caseRecord.investigatorId,
              toInvestigatorId: dto.investigatorId ?? null,
            },
          );
          await this.governance.enqueue(
            tx,
            id,
            operationId,
            { type: 'CASE_ASSIGNED' },
            dto.investigatorId ? [dto.investigatorId] : [],
          );
          return { success: true, data: assigned };
        },
      );
    }
    const team = await this.prisma.team.findFirst({
      where: { id: dto.assignedTeamId, isActive: true },
    });
    if (!team)
      throw new BadRequestException(
        `Tổ điều tra không tồn tại hoặc đã ngừng hoạt động (id: ${dto.assignedTeamId})`,
      );

    if (dto.investigatorId) {
      const member = await this.prisma.userTeam.findFirst({
        where: { userId: dto.investigatorId, teamId: dto.assignedTeamId },
      });
      if (!member)
        throw new BadRequestException(
          'Điều tra viên không thuộc tổ được chỉ định',
        );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.lockCase(tx, id);
        const snapshot = await this.governance.assertCaseAssignable(tx, id, {
          actorId,
        });
        await this.governance.validateAssignmentTarget(
          tx,
          dto.assignedTeamId,
          dto.investigatorId ?? null,
        );
        await tx.case.update({
          where: {
            id,
            updatedAt: dto.expectedUpdatedAt ?? existing.updatedAt,
            intakeStage: snapshot.intakeStage,
            governanceRevision: snapshot.governanceRevision,
            status: existing.status,
            assignedTeamId: existing.assignedTeamId,
            investigatorId: existing.investigatorId,
            deletedAt: null,
          },
          data: {
            assignedTeamId: dto.assignedTeamId,
            investigatorId: dto.investigatorId ?? null,
          },
        });
        await this.audit.log(
          {
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
          },
          tx,
        );
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2025') {
        throw new ConflictException(
          'Vụ án đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.',
        );
      }
      throw e;
    }

    if (dto.investigatorId && dto.investigatorId !== existing.investigatorId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { firstName: true, lastName: true },
      });
      const byUserName = actor
        ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim()
        : '';
      this.eventEmitter.emit(
        'case.assigned',
        new CaseAssignedEvent(
          id,
          existing.caseCode ?? '',
          dto.investigatorId,
          actorId,
          byUserName,
        ),
      );
    }

    // v0.35a: emit CASE_ESCALATED_FROM_WARD nếu ward team → non-ward team.
    // Scope filter (v0.33) tự lock CAP ra khỏi access. Audit cho supervisor visibility.
    const existingWithTeam = existing as typeof existing & {
      assignedTeam: {
        wardId: string | null;
        ward: { name: string } | null;
      } | null;
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
  async tdcBackfill(
    id: string,
    lyDoTamDinhChiVuAn: LyDoTamDinhChiVuAn,
    userId: string,
    dataScope?: DataScope | null,
  ) {
    // Bỏ qua vụ án đã xoá mềm (trước đây sửa được cả vụ án trong thùng rác).
    const caseRecord = await this.prisma.case.findFirst({
      where: { id, deletedAt: null },
    });
    if (!caseRecord) throw new NotFoundException('Case not found');
    // Trước 19/09/2026 không kiểm phạm vi: có quyền `write Case` là sửa lý do TĐC của MỌI vụ án.
    await this.governance.assertCaseWritable(this.prisma, id, {
      actorId: userId,
    });
    this.checkWriteScope(caseRecord, dataScope);
    const sau = await this.prisma.case.update({
      where: { id },
      // PR-8: cột nay là mảng — wrap giá trị đơn vào mảng 1 phần tử.
      data: { lyDoTamDinhChiVuAn: [lyDoTamDinhChiVuAn] },
    });
    await this.audit.log({
      userId,
      action: 'CASE_TDC_BACKFILLED',
      subject: 'Case',
      subjectId: id,
      metadata: {
        truoc: caseRecord.lyDoTamDinhChiVuAn ?? null,
        sau: [lyDoTamDinhChiVuAn],
      },
    });
    return sau;
  }

  /** Vụ án phải tồn tại (404) và nằm trong phạm vi XEM (403) — cùng luật với xem chi tiết. */
  private async kiemXemVuAn(
    id: string,
    dataScope?: DataScope | null,
    actorId?: string,
  ) {
    await this.authorizeRead(id, actorId);
    const vuAn = await this.prisma.case.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, assignedTeamId: true, investigatorId: true },
    });
    if (!vuAn) throw new NotFoundException(`Vụ án không tồn tại (id: ${id})`);
    this.checkRecordInScope(vuAn, dataScope);
  }

  /**
   * MỌI đối tượng chưa xoá của vụ án — CHỈ ĐỌC, cho form sửa hiện "đã có". KHÔNG giới hạn số dòng như GET /subjects
   * (tối đa 100): danh sách "đã có" mà thiếu người thì cán bộ nhập lại, sinh bản trùng (rà mã 19/09/2026).
   */
  async getSubjectsDaCo(
    id: string,
    dataScope?: DataScope | null,
    actorId?: string,
  ) {
    await this.kiemXemVuAn(id, dataScope, actorId);
    const data = await this.prisma.subject.findMany({
      where: { caseId: id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fullName: true,
        type: true,
        dateOfBirth: true,
        gender: true,
        idNumber: true,
        address: true,
        phone: true,
        occupationId: true,
        nationalityId: true,
        crimeId: true,
        notes: true,
      },
    });
    return { success: true, data };
  }

  /**
   * Vật chứng của vụ án — CHỈ ĐỌC, cùng luật phạm vi với xem chi tiết. Form sửa vụ án hiện danh sách này để cán bộ
   * thấy vật chứng đã có và không nhập lại (trước 19/09/2026 không nơi nào đọc được bảng `evidences`).
   */
  async getEvidences(
    id: string,
    dataScope?: DataScope | null,
    actorId?: string,
  ) {
    await this.kiemXemVuAn(id, dataScope, actorId);
    const data = await this.prisma.evidence.findMany({
      where: { caseId: id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        quantity: true,
        unit: true,
        storageLocation: true,
        receivedDate: true,
        status: true,
        evidenceType: true,
        entryOrder: true,
        warehouseReceipt: true,
      },
    });
    return { success: true, data };
  }

  // ─────────────────────────────────────────────
  // STATUS HISTORY
  // ─────────────────────────────────────────────
  // Cùng luật phạm vi với xem chi tiết (soát IDOR 19/09/2026 — trước đây đọc được lịch sử vụ án bất kỳ, và id
  // không tồn tại trả [] thay vì 404).
  async getStatusHistory(
    caseId: string,
    dataScope?: DataScope | null,
    actorId?: string,
  ) {
    await this.kiemXemVuAn(caseId, dataScope, actorId);
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

  /**
   * Xuất Excel danh sách Vụ án theo ĐÚNG bộ lọc và thứ tự của bảng (anh yêu cầu 18/09/2026: nút Xuất
   * Excel trong khung Bộ lọc). Cùng `dungWhereDanhSach`, `thuTuDanhSach`, `CHON_DONG_DANH_SACH_VU_AN`
   * với màn danh sách — không có đường thứ hai để lệch. Ghi nhật ký kiểm toán mỗi lần xuất.
   */
  async xuatDanhSach(
    query: QueryCasesDto & CotXuatDto,
    dataScope: DataScope | null | undefined,
    res: Response,
    actor?: { userId: string; ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    if (actor)
      await this.governance.assertGeneralExport(this.prisma, {
        actorId: actor.userId,
      });
    if (actor)
      await this.fieldSchema.assertQueryReadable(
        this.prisma,
        { actorId: actor.userId },
        query as unknown as Record<string, unknown>,
        'export',
      );
    const now = new Date();
    const isDelegation = query.caseType === CaseType.UY_THAC_DIEU_TRA;
    const registeredColumns = isDelegation
      ? delegationExportColumns((row) => computeTrangThaiPhanHoi(row, now))
      : KHAI_COT_XUAT_VU_AN;
    const cot = chonCotXuat(registeredColumns, tachCotXuat(query.cot));
    const { where, ky } = await this.dungWhereDanhSach(query, dataScope, {
      now,
      actorId: actor?.userId,
    });
    const orderBy = await this.thuTuDanhSach(
      query.sortBy,
      (query.sortOrder ?? 'desc') as ListSortOrder,
      actor?.userId,
    );
    const soDong = await xuatDanhSachExcel<DongDanhSachVuAn>({
      res,
      tenTep: `${isDelegation ? 'danh-sach-uy-thac' : 'danh-sach-vu-an'}-${now.toISOString().slice(0, 10)}.xlsx`,
      tenSheet: isDelegation ? 'Ủy thác điều tra' : 'Vụ án',
      tieuDe: isDelegation ? 'DANH SÁCH ỦY THÁC ĐIỀU TRA' : 'DANH SÁCH VỤ ÁN',
      phuDe: phuDeKyXuat(ky, query.fromDate, query.toDate, 'Ngày đề xuất'),
      cot,
      demTong: () => this.prisma.case.count({ where }),
      layIdTheoThuTu: async (toiDa) =>
        (
          await this.prisma.case.findMany({
            where,
            orderBy,
            select: { id: true },
            take: toiDa,
          })
        ).map((d) => d.id),
      layDong: (ids) =>
        this.prisma.case
          .findMany({
            where: { AND: [where, { id: { in: ids }, deletedAt: null }] },
            select: CHON_DONG_DANH_SACH_VU_AN,
          })
          .then((rows) => this.authorizeHydratedRows(rows, actor?.userId)),
    });
    if (actor) {
      await this.audit.log({
        userId: actor.userId,
        action: 'CASE_EXPORTED',
        subject: 'Case',
        metadata: { format: 'xlsx', kind: 'danh-sach', filters: query, soDong },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
    }
  }

  // ─────────────────────────────────────────────
  /** Export every stored Case field, retaining the same scoped list query. */
  async xuatDayDu(
    query: QueryCasesDto,
    dataScope: DataScope | null | undefined,
    res: Response,
    actor?: { userId: string; ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    if (actor)
      await this.governance.assertGeneralExport(this.prisma, {
        actorId: actor.userId,
      });
    if (actor)
      await this.fieldSchema.assertQueryReadable(
        this.prisma,
        { actorId: actor.userId },
        query as unknown as Record<string, unknown>,
        'export',
      );
    const now = new Date();
    const caseType =
      query.caseType === CaseType.UY_THAC_DIEU_TRA
        ? CaseType.UY_THAC_DIEU_TRA
        : CaseType.REGULAR;
    const { where, ky } = await this.dungWhereDanhSach(query, dataScope, {
      now,
      actorId: actor?.userId,
    });
    const orderBy = await this.thuTuDanhSach(
      query.sortBy,
      (query.sortOrder ?? 'desc') as ListSortOrder,
      actor?.userId,
    );
    const soDong = await xuatDanhSachExcel<DongXuatDayDuModel>({
      res,
      tenTep: `${caseType === CaseType.UY_THAC_DIEU_TRA ? 'uy-thac' : 'vu-an'}-day-du-${now.toISOString().slice(0, 10)}.xlsx`,
      tenSheet:
        caseType === CaseType.UY_THAC_DIEU_TRA ? 'Ủy thác điều tra' : 'Vụ án',
      tieuDe:
        caseType === CaseType.UY_THAC_DIEU_TRA
          ? 'DANH SÁCH ỦY THÁC ĐIỀU TRA'
          : 'DANH SÁCH VỤ ÁN',
      phuDe: phuDeKyXuat(ky, query.fromDate, query.toDate, 'Ngày đề xuất'),
      cot: KHAI_COT_XUAT_VU_AN_DAY_DU,
      sheetLienQuan: [
        {
          ten: 'Đối tượng',
          cot: COT_DOI_TUONG,
          demDong: (ids) =>
            this.prisma.subject.count({
              where: { caseId: { in: ids }, deletedAt: null },
            }),
          layDong: (row) =>
            row.subjects as Record<string, unknown>[] | undefined,
        },
        {
          ten: 'Vật chứng',
          cot: COT_VAT_CHUNG,
          demDong: (ids) =>
            this.prisma.evidence.count({
              where: { caseId: { in: ids }, deletedAt: null },
            }),
          layDong: (row) =>
            row.evidences as Record<string, unknown>[] | undefined,
        },
        {
          ten: 'Tài liệu',
          cot: COT_TAI_LIEU,
          demDong: (ids) =>
            this.prisma.document.count({
              where: { caseId: { in: ids }, deletedAt: null },
            }),
          layDong: (row) =>
            row.documents as Record<string, unknown>[] | undefined,
        },
      ],
      demTong: () => this.prisma.case.count({ where }),
      layIdTheoThuTu: async (toiDa) =>
        (
          await this.prisma.case.findMany({
            where,
            orderBy,
            select: { id: true },
            take: toiDa,
          })
        ).map((row) => row.id),
      layDong: (ids) =>
        this.prisma.case
          .findMany({
            where: {
              AND: [where, { id: { in: ids }, deletedAt: null, caseType }],
            },
            select: {
              ...COT_CAN_CHO_XUAT_DAY_DU_VU_AN,
              id: true,
              fieldDefinitionVersionId: true,
            },
          })
          .then((rows) =>
            this.authorizeHydratedRows(rows, actor?.userId),
          ) as unknown as Promise<DongXuatDayDuModel[]>,
    });
    if (actor)
      await this.audit.log({
        userId: actor.userId,
        action: 'CASE_EXPORTED',
        subject: 'Case',
        metadata: {
          format: 'xlsx',
          kind: 'day-du',
          caseType,
          filters: query,
          soDong,
        },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
  }

  // EXPORT WARD CASES (Vụ án theo phường/xã)
  // ─────────────────────────────────────────────
  /**
   * Xuất đúng những gì màn Vụ án phường/xã đang lọc: CÙNG tham số (`tk`, `wardTeamId`, `status`, ngày…)
   * và CÙNG điều kiện, thứ tự với danh sách (`dungWhereDanhSach` + `thuTuDanhSach`). Bản đầu lọc
   * `donViGiaiQuyet` bằng ID phường (không bao giờ khớp), bỏ qua loại hồ sơ và cắt ở 500 dòng.
   */
  async exportWardCases(
    query: QueryCasesDto,
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

    // Cùng bộ xuất với "Xuất Excel theo bộ lọc" (18/09/2026): cùng điều kiện và thứ tự của màn;
    // trước đây lặp `getList` 200 dòng/lượt (đếm lại mỗi lượt) và dựng cả tệp trong bộ nhớ.
    // Phụ đề ghi ĐÚNG khoảng ngày đã áp: ô ngày trống thì là kỳ mặc định admin đặt.
    if (actor)
      await this.governance.assertGeneralExport(this.prisma, {
        actorId: actor.userId,
      });
    if (actor)
      await this.fieldSchema.assertQueryReadable(
        this.prisma,
        { actorId: actor.userId },
        query as unknown as Record<string, unknown>,
        'export',
      );
    const { where, ky } = await this.dungWhereDanhSach(query, dataScope, {
      actorId: actor?.userId,
    });
    const orderBy = await this.thuTuDanhSach(
      query.sortBy,
      (query.sortOrder ?? 'desc') as ListSortOrder,
      actor?.userId,
    );
    await xuatDanhSachExcel<DongDanhSachVuAn>({
      res,
      tenTep: `VuAnPhuongXa_${new Date().toISOString().slice(0, 10)}.xlsx`,
      tenSheet: 'Danh sách vụ án',
      tieuDe: 'DANH SÁCH VỤ ÁN THEO PHƯỜNG/XÃ',
      phuDe: phuDeKyXuat(ky, query.fromDate, query.toDate, 'Ngày đề xuất'),
      cot: KHAI_COT_XUAT_VU_AN_PHUONG,
      demTong: () => this.prisma.case.count({ where }),
      layIdTheoThuTu: async (toiDa) =>
        (
          await this.prisma.case.findMany({
            where,
            orderBy,
            select: { id: true },
            take: toiDa,
          })
        ).map((d) => d.id),
      layDong: (ids) =>
        this.prisma.case
          .findMany({
            where: { AND: [where, { id: { in: ids }, deletedAt: null }] },
            select: CHON_DONG_DANH_SACH_VU_AN,
          })
          .then((rows) => this.authorizeHydratedRows(rows, actor?.userId)),
      // Tệp phường có sẵn từ trước vẫn trả tệp (chỉ tiêu đề) khi không có vụ án nào — giữ hành vi.
      choPhepRong: true,
    });
  }

  // ─────────────────────────────────────────────
  // EXPORT OTHER CLASSIFICATION (Phân loại khác)
  // ─────────────────────────────────────────────
  async exportOtherClassification(
    query: { fromDate?: string; toDate?: string; category?: string },
    dataScope: DataScope | null | undefined,
    res: Response,
    actorId?: string,
  ): Promise<void> {
    await this._exportCases(
      query,
      dataScope,
      res,
      'PHÂN LOẠI KHÁC',
      `PhanLoaiKhac_${new Date().toISOString().slice(0, 10)}.xlsx`,
      actorId,
    );
  }

  private async _exportCases(
    query: {
      unitId?: string;
      fromDate?: string;
      toDate?: string;
      category?: string;
    },
    dataScope: DataScope | null | undefined,
    res: Response,
    title: string,
    filename: string,
    actorId?: string,
  ): Promise<void> {
    if (actorId)
      await this.fieldSchema.assertQueryReadable(
        this.prisma,
        { actorId },
        query as unknown as Record<string, unknown>,
        'export',
      );
    if (actorId)
      await this.governance.assertGeneralExport(this.prisma, { actorId });
    const where: Prisma.CaseWhereInput = { deletedAt: null };
    // Cùng lý do: cột `unit` rỗng ở mọi vụ án nên lọc trên nó trả về danh sách trắng.
    if (query.unitId) where.donViGiaiQuyet = query.unitId;
    if (query.category)
      where.crime = { contains: query.category, mode: 'insensitive' };
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (query.fromDate) createdAtFilter.gte = new Date(query.fromDate);
    if (query.toDate)
      createdAtFilter.lte = new Date(query.toDate + 'T23:59:59.999Z');
    if (query.fromDate || query.toDate) where.createdAt = createdAtFilter;

    const scopeFilter = buildScopeFilter(dataScope);
    if (scopeFilter) {
      noiVaoWhere(where as Record<string, unknown>, [
        scopeFilter as Prisma.CaseWhereInput,
      ]);
    }

    noiVaoWhere(where as Record<string, unknown>, [
      await this.visibilityWhere(actorId),
    ]);
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
    const HEADERS = [
      'STT',
      'Mã vụ án',
      'Tên vụ án',
      'Loại tội phạm',
      'Phường/Xã',
      'ĐTV phụ trách',
      'Ngày tiếp nhận',
      'Trạng thái',
    ];
    const WIDTHS = [6, 18, 30, 20, 20, 20, 16, 20];

    const fromStr = query.fromDate
      ? new Date(query.fromDate).toLocaleDateString('vi-VN')
      : '';
    const toStr = query.toDate
      ? new Date(query.toDate).toLocaleDateString('vi-VN')
      : '';
    const period =
      fromStr && toStr
        ? `Từ ngày ${fromStr} đến ngày ${toStr}`
        : 'Tất cả thời gian';

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
        CASE_STATUS_LABEL[rec.status] ?? rec.status ?? '',
      ]);
      BcaExcelHelper.styleDataRow(dataRow, idx % 2 === 1, COL_COUNT);
    });

    const lastDataRow = sheet.lastRow?.number ?? 7;
    BcaExcelHelper.addFooter(sheet, lastDataRow + 2, COL_COUNT);
    BcaExcelHelper.setPrintSetup(sheet);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    try {
      await workbook.xlsx.write(res);
    } catch {
      if (!res.headersSent) res.status(500).json({ error: 'Export failed' });
      else res.destroy();
    }
  }
}
import { caseCivilDayStart } from './governance/case-civil-day';
