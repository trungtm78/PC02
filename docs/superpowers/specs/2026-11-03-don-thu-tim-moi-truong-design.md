# Petition list: search every field that holds real data

Date: 2026-11-03. Status: approved by the user (plan approved, scope widened to "audit everything and add what is missing").

## Problem

The "Tìm trong mọi cột — gõ rồi chọn cột (phím /)" box on the Petition list (Danh sách đơn thư) cannot search
"Số phiếu chuyển/ Công văn/ Ủy thác điều tra" or "Nhận xét". Auditing the form found the gap is wider: the form has
130 fields (`backend/src/petitions/khai-truong-form-don-thu.generated.ts`) and only 12 are searchable.

| Group | Fields |
|---|---|
| Form fields | 130 |
| Already searchable | 12 |
| Empty on production (0 / 47,626 petitions; `cot-xuat-day-du.loai-tru.ts`, re-measured on every deploy) | 88 |
| **Holds data but not searchable -> add** | **30** |

## Decisions (user-approved)

1. Add every field that holds real data, including fields stored in `metadata` JSON. Empty fields stay out, with the reason recorded.
2. The tag suggestion list also offers HIDDEN columns, grouped under "Hidden columns"; choosing one switches the column on.

## Field mapping pitfall

The form's "Nhận xét" (legacy field `nhanXet`) is translated by `doiTab` to **`petitions.nhanThay`**. Declaring the tag against
`nhanXet` (a `cases` column) would match 0 rows without any error. Tag key stays `nhanXet` (the cross-entity name), column is `nhanThay`.

## Delivery in three PRs

| PR | Scope | Behaviour change |
|---|---|---|
| PR1 (this one) | Generator + condition builder: kind `so`, JSON-backed fields (`nguonJson`) | none - no declaration changes, generated migration is byte-identical |
| PR2 | Declare the 30 fields, generated migration, list API `select`, completeness gate, PostgreSQL tests, timing measurements | search works end to end |
| PR3 | UI: 30 hidden columns, "Hidden columns" suggestion group that enables the column, select values | UI |

## PR1 design

### Kind `so` (number, equality)

- `docSo(value, integerOnly)` reads Vietnamese numbers: `.` groups thousands (`1.500.000`), `,` is the decimal mark (`1,5`).
  A dot that cannot be a thousands group (`1.5`) is a decimal point. Anything else is invalid.
- Invalid input is a **400** (`docThe`), never a Prisma 500. `soNguyen: true` (Prisma `Int`) additionally rejects decimals and values beyond Int32.
- The tag compares **equal** on the column. No shadow column, no index.
- The "all columns" box deliberately does not reach number fields: typing `5` must not return every record with 5 victims.

### `nguonJson` (field stored inside a JSON column)

```ts
{ key, nhan, kieu: 'chu' | 'ngay', cot: '<virtual name>', nguonJson: { cot: 'metadata', khoa: '<key>', tuBang?: { bang, cot } } }
```

- `cot` is a VIRTUAL name: it names the shadow column `<cot>_bd` and is not in `schema.prisma`.
- **Text**: shadow = `' ' || f_bo_dau(NEW."metadata"->>'<key>')`, trigram index, part of the combined "all columns" shadow.
- **Text resolved through another table** (`tuBang`, e.g. crime id -> crime name): looked up by the trigger at write time, and kept fresh by an AFTER UPDATE trigger on the target table (`pc02_lan_toa_petitions_crimes`, only when the name really changes) that re-assigns the JSON column of the dependent rows so the search trigger recomputes them. Found by a second Codex review (model gpt-6-astra): a seed correcting a crime's spelling used to leave the copied name stale. Pinned by the PostgreSQL spec; each rename scans the dependent table once, so use `tuBang` only for near-static tables.
- **Date**: shadow = the ISO `yyyy-mm-dd` prefix of the JSON value, or NULL when the value is not ISO. The tag compares a `[gte, lt)` string range for the Vietnam calendar day / month / year. No trigram index (range, not substring). NULL is a legitimate value, so these columns are excluded from the "not yet loaded" check.
- The source JSON column is added to the trigger's `UPDATE OF` list, so editing only `metadata` refreshes the shadows.
- **No source-column fallback**: the real-column fallback of the "all columns" box never references a virtual column. A row whose shadow is not loaded simply does not match JSON fields; the migration backfills every row, and the emergency switch-off documents the same limitation.
- Input that strips to nothing (only combining/invisible characters) still produces a condition on the shadow, never "no condition".

### Guards

