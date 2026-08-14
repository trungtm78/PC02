import { type ReactNode } from "react";
import {
  CARD_BASE,
  CARD_HEADER,
  CARD_HEADER_WITH_ACTIONS,
  SECTION_TITLE,
} from "@/constants/styles";

// ─── Card ───────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode;
  className?: string;
  /**
   * Forwarded to the wrapper element.
   *
   * Callers were already passing this — `EntityDocumentsTab` sets one from
   * `ENTITY_COPY[kind].testId` — but `Card` dropped every prop it did not name,
   * so the attribute never reached the DOM and the hook silently did nothing.
   */
  "data-testid"?: string;
}

export function Card({
  children,
  className = "",
  "data-testid": testId,
}: CardProps) {
  return (
    <div className={`${CARD_BASE} ${className}`} data-testid={testId}>
      {children}
    </div>
  );
}

// ─── CardHeader ─────────────────────────────────────────────────────────────

interface CardHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function CardHeader({ title, actions }: CardHeaderProps) {
  if (actions) {
    return (
      <div className={CARD_HEADER_WITH_ACTIONS}>
        <h2 className="font-bold text-slate-800">{title}</h2>
        {actions}
      </div>
    );
  }
  return <h2 className={CARD_HEADER}>{title}</h2>;
}

// ─── SectionTitle ───────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className={SECTION_TITLE}>{children}</h3>;
}
