import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { BoTimKiem } from '../common/tim-kiem/bo-tim-kiem';
import { KHOA_TAT_CA } from '../common/tim-kiem/dieu-kien';
import { KHAI_TIM_KIEM_TAI_LIEU } from '../common/tim-kiem/khai/tai-lieu.khai';
import { CaseGovernanceService } from '../cases/governance/case-governance.service';
import { CaseEvidenceGovernanceService } from '../cases/evidence-governance/evidence-governance.service';
import { openEvidenceFile } from '../cases/evidence-governance/evidence-file-integrity';
import { Readable } from 'node:stream';

/** `search` cũ (đường dẫn cũ) → thẻ "tất cả các cột". */
const THAM_SO_CU_TAI_LIEU = { search: KHOA_TAT_CA } as const;

/**
 * Chạy một phép khẳng định phạm vi và trả ĐÚNG/SAI thay vì ném.
 *
 * Hai hàm `assert*InScope` là hợp đồng dùng chung của cả kho mã và đều NÉM — đúng cho chỗ chỉ
 * có một cha. Tệp hai cha cần hỏi "cha này có cho qua không?" rồi mới quyết, nên bọc lại ở đây
 * thay vì chép logic phạm vi ra chỗ thứ hai: chép là hai bản luật rồi lệch nhau lúc nào không
 * hay, mà lệch ở phía phân quyền thì im lặng.
 */
