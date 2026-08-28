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
  mApi.updateTemplate.mockResolvedValue({ id: 't9' } as never);
  mApi.replaceTemplateFile.mockResolvedValue({ id: 't9' } as never);
});

const EDIT_TPL = {
  id: 't9', code: 'QD_KT', name: 'QĐ khởi tố', entityType: 'VU_AN',
  category: 'Quyết định', fileName: 'qd.docx', fileSha: 'x',
  delimStart: '[[', delimEnd: ']]',
  variables: [{ name: 'tenVuAn', source: 'auto' as const, label: 'tenVuAn', field: 'tenVuAn' }],
  needsNumber: false, numberSeriesId: null, status: 'active', sortOrder: 0,
} as const;

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

  /**
   * Ô "Tích sẵn khi in" — quyết định mẫu có được tích sẵn ở popup In chứng từ không.
   * Thiếu một trong hai đường gửi (tạo / sửa) thì admin bấm lưu mà cột không đổi.
   */
  describe('ô "Tích sẵn khi in"', () => {
    it('tạo mới: mặc định TẮT và gửi kèm lên API', async () => {
      render(<TemplateFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
      fireEvent.change(screen.getByTestId('template-code-input'), { target: { value: 'C' } });
      fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'N' } });
      uploadFile();
      await waitFor(() => screen.getByTestId('var-row-Họ tên'));
      expect((screen.getByTestId('template-selected-by-default') as HTMLInputElement).checked).toBe(false);
      fireEvent.click(screen.getByTestId('btn-save-template'));
      await waitFor(() => expect(mApi.createTemplate).toHaveBeenCalled());
      const form = mApi.createTemplate.mock.calls[0][0] as FormData;
      expect(form.get('selectedByDefault')).toBe('false');
    });

    it('tạo mới: bật ô thì gửi `true`', async () => {
      render(<TemplateFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
      fireEvent.change(screen.getByTestId('template-code-input'), { target: { value: 'C' } });
      fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'N' } });
      uploadFile();
      await waitFor(() => screen.getByTestId('var-row-Họ tên'));
      fireEvent.click(screen.getByTestId('template-selected-by-default'));
      fireEvent.click(screen.getByTestId('btn-save-template'));
      await waitFor(() => expect(mApi.createTemplate).toHaveBeenCalled());
      expect((mApi.createTemplate.mock.calls[0][0] as FormData).get('selectedByDefault')).toBe('true');
    });

    it('sửa: đọc đúng giá trị đang có rồi gửi giá trị mới', async () => {
      render(
        <TemplateFormModal
          template={{ ...EDIT_TPL, selectedByDefault: true } as never}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
      expect((screen.getByTestId('template-selected-by-default') as HTMLInputElement).checked).toBe(true);
      fireEvent.click(screen.getByTestId('template-selected-by-default'));
      fireEvent.click(screen.getByTestId('btn-save-template'));
      await waitFor(() => expect(mApi.updateTemplate).toHaveBeenCalled());
      expect(mApi.updateTemplate.mock.calls[0][1]).toMatchObject({ selectedByDefault: false });
    });
  });

  describe('chế độ Sửa', () => {
    it('pre-fill + tiêu đề "Sửa"; mã + loại read-only; hiện mapping sẵn (không cần file)', () => {
      render(<TemplateFormModal template={EDIT_TPL as never} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(screen.getByText('Sửa mẫu chứng từ')).toBeInTheDocument();
      expect(screen.getByTestId('template-code-input')).toBeDisabled();
      expect(screen.getByTestId('template-name-input')).toHaveValue('QĐ khởi tố');
      expect(screen.getByTestId('template-entity-readonly')).toBeInTheDocument();
      expect(screen.queryByTestId('template-entity-select')).not.toBeInTheDocument();
      // mapping sẵn từ template (không cần upload)
      expect(screen.getByTestId('var-row-tenVuAn')).toBeInTheDocument();
    });

    it('lưu không file mới → updateTemplate(id, {variables,...}); KHÔNG replaceTemplateFile', async () => {
      const onSaved = vi.fn();
      render(<TemplateFormModal template={EDIT_TPL as never} onClose={vi.fn()} onSaved={onSaved} />);
      fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'Tên mới' } });
      fireEvent.click(screen.getByTestId('btn-save-template'));
      await waitFor(() => expect(mApi.updateTemplate).toHaveBeenCalled());
      expect(mApi.updateTemplate.mock.calls[0][0]).toBe('t9');
      expect(mApi.updateTemplate.mock.calls[0][1]).toMatchObject({ name: 'Tên mới' });
      expect(mApi.replaceTemplateFile).not.toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalled();
    });

    it('lưu có file mới → replaceTemplateFile THEN updateTemplate', async () => {
      render(<TemplateFormModal template={EDIT_TPL as never} onClose={vi.fn()} onSaved={vi.fn()} />);
      uploadFile();
      await waitFor(() => screen.getByTestId('var-row-Họ tên')); // detect lại file mới
      fireEvent.click(screen.getByTestId('btn-save-template'));
      await waitFor(() => expect(mApi.updateTemplate).toHaveBeenCalled());
      expect(mApi.replaceTemplateFile).toHaveBeenCalledWith('t9', expect.any(File));
    });
  });
});
