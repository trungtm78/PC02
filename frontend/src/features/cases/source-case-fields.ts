import type { PublishedCaseFieldSchema } from "./CaseCustomFields";
export interface SourceCaseFieldState {
  schema: PublishedCaseFieldSchema | null;
  loading: boolean;
  error: string;
}
export function sourceCaseFieldErrors(
  state: SourceCaseFieldState,
  values: Record<string, unknown>,
): string[] {
  if (state.loading || state.error)
    return [state.error || "Đang xác minh thông tin bắt buộc của vụ án."];
  const errors: string[] = [];
  for (const field of state.schema?.definition.fields ?? []) {
    const value = values[field.key];
    if (field.required && (value == null || value === ""))
      errors.push(`${field.label} là bắt buộc`);
    if (value == null || value === "") continue;
    if (
      (field.type === "boolean" && typeof value !== "boolean") ||
      (field.type === "number" &&
        (typeof value !== "number" || !Number.isFinite(value))) ||
      (field.type === "date" &&
        (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))) ||
      (field.type === "select" && !field.options?.includes(String(value)))
    )
      errors.push(`${field.label} chưa đúng kiểu dữ liệu`);
  }
  return errors;
}
