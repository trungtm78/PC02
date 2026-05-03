import { ReportTdcStatus, ReportTdcType } from './generated';

export { ReportTdcStatus, ReportTdcType };

export const REPORT_TDC_STATUS_LABEL: Record<ReportTdcStatus, string> = {
  [ReportTdcStatus.DRAFT]: 'Bản nháp',
  [ReportTdcStatus.REVIEWING]: 'Đang xét duyệt',
  [ReportTdcStatus.REJECTED]: 'Bị từ chối',
  [ReportTdcStatus.APPROVED]: 'Đã phê duyệt',
  [ReportTdcStatus.FINALIZED]: 'Đã khoá',
};

export const REPORT_TDC_TYPE_LABEL: Record<ReportTdcType, string> = {
  [ReportTdcType.VU_AN]: 'Vụ án',
  [ReportTdcType.VU_VIEC]: 'Vụ việc',
};
