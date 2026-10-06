import { expect, it } from "vitest";
import { ownedColumnsFor } from "@/features/legacy-form/registry";
import { LEGACY_FORM_OWNED_COLUMNS } from "@/features/cases/legacy-form-layout.def";
it("A01: canonical Case ownership includes native proposal alias so stale parity cannot overwrite it", () => {
  expect(LEGACY_FORM_OWNED_COLUMNS.has("deXuat")).toBe(true);
  expect(ownedColumnsFor("case")).toBe(LEGACY_FORM_OWNED_COLUMNS);
});
