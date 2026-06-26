# Catalog Registry — Enum danh mục động & dễ mở rộng

## Context
Dự án có ~26 Prisma enum hardcode. Mỗi lần thêm/đổi 1 giá trị danh mục phải: sửa `schema.prisma` → migration → `gen:enums`
→ sửa `status-labels.ts` + `{ENUM}_OPTIONS` rải rác FE → deploy. Đau, chậm, dễ sót. Anh muốn chuyển enum thành "class động,
dễ mở rộng" — thêm giá trị không phải sửa rải rác.

Quyết định đã chốt với anh (brainstorming 2026-06-26):
1. **Chỉ enum DANH MỤC** (nhãn). KHÔNG đụng enum **status/workflow** (CaseStatus, IncidentStatus, PetitionStatus, Subject*,
   Proposal/Guidance/Exchange/Delegation/Conclusion/ReportTdc Status) — chúng gắn chặt `VALID_TRANSITIONS`, terminal filter, guard.
2. **Hybrid**: danh mục "mở" → DB-driven (admin thêm, không deploy); danh mục "pháp lý cố định" → giữ trong code — nhưng
   **gom TẤT CẢ về 1 registry chung** để FE/BE tiêu thụ y hệt.
3. **Cột DB nhóm legal**: khuyến nghị **GIỮ Prisma enum** (an toàn DB, luật hiếm đổi, tránh churn — lý do KKT/TĐC vừa thành
   enum[] ở PR-8). Chỉ nhóm dynamic mới đổi sang String. (Quyết cuối khi anh review spec này.)

## Mục tiêu
- 1 cách dùng duy nhất cho mọi danh mục (FE: 1 hook + 1 component; BE: 1 validator + 1 service).
- Thêm giá trị **dynamic** = admin thêm row DB, hiệu lực ngay, không deploy.
- Thêm giá trị **legal** = sửa 1 dòng registry (+ migration enum nếu giữ Prisma enum — hiếm).
- Gom nhãn + options + cascading + validation về 1 nơi (bỏ rải rác `status-labels`/`{ENUM}_OPTIONS` cho danh mục).
- KHÔNG phá status/workflow, KPI, transition.

## Kiến trúc: "Catalog Registry"

### A. Registry — nguồn sự thật duy nhất
`backend/src/catalog/catalog.registry.ts` (+ sinh bản FE). Mỗi danh mục 1 entry:
```ts
type CatalogEntry =
  | { key: string; kind: 'legal'; multi?: boolean; ref?: string;
      enumName?: string; // tên Prisma enum nếu giữ enum (legal)
      values: { code: string; label: string }[] }
  | { key: string; kind: 'dynamic'; multi?: boolean;
      source: `directory:${string}`; // type trong bảng Directory
      cascade?: { parentKey: string; map: Record<string, string[]> } };
```
Ví dụ:
```ts
LY_DO_KHONG_KHOI_TO: { kind:'legal', multi:true, ref:'Đ.157 BLTTHS', enumName:'LyDoKhongKhoiTo',
  values:[{code:'KHONG_CO_SU_VIEC',label:'Không có sự việc phạm tội'}, ...7] }
DOCUMENT_TYPE: { kind:'dynamic', source:'directory:DOCUMENT_TYPE' }
NGUON_PHAT_TIN: { kind:'legal', enumName:'NguonPhatTin', cascade:{ parentKey:'LOAI_NGUON_TIN', map:{...} }, values:[...] }
```
Registry là **single source**: labels, cascading, multi, ref pháp lý, nguồn — tất cả ở đây.

