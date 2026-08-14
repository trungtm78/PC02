import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { DataScope } from '../auth/services/unit-scope.service';
import {
  assertParentInScope,
  assertPetitionParentInScope,
  buildScopeFilter,
  buildPetitionScopeFilter,
} from '../common/utils/scope-filter.util';

@Injectable()
export class DocumentsService {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
  ) {
    // Set up upload directory (local storage)
    this.uploadDir = path.join(process.cwd(), 'uploads', 'documents');
    this.ensureUploadDirExists();
  }

  private ensureUploadDirExists(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  // ─────────────────────────────────────────────
  // GET LIST
  // ─────────────────────────────────────────────
  async getList(query: QueryDocumentsDto, dataScope?: DataScope | null) {
    const {
      search,
      caseId,
      incidentId,
      petitionId,
      documentType,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (caseId) where.caseId = caseId;
    if (incidentId) where.incidentId = incidentId;
    if (petitionId) where.petitionId = petitionId;
    if (documentType) where.documentType = documentType;

    const caseScope = buildScopeFilter(dataScope);
    const petitionScope = buildPetitionScopeFilter(dataScope);
    if (caseScope || petitionScope) {
      (where as any).OR = [
        ...(caseScope ? [{ case: caseScope }, { incident: caseScope }] : []),
        // Soft-delete cascade (Cycle 3): exclude documents linked to soft-deleted petitions
        // from scope queries — chain-of-custody bleeding prevention.
        ...(petitionScope
          ? [{ petition: { AND: [petitionScope, { deletedAt: null }] } }]
          : []),
      ];
    }

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'title',
      'originalName',
      'size',
    ];
    const orderByField = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          fileName: true,
          originalName: true,
          mimeType: true,
          size: true,
          filePath: true,
          documentType: true,
          caseId: true,
          incidentId: true,
          petitionId: true,
          uploadedById: true,
          createdAt: true,
          updatedAt: true,
          case: { select: { id: true, name: true } },
          incident: { select: { id: true, name: true } },
          petition: { select: { id: true, stt: true, senderName: true } },
          uploadedBy: {
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
      this.prisma.document.count({ where }),
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
  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: {
        case: {
          select: {
            id: true,
            name: true,
            status: true,
            assignedTeamId: true,
            investigatorId: true,
          },
        },
        incident: {
          select: {
            id: true,
            name: true,
            status: true,
            assignedTeamId: true,
            investigatorId: true,
          },
        },
        petition: {
          select: {
            id: true,
            stt: true,
            senderName: true,
            status: true,
            assignedTeamId: true,
            enteredById: true,
          },
        },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Tài liệu không tồn tại (id: ${id})`);
    }

    // Petition-only document: dùng petition scope guard. Case/Incident: dùng parent guard cũ.
    if (record.petitionId && !record.caseId && !record.incidentId) {
      assertPetitionParentInScope(record.petition, dataScope);
    } else {
      assertParentInScope(record.case ?? record.incident, dataScope);
    }

    return { success: true, data: record };
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async create(
    dto: CreateDocumentDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    // Validate caseId if provided
    if (dto.caseId) {
      const caseRecord = await this.prisma.case.findFirst({
        where: { id: dto.caseId, deletedAt: null },
        select: { id: true, assignedTeamId: true, investigatorId: true },
      });
      if (!caseRecord) {
        throw new BadRequestException(
          `Vụ án không tồn tại (id: ${dto.caseId})`,
        );
      }
      assertParentInScope(caseRecord, dataScope, 'write');
    }

    // Validate incidentId if provided
    if (dto.incidentId) {
      const incidentRecord = await this.prisma.incident.findFirst({
        where: { id: dto.incidentId, deletedAt: null },
        select: { id: true, assignedTeamId: true, investigatorId: true },
      });
      if (!incidentRecord) {
        throw new BadRequestException(
          `Vụ việc không tồn tại (id: ${dto.incidentId})`,
        );
      }
      assertParentInScope(incidentRecord, dataScope, 'write');
    }

    // Validate petitionId if provided
    if (dto.petitionId) {
      const petitionRecord = await this.prisma.petition.findFirst({
        where: { id: dto.petitionId, deletedAt: null },
        select: { id: true, assignedTeamId: true, enteredById: true },
      });
      if (!petitionRecord) {
        throw new BadRequestException(
          `Đơn thư không tồn tại (id: ${dto.petitionId})`,
        );
      }
      assertPetitionParentInScope(petitionRecord, dataScope, 'write');
    }

    // Cycle 5 — Storage quota guard. Default 50 files per entity (Case/Incident/Petition).
    // Bảo vệ disk VM Viettel khỏi cạn quota khi user upload không kiểm soát.
    // Configurable qua env MAX_DOCUMENTS_PER_ENTITY (0 hoặc unset = no limit).
    // Fail-closed cho malformed env (vd typo "abc"): parseInt → NaN, fallback về default 50
    // thay vì silently disable quota (review fix).
    const rawMax = process.env.MAX_DOCUMENTS_PER_ENTITY;
    const parsed = rawMax !== undefined ? Number.parseInt(rawMax, 10) : 50;
    const maxPerEntity = Number.isFinite(parsed) && parsed >= 0 ? parsed : 50;
    if (maxPerEntity > 0) {
      const entityFilter: Prisma.DocumentWhereInput = { deletedAt: null };
      if (dto.caseId) entityFilter.caseId = dto.caseId;
      else if (dto.incidentId) entityFilter.incidentId = dto.incidentId;
      else if (dto.petitionId) entityFilter.petitionId = dto.petitionId;
      if (dto.caseId || dto.incidentId || dto.petitionId) {
        const count = await this.prisma.document.count({ where: entityFilter });
        if (count >= maxPerEntity) {
          throw new BadRequestException(
            `Vượt giới hạn ${maxPerEntity} tài liệu/đối tượng. Xoá tài liệu cũ trước khi tải mới.`,
          );
        }
      }
    }

    // Validate file upload fields
    if (
      !dto.fileName ||
      !dto.originalName ||
      !dto.mimeType ||
      !dto.size ||
      !dto.filePath
    ) {
      throw new BadRequestException('Thông tin file không đầy đủ');
    }

    // Danh mục động: validate documentType tồn tại trong DOCUMENT_TYPE (Directory).
    if (
      dto.documentType &&
      !(await this.catalog.isValid('DOCUMENT_TYPE', dto.documentType))
    ) {
      throw new BadRequestException(
        'Loại tài liệu không thuộc danh mục DOCUMENT_TYPE',
      );
    }

    const record = await this.prisma.document.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        fileName: dto.fileName,
        originalName: dto.originalName,
        mimeType: dto.mimeType,
        size: dto.size,
        filePath: dto.filePath,
        documentType: dto.documentType || 'VAN_BAN', // '' (chuỗi rỗng) → default, không lưu rác
        caseId: dto.caseId ?? null,
        incidentId: dto.incidentId ?? null,
        petitionId: dto.petitionId ?? null,
        uploadedById: actorId,
      },
      include: {
        case: { select: { id: true, name: true } },
        incident: { select: { id: true, name: true } },
        petition: { select: { id: true, stt: true } },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'DOCUMENT_CREATED',
      subject: 'Document',
      subjectId: record.id,
      metadata: {
        title: record.title,
        originalName: record.originalName,
        size: record.size,
        caseId: record.caseId,
        incidentId: record.incidentId,
        petitionId: record.petitionId,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Upload tài liệu thành công',
    };
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateDocumentDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    if (existing.petitionId && !existing.caseId && !existing.incidentId) {
      assertPetitionParentInScope(existing.petition, dataScope, 'write');
    } else {
      assertParentInScope(
        existing.case ?? existing.incident,
        dataScope,
        'write',
      );
    }

    // Validate caseId if provided
    if (dto.caseId) {
      const caseRecord = await this.prisma.case.findFirst({
        where: { id: dto.caseId, deletedAt: null },
      });
      if (!caseRecord) {
        throw new BadRequestException(
          `Vụ án không tồn tại (id: ${dto.caseId})`,
        );
      }
      // ND-18: cha MỚI cũng phải nằm trong phạm vi ghi của người gọi.
      // Trước đây chỉ kiểm cha CŨ, nên cán bộ tổ A sửa một bản ghi của mình rồi
      // gán sang vụ án của tổ B là chuyển được dữ liệu ra ngoài phạm vi — không
      // câu lệnh nào chặn, và không dấu vết nào cho thấy chuyện đó vừa xảy ra.
      assertParentInScope(caseRecord, dataScope, 'write');
    }

    // Validate incidentId if provided
    if (dto.incidentId) {
      const incidentRecord = await this.prisma.incident.findFirst({
        where: { id: dto.incidentId, deletedAt: null },
      });
      if (!incidentRecord) {
        throw new BadRequestException(
          `Vụ việc không tồn tại (id: ${dto.incidentId})`,
        );
      }
      // ND-18, nhánh vụ việc: cùng lỗ hổng với nhánh vụ án ở trên.
      assertParentInScope(incidentRecord, dataScope, 'write');
    }

    // Danh mục động: validate documentType tồn tại trong DOCUMENT_TYPE (Directory).
    if (
      dto.documentType &&
      !(await this.catalog.isValid('DOCUMENT_TYPE', dto.documentType))
    ) {
      throw new BadRequestException(
        'Loại tài liệu không thuộc danh mục DOCUMENT_TYPE',
      );
    }

    const record = await this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.documentType !== undefined &&
          dto.documentType !== '' && { documentType: dto.documentType }),
        ...(dto.caseId !== undefined && { caseId: dto.caseId ?? null }),
        ...(dto.incidentId !== undefined && {
          incidentId: dto.incidentId ?? null,
        }),
      },
      include: {
        case: { select: { id: true, name: true } },
        incident: { select: { id: true, name: true } },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'DOCUMENT_UPDATED',
      subject: 'Document',
      subjectId: id,
      metadata: {
        before: { title: existing.title, documentType: existing.documentType },
        after: dto,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Cập nhật tài liệu thành công',
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
    const { data: existing } = await this.getById(id, dataScope);
    if (existing.petitionId && !existing.caseId && !existing.incidentId) {
      assertPetitionParentInScope(existing.petition, dataScope, 'write');
    } else {
      assertParentInScope(
        existing.case ?? existing.incident,
        dataScope,
        'write',
      );
    }

    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'DOCUMENT_DELETED',
      subject: 'Document',
      subjectId: id,
      metadata: {
        title: existing.title,
        originalName: existing.originalName,
        softDelete: true,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa tài liệu thành công' };
  }

  // ─────────────────────────────────────────────
  // DOWNLOAD
  // ─────────────────────────────────────────────
  // Sprint 2 / S2.1: optional `actor` cho audit log. Caller (controller) pass
  // user.id + meta để log "ai download file gì khi nào" — fill gap audit
  // trước đây không track downloads.
  async getDownloadInfo(
    id: string,
    actor?: { userId: string; ipAddress?: string; userAgent?: string },
  ) {
    const record = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
    });

    if (!record) {
      throw new NotFoundException(`Tài liệu không tồn tại (id: ${id})`);
    }

    const fullPath = path.join(this.uploadDir, record.fileName);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('File không tồn tại trên hệ thống');
    }

    if (actor) {
      await this.audit.log({
        userId: actor.userId,
        action: 'DOCUMENT_DOWNLOADED',
        subject: 'Document',
        subjectId: id,
        metadata: {
          fileName: record.originalName,
          mimeType: record.mimeType,
          size: record.size,
        },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
    }

    return {
      success: true,
      data: {
        filePath: fullPath,
        originalName: record.originalName,
        mimeType: record.mimeType,
      },
    };
  }

  // ─────────────────────────────────────────────
  // STORAGE HELPERS
  // ─────────────────────────────────────────────
  generateFileName(originalName: string): string {
    const timestamp = Date.now();
    // SEC: crypto.randomBytes thay vì Math.random — 128-bit entropy unguessable.
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    return `${timestamp}-${random}${ext}`;
  }

  getUploadDir(): string {
    return this.uploadDir;
  }
}
