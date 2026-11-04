import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AppliedPatch } from '../fillPlan';
import { buildFieldNotes } from '../FieldNotes';

const patch = (field: string, extra: Partial<AppliedPatch> = {}): AppliedPatch => ({
  field,
  before: '',
  value: 'giá trị',
  orange: false,
  provenance: { claimKind: 'QUOTED', pageId: 'p2', quote: 'Tôi tên là Nguyễn Thị Hương' },
  warnings: [],
  ...extra,
});

const notes = (
  applied: AppliedPatch[],
  confirmed: string[] = [],
  onConfirm = vi.fn(),
) =>
  buildFieldNotes({
    applied,
    confirmed: new Set(confirmed),
    pageNumbers: { p1: 1, p2: 2 },
    onConfirm,
  });

describe('buildFieldNotes', () => {
  it('makes a note for each field that was filled, keyed by field', () => {
    const result = notes([patch('senderName'), patch('senderPhone')]);
    expect(Object.keys(result).sort()).toEqual(['senderName', 'senderPhone']);
  });

  it('shows where the value came from: badge, page number and the quoted words', () => {
    render(<div>{notes([patch('senderName')]).senderName}</div>);
    expect(screen.getByText('Từ ảnh')).toBeTruthy();
    expect(screen.getByText(/trang 2/)).toBeTruthy();
    expect(screen.getByText(/Tôi tên là Nguyễn Thị Hương/)).toBeTruthy();
  });

  it('an orange field offers Confirm, and pressing it reports which field', () => {
    const onConfirm = vi.fn();
    render(<div>{notes([patch('senderIdNumber', { orange: true })], [], onConfirm).senderIdNumber}</div>);
    expect(screen.getByText('Cần xác nhận')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(onConfirm).toHaveBeenCalledWith('senderIdNumber');
  });

  it('a confirmed orange field no longer asks, and says it was confirmed', () => {
    render(
      <div>{notes([patch('senderIdNumber', { orange: true })], ['senderIdNumber']).senderIdNumber}</div>,
    );
    expect(screen.queryByRole('button', { name: 'Xác nhận' })).toBeNull();
    expect(screen.getByText('Đã xác nhận')).toBeTruthy();
  });

  it('says plainly when the value is the system\'s inference and not in the document', () => {
    render(
      <div>
        {notes([patch('toiDanhBanDau', { provenance: { claimKind: 'INFERRED', pageId: null, quote: null } })]).toiDanhBanDau}
      </div>,
    );
    expect(screen.getByText('Hệ thống suy ra, không có trong đơn')).toBeTruthy();
  });

  it('a plain field has no Confirm button', () => {
    render(<div>{notes([patch('senderPhone')]).senderPhone}</div>);
    expect(screen.queryByRole('button', { name: 'Xác nhận' })).toBeNull();
  });
});
