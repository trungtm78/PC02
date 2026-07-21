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
import { sanitizeFilename, buildDocumentFilename, dedupeFilenames } from '../common/utils/filename.util';
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

/**
 * Bảng + cột FK render-log/cấp số theo loại hồ sơ (row-lock + commitWithTx idKey + renderLog).
 *
 * `codeField` = cột mã hồ sơ hiển thị cho người đọc, dùng đặt tên file xuất ra. Mỗi entity
 * một tên cột khác nhau — thiếu map này thì tên file mất phần mã, đúng cái bug cần sửa:
 *   Petition.stt (DT-2026-36679) · Case.caseCode (NULLABLE) · Incident.code
 */
const ENTITY_DB: Record<
  EntityType,
  { table: string; idField: 'caseId' | 'incidentId' | 'petitionId'; codeField: string }
> = {
  VU_AN: { table: 'cases', idField: 'caseId', codeField: 'caseCode' },
  VU_VIEC: { table: 'incidents', idField: 'incidentId', codeField: 'code' },
  DON_THU: { table: 'petitions', idField: 'petitionId', codeField: 'stt' },
};

/** 1 dòng manifest = 1 cặp (hồ sơ × mẫu). `code` BẮT BUỘC: cùng 1 `id` xuất hiện M lần. */
interface BatchManifestItem {
  id: string;
  code: string;
  ok: boolean;
  documentNumber?: string;
  error?: string;
  /** true = lỗi hệ thống (không phải thiếu dữ liệu) → FE phải báo lỗi, không báo thành công. */
  systemError?: boolean;
}

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
    /** PHẢI cùng ngữ cảnh với lúc render — nếu không, biến phụ thuộc người in
     *  (tenCanBoDeXuat/vietTatCanBo) bị coi là rỗng → báo "thiếu bắt buộc" SAI. */
    ctx?: ResolveContext,
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
        const auto = resolveField(entityType, v.field ?? v.name, record, ctx).trim();
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
      // Tên "nhìn là hiểu": DT-2026-36679_Phiếu đề xuất_0012.docx.
      // (Trước đây `${code}_${documentNumber ?? code}.docx` → mẫu KHÔNG cấp số ra
      //  "PHIEU_DE_XUAT_PHIEU_DE_XUAT.docx", và không có mã hồ sơ nên xuất hàng loạt
      //  xong không biết file nào của đơn nào.)
      filename: buildDocumentFilename({
        recordCode: record?.[ENTITY_DB[entityType].codeField],
        templateName: template.name,
        documentNumber,
      }),
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
    this.assertRequiredSatisfied(entityType, record, ordered, manualValues, ctx);

    const deliverable = await this.prisma.$transaction(async (tx: any) => {
      const rendered: RenderedTemplate[] = [];
      for (const t of ordered) {
        rendered.push(
          await this.renderTemplateInTx(tx, entityType, entityId, record, t, actorId, manualValues, ctx),
        );
      }
      // finalize TRONG tx → lỗi gộp/zip cũng rollback số.
      if (mode === 'merged') {
        // Đúng 1 mẫu → không cần merge (giữ nguyên file gốc, tránh xử lý thừa)
        // và giữ luôn tên file theo mẫu để tải nhiều file rời không bị trùng tên.
        const buf =
          rendered.length === 1
            ? rendered[0].buffer
            : this.docxMerge.merge(rendered.map((r) => r.buffer));
        return { buf, zip: false, singleName: rendered.length === 1 ? rendered[0].filename : undefined };
      }
      return { buf: await this.buildZipBuffer(rendered), zip: true, singleName: undefined };
    });

    const baseName = `ChungTu_${this.dateStamp()}`;
    if (!deliverable.zip) {
      // FE chế độ "tách từng file Word rời" gọi lần lượt 1 mẫu/lần → tên file phải
      // theo mã mẫu + số văn bản, nếu không mọi file tải về đều trùng tên.
      this.setDownloadHeaders(res, DOCX_CONTENT_TYPE, deliverable.singleName ?? `${baseName}.docx`);
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
    return this.exportBatchByCodes(entityType, [code], entityIds, loadRecord, actorId, res);
  }

  /** Trần SỐ FILE 1 lô = N hồ sơ × M mẫu. UAT TC-PET-120 chốt 100 file < 30s; vượt xa hơn
   *  sẽ đụng timeout gateway và giữ response mở hàng phút. */
  private static readonly MAX_BATCH_FILES = 100;

  /**
   * Xuất ĐỒNG LOẠT M mẫu × N hồ sơ → 1 ZIP (mỗi cặp 1 file + manifest.json).
   *
   * Mỗi (hồ sơ × mẫu) render trong tx RIÊNG → 1 cặp lỗi (thiếu trường/ngoài scope) KHÔNG
   * abort cả lô, và KHÔNG rollback số văn bản của cặp đã thành công. Đây là lý do KHÔNG
   * gom M mẫu của cùng 1 hồ sơ vào một tx.
   *
   * `loadRecord` do controller cấp (đã check RBAC scope) → service không phụ thuộc service
   * hồ sơ (tránh cycle). KHÔNG nhận manualValues (batch không có popup bổ sung).
   */
  async exportBatchByCodes(
    entityType: EntityType,
    codes: string[],
    entityIds: string[],
    loadRecord: (id: string) => Promise<any>,
    actorId: string,
    res: Response,
  ): Promise<void> {
    if (!entityIds.length) {
      throw new BadRequestException('Danh sách hồ sơ trống');
    }
    if (!codes.length) {
      throw new BadRequestException('Chưa chọn mẫu chứng từ');
    }
    // Dedup id/code trùng → 1 cặp chỉ cấp 1 số văn bản (tránh nhảy/lãng phí số sổ — đối xứng
    // với reject templateIds trùng ở exportEntityDocuments).
    const ids = [...new Set(entityIds)];
    const wantedCodes = [...new Set(codes)];

    // Trần đặt TRƯỚC mọi truy vấn/cấp số: vượt trần thì không được tiêu số nào.
    const fileCount = ids.length * wantedCodes.length;
    if (fileCount > DynamicExportService.MAX_BATCH_FILES) {
      throw new BadRequestException(
        `Lô quá lớn: ${ids.length} hồ sơ × ${wantedCodes.length} mẫu = ${fileCount} file ` +
          `(tối đa ${DynamicExportService.MAX_BATCH_FILES}). Vui lòng chia nhỏ.`,
      );
    }

    const templates = await this.prisma.documentTemplate.findMany({
      where: { entityType, code: { in: wantedCodes }, deletedAt: null, status: 'active' },
    });
    const missing = wantedCodes.filter((c) => !templates.some((t: any) => t.code === c));
    if (missing.length) {
      throw new BadRequestException(
        `Không tìm thấy mẫu chứng từ "${missing.join('", "')}" cho loại hồ sơ này`,
      );
    }
    // Lỗi CẤU HÌNH mẫu (cấp số nhưng thiếu series) áp dụng cho MỌI hồ sơ → kiểm TOÀN BỘ mẫu
    // TRƯỚC vòng lặp. Kiểm muộn (khi tới lượt mẫu thứ 2) sẽ throw SAU KHI mẫu thứ 1 đã commit
    // số → đốt số sổ rồi trả 5xx, số không rollback được vì tx đã đóng.
    for (const t of templates) {
      if (t.needsNumber && !t.numberSeriesId) {
        throw new BadRequestException(
          `Mẫu "${t.code}" bật cấp số nhưng chưa cấu hình series số văn bản`,
        );
      }
    }
    // Giữ thứ tự người dùng chọn.
    const ordered = wantedCodes.map((c) => templates.find((t: any) => t.code === c)!);

    // Người in — dùng chung cho cả lô (1 query).
    const ctx = await this.loadActorContext(actorId);

    // Nạp mỗi hồ sơ ĐÚNG 1 LẦN rồi dùng lại cho cả M mẫu (trước đây N×M lần loadRecord,
    // mỗi lần là 1 query nested include). Cache chỉ sống trong 1 request của 1 actor nên
    // không nới lỏng kiểm tra phạm vi dữ liệu.
    const recordCache = new Map<string, Promise<any>>();
    const loadOnce = (id: string) => {
      let p = recordCache.get(id);
      if (!p) {
        p = loadRecord(id);
        recordCache.set(id, p);
      }
      return p;
    };

    const rendered: RenderedTemplate[] = [];
    const manifest: BatchManifestItem[] = [];
    for (const template of ordered) {
      const part = await this.renderOneCode(entityType, template, ids, loadOnce, actorId, ctx);
      rendered.push(...part.rendered);
      manifest.push(...part.manifest);
    }

    let zip: Buffer;
    try {
      zip = await this.buildBatchZip(rendered, manifest);
    } catch (e) {
      // Số văn bản đã commit trước bước này. Không giao được file thì phải ghi lại để
      // quản trị đối soát sổ, KHÔNG để mất dấu lặng lẽ.
      const burned = manifest.filter((m) => m.ok && m.documentNumber).map((m) => `${m.code}:${m.documentNumber}`);
      this.logger.error(
        `Đóng gói ZIP thất bại SAU KHI đã cấp ${burned.length} số văn bản: ${burned.join(', ')}`,
      );
      throw e;
    }
    // Header đếm để FE báo kết quả mà KHÔNG cần unzip blob (chi tiết từng cặp vẫn ở
    // manifest.json). Phải có Access-Control-Expose-Headers (main.ts) để FE đọc.
    // LƯU Ý: Total/Ok/Failed đếm theo SỐ FILE (N×M), không phải số hồ sơ — thêm
    // X-Batch-Records để FE hiển thị đúng "x file / y hồ sơ".
    const okCount = manifest.filter((m) => m.ok).length;
    res.setHeader('X-Batch-Total', String(manifest.length));
    res.setHeader('X-Batch-Ok', String(okCount));
    res.setHeader('X-Batch-Failed', String(manifest.length - okCount));
    res.setHeader('X-Batch-Records', String(ids.length));
    // Phân biệt "thiếu dữ liệu nghiệp vụ" (người dùng tự sửa được) với "lỗi hệ thống"
    // (phải báo quản trị) — vì cả hai đều ra ok:false trong manifest.
    res.setHeader('X-Batch-System-Error', String(manifest.filter((m) => m.systemError).length));
    const zipStem = ordered.length === 1 ? ordered[0].code : 'ChungTu';
    this.setDownloadHeaders(res, 'application/zip', `${zipStem}_${this.dateStamp()}.zip`);
    res.send(zip);
  }

  /**
   * Render 1 mẫu cho N hồ sơ. Thân vòng lặp nguyên bản của exportBatchByCode — tách ra để
   * exportBatchByCodes gọi lại M lần, KHÔNG đổi ngữ nghĩa cấp số / transaction / phân loại lỗi.
   */
  private async renderOneCode(
    entityType: EntityType,
    template: any,
    ids: string[],
    loadRecord: (id: string) => Promise<any>,
    actorId: string,
    ctx: ResolveContext,
  ): Promise<{ rendered: RenderedTemplate[]; manifest: BatchManifestItem[] }> {
    const rendered: RenderedTemplate[] = [];
    const manifest: BatchManifestItem[] = [];
    for (const id of ids) {
      try {
        const record = await loadRecord(id);
        this.assertRequiredSatisfied(entityType, record, [template], {}, ctx);
        const r = await this.prisma.$transaction((tx: any) =>
          this.renderTemplateInTx(tx, entityType, id, record, template, actorId, {}, ctx),
        );
        // renderTemplateInTx đã đặt tên "Mã hồ sơ_Tên mẫu_Số VB" — KHÔNG ghi đè bằng
        // `${code}_${id}` nữa (fallback cũ rơi về UUID thô, người dùng không đọc được).
        rendered.push(r);
        manifest.push({ id, code: template.code, ok: true, documentNumber: r.documentNumber });
      } catch (e) {
        // Lỗi NGHIỆP VỤ (thiếu trường bắt buộc) → ghi manifest, lô tiếp tục.
        if (e instanceof BadRequestException) {
          manifest.push({ id, code: template.code, ok: false, error: e.message });
        } else if (e instanceof ForbiddenException || e instanceof NotFoundException) {
          // Ngoài scope / không tồn tại → message TRUNG LẬP (chống IDOR-enumeration: không
          // để client phân biệt id thật-ngoài-quyền vs id không tồn tại).
          manifest.push({
            id,
            code: template.code,
            ok: false,
            error: 'Không xử lý được hồ sơ (không tồn tại hoặc ngoài phạm vi)',
          });
        } else {
          // Lỗi HỆ THỐNG ở cặp này KHÔNG được ABORT cả lô.
          //
          // Số văn bản của các cặp TRƯỚC đã commit ở tx riêng — throw ra ngoài sẽ trả 5xx,
          // client không nhận file nào, và những số đó CHÁY VĨNH VIỄN (không rollback được).
          // Vì vậy: ghi manifest, đánh dấu systemError để header/FE báo lỗi THẬT (không để
          // người dùng tưởng đã xuất trọn vẹn), và vẫn giao ZIP chứa các file đã cấp số.
          //
          // Bản thân cặp lỗi thì an toàn: cấp số + render + renderLog nằm CÙNG một tx nên
          // số của chính nó được rollback.
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.error(
            `Lỗi hệ thống khi xuất chứng từ ${template.code} cho hồ sơ ${id}: ${msg}`,
          );
          manifest.push({
            id,
            code: template.code,
            ok: false,
            systemError: true,
            error: 'Lỗi hệ thống khi tạo chứng từ này. Vui lòng thử lại hoặc báo quản trị.',
          });
        }
      }
    }
    return { rendered, manifest };
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
      // Dedup: archiver KHÔNG chặn entry trùng tên → công cụ giải nén ghi đè, mất file âm thầm.
      // Tên nay dựa trên template.name (không unique) nên trùng là có thật.
      // KHÔNG sanitize lại: `filename` đã sạch từ buildDocumentFilename, mà sanitize lần 2
      // cắt ở 200 ký tự TÍNH CẢ đuôi → xén mất ".docx", file trong ZIP không mở được.
      const names = dedupeFilenames(docs.map((d) => d.filename));
      docs.forEach((d, i) => archive.append(d.buffer, { name: names[i] }));
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
      // Dedup như buildBatchZip: 2 mẫu khác id nhưng trùng `name` (admin upload bản mới)
      // trong cùng 1 hồ sơ sẽ ra 2 entry cùng tên nếu không xử lý.
      // KHÔNG sanitize lại: `filename` đã sạch từ buildDocumentFilename, mà sanitize lần 2
      // cắt ở 200 ký tự TÍNH CẢ đuôi → xén mất ".docx", file trong ZIP không mở được.
      const names = dedupeFilenames(docs.map((d) => d.filename));
      docs.forEach((d, i) => archive.append(d.buffer, { name: names[i] }));
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
