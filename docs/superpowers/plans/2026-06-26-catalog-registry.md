# Catalog Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans — implement task-by-task, RED→GREEN→REFACTOR.

**Goal:** Hạ tầng "Catalog Registry" thống nhất cho enum danh mục (động cho nhóm mở, code cho nhóm legal), 1 hook/component/validator dùng chung; sau đó rollout từng danh mục.

**Architecture:** 1 registry khai báo mỗi danh mục (kind legal|dynamic, nhãn, cascading, nguồn). `CatalogService` resolve options/label/validate đồng nhất (legal từ registry, dynamic query Directory). Validator `@IsCatalogValue` thay `@IsEnum`. FE: `useCatalog` + `<CatalogSelect>`. KHÔNG đụng status/workflow enum.

**Tech Stack:** NestJS + Prisma (PG18 @5432) + React/Vite + React Query. Test: jest (BE) + vitest (FE) qua `rtk proxy`.

## Global Constraints
- Spec: `docs/superpowers/specs/2026-06-26-catalog-registry-dynamic-enums-design.md`.
- KHÔNG đụng status/workflow enum (CaseStatus/IncidentStatus/PetitionStatus/Subject*/Proposal/Guidance/Exchange/Delegation/Conclusion/ReportTdc) + transition/terminal/KPI logic.
- Nhóm legal GIỮ Prisma enum (khuyến nghị spec). Nhóm dynamic dùng `String`/`String[]` lưu `code`.
- Commit dùng `command git commit` (rtk hỏng ref — [[reference_rtk_git_commit_corruption]]). Migrate: SQL tay + `prisma migrate deploy`. DB 5432.
- Tái dùng `Directory` model (type/code/name/isActive) + `useDirectoryOptions` cho nhóm dynamic.
- Sau mỗi task green + tsc → `command git commit` Conventional Commits (KHÔNG push).

---

## PR-0 — HẠ TẦNG (chỉ THÊM, không đổi field nào)

### Task 1: Registry types + entries (BE)
**Files:**
- Create: `backend/src/catalog/catalog.registry.ts`
- Test: `backend/src/catalog/catalog.registry.spec.ts`

**Produces:** `CATALOG_REGISTRY: Record<string, CatalogEntry>`, type `CatalogEntry`, helper `getCatalogEntry(key): CatalogEntry`.

- [ ] **Step 1 (RED):** test registry có entry hợp lệ:
```ts
import { CATALOG_REGISTRY, getCatalogEntry } from './catalog.registry';
it('có entry LY_DO_KHONG_KHOI_TO legal multi với 7 giá trị', () => {
  const e = getCatalogEntry('LY_DO_KHONG_KHOI_TO');
  expect(e.kind).toBe('legal');
  expect(e.multi).toBe(true);
  expect((e as any).values).toHaveLength(7);
});
it('có entry DOCUMENT_TYPE dynamic source directory', () => {
  expect(getCatalogEntry('DOCUMENT_TYPE')).toMatchObject({ kind: 'dynamic', source: 'directory:DOCUMENT_TYPE' });
});
it('getCatalogEntry throw khi key không tồn tại', () => {
  expect(() => getCatalogEntry('KHONG_CO')).toThrow();
});
```
- [ ] **Step 2:** `cd backend && rtk proxy npx jest catalog.registry --no-coverage` → FAIL.
- [ ] **Step 3 (GREEN):** viết registry (bắt đầu 2 entry mẫu; điền đủ ở các PR sau):
```ts
export type CatalogValue = { code: string; label: string };
export type CatalogEntry =
  | { key: string; kind: 'legal'; multi?: boolean; ref?: string; enumName?: string; values: CatalogValue[];
      cascade?: { parentKey: string; map: Record<string, string[]> } }
  | { key: string; kind: 'dynamic'; multi?: boolean; source: `directory:${string}`;
      cascade?: { parentKey: string; map: Record<string, string[]> } };

export const CATALOG_REGISTRY: Record<string, CatalogEntry> = {
  LY_DO_KHONG_KHOI_TO: {
    key: 'LY_DO_KHONG_KHOI_TO', kind: 'legal', multi: true, ref: 'Đ.157 BLTTHS', enumName: 'LyDoKhongKhoiTo',
    values: [
      { code: 'KHONG_CO_SU_VIEC', label: 'Không có sự việc phạm tội' },
      { code: 'HANH_VI_KHONG_CAU_THANH_TOI_PHAM', label: 'Hành vi không cấu thành tội phạm' },
      { code: 'NGUOI_THUC_HIEN_CHUA_DU_TUOI', label: 'Người thực hiện chưa đủ tuổi chịu TNHS' },
      { code: 'NGUOI_PHAM_TOI_CHET', label: 'Người phạm tội đã chết' },
      { code: 'HET_THOI_HIEU', label: 'Hết thời hiệu truy cứu TNHS' },
      { code: 'TOI_PHAM_DA_DUOC_XOA_AN_TICH', label: 'Tội phạm đã được xóa án tích' },
      { code: 'TRUONG_HOP_KHAC', label: 'Trường hợp khác' },
    ],
  },
  DOCUMENT_TYPE: { key: 'DOCUMENT_TYPE', kind: 'dynamic', source: 'directory:DOCUMENT_TYPE' },
};

export function getCatalogEntry(key: string): CatalogEntry {
  const e = CATALOG_REGISTRY[key];
  if (!e) throw new Error(`Catalog key không tồn tại: ${key}`);
  return e;
}
```
- [ ] **Step 4:** chạy lại → PASS. `npx tsc --noEmit`.
- [ ] **Step 5:** `command git add backend/src/catalog && command git commit -m "feat(catalog): registry types + entries mẫu"`

