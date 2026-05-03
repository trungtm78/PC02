import { ProposalStatus } from './generated';

export { ProposalStatus };
export type ProposalStatusValue = ProposalStatus;

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  [ProposalStatus.CHO_GUI]: 'Chờ gửi',
  [ProposalStatus.DA_GUI]: 'Đã gửi',
  [ProposalStatus.CO_PHAN_HOI]: 'Đã có phản hồi',
  [ProposalStatus.DA_XU_LY]: 'Đã xử lý',
};

export const PROPOSAL_STATUS_LIST: readonly ProposalStatus[] = Object.freeze(
  Object.values(ProposalStatus),
);
