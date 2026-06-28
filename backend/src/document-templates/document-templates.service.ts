import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import PizZip from 'pizzip';
import { PrismaService } from '../prisma/prisma.service';
import { detectDocxVariables } from './docx-variables.util';
import { isAutoPlaceholder } from './entity-placeholders';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';

type UploadFile = { buffer: Buffer; originalname: string };

@Injectable()
export class DocumentTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Biến phát hiện từ .docx → phân loại theo catalog của entityType:
   * thuộc danh mục chuẩn (auto-điền từ record/số) = 'auto'; ngoài danh mục = 'manual'
   * (admin/cán bộ nhập tay khi in — tránh placeholder render rỗng câm).
   */
  private buildVariables(buffer: Buffer, entityType: string) {
    return detectDocxVariables(buffer).map((name) => ({
      name,
      source: isAutoPlaceholder(entityType, name) ? 'auto' : 'manual',
      label: name,
      // PR2: admin đánh dấu bắt buộc sau (qua update.requiredVariables). Mặc định không bắt buộc.
      required: false,
    }));
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

  async create(dto: CreateDocumentTemplateDto, file: UploadFile, userId: string) {
    this.assertValidDocx(file.buffer);
    // needsNumber bật mà thiếu numberSeriesId → mẫu cấu hình sai (export sẽ luôn fail 400).
    // Chặn ngay lúc tạo thay vì để chết khi in.
    if (dto.needsNumber && !dto.numberSeriesId) {
      throw new BadRequestException('Bật cấp số văn bản thì phải chọn chuỗi số (numberSeriesId)');
    }
    const fileSha = createHash('sha256').update(file.buffer).digest('hex');
    try {
      return await this.prisma.documentTemplate.create({
        data: {
          code: dto.code,
          name: dto.name,
          entityType: dto.entityType,
          category: dto.category,
          // Buffer là Uint8Array runtime; cast giữ reference cho Prisma Bytes (v7 type khắt khe hơn).
          fileBytes: file.buffer as unknown as Uint8Array<ArrayBuffer>,
          fileSha,
          fileName: file.originalname,
          variables: this.buildVariables(file.buffer, dto.entityType),
          needsNumber: dto.needsNumber ?? false,
          numberSeriesId: dto.numberSeriesId ?? null,
          sortOrder: dto.sortOrder ?? 0,
          createdById: userId,
        },
      });
    } catch (e) {
      // Partial unique [entityType, code] WHERE deletedAt IS NULL → P2002. Trả 409 thân thiện.
      if ((e as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Mã mẫu đã tồn tại cho loại hồ sơ này');
      }
      throw e;
    }
  }

  async list(filter: { entityType?: string; category?: string; status?: string }) {
    // [codex P2] omit fileBytes — list chỉ cần metadata, không tải ≤5MB/mẫu vào JSON.
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
    // PR2: requiredVariables (tên các biến BẮT BUỘC) — set lại cờ required trên variables hiện có,
    // KHÔNG ghi cột không tồn tại. Tách khỏi phần spread vào prisma.
    const { requiredVariables, ...rest } = dto as UpdateDocumentTemplateDto & { requiredVariables?: string[] };
    const data: Record<string, unknown> = { ...rest };
    if (requiredVariables !== undefined) {
      // readiness chỉ áp dụng VU_AN/VU_VIEC (đơn thư dùng mẫu hardcode) → chặn cấu hình required
      // cho DON_THU để khỏi tạo trạng thái vô tác dụng (codex PR3 #1).
      if (existing.entityType === 'DON_THU') {
        throw new BadRequestException('Không hỗ trợ cấu hình biến bắt buộc cho mẫu Đơn thư');
      }
      const reqSet = new Set(requiredVariables);
      const vars = ((existing.variables as Array<{ name: string }>) ?? []).map((v) => ({
        ...v,
        required: reqSet.has(v.name),
      }));
      data.variables = vars;
    }
    return this.prisma.documentTemplate.update({ where: { id }, data });
  }

  /** Thay file .docx: cập nhật bytes + sha + re-detect biến (phân loại theo entityType cũ). */
  async replaceFile(id: string, file: UploadFile, _userId: string) {
    const existing = await this.getById(id);
    this.assertValidDocx(file.buffer);
    const fileSha = createHash('sha256').update(file.buffer).digest('hex');
    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        fileBytes: file.buffer as unknown as Uint8Array<ArrayBuffer>,
        fileSha,
        fileName: file.originalname,
        variables: this.buildVariables(file.buffer, existing.entityType),
      },
    });
  }

  async softDelete(id: string) {
    await this.getById(id);
    await this.prisma.documentTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
