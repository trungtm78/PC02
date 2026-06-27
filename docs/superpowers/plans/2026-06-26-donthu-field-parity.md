# PR-1 Đơn thư Field-Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) — implement task-by-task, RED→GREEN→REFACTOR.

**Goal:** Bổ sung 5 field thiếu + sửa 3 nhãn + phân nhóm 6 section cho form Đơn thư (Petition) để parity với tab "Thông tin" form cũ /doi-1/Them.

**Architecture:** Petition là 1 table. 2 field (`nguonDon`, `petitionDate`) đã có schema+DTO+builder, chỉ thiếu input form. 3 field mới (`ngayDeXuat`, `phanLoaiNguonTin`, `dieuTraVien`) cần thêm cột nullable → DTO → builder(create+update) → frontend types/payload/merge → input. Dùng lại pattern builder gom 1 chỗ ([buildPetitionCreateData](backend/src/petitions/petition-data.builder.ts)).

**Tech Stack:** NestJS + Prisma (PG18 @5433) + React/Vite. Test: jest (BE) + vitest (FE). Chạy qua `rtk proxy`.

## Global Constraints
- Migrate dev BỊ CHẶN (shadow DB P3014) → viết migration.sql TAY + `npx prisma migrate deploy`. KHÔNG `migrate dev`.
- Backend test: `cd backend && rtk proxy npx jest <name> --no-coverage`. Frontend: `cd frontend && rtk proxy npx vitest run <name>`.
- Enum/label dùng constants, không hardcode literal. Field mới nullable (parity, không phá data cũ).
- Sau mỗi task green + `npx tsc --noEmit` → commit Conventional Commits (KHÔNG push).

---

### Task 1: Prisma schema + migration — 3 cột mới

**Files:**
- Modify: `backend/prisma/schema.prisma` (model Petition, sau dòng 918 `ketQuaXuLyKhac`)
- Create: `backend/prisma/migrations/20260626000001_petition_donthu_parity/migration.sql`

- [ ] **Step 1:** Thêm 3 cột vào model Petition (sau `ketQuaXuLyKhac String?`):
```prisma
  ngayDeXuat        DateTime? // Ngày đề xuất (old: ngay_de_xuat) — khác receivedDate/petitionDate
  phanLoaiNguonTin  String?   // Phân loại nguồn tin ban đầu (old: phan_loai_nguon_tin_ban_dau — discriminator)
  dieuTraVien       String?   // Điều tra viên thụ lý (old: dieu_tra_vien — free text, pattern như lanhDaoToTung)
```

- [ ] **Step 2:** Viết migration.sql TAY:
```sql
ALTER TABLE "petitions" ADD COLUMN "ngayDeXuat" TIMESTAMP(3);
ALTER TABLE "petitions" ADD COLUMN "phanLoaiNguonTin" TEXT;
ALTER TABLE "petitions" ADD COLUMN "dieuTraVien" TEXT;
```

- [ ] **Step 3:** Apply: `cd backend && npx prisma migrate deploy && npx prisma generate`
Expected: "1 migration applied" + generate OK.

- [ ] **Step 4:** Commit: `git add backend/prisma && git commit -m "feat(petitions): +3 cột parity Đơn thư (ngayDeXuat/phanLoaiNguonTin/dieuTraVien)"`

---

### Task 2: DTO — 3 prop mới (TDD)

**Files:**
- Modify: `backend/src/petitions/dto/create-petition.dto.ts` (cạnh `ketQuaXuLyKhac`)
- Test: `backend/src/petitions/dto/create-petition.dto.spec.ts` (tạo nếu chưa có, hoặc thêm vào spec hiện hữu)

**Interfaces:**
- Produces: `CreatePetitionDto.ngayDeXuat?: string`, `.phanLoaiNguonTin?: string`, `.dieuTraVien?: string`.

- [ ] **Step 1 (RED):** Thêm test validate — 3 field optional, string/date hợp lệ pass, sai type fail:
```ts
it('chấp nhận ngayDeXuat/phanLoaiNguonTin/dieuTraVien hợp lệ', async () => {
  const dto = plainToInstance(CreatePetitionDto, {
    receivedDate: '2026-06-26', petitionType: 'TO_CAO', senderIsAnonymous: true,
    ngayDeXuat: '2026-06-20', phanLoaiNguonTin: 'don-cong-van-ban-dau', dieuTraVien: 'Nguyễn Văn A',
  });
  expect((await validate(dto)).length).toBe(0);
});
```

- [ ] **Step 2:** Run: `cd backend && rtk proxy npx jest create-petition.dto --no-coverage` → FAIL (prop chưa có / không validate).

- [ ] **Step 3 (GREEN):** Thêm vào DTO:
```ts
  @IsOptional()
  @IsDateString()
  ngayDeXuat?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  phanLoaiNguonTin?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  dieuTraVien?: string;
```

- [ ] **Step 4:** Run lại → PASS. `npx tsc --noEmit`.
- [ ] **Step 5:** Commit: `git commit -am "feat(petitions): DTO 3 field parity Đơn thư"`

---

### Task 3: Builder create + update — persist 3 field (TDD)

**Files:**
- Modify: `backend/src/petitions/petition-data.builder.ts` (sau dòng 83 `ketQuaXuLyKhac`)
- Modify: `backend/src/petitions/petitions.service.ts` (nhánh UPDATE — tìm block ghi `ketQuaXuLyKhac`/`thoiHanUTDT` ~dòng 600-620, thêm 3 field)
- Test: `backend/src/petitions/petition-data.builder.spec.ts`

