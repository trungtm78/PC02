import { type ReactNode, type ComponentType } from "react";
import {
  EMPTY_STATE_WRAPPER,
  EMPTY_STATE_ICON,
  EMPTY_STATE_TEXT,
  EMPTY_STATE_SUBTEXT,
} from "@/constants/styles";

interface EmptyStateProps {
  /** Lucide icon component */
  icon: ComponentType<{ className?: string }>;
  /** Primary message */
  message: string;
  /** Secondary message */
  subMessage?: string;
  /** Optional action button */
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, message, subMessage, action }: EmptyStateProps) {
  return (
    <div className={EMPTY_STATE_WRAPPER} data-testid="empty-state">
      <Icon className={EMPTY_STATE_ICON} />
      <p className={EMPTY_STATE_TEXT}>{message}</p>
      {subMessage && <p className={EMPTY_STATE_SUBTEXT}>{subMessage}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
