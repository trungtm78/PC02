import { type ReactNode } from "react";
import { PAGE_HEADER, PAGE_TITLE, PAGE_SUBTITLE } from "@/constants/styles";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Action buttons rendered on the right side */
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className={PAGE_HEADER} data-testid="page-header">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={PAGE_TITLE}>{title}</h1>
          {subtitle && <p className={PAGE_SUBTITLE}>{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
