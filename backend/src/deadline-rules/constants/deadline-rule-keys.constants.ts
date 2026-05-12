/**
 * Deadline rule keys — the 12 BLTTHS / Luật Tố cáo / Luật Khiếu nại deadline
 * configurations managed via the versioning workflow.
 *
 * After the 20260511_deadline_rule_versioning migration:
 *   - These keys are REMOVED from `system_settings`
 *   - `SettingsService.getNumericValue(key)` THROWS if called with any of these
 *   - The runtime authority is `deadline_rule_versions` table, queried via
 *     `DeadlineRulesService.getActive(key)` / `getActiveValue(key)`
 *
 * Renaming a value here will break runtime reads (DeadlineRulesService matches
 * by ruleKey string). Add new keys via PR + migration, never via runtime UI.
 */
export const DEADLINE_RULE_KEYS = [
  'THOI_HAN_XAC_MINH',
  'THOI_HAN_GIA_HAN_1',
  'THOI_HAN_GIA_HAN_2',
  'THOI_HAN_TOI_DA',
  'THOI_HAN_PHUC_HOI',
  'THOI_HAN_PHAN_LOAI',
  'SO_LAN_GIA_HAN_TOI_DA',
  'THOI_HAN_GUI_QD_VKS',
  'THOI_HAN_TO_CAO',
  'THOI_HAN_KHIEU_NAI',
  'THOI_HAN_KIEN_NGHI',
  'THOI_HAN_PHAN_ANH',
] as const;

export type DeadlineRuleKey = (typeof DEADLINE_RULE_KEYS)[number];

export const DEADLINE_RULE_KEY_SET = new Set<string>(DEADLINE_RULE_KEYS);

export function isDeadlineRuleKey(key: string): key is DeadlineRuleKey {
  return DEADLINE_RULE_KEY_SET.has(key);
}

/** Audit log action constants for the workflow. */
export const DEADLINE_RULE_ACTIONS = {
  PROPOSED: 'DEADLINE_RULE_PROPOSED',
  UPDATED_DRAFT: 'DEADLINE_RULE_DRAFT_UPDATED',
  SUBMITTED: 'DEADLINE_RULE_SUBMITTED',
  APPROVED: 'DEADLINE_RULE_APPROVED',
  REJECTED: 'DEADLINE_RULE_REJECTED',
  ACTIVATED: 'DEADLINE_RULE_ACTIVATED',
  SUPERSEDED: 'DEADLINE_RULE_SUPERSEDED',
  DELETED_DRAFT: 'DEADLINE_RULE_DRAFT_DELETED',
  STALE_REVIEW_NOTIFIED: 'DEADLINE_RULE_STALE_REVIEW_NOTIFIED',
  WITHDRAWN: 'DEADLINE_RULE_WITHDRAWN',
  CHANGES_REQUESTED: 'DEADLINE_RULE_CHANGES_REQUESTED',
} as const;

export type DeadlineRuleAction = (typeof DEADLINE_RULE_ACTIONS)[keyof typeof DEADLINE_RULE_ACTIONS];
