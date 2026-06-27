# Xuất chứng từ động Vụ việc/Vụ án — Implementation Plan (PR1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây nền tảng template động — bảng `DocumentTemplate` (lưu .docx trong DB) + module CRUD + upload .docx tự quét biến + trang admin quản lý template.

**Architecture:** Module NestJS mới `document-templates` (controller/service/dto + feature.manifest) theo pattern `document-numbers`. Template `.docx` lưu DB (Bytes) → admin upload/sửa runtime không cần deploy. FE feature `document-templates` (list + modal upload) theo pattern `document-numbers` FE.

**Tech Stack:** NestJS + Prisma (PostgreSQL 18 @5433) · pizzip (đọc .docx) · class-validator · React + Vite + vitest · FileInterceptor (multer).

## Global Constraints

- DB: PostgreSQL 18 @ `127.0.0.1:5433` (đã cấu hình).
- TDD bắt buộc mỗi task: RED → GREEN → REFACTOR → commit. Không code production trước test.
- Backend test: `cd backend && node node_modules/jest/bin/jest.js --no-coverage <pattern>`. Backend type-check: `node node_modules/typescript/bin/tsc --noEmit`.
- FE test: `cd frontend && node node_modules/vitest/vitest.mjs run --no-coverage <pattern>`. FE type-check thật: `node node_modules/typescript/bin/tsc -b` (KHÔNG `--noEmit` — no-op).
- Dùng `command git` khi commit (RTK có thể hỏng ref).
- Enum comparison dùng constants/enum, không string literal (CI grep guard).
- Commit Conventional Commits, kết thúc bằng `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Nhánh: `feat/vu-viec-vu-an-export-documents` (đã tạo off main).

---

### Task 1: Prisma model `DocumentTemplate` + migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (thêm model cuối file, trước phần generator nếu có quy ước; theo vị trí các model khác)
- Create (auto): `backend/prisma/migrations/<timestamp>_add_document_template/migration.sql`

**Interfaces:**
- Produces: Prisma model `DocumentTemplate` với các trường: `id, code, name, entityType, category, fileBytes (Bytes), fileSha, fileName, variables (Json), needsNumber (Boolean), numberSeriesId (String?), status, sortOrder, createdById, createdAt, updatedAt, deletedAt`.

- [ ] **Step 1: Thêm model vào schema.prisma**

```prisma
model DocumentTemplate {
  id             String    @id @default(cuid())
  code           String    @unique
  name           String
  entityType     String    // VU_VIEC | VU_AN | DON_THU
  category       String    // Quyết định | Biên bản | Lệnh | Thông báo | Giấy chứng nhận | Khác
  fileBytes      Bytes
  fileSha        String
  fileName       String
  variables      Json      @default("[]") // [{name, source: 'auto'|'manual', label}]
  needsNumber    Boolean   @default(false)
  numberSeriesId String?
  status         String    @default("active")
  sortOrder      Int       @default(0)
  createdById    String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  @@index([entityType, status])
  @@index([category])
  @@map("document_templates")
}
```

- [ ] **Step 2: Tạo migration (KHÔNG dùng CREATE INDEX CONCURRENTLY — bài học v0.40)**

Run: `cd backend && npx prisma migrate dev --name add_document_template`
Expected: migration tạo bảng `document_templates` + 2 index thường; `prisma generate` chạy lại; client có `prisma.documentTemplate`.

- [ ] **Step 3: Verify client + tsc**

Run: `cd backend && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS (không lỗi TS; `PrismaClient.documentTemplate` tồn tại).

- [ ] **Step 4: Commit**

```bash
command git add backend/prisma/schema.prisma backend/prisma/migrations/
command git commit -m "feat(doc-templates): model DocumentTemplate + migration

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Util auto-detect biến từ .docx

**Files:**
- Create: `backend/src/document-templates/docx-variables.util.ts`
- Test: `backend/src/document-templates/docx-variables.util.spec.ts`

**Interfaces:**
- Produces: `detectDocxVariables(buffer: Buffer): string[]` — trả danh sách tên biến `{ten}` duy nhất trong `word/document.xml`, đã loại trùng + giữ thứ tự xuất hiện. Bỏ qua placeholder rỗng/space.

- [ ] **Step 1: Viết test RED**

```typescript
import PizZip from 'pizzip';
import { detectDocxVariables } from './docx-variables.util';

