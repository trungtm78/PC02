export interface TdcReportRow {
  rowKey: string;
  label: string;
  total: number;
  byTeam: { teamId: string; teamName: string; value: number }[];
}

export interface TdcRowAdjustment {
  rowKey: string;
  teamId: string | null;
  value: number;
  note: string;
}

export interface TdcReportData {
  rows: TdcReportRow[];
  fromDate: Date;
  toDate: Date;
  teamIds: string[];
  generatedAt: Date;
}
