import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentBuilder } from '../SegmentBuilder';
import type { TemplateSegment } from '../../types';

const baseSegments: TemplateSegment[] = [
  { type: 'LITERAL', value: 'VV' },
  { type: 'FORMULA', fn: 'FORMAT', source: 'NOW', pattern: 'YYYY' },
  { type: 'COUNTER' },
];

describe('SegmentBuilder', () => {
  it('renders all existing segments', () => {
    render(<SegmentBuilder segments={baseSegments} onChange={vi.fn()} />);
    expect(screen.getAllByTestId(/^segment-row-/)).toHaveLength(3);
  });

  it('shows segment type badges', () => {
    render(<SegmentBuilder segments={baseSegments} onChange={vi.fn()} />);
    expect(screen.getByText('Văn bản cố định')).toBeInTheDocument();
    expect(screen.getByText('Công thức')).toBeInTheDocument();
    expect(screen.getByText('Số tự tăng')).toBeInTheDocument();
  });

  it('calls onChange with new segment when "Thêm đoạn" LITERAL is clicked', () => {
    const onChange = vi.fn();
    render(<SegmentBuilder segments={[]} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('add-literal-btn'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'LITERAL' }),
    ]);
  });

  it('calls onChange with FORMULA segment when add formula is clicked', () => {
    const onChange = vi.fn();
    render(<SegmentBuilder segments={[]} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('add-formula-btn'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'FORMULA' }),
    ]);
  });

  it('removes segment when delete button is clicked', () => {
    const onChange = vi.fn();
    render(<SegmentBuilder segments={baseSegments} onChange={onChange} />);

    fireEvent.click(screen.getAllByTestId('segment-remove-btn')[0]);

    const newSegments = onChange.mock.calls[0][0] as TemplateSegment[];
    expect(newSegments).toHaveLength(2);
    expect(newSegments[0].type).toBe('FORMULA');
  });

  it('shows preview bar with separator-joined values', () => {
    render(
      <SegmentBuilder segments={baseSegments} onChange={vi.fn()} separator="-" />,
    );
    expect(screen.getByTestId('segment-preview-bar')).toBeInTheDocument();
  });
});
