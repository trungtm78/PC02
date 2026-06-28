import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as api from '../../api';
import { TemplateFormModal } from '../TemplateFormModal';

vi.mock('../../api');
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    listTemplates: vi.fn().mockResolvedValue([{ id: 's1', name: 'Số vụ án', documentType: 'CASE' }]),
  },
}));

const mApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
  mApi.getFieldCatalog.mockResolvedValue([
    { key: 'ghiTen', label: 'Họ tên người gửi', group: 'Người gửi' },
  ]);
  mApi.detectVariables.mockResolvedValue({
    detected: ['Họ tên', 'Ghi chú'],
    suggested: [
      { name: 'Họ tên', source: 'manual', label: 'Họ tên' },
      { name: 'Ghi chú', source: 'manual', label: 'Ghi chú' },
    ],
  });
  mApi.createTemplate.mockResolvedValue({ id: 't1' } as never);
});

function uploadFile() {
  const file = new File(['docx'], 'mau.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  fireEvent.change(screen.getByTestId('template-file-input'), { target: { files: [file] } });
}

describe('TemplateFormModal', () => {
  it('hiện form cơ bản + delimiter picker', () => {
    render(<TemplateFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByTestId('template-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('template-entity-select')).toBeInTheDocument();
    expect(screen.getByTestId('template-delim-preset')).toBeInTheDocument();
    expect(screen.getByTestId('template-file-input')).toBeInTheDocument();
  });

  it('upload → detect → hiện hàng map biến', async () => {
    render(<TemplateFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    uploadFile();
    await waitFor(() => expect(screen.getByTestId('var-row-Họ tên')).toBeInTheDocument());
    expect(screen.getByTestId('var-row-Ghi chú')).toBeInTheDocument();
    expect(mApi.detectVariables).toHaveBeenCalled();
  });

  it('chọn "Tự điền" → hiện dropdown field từ catalog', async () => {
    render(<TemplateFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    uploadFile();
    await waitFor(() => screen.getByTestId('var-source-Họ tên'));
    fireEvent.change(screen.getByTestId('var-source-Họ tên'), { target: { value: 'auto' } });
    expect(await screen.findByTestId('var-field-Họ tên')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Họ tên người gửi' })).toBeInTheDocument();
  });

  it('auto chưa chọn field → [Lưu] disabled', async () => {
    render(<TemplateFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByTestId('template-code-input'), { target: { value: 'C' } });
    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'N' } });
    uploadFile();
    await waitFor(() => screen.getByTestId('var-source-Họ tên'));
    fireEvent.change(screen.getByTestId('var-source-Họ tên'), { target: { value: 'auto' } });
    await screen.findByTestId('var-field-Họ tên');
    expect(screen.getByTestId('btn-save-template')).toBeDisabled();
  });

  it('lưu: FormData có variables + delimStart/delimEnd; onSaved gọi', async () => {
    const onSaved = vi.fn();
    render(<TemplateFormModal onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.change(screen.getByTestId('template-code-input'), { target: { value: 'C' } });
    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'N' } });
    fireEvent.change(screen.getByTestId('template-delim-preset'), { target: { value: '2' } }); // [[ ]]
    uploadFile();
    await waitFor(() => screen.getByTestId('var-source-Họ tên'));
    fireEvent.change(screen.getByTestId('var-source-Họ tên'), { target: { value: 'auto' } });
    await screen.findByTestId('var-field-Họ tên');
    fireEvent.change(screen.getByTestId('var-field-Họ tên'), { target: { value: 'ghiTen' } });
    fireEvent.click(screen.getByTestId('btn-save-template'));
    await waitFor(() => expect(mApi.createTemplate).toHaveBeenCalled());
    const form = mApi.createTemplate.mock.calls[0][0] as FormData;
    expect(form.get('delimStart')).toBe('[[');
    expect(form.get('delimEnd')).toBe(']]');
    const vars = JSON.parse(form.get('variables') as string);
    expect(vars.find((v: { name: string }) => v.name === 'Họ tên')).toMatchObject({
      source: 'auto',
      field: 'ghiTen',
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('bật "Cấp số" chưa chọn chuỗi → [Lưu] disabled', async () => {
    render(<TemplateFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByTestId('template-code-input'), { target: { value: 'C' } });
    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'N' } });
    uploadFile();
    await waitFor(() => screen.getByTestId('var-row-Họ tên'));
    fireEvent.click(screen.getByTestId('template-needs-number'));
    expect(await screen.findByTestId('template-number-series')).toBeInTheDocument();
    expect(screen.getByTestId('btn-save-template')).toBeDisabled();
  });
});
