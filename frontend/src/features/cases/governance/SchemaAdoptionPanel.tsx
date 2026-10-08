import { useState } from "react";
import { useCaseFieldSchema } from "../useCaseFieldSchema";
import {
  CaseCustomFields,
  type PublishedCaseFieldSchema,
} from "../CaseCustomFields";
import {
  Panel,
  Lookup,
  Button,
  Status,
  useLookup,
  useCommand,
  CommandFeedback,
  can,
  versions,
  type WorkspaceData,
} from "./shared";
export function SchemaAdoptionPanel({
  caseId,
  data,
  refresh,
}: {
  caseId: string;
  data: WorkspaceData;
  refresh: () => Promise<void>;
}) {
  const [generation, setGeneration] = useState(0);
  const pinned = useCaseFieldSchema(caseId, generation);
  const definitions = useLookup(
    data.capabilities.caseAccessMode === "INTERNAL"
      ? "/cases/governance/field-definitions"
      : null,
  );
  const [versionId, setVersionId] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const selected = definitions.rows.find(
    (row) => row.id === versionId && row.status === "PUBLISHED",
  );
  const command = useCommand(async () => {
    await refresh();
    setGeneration((value) => value + 1);
  });
  const schema: PublishedCaseFieldSchema | null = selected
    ? {
        id: selected.id,
        revision: selected.revision!,
        status: "PUBLISHED",
        definition:
          selected.definition as PublishedCaseFieldSchema["definition"],
        values,
      }
    : null;
  return (
    <div className="space-y-5">
      <CommandFeedback command={command} />
      <Panel title="Phiên bản thông tin đang áp dụng">
        <p className="text-sm">
          Hồ sơ giữ phiên bản đã ghim; công bố cấu hình mới không tự đổi các hồ
          sơ cũ.
        </p>
        {pinned.loading ? (
          <p role="status">Đang tải phiên bản đã ghim…</p>
        ) : pinned.error ? (
          <p role="alert">{pinned.error}</p>
        ) : pinned.schema ? (
          <>
            <p>
              <Status value={pinned.schema.status} /> · Phiên bản{" "}
              {pinned.schema.revision} · Mã {pinned.schema.id}
            </p>
            <CaseCustomFields
              schema={pinned.schema}
              values={pinned.schema.values}
              readOnly
            />
          </>
        ) : (
          <p className="text-sm">
            Hồ sơ hệ cũ chưa ghim phiên bản trường. Giá trị và nguồn gốc cũ vẫn
            được giữ.
          </p>
        )}
      </Panel>
      {data.capabilities.caseAccessMode === "INTERNAL" && (
        <Panel title="Áp dụng phiên bản đã công bố có chủ đích">
          {definitions.error && <p role="alert">{definitions.error}</p>}
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (schema)
                void command.run(`/cases/${caseId}/governance/field-schema`, {
                  ...versions(data),
                  fieldDefinitionVersionId: schema.id,
                  values,
                });
            }}
          >
            <Lookup
              label="Phiên bản trường đã công bố"
              rows={definitions.rows
                .filter((row) => row.status === "PUBLISHED")
                .map((row) => ({
                  ...row,
                  name: `${row.code} · phiên bản ${row.revision}`,
                }))}
              disabled={definitions.loading || !!pinned.error}
              value={versionId}
              onChange={(id) => {
                setVersionId(id);
                setValues({ ...(pinned.schema?.values ?? {}) });
              }}
            />
            {schema && (
              <CaseCustomFields
                schema={schema}
                values={values}
                onChange={setValues}
              />
            )}
            <p className="text-sm text-amber-800">
              Kiểm tra các trường bắt buộc và mức hạn chế trước khi áp dụng.
              Lịch sử phiên bản cũ được giữ lại.
            </p>
            <Button
              type="submit"
              disabled={
                command.busy ||
                !schema ||
                !can(data, "operate") ||
                !!pinned.error ||
                pinned.loading
              }
            >
              Áp dụng phiên bản thông tin đã chọn
            </Button>
          </form>
        </Panel>
      )}
    </div>
  );
}
