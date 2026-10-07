import type { ColumnDef } from "@/components/shared/ListPageShell";
import type { CaseStatus } from "@/shared/enums/generated";
import { CASE_STATUS_LABEL } from "@/shared/enums/status-labels";
interface CaseSummary {
  id: string;
  caseCode?: string | null;
  name?: string | null;
  status?: CaseStatus;
}
/** The representation list has only the server-authorized Case summary, never legacy sender fields. */
export function caseSummaryColumns<T extends CaseSummary>(): ColumnDef<T>[] {
  return [
    {
      key: "caseCode",
      header: "Mã hồ sơ",
      render: (row) => row.caseCode ?? "Thông tin hạn chế",
    },
    {
      key: "name",
      header: "Tên hồ sơ",
      render: (row) => row.name ?? "Thông tin hạn chế",
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => row.status ? (CASE_STATUS_LABEL[row.status] ?? row.status) : 'Thông tin hạn chế',
    },
  ];
}
