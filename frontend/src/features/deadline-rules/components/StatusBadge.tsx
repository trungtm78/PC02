import type { DeadlineRuleStatus } from '@/shared/enums/generated';
import {
  DEADLINE_RULE_STATUS_LABEL,
  DEADLINE_RULE_STATUS_BADGE_CLASS,
  MIGRATED_NEEDS_DOC_BADGE_CLASS,
  MIGRATED_NEEDS_DOC_LABEL,
} from '@/shared/enums/status-labels';
import {
  FileEdit,
  Send,
  CheckCircle,
  Zap,
  Archive,
  XCircle,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';

const ICON_BY_STATUS: Record<DeadlineRuleStatus, LucideIcon> = {
  draft: FileEdit,
  submitted: Send,
  approved: CheckCircle,
  active: Zap,
  superseded: Archive,
  rejected: XCircle,
};

interface StatusBadgeProps {
  status: DeadlineRuleStatus;
  /** When true and status='active' + migrationConfidence='legacy-default', shows amber "Cần bổ sung tài liệu". */
  needsDocumentation?: boolean;
  className?: string;
}

export function StatusBadge({ status, needsDocumentation, className = '' }: StatusBadgeProps) {
  if (needsDocumentation) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${MIGRATED_NEEDS_DOC_BADGE_CLASS} ${className}`}
        data-testid="status-badge-needs-doc"
      >
        <AlertCircle className="w-3 h-3" />
        {MIGRATED_NEEDS_DOC_LABEL}
      </span>
    );
  }
  const Icon = ICON_BY_STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${DEADLINE_RULE_STATUS_BADGE_CLASS[status]} ${className}`}
      data-testid={`status-badge-${status}`}
    >
      <Icon className="w-3 h-3" />
      {DEADLINE_RULE_STATUS_LABEL[status]}
    </span>
  );
}
