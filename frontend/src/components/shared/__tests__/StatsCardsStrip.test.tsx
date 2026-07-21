import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileText, Clock } from 'lucide-react';
import { StatsCardsStrip, type StatCard } from '../StatsCardsStrip';

const CARDS: StatCard[] = [
  { label: 'Tổng', value: 42, icon: FileText, iconBgClass: 'bg-blue-100', iconColorClass: 'text-blue-600', valueColorClass: 'text-blue-600' },
  { label: 'Mở', value: 10, icon: Clock, iconBgClass: 'bg-amber-100', iconColorClass: 'text-amber-600', valueColorClass: 'text-amber-600' },
  { label: 'Đóng', value: 32, icon: FileText, iconBgClass: 'bg-green-100', iconColorClass: 'text-green-600', valueColorClass: 'text-green-600' },
];

describe('<StatsCardsStrip>', () => {
  it('renders all card labels and values', () => {
    render(<StatsCardsStrip cards={CARDS} />);
    expect(screen.getByText('Tổng')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Mở')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Đóng')).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
  });

  it('shows skeleton when loading=true', () => {
    const { container } = render(<StatsCardsStrip cards={CARDS} loading />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(CARDS.length);
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  it('shows skeleton for cards with null value', () => {
    const nullCards: StatCard[] = [
      { label: 'Loading...', value: null, icon: FileText, iconBgClass: 'bg-blue-100', iconColorClass: 'text-blue-600', valueColorClass: 'text-blue-600' },
    ];
    const { container } = render(<StatsCardsStrip cards={nullCards} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });
});

/**
 * Drill-down: bấm thẻ để lọc danh sách. Chỉ bật khi trang truyền `onCardSelect`
 * VÀ thẻ có `filterValue` — 16+ trang khác đang dùng component này phải không đổi gì.
 */
describe('<StatsCardsStrip> — drill-down', () => {
  const DRILL: StatCard[] = [
    { ...CARDS[0], filterValue: null },          // thẻ "Tổng"
    { ...CARDS[1], filterValue: 'dang-xu-ly' },
    { ...CARDS[2], filterValue: 'da-giai-quyet' },
  ];

  it('KHÔNG truyền onCardSelect → vẫn render <div>, không có button (khoá hợp đồng 16 trang kia)', () => {
    const { container } = render(<StatsCardsStrip cards={DRILL} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('có onCardSelect → mỗi thẻ là <button>, bấm gọi đúng filterValue', () => {
    const onCardSelect = vi.fn();
    render(<StatsCardsStrip cards={DRILL} activeValue={null} onCardSelect={onCardSelect} />);
    fireEvent.click(screen.getByText('Mở'));
    expect(onCardSelect).toHaveBeenCalledWith('dang-xu-ly');
  });

  it('thẻ "Tổng" (filterValue null) bấm được để bỏ lọc', () => {
    const onCardSelect = vi.fn();
    render(<StatsCardsStrip cards={DRILL} activeValue="dang-xu-ly" onCardSelect={onCardSelect} />);
    fireEvent.click(screen.getByText('Tổng'));
    expect(onCardSelect).toHaveBeenCalledWith(null);
  });

  /** Anh chốt: thẻ đang chọn thì KHÔNG bấm được nữa. */
  it('thẻ ĐANG CHỌN: aria-pressed + aria-disabled, và bấm KHÔNG gọi onCardSelect', () => {
    const onCardSelect = vi.fn();
    render(<StatsCardsStrip cards={DRILL} activeValue="dang-xu-ly" onCardSelect={onCardSelect} />);
    const active = screen.getByText('Mở').closest('button')!;
    expect(active).toHaveAttribute('aria-pressed', 'true');
    expect(active).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(active);
    expect(onCardSelect).not.toHaveBeenCalled();
  });

  /**
   * Dùng aria-disabled chứ KHÔNG dùng thuộc tính disabled thật: `disabled` khiến trình
   * duyệt vứt focus về body ngay khi bấm và loại thẻ khỏi thứ tự Tab → người dùng bàn
   * phím mất dấu hoàn toàn.
   */
  it('thẻ đang chọn VẪN focus được bằng bàn phím (không dùng thuộc tính disabled)', () => {
    render(<StatsCardsStrip cards={DRILL} activeValue="dang-xu-ly" onCardSelect={vi.fn()} />);
    const active = screen.getByText('Mở').closest('button')!;
    expect(active).not.toBeDisabled();
    active.focus();
    expect(active).toHaveFocus();
  });

  it('không lọc gì → thẻ "Tổng" tự sáng (không cần nhánh đặc biệt)', () => {
    render(<StatsCardsStrip cards={DRILL} activeValue={null} onCardSelect={vi.fn()} />);
    expect(screen.getByText('Tổng').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Mở').closest('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('đang loading → không bấm được (tránh lọc theo số chưa tải xong)', () => {
    const onCardSelect = vi.fn();
    render(<StatsCardsStrip cards={DRILL} loading activeValue={null} onCardSelect={onCardSelect} />);
    fireEvent.click(screen.getByText('Mở'));
    expect(onCardSelect).not.toHaveBeenCalled();
  });

  /** CaseListPageShell.test.tsx:110 đếm đúng 11 role="tab"; :117 dùng getByRole('tablist') số ít. */
  it('KHÔNG phần tử nào mang role tab/tablist (sẽ phá test của trang Vụ án)', () => {
    render(<StatsCardsStrip cards={DRILL} activeValue={null} onCardSelect={vi.fn()} />);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryAllByRole('tablist')).toHaveLength(0);
  });
});
