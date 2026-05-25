import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocNumberPreviewField } from '../DocNumberPreviewField';

describe('DocNumberPreviewField', () => {
  describe('AUTO mode', () => {
    it('renders the generated number in a readonly display', () => {
      render(
        <DocNumberPreviewField
          inputMode="AUTO"
          value="VV-2026-00043"
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId('docnum-preview-value')).toHaveTextContent('VV-2026-00043');
    });

    it('shows "Tự động" badge', () => {
      render(
        <DocNumberPreviewField
          inputMode="AUTO"
          value="VV-2026-00043"
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId('docnum-auto-badge')).toBeInTheDocument();
      expect(screen.getByTestId('docnum-auto-badge')).toHaveTextContent('Tự động');
    });

    it('does NOT render a text input', () => {
      render(
        <DocNumberPreviewField
          inputMode="AUTO"
          value="VV-2026-00043"
          onChange={vi.fn()}
        />,
      );
      expect(screen.queryByRole('textbox')).toBeNull();
    });
  });

  describe('MANUAL mode', () => {
    it('renders a text input with the current value', () => {
      render(
        <DocNumberPreviewField
          inputMode="MANUAL"
          value="DT-2026-00012"
          onChange={vi.fn()}
        />,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('DT-2026-00012');
    });

    it('calls onChange when user types', () => {
      const onChange = vi.fn();
      render(
        <DocNumberPreviewField inputMode="MANUAL" value="" onChange={onChange} />,
      );
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'DT-2026-00099' } });
      expect(onChange).toHaveBeenCalledWith('DT-2026-00099');
    });

    it('does NOT show the "Tự động" badge', () => {
      render(
        <DocNumberPreviewField inputMode="MANUAL" value="X" onChange={vi.fn()} />,
      );
      expect(screen.queryByTestId('docnum-auto-badge')).toBeNull();
    });
  });

  describe('AUTO_WITH_OVERRIDE mode', () => {
    it('initially shows the auto display with badge', () => {
      render(
        <DocNumberPreviewField
          inputMode="AUTO_WITH_OVERRIDE"
          value="VC-2026-001"
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId('docnum-preview-value')).toHaveTextContent('VC-2026-001');
      expect(screen.getByTestId('docnum-auto-badge')).toBeInTheDocument();
    });

    it('shows "Nhập tay" unlock button in default state', () => {
      render(
        <DocNumberPreviewField
          inputMode="AUTO_WITH_OVERRIDE"
          value="VC-2026-001"
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId('docnum-override-btn')).toBeInTheDocument();
    });

    it('switches to editable input after clicking override button', () => {
      render(
        <DocNumberPreviewField
          inputMode="AUTO_WITH_OVERRIDE"
          value="VC-2026-001"
          onChange={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByTestId('docnum-override-btn'));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.queryByTestId('docnum-auto-badge')).toBeNull();
    });

    it('calls onChange when editing after unlock', () => {
      const onChange = vi.fn();
      render(
        <DocNumberPreviewField
          inputMode="AUTO_WITH_OVERRIDE"
          value="VC-2026-001"
          onChange={onChange}
        />,
      );
      fireEvent.click(screen.getByTestId('docnum-override-btn'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'VC-MANUAL' } });
      expect(onChange).toHaveBeenCalledWith('VC-MANUAL');
    });
  });
});
