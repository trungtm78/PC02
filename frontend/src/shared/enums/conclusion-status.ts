import { ConclusionStatus } from './generated';

export { ConclusionStatus };

export const CONCLUSION_STATUS_LABEL: Record<ConclusionStatus, string> = {
  [ConclusionStatus.DU_THAO]: 'Dự thảo',
  [ConclusionStatus.CHO_DUYET]: 'Chờ duyệt',
  [ConclusionStatus.DA_DUYET]: 'Đã duyệt',
};

export const CONCLUSION_STATUS_BADGE: Record<ConclusionStatus, string> = {
  [ConclusionStatus.DU_THAO]: 'bg-slate-100 text-slate-700',
  [ConclusionStatus.CHO_DUYET]: 'bg-amber-100 text-amber-700',
  [ConclusionStatus.DA_DUYET]: 'bg-green-100 text-green-700',
};