function makeDocx(bodyText: string): Buffer {
  // docx tối thiểu: 1 file word/document.xml trong zip
  const zip = new PizZip();
  zip.file('word/document.xml',
    `<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>${bodyText}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generate({ type: 'nodebuffer' });
}

describe('detectDocxVariables', () => {
  it('trích các biến {ten} duy nhất theo thứ tự', () => {
    const buf = makeDocx('Số {soVuAn} bị can {hoTenBiCan} tội {toiDanh} lại {soVuAn}');
    expect(detectDocxVariables(buf)).toEqual(['soVuAn', 'hoTenBiCan', 'toiDanh']);
  });
  it('bỏ qua {} rỗng và khoảng trắng', () => {
    const buf = makeDocx('a {} b { } c {ok}');
    expect(detectDocxVariables(buf)).toEqual(['ok']);
  });
  it('không có biến → mảng rỗng', () => {
    expect(detectDocxVariables(makeDocx('không có biến'))).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `cd backend && node node_modules/jest/bin/jest.js --no-coverage docx-variables`
Expected: FAIL (`detectDocxVariables is not a function`).

- [ ] **Step 3: Implement util (GREEN)**

```typescript
import PizZip from 'pizzip';

/** Trích tên biến {ten} duy nhất từ word/document.xml của 1 buffer .docx.
 *  Lưu ý: text trong docx có thể bị tách run → đọc document.xml thô đủ cho
 *  placeholder đơn giản {ten}; biến phức tạp do admin soạn liền mạch. */
export function detectDocxVariables(buffer: Buffer): string[] {
  const zip = new PizZip(buffer);
  const xml = zip.file('word/document.xml')?.asText() ?? '';
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\{([^{}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const name = m[1].trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}
```

- [ ] **Step 4: Chạy test → PASS**

Run: `cd backend && node node_modules/jest/bin/jest.js --no-coverage docx-variables`
Expected: PASS 3/3.

- [ ] **Step 5: Commit**

```bash
command git add backend/src/document-templates/docx-variables.util.ts backend/src/document-templates/docx-variables.util.spec.ts
command git commit -m "feat(doc-templates): util detectDocxVariables (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: DTO + hằng entityType/category

**Files:**
- Create: `backend/src/document-templates/dto/create-document-template.dto.ts`
- Create: `backend/src/document-templates/dto/update-document-template.dto.ts`
- Create: `backend/src/document-templates/document-template.constants.ts`

**Interfaces:**
- Produces: `ENTITY_TYPES = ['VU_VIEC','VU_AN','DON_THU'] as const`; `TEMPLATE_CATEGORIES = ['Quyết định','Biên bản','Lệnh','Thông báo','Giấy chứng nhận','Khác'] as const`. `CreateDocumentTemplateDto { code, name, entityType, category, needsNumber?, numberSeriesId?, sortOrder? }` (file đi qua multipart, không trong DTO body). `UpdateDocumentTemplateDto` = partial (không gồm code, file).

- [ ] **Step 1: Viết constants + DTO**

```typescript
// document-template.constants.ts
export const ENTITY_TYPES = ['VU_VIEC', 'VU_AN', 'DON_THU'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
export const TEMPLATE_CATEGORIES = ['Quyết định', 'Biên bản', 'Lệnh', 'Thông báo', 'Giấy chứng nhận', 'Khác'] as const;
```

```typescript
// dto/create-document-template.dto.ts
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ENTITY_TYPES, TEMPLATE_CATEGORIES } from '../document-template.constants';

export class CreateDocumentTemplateDto {
  @IsString() @MaxLength(50) code!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsIn(ENTITY_TYPES as unknown as string[]) entityType!: string;
  @IsIn(TEMPLATE_CATEGORIES as unknown as string[]) category!: string;
  // multipart: các field bool/int tới dạng string → @Type ép kiểu
  @IsOptional() @Type(() => Boolean) @IsBoolean() needsNumber?: boolean;
  @IsOptional() @IsString() numberSeriesId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}
```

```typescript
// dto/update-document-template.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateDocumentTemplateDto } from './create-document-template.dto';
export class UpdateDocumentTemplateDto extends PartialType(
  OmitType(CreateDocumentTemplateDto, ['code'] as const),
) {}
```

- [ ] **Step 2: tsc check (không cần test riêng cho DTO khai báo)**

Run: `cd backend && node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
command git add backend/src/document-templates/dto/ backend/src/document-templates/document-template.constants.ts
command git commit -m "feat(doc-templates): DTO + constants entityType/category

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: DocumentTemplatesService (CRUD + sha + detect biến)

**Files:**
- Create: `backend/src/document-templates/document-templates.service.ts`
- Test: `backend/src/document-templates/document-templates.service.spec.ts`

**Interfaces:**
- Consumes: `detectDocxVariables` (Task 2); `PrismaService`; `ENTITY_TYPES`.
- Produces:
  - `create(dto, file: { buffer: Buffer; originalname: string }, userId): Promise<DocumentTemplate>` — tính sha256, detect biến (mặc định source='auto'), lưu fileBytes.
  - `list(filter: { entityType?; category?; status? }): Promise<DocumentTemplate[]>` (loại deletedAt, sort sortOrder asc).
  - `getById(id): Promise<DocumentTemplate>` (throw NotFound).
  - `update(id, dto): Promise<DocumentTemplate>`.
  - `replaceFile(id, file, userId)`: cập nhật fileBytes + sha + re-detect biến.
  - `softDelete(id): Promise<void>`.

- [ ] **Step 1: Viết test RED (mock PrismaService)**

```typescript
import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';
import PizZip from 'pizzip';
import { DocumentTemplatesService } from './document-templates.service';
import { PrismaService } from '../prisma/prisma.service';

function docx(text: string): Buffer {
  const z = new PizZip();
  z.file('word/document.xml', `<w:body><w:t>${text}</w:t></w:body>`);
  return z.generate({ type: 'nodebuffer' });
}
const mockPrisma = {
  documentTemplate: {
    create: jest.fn((a) => Promise.resolve({ id: 't1', ...a.data })),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    update: jest.fn((a) => Promise.resolve({ id: a.where.id, ...a.data })),
  },
};

describe('DocumentTemplatesService', () => {
  let svc: DocumentTemplatesService;
  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [DocumentTemplatesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    svc = mod.get(DocumentTemplatesService);
    jest.clearAllMocks();
  });

  it('create: tính sha + detect biến (source auto) + lưu bytes', async () => {
    const buf = docx('Số {soVuAn} {hoTenBiCan}');
    await svc.create(
      { code: 'QD-KTVA', name: 'QĐ khởi tố', entityType: 'VU_AN', category: 'Quyết định' } as any,
      { buffer: buf, originalname: 'a.docx' }, 'u1');
    const data = mockPrisma.documentTemplate.create.mock.calls[0][0].data;
    expect(data.fileSha).toBe(createHash('sha256').update(buf).digest('hex'));
    expect(data.variables).toEqual([
      { name: 'soVuAn', source: 'auto', label: 'soVuAn' },
      { name: 'hoTenBiCan', source: 'auto', label: 'hoTenBiCan' },
    ]);
    expect(data.createdById).toBe('u1');
  });

  it('list: lọc entityType + status, loại deletedAt', async () => {
    await svc.list({ entityType: 'VU_AN', status: 'active' });
    expect(mockPrisma.documentTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, entityType: 'VU_AN', status: 'active' },
        orderBy: { sortOrder: 'asc' },
      }));
  });

  it('getById: không thấy → NotFound', async () => {
    mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);
    await expect(svc.getById('x')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Chạy → FAIL**

Run: `cd backend && node node_modules/jest/bin/jest.js --no-coverage document-templates.service`
Expected: FAIL (service chưa có).

- [ ] **Step 3: Implement service (GREEN)**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { detectDocxVariables } from './docx-variables.util';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';

type UploadFile = { buffer: Buffer; originalname: string };

@Injectable()
export class DocumentTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildVariables(buffer: Buffer) {
    return detectDocxVariables(buffer).map((name) => ({ name, source: 'auto', label: name }));
  }

  async create(dto: CreateDocumentTemplateDto, file: UploadFile, userId: string) {
    const fileSha = createHash('sha256').update(file.buffer).digest('hex');
    return this.prisma.documentTemplate.create({
      data: {
        code: dto.code, name: dto.name, entityType: dto.entityType, category: dto.category,
        fileBytes: file.buffer, fileSha, fileName: file.originalname,
        variables: this.buildVariables(file.buffer),
        needsNumber: dto.needsNumber ?? false, numberSeriesId: dto.numberSeriesId ?? null,
        sortOrder: dto.sortOrder ?? 0, createdById: userId,
      },
    });
  }

  async list(filter: { entityType?: string; category?: string; status?: string }) {
    return this.prisma.documentTemplate.findMany({
      where: {
        deletedAt: null,
        ...(filter.entityType ? { entityType: filter.entityType } : {}),
        ...(filter.category ? { category: filter.category } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
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

  async replaceFile(id: string, file: UploadFile, _userId: string) {
    await this.getById(id);
    const fileSha = createHash('sha256').update(file.buffer).digest('hex');
    return this.prisma.documentTemplate.update({
      where: { id },
      data: { fileBytes: file.buffer, fileSha, fileName: file.originalname, variables: this.buildVariables(file.buffer) },
    });
  }

  async softDelete(id: string) {
    await this.getById(id);
    await this.prisma.documentTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
```

- [ ] **Step 4: Chạy → PASS**

Run: `cd backend && node node_modules/jest/bin/jest.js --no-coverage document-templates.service`
Expected: PASS 3/3.

- [ ] **Step 5: Commit**

```bash
command git add backend/src/document-templates/document-templates.service.ts backend/src/document-templates/document-templates.service.spec.ts
command git commit -m "feat(doc-templates): DocumentTemplatesService CRUD + sha + detect biến (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Controller + upload + RBAC + module + manifest

**Files:**
- Create: `backend/src/document-templates/document-templates.controller.ts`
- Create: `backend/src/document-templates/document-templates.module.ts`
- Create: `backend/src/document-templates/feature.manifest.ts`
- Test: `backend/src/document-templates/document-templates.controller.spec.ts`
- Modify: `backend/src/app.module.ts` (import `DocumentTemplatesModule`)
- Tham chiếu pattern upload: `backend/src/documents/documents.controller.ts` (FileInterceptor + @UploadedFile)

**Interfaces:**
- Consumes: `DocumentTemplatesService` (Task 4).
- Produces endpoints (guard `@RequirePermissions admin` — chỉ admin cấu hình; multipart cho create/replace):
  - `GET /document-templates?entityType&category&status` → list
  - `POST /document-templates` (FileInterceptor 'file') → create
  - `GET /document-templates/:id` → getById
  - `PATCH /document-templates/:id` → update
  - `POST /document-templates/:id/file` (FileInterceptor 'file') → replaceFile
  - `DELETE /document-templates/:id` → softDelete

- [ ] **Step 1: Viết controller spec RED (mock service, kiểm delegation)**

```typescript
import { Test } from '@nestjs/testing';
import { DocumentTemplatesController } from './document-templates.controller';
import { DocumentTemplatesService } from './document-templates.service';

const mockSvc = {
  list: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ id: 't1' }),
  getById: jest.fn().mockResolvedValue({ id: 't1' }),
  update: jest.fn().mockResolvedValue({ id: 't1' }),
  replaceFile: jest.fn().mockResolvedValue({ id: 't1' }),
  softDelete: jest.fn().mockResolvedValue(undefined),
};

describe('DocumentTemplatesController', () => {
  let ctrl: DocumentTemplatesController;
  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      controllers: [DocumentTemplatesController],
      providers: [{ provide: DocumentTemplatesService, useValue: mockSvc }],
    }).compile();
    ctrl = mod.get(DocumentTemplatesController);
    jest.clearAllMocks();
  });

  it('create: truyền file + dto + userId xuống service', async () => {
    const file = { buffer: Buffer.from('x'), originalname: 'a.docx' } as any;
    await ctrl.create({ code: 'C' } as any, file, { id: 'u1' } as any);
    expect(mockSvc.create).toHaveBeenCalledWith({ code: 'C' }, file, 'u1');
  });
  it('list: truyền query filter', async () => {
    await ctrl.list('VU_AN', undefined, 'active');
    expect(mockSvc.list).toHaveBeenCalledWith({ entityType: 'VU_AN', category: undefined, status: 'active' });
  });
});
```

- [ ] **Step 2: Chạy → FAIL**

Run: `cd backend && node node_modules/jest/bin/jest.js --no-coverage document-templates.controller`
Expected: FAIL.

- [ ] **Step 3: Implement controller + module + manifest (GREEN)**

Đọc `backend/src/documents/documents.controller.ts` để sao đúng cú pháp `FileInterceptor('file')` + `@UploadedFile()` + guard decorators của dự án (`@RequirePermissions`, `@CurrentUser`).

```typescript
// document-templates.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DocumentTemplatesService } from './document-templates.service';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';

@Controller('document-templates')
@RequirePermissions({ action: 'manage', subject: 'all' }) // admin-only (khớp guard dự án)
export class DocumentTemplatesController {
  constructor(private readonly svc: DocumentTemplatesService) {}

  @Get()
  list(@Query('entityType') entityType?: string, @Query('category') category?: string, @Query('status') status?: string) {
    return this.svc.list({ entityType, category, status });
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  create(@Body() dto: CreateDocumentTemplateDto, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: { id: string }) {
    return this.svc.create(dto, file, user.id);
  }

  @Get(':id') getById(@Param('id') id: string) { return this.svc.getById(id); }

  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateDocumentTemplateDto) { return this.svc.update(id, dto); }

  @Post(':id/file')
  @UseInterceptors(FileInterceptor('file'))
  replaceFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: { id: string }) {
    return this.svc.replaceFile(id, file, user.id);
  }

  @Delete(':id') remove(@Param('id') id: string) { return this.svc.softDelete(id); }
}
```

```typescript
// document-templates.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentTemplatesController } from './document-templates.controller';
import { DocumentTemplatesService } from './document-templates.service';

@Module({
  imports: [PrismaModule],
  controllers: [DocumentTemplatesController],
  providers: [DocumentTemplatesService],
  exports: [DocumentTemplatesService],
})
export class DocumentTemplatesModule {}
```

```typescript
// feature.manifest.ts — theo đúng shape của document-numbers/feature.manifest.ts
export const featureManifest = {
  key: 'document-templates',
  name: 'Quản lý mẫu chứng từ',
  description: 'Quản lý template .docx động cho vụ việc/vụ án/đơn thư',
};
```

Wire vào `app.module.ts`: thêm `DocumentTemplatesModule` vào mảng `imports` (mirror cách `DocumentNumbersModule` được import).

- [ ] **Step 4: Chạy controller test + tsc + app.bootstrap**

Run: `cd backend && node node_modules/jest/bin/jest.js --no-coverage document-templates.controller && node node_modules/typescript/bin/tsc --noEmit`
Expected: controller PASS 2/2; tsc PASS. (Nếu có app.bootstrap spec, chạy để xác nhận DI graph resolve module mới.)

- [ ] **Step 5: Commit**

```bash
command git add backend/src/document-templates/ backend/src/app.module.ts
command git commit -m "feat(doc-templates): controller upload/CRUD + module + manifest + wire (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — types + api + hook

**Files:**
- Create: `frontend/src/features/document-templates/types.ts`
- Create: `frontend/src/features/document-templates/api.ts`
- Test: `frontend/src/features/document-templates/__tests__/api.test.ts`
- Tham chiếu pattern: `frontend/src/features/document-numbers/api.ts`

**Interfaces:**
- Produces: type `DocumentTemplate`, `EntityType`. `listTemplates(filter)`, `createTemplate(formData)`, `updateTemplate(id, dto)`, `replaceTemplateFile(id, file)`, `deleteTemplate(id)` — gọi `api` (axios) endpoint `/document-templates`, trả `res.data.data` (envelope `{success,data}`).

- [ ] **Step 1: Viết test RED (mock api)**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import { listTemplates, createTemplate } from '../api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
const mGet = vi.mocked(api.get); const mPost = vi.mocked(api.post);

beforeEach(() => { mGet.mockReset(); mPost.mockReset(); });

describe('document-templates api', () => {
  it('listTemplates: GET với query entityType + trả data', async () => {
    mGet.mockResolvedValue({ data: { success: true, data: [{ id: 't1' }] } } as never);
    const r = await listTemplates({ entityType: 'VU_AN' });
    expect(mGet).toHaveBeenCalledWith('/document-templates', { params: { entityType: 'VU_AN' } });
    expect(r).toEqual([{ id: 't1' }]);
  });
  it('createTemplate: POST multipart FormData', async () => {
    mPost.mockResolvedValue({ data: { success: true, data: { id: 't1' } } } as never);
    const fd = new FormData();
    await createTemplate(fd);
    expect(mPost).toHaveBeenCalledWith('/document-templates', fd, expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }));
  });
});
```

- [ ] **Step 2: Chạy → FAIL**

Run: `cd frontend && node node_modules/vitest/vitest.mjs run --no-coverage document-templates`
Expected: FAIL.

- [ ] **Step 3: Implement types + api (GREEN)**

```typescript
// types.ts
export type EntityType = 'VU_VIEC' | 'VU_AN' | 'DON_THU';
export interface TemplateVariable { name: string; source: 'auto' | 'manual'; label: string; }
export interface DocumentTemplate {
  id: string; code: string; name: string; entityType: EntityType; category: string;
  fileName: string; fileSha: string; variables: TemplateVariable[];
  needsNumber: boolean; numberSeriesId: string | null; status: string; sortOrder: number;
}
```

```typescript
// api.ts
import { api } from '@/lib/api';
import type { DocumentTemplate } from './types';

export async function listTemplates(filter: { entityType?: string; category?: string; status?: string } = {}) {
  const res = await api.get('/document-templates', { params: filter });
  return (res.data.data ?? []) as DocumentTemplate[];
}
export async function createTemplate(form: FormData) {
  const res = await api.post('/document-templates', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data.data as DocumentTemplate;
}
export async function updateTemplate(id: string, dto: Partial<DocumentTemplate>) {
  const res = await api.patch(`/document-templates/${id}`, dto);
  return res.data.data as DocumentTemplate;
}
export async function replaceTemplateFile(id: string, file: File) {
  const form = new FormData(); form.append('file', file);
  const res = await api.post(`/document-templates/${id}/file`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data.data as DocumentTemplate;
}
export async function deleteTemplate(id: string) { await api.delete(`/document-templates/${id}`); }
```

Lưu ý: `listTemplates` chỉ truyền `params: filter` — test mong `{ params: { entityType: 'VU_AN' } }`; bỏ key undefined trước khi gọi (filter chỉ chứa key có giá trị) hoặc khởi tạo filter rỗng. Điều chỉnh để khớp test (lọc undefined).

- [ ] **Step 4: Chạy → PASS + tsc -b**

Run: `cd frontend && node node_modules/vitest/vitest.mjs run --no-coverage document-templates && node node_modules/typescript/bin/tsc -b`
Expected: PASS; tsc sạch.

- [ ] **Step 5: Commit**

```bash
command git add frontend/src/features/document-templates/types.ts frontend/src/features/document-templates/api.ts frontend/src/features/document-templates/__tests__/api.test.ts
command git commit -m "feat(doc-templates): FE types + api + test (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Frontend — trang admin list + modal upload

**Files:**
- Create: `frontend/src/features/document-templates/pages/DocumentTemplatesPage.tsx`
- Create: `frontend/src/features/document-templates/components/TemplateFormModal.tsx`
- Create: `frontend/src/features/document-templates/routes.tsx`
- Create: `frontend/src/features/document-templates/menu.ts`
- Create: `frontend/src/features/document-templates/feature.manifest.ts`
- Create: `frontend/src/features/document-templates/index.ts`
- Test: `frontend/src/features/document-templates/components/__tests__/TemplateFormModal.test.tsx`
- Tham chiếu pattern đầy đủ: `frontend/src/features/document-numbers/` (pages/routes/menu/manifest/index) — sao cấu trúc, đổi nội dung.

**Interfaces:**
- Consumes: `listTemplates/createTemplate/...` (Task 6); `DocumentTemplate` type.
- Produces: route `/document-templates` (admin) hiện bảng template (lọc entityType/category) + nút "Thêm mẫu" mở `TemplateFormModal` (upload .docx + chọn entity/category/needsNumber/series + sortOrder). testid: `doc-templates-page`, `btn-add-template`, `template-form-modal`, `template-file-input`, `template-entity-select`, `template-category-select`, `template-needs-number`, `btn-save-template`.

- [ ] **Step 1: Viết test RED cho TemplateFormModal (render + submit gọi createTemplate)**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as apiMod from '../../api';
import { TemplateFormModal } from '../TemplateFormModal';

vi.spyOn(apiMod, 'createTemplate').mockResolvedValue({ id: 't1' } as never);
beforeEach(() => vi.clearAllMocks());

describe('TemplateFormModal', () => {
  it('hiện form với chọn entity/category + input file', () => {
    render(<TemplateFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByTestId('template-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('template-entity-select')).toBeInTheDocument();
    expect(screen.getByTestId('template-file-input')).toBeInTheDocument();
  });
  it('submit hợp lệ → gọi createTemplate (FormData) + onSaved', async () => {
    const onSaved = vi.fn();
    render(<TemplateFormModal onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.change(screen.getByTestId('template-code-input'), { target: { value: 'QD-KTVA' } });
    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'QĐ khởi tố' } });
    const file = new File(['x'], 'a.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    fireEvent.change(screen.getByTestId('template-file-input'), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId('btn-save-template'));
    await waitFor(() => expect(apiMod.createTemplate).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy → FAIL**

Run: `cd frontend && node node_modules/vitest/vitest.mjs run --no-coverage TemplateFormModal`
Expected: FAIL.

- [ ] **Step 3: Implement modal + page + routes/menu/manifest/index (GREEN)**

Sao cấu trúc `frontend/src/features/document-numbers/{routes.tsx,menu.ts,feature.manifest.ts,index.ts}` (auto-discovered registry). Modal `TemplateFormModal`: state `code,name,entityType,category,needsNumber,sortOrder,file`; `handleSave` build `FormData` (append từng field + file) → `createTemplate(form)` → `onSaved()`. Các testid như Interfaces. Page: `listTemplates` + bảng + filter + nút "Thêm mẫu" mở modal. Menu mục "Quản lý mẫu chứng từ" trong nhóm Quản lý hệ thống. `feature_flags` key `document-templates` (seed sau, hoặc thêm vào seed features).

- [ ] **Step 4: Chạy test + tsc -b + build**

Run: `cd frontend && node node_modules/vitest/vitest.mjs run --no-coverage document-templates && node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build`
Expected: PASS; tsc sạch; build OK.

- [ ] **Step 5: Commit**

```bash
command git add frontend/src/features/document-templates/
command git commit -m "feat(doc-templates): trang admin list + TemplateFormModal upload (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Checkpoint cuối PR1 (trước /ship)
- Full BE suite + tsc; full FE suite + tsc -b + build.
- `/review` + `/codex` (cross-model) trên diff PR1.
- `/plan-eng-review` đối chiếu PR1 với spec.
- Seed `feature_flags` key `document-templates` (nếu dùng flag) để menu hiện.
- Smoke thủ công: upload 1 .docx có biến `{soVuAn}` → thấy biến auto-detect trong danh sách.

## PR2-4 (plan riêng sau khi PR1 land)
- **PR2:** generalize `renderDocumentsAtomic` (nhận entityType + manualValues + load template từ DB) + placeholder catalog VU_VIEC/VU_AN (`buildEntityPlaceholders`) + endpoint `POST /cases/:id/export-documents` + `/incidents/:id/export-documents` + atomic/no-gap test.
- **PR3:** UI vụ việc/vụ án — `SaveSplitButton` trên CaseFormPage/IncidentFormPage + nút "In chứng từ" độc lập trên chi tiết + `ExportDocumentsModal` tổng quát hoá (fetch template theo entity, nhóm category, form biến manual).
- **PR4:** đồng bộ đơn thư — nút "In chứng từ" độc lập trên chi tiết đơn thư (tái dùng modal hiện có).

## Self-Review (đã chạy)
- Spec coverage: PR1 phủ data model + template-manager CRUD + upload + auto-detect biến + admin FE (mục 1,3 spec). PR2-4 phủ render engine + tích hợp + đồng bộ (mục 2,4,5,6 spec) — ghi rõ ở trên.
- Placeholder scan: không có TBD/“xử lý lỗi phù hợp” chung chung; mỗi step có lệnh + code/cú pháp cụ thể (riêng Task 7 FE page sao pattern document-numbers — đã trỏ file mẫu chính xác thay vì lặp ~300 dòng boilerplate registry).
- Type consistency: `detectDocxVariables` (Task2) → service buildVariables (Task4); DTO field (Task3) → controller (Task5) → FE types/api (Task6) → modal (Task7) khớp tên/kiểu (`entityType`, `needsNumber`, `numberSeriesId`, `variables[].source`).
