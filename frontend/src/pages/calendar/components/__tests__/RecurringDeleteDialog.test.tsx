import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecurringDeleteDialog } from '../RecurringDeleteDialog';

/**
 * v0.21.7.0 — RecurringDeleteDialog phải hiển thị extended context
 * (description, category, scope, time) khi anh click event ở sidebar.
 *
 * Tests cover both happy path (full data) và graceful degradation
 * (legacy events thiếu fields → render conditional).
 */

const minimalProps = {
  isOpen: true,
  onClose: vi.fn(),
  eventId: 'ev-1',
  occurrenceDate: '2026-05-19',
  eventTitle: 'Ngày sinh Chủ tịch Hồ Chí Minh',
  isRecurring: true,
};

describe('RecurringDeleteDialog — extended context (v0.21.7.0)', () => {
  it('renders category badge khi categoryName provided', () => {
    render(
      <RecurringDeleteDialog
        {...minimalProps}
        categoryName="Quốc gia"
        categoryColor="#dc2626"
      />,
    );
    expect(screen.getByText('Quốc gia')).toBeInTheDocument();
  });

  it('omits category badge khi categoryName missing', () => {
    render(<RecurringDeleteDialog {...minimalProps} />);
    expect(screen.queryByText('Quốc gia')).not.toBeInTheDocument();
  });

  it('renders scope label "Toàn cơ quan" cho SYSTEM scope', () => {
    render(<RecurringDeleteDialog {...minimalProps} scope="SYSTEM" />);
    expect(screen.getByText(/Toàn cơ quan/)).toBeInTheDocument();
  });

  it('renders scope label "Cấp tổ" cho TEAM scope', () => {
    render(<RecurringDeleteDialog {...minimalProps} scope="TEAM" />);
    expect(screen.getByText(/Cấp tổ/)).toBeInTheDocument();
  });

  it('renders scope label "Cá nhân" cho PERSONAL scope', () => {
    render(<RecurringDeleteDialog {...minimalProps} scope="PERSONAL" />);
    expect(screen.getByText(/Cá nhân/)).toBeInTheDocument();
  });

  it('omits scope label khi scope undefined (legacy event)', () => {
    render(<RecurringDeleteDialog {...minimalProps} />);
    expect(screen.queryByText(/Toàn cơ quan/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cấp tổ/)).not.toBeInTheDocument();
  });

  it('renders description khi provided', () => {
    render(
      <RecurringDeleteDialog
        {...minimalProps}
        description="Chủ tịch Hồ Chí Minh (1890-1969) sinh tại làng Hoàng Trù."
      />,
    );
    expect(
      screen.getByText(/Chủ tịch Hồ Chí Minh \(1890-1969\)/),
    ).toBeInTheDocument();
  });

  it('omits description khi missing', () => {
    render(<RecurringDeleteDialog {...minimalProps} />);
    expect(screen.queryByText(/Mô tả/)).not.toBeInTheDocument();
  });

  it('renders time range khi !allDay với startTime + endTime', () => {
    render(
      <RecurringDeleteDialog
        {...minimalProps}
        allDay={false}
        startTime="08:30"
        endTime="10:00"
      />,
    );
    expect(screen.getByText(/08:30/)).toBeInTheDocument();
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });

  it('renders single time khi !allDay với chỉ startTime', () => {
    render(
      <RecurringDeleteDialog
        {...minimalProps}
        allDay={false}
        startTime="14:00"
      />,
    );
    expect(screen.getByText(/14:00/)).toBeInTheDocument();
  });

  it('omits time line khi allDay=true', () => {
    render(
      <RecurringDeleteDialog
        {...minimalProps}
        allDay={true}
        startTime="08:30"
      />,
    );
    // Time should NOT appear since allDay forces hiding the HH:MM
    expect(screen.queryByText('08:30')).not.toBeInTheDocument();
  });
});
