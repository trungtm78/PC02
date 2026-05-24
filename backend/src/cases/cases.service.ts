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
import { Prisma, CaseStatus, PetitionStatus, LoaiDon, CapDoToiPham, LyDoTamDinhChiVuAn, KetQuaPhucHoiVuAn, CaseProvenance, SubjectType } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { buildScopeFilter } from '../common/utils/scope-filter.util';
import { generateIncidentCode } from '../common/utils/incident-code.util';
import { buildIncidentFromCase, shouldAutoCreateIncident } from '../common/utils/incident-factory.util';
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
      wardTeamId,
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

    // Subjects (Bị can / Bị hại / Nhân chứng / Luật sư) — required FK crimeId
    if (dto.subjects && dto.subjects.length > 0) {
      const subjectsData = dto.subjects.map((s) => ({
        fullName: s.fullName,
        dateOfBirth: new Date(s.dateOfBirth),
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

    // Common base case data shared across all branches
    const baseCaseData = {
      name: dto.name,
      crime: dto.crime,
      status: dto.status ?? CaseStatus.TIEP_NHAN,
      investigatorId: dto.investigatorId,
      createdById: actorId, // v0.31.0.2: creator track
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      unit: dto.unit,
      ...(effectiveAssignedTeamId !== undefined && { assignedTeamId: effectiveAssignedTeamId }),
      subjectsCount: dto.subjectsCount ?? 0,
      ...(dto.capDoToiPham !== undefined && { capDoToiPham: dto.capDoToiPham }),
      ...(dto.ngayKhoiTo !== undefined && { ngayKhoiTo: new Date(dto.ngayKhoiTo) }),
      ...(scrubbedMetadata !== undefined && { metadata: scrubbedMetadata as JsonInput }),
      caseProvenance: effectiveProvenance, // v0.37.2: required (Contract phase enforces non-null)
      ...(dto.sourceDocumentNote !== undefined && { sourceDocumentNote: dto.sourceDocumentNote }),
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
        const petition = await tx.petition.findFirst({
          where: {
            id: dto.linkedPetitionId!,
            deletedAt: null,
            linkedCaseId: null,
            ...(petitionScopeOR.length > 0 ? { OR: petitionScopeOR } : {}),
          },
        });
        if (!petition) {
          // Consistent 404 — no enumeration leak (not-found vs out-of-scope indistinguishable)
          throw new NotFoundException('Đơn thư không tồn tại hoặc không nằm trong phạm vi của bạn');
        }

        const newCase = await tx.case.create({
          data: { ...baseCaseData, linkedPetitionId: petition.id },
          include: caseInclude,
        });

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
          data: { ...baseCaseData, linkedIncidentId: incident.id },
          include: caseInclude,
        });

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

      return { success: true, data: caseRecord, message: 'Tạo vụ án thành công' };
    }

    // ── DIRECT_DISCOVERY / TRANSFERRED / OTHER_LEGAL_SOURCE ──
    // v0.40: Branch 3 now wrapped in $transaction (atomic). Auto-creates Incident
    // when Tab Vụ việc has incidentDate/incidentType/incidentDescription/incidentLocation.
    // CRITICAL: Do NOT set baseCaseData.linkedIncidentId — violates case_provenance_fk_consistency.
    // Link is stored one-way: Incident.linkedCaseId = caseRecord.id (set after Case creation).
    // NOTE: audit log fires outside the transaction (post-commit side-effect). This is intentional:
    // the incident exists at that point, so the audit is accurate even if the process crashes here.
    let autoIncidentId: string | null = null;
    let autoIncidentCode: string | null = null;
    let autoIncidentName: string | null = null;
    let record!: Awaited<ReturnType<typeof this.prisma.case.create>>;
    try {
      record = await this.prisma.$transaction(async (tx) => {
        if (shouldAutoCreateIncident(effectiveProvenance, dto.metadata as Record<string, unknown>)) {
          const code = await generateIncidentCode(tx);
          const incData = buildIncidentFromCase({
            rawName: dto.name,
            meta: (dto.metadata ?? {}) as Record<string, unknown>,
            code,
            userId: actorId,
            investigatorId: actorId,
            assignedTeamId: dto.assignedTeamId ?? undefined,
          });
          const newInc = await tx.incident.create({ data: incData });
          autoIncidentId = newInc.id;
          autoIncidentCode = code;
          autoIncidentName = newInc.name;
        }
        const caseRecord = await tx.case.create({ data: baseCaseData, include: caseInclude });
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
      // P2002 = unique constraint: concurrent requests generated duplicate incident code
      if (e?.code === 'P2002') throw new ConflictException('Trùng mã vụ việc, vui lòng thử lại');
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
