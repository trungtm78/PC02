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
}

export function Card({ children, className = "" }: CardProps) {
  return <div className={`${CARD_BASE} ${className}`}>{children}</div>;
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
