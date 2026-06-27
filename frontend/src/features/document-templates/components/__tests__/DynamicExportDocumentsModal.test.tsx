import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DynamicExportDocumentsModal } from '../DynamicExportDocumentsModal';
import { listExportTemplates, exportEntityDocuments, triggerDownload } from '../../export.api';
import type { DocumentTemplate } from '../../types';

vi.mock('../../export.api', async () => {
  const actual = await vi.importActual<typeof import('../../export.api')>('../../export.api');
  return {
    ...actual,
    listExportTemplates: vi.fn(),
    exportEntityDocuments: vi.fn(),
    triggerDownload: vi.fn(),
  };
});

const mList = vi.mocked(listExportTemplates);
const mExport = vi.mocked(exportEntityDocuments);
const mDownload = vi.mocked(triggerDownload);

function tpl(over: Partial<DocumentTemplate>): DocumentTemplate {
  return {
    id: 't1',
    code: 'QD01',
    name: 'Quyết định khởi tố',
    entityType: 'VU_AN',
    category: 'Quyết định',
    fileName: 'qd.docx',
    fileSha: 'sha',
    variables: [],
    needsNumber: false,
    numberSeriesId: null,
    status: 'active',
    sortOrder: 0,
    ...over,
  };
}

beforeEach(() => {
  mList.mockReset();
  mExport.mockReset();
  mDownload.mockReset();
});

describe('DynamicExportDocumentsModal', () => {
  it('fetch theo entityType + nhóm category + tick sẵn tất cả', async () => {
    mList.mockResolvedValue([
      tpl({ id: 't1', name: 'QĐ khởi tố', category: 'Quyết định' }),
      tpl({ id: 't2', name: 'Biên bản A', category: 'Biên bản' }),
    ]);
    render(
      <DynamicExportDocumentsModal entity="cases" entityId="c1" onClose={vi.fn()} />,
    );
    await waitFor(() => expect(mList).toHaveBeenCalledWith('cases'));
    expect(await screen.findByText('Quyết định')).toBeInTheDocument();
    expect(screen.getByText('Biên bản')).toBeInTheDocument();
    const cb1 = screen.getByTestId('dyn-export-checkbox-t1') as HTMLInputElement;
    const cb2 = screen.getByTestId('dyn-export-checkbox-t2') as HTMLInputElement;
    expect(cb1.checked).toBe(true);
    expect(cb2.checked).toBe(true);
  });

  it('hiện input biến nhập tay khi template đang chọn có biến manual; ẩn khi bỏ chọn', async () => {
    mList.mockResolvedValue([
      tpl({
        id: 't1',
        variables: [
          { name: 'soVanBan', source: 'manual', label: 'Số văn bản' },
          { name: 'caseCode', source: 'auto', label: 'Mã vụ án' },
        ],
      }),
    ]);
    render(
      <DynamicExportDocumentsModal entity="cases" entityId="c1" onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId('dyn-manual-soVanBan')).toBeInTheDocument();
    // biến auto không render input
    expect(screen.queryByTestId('dyn-manual-caseCode')).toBeNull();
    // bỏ chọn template → input manual biến mất
    fireEvent.click(screen.getByTestId('dyn-export-checkbox-t1'));
    expect(screen.queryByTestId('dyn-manual-soVanBan')).toBeNull();
  });

  it('Xuất file: gọi exportEntityDocuments đúng templateIds/mode/manualValues + triggerDownload + onClose', async () => {
    mList.mockResolvedValue([
      tpl({ id: 't1', variables: [{ name: 'soVanBan', source: 'manual', label: 'Số văn bản' }] }),
    ]);
    mExport.mockResolvedValue({ data: new Blob(), headers: {} } as never);
    const onClose = vi.fn();
    render(
      <DynamicExportDocumentsModal entity="cases" entityId="c1" onClose={onClose} />,
    );
    const input = await screen.findByTestId('dyn-manual-soVanBan');
    fireEvent.change(input, { target: { value: '42/QD' } });
    fireEvent.click(screen.getByTestId('dyn-export-confirm'));
    await waitFor(() =>
      expect(mExport).toHaveBeenCalledWith('cases', 'c1', {
        templateIds: ['t1'],
        mode: 'merged',
        manualValues: { soVanBan: '42/QD' },
      }),
    );
    await waitFor(() => expect(mDownload).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('không có mẫu → thông báo trống', async () => {
    mList.mockResolvedValue([]);
    render(
      <DynamicExportDocumentsModal entity="incidents" entityId="i1" onClose={vi.fn()} />,
    );
    expect(await screen.findByText(/Chưa có mẫu chứng từ/i)).toBeInTheDocument();
  });
});
