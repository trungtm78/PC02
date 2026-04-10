import { type ReactNode } from "react";
import {
  TABLE_WRAPPER,
  TABLE_BASE,
  TABLE_HEADER,
  TABLE_HEADER_CELL,
  TABLE_BODY,
  TABLE_ROW,
  TABLE_CELL,
} from "@/constants/styles";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  key: string;
  header: string;
  /** Custom width class, e.g. "w-24" */
  width?: string;
  /** Render the cell content. If not provided, accesses item[key] */
  render?: (item: T, index: number) => ReactNode;
  /** Additional cell className */
  cellClassName?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Function to extract a unique key from each row */
  rowKey: (item: T) => string;
  /** Optional: empty state content */
  emptyState?: ReactNode;
  /** Optional: additional className for <table> */
  className?: string;
  /** Optional: row click handler */
  onRowClick?: (item: T) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyState,
  className,
  onRowClick,
}: DataTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={TABLE_WRAPPER}>
      <table className={`${TABLE_BASE} ${className || ""}`} data-testid="data-table">
        <thead className={TABLE_HEADER}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${TABLE_HEADER_CELL} ${col.width || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={TABLE_BODY}>
          {data.map((item, index) => (
            <tr
              key={rowKey(item)}
              className={`${TABLE_ROW} ${onRowClick ? "cursor-pointer" : ""}`}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={col.cellClassName || TABLE_CELL}
                >
                  {col.render
                    ? col.render(item, index)
                    : String((item as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
