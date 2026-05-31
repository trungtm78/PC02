import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
