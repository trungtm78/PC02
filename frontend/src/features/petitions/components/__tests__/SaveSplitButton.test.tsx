import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveSplitButton } from '../SaveSplitButton';

describe('SaveSplitButton', () => {
  it('bấm nút chính → onSave (không gọi onSaveAndExport)', () => {
    const onSave = vi.fn();
    const onSaveAndExport = vi.fn();
    render(
      <SaveSplitButton
        onSave={onSave}
        onSaveAndExport={onSaveAndExport}
        isSubmitting={false}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-save-split-main'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSaveAndExport).not.toHaveBeenCalled();
  });

  it('mở menu ▼ → "Lưu và xuất file" → onSaveAndExport (không gọi onSave)', () => {
    const onSave = vi.fn();
    const onSaveAndExport = vi.fn();
    render(
      <SaveSplitButton
        onSave={onSave}
        onSaveAndExport={onSaveAndExport}
        isSubmitting={false}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-save-split-caret'));
    fireEvent.click(screen.getByTestId('menu-item-save-export'));
    expect(onSaveAndExport).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('isSubmitting → nút chính disabled', () => {
    render(
      <SaveSplitButton
        onSave={vi.fn()}
        onSaveAndExport={vi.fn()}
        isSubmitting={true}
      />,
    );
    expect(screen.getByTestId('btn-save-split-main')).toBeDisabled();
  });

  it('hiện label tuỳ biến', () => {
    render(
      <SaveSplitButton
        onSave={vi.fn()}
        onSaveAndExport={vi.fn()}
        isSubmitting={false}
        label="Cập nhật"
      />,
    );
    expect(screen.getByTestId('btn-save-split-main')).toHaveTextContent('Cập nhật');
  });
});