### Task 2: CatalogService (BE)
**Files:**
- Create: `backend/src/catalog/catalog.service.ts`, `backend/src/catalog/catalog.module.ts`
- Test: `backend/src/catalog/catalog.service.spec.ts`

**Consumes:** `getCatalogEntry`, `PrismaService` (query `directory`).
**Produces:** `CatalogService` với `options(key): Promise<CatalogValue[]>`, `labelOf(key, code): Promise<string>`, `isValid(key, code): Promise<boolean>`.

- [ ] **Step 1 (RED):** test (mock prisma.directory.findMany):
```ts
it('options() legal trả values từ registry (không query DB)', async () => {
  const svc = new CatalogService({ directory: { findMany: jest.fn() } } as any);
  const opts = await svc.options('LY_DO_KHONG_KHOI_TO');
  expect(opts[0]).toEqual({ code: 'KHONG_CO_SU_VIEC', label: 'Không có sự việc phạm tội' });
});
it('options() dynamic query Directory theo type', async () => {
  const findMany = jest.fn().mockResolvedValue([{ code: 'VAN_BAN', name: 'Văn bản' }]);
  const svc = new CatalogService({ directory: { findMany } } as any);
  const opts = await svc.options('DOCUMENT_TYPE');
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { type: 'DOCUMENT_TYPE', isActive: true } }));
  expect(opts).toEqual([{ code: 'VAN_BAN', label: 'Văn bản' }]);
});
it('isValid() false khi code ngoài danh mục', async () => {
  const svc = new CatalogService({ directory: { findMany: jest.fn().mockResolvedValue([]) } } as any);
  expect(await svc.isValid('LY_DO_KHONG_KHOI_TO', 'BAY')).toBe(false);
});
```
- [ ] **Step 2:** `rtk proxy npx jest catalog.service` → FAIL.
- [ ] **Step 3 (GREEN):** implement:
```ts
@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}
  async options(key: string): Promise<CatalogValue[]> {
    const e = getCatalogEntry(key);
    if (e.kind === 'legal') return e.values;
    const type = e.source.split(':')[1];
    const rows = await this.prisma.directory.findMany({ where: { type, isActive: true }, orderBy: { order: 'asc' } });
    return rows.map((r) => ({ code: r.code, label: r.name }));
  }
  async isValid(key: string, code: string): Promise<boolean> {
    return (await this.options(key)).some((o) => o.code === code);
  }
  async labelOf(key: string, code: string): Promise<string> {
    return (await this.options(key)).find((o) => o.code === code)?.label ?? code;
  }
}
```
+ `CatalogModule` providers `[CatalogService]`, imports Prisma, exports `CatalogService`.
- [ ] **Step 4:** PASS. `tsc`.
- [ ] **Step 5:** commit `feat(catalog): CatalogService options/label/isValid`.

### Task 3: Validator @IsCatalogValue + controller (BE)
**Files:**
- Create: `backend/src/common/validators/is-catalog-value.validator.ts`, `backend/src/catalog/catalog.controller.ts`
- Test: `backend/src/common/validators/is-catalog-value.validator.spec.ts`

**Produces:** decorator `IsCatalogValue(key: string, opts?: { each?: boolean })`; endpoint `GET /catalog/:key/options`.

