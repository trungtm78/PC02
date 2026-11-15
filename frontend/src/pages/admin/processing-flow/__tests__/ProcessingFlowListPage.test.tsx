import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProcessingFlowListPage from '../ProcessingFlowListPage';
import { processingFlowApi } from '@/features/processing-flow/api';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { apiError, boundType, detail, summary } from '@/features/processing-flow/__tests__/fixtures';

vi.mock('@/features/processing-flow/api', () => ({
  processingFlowApi: {
    list: vi.fn(),
    templates: vi.fn(),
    create: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    remove: vi.fn(),
  },
}));
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

const api = vi.mocked(processingFlowApi);

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}
function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/quy-trinh']}>
        <Routes>
          <Route path="/admin/quy-trinh" element={<ProcessingFlowListPage />} />
          <Route path="/admin/quy-trinh/:id" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const FLOWS = [
  summary({ id: 'p1', name: 'Khiếu nại', isDefault: true, boundTypes: [boundType('Khiếu nại')], publishedVersionNo: 2, draftVersionNo: 3 }),
  summary({ id: 'p2', name: 'Tố cáo', boundTypes: [boundType('Tố cáo'), boundType('Tố cáo nặc danh'), boundType('Tố cáo lại')], boundGroups: ['TO_CAO'], stepCount: 5, publishedVersionNo: 4 }),
  summary({ id: 'p3', name: 'Kiến nghị cũ', status: 'ARCHIVED', publishedVersionNo: 1, revision: 9 }),
  summary({ id: 'i1', name: 'Tố giác', recordKind: 'INCIDENT', publishedVersionNo: null, draftVersionNo: 1, revision: 2 }),
  summary({ id: 'c1', name: 'Điều tra', recordKind: 'CASE' }),
];

beforeEach(() => {
  vi.resetAllMocks();
  held.value = null;
  api.list.mockResolvedValue(FLOWS);
  api.templates.mockResolvedValue([
    { key: 'INCIDENT_CRIME_REPORT', recordKind: 'INCIDENT', name: 'Tố giác, tin báo về tội phạm', steps: [{}] },
    { key: 'CASE_INVESTIGATION', recordKind: 'CASE', name: 'Điều tra vụ án hình sự', steps: [{}, {}] },
  ]);
});

describe('the flow list', () => {
  it('has a tab per record kind with the number of flows it holds, opening on the petitions', async () => {
    renderPage();
    await screen.findByTestId('flow-name-p1');
    expect(screen.getByTestId('flow-kind-PETITION')).toHaveTextContent('Đơn thư (3)');
    expect(screen.getByTestId('flow-kind-INCIDENT')).toHaveTextContent('Vụ việc (1)');
    expect(screen.getByTestId('flow-kind-CASE')).toHaveTextContent('Vụ án (1)');
    expect(screen.getByTestId('flow-kind-PETITION')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('flow-name-p1')).toBeInTheDocument();
    expect(screen.queryByTestId('flow-name-i1')).toBeNull();
  });

  it('switching tab shows the flows of that kind', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-kind-INCIDENT'));
    expect(screen.getByTestId('flow-name-i1')).toBeInTheDocument();
    expect(screen.queryByTestId('flow-name-p1')).toBeNull();
  });

  it('a row shows its badges, its bound types with "+N", its steps and its versions', async () => {
    renderPage();
    await screen.findByTestId('flow-name-p1');
    expect(screen.getByTestId('flow-badge-default-p1')).toHaveTextContent('Mặc định');
    expect(screen.queryByTestId('flow-badge-default-p2')).toBeNull();
    expect(screen.getByTestId('flow-types-p1')).toHaveTextContent('Khiếu nại');
    // Three types and one group: the first two named, two more counted.
    expect(screen.getByTestId('flow-types-p2')).toHaveTextContent('Tố cáo, Tố cáo nặc danh');
    expect(screen.getByTestId('flow-types-p2')).toHaveTextContent('+2');
    expect(screen.getByTestId('flow-steps-p2')).toHaveTextContent('5');
    expect(screen.getByTestId('flow-version-p1')).toHaveTextContent('2 · đang dùng, 3 (nháp)');
    expect(screen.getByTestId('flow-version-p2')).toHaveTextContent('4 · đang dùng');
  });

  it('archived flows are hidden until asked for, then carry the "Đã lưu trữ" badge and Khôi phục instead of Lưu trữ', async () => {
    renderPage();
    await screen.findByTestId('flow-name-p1');
    expect(api.list).toHaveBeenLastCalledWith({ includeArchived: false });
    fireEvent.click(screen.getByTestId('flow-show-archived'));
    expect(await screen.findByTestId('flow-badge-archived-p3')).toHaveTextContent('Đã lưu trữ');
    expect(api.list).toHaveBeenLastCalledWith({ includeArchived: true });
    expect(screen.getByTestId('flow-restore-p3')).toBeInTheDocument();
    expect(screen.queryByTestId('flow-archive-p3')).toBeNull();
    expect(screen.getByTestId('flow-archive-p1')).toBeInTheDocument();
  });

  it('Mở goes to the editor of that flow', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-open-p2'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin/quy-trinh/p2');
  });

  it('an empty tab says so and points at "+ Tạo quy trình"', async () => {
    api.list.mockResolvedValue([summary({ id: 'p1' })]);
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-kind-CASE'));
    expect(await screen.findByText(L.list.empty)).toBeInTheDocument();
  });
});

