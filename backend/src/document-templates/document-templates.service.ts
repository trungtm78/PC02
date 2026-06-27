import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import PizZip from 'pizzip';
import { PrismaService } from '../prisma/prisma.service';
import { detectDocxVariables } from './docx-variables.util';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';

type UploadFile = { buffer: Buffer; originalname: string };

@Injectable()
export class DocumentTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Biến phát hiện từ .docx → mặc định source 'auto' (catalog ở PR2 sẽ phân biệt auto/manual). */
  private buildVariables(buffer: Buffer) {
    return detectDocxVariables(buffer).map((name) => ({ name, source: 'auto', label: name }));
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
    const fileSha = createHash('sha256').update(file.buffer).digest('hex');
    return this.prisma.documentTemplate.create({
      data: {
        code: dto.code,
        name: dto.name,
        entityType: dto.entityType,
        category: dto.category,
        // Buffer là Uint8Array runtime; cast giữ reference cho Prisma Bytes (v7 type khắt khe hơn).
        fileBytes: file.buffer as unknown as Uint8Array<ArrayBuffer>,
        fileSha,
        fileName: file.originalname,
        variables: this.buildVariables(file.buffer),
        needsNumber: dto.needsNumber ?? false,
        numberSeriesId: dto.numberSeriesId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        createdById: userId,
      },
    });
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
    await this.getById(id);
    return this.prisma.documentTemplate.update({ where: { id }, data: { ...dto } });
  }

  /** Thay file .docx: cập nhật bytes + sha + re-detect biến. */
  async replaceFile(id: string, file: UploadFile, _userId: string) {
    await this.getById(id);
    this.assertValidDocx(file.buffer);
    const fileSha = createHash('sha256').update(file.buffer).digest('hex');
    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        fileBytes: file.buffer as unknown as Uint8Array<ArrayBuffer>,
        fileSha,
        fileName: file.originalname,
        variables: this.buildVariables(file.buffer),
      },
    });
  }

  async softDelete(id: string) {
    await this.getById(id);
    await this.prisma.documentTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