- The generator rejects: `nguonJson` on kinds other than `chu`/`ngay`, combined with `cotGhep`/`cotEdtf`, `tuBang` on a date, `soNguyen` on a non-`so` kind, and any non-identifier JSON key / lookup table (blocks SQL injection through the declaration).
- `cotDbLech` only requires the JSON column to exist for a JSON-backed field; `kieuCotLech` requires `Float`/`Int` for `so` (and `Int` for `soNguyen`).

## Verification

- `nguon-json-va-so.spec.ts`: 31 cases covering SQL generation, backfill statements, Prisma field requirements, frontend union, declaration guards, schema-drift gates, number parsing and condition building.
- Patch coverage 189/189 lines; backend `tsc`, frontend `tsc -b`, 945 related backend tests green.
- The regenerated migration output for the current declarations is byte-identical, so deploying PR1 changes no database behaviour.

## PR2+PR3 (merged into one PR) - what was built, and what the measurements changed

PR2 (backend) and PR3 (UI) could not ship separately: the frontend gate `timKiemCotKhai` requires a list column for every declared tag key, and `khaiCotXuat` requires an export column with the same key as every list column (it reads `backend/src/petitions/xuat-danh-sach-don-thu.ts`). Declaring 30 tags without the 30 columns turns `main` red.

### Built
- 30 tags in `khai/don-thu.khai.ts` (21 shadow columns, three of them read from `metadata` JSON), migration `20261103125717_tim_kiem_don_thu_moi_truong`, read-only shadow fields in `schema.prisma`.
- List API: the new columns; the three prosecution values are lifted out of `metadata` onto the row and `metadata` is dropped from the response; the crime NAME is resolved with one lookup per page (the form stores an id).
- 30 export columns, 30 hidden list columns, select values for "Hướng xử lý" and "Tội phạm công nghệ cao".
- Choosing the tag of a hidden column also switches that column on (`OTimKiemThe.onChonTruongAn`); the existing "Cột khác" suggestion group already offered hidden fields.
- Number tags are validated in the UI with the same rule as the server, so an unreadable number is never offered (it would be a 400).

### Measured on a copy of real data (47,271 petitions, PG18 local) - three decisions
1. **No row rewrite inside the migration.** With the declaration's `refreshExisting`, the migration UPDATE of all petitions took 312 s (one statement; index creation was negligible, moving it changed 467 s -> 408 s) and held row locks through the deploy. The project norm is the opposite (see `nap-cot-bong-tim-kiem.ts`): the migration creates columns, triggers and indexes; existing rows are loaded in batches by `nap-cot-bong-tim-kiem --that`; `deploy.sh` step 9e detects unloaded rows and ends red until that is run. `refreshExisting` was removed for petitions. Until the loader has run, the NEW tags do not find old rows at all: right after the migration the new shadow columns are NULL but the combined `tim_kiem_bd` still holds its old value, and the server only falls back to the source columns while some row has `tim_kiem_bd IS NULL`. The plain "all columns" line and every existing tag are unaffected (they keep using the old shadows). This is pinned by the PostgreSQL spec so nobody assumes the fallback covers it.
2. **Long free text is tag-only.** Putting every new field into the combined `tim_kiem_bd` shadow made common terms 2-5x slower on identical data (narrow-table comparison: "nguyen van" 84 -> 438 ms, "cong an" 51 -> 207 ms) and doubled its index. Keeping only the short fields in it stayed within about 10% of the old latency for most terms. Nhận xét, Đề xuất, Ghi chú trùng đơn, Báo cáo Ban Giám đốc, Ghi chú khác, Phương thức thủ đoạn and Căn cứ tạm đình chỉ are searchable through their own tags (`vaoTatCa: false`), not from the plain "all columns" line.
3. **`metadata` stays out of the list payload** (1.6 KB average per row, mostly legacy text).

### Cost, for the record
- Table 470 MB -> ~663 MB, indexes 74 -> ~229 MB. A single-row write fires the trigger in ~7 ms (was ~1.8 ms).
- Final migration on the copy: 86 s (almost all of it the refresh of Vụ việc / Vụ án rows that this copy never loaded; those tables are already loaded on production). Batch loader for all stale tables: 575 s, in 1,000-row statements.

### Known limits
- Tags of numeric fields are equality only and are never reachable from the "all columns" line.
- ALL the new tags need the batch loader to have run before old petitions are found by them (see decision 1).
- `loc-theo-the.ts` (screens that filter in the browser) has no `so` branch: no such screen carries a number tag today.
