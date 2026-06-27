import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as apiMod from '../../api';
import { TemplateFormModal } from '../TemplateFormModal';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(apiMod, 'createTemplate').mockResolvedValue({ id: 't1' } as never);
});

describe('TemplateFormModal', () => {
  it('hiện form: chọn entity/category + input file + code/name', () => {
    render(<TemplateFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByTestId('template-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('template-entity-select')).toBeInTheDocument();
    expect(screen.getByTestId('template-category-select')).toBeInTheDocument();
    expect(screen.getByTestId('template-file-input')).toBeInTheDocument();
  });

  it('submit hợp lệ → gọi createTemplate (FormData) + onSaved', async () => {
    const onSaved = vi.fn();
    render(<TemplateFormModal onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.change(screen.getByTestId('template-code-input'), { target: { value: 'QD-KTVA' } });
    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'QĐ khởi tố' } });
    const file = new File(['x'], 'a.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    fireEvent.change(screen.getByTestId('template-file-input'), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId('btn-save-template'));
    await waitFor(() => expect(apiMod.createTemplate).toHaveBeenCalled());
    expect(apiMod.createTemplate).toHaveBeenCalledWith(expect.any(FormData));
    expect(onSaved).toHaveBeenCalled();
  });

  it('thiếu file → [Lưu] disabled (không submit)', () => {
    render(<TemplateFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByTestId('template-code-input'), { target: { value: 'C' } });
    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'N' } });
    expect(screen.getByTestId('btn-save-template')).toBeDisabled();
  });
});