- [ ] **Step 1 (RED):** test validator (legal — sync registry check, không async cho legal):
```ts
class Dto { @IsCatalogValue('LY_DO_KHONG_KHOI_TO', { each: true }) x?: string[]; }
it('chấp nhận code hợp lệ', async () => {
  const d = plainToInstance(Dto, { x: ['HET_THOI_HIEU'] });
  expect(await validate(d)).toHaveLength(0);
});
it('từ chối code ngoài danh mục', async () => {
  const d = plainToInstance(Dto, { x: ['BAY'] });
  expect((await validate(d)).length).toBeGreaterThan(0);
});
```
- [ ] **Step 2:** FAIL.
- [ ] **Step 3 (GREEN):** validator dùng registry cho legal (sync) — dynamic check để service-layer (validator chỉ kiểm legal + isString):
```ts
export function IsCatalogValue(key: string, opts?: { each?: boolean }) {
  return ValidateBy({
    name: 'isCatalogValue',
    constraints: [key],
    validator: {
      validate(value: unknown) {
        const e = CATALOG_REGISTRY[key];
        if (e?.kind !== 'legal') return true; // dynamic validate ở service layer (DB)
        const codes = new Set(e.values.map((v) => v.code));
        const arr = opts?.each ? (Array.isArray(value) ? value : [value]) : [value];
        return arr.every((v) => v == null || codes.has(v as string));
      },
      defaultMessage: () => `${key}: giá trị không thuộc danh mục`,
    },
  }, { each: opts?.each });
}
```
Controller: `@Get(':key/options')` → `catalogService.options(key)`.
- [ ] **Step 4:** PASS. `tsc`. Đăng ký CatalogModule vào AppModule.
- [ ] **Step 5:** commit `feat(catalog): @IsCatalogValue + GET /catalog/:key/options`.

### Task 4: FE generator + catalog.generated (FE)
**Files:**
- Modify: `backend/scripts/generate-shared-enums.cjs` (thêm sinh catalog legal) HOẶC Create `backend/scripts/generate-catalog.cjs`
- Create: `frontend/src/shared/catalog/catalog.generated.ts` (output)
- Test: `frontend/src/shared/catalog/__tests__/catalog.generated.test.ts`

