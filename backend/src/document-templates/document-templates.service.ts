import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import PizZip from 'pizzip';
import { PrismaService } from '../prisma/prisma.service';
import { detectDocxVariables, Delimiters } from './docx-variables.util';
import { normalizeDocxTags } from './docx-normalize.util';
import { TemplateVariable, isAutoPlaceholder } from './entity-placeholders';
import { isCatalogField, assertFieldInCatalog, listCatalog, EntityType } from './field-catalog';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';

type UploadFile = { buffer: Buffer; originalname: string };

@Injectable()
export class DocumentTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cặp delimiter của template (admin chọn lúc upload; mặc định `{ }`). Validate start≠end. */
  private delimitersOf(delimStart?: string | null, delimEnd?: string | null): Delimiters {
    const start = delimStart || '{';
    const end = delimEnd || '}';
    if (start === end) {
      throw new BadRequestException('Ký tự mở và đóng placeholder phải khác nhau');
    }
    return { start, end };
  }

  /**
   * Auto-suy mapping từ placeholder phát hiện: tên thuộc Field Catalog → source 'auto' +
   * field=name; ngoài catalog → 'manual' (nhập tay khi in).
   */
  private autoVariablesFromDetected(detected: string[], entityType: string): TemplateVariable[] {
    return detected.map((name) => {
      const auto = isCatalogField(entityType, name);
      return {
        name,
        label: name,
        source: auto ? ('auto' as const) : ('manual' as const),
        ...(auto ? { field: name } : {}),
        required: false,
      };
    });
  }

  /**
   * Validate mapping CỨNG (codex P1#6): biến không trùng tên; auto phải có field hợp lệ
   * (whitelist catalog); MỌI biến phải xuất hiện trong file (detected); MỌI placeholder
   * trong file phải được khai báo. Sai → 400 rõ ràng (không để render rỗng câm).
   */
  private validateVariableMapping(
    entityType: string,
    variables: TemplateVariable[],
    detected: string[],
  ): TemplateVariable[] {
    const detectedSet = new Set(detected);
    const seen = new Set<string>();
    const normalized: TemplateVariable[] = [];
    for (const v of variables) {
      if (!v || typeof v.name !== 'string' || v.name.trim() === '') {
        throw new BadRequestException('Biến thiếu tên (name)');
      }
      if (seen.has(v.name)) {
        throw new BadRequestException(`Biến trùng tên: "${v.name}"`);
      }
      seen.add(v.name);
      if (!detectedSet.has(v.name)) {
        throw new BadRequestException(`Biến "${v.name}" không có trong file mẫu`);
      }
      const source = v.source === 'manual' ? 'manual' : 'auto';
      let field: string | undefined;
      if (source === 'auto') {
        field = v.field ?? v.name;
        assertFieldInCatalog(entityType as EntityType, field); // 400 nếu ngoài whitelist
      }
      // Lựa chọn LỆCH khỏi danh mục là lựa chọn cố ý — đóng dấu để bộ nạp mẫu không lật lại.
      // Không đóng dấu khi admin gửi đúng thứ danh mục vốn chọn: mẫu chưa ai đụng tới phải
      // còn tự chữa được khi danh mục bổ sung khoá mới.
      const theoDanhMuc = isAutoPlaceholder(entityType, v.name) ? 'auto' : 'manual';
      const nguonDoAdminDat = source !== theoDanhMuc;
      normalized.push({
        name: v.name,
        label: v.label ?? v.name,
        source,
        ...(field ? { field } : {}),
        ...(nguonDoAdminDat ? { nguonDoAdminDat: true } : {}),
        required: v.required === true,
      });
    }
    // Mọi placeholder trong file phải được khai báo (không bỏ sót → tránh tag không map).
    for (const name of detected) {
      if (!seen.has(name)) {
        throw new BadRequestException(`Placeholder "${name}" trong file chưa được khai báo mapping`);
      }
    }
    return normalized;
  }

  /** [codex P2] Chặn file giả .docx: buffer phải là zip docx hợp lệ (có word/document.xml). */
  private assertValidDocx(buffer: Buffer) {
    try {
      const zip = new PizZip(buffer);
      if (!zip.file('word/document.xml')) throw new Error('thiếu word/document.xml');
    } catch {
      throw new BadRequestException('File không phải .docx hợp lệ');
    }
  }

  /**
   * Chuẩn hóa file (gộp run + strip proofErr) → detect theo delimiter → mapping (admin gửi
   * hoặc auto-suy) → validate cứng. Trả buffer đã chuẩn hóa + variables chuẩn.
   */
  private prepareUpload(
    rawBuffer: Buffer,
    entityType: string,
    delimiters: Delimiters,
    adminVariables?: TemplateVariable[],
  ): { buffer: Buffer; variables: TemplateVariable[] } {
    this.assertValidDocx(rawBuffer);
    const buffer = normalizeDocxTags(rawBuffer);
    this.assertValidDocx(buffer);
    const detected = detectDocxVariables(buffer, delimiters);
    const variables =
      adminVariables && adminVariables.length
        ? this.validateVariableMapping(entityType, adminVariables, detected)
        : this.autoVariablesFromDetected(detected, entityType);
    return { buffer, variables };
  }

  async create(dto: CreateDocumentTemplateDto, file: UploadFile, userId: string) {
    if (dto.needsNumber && !dto.numberSeriesId) {
      throw new BadRequestException('Bật cấp số văn bản thì phải chọn chuỗi số (numberSeriesId)');
    }
    const delimiters = this.delimitersOf(dto.delimStart, dto.delimEnd);
    const { buffer, variables } = this.prepareUpload(
      file.buffer,
      dto.entityType,
      delimiters,
      dto.variables as TemplateVariable[] | undefined,
    );
    const fileSha = createHash('sha256').update(buffer).digest('hex');
    try {
      return await this.prisma.documentTemplate.create({
        data: {
          code: dto.code,
          name: dto.name,
          entityType: dto.entityType,
          category: dto.category,
          fileBytes: buffer as unknown as Uint8Array<ArrayBuffer>,
          fileSha,
          fileName: file.originalname,
          // TemplateVariable[] → Prisma JSON (interface không có index signature; cast như fileBytes).
          variables: variables as unknown as object[],
          format: dto.format ?? 'DOCX',
          delimStart: delimiters.start,
          delimEnd: delimiters.end,
          needsNumber: dto.needsNumber ?? false,
          selectedByDefault: dto.selectedByDefault ?? false,
          numberSeriesId: dto.numberSeriesId ?? null,
          sortOrder: dto.sortOrder ?? 0,
          createdById: userId,
        },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Mã mẫu đã tồn tại cho loại hồ sơ này');
      }
      throw e;
    }
  }

  async list(filter: { entityType?: string; category?: string; status?: string }) {
    return this.prisma.documentTemplate.findMany({
      where: {
        deletedAt: null,
        ...(filter.entityType ? { entityType: filter.entityType } : {}),
        ...(filter.category ? { category: filter.category } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      omit: { fileBytes: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getById(id: string) {
    const t = await this.prisma.documentTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!t) throw new NotFoundException(`Không tìm thấy mẫu chứng từ (id: ${id})`);
    return t;
  }

  async update(id: string, dto: UpdateDocumentTemplateDto) {
    const existing = await this.getById(id);
    const {
      requiredVariables,
      variables: dtoVariables,
      delimStart,
      delimEnd,
      ...rest
    } = dto as UpdateDocumentTemplateDto & {
      requiredVariables?: string[];
      variables?: TemplateVariable[];
      delimStart?: string;
      delimEnd?: string;
    };
    const data: Record<string, unknown> = { ...rest };

    // Delimiter có thể đổi → tác động detect; tính delimiter hiệu lực.
    const delimChanged = delimStart !== undefined || delimEnd !== undefined;
    const delimiters = this.delimitersOf(
      delimStart ?? existing.delimStart,
      delimEnd ?? existing.delimEnd,
    );
    if (delimChanged) {
      data.delimStart = delimiters.start;
      data.delimEnd = delimiters.end;
    }

    // Mapping mới do admin gửi HOẶC delimiter đổi → re-validate/re-detect theo file hiện tại.
    if (dtoVariables !== undefined || delimChanged) {
      const detected = detectDocxVariables(Buffer.from(existing.fileBytes), delimiters);
      data.variables =
        dtoVariables && dtoVariables.length
          ? this.validateVariableMapping(existing.entityType, dtoVariables, detected)
          : this.autoVariablesFromDetected(detected, existing.entityType);
    }

    // requiredVariables: set cờ required trên variables (đã update ở trên hoặc hiện có).
    // Bỏ chặn DON_THU (codex/PR3): readiness áp dụng cho cả Đơn thư khi đã vào hệ động.
    if (requiredVariables !== undefined) {
      const reqSet = new Set(requiredVariables);
      const baseVars = (data.variables as TemplateVariable[] | undefined) ??
        ((existing.variables as TemplateVariable[] | null) ?? []);
      data.variables = baseVars.map((v) => ({ ...v, required: reqSet.has(v.name) }));
    }

    return this.prisma.documentTemplate.update({ where: { id }, data });
  }

  /** Thay file .docx: chuẩn hóa + re-detect; GIỮ mapping cũ (field/label/required) cho biến trùng tên. */
  async replaceFile(id: string, file: UploadFile, _userId: string) {
    const existing = await this.getById(id);
    const delimiters = this.delimitersOf(existing.delimStart, existing.delimEnd);
    this.assertValidDocx(file.buffer);
    const buffer = normalizeDocxTags(file.buffer);
    this.assertValidDocx(buffer);
    const detected = detectDocxVariables(buffer, delimiters);

    const oldByName = new Map<string, TemplateVariable>(
      ((existing.variables as TemplateVariable[] | null) ?? []).map((v) => [v.name, v]),
    );
    const merged = this.autoVariablesFromDetected(detected, existing.entityType).map((auto) => {
      const old = oldByName.get(auto.name);
      return old ? { ...auto, ...old } : auto; // giữ mapping cũ (field/label/required)
    });
    const variables = this.validateVariableMapping(existing.entityType, merged, detected);
    const fileSha = createHash('sha256').update(buffer).digest('hex');

    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        fileBytes: buffer as unknown as Uint8Array<ArrayBuffer>,
        fileSha,
        fileName: file.originalname,
        variables: variables as unknown as object[],
      },
    });
  }

  async softDelete(id: string) {
    await this.getById(id);
    await this.prisma.documentTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Danh mục trường khả dụng (whitelist) cho dropdown admin map placeholder→field. */
  fieldCatalog(entityType: string) {
    return listCatalog(entityType as EntityType);
  }

  /**
   * Preview placeholder khi admin upload (chưa lưu): chuẩn hóa + detect theo delimiter +
   * gợi ý mapping (auto-suy field từ catalog). UI hiển thị để admin chỉnh trước khi lưu.
   */
  previewVariables(file: UploadFile, entityType: string, delimStart?: string, delimEnd?: string) {
    this.assertValidDocx(file.buffer);
    const delimiters = this.delimitersOf(delimStart, delimEnd);
    const buffer = normalizeDocxTags(file.buffer);
    const detected = detectDocxVariables(buffer, delimiters);
    return { detected, suggested: this.autoVariablesFromDetected(detected, entityType) };
  }

  /** File .docx (bytes + tên) để admin tải về sửa. */
  async getFileForDownload(id: string): Promise<{ fileName: string; bytes: Buffer }> {
    const t = await this.getById(id);
    return { fileName: t.fileName, bytes: Buffer.from(t.fileBytes) };
  }
}
