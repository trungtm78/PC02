import { Field, useLookup } from "./shared";
export interface ReceiptFacts {
  receiptChecklist: {
    documentId: string;
    expectedDocumentUpdatedAt: string;
    present: boolean;
    note?: string;
  }[];
  shortcomings: string;
}
export function ReceiptChecklist({
  caseId,
  facts,
  onChange,
  title = "Kiểm kê tài liệu",
}: {
  caseId: string;
  facts: ReceiptFacts;
  onChange: (facts: ReceiptFacts) => void;
  title?: string;
}) {
  const documents = useLookup(`/documents?caseId=${caseId}&limit=100`);
  return (
    <fieldset className="border rounded p-3 space-y-3">
      <legend className="font-semibold text-sm">{title}</legend>
      {documents.error && <p role="alert">{documents.error}</p>}
      {documents.loading && (
        <p className="text-sm">Đang tải tài liệu kiểm kê…</p>
      )}
      {documents.rows.map((row) => {
        const item = facts.receiptChecklist.find(
          (item) => item.documentId === row.id,
        );
        return (
          <div className="space-y-2 border-b pb-3" key={row.id}>
            <label className="text-sm flex gap-2">
              <input
                type="checkbox"
                checked={!!item}
                disabled={!row.updatedAt}
                onChange={(event) =>
                  onChange({
                    ...facts,
                    receiptChecklist: event.target.checked
                      ? [
                          ...facts.receiptChecklist,
                          {
                            documentId: row.id,
                            expectedDocumentUpdatedAt: row.updatedAt!,
                            present: true,
                          },
                        ]
                      : facts.receiptChecklist.filter(
                          (item) => item.documentId !== row.id,
                        ),
                  })
                }
              />
              {String(row.title ?? row.originalName ?? row.id)}
            </label>
            {item && (
              <div className="grid md:grid-cols-2 gap-3">
                <Field
                  label={`Kiểm kê hiện diện ${row.id}`}
                  value={String(item.present)}
                  options={[
                    { value: "true", label: "Có tài liệu" },
                    { value: "false", label: "Thiếu tài liệu" },
                  ]}
                  onChange={(value) =>
                    onChange({
                      ...facts,
                      receiptChecklist: facts.receiptChecklist.map((item) =>
                        item.documentId === row.id
                          ? { ...item, present: value === "true" }
                          : item,
                      ),
                    })
                  }
                />
                <Field
                  label={`Ghi chú kiểm kê ${row.id}`}
                  value={item.note}
                  onChange={(note) =>
                    onChange({
                      ...facts,
                      receiptChecklist: facts.receiptChecklist.map((item) =>
                        item.documentId === row.id ? { ...item, note } : item,
                      ),
                    })
                  }
                />
              </div>
            )}
          </div>
        );
      })}
      <Field
        label={`${title} · thiếu sót cần bổ sung`}
        type="textarea"
        value={facts.shortcomings}
        onChange={(shortcomings) => onChange({ ...facts, shortcomings })}
      />
    </fieldset>
  );
}
export function ReceiptHistory({ value }: { value: unknown }) {
  const facts = value as {
    receiptChecklist?: {
      documentId: string;
      present: boolean;
      note?: string;
    }[];
    shortcomings?: string;
  } | null;
  if (!facts) return null;
  return (
    <div className="text-sm space-y-1">
      {facts.receiptChecklist?.map((item) => (
        <p key={item.documentId}>
          {item.present ? "Có" : "Thiếu"} · Tài liệu {item.documentId} ·{" "}
          {item.note ?? ""}
        </p>
      ))}
      {facts.shortcomings && <p>Thiếu sót: {facts.shortcomings}</p>}
    </div>
  );
}