- [ ] **Step 1 (RED):** test generated chứa legal entry:
```ts
import { CATALOG_LEGAL } from '../catalog.generated';
it('LY_DO_KHONG_KHOI_TO có 7 option {code,label}', () => {
  expect(CATALOG_LEGAL.LY_DO_KHONG_KHOI_TO).toHaveLength(7);
  expect(CATALOG_LEGAL.LY_DO_KHONG_KHOI_TO[0]).toHaveProperty('label');
});
```
- [ ] **Step 2:** `cd frontend && rtk proxy npx vitest run catalog.generated` → FAIL.
- [ ] **Step 3 (GREEN):** generator đọc registry → sinh `export const CATALOG_LEGAL = { LY_DO_KHONG_KHOI_TO: [{code,label}...], ... } as const;` + danh sách `CATALOG_DYNAMIC_KEYS`. Chạy `npm run gen:catalog`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(catalog): generator + catalog.generated FE`.

### Task 5: useCatalog hook + CatalogSelect component (FE)
**Files:**
- Create: `frontend/src/hooks/useCatalog.ts`, `frontend/src/components/CatalogSelect.tsx`
- Test: `frontend/src/components/__tests__/CatalogSelect.test.tsx`

**Produces:** `useCatalog(key)` → `{ options, isLoading }`; `<CatalogSelect catalogKey value onChange multi? parentValue?>`.

- [ ] **Step 1 (RED):** test render options legal + multi checkbox:
```ts
it('render 7 option legal', async () => {
  render(<CatalogSelect catalogKey="LY_DO_KHONG_KHOI_TO" value={[]} onChange={()=>{}} multi />);
  expect(await screen.findByText('Hết thời hiệu truy cứu TNHS')).toBeInTheDocument();
});
it('toggle multi gọi onChange với mảng', async () => {
  const on = vi.fn();
  render(<CatalogSelect catalogKey="LY_DO_KHONG_KHOI_TO" value={[]} onChange={on} multi />);
  fireEvent.click(screen.getByTestId('cat-HET_THOI_HIEU'));
  expect(on).toHaveBeenCalledWith(['HET_THOI_HIEU']);
});
```
- [ ] **Step 2:** FAIL.
- [ ] **Step 3 (GREEN):** `useCatalog`: legal → `CATALOG_LEGAL[key]` inline; dynamic → React Query `GET /catalog/:key/options` (cache 10'). `CatalogSelect`: multi → checkbox group (pattern PR-8); single → `<select>`; `parentValue` lọc theo `cascade.map`. data-testid `cat-{code}`.
- [ ] **Step 4:** PASS. `tsc`.
- [ ] **Step 5:** commit `feat(catalog): useCatalog + CatalogSelect`.

### CHECKPOINT PR-0
`verification-before-completion` (BE jest full + tsc; FE vitest + tsc) → `/review` → `/codex`(blocked→subagent). PR-0 chỉ THÊM, không đổi field → không regression.

---

## PR-1..N — ROLLOUT TỪNG DANH MỤC (pattern lặp lại)

Mỗi danh mục = 1 PR nhỏ. **2 biến thể:**

### Biến thể A — danh mục LEGAL (giữ Prisma enum). Ví dụ đại diện: `LyDoKhongKhoiTo` (Incident, multi).
1. Thêm/đủ entry trong `catalog.registry.ts` (đã có ở Task 1 cho ví dụ này).
2. BE DTO: thay `@IsArray() @IsEnum(LyDoKhongKhoiTo,{each})` → `@IsCatalogValue('LY_DO_KHONG_KHOI_TO',{each:true})` (cột vẫn enum[], validator phụ trợ). Giữ `@IsEnum` nếu muốn double-guard.
3. FE: thay checkbox-group thủ công (PR-8) → `<CatalogSelect catalogKey="LY_DO_KHONG_KHOI_TO" multi>`. Bỏ `LY_DO_KHONG_KHOI_TO_OPTIONS` cục bộ.
4. Nhãn: dùng `useCatalogLabel`; gỡ entry tương ứng khỏi `status-labels.ts` nếu chỉ là danh mục.
5. Test: DTO validate + FE render/multi round-trip. KHÔNG migration.
Áp dụng tương tự: LyDoTamDinhChiVuAn, LyDoTamDinhChiVuViec, LoaiNguonTin, NguonPhatTin(+cascade), PhuongThucTiepNhan, CapDoToiPham, LoaiDon, KetQuaPhucHoiVuAn/VuViec, CaseProvenance, CaseType, LoaiUyThac.

### Biến thể B — danh mục DYNAMIC (đổi enum→String). Ví dụ đại diện: `DocumentType` (Document.documentType).
1. Entry dynamic `source:'directory:DOCUMENT_TYPE'` (đã có Task 1).
2. **Migration SQL tay** đổi cột: `ALTER TABLE "documents" ALTER COLUMN "documentType" TYPE TEXT USING "documentType"::text;` (single) — kiểm `udt_name` trước (snake_case?). Bỏ enum type nếu không còn dùng (giữ lại an toàn).
3. Schema Prisma: `documentType DocumentType?` → `documentType String?`.
4. Seed Directory: 1 lần `db:seed` thêm rows `Directory(type='DOCUMENT_TYPE', code='VAN_BAN', name='Văn bản', ...)` cho 5 giá trị cũ.
5. BE DTO: `@IsCatalogValue('DOCUMENT_TYPE')` + service `await catalog.isValid(...)` ở create/update (dynamic check DB). Giá trị lưu = `code`.
6. FE: `<CatalogSelect catalogKey="DOCUMENT_TYPE">` (single). payload/merge giữ string code.
7. Test: round-trip + admin thêm row Directory → option mới xuất hiện (e2e/integration).
Áp dụng tương tự: TienDoKhacPhuc + danh mục mở tương lai; field đang dùng FKSelect `directoryType` gom vào catalog.

### Cascading (NguonPhatTin theo LoaiNguonTin)
- Chuyển `NGUON_PHAT_TIN_BY_LOAI` vào `cascade.map` của entry `NGUON_PHAT_TIN`.
- Validator `@IsCatalogCascadeMatch('loaiDonVu')` (mở rộng từ `@IsCatalogValue`) thay `@IsNguonPhatTinMatchLoaiDonVu`.
- FE: `<CatalogSelect catalogKey="NGUON_PHAT_TIN" parentValue={formData.loaiDonVu}>` tự lọc.
- Gỡ `nguon-phat-tin-match.validator.ts` + mirror `status-labels` sau khi xong.

### Mỗi PR rollout: TDD + /review per checkpoint, cuối nhóm /uat, cuối /expert. `command git commit`.

## Self-review (đã làm)
- Spec coverage: registry + service + validator + controller + generator + hook + component (PR-0); rollout legal/dynamic + cascading (PR-1..N) — đủ mục A-E của spec. ✓
- Type nhất quán: `CatalogEntry`/`CatalogValue`/`getCatalogEntry`/`options`/`isValid`/`labelOf`/`CATALOG_LEGAL`/`useCatalog`/`CatalogSelect` xuyên suốt. ✓
- No placeholder: code thật mỗi step PR-0; rollout mô tả pattern + 2 ví dụ đại diện có code migration thật. ✓
- Scope: chỉ danh mục, không status/workflow. ✓
