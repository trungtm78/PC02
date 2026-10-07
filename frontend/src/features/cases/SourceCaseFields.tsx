import { useEffect } from "react";
import { CaseCustomFields } from "./CaseCustomFields";
import { useCaseFieldSchema } from "./useCaseFieldSchema";
import type { SourceCaseFieldState } from "./source-case-fields";
export function SourceCaseFields({
  values,
  onChange,
  onState,
}: {
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onState: (state: SourceCaseFieldState) => void;
}) {
  const schema = useCaseFieldSchema();
  useEffect(() => {
    onState({
      schema: schema.schema,
      error: schema.error,
      loading: schema.loading,
    });
  }, [schema.schema, schema.error, schema.loading, onState]);
  return (
    <section data-testid="source-case-fields" aria-busy={schema.loading}>
      {schema.loading && (
        <p role="status">Đang tải thông tin bổ sung bắt buộc của vụ án…</p>
      )}
      {schema.error && <p role="alert">{schema.error}</p>}
      {schema.schema && (
        <CaseCustomFields
          schema={schema.schema}
          values={values}
          onChange={onChange}
        />
      )}
    </section>
  );
}
