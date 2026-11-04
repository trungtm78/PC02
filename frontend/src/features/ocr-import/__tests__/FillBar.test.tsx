import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FillBar, type FillBarProps } from '../FillBar';
import type { AppliedPatch, SkippedFill } from '../fillPlan';

const patch = (field: string, orange = false): AppliedPatch => ({
  field,
  before: '',
  value: 'v',
  orange,
  provenance: { claimKind: 'QUOTED', pageId: null, quote: null },
  warnings: [],
});

const skipped = (field: string): SkippedFill => ({
  field,
  value: 'từ ảnh',
  reason: 'TYPED_BY_OFFICER',
  current: 'gõ tay',
  fill: {
    field,
    value: 'từ ảnh',
    policy: 'AI_FILL',
    provenance: { claimKind: 'QUOTED', pageId: null, quote: null },
    warnings: [],
  },
});

const props = (over: Partial<FillBarProps> = {}): FillBarProps => ({
  applied: [patch('a'), patch('b', true), patch('c', true)],
  skipped: [],
  captionOf: (field) => `Nhãn ${field}`,
  onOpenDrawer: vi.fn(),
  onTakeSkipped: vi.fn(),
  onUndo: vi.fn(),
  ...over,
});

describe('FillBar', () => {
  it('opens the drawer from its button even before anything was filled', () => {
    const p = props({ applied: [] });
    render(<FillBar {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nhập từ ảnh scan' }));
    expect(p.onOpenDrawer).toHaveBeenCalled();
    expect(screen.queryByText(/Đã điền/)).toBeNull();
  });

  it('counts the fields filled from the scans, with nothing left waiting', () => {
    render(<FillBar {...props()} />);
    expect(screen.getByText('Đã điền 3 ô từ ảnh')).toBeTruthy();
    expect(screen.queryByText(/cần xác nhận/)).toBeNull();
  });

  it('has no Confirm button at all, not even for the fields the system was not sure of', () => {
    render(<FillBar {...props()} />);
    expect(screen.queryByRole('button', { name: 'Xác nhận' })).toBeNull();
    expect(screen.queryByRole('button', { name: /tất cả/i })).toBeNull();
  });

  it('offers the image value for a field the officer had typed in, and keeps their text by default', () => {
    const p = props({ skipped: [skipped('a')] });
    render(<FillBar {...p} />);
    expect(screen.getByText('Nhãn a')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dùng giá trị từ ảnh' }));
    expect(p.onTakeSkipped).toHaveBeenCalledWith('a');
  });

  it('undoes the filling', () => {
    const p = props();
    render(<FillBar {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác phần điền từ ảnh' }));
    expect(p.onUndo).toHaveBeenCalled();
  });

  it('says which fields were kept because the officer changed them after the fill', () => {
    render(<FillBar {...props({ undoConflicts: ['a', 'b'] })} />);
    expect(screen.getByText(/Giữ nguyên các ô anh\/chị đã sửa sau khi điền: Nhãn a, Nhãn b/)).toBeTruthy();
  });
});
