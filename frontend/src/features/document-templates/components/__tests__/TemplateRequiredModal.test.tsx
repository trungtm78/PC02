import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplateRequiredModal } from '../TemplateRequiredModal';
import { api } from '@/lib/api';
import type { DocumentTemplate } from '../../types';

// Mock lớp HTTP (giữ updateTemplate thật) — pattern giống ExportDocumentsModal, tránh
// unhandled-rejection flag khi mock cả module feature.
vi.mock('@/lib/api', () => ({ api: { patch: vi.fn() } }));
const mPatch = vi.mocked(api.patch);

function tpl(): DocumentTemplate {
  return {
    id: 't1', code: 'QD', name: 'Quyết định', entityType: 'VU_AN', category: 'Quyết định',
    fileName: 'a.docx', fileSha: 'sha', needsNumber: false, selectedByDefault: false, numberSeriesId: null, status: 'active', sortOrder: 0,
    variables: [
      { name: 'tenVuAn', source: 'auto', label: 'Tên vụ án', required: true },
      { name: 'toiDanh', source: 'auto', label: 'Tội danh', required: false },
      { name: 'dieuLuat', source: 'manual', label: 'Điều luật' },
    ],
  };
}

beforeEach(() => mPatch.mockReset());

describe('TemplateRequiredModal', () => {
  it('prefill required từ template + toggle + lưu gửi requiredVariables', async () => {
    mPatch.mockResolvedValue({ data: tpl() } as never);
    const onSaved = vi.fn();
    render(<TemplateRequiredModal template={tpl()} onClose={vi.fn()} onSaved={onSaved} />);

    const tenVuAn = screen.getByTestId('template-required-tenVuAn') as HTMLInputElement;
    const toiDanh = screen.getByTestId('template-required-toiDanh') as HTMLInputElement;
    expect(tenVuAn.checked).toBe(true);   // required:true → prefill
    expect(toiDanh.checked).toBe(false);

    fireEvent.click(toiDanh);              // bật toiDanh
    fireEvent.click(tenVuAn);              // tắt tenVuAn
    fireEvent.click(screen.getByTestId('template-required-save'));

    await waitFor(() =>
      expect(mPatch).toHaveBeenCalledWith('/document-templates/t1', { requiredVariables: ['toiDanh'] }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('hiện nhãn nguồn biến (auto/nhập tay); mẫu không biến → báo trống', () => {
    render(<TemplateRequiredModal template={tpl()} onClose={vi.fn()} onSaved={vi.fn()} />);
    // auto → "tự điền từ hồ sơ"; manual → "nhập tay khi in".
    expect(screen.getByText(/tenVuAn · tự điền từ hồ sơ/)).toBeInTheDocument();
    expect(screen.getByText(/dieuLuat · nhập tay khi in/)).toBeInTheDocument();

    const empty = { ...tpl(), variables: [] };
    render(<TemplateRequiredModal template={empty} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getAllByTestId('template-required-empty').length).toBeGreaterThan(0);
  });
});