function chaTrongPhamVi(kiem: () => void): boolean {
  try {
    kiem();
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class DocumentsService {
  private readonly uploadDir: string;
  private boTimKiem?: BoTimKiem;
  private async documentMutation<T>(
    handler: (tx: Prisma.TransactionClient) => Promise<T>,
    options: { isolationLevel: Prisma.TransactionIsolationLevel },
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(handler, options);
    } catch (error) {
      const failure = error as { code?: string; meta?: { code?: string } };
      if (
        ['P2025', 'P2034', 'P2002'].includes(failure.code ?? '') ||
        (failure.code === 'P2010' &&
          ['40001', '40P01'].includes(failure.meta?.code ?? ''))
      )
        throw new ConflictException(
          'Document or parent changed; reload and retry',
        );
      throw error;
    }
  }

  private get timKiem(): BoTimKiem {
    return (this.boTimKiem ??= new BoTimKiem(
      this.prisma,
      KHAI_TIM_KIEM_TAI_LIEU,
      THAM_SO_CU_TAI_LIEU,
    ));
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    private readonly governance: CaseGovernanceService,
    private readonly evidenceGovernance: CaseEvidenceGovernanceService,
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
  async getList(
    query: QueryDocumentsDto,
    dataScope?: DataScope | null,
    actorId?: string,
  ) {
    const {
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
    // Tìm kiếm và phạm vi là HAI điều kiện riêng trong AND. Trước đây cả hai cùng gán `where.OR`, nên
    // khối phạm vi chạy sau đè mất khối tìm — cán bộ có phạm vi gõ gì cũng ra mọi tài liệu.
    const dieuKien: Prisma.DocumentWhereInput[] = [];
    dieuKien.push(
      await this.evidenceGovernance.documentVisibilityWhere(
        actorId ? { actorId } : undefined,
      ),
    );

    // Thẻ tìm kiếm (`tk` + `search` cũ) — bỏ dấu, chọn cột, khoá lạ → 400; cùng luật với mọi màn
    // danh sách. Trước đây `contains` thường trên ba cột: gõ "bien ban" không ra "Biên bản".
    const searchConditions = await this.timKiem.dieuKien(query);
    if (actorId && searchConditions.length) {
      const visibleCaseSearch =
        await this.evidenceGovernance.documentCaseSearchWhere({ actorId });
      const protect = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(protect);
        if (!value || typeof value !== 'object') return value;
        const row = value as Record<string, unknown>,
          result: Record<string, unknown> = {};
        for (const [key, condition] of Object.entries(row)) {
          if (key === 'case' && condition && typeof condition === 'object') {
            const relation = condition as Record<string, unknown>;
            result.case = Object.hasOwn(relation, 'is')
              ? { ...relation, is: { AND: [relation.is, visibleCaseSearch] } }
              : { AND: [condition, visibleCaseSearch] };
          } else result[key] = protect(condition);
        }
        return result;
      };
      dieuKien.push(
        ...(protect(searchConditions) as Prisma.DocumentWhereInput[]),
      );
    } else dieuKien.push(...(searchConditions as Prisma.DocumentWhereInput[]));

    if (caseId) where.caseId = caseId;
    if (incidentId) where.incidentId = incidentId;
    if (petitionId) where.petitionId = petitionId;
    if (documentType) where.documentType = documentType;

    const currentScope = actorId
      ? await this.governance.currentActorScope(this.prisma, { actorId })
      : dataScope;
    const caseScope = buildScopeFilter(currentScope);
    const petitionScope = buildPetitionScopeFilter(currentScope);
    if (caseScope || petitionScope) {
      dieuKien.push({
        OR: [
          ...(caseScope ? [{ case: caseScope }, { incident: caseScope }] : []),
          // Soft-delete cascade (Cycle 3): exclude documents linked to soft-deleted petitions
          // from scope queries — chain-of-custody bleeding prevention.
          ...(petitionScope
            ? [{ petition: { AND: [petitionScope, { deletedAt: null }] } }]
            : []),
        ],
      });
    }
    if (dieuKien.length) where.AND = dieuKien;

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
          recordedAt: true,
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
        orderBy: [{ [orderByField]: sortOrder }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      success: true,
      data: actorId
        ? await Promise.all(
            data.map((record) =>
              this.evidenceGovernance.filterDocumentCase(record, { actorId }),
            ),
          )
        : data,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    };
  }

  // ─────────────────────────────────────────────
  // GET DETAIL
  // ─────────────────────────────────────────────
  async getById(
    id: string,
    dataScope?: DataScope | null,
    actorId?: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const database = transaction ?? this.prisma;
    let currentScope = dataScope;
    const record = await database.document.findFirst({
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
        // `deletedAt` BẮT BUỘC có mặt — xem `chaDonThuChoQua` bên dưới.
        petition: {
          select: {
            id: true,
            stt: true,
            senderName: true,
            status: true,
            assignedTeamId: true,
            enteredById: true,
            deletedAt: true,
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
    const asset = await database.caseAssetVersion.findUnique({
      where: { documentId: id },
    });
    if (asset) {
      if (!actorId)
        throw new ForbiddenException(
          'Registered asset requires current authenticated actor',
        );
      await this.evidenceGovernance.authorizeAsset(
        database,
        asset.caseId,
        asset.id,
        { actorId },
        'view',
      );
    }
    if (actorId)
      currentScope = (
        await this.evidenceGovernance.authorizeLegacyDocumentRead(
          database,
          id,
          { actorId },
        )
      ).scope;

    /*
      MỘT trong các cha cho phép là đủ — đúng bằng luật của đường LIỆT KÊ ở `findAll` trên.

      Chuyển đơn thư thành Vụ án thì `petitions.service.ts` GIỮ NGUYÊN `petitionId` và THÊM
      `caseId`, nên tệp có HAI cha. Bản trước chỉ xét phạm vi Đơn thư khi KHÔNG có cha Vụ án,
      còn lại rơi hết về phạm vi Vụ án — trong khi đường liệt kê lại nối hai phạm vi bằng OR.
      Hai luật khác nhau trên cùng một tệp: cán bộ đọc được đơn nhưng không đọc được vụ án THẤY
      tệp trong danh sách, bấm tải và nhận 403, không có lời giải thích nào.

      Nới ở đây KHÔNG mở rộng quyền: ai đọc được tệp qua danh sách thì nay tải được đúng tệp
      ấy. Ai không đọc được cha nào vẫn bị chặn — mệnh đề thứ hai của cổng giữ điều đó.
    */
    /*
      Đơn thư cha ĐÃ XOÁ MỀM thì KHÔNG cho qua.

      Đường liệt kê ở `findAll` nói rõ điều này: `{ petition: { AND: [phamVi, { deletedAt: null }] } }`
      kèm chú thích "chain-of-custody bleeding prevention". Bản đầu của phép nới này bỏ sót, và
      lượt soát mô hình ngoài 22/09/2026 dựng đúng ca ấy: tệp hai cha, đơn thư TRONG phạm vi
      nhưng đã xoá, vụ án NGOÀI phạm vi — nới xong là cho qua. Tức là xoá đơn thư đi lại thành
      cách mở khoá tệp của một vụ án mình không được đọc.

      Nới này chỉ được phép làm hai đường đọc BẰNG NHAU, không được rộng hơn đường liệt kê.
    */
    const chaDonThuChoQua =
      record.petitionId !== null &&
      record.petition != null &&
      record.petition.deletedAt == null &&
      chaTrongPhamVi(() =>
        assertPetitionParentInScope(record.petition, currentScope),
      );
    const chaVuAnChoQua =
      (record.caseId !== null &&
        record.case != null &&
        chaTrongPhamVi(() => assertParentInScope(record.case, currentScope))) ||
      (record.incidentId !== null &&
        record.incident != null &&
        chaTrongPhamVi(() =>
          assertParentInScope(record.incident, currentScope),
        ));

    if (!chaDonThuChoQua && !chaVuAnChoQua) {
      // Ném đúng lỗi của nhánh cha mà tệp thật sự có, để thông báo không lạc đề.
      if (record.petitionId !== null && !record.caseId && !record.incidentId)
        assertPetitionParentInScope(record.petition, currentScope);
      else assertParentInScope(record.case ?? record.incident, currentScope);
    }

    return {
      success: true,
      data:
        actorId && !transaction
          ? await this.evidenceGovernance.filterDocumentCase(
              record,
              { actorId },
              database,
            )
          : record,
    };
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

    if (dto.recordedAt) {
      const parsedDate = new Date(`${dto.recordedAt}T00:00:00.000Z`);
      if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== dto.recordedAt
      ) {
        throw new BadRequestException('Ngày ghi không hợp lệ');
      }
      const bangkokParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .formatToParts(new Date())
        .reduce<Record<string, string>>((parts, part) => {
          parts[part.type] = part.value;
          return parts;
        }, {});
      const todayBangkok = `${bangkokParts.year}-${bangkokParts.month}-${bangkokParts.day}`;
      if (dto.recordedAt > todayBangkok) {
        throw new BadRequestException(
          'Ngày ghi không được lớn hơn ngày hiện tại',
        );
      }
    }

    if (
      /[\\/:]/.test(dto.fileName) ||
      dto.fileName.includes('\0') ||
      dto.fileName === '.' ||
      dto.fileName === '..'
    )
      throw new BadRequestException('Invalid server filename');
    const record = await this.documentMutation(
      async (tx) => {
        if (dto.caseId) {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM cases WHERE id = ${dto.caseId} FOR UPDATE`,
          );
          await this.governance.assertCaseWritable(
            tx,
            dto.caseId,
            { actorId },
            dataScope,
          );
        }
        const record = await tx.document.create({
          data: {
            title: dto.title,
            description: dto.description ?? null,
            fileName: dto.fileName!,
            originalName: dto.originalName!,
            mimeType: dto.mimeType!,
            size: dto.size!,
            filePath: path.join(this.uploadDir, dto.fileName!),
            documentType: dto.documentType || 'VAN_BAN', // '' (chuỗi rỗng) → default, không lưu rác
            recordedAt: dto.recordedAt ?? null,
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
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        });

        await this.audit.log(
          {
            userId: actorId,
            action: 'DOCUMENT_CREATED',
            subject: 'Document',
            subjectId: record.id,
            metadata: {
              title: record.title,
              originalName: record.originalName,
              size: record.size,
              recordedAt: dto.recordedAt ?? null,
              caseId: record.caseId,
              incidentId: record.incidentId,
              petitionId: record.petitionId,
            },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );
        return record;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

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
    return this.documentMutation(
      async (tx) => {
        const { data: existing } = await this.getById(
          id,
          dataScope,
          actorId,
          tx,
        );
        const parentIds = [existing.caseId, dto.caseId]
          .filter((value): value is string => !!value)
          .sort();
        for (const caseId of [...new Set(parentIds)]) {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM cases WHERE id = ${caseId} FOR UPDATE`,
          );
          await this.governance.assertCaseWritable(
            tx,
            caseId,
            { actorId },
            dataScope,
          );
        }
        const current = await tx.document.findFirst({
          where: { id, deletedAt: null },
        });
        if (
          !current ||
          current.caseId !== existing.caseId ||
          current.incidentId !== existing.incidentId ||
          current.updatedAt.getTime() !== existing.updatedAt.getTime()
        )
          throw new ConflictException('Document ownership changed');
        const registered = await tx.caseAssetVersion.findUnique({
          where: { documentId: id },
        });
        if (
          await tx.caseDecision.findFirst({ where: { sourceDocumentId: id } })
        )
          throw new ConflictException(
            'Legal decision source must be preserved',
          );
        if (
          await tx.caseCustodyEvent.findFirst({
            where: { sourceDocumentId: id },
          })
        )
          throw new ConflictException(
            'Custody source receipt must be preserved',
          );
        if (
          await tx.caseDispositionRequest.findFirst({
            where: { receiptDocumentId: id },
          })
        )
          throw new ConflictException(
            'Disposition receipt source must be preserved',
          );
        if (registered)
          throw new ConflictException(
            'Registered original is immutable; register a derivative instead',
          );
        const changesParent =
          (dto.caseId !== undefined &&
            (dto.caseId || null) !== existing.caseId) ||
          (dto.incidentId !== undefined &&
            (dto.incidentId || null) !== existing.incidentId);
        if (
          changesParent &&
          existing.caseId &&
          (await tx.caseEvidenceHold.findFirst({
            where: { caseId: existing.caseId, releasedAt: null },
          }))
        )
          throw new ConflictException('Active hold protects document parent');
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
          const caseRecord = await tx.case.findFirst({
            where: { id: dto.caseId, deletedAt: null },
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
          const incidentRecord = await tx.incident.findFirst({
            where: { id: dto.incidentId, deletedAt: null },
          });
          if (!incidentRecord) {
            throw new BadRequestException(
              `Vụ việc không tồn tại (id: ${dto.incidentId})`,
            );
          }
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

        const record = await tx.document.update({
          where: { id, updatedAt: existing.updatedAt },
          data: {
            ...(dto.title !== undefined && { title: dto.title }),
            ...(dto.description !== undefined && {
              description: dto.description,
            }),
            ...(dto.documentType !== undefined &&
              dto.documentType !== '' && { documentType: dto.documentType }),
            ...(dto.caseId !== undefined && { caseId: dto.caseId || null }),
            ...(dto.incidentId !== undefined && {
              incidentId: dto.incidentId || null,
            }),
          },
          include: {
            case: { select: { id: true, name: true } },
            incident: { select: { id: true, name: true } },
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        });

        await this.audit.log(
          {
            userId: actorId,
            action: 'DOCUMENT_UPDATED',
            subject: 'Document',
            subjectId: id,
            metadata: {
              before: {
                title: existing.title,
                documentType: existing.documentType,
              },
              after: dto,
            },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );

        return {
          success: true,
          data: record,
          message: 'Cập nhật tài liệu thành công',
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
    return this.documentMutation(
      async (tx) => {
        const { data: existing } = await this.getById(
          id,
          dataScope,
          actorId,
          tx,
        );
        if (existing.caseId) {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM cases WHERE id = ${existing.caseId} FOR UPDATE`,
          );
          await this.governance.assertCaseWritable(
            tx,
            existing.caseId,
            { actorId },
            dataScope,
          );
        }
        const registered = await tx.caseAssetVersion.findUnique({
          where: { documentId: id },
        });
        if (
          await tx.caseDecision.findFirst({ where: { sourceDocumentId: id } })
        )
          throw new ConflictException(
            'Legal decision source must be preserved',
          );
        if (
          await tx.caseCustodyEvent.findFirst({
            where: { sourceDocumentId: id },
          })
        )
          throw new ConflictException(
            'Custody source receipt must be preserved',
          );
        if (
          await tx.caseDispositionRequest.findFirst({
            where: { receiptDocumentId: id },
          })
        )
          throw new ConflictException(
            'Disposition receipt source must be preserved',
          );
        if (registered)
          throw new ConflictException('Registered original must be preserved');
        if (
          existing.caseId &&
          (await tx.caseEvidenceHold.findFirst({
            where: { caseId: existing.caseId, releasedAt: null },
          }))
        )
          throw new ConflictException('Active hold protects document');
        if (existing.petitionId && !existing.caseId && !existing.incidentId) {
          assertPetitionParentInScope(existing.petition, dataScope, 'write');
        } else {
          assertParentInScope(
            existing.case ?? existing.incident,
            dataScope,
            'write',
          );
        }

        await tx.document.update({
          where: {
            id,
            updatedAt: existing.updatedAt,
            caseId: existing.caseId,
            incidentId: existing.incidentId,
          },
          data: { deletedAt: new Date() },
        });

        await this.audit.log(
          {
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
          },
          tx,
        );

        return { success: true, message: 'Xóa tài liệu thành công' };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
    if (
      !record.fileName ||
      /[\\/:]/.test(record.fileName) ||
      record.fileName.includes('\0') ||
      record.fileName === '.' ||
      record.fileName === '..'
    )
      throw new BadRequestException('Invalid server filename');
    if (
      await this.prisma.caseAssetVersion.findUnique({
        where: { documentId: id },
      })
    )
      throw new ForbiddenException(
        'Registered original requires verified download hydration',
      );

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
  private async downloadRecord(
    id: string,
    actorId: string,
    dataScope?: DataScope | null,
  ) {
    const record = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
    });
    if (!record) throw new NotFoundException('Document not found');
    const registered = await this.prisma.caseAssetVersion.findUnique({
      where: { documentId: id },
    });
    let principal: { mode: string; revision: number };
    if (registered)
      principal = await this.evidenceGovernance.authorizeDocumentDownload(
        this.prisma,
        record.caseId,
        id,
        { actorId },
      );
    else {
      const access = await this.evidenceGovernance.authorizeLegacyDocumentRead(
        this.prisma,
        id,
        { actorId },
      );
      if (record.caseId && access.caseVisible)
        principal = await this.evidenceGovernance.authorizeDocumentDownload(
          this.prisma,
          record.caseId,
          id,
          { actorId },
        );
      else {
        const profile = await this.governance.accessProfile(this.prisma, {
          actorId,
        });
        if (profile.caseAccessMode !== 'INTERNAL')
          throw new ForbiddenException(
            'Representation bytes require exact approved registered disclosure',
          );
        principal = {
          mode: profile.caseAccessMode,
          revision: profile.caseAccessRevision,
        };
      }
    }
    if (registered)
      await this.evidenceGovernance.authorizeAsset(
        this.prisma,
        registered.caseId,
        registered.id,
        { actorId },
        'download',
      );
    if (!registered) {
      const latest = await this.getById(id, dataScope, actorId);
      if (
        latest.data.updatedAt.getTime() !== record.updatedAt.getTime() ||
        latest.data.fileName !== record.fileName
      )
        throw new ConflictException(
          'Document changed during parent authorization',
        );
    }
    return { record, principal };
  }
  async openDownload(
    id: string,
    actor: { userId: string; ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { record: before, principal: beforePrincipal } =
      await this.downloadRecord(id, actor.userId, dataScope);
    const asset = await this.prisma.caseAssetVersion.findUnique({
      where: { documentId: id },
    });
    const file = asset
      ? await this.evidenceGovernance.verifiedAsset(
          asset.caseId,
          asset.id,
          { actorId: actor.userId },
          'download',
        )
      : await openEvidenceFile(this.uploadDir, before.fileName);
    try {
      const chunks: Buffer[] = [];
      const hash = crypto.createHash('sha256');
      let byteLength = 0;
      for await (const chunk of file.handle.createReadStream({
        start: 0,
        autoClose: false,
      })) {
        chunks.push(chunk as Buffer);
        hash.update(chunk as Buffer);
        byteLength += (chunk as Buffer).length;
      }
      if (hash.digest('hex') !== file.sha256 || byteLength !== before.size)
        throw new ConflictException(
          'Document integrity changed during hydration',
        );
      const { record: after, principal: afterPrincipal } =
        await this.downloadRecord(id, actor.userId, dataScope);
      if (
        after.updatedAt.getTime() !== before.updatedAt.getTime() ||
        after.caseId !== before.caseId ||
        after.incidentId !== before.incidentId ||
        after.petitionId !== before.petitionId ||
        after.fileName !== before.fileName ||
        afterPrincipal.mode !== beforePrincipal.mode ||
        afterPrincipal.revision !== beforePrincipal.revision
      )
        throw new ConflictException('Document authorization snapshot changed');
      if (asset)
        await this.evidenceGovernance.authorizeAsset(
          this.prisma,
          asset.caseId,
          asset.id,
          { actorId: actor.userId },
          'download',
        );
      await this.audit.log({
        userId: actor.userId,
        action: 'DOCUMENT_DOWNLOADED',
        subject: 'Document',
        subjectId: id,
        metadata: {
          assetVersionId: asset?.id ?? null,
          sha256: file.sha256,
          size: byteLength,
        },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
      // Serve the verified byte snapshot: later in-place disk tamper cannot change these bytes.
      return {
        success: true,
        data: {
          stream: Readable.from(Buffer.concat(chunks)),
          originalName: before.originalName,
          mimeType: before.mimeType,
        },
      };
    } finally {
      await file.handle.close();
    }
  }
}
