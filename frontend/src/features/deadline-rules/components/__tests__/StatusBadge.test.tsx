import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders each of the 6 workflow statuses with Vietnamese label', () => {
    const cases = [
      { status: 'draft' as const, label: 'Bản nháp' },
      { status: 'submitted' as const, label: 'Chờ duyệt' },
      { status: 'approved' as const, label: 'Đã duyệt (chờ hiệu lực)' },
      { status: 'active' as const, label: 'Đang hiệu lực' },
      { status: 'superseded' as const, label: 'Đã thay thế' },
      { status: 'rejected' as const, label: 'Bị từ chối' },
    ];
    for (const c of cases) {
      const { unmount } = render(<StatusBadge status={c.status} />);
      expect(screen.getByText(c.label)).toBeInTheDocument();
      expect(screen.getByTestId(`status-badge-${c.status}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders needs-documentation virtual sub-status when migrationConfidence is set', () => {
    render(<StatusBadge status="active" needsDocumentation />);
    expect(screen.getByText('Cần bổ sung tài liệu')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge-needs-doc')).toBeInTheDocument();
  });

  it('uses correct Tailwind tone per status (defense vs accidental palette changes)', () => {
    const { container, rerender } = render(<StatusBadge status="active" />);
    expect(container.querySelector('.bg-green-100')).toBeTruthy();
    rerender(<StatusBadge status="submitted" />);
    expect(container.querySelector('.bg-blue-100')).toBeTruthy();
    rerender(<StatusBadge status="rejected" />);
    expect(container.querySelector('.bg-red-100')).toBeTruthy();
  });
});
