import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import {
  RuleEditor,
  FieldDefinitionEditor,
  type RuleAction,
} from "./ConfigurationEditors";
import type { PublishedCaseFieldSchema } from "../CaseCustomFields";
import {
  Panel,
  Field,
  Lookup,
  Button,
  Status,
  useCommand,
  CommandFeedback,
  emptyWorkspace,
  can,
  type Capabilities,
  type Row,
  type ActionCatalog,
  type PolicyCatalogEntry,
  stripRuntimeFlags,
} from "./shared";

export default function CaseConfigurationPage() {
  const [kind, setKind] = useState<"rules" | "field-definitions">("rules");
  const [caps, setCaps] = useState<Capabilities>({});
  const [rows, setRows] = useState<{
    rules: Row[];
    "field-definitions": Row[];
  }>({ rules: [], "field-definitions": [] });
  const [catalog, setCatalog] = useState<ActionCatalog[]>([]);
  const [policyCatalog, setPolicyCatalog] = useState<PolicyCatalogEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [code, setCode] = useState("default");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [actions, setActions] = useState<RuleAction[]>([]);
  const [definition, setDefinition] = useState<
    PublishedCaseFieldSchema["definition"]
  >({ fields: [] });
  const refresh = useCallback(async () => {
    try {
      const permissions = await api.get<{ data: Capabilities }>(
        "/cases/governance/capabilities",
      );
      setCaps(permissions.data.data);
      if (permissions.data.data.caseAccessMode !== "INTERNAL") {
        setLoading(false);
        return;
      }
      const [rules, fields, catalogResult] = await Promise.all([
        api.get<{ data: Row[] }>("/cases/governance/rules"),
        api.get<{ data: Row[] }>("/cases/governance/field-definitions"),
        api.get<{
          data: {
            actions: ActionCatalog[];
            additionalActions: (string | ActionCatalog)[];
            fieldPolicyCatalog?: PolicyCatalogEntry[];
          };
        }>("/cases/governance/catalog"),
      ]);
      setRows({
        rules: rules.data.data,
        "field-definitions": fields.data.data,
      });
      setCatalog([
        ...catalogResult.data.data.actions,
        ...catalogResult.data.data.additionalActions.map((action) =>
          typeof action === "string" ? { code: action } : action,
        ),
      ]);
      setPolicyCatalog(catalogResult.data.data.fieldPolicyCatalog ?? []);
      setError("");
    } catch (cause) {
      setError(extractApiError(cause).message);
    }
    setLoading(false);
  }, []);
  const command = useCommand(refresh);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  const row = rows[kind].find((row) => row.id === selected);
  const locked = row?.status === "PUBLISHED" || row?.status === "SUPERSEDED";
  const workspace = { ...emptyWorkspace, capabilities: caps };
  const choose = (id: string) => {
    setSelected(id);
    const item = rows[kind].find((row) => row.id === id);
    setCode(String(item?.code ?? "default"));
    setEffectiveFrom(String(item?.effectiveFrom ?? "").slice(0, 10));
    setEffectiveTo(String(item?.effectiveTo ?? "").slice(0, 10));
    setActions((item?.definition as { actions?: RuleAction[] })?.actions ?? []);
    setDefinition(
      (item?.definition as PublishedCaseFieldSchema["definition"]) ?? {
        fields: [],
      },
    );
  };
  const save = async () => {
    const fieldDefinition = {
      ...definition,
      fields: definition.fields.map(stripRuntimeFlags),
      ...(definition.fieldPolicies && {
        fieldPolicies: definition.fieldPolicies.map(stripRuntimeFlags),
      }),
    };
    const body = {
      definition: kind === "rules" ? { actions } : fieldDefinition,
      ...(kind === "rules" && {
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
      }),
      ...(row
        ? { expectedUpdatedAt: row.updatedAt, expectedRevision: row.revision }
        : { code }),
    };
    await command.run(
      `/cases/governance/${kind}${row ? `/${row.id}` : ""}`,
      body,
      row ? "patch" : "post",
      !row,
    );
  };
  const transition = (action: string) => {
    if (row)
      void command.run(
        `/cases/governance/${kind}/${row.id}/${action}`,
        { expectedUpdatedAt: row.updatedAt, expectedRevision: row.revision },
        "post",
        false,
      );
  };
  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      <Link className="text-blue-700" to="/cases/governance">
        ← Công việc quản trị
      </Link>
      <h1 className="text-xl font-bold">Cấu hình quản trị vụ án</h1>
      {loading ? (
        <p role="status">Đang tải cấu hình và quyền…</p>
      ) : caps.caseAccessMode !== "INTERNAL" ? (
        <p role="alert">
          Cấu hình và công bố chỉ dành cho tài khoản nội bộ có quyền tương ứng.
        </p>
      ) : (
        <>
          <CommandFeedback command={command} />
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          <div role="tablist" className="flex gap-3 border-b">
            {[
              ["rules", "Quy tắc nghiệp vụ"],
              ["field-definitions", "Trường thông tin"],
            ].map(([key, title]) => (
              <button
                key={key}
                role="tab"
                aria-selected={kind === key}
                className="p-3 text-sm"
                onClick={() => {
                  setKind(key as typeof kind);
                  setSelected("");
                  setCode("default");
                  setActions([]);
                  setDefinition({ fields: [] });
                }}
              >
                {title}
              </button>
            ))}
          </div>
          <Panel title="Vòng đời cấu hình và lịch sử">
            <Lookup
              label="Phiên bản cấu hình cần xem"
              rows={rows[kind].map((item) => ({
                ...item,
                name: `${item.code} · v${item.revision} · ${item.status}`,
              }))}
              required={false}
              value={selected}
              onChange={choose}
            />
            {row && (
              <div className="space-y-3">
                <p>
                  <Status value={row.status} /> · Phiên bản {row.revision} ·
                  Người lập {String(row.authorId ?? "—")} · Người thẩm định{" "}
                  {String(row.reviewedById ?? "—")}
                </p>
                <p className="text-xs font-mono break-all">
                  Mã băm nội dung: {String(row.contentHash ?? "—")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setSelected("")}>
                    Tạo bản thay thế từ phiên bản này
                  </Button>
                  <Button
                    disabled={
                      command.busy ||
                      !can(workspace, "operate") ||
                      row.status !== "DRAFT"
                    }
                    onClick={() => transition("validate")}
                  >
                    Kiểm tra cấu hình
                  </Button>
                  <Button
                    disabled={
                      command.busy ||
                      !can(workspace, "review") ||
                      row.status !== "VALIDATED"
                    }
                    onClick={() => transition("review")}
                  >
                    Thẩm định độc lập cấu hình
                  </Button>
                  <Button
                    disabled={
                      command.busy ||
                      !can(workspace, "publish") ||
                      row.status !== "REVIEWED"
                    }
                    onClick={() => transition("publish")}
                  >
                    Công bố bản đã thẩm định
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {rows[kind].map((item) => (
                <p key={item.id} className="text-sm">
                  {String(item.code)} · v{item.revision} ·{" "}
                  <Status value={item.status} /> ·{" "}
                  {String(item.effectiveFrom ?? item.createdAt ?? "")}{" "}
                  {item.effectiveTo ? `→ ${String(item.effectiveTo)}` : ""}
                </p>
              ))}
            </div>
          </Panel>
          <Panel
            title={
              kind === "rules"
                ? "Soạn quy tắc có nguồn kiểm chứng"
                : "Soạn trường và chính sách thông tin"
            }
          >
            <p className="text-sm text-slate-600">
              Công bố yêu cầu người thẩm định độc lập và đúng phiên bản. Việc
              chọn nguồn chưa thay thế kiểm chứng hiệu lực, điều khoản và thẩm
              quyền.
            </p>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <fieldset disabled={locked || command.busy} className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <Field
                    label="Mã cấu hình"
                    required
                    value={code}
                    disabled={!!row}
                    onChange={setCode}
                  />
                  {kind === "rules" && (
                    <>
                      <Field
                        label="Có hiệu lực từ"
                        required
                        type="date"
                        value={effectiveFrom}
                        onChange={setEffectiveFrom}
                      />
                      <Field
                        label="Hết hiệu lực vào"
                        type="date"
                        value={effectiveTo}
                        onChange={setEffectiveTo}
                      />
                    </>
                  )}
                </div>
                {kind === "rules" ? (
                  <RuleEditor
                    actions={actions}
                    catalog={catalog}
                    onChange={setActions}
                  />
                ) : (
                  <FieldDefinitionEditor
                    definition={definition}
                    onChange={setDefinition}
                    policyCatalog={
                      policyCatalog.length ? policyCatalog : undefined
                    }
                  />
                )}
              </fieldset>
              <Button
                type="submit"
                disabled={command.busy || locked || !can(workspace, "operate")}
              >
                Lưu dự thảo cấu hình
              </Button>
            </form>
            <details>
              <summary className="cursor-pointer font-semibold text-sm">
                Xem trước phạm vi áp dụng
              </summary>
              <div className="p-3 space-y-2 text-sm">
                {kind === "rules" ? (
                  actions.map((action, index) => (
                    <p key={index}>
                      {catalog.find((item) => item.code === action.code)
                        ?.label ?? action.code}
                      : {action.legalSources.length} nguồn,{" "}
                      {action.requiredFields?.length ?? 0} trường cần đủ, thời
                      hạn{" "}
                      {action.deadlineEffect?.mode === "CALCULATE"
                        ? "tính từ dữ kiện đã kiểm chứng"
                        : "được giữ nguyên"}
                    </p>
                  ))
                ) : (
                  <>
                    {definition.fields.map((field) => (
                      <p key={field.key}>
                        {field.label} · {field.type} ·{" "}
                        {field.required ? "Bắt buộc" : "Tùy chọn"} ·{" "}
                        {field.sensitivity === "RESTRICTED"
                          ? "Hạn chế"
                          : "Thông thường"}
                      </p>
                    ))}
                    <p>
                      Chính sách trường gốc:{" "}
                      {definition.fieldPolicies?.length ?? 0} trường
                    </p>
                  </>
                )}
              </div>
            </details>
          </Panel>
        </>
      )}
    </main>
  );
}
