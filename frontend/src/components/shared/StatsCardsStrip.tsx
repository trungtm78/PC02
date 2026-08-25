import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { STATS_CARD, A11Y_FOCUS_RING } from '@/constants/styles';

export interface StatCard {
  label: string;
  value: number | null;
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  valueColorClass: string;
  /**
   * Khoá nhóm trạng thái để lọc khi bấm thẻ (drill-down). `null` = thẻ "Tổng" (bỏ lọc).
   *
   * Có mặt + trang truyền `onCardSelect` thì thẻ mới bấm được. Không có thì thẻ render
   * y hệt trước đây — 16+ trang khác đang dùng component này không đổi một byte DOM nào.
   */
  filterValue?: string | null;
}

export interface StatsCardsStripProps {
  cards: StatCard[];
  loading?: boolean;
  className?: string;
  /** Nhóm đang lọc. `null`/bỏ trống = không lọc → thẻ "Tổng" tự sáng. */
  activeValue?: string | null;
  /** Truyền vào để bật drill-down. Không truyền = thẻ chỉ để xem như cũ. */
  onCardSelect?: (filterValue: string | null) => void;
  /**
   * Nhãn kỳ thống kê đang áp, vd "Tháng 8/2026".
   *
   * Bắt buộc phải hiện khi con số bị giới hạn theo kỳ: không có nhãn thì cán bộ thấy 128 mà
   * không biết vì sao không phải 4.717, và kết luận hệ thống đếm sai.
   */
  periodLabel?: string | null;
}

function CardValue({ value, valueColorClass, loading }: { value: number | null; valueColorClass: string; loading: boolean }): ReactNode {
  if (loading || value === null) {
    return <div className="h-8 w-12 bg-slate-200 rounded animate-pulse mt-1" />;
  }
  return <p className={`text-2xl font-bold mt-1 ${valueColorClass}`}>{value}</p>;
}

function CardBody({ card, loading }: { card: StatCard; loading: boolean }): ReactNode {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-600">{card.label}</p>
        <CardValue value={card.value} valueColorClass={card.valueColorClass} loading={loading} />
      </div>
      <div className={`w-12 h-12 ${card.iconBgClass} rounded-lg flex items-center justify-center`}>
        <card.icon className={`w-6 h-6 ${card.iconColorClass}`} />
      </div>
    </div>
  );
}

export function StatsCardsStrip({
  cards,
  loading = false,
  className,
  activeValue,
  onCardSelect,
  periodLabel,
}: StatsCardsStripProps) {
  return (
    <div className={className ?? ''}>
      {periodLabel && (
        <p
          data-testid="stats-period-label"
          className="px-6 pt-4 text-xs font-medium text-slate-500"
        >
          Thống kê: <span className="text-slate-700">{periodLabel}</span>
        </p>
      )}
      <div className={`grid grid-cols-2 md:grid-cols-5 gap-4 px-6 py-4`}>
      {cards.map((card, i) => {
        const interactive = onCardSelect != null && 'filterValue' in card;
        if (!interactive) {
          return (
            <div key={card.filterValue ?? card.label ?? i} className={STATS_CARD}>
              <CardBody card={card} loading={loading} />
            </div>
          );
        }

        // Thẻ "Tổng" mang filterValue null nên tự sáng khi không lọc gì — không cần nhánh riêng.
        const isActive = (card.filterValue ?? null) === (activeValue ?? null);
        // Chặn bấm khi đang tải: lọc theo con số chưa tải xong là vô nghĩa.
        const blocked = isActive || loading;

        return (
          <button
            key={card.filterValue ?? card.label ?? i}
            type="button"
            // KHÔNG dùng thuộc tính `disabled`: trình duyệt sẽ vứt focus về <body> ngay khi
            // bấm và loại thẻ khỏi thứ tự Tab, khiến người dùng bàn phím mất dấu đang lọc gì.
            // aria-disabled giữ nguyên hành vi "không bấm được" mà không hỏng điều hướng.
            aria-disabled={blocked}
            aria-pressed={isActive}
            onClick={() => {
              if (blocked) return;
              onCardSelect(card.filterValue ?? null);
            }}
            className={[
              STATS_CARD,
              A11Y_FOCUS_RING,
              'text-left w-full transition-colors',
              isActive ? 'ring-2 ring-blue-500 border-blue-300' : 'hover:bg-slate-50',
              loading && !isActive ? 'cursor-default' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <CardBody card={card} loading={loading} />
          </button>
        );
      })}
      </div>
    </div>
  );
}