- [ ] **Step 1 (RED):** Thêm test builder map 3 field:
```ts
it('persist ngayDeXuat/phanLoaiNguonTin/dieuTraVien khi create', () => {
  const data = buildPetitionCreateData(
    { receivedDate: '2026-06-26', ngayDeXuat: '2026-06-20', phanLoaiNguonTin: 'don-cong-van-ban-dau', dieuTraVien: 'Nguyễn Văn A' } as any,
    { stt: 'DT-2026-00001', actorId: 'u1' },
  );
  expect(data.dieuTraVien).toBe('Nguyễn Văn A');
  expect(data.phanLoaiNguonTin).toBe('don-cong-van-ban-dau');
  expect(data.ngayDeXuat).toEqual(new Date('2026-06-20'));
});
```

- [ ] **Step 2:** Run: `rtk proxy npx jest petition-data.builder --no-coverage` → FAIL.

- [ ] **Step 3 (GREEN):** Thêm vào builder (sau `ketQuaXuLyKhac: dto.ketQuaXuLyKhac,`):
```ts
    ngayDeXuat: toDate(dto.ngayDeXuat),
    phanLoaiNguonTin: dto.phanLoaiNguonTin,
    dieuTraVien: dto.dieuTraVien,
```
Và thêm 3 field tương ứng vào block UPDATE trong petitions.service.ts (cùng nơi ghi ketQuaXuLyKhac/thoiHanUTDT).

- [ ] **Step 4:** Run lại → PASS. `npx tsc --noEmit`. Chạy full petitions suite: `rtk proxy npx jest petitions --no-coverage`.
- [ ] **Step 5:** Commit: `git commit -am "feat(petitions): builder create+update persist 3 field parity"`

---

### Task 4: Frontend types + payload + merge (TDD)

**Files:**
- Modify: `frontend/src/pages/petitions/PetitionFormPage.tsx` (interface FormData ~dòng 40-90, buildCreatePetitionPayload, mergePetitionApiToFormData)
- Test: `frontend/src/pages/petitions/__tests__/PetitionFormPage.payload.test.tsx`

- [ ] **Step 1 (RED):** Thêm test round-trip 5 field (nguonDon, petitionDate, ngayDeXuat, phanLoaiNguonTin, dieuTraVien) qua payload + merge.
- [ ] **Step 2:** Run: `cd frontend && rtk proxy npx vitest run PetitionFormPage.payload` → FAIL.
- [ ] **Step 3 (GREEN):** Thêm 5 key vào FormData interface + initial state + buildCreatePetitionPayload (gửi đi) + mergePetitionApiToFormData (đọc lại, dùng `toDateInput` cho ngày).
- [ ] **Step 4:** Run lại → PASS. `npx tsc --noEmit`.
- [ ] **Step 5:** Commit: `git commit -am "feat(petitions): FE types+payload+merge 5 field parity Đơn thư"`

---

### Task 5: Form UI — render 5 input + sửa 3 nhãn + phân nhóm 6 section

**Files:**
- Modify: `frontend/src/pages/petitions/PetitionFormPage.tsx` (JSX form ~dòng 437-910)
- Test: `frontend/src/pages/petitions/__tests__/PetitionFormPage.test.tsx`

- [ ] **Step 1 (RED):** Thêm test render: `getByTestId('field-nguonDon')`, `field-petitionDate`, `field-ngayDeXuat`, `field-phanLoaiNguonTin`, `field-dieuTraVien` visible; nhãn "Ghi chú trùng đơn" tồn tại.
- [ ] **Step 2:** Run: `cd frontend && rtk proxy npx vitest run PetitionFormPage.test` → FAIL.
- [ ] **Step 3 (GREEN):**
  - Thêm 5 input (data-testid `field-*`) vào đúng section: `nguonDon`+`phanLoaiNguonTin`+`ngayDeXuat` → section "Tiếp nhận & phân loại nguồn tin"; `petitionDate` → cạnh ngày; `dieuTraVien` → section "Phân công & xử lý".
  - Sửa nhãn: `raSoatTrung` "Kết quả rà soát đơn/vụ trùng" → **"Ghi chú trùng đơn"**; xác nhận "Đơn vị tiếp nhận"/"Ghi chú thêm" giữ hay đổi theo nghiệp vụ.
  - Tổ chức lại thành 6 section card (Tiếp nhận & phân loại · Người gửi · Nội dung & tội danh · Nghi vấn ĐT · Phân công & xử lý · Phiếu đề xuất) — chỉ di chuyển/đặt lại heading card, KHÔNG đổi style.
- [ ] **Step 4:** Run lại → PASS. `npx tsc --noEmit`. Full FE petitions: `rtk proxy npx vitest run petitions`.
- [ ] **Step 5:** Commit: `git commit -am "feat(petitions): form render 5 field + nhãn 'Ghi chú trùng đơn' + phân nhóm 6 section"`

---

## CHECKPOINT PR-1 (sau Task 5)
1. **verification-before-completion**: `cd backend && rtk proxy npx jest --no-coverage` + `npx tsc --noEmit`; `cd frontend && rtk proxy npx vitest run` + `npx tsc --noEmit` — TẤT CẢ xanh, dán output thật.
2. **/review** (diff review nội bộ).
3. **/codex** (sau /review). Account chặn codex → fallback Claude subagent general-purpose review độc lập.
4. Sửa finding tận gốc (systematic-debugging), không vá tạm. Re-verify.

## Self-review (đã làm)
- Spec coverage: 5 field thiếu + 3 nhãn + 6 section đều có task. ✓
- Type consistency: tên field nhất quán schema↔DTO↔builder↔FE (`ngayDeXuat`/`phanLoaiNguonTin`/`dieuTraVien`). ✓
- No placeholder: code thật mỗi step. ✓
