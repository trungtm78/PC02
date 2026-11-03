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
- **Text resolved through another table** (`tuBang`, e.g. crime id -> crime name): looked up by the trigger at write time. A rename in the target table does not propagate until the shadow is reloaded; acceptable for the static `crimes` table, documented on the type.
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
