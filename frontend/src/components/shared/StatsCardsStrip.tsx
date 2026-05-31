import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

export interface StatCard {
  label: string;
  value: number | null;
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  valueColorClass: string;
}

export interface StatsCardsStripProps {
  cards: StatCard[];
  loading?: boolean;
  className?: string;
}

function CardValue({ value, valueColorClass, loading }: { value: number | null; valueColorClass: string; loading: boolean }): ReactNode {
  if (loading || value === null) {
    return <div className="h-8 w-12 bg-slate-200 rounded animate-pulse mt-1" />;
  }
  return <p className={`text-2xl font-bold mt-1 ${valueColorClass}`}>{value}</p>;
}

export function StatsCardsStrip({ cards, loading = false, className }: StatsCardsStripProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-5 gap-4 px-6 py-4 ${className ?? ''}`}>
      {cards.map((card, i) => (
        <div key={card.label ?? i} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">{card.label}</p>
              <CardValue value={card.value} valueColorClass={card.valueColorClass} loading={loading} />
            </div>
            <div className={`w-12 h-12 ${card.iconBgClass} rounded-lg flex items-center justify-center`}>
              <card.icon className={`w-6 h-6 ${card.iconColorClass}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
