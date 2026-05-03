import { SubjectStatus, SubjectType } from './generated';

export { SubjectStatus, SubjectType };

export const SUBJECT_STATUS_LABEL: Record<SubjectStatus, string> = {
  [SubjectStatus.INVESTIGATING]: 'Đang điều tra',
  [SubjectStatus.DETAINED]: 'Đang tạm giam',
  [SubjectStatus.RELEASED]: 'Đã thả',
  [SubjectStatus.WANTED]: 'Đang truy nã',
};

export const SUBJECT_TYPE_LABEL: Record<SubjectType, string> = {
  [SubjectType.SUSPECT]: 'Bị can / Bị cáo',
  [SubjectType.VICTIM]: 'Bị hại',
  [SubjectType.WITNESS]: 'Nhân chứng',
};