describe('creating, copying and starting from a template', () => {
  it('creates an empty draft of the kind of the open tab and opens it', async () => {
    api.create.mockResolvedValue(detail({ id: 'new1' }));
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-kind-INCIDENT'));
    fireEvent.click(screen.getByTestId('flow-new'));
    fireEvent.change(screen.getByTestId('flow-create-name'), { target: { value: '  Quy trình mới ' } });
    expect(screen.getByTestId('flow-create-kind')).toHaveValue('INCIDENT');
    fireEvent.click(screen.getByTestId('flow-create-submit'));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ name: 'Quy trình mới', recordKind: 'INCIDENT' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin/quy-trinh/new1');
  });

  it('refuses an empty name before asking the server', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-new'));
    expect(screen.getByTestId('flow-create-submit')).toBeDisabled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('a taken name is answered in words and the panel stays open', async () => {
    api.create.mockRejectedValue(apiError(409, 'FLOW_NAME_TAKEN'));
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-new'));
    fireEvent.change(screen.getByTestId('flow-create-name'), { target: { value: 'Khiếu nại' } });
    fireEvent.click(screen.getByTestId('flow-create-submit'));
    expect(await screen.findByTestId('flow-list-error')).toHaveTextContent(L.errors.FLOW_NAME_TAKEN);
    expect(screen.getByTestId('flow-create-panel')).toBeInTheDocument();
  });

  it('the template menu is filled from the server; picking one creates a DRAFT from that template', async () => {
    api.create.mockResolvedValue(detail({ id: 'fromtpl' }));
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-templates'));
    expect(await screen.findByTestId('flow-template-CASE_INVESTIGATION')).toHaveTextContent('Điều tra vụ án hình sự');
    expect(screen.getByTestId('flow-template-CASE_INVESTIGATION')).toHaveTextContent('Vụ án · 2 bước');
    fireEvent.click(screen.getByTestId('flow-template-CASE_INVESTIGATION'));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({ name: 'Điều tra vụ án hình sự', recordKind: 'CASE', templateKey: 'CASE_INVESTIGATION' }),
    );
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin/quy-trinh/fromtpl');
  });

  it('Chép makes a draft copy called "(bản chép)" from that flow, without changing the bindings', async () => {
    api.create.mockResolvedValue(detail({ id: 'copy1' }));
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-copy-p2'));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({ name: 'Tố cáo (bản chép)', recordKind: 'PETITION', copyFromFlowId: 'p2' }),
    );
    expect(await screen.findByTestId('flow-list-message')).toHaveTextContent(L.list.copied);
  });
});

describe('archiving and restoring', () => {
  it('Lưu trữ sends the revision that was on screen and refreshes the list', async () => {
    api.archive.mockResolvedValue(detail());
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-archive-p1'));
    await waitFor(() => expect(api.archive).toHaveBeenCalledWith('p1', 4));
    expect(await screen.findByTestId('flow-list-message')).toHaveTextContent(L.list.archived);
    await waitFor(() => expect(api.list.mock.calls.length).toBeGreaterThan(1));
  });

  it('Khôi phục sends the revision, and a refusal (the name is now taken) is answered in words', async () => {
    api.restore.mockRejectedValue(apiError(409, 'FLOW_NAME_TAKEN'));
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-show-archived'));
    fireEvent.click(await screen.findByTestId('flow-restore-p3'));
    await waitFor(() => expect(api.restore).toHaveBeenCalledWith('p3', 9));
    expect(await screen.findByTestId('flow-list-error')).toHaveTextContent(L.errors.FLOW_NAME_TAKEN);
  });

  it('REVISION_CONFLICT says somebody else changed it and reloads the list', async () => {
    api.archive.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-archive-p1'));
    expect(await screen.findByTestId('flow-list-error')).toHaveTextContent(L.errors.REVISION_CONFLICT);
    await waitFor(() => expect(api.list.mock.calls.length).toBeGreaterThan(1));
  });

  it('every row action is disabled while a write is pending', async () => {
    api.archive.mockReturnValue(new Promise(() => undefined));
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-archive-p1'));
    await waitFor(() => expect(screen.getByTestId('flow-archive-p2')).toBeDisabled());
    expect(screen.getByTestId('flow-copy-p2')).toBeDisabled();
    expect(screen.getByTestId('flow-delete-p2')).toBeDisabled();
    expect(screen.getByTestId('flow-new')).toBeDisabled();
  });
});

