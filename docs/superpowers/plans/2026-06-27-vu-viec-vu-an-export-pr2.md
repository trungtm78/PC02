# Xuất chứng từ động Vụ việc/Vụ án — PR2 Plan (render engine + endpoints)

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development hoặc executing-plans. Checkbox `- [ ]` để track.

**Goal:** Render atomic NHIỀU template động (.docx từ DB) cho 1 vụ việc/vụ án → gộp/zip + cấp số (tuỳ template) + biến nhập tay; endpoint `POST /cases/:id/export-documents` + `/incidents/:id/export-documents`.

**Architecture (QUYẾT ĐỊNH then chốt):** Build **render service ĐỘNG MỚI** trong module `document-templates` (`DynamicExportService`), KHÔNG refactor `renderDocumentsAtomic` của petitions (engine đơn thư v0.68.1.0 đã deploy — bám chặt disk-loader + DOC_TYPE_TO_SERIES + buildDocxPlaceholders petition-specific; đụng vào = rủi ro phá prod). Tái dùng PATTERN (1 `$transaction` bao render+cấp số+finalize, rollback nguyên khối, không gap số) + `DocxMergeService` + buildZipBuffer (copy từ petition-export-documents.service). Template .docx lấy từ `DocumentTemplate.fileBytes` (DB), render bằng docxtemplater (như `documentExport.renderDocxTemplate` nhưng nguồn buffer là DB không phải disk).

**Tech Stack:** NestJS + Prisma · docxtemplater + pizzip (render buffer DB) · document-numbers v0.42 (`commitWithTx` per `template.numberSeriesId`) · DocxMergeService (gộp) · archiver (zip).

## Global Constraints
- TDD mỗi task (RED→GREEN→REFACTOR + commit). BE test `node node_modules/jest/bin/jest.js --no-coverage`; tsc `--noEmit`.
- `command git` commit, kết Conventional + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- KHÔNG đụng `petitions.service.ts` renderDocumentsAtomic (giữ đơn thư nguyên).
- Atomic: render N + cấp số (chỉ template `needsNumber`) + finalize(gộp/zip) trong 1 `$transaction` → lỗi rollback hết, không gap số. Pre-validate tất cả trước.
- DB 5432 (psql áp migration nếu cần — xem [[project_vuviec_vuan_export]] gotcha).

---

### Task 1: Placeholder catalog VU_VIEC/VU_AN (`buildEntityPlaceholders`)
**Files:** Create `backend/src/document-templates/entity-placeholders.ts` + spec.
**Interfaces:** Produces `buildEntityPlaceholders(entityType: 'VU_VIEC'|'VU_AN', record: any, manualValues: Record<string,string>): Record<string,string>` — map field hồ sơ → placeholder + merge manual. Escape token user (chống injection docxtemplater) — copy `escapeUserSuppliedTokens` pattern từ petitions.service.
- Catalog VU_AN: `{soVuAn},{tenVuAn},{hoTenBiCan},{ngaySinhBiCan},{cccdBiCan},{diaChiBiCan},{toiDanh},{ngayKhoiTo},{dieuTraVien},{noiXayRa},{ngayXayRa},{donViGiaiQuyet}...` (map từ schema Case/Incident — ĐỌC schema.prisma model Case/Incident lúc code để lấy field thật).
- Catalog VU_VIEC: `{soVuViec},{tenVuViec},{nguonTin},{ngayTiepNhan},{noiDung},{dieuTraVien},{trangThai}...`.
- manualValues override/bổ sung biến không thuộc catalog.
- TDD: map field cơ bản + manual override + escape `{}<>` trong giá trị user.

### Task 2: Render 1 template động trong tx (`renderTemplateInTx`)
**Files:** Create `backend/src/document-templates/dynamic-export.service.ts` (method private) + spec.
**Interfaces:** `renderTemplateInTx(tx, entityType, entityId, record, template: DocumentTemplate, actorId, manualValues): Promise<{buffer, documentNumber?, fileSha}>`:
1. Nếu `template.needsNumber` → `tx.$queryRaw FOR UPDATE` lock entity row + `docNums.commitWithTx(template.numberSeriesId, {...}, tx, {documentId})` → số văn bản. Nếu không → không cấp.
2. placeholders = `buildEntityPlaceholders(entityType, record, {...manualValues, soVanBan: number})`.
3. render docxtemplater trên `template.fileBytes` (buffer DB) → buffer.
4. sha + `tx.documentRenderLog.create({ caseId/incidentId, documentType: template.code, templateSha: template.fileSha, generatedNumber, fileSha })`.
- TDD mock prisma/docNums + template buffer thật (pizzip) → assert cấp số khi needsNumber, không khi tắt; render chứa biến.

### Task 3: Atomic multi-export (`exportEntityDocuments`)
**Files:** `dynamic-export.service.ts` (method public) + spec.
**Interfaces:** `exportEntityDocuments(entityType, entityId, templateIds[], mode, actorId, dataScope, manualValues, res)`:
1. Load entity (Case/Incident) + RBAC scope (tái dùng cases/incidents service `getById` scope — inject hoặc assertScope). Pre-validate templateIds tồn tại + thuộc entityType.
2. `$transaction`: load N template (DB) → renderTemplateInTx mỗi cái → finalize (merge `DocxMergeService` / buildZipBuffer) TRONG tx → rollback nếu lỗi (no gap số).
3. res.send(buffer) (merged docx / zip). Copy buildZipBuffer + setDownloadHeaders từ petition-export-documents.service.
- TDD: atomic (1 $transaction, finalize lỗi → reject), merged N template, zip N entry, pre-validate template sai entityType → 400.

### Task 4: Endpoints cases + incidents
**Files:** Modify `backend/src/cases/cases.controller.ts` + `incidents.controller.ts` (thêm handler) + module wire DynamicExportService + spec controller.
**Interfaces:** `POST /cases/:id/export-documents` + `/incidents/:id/export-documents` body `{templateIds[], mode?, manualValues?}`. Guard `@RequirePermissions read Case`/`read Incident` (đã có) + `@Throttle 5/60s` (như đơn thư). `@Res()` stream.
- DTO `ExportEntityDocumentsDto` (templateIds @IsArray @ArrayNotEmpty, mode @IsIn merged/zip, manualValues @IsOptional object).
- Wire `DynamicExportService` vào CasesModule + IncidentsModule (import DocumentTemplatesModule export service).
- TDD controller: delegation + 400 validate.

## Checkpoint PR2
- Full BE suite + tsc. /review + /codex trên diff PR2. /plan-eng-review đối chiếu spec.
- E2E: tạo template VU_AN (PR1 admin) → POST /cases/:id/export-documents merged → docx chứa biến + số văn bản; no-gap khi 1 template lỗi.

## Self-Review
- Spec coverage: PR2 phủ mục 2 spec (render engine + catalog + endpoints + atomic). Quyết định KHÔNG refactor petition engine = giảm blast radius (đơn thư prod an toàn).
- Tái dùng: DocxMergeService, buildZipBuffer pattern, document-numbers commitWithTx, DocumentRenderLog (caseId/incidentId có sẵn), escapeUserSuppliedTokens pattern.
- Edge: template needsNumber tắt → không cấp số; manualValues cho biến ngoài catalog; lock FOR UPDATE trên cases/incidents (không phải petitions).
