import { IsIn } from 'class-validator';

export const DYN_REPORT_LIST_MODES = ['input', 'manage', 'setup'] as const;
export type DynReportListMode = (typeof DYN_REPORT_LIST_MODES)[number];

export class ListReportsQueryDto {
  @IsIn(DYN_REPORT_LIST_MODES)
  mode!: DynReportListMode;
}