describe('deleting a flow', () => {
  it('asks for the name to be typed back, and only then enables the button; sends revision and name', async () => {
    api.remove.mockResolvedValue({ deleted: true, id: 'p2' });
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-delete-p2'));
    const panel = screen.getByTestId('flow-delete-panel');
    expect(within(panel).getByTestId('flow-delete-confirm')).toBeDisabled();
    fireEvent.change(within(panel).getByTestId('flow-delete-name'), { target: { value: 'Tố cá' } });
    expect(within(panel).getByTestId('flow-delete-confirm')).toBeDisabled();
    fireEvent.change(within(panel).getByTestId('flow-delete-name'), { target: { value: 'Tố cáo' } });
    fireEvent.click(within(panel).getByTestId('flow-delete-confirm'));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('p2', 4, 'Tố cáo'));
    await waitFor(() => expect(screen.queryByTestId('flow-delete-panel')).toBeNull());
    expect(screen.getByTestId('flow-list-message')).toHaveTextContent(L.list.deleted);
  });

  it('Thôi closes the panel without deleting', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-delete-p2'));
    fireEvent.click(screen.getByTestId('flow-delete-cancel'));
    expect(screen.queryByTestId('flow-delete-panel')).toBeNull();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('FLOW_IN_USE says the flow has records and offers "Lưu trữ" instead, which archives it', async () => {
    api.remove.mockRejectedValue(apiError(409, 'FLOW_IN_USE'));
    api.archive.mockResolvedValue(detail());
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-delete-p2'));
    fireEvent.change(screen.getByTestId('flow-delete-name'), { target: { value: 'Tố cáo' } });
    fireEvent.click(screen.getByTestId('flow-delete-confirm'));
    expect(await screen.findByTestId('flow-delete-in-use')).toHaveTextContent(L.deleteFlow.inUseTitle);
    expect(screen.queryByTestId('flow-delete-confirm')).toBeNull();
    fireEvent.click(screen.getByTestId('flow-delete-archive-instead'));
    await waitFor(() => expect(api.archive).toHaveBeenCalledWith('p2', 4));
    await waitFor(() => expect(screen.queryByTestId('flow-delete-panel')).toBeNull());
  });

  it('CONFIRMATION_MISMATCH from the server keeps the panel open with its sentence', async () => {
    api.remove.mockRejectedValue(apiError(400, 'CONFIRMATION_MISMATCH'));
    renderPage();
    fireEvent.click(await screen.findByTestId('flow-delete-p2'));
    fireEvent.change(screen.getByTestId('flow-delete-name'), { target: { value: 'Tố cáo' } });
    fireEvent.click(screen.getByTestId('flow-delete-confirm'));
    expect(await screen.findByTestId('flow-delete-error')).toHaveTextContent(L.errors.CONFIRMATION_MISMATCH);
    expect(screen.getByTestId('flow-delete-panel')).toBeInTheDocument();
  });
});

describe('permissions', () => {
  it('without create / edit / delete the buttons are not there', async () => {
    held.value = ['read:ProcessingFlow'];
    renderPage();
    await screen.findByTestId('flow-name-p1');
    expect(screen.queryByTestId('flow-new')).toBeNull();
    expect(screen.queryByTestId('flow-templates')).toBeNull();
    expect(screen.queryByTestId('flow-copy-p1')).toBeNull();
    expect(screen.queryByTestId('flow-archive-p1')).toBeNull();
    expect(screen.queryByTestId('flow-delete-p1')).toBeNull();
    expect(screen.getByTestId('flow-open-p1')).toBeInTheDocument();
  });
});

describe('when the backend switch is off', () => {
  it('a 404 from the list shows a plain "tính năng chưa được bật" state, not an error banner', async () => {
    api.list.mockRejectedValue(apiError(404, null));
    renderPage();
    const off = await screen.findByTestId('processing-flow-disabled');
    expect(off).toHaveTextContent(L.disabled.title);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('flow-new')).toBeNull();
  });

  it('another failure is an error with a retry, not the "chưa bật" state', async () => {
    api.list.mockRejectedValueOnce(apiError(500, 'INTERNAL'));
    renderPage();
    expect(await screen.findByTestId('flow-list-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('processing-flow-disabled')).toBeNull();
    api.list.mockResolvedValue(FLOWS);
    fireEvent.click(screen.getByTestId('flow-list-retry'));
    expect(await screen.findByTestId('flow-name-p1')).toBeInTheDocument();
  });
});

describe('a person without read:ProcessingFlow', () => {
  it('sees the plain "no permission" state in Vietnamese, with no frame, no raw message and no retry', async () => {
    api.list.mockRejectedValue(apiError(403, null));
    renderPage();
    const state = await screen.findByTestId('processing-flow-forbidden');
    expect(state).toHaveTextContent(L.common.forbiddenTitle);
    expect(screen.queryByTestId('flow-list-load-error')).toBeNull();
    expect(screen.queryByTestId('flow-list-retry')).toBeNull();
    expect(screen.queryByTestId('flow-new')).toBeNull();
    expect(document.body).not.toHaveTextContent(/Insufficient permissions/i);
  });
});
