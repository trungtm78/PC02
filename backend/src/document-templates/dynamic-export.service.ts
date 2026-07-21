import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { createHash } from 'crypto';
import archiver from 'archiver';
import { sanitizeFilename } from '../common/utils/filename.util';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { DocxMergeService } from '../petitions/docx-merge.service';
import {
  buildTemplatePlaceholders,
  DYNAMIC_EXPORT_SAVABLE,
  TemplateVariable,
} from './entity-placeholders';
import { ResolveContext, resolveField } from './field-catalog';
import { resolveRenderer } from './renderers';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type EntityType = 'VU_AN' | 'VU_VIEC' | 'DON_THU';

/** Bảng + cột FK render-log/cấp số theo loại hồ sơ (row-lock + commitWithTx idKey + renderLog). */
const ENTITY_DB: Record<EntityType, { table: string; idField: 'caseId' | 'incidentId' | 'petitionId' }> = {
  VU_AN: { table: 'cases', idField: 'caseId' },
  VU_VIEC: { table: 'incidents', idField: 'incidentId' },
  DON_THU: { table: 'petitions', idField: 'petitionId' },
};

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
        format: true,
        delimStart: true,
        delimEnd: true,
        needsNumber: true,
        numberSeriesId: true,
        status: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  /**
   * PR2 — readiness per mẫu động: trường còn THIẾU để in (theo cờ `required` admin khai báo).
   * - AUTO-required: tính qua buildEntityPlaceholders; rỗng = thiếu. savable nếu map tới cột đơn giản
   *   (DYNAMIC_EXPORT_SAVABLE) → FE PUT lưu hồ sơ; ngoài map → savable=false → manualValues override.
   * - MANUAL-required: luôn liệt kê (nhập tại popup làm manualValues, savable=false).
   * `record` đã được controller load + check scope. `updatedAt` để FE PUT bổ sung không 409.
   */
  getExportReadiness(entityType: EntityType, record: any) {
    const savableMap = DYNAMIC_EXPORT_SAVABLE[entityType] ?? {};
    return this.listExportableTemplates(entityType).then((templates) => {
      const items = templates.map((t) => {
        const vars = (t.variables as TemplateVariable[] | null) ?? [];
        const missing = [] as Array<{ field: string; label: string; type: 'text' | 'textarea'; savable: boolean; column?: string }>;
        for (const v of vars) {
          if (!v.required) continue;
          // auto rỗng = resolveField (theo mapping field, fallback name) ra chuỗi rỗng.
          const autoEmpty =
            v.source === 'auto' && resolveField(entityType, v.field ?? v.name, record).trim() === '';
          if (autoEmpty || v.source === 'manual') {
            const sav = savableMap[v.name];
            // DON_THU: cột phẳng → savable=true (FE PUT /petitions/:id "Lưu bổ sung vào đơn").
            // VU_AN/VU_VIEC: savable=false (form map field khác cột → chỉ manualValues override khi xuất).
            const savable = entityType === 'DON_THU' && !!sav;
            missing.push({
              field: v.name,
              label: v.label || v.name,
              type: sav?.type ?? 'text',
              savable,
              ...(savable && sav ? { column: sav.column } : {}),
            });
          }
        }
        return { templateId: t.id, code: t.code, ready: missing.length === 0, missing };
      });
      return { items, updatedAt: record?.updatedAt };
    });
  }

  /**
   * [codex P1#2] Fail-closed: ném BadRequest nếu CÒN trường bắt buộc chưa đủ cho mẫu nào trong danh
   * sách xuất. "Đủ" = manualValues[name] có giá trị (người dùng nhập tại popup) HOẶC (auto) resolveField
   * ra giá trị từ hồ sơ. Chạy TRƯỚC transaction/cấp số.
   */
  private assertRequiredSatisfied(
    entityType: EntityType,
    record: any,
    templates: any[],
    manualValues: Record<string, string>,
  ): void {
    const missing = new Set<string>();
    for (const t of templates) {
      const vars = (t.variables as TemplateVariable[] | null) ?? [];
      for (const v of vars) {
        if (!v.required) continue;
        if ((v.field ?? v.name) === 'soVanBan') continue; // số cấp lúc in, không validate required
        // String() coerce — manualValues value có thể không phải string (codex P2: tránh .trim() crash 500).
        const manual = String(manualValues[v.name] ?? '').trim();
        if (manual) continue; // người dùng đã nhập tại popup
        if (v.source === 'manual') {
          missing.add(v.label || v.name);
          continue;
        }
        const auto = resolveField(entityType, v.field ?? v.name, record).trim();
        if (!auto) missing.add(v.label || v.name);
      }
    }
    if (missing.size > 0) {
      throw new BadRequestException(
        `Thiếu thông tin bắt buộc để in: ${[...missing].join(', ')}. Vui lòng bổ sung trước khi xuất.`,
      );
    }
  }

  /**
   * Nạp thông tin người đang đăng nhập cho ngữ cảnh render (1 query, ngoài tx).
   * Không tìm thấy → trả `{}` để resolver fallback về người tạo hồ sơ.
   */
  private async loadActorContext(actorId: string | undefined): Promise<ResolveContext> {
    if (!actorId) return {};
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { firstName: true, lastName: true, rank: true },
    });
    return { actor: actor ?? null };
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
    /** Người đang đăng nhập — để các dòng ký in tên NGƯỜI IN, không phải người tạo hồ sơ. */
    ctx?: ResolveContext,
  ): Promise<RenderedTemplate> {
    let documentNumber: string | undefined;
    if (template.needsNumber) {
      // [codex P2] needsNumber bật mà thiếu series = template cấu hình sai → fail, không render câm.
      if (!template.numberSeriesId) {
        throw new BadRequestException(`Mẫu "${template.code}" bật cấp số nhưng chưa cấu hình series số văn bản`);
      }
      // Row lock chống cấp số trùng khi 2 export đồng thời cùng hồ sơ.
      const db = ENTITY_DB[entityType];
      await tx.$queryRawUnsafe(`SELECT id FROM "${db.table}" WHERE id = $1 FOR UPDATE`, entityId);
      const idKey = { [db.idField]: entityId };
      const commit = await this.docNums.commitWithTx(
        template.numberSeriesId, // = DocumentNumberTemplate.documentType (series key)
        { userId: actorId, departmentId: record.unit ?? record.unitId ?? undefined, ...idKey },
        tx,
        { documentId: entityId },
      );
      documentNumber = commit.number;
    }

    const delimiters = { start: template.delimStart ?? '{', end: template.delimEnd ?? '}' };
    const variables = (template.variables as TemplateVariable[] | null) ?? [];
    const placeholders = buildTemplatePlaceholders(
      entityType,
      variables,
      record,
      { ...manualValues, ...(documentNumber ? { soVanBan: documentNumber } : {}) },
      delimiters,
      ctx,
    );

    const renderer = resolveRenderer(template.format);
    const buffer = renderer.render({
      buffer: Buffer.from(template.fileBytes),
      data: placeholders,
      delimiters,
    });
    const fileSha = createHash('sha256').update(buffer).digest('hex');

    await tx.documentRenderLog.create({
      data: {
        [ENTITY_DB[entityType].idField]: entityId,
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
    // [codex P2] soVanBan CHỈ do engine cấp (số văn bản) — strip khỏi manualValues để client
    // không forge số văn bản (khi template có {soVanBan} mà needsNumber=false).
    const { soVanBan: _ignored, ...manualSafe } = manualValues ?? {};
    void _ignored;
    manualValues = manualSafe;
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

    // Người đang đăng nhập — các dòng ký ("Cán bộ đề xuất", "NGƯỜI GIAO", dòng "Lưu:")
    // phải in tên NGƯỜI IN, không phải người tạo hồ sơ (enteredBy). Nạp 1 lần, ngoài tx.
    const ctx = await this.loadActorContext(actorId);

    // [codex P1#2] Validate trường BẮT BUỘC TRƯỚC khi vào tx/cấp số (fail-closed, không cấp số rồi
    // render rỗng câm). Required auto rỗng (không có manualValues override) hoặc manual chưa nhập → throw.
    this.assertRequiredSatisfied(entityType, record, ordered, manualValues);

    const deliverable = await this.prisma.$transaction(async (tx: any) => {
      const rendered: RenderedTemplate[] = [];
      for (const t of ordered) {
        rendered.push(
          await this.renderTemplateInTx(tx, entityType, entityId, record, t, actorId, manualValues, ctx),
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

  /**
   * Xuất ĐỒNG LOẠT 1 mẫu (theo `code`) cho NHIỀU hồ sơ → ZIP (mỗi hồ sơ 1 file + manifest.json).
   * Mỗi hồ sơ render trong tx RIÊNG → 1 hồ sơ lỗi (thiếu trường/ngoài scope) KHÔNG abort cả lô
   * (ghi vào manifest). Thay BatchExportService tĩnh (PR4) — dùng mẫu .docx ĐỘNG trong DB.
   * `loadRecord` do controller cấp (đã check RBAC scope) → DynamicExportService không phụ thuộc
   * service hồ sơ (tránh cycle). KHÔNG nhận manualValues (batch không có popup bổ sung).
   */
  async exportBatchByCode(
    entityType: EntityType,
    code: string,
    entityIds: string[],
    loadRecord: (id: string) => Promise<any>,
    actorId: string,
    res: Response,
  ): Promise<void> {
    if (!entityIds.length) {
      throw new BadRequestException('Danh sách hồ sơ trống');
    }
    // Dedup id trùng → 1 đơn chỉ cấp 1 số văn bản (tránh nhảy/lãng phí số sổ — đối xứng
    // với reject templateIds trùng ở exportEntityDocuments).
    const ids = [...new Set(entityIds)];
    const template = await this.prisma.documentTemplate.findFirst({
      where: { entityType, code, deletedAt: null, status: 'active' },
    });
    if (!template) {
      throw new BadRequestException(`Không tìm thấy mẫu chứng từ "${code}" cho loại hồ sơ này`);
    }
    // Lỗi CẤU HÌNH mẫu (cấp số nhưng thiếu series) áp dụng cho MỌI hồ sơ trong lô → kiểm 1 lần
    // TRƯỚC vòng lặp + abort (codex P2: nếu để per-record catch sẽ che lỗi cấu hình thành "ok:false").
    if (template.needsNumber && !template.numberSeriesId) {
      throw new BadRequestException(`Mẫu "${code}" bật cấp số nhưng chưa cấu hình series số văn bản`);
    }

    // Người in — dùng chung cho cả lô (1 query).
    const ctx = await this.loadActorContext(actorId);

    const rendered: RenderedTemplate[] = [];
    const manifest: Array<{ id: string; ok: boolean; documentNumber?: string; error?: string }> = [];
    for (const id of ids) {
      try {
        const record = await loadRecord(id);
        this.assertRequiredSatisfied(entityType, record, [template], {});
        const r = await this.prisma.$transaction((tx: any) =>
          this.renderTemplateInTx(tx, entityType, id, record, template, actorId, {}, ctx),
        );
        rendered.push({ ...r, filename: sanitizeFilename(`${code}_${r.documentNumber ?? id}.docx`) });
        manifest.push({ id, ok: true, documentNumber: r.documentNumber });
      } catch (e) {
        // Lỗi NGHIỆP VỤ (thiếu trường bắt buộc) → ghi manifest, lô tiếp tục.
        if (e instanceof BadRequestException) {
          manifest.push({ id, ok: false, error: e.message });
        } else if (e instanceof ForbiddenException || e instanceof NotFoundException) {
          // Ngoài scope / không tồn tại → message TRUNG LẬP (chống IDOR-enumeration: không
          // để client phân biệt id thật-ngoài-quyền vs id không tồn tại).
          manifest.push({ id, ok: false, error: 'Không xử lý được hồ sơ (không tồn tại hoặc ngoài phạm vi)' });
        } else {
          // Lỗi HỆ THỐNG (DB down, series cấu hình sai…) → rethrow để ABORT lô + trả 5xx thật,
          // KHÔNG che bằng "ok:false" khiến người dùng tưởng đã xuất.
          throw e;
        }
      }
    }

    const zip = await this.buildBatchZip(rendered, manifest);
    // Header đếm để FE báo "X/Y thành công, Z thất bại" mà KHÔNG cần unzip blob (chi tiết per-đơn
    // vẫn ở manifest.json trong ZIP). Phải có Access-Control-Expose-Headers (main.ts) để FE đọc.
    const okCount = manifest.filter((m) => m.ok).length;
    res.setHeader('X-Batch-Total', String(manifest.length));
    res.setHeader('X-Batch-Ok', String(okCount));
    res.setHeader('X-Batch-Failed', String(manifest.length - okCount));
    this.setDownloadHeaders(res, 'application/zip', `${code}_${this.dateStamp()}.zip`);
    res.send(zip);
  }

  private buildBatchZip(
    docs: RenderedTemplate[],
    manifest: Array<{ id: string; ok: boolean; documentNumber?: string; error?: string }>,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];
      archive.on('data', (c: Buffer) => chunks.push(c));
      archive.on('warning', (err) => this.logger.warn(`zip warning: ${err.message}`));
      archive.on('error', reject);
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      for (const d of docs) archive.append(d.buffer, { name: sanitizeFilename(d.filename) });
      archive.append(JSON.stringify({ total: manifest.length, items: manifest }, null, 2), {
        name: 'manifest.json',
      });
      void archive.finalize();
    });
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
    // Strip non-ASCII + ký tự phá cú pháp header (" \ ; CR LF) → chống header/filename injection
    // khi filename chứa giá trị do admin cấu hình (vd template.code) — codex P2.
    const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\;\r\n]/g, '_');
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
