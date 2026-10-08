import { CASE_CANONICAL_FIELDS } from "../canonical-fields";
import { CASE_LEGACY_SPEC } from "../legacy-form-layout.def";
import type { PublishedCaseFieldSchema } from "../CaseCustomFields";
import type { NativeFieldPolicy } from "../native-field-policy";
import {
  Field,
  Button,
  basicPolicyLabels,
  type ActionCatalog,
  type PolicyCatalogEntry,
} from "./shared";

export interface LegalSource {
  id?: string;
  instrument: string;
  provision: string;
  url: string;
  authority: string;
  effectiveFrom: string;
  effectiveTo?: string;
}
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { path: string; op: "eq" | "in" | "exists"; value?: unknown };
export interface RuleAction {
  code: string;
  legalSources: LegalSource[];
  conditions?: Condition;
  requiredFields?: string[];
  deadlineAlgorithmId?: string;
  allowedCaseTypes?: string[];
  deadlineEffect?: Record<string, unknown>;
}
const blankSource = (): LegalSource => ({
  instrument: "",
  provision: "",
  url: "",
  authority: "",
  effectiveFrom: "",
});
export function RuleEditor({
  actions,
  catalog,
  onChange,
}: {
  actions: RuleAction[];
  catalog: ActionCatalog[];
  onChange: (actions: RuleAction[]) => void;
}) {
  const write = (index: number, value: RuleAction) =>
    onChange(actions.map((item, i) => (i === index ? value : item)));
  return (
    <div className="space-y-4">
      {actions.map((action, index) => (
        <fieldset className="rounded-lg border p-4 space-y-4" key={index}>
          <legend className="text-sm font-semibold">
            Quy tắc thao tác {index + 1}
          </legend>
          <Field
            label={`Thao tác quy tắc ${index + 1}`}
            required
            value={action.code}
            options={catalog.map((item) => ({
              value: item.code,
              label: item.label ?? item.code,
            }))}
            onChange={(code) => write(index, { ...action, code })}
          />
          <div className="flex flex-wrap gap-4 text-sm">
            {[
              ["REGULAR", "Vụ án thường"],
              ["UY_THAC_DIEU_TRA", "Ủy thác điều tra"],
            ].map(([value, title]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={(action.allowedCaseTypes ?? ["REGULAR"]).includes(
                    value,
                  )}
                  onChange={(event) =>
                    write(index, {
                      ...action,
                      allowedCaseTypes: event.target.checked
                        ? [...(action.allowedCaseTypes ?? ["REGULAR"]), value]
                        : (action.allowedCaseTypes ?? ["REGULAR"]).filter(
                            (item) => item !== value,
                          ),
                    })
                  }
                />{" "}
                {title}
              </label>
            ))}
          </div>
          {action.legalSources.map((source, sourceIndex) => {
            const suffix = `${index + 1}.${sourceIndex + 1}`;
            const change = (key: keyof LegalSource, value: string) =>
              write(index, {
                ...action,
                legalSources: action.legalSources.map((item, i) =>
                  i === sourceIndex
                    ? { ...item, [key]: value || undefined }
                    : item,
                ),
              });
            return (
              <fieldset
                key={sourceIndex}
                className="border rounded p-3 space-y-3"
              >
                <legend className="text-sm">Nguồn pháp lý {suffix}</legend>
                <div className="grid md:grid-cols-2 gap-3">
                  {(
                    [
                      ["id", "Mã tham chiếu nguồn"],
                      ["instrument", "Văn bản nguồn"],
                      ["provision", "Điều khoản"],
                      ["url", "URL nguồn"],
                      ["authority", "Thẩm quyền nguồn"],
                      ["effectiveFrom", "Nguồn có hiệu lực từ"],
                      ["effectiveTo", "Nguồn hết hiệu lực"],
                    ] as [keyof LegalSource, string][]
                  ).map(([key, title]) => (
                    <Field
                      key={key}
                      label={`${title} ${suffix}`}
                      value={source[key]}
                      required={key !== "effectiveTo" && key !== "id"}
                      type={
                        key === "url"
                          ? "url"
                          : key.includes("effective")
                            ? "date"
                            : "text"
                      }
                      onChange={(value) => change(key, value)}
                    />
                  ))}
                </div>
                <Button
                  onClick={() =>
                    write(index, {
                      ...action,
                      legalSources: action.legalSources.filter(
                        (_, i) => i !== sourceIndex,
                      ),
                    })
                  }
                >
                  Bỏ nguồn {suffix}
                </Button>
              </fieldset>
            );
          })}
          <Button
            onClick={() =>
              write(index, {
                ...action,
                legalSources: [...action.legalSources, blankSource()],
              })
            }
          >
            Thêm nguồn pháp lý {index + 1}
          </Button>
          <Field
            label={`Trường bắt buộc (mỗi dòng một đường dẫn) ${index + 1}`}
            type="textarea"
            value={action.requiredFields?.join("\n")}
            onChange={(value) =>
              write(index, {
                ...action,
                requiredFields: value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
          />
          <div className="space-y-2">
            <p className="text-sm font-semibold">Điều kiện khai báo an toàn</p>
            {action.conditions ? (
              <ConditionEditor
                value={action.conditions}
                name={`Điều kiện ${index + 1}`}
                onChange={(conditions) =>
                  write(index, { ...action, conditions })
                }
              />
            ) : (
              <Button
                onClick={() =>
                  write(index, {
                    ...action,
                    conditions: { path: "case.status", op: "exists" },
                  })
                }
              >
                Thêm điều kiện {index + 1}
              </Button>
            )}
            {action.conditions && (
              <Button
                onClick={() =>
                  write(index, { ...action, conditions: undefined })
                }
              >
                Bỏ điều kiện {index + 1}
              </Button>
            )}
          </div>
          <DeadlineRuleEditor
            value={action.deadlineEffect ?? { mode: "PRESERVE" }}
            name={`Thời hạn ${index + 1}`}
            onChange={(deadlineEffect) =>
              write(index, { ...action, deadlineEffect })
            }
          />
          <Button
            onClick={() => onChange(actions.filter((_, i) => i !== index))}
          >
            Bỏ thao tác quy tắc {index + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        onClick={() =>
          onChange([...actions, { code: "", legalSources: [blankSource()] }])
        }
      >
        Thêm thao tác quy tắc
      </Button>
    </div>
  );
}
export function ConditionEditor({
  value,
  name,
  onChange,
  depth = 0,
}: {
  value: Condition;
  name: string;
  onChange: (condition: Condition) => void;
  depth?: number;
}) {
  const group = "all" in value ? "all" : "any" in value ? "any" : "";
  const items = group
    ? ((value as { all?: Condition[]; any?: Condition[] })[group] ?? [])
    : [];
  const leaf = !group
    ? (value as { path: string; op: "eq" | "in" | "exists"; value?: unknown })
    : null;
  return (
    <fieldset className="rounded border p-3 space-y-3">
      <Field
        label={`${name} · kiểu điều kiện`}
        value={group || "leaf"}
        options={[
          { value: "leaf", label: "So sánh một trường" },
          { value: "all", label: "Tất cả điều kiện (AND)" },
          { value: "any", label: "Một trong các điều kiện (OR)" },
        ]}
        onChange={(type) =>
          onChange(
            type === "leaf"
              ? { path: "case.status", op: "exists" }
              : type === "all"
                ? { all: [{ path: "case.status", op: "exists" }] }
                : { any: [{ path: "case.status", op: "exists" }] },
          )
        }
      />
      {group ? (
        <>
          {items.map((condition, index) => (
            <div key={index}>
              <ConditionEditor
                value={condition}
                name={`${name}.${index + 1}`}
                depth={depth + 1}
                onChange={(next) =>
                  onChange({
                    [group]: items.map((item, i) =>
                      i === index ? next : item,
                    ),
                  } as Condition)
                }
              />
              <Button
                onClick={() =>
                  onChange({
                    [group]: items.filter((_, i) => i !== index),
                  } as Condition)
                }
              >
                Bỏ điều kiện {name}.{index + 1}
              </Button>
            </div>
          ))}
          <Button
            disabled={depth >= 5}
            onClick={() =>
              onChange({
                [group]: [...items, { path: "case.status", op: "exists" }],
              } as Condition)
            }
          >
            Thêm điều kiện con {name}
          </Button>
        </>
      ) : (
        leaf && (
          <div className="grid md:grid-cols-2 gap-3">
            <Field
              label={`${name} · đường dẫn an toàn`}
              value={leaf.path}
              required
              onChange={(path) => onChange({ ...leaf, path })}
            />
            <Field
              label={`${name} · phép so sánh`}
              value={leaf.op}
              options={[
                { value: "eq", label: "Bằng" },
                { value: "in", label: "Thuộc danh sách" },
                { value: "exists", label: "Đã có dữ liệu" },
              ]}
              onChange={(op) =>
                onChange({
                  ...leaf,
                  op: op as typeof leaf.op,
                  ...(op === "exists" && { value: undefined }),
                })
              }
            />
            {leaf.op !== "exists" && (
              <>
                <Field
                  label={`${name} · kiểu giá trị`}
                  value={
                    Array.isArray(leaf.value)
                      ? "list"
                      : typeof leaf.value === "number"
                        ? "number"
                        : typeof leaf.value === "boolean"
                          ? "boolean"
                          : "text"
                  }
                  options={[
                    { value: "text", label: "Chữ" },
                    { value: "number", label: "Số" },
                    { value: "boolean", label: "Đúng/sai" },
                    {
                      value: "list",
                      label: "Danh sách (mỗi dòng một giá trị)",
                    },
                  ]}
                  onChange={(type) =>
                    onChange({
                      ...leaf,
                      value:
                        type === "number"
                          ? 0
                          : type === "boolean"
                            ? false
                            : type === "list"
                              ? []
                              : "",
                    })
                  }
                />
                <Field
                  label={`${name} · giá trị`}
                  value={
                    Array.isArray(leaf.value)
                      ? leaf.value.join("\n")
                      : leaf.value
                  }
                  type={
                    Array.isArray(leaf.value)
                      ? "textarea"
                      : typeof leaf.value === "number"
                        ? "number"
                        : "text"
                  }
                  options={
                    typeof leaf.value === "boolean"
                      ? [
                          { value: "true", label: "Đúng" },
                          { value: "false", label: "Sai" },
                        ]
                      : undefined
                  }
                  onChange={(input) =>
                    onChange({
                      ...leaf,
                      value:
                        Array.isArray(leaf.value) || leaf.op === "in"
                          ? input.split("\n").filter(Boolean)
                          : typeof leaf.value === "number"
                            ? Number(input)
                            : typeof leaf.value === "boolean"
                              ? input === "true"
                              : input,
                    })
                  }
                />
              </>
            )}
          </div>
        )
      )}
      <p className="text-xs text-slate-500">
        Chỉ dùng đường dẫn case.* hoặc payload.*. Máy chủ kiểm tra cấu trúc,
        kiểu dữ liệu và khóa an toàn.
      </p>
    </fieldset>
  );
}
export function DeadlineRuleEditor({
  value,
  name,
  onChange,
}: {
  value: Record<string, unknown>;
  name: string;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const write = (key: string, next: unknown) =>
    onChange({ ...value, [key]: next });
  const anchors = (value.anchors as Record<string, string>) ?? {};
  const calendar = (value.calendar as Record<string, unknown>) ?? {};
  const durations = (value.durations as Record<string, unknown>[]) ?? [];
  const setCalendar = (key: string, next: unknown) =>
    write("calendar", { ...calendar, [key]: next });
  const list = (input: string) =>
    input
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  return (
    <fieldset className="border rounded p-4 space-y-3">
      <legend className="font-semibold text-sm">Hiệu lực thời hạn</legend>
      <Field
        label={`${name} · cách xử lý`}
        value={value.mode}
        options={[
          { value: "PRESERVE", label: "Giữ thời hạn hiện tại" },
          { value: "CALCULATE", label: "Tính từ dữ kiện thực tế đã thẩm định" },
        ]}
        onChange={(mode) =>
          onChange(
            mode === "PRESERVE"
              ? { mode }
              : {
                  mode,
                  algorithm: "CIVIL_PERIOD",
                  version: 1,
                  phase: "INITIAL",
                  anchors: {},
                  durations: [],
                  gravityPath: "payload.deadlineFacts.gravity",
                  calendar: {
                    id: "",
                    version: 1,
                    effectiveFrom: "",
                    effectiveTo: "",
                    weekendDays: [0, 6],
                    nonworkingDates: [],
                    workingOverrides: [],
                    sourceReferenceIds: [],
                  },
                  sourceReferenceIds: [],
                },
          )
        }
      />
      {value.mode === "CALCULATE" && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <Field
              label={`${name} · giai đoạn`}
              value={value.phase}
              required
              options={[
                "INITIAL",
                "RESTORED",
                "SUPPLEMENTARY",
                "REINVESTIGATION",
              ].map((value) => ({ value, label: value }))}
              onChange={(next) => write("phase", next)}
            />
            {[
              ["initiation", "Mốc khởi tố"],
              ["restoration", "Mốc phục hồi"],
              ["dossierReceipt", "Mốc nhận hồ sơ"],
              ["requestReceipt", "Mốc nhận yêu cầu"],
            ].map(([key, title]) => (
              <Field
                key={key}
                label={`${name} · ${title}`}
                value={anchors[key]}
                onChange={(next) =>
                  write("anchors", { ...anchors, [key]: next || undefined })
                }
              />
            ))}
            <Field
              label={`${name} · đường dẫn mức nghiêm trọng`}
              required
              value={value.gravityPath}
              onChange={(next) => write("gravityPath", next)}
            />
            <Field
              label={`${name} · đường dẫn thẩm quyền`}
              value={value.authorityPath}
              onChange={(next) => write("authorityPath", next || undefined)}
            />
            <Field
              label={`${name} · mã nguồn căn cứ`}
              type="textarea"
              value={((value.sourceReferenceIds as string[]) ?? []).join("\n")}
              onChange={(next) => write("sourceReferenceIds", list(next))}
            />
          </div>
          {durations.map((duration, index) => (
            <div key={index} className="grid md:grid-cols-4 gap-3">
              <Field
                label={`${name} · mức nghiêm trọng ${index + 1}`}
                required
                value={duration.gravity}
                options={[
                  "IT_NGHIEM_TRONG",
                  "NGHIEM_TRONG",
                  "RAT_NGHIEM_TRONG",
                  "DAC_BIET_NGHIEM_TRONG",
                ].map((value) => ({ value, label: value }))}
                onChange={(next) =>
                  write(
                    "durations",
                    durations.map((item, i) =>
                      i === index ? { ...item, gravity: next } : item,
                    ),
                  )
                }
              />
              <Field
                label={`${name} · thẩm quyền ${index + 1}`}
                value={duration.authority}
                options={[
                  { value: "VKS", label: "Viện kiểm sát" },
                  { value: "TOA", label: "Tòa án" },
                ]}
                onChange={(next) =>
                  write(
                    "durations",
                    durations.map((item, i) =>
                      i === index
                        ? { ...item, authority: next || undefined }
                        : item,
                    ),
                  )
                }
              />
              <Field
                label={`${name} · số kỳ ${index + 1}`}
                required
                type="number"
                value={duration.value}
                onChange={(next) =>
                  write(
                    "durations",
                    durations.map((item, i) =>
                      i === index ? { ...item, value: Number(next) } : item,
                    ),
                  )
                }
              />
              <Field
                label={`${name} · đơn vị kỳ ${index + 1}`}
                value={duration.unit}
                options={[
                  { value: "DAYS", label: "Ngày" },
                  { value: "MONTHS", label: "Tháng" },
                ]}
                onChange={(next) =>
                  write(
                    "durations",
                    durations.map((item, i) =>
                      i === index ? { ...item, unit: next } : item,
                    ),
                  )
                }
              />
              <Button
                onClick={() =>
                  write(
                    "durations",
                    durations.filter((_, i) => i !== index),
                  )
                }
              >
                Bỏ kỳ {name} {index + 1}
              </Button>
            </div>
          ))}
          <Button
            onClick={() =>
              write("durations", [
                ...durations,
                { gravity: "IT_NGHIEM_TRONG", value: 1, unit: "MONTHS" },
              ])
            }
          >
            Thêm kỳ thời hạn {name}
          </Button>
          <fieldset className="space-y-3 rounded border p-3">
            <legend className="text-sm">
              Lịch làm việc có nguồn kiểm chứng
            </legend>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                ["id", "Mã lịch"],
                ["version", "Phiên bản lịch"],
                ["effectiveFrom", "Lịch có hiệu lực từ"],
                ["effectiveTo", "Lịch có hiệu lực đến"],
              ].map(([key, title]) => (
                <Field
                  key={key}
                  label={`${name} · ${title}`}
                  required
                  value={calendar[key]}
                  type={
                    key === "version"
                      ? "number"
                      : key.startsWith("effective")
                        ? "date"
                        : "text"
                  }
                  onChange={(next) =>
                    setCalendar(key, key === "version" ? Number(next) : next)
                  }
                />
              ))}
              {[
                ["nonworkingDates", "Ngày nghỉ"],
                ["workingOverrides", "Ngày làm việc bù"],
                ["sourceReferenceIds", "Mã nguồn lịch"],
              ].map(([key, title]) => (
                <Field
                  key={key}
                  label={`${name} · ${title} (mỗi dòng một giá trị)`}
                  type="textarea"
                  value={((calendar[key] as string[]) ?? []).join("\n")}
                  onChange={(next) => setCalendar(key, list(next))}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                "Chủ nhật",
                "Thứ hai",
                "Thứ ba",
                "Thứ tư",
                "Thứ năm",
                "Thứ sáu",
                "Thứ bảy",
              ].map((title, day) => (
                <label key={day} className="text-sm">
                  <input
                    type="checkbox"
                    checked={(
                      (calendar.weekendDays as number[]) ?? []
                    ).includes(day)}
                    onChange={(event) =>
                      setCalendar(
                        "weekendDays",
                        event.target.checked
                          ? [...((calendar.weekendDays as number[]) ?? []), day]
                          : ((calendar.weekendDays as number[]) ?? []).filter(
                              (item) => item !== day,
                            ),
                      )
                    }
                  />{" "}
                  {title} nghỉ
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </fieldset>
  );
}
export function FieldDefinitionEditor({
  definition,
  onChange,
  policyCatalog,
}: {
  definition: PublishedCaseFieldSchema["definition"];
  onChange: (definition: PublishedCaseFieldSchema["definition"]) => void;
  policyCatalog?: PolicyCatalogEntry[];
}) {
  const fields = definition.fields;
  const policies = definition.fieldPolicies ?? [];
  return (
    <div className="space-y-4">
      {fields.map((field, index) => {
        const write = (key: string, value: unknown) =>
          onChange({
            ...definition,
            fields: fields.map((item, i) =>
              i === index ? { ...item, [key]: value } : item,
            ),
          });
        return (
          <fieldset key={index} className="border rounded p-4 space-y-3">
            <legend className="text-sm font-semibold">
              Trường bổ sung {index + 1}
            </legend>
            <div className="grid md:grid-cols-2 gap-3">
              <Field
                label={`Khóa trường ${index + 1}`}
                required
                value={field.key}
                onChange={(value) => write("key", value)}
              />
              <Field
                label={`Nhãn trường ${index + 1}`}
                required
                value={field.label}
                onChange={(value) => write("label", value)}
              />
              <Field
                label={`Kiểu dữ liệu ${index + 1}`}
                value={field.type}
                options={[
                  "text",
                  "textarea",
                  "number",
                  "boolean",
                  "date",
                  "select",
                ].map((value) => ({
                  value,
                  label: {
                    text: "Chữ ngắn",
                    textarea: "Nội dung dài",
                    number: "Số",
                    boolean: "Có/không/chưa xác minh",
                    date: "Ngày",
                    select: "Danh mục chọn",
                  }[value]!,
                }))}
                onChange={(value) => write("type", value)}
              />
              <Field
                label={`Mức hạn chế ${index + 1}`}
                value={field.sensitivity ?? "NORMAL"}
                options={[
                  { value: "NORMAL", label: "Thông thường" },
                  { value: "RESTRICTED", label: "Hạn chế" },
                ]}
                onChange={(value) => write("sensitivity", value)}
              />
              <Field
                label={`Tab hiển thị ${index + 1}`}
                value={field.tab ?? "info"}
                options={Object.entries(CASE_LEGACY_SPEC.tabLabel).map(
                  ([value, label]) => ({ value, label }),
                )}
                onChange={(value) => write("tab", value)}
              />
              {field.type === "select" && (
                <Field
                  label={`Lựa chọn ${index + 1} (mỗi dòng một giá trị)`}
                  type="textarea"
                  required
                  value={field.options?.join("\n")}
                  onChange={(value) =>
                    write("options", value.split("\n").filter(Boolean))
                  }
                />
              )}
            </div>
            <label className="text-sm">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(event) => write("required", event.target.checked)}
              />{" "}
              Bắt buộc nhập trường {index + 1}
            </label>
            <Button
              onClick={() =>
                onChange({
                  ...definition,
                  fields: fields.filter((_, i) => i !== index),
                })
              }
            >
              Bỏ trường {index + 1}
            </Button>
          </fieldset>
        );
      })}
      <Button
        onClick={() =>
          onChange({
            ...definition,
            fields: [
              ...fields,
              { key: "", label: "", type: "text", required: false },
            ],
          })
        }
      >
        Thêm trường bổ sung
      </Button>
      <fieldset className="space-y-3 border rounded p-4">
        <legend className="font-semibold text-sm">
          Chính sách 132 trường gốc
        </legend>
        <p className="text-xs text-slate-500">
          Quyền đọc và ghi được máy chủ xác định từ mức hạn chế đã công bố và
          quyền hiện tại. Tìm kiếm và xuất tuân thủ cùng chính sách.
        </p>
        {policies.map((policy, index) => {
          const write = (key: string, value: unknown) =>
            onChange({
              ...definition,
              fieldPolicies: policies.map((item, i) =>
                i === index ? { ...item, [key]: value } : item,
              ),
            });
          return (
            <div key={index} className="rounded border p-3 space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <Field
                  label={`Trường gốc áp dụng ${index + 1}`}
                  required
                  value={policy.key}
                  options={(
                    policyCatalog ??
                    CASE_CANONICAL_FIELDS.map((field) => ({
                      key: field.key,
                      column: field.column,
                      aliases: [],
                      group: "LEGACY_132" as const,
                      label: field.label,
                    }))
                  ).map((field) => ({
                    value: field.key,
                    label:
                      field.label ??
                      basicPolicyLabels[field.key] ??
                      CASE_CANONICAL_FIELDS.find(
                        (item) => item.key === field.key,
                      )?.label ??
                      field.key,
                    group:
                      field.group === "BASIC_INFORMATION"
                        ? "Thông tin cơ bản"
                        : "132 trường hệ cũ",
                  }))}
                  onChange={(value) => write("key", value)}
                />
                <Field
                  label={`Mức hạn chế trường gốc ${index + 1}`}
                  value={policy.sensitivity}
                  options={[
                    { value: "NORMAL", label: "Thông thường" },
                    { value: "RESTRICTED", label: "Hạn chế" },
                  ]}
                  onChange={(value) => write("sensitivity", value)}
                />
              </div>
              {[
                ["searchable", "Cho phép tìm kiếm"],
                ["exportable", "Cho phép xuất"],
              ].map(([key, title]) => (
                <label key={key} className="text-sm mr-4">
                  <input
                    type="checkbox"
                    checked={policy[key as keyof NativeFieldPolicy] !== false}
                    onChange={(event) => write(key, event.target.checked)}
                  />{" "}
                  {title} {index + 1}
                </label>
              ))}
              <Button
                onClick={() =>
                  onChange({
                    ...definition,
                    fieldPolicies: policies.filter((_, i) => i !== index),
                  })
                }
              >
                Bỏ chính sách trường gốc {index + 1}
              </Button>
            </div>
          );
        })}
        <Button
          onClick={() =>
            onChange({
              ...definition,
              fieldPolicies: [
                ...policies,
                {
                  key: "",
                  sensitivity: "NORMAL",
                  searchable: true,
                  exportable: true,
                  readable: true,
                  writable: true,
                },
              ],
            })
          }
        >
          Thêm chính sách trường gốc
        </Button>
      </fieldset>
    </div>
  );
}
