import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import type { DataScope } from '../auth/services/unit-scope.service';
import { assertParentInScope, buildScopeFilter } from '../common/utils/scope-filter.util';

@Injectable()
export class DocumentsService {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
    if (documentType) where.documentType = documentType;

    const caseScope = buildScopeFilter(dataScope);
    if (caseScope) {
      (where as any).OR = [
        { case: caseScope },
        { incident: caseScope },
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
          uploadedById: true,
          createdAt: true,
          updatedAt: true,
          case: { select: { id: true, name: true } },
          incident: { select: { id: true, name: true } },
          uploadedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
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
        case: { select: { id: true, name: true, status: true, assignedTeamId: true, investigatorId: true } },
        incident: { select: { id: true, name: true, status: true, assignedTeamId: true, investigatorId: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
    });

    if (!record) {
      throw new NotFoundException(`Tài liệu không tồn tại (id: ${id})`);
    }

    assertParentInScope(record.case ?? record.incident, dataScope);

    return { success: true, data: record };
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async create(
    dto: CreateDocumentDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    // Validate caseId if provided
    if (dto.caseId) {
      const caseRecord = await this.prisma.case.findFirst({
        where: { id: dto.caseId, deletedAt: null },
      });
      if (!caseRecord) {
        throw new BadRequestException(`Vụ án không tồn tại (id: ${dto.caseId})`);
      }
    }

    // Validate incidentId if provided
    if (dto.incidentId) {
      const incidentRecord = await this.prisma.incident.findFirst({
        where: { id: dto.incidentId, deletedAt: null },
      });
      if (!incidentRecord) {
        throw new BadRequestException(`Vụ việc không tồn tại (id: ${dto.incidentId})`);
      }
    }

    // Validate file upload fields
    if (!dto.fileName || !dto.originalName || !dto.mimeType || !dto.size || !dto.filePath) {
      throw new BadRequestException('Thông tin file không đầy đủ');
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
        documentType: dto.documentType ?? 'VAN_BAN',
        caseId: dto.caseId ?? null,
        incidentId: dto.incidentId ?? null,
        uploadedById: actorId,
      },
      include: {
        case: { select: { id: true, name: true } },
        incident: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
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
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Upload tài liệu thành công' };
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
    assertParentInScope(existing.case ?? existing.incident, dataScope, 'write');

    // Validate caseId if provided
    if (dto.caseId) {
      const caseRecord = await this.prisma.case.findFirst({
        where: { id: dto.caseId, deletedAt: null },
      });
      if (!caseRecord) {
        throw new BadRequestException(`Vụ án không tồn tại (id: ${dto.caseId})`);
      }
    }

    // Validate incidentId if provided
    if (dto.incidentId) {
      const incidentRecord = await this.prisma.incident.findFirst({
        where: { id: dto.incidentId, deletedAt: null },
      });
      if (!incidentRecord) {
        throw new BadRequestException(`Vụ việc không tồn tại (id: ${dto.incidentId})`);
      }
    }

    const record = await this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.documentType !== undefined && { documentType: dto.documentType }),
        ...(dto.caseId !== undefined && { caseId: dto.caseId ?? null }),
        ...(dto.incidentId !== undefined && { incidentId: dto.incidentId ?? null }),
      },
      include: {
        case: { select: { id: true, name: true } },
        incident: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'DOCUMENT_UPDATED',
      subject: 'Document',
      subjectId: id,
      metadata: { changes: dto },
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
    assertParentInScope(existing.case ?? existing.incident, dataScope, 'write');

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
        softDelete: true
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa tài liệu thành công' };
  }

  // ─────────────────────────────────────────────
  // DOWNLOAD
  // ─────────────────────────────────────────────
  async getDownloadInfo(id: string) {
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
    const random = Math.random().toString(36).substring(2, 10);
    const ext = path.extname(originalName);
    return `${timestamp}-${random}${ext}`;
  }

  getUploadDir(): string {
    return this.uploadDir;
  }
}
