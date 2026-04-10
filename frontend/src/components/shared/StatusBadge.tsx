import { STATUS_BADGE_BASE, STATUS_COLORS } from "@/constants/styles";

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  label: string;
  /** Color key from STATUS_COLORS, or a full className string */
  color: string;
  className?: string;
}

interface StatusConfig {
  label: string;
  color: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function StatusBadge({ label, color, className = "" }: StatusBadgeProps) {
  // If color is a known key, use the predefined colors; otherwise treat as raw className
  const colorClasses = STATUS_COLORS[color] || color;

  return (
    <span className={`${STATUS_BADGE_BASE} ${colorClasses} ${className}`}>
      {label}
    </span>
  );
}

// ─── Helper: get status config from a status map ────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export function getStatusConfig(
  status: string,
  statusMap: Record<string, StatusConfig>
): StatusConfig {
  return statusMap[status] || { label: status, color: "slate" };
}