### B. Backend
- `CatalogService` (`backend/src/catalog/`):
  - `options(key)` → `{code,label}[]` (legal: từ registry; dynamic: query Directory theo `source`, cache 10').
  - `labelOf(key, code)`, `isValid(key, code)`, `cascadeOptions(key, parentCode)`.
- Validator `@IsCatalogValue('KEY', { each?: true })` (`backend/src/common/validators/`): thay `@IsEnum`. Legal → check trong
  registry values; dynamic → check tồn tại Directory(type,code,isActive). Cascading → validator `@IsCatalogCascadeMatch(parentField)`
  thay `@IsNguonPhatTinMatchLoaiDonVu`.
- Cột DB: **dynamic** = `String`/`String[]` lưu `code`. **legal** = giữ Prisma enum (khuyến nghị) → validator vẫn dùng `@IsEnum`
  nhưng options/label lấy từ catalog (đồng nhất FE). Endpoint `GET /catalog/:key/options` (dynamic) cho FE.

### C. Frontend
- Sinh `frontend/src/shared/catalog/catalog.generated.ts` từ registry (thay/ mở rộng `gen:enums`): chứa entry legal (code+label)
  + key dynamic.
- Hook `useCatalog(key)` → options (legal inline; dynamic gọi `GET /catalog/:key/options`, React Query cache). `useCatalogLabel(key,code)`.
- Component `<CatalogSelect catalogKey multi?>` (+ cascading qua prop `parentValue`) thay FKSelect/FormSelect/checkbox-group rải rác
  cho danh mục. Badge/nhãn status GIỮ `status-labels.ts` (vì status không nằm trong scope).

### D. Phân loại (đề xuất — anh chỉnh ở review)
- **Legal (giữ enum, vào registry):** LyDoKhongKhoiTo, LyDoTamDinhChiVuAn, LyDoTamDinhChiVuViec, LoaiNguonTin, NguonPhatTin,
  PhuongThucTiepNhan, CapDoToiPham, LoaiDon, KetQuaPhucHoiVuAn, KetQuaPhucHoiVuViec, CaseProvenance, CaseType, LoaiUyThac.
- **Dynamic (DB, đổi String):** DocumentType, TienDoKhacPhuc, + danh mục "mở" tương lai (nghề nghiệp, đơn vị, nơi cấp CCCD, loại vật chứng…).
  Các field đang dùng FKSelect `directoryType`/`masterClassType` sẵn — gom vào catalog cho nhất quán.

### E. Migration & rollout (TỪNG danh mục = 1 PR nhỏ, an toàn)
1. PR-0 hạ tầng: registry + CatalogService + `@IsCatalogValue` + `useCatalog`/`<CatalogSelect>` + generator, KHÔNG đổi field nào (chỉ thêm).
2. Mỗi danh mục legal: thay validator/options/label sang catalog (cột enum giữ nguyên) + thay component FE + test. Không migration.
3. Mỗi danh mục dynamic: migration enum→String (USING giữ data, mảng nếu multi) + seed Directory + validator + component + test.
4. Cascading LoaiNguonTin→NguonPhatTin: chuyển map vào registry, dùng `@IsCatalogCascadeMatch`, bỏ validator cũ.
Mỗi PR: TDD round-trip, `command git commit` (rtk hỏng ref — xem [[reference_rtk_git_commit_corruption]]), migrate SQL tay + `prisma migrate deploy` (DB 5432).

## Phạm vi loại trừ (YAGNI)
- KHÔNG đụng status/workflow enum + transition/terminal/KPI logic.
- KHÔNG xây workflow engine cấu hình DB (giai đoạn sau nếu cần).
- Admin CRUD UI cho Directory: tái dùng nếu đã có; nếu chưa, là PR riêng cuối (không chặn).

## Verification
- BE: `cd backend && rtk proxy npx jest` (CatalogService unit + validator + DTO round-trip + cascading) + `tsc`.
- FE: `vitest` (useCatalog + CatalogSelect render/multi/cascade + payload round-trip).
- E2E: form chọn danh mục (legal + dynamic) → lưu → đọc lại; admin thêm 1 giá trị dynamic → xuất hiện trên form không deploy.
- Đối chiếu: mỗi danh mục sau migrate, giá trị cũ vẫn hiển thị + lưu đúng.
