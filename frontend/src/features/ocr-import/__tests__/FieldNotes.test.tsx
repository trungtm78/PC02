import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

const notes = (applied: AppliedPatch[]) => buildFieldNotes({ applied, pageNumbers: { p1: 1, p2: 2 } });

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

  it('asks for nothing, even for a field the system was not sure of: the officer simply corrects what is wrong', () => {
    render(<div>{notes([patch('senderIdNumber', { orange: true })]).senderIdNumber}</div>);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Cần xác nhận')).toBeNull();
    expect(screen.queryByText('Đã xác nhận')).toBeNull();
    expect(screen.getByTestId('ocr-note-senderIdNumber').className).not.toMatch(/orange/);
  });

  it('says plainly when the value is the system\'s inference and not in the document', () => {
    render(
      <div>
        {notes([patch('toiDanhBanDau', { provenance: { claimKind: 'INFERRED', pageId: null, quote: null } })]).toiDanhBanDau}
      </div>,
    );
    expect(screen.getByText('Hệ thống suy ra, không có trong đơn')).toBeTruthy();
  });
});
