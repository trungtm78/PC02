import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { createHash } from 'crypto';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import archiver from 'archiver';
import { sanitizeFilename } from '../common/utils/filename.util';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { DocxMergeService } from '../petitions/docx-merge.service';
import { buildEntityPlaceholders } from './entity-placeholders';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type EntityType = 'VU_AN' | 'VU_VIEC';
interface RenderedTemplate {
  buffer: Buffer;
  documentNumber?: string;
  filename: string;
  fileSha: string;
  code: string;
}

/**
 * Xuất NHIỀU template chứng từ ĐỘNG (.docx từ DB) cho 1 vụ án/vụ việc → gộp/zip.
 * Atomic: render + cấp số (template needsNumber) + finalize gộp/zip trong MỘT $transaction →
 * lỗi bất kỳ rollback HẾT (không gap số). Record đã được controller load + check RBAC scope.
 * KHÔNG đụng engine đơn thư (petitions.renderDocumentsAtomic) — service riêng giảm blast radius.
 */
@Injectable()
export class DynamicExportService {
  private readonly logger = new Logger(DynamicExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly docNums: DocumentNumbersService,
    private readonly docxMerge: DocxMergeService,
  ) {}

  /**
   * Liệt kê mẫu chứng từ ACTIVE cho 1 loại hồ sơ (phục vụ picker xuất chứng từ ở form
   * vụ việc/vụ án). KHÔNG trả fileBytes (nặng). Endpoint host (cases/incidents) bảo vệ bằng
   * quyền read Case/Incident — KHÔNG dùng /document-templates (quyền Setting/admin) vì điều
   * tra viên không có quyền Setting → sẽ 403 khi mở popup.
   */
  listExportableTemplates(entityType: EntityType) {
    return this.prisma.documentTemplate.findMany({
      where: { entityType, deletedAt: null, status: 'active' },
      select: {
        id: true,
        code: true,
        name: true,
        entityType: true,
        category: true,
        fileName: true,
        fileSha: true,
        variables: true,
        needsNumber: true,
        numberSeriesId: true,
        status: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  /** Render 1 template trong tx: cấp số (nếu cần) + docxtemplater trên bytes DB + render log. */
  private async renderTemplateInTx(
    tx: any,
    entityType: EntityType,
    entityId: string,
    record: any,
    template: any,
    actorId: string,
    manualValues: Record<string, string>,
  ): Promise<RenderedTemplate> {
    let documentNumber: string | undefined;
    if (template.needsNumber) {
      // [codex P2] needsNumber bật mà thiếu series = template cấu hình sai → fail, không render câm.
      if (!template.numberSeriesId) {
        throw new BadRequestException(`Mẫu "${template.code}" bật cấp số nhưng chưa cấu hình series số văn bản`);
      }
      // Row lock chống cấp số trùng khi 2 export đồng thời cùng hồ sơ.
      const table = entityType === 'VU_AN' ? 'cases' : 'incidents';
      await tx.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1 FOR UPDATE`, entityId);
      const idKey = entityType === 'VU_AN' ? { caseId: entityId } : { incidentId: entityId };
      const commit = await this.docNums.commitWithTx(
        template.numberSeriesId, // = DocumentNumberTemplate.documentType (series key)
        { userId: actorId, departmentId: record.unit ?? record.unitId ?? undefined, ...idKey },
        tx,
        { documentId: entityId },
      );
      documentNumber = commit.number;
    }

    const placeholders = buildEntityPlaceholders(entityType, record, {
      ...manualValues,
      ...(documentNumber ? { soVanBan: documentNumber } : {}),
    });

    const zip = new PizZip(Buffer.from(template.fileBytes));
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
    doc.render(placeholders);
    const buffer = doc.getZip().generate({ type: 'nodebuffer' }) as Buffer;
    const fileSha = createHash('sha256').update(buffer).digest('hex');

    await tx.documentRenderLog.create({
      data: {
        ...(entityType === 'VU_AN' ? { caseId: entityId } : { incidentId: entityId }),
        documentType: template.code,
        templateSha: template.fileSha,
        renderedById: actorId,
        generatedNumber: documentNumber ?? null,
        fileSha,
      },
    });

    return {
      buffer,
      documentNumber,
      fileSha,
      code: template.code,
      filename: sanitizeFilename(`${template.code}_${documentNumber ?? template.code}.docx`),
    };
  }

  async exportEntityDocuments(
    entityType: EntityType,
    entityId: string,
    record: any,
    templateIds: string[],
    mode: 'merged' | 'zip',
    actorId: string,
    manualValues: Record<string, string>,
    res: Response,
  ): Promise<void> {
    // [codex P2] reject templateIds trùng (nếu không sẽ render 2 lần + tiêu 2 số cho 1 mẫu).
    if (templateIds.length !== new Set(templateIds).size) {
      throw new BadRequestException('templateIds không được trùng lặp');
    }
    // Load + pre-validate templates (tồn tại, đúng entityType, active) TRƯỚC khi vào tx.
    const templates = await this.prisma.documentTemplate.findMany({
      where: { id: { in: templateIds }, deletedAt: null, status: 'active' },
    });
    if (templates.length !== new Set(templateIds).size) {
      throw new BadRequestException('Có mẫu chứng từ không tồn tại hoặc đã bị xoá');
    }
    if (templates.some((t) => t.entityType !== entityType)) {
      throw new BadRequestException('Mẫu chứng từ không thuộc loại hồ sơ này');
    }
    // Giữ thứ tự theo templateIds đầu vào.
    const ordered = templateIds.map((id) => templates.find((t) => t.id === id)!);

    const deliverable = await this.prisma.$transaction(async (tx: any) => {
      const rendered: RenderedTemplate[] = [];
      for (const t of ordered) {
        rendered.push(
          await this.renderTemplateInTx(tx, entityType, entityId, record, t, actorId, manualValues),
        );
      }
      // finalize TRONG tx → lỗi gộp/zip cũng rollback số.
      if (mode === 'merged') {
        return { buf: this.docxMerge.merge(rendered.map((r) => r.buffer)), zip: false };
      }
      return { buf: await this.buildZipBuffer(rendered), zip: true };
    });

    const baseName = `ChungTu_${this.dateStamp()}`;
    if (!deliverable.zip) {
      this.setDownloadHeaders(res, DOCX_CONTENT_TYPE, `${baseName}.docx`);
    } else {
      this.setDownloadHeaders(res, 'application/zip', `${baseName}.zip`);
    }
    res.send(deliverable.buf);
  }

  private buildZipBuffer(docs: RenderedTemplate[]): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];
      archive.on('data', (c: Buffer) => chunks.push(c));
      archive.on('warning', (err) => this.logger.warn(`zip warning: ${err.message}`));
      archive.on('error', reject);
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      for (const d of docs) archive.append(d.buffer, { name: sanitizeFilename(d.filename) });
      void archive.finalize();
    });
  }

  private setDownloadHeaders(res: Response, contentType: string, filename: string): void {
    res.setHeader('Content-Type', contentType);
    const ascii = filename.replace(/[^\x20-\x7E]/g, '_');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
  }

  private dateStamp(now: Date = new Date()): string {
    return (
      String(now.getFullYear()) +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0')
    );
  }
}
