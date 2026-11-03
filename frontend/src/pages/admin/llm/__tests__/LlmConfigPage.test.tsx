import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { api } from '@/lib/api';
import { LlmConfigPage } from '../LlmConfigPage';
import type { KeyTestReport, ProviderView } from '../llmApi';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const patch = vi.mocked(api.patch);
const del = vi.mocked(api.delete);

const SECRET = 'sk-ant-SECRET-0123456789';

const ok = <T,>(data: T) => ({ data: { success: true, data } });
const fail = (status: number, code?: string, details: unknown[] = []) => ({
  response: { status, data: code ? { success: false, code, error: { code, message: 'x', details } } : {} },
});

const provider = (overrides: Partial<ProviderView> = {}): ProviderView => ({
  id: 'p1',
  kind: 'ANTHROPIC',
  label: 'Claude Haiku',
  apiKeyLast4: '6789',
  baseUrl: null,
  model: 'claude-haiku-5-5',
  dataRegion: 'US',
  zeroRetention: true,
  prices: { inputMicroUsdPerMTok: 1_000_000, outputMicroUsdPerMTok: 5_000_000 },
  role: 'OFF',
  fallbackOrder: null,
  archivedAt: null,
  test: { at: null, ok: null, code: null, latencyMs: null, byId: null, current: false },
  createdAt: '2026-11-03T00:00:00.000Z',
  updatedAt: '2026-11-03T00:00:00.000Z',
  ...overrides,
});

const passed = { at: '2026-11-03T01:00:00.000Z', ok: true, code: null, latencyMs: 900, byId: 'u1', current: true };

const report = (okValue: boolean): KeyTestReport => ({
  ok: okValue,
  steps: okValue
    ? [
        { id: 'NETWORK', ok: true },
        { id: 'KEY', ok: true },
        { id: 'MODEL', ok: true },
        { id: 'READ_IMAGE', ok: true },
        { id: 'SCHEMA', ok: true },
      ]
    : [
        { id: 'NETWORK', ok: true },
        { id: 'KEY', ok: false, code: 'AUTH' },
        { id: 'MODEL', ok: false, code: 'SKIPPED' },
        { id: 'READ_IMAGE', ok: false, code: 'SKIPPED' },
        { id: 'SCHEMA', ok: false, code: 'SKIPPED' },
      ],
  totalLatencyMs: 3400,
  inputTokens: 1332,
  outputTokens: 147,
});

function serve(options: { providers?: ProviderView[]; keyConfigured?: boolean; assessment?: object | null } = {}) {
  get.mockImplementation((url: string) => {
    if (url === '/llm/status') {
      return Promise.resolve(
        ok({ keyConfigured: options.keyConfigured ?? true, assessment: options.assessment ?? null }),
      ) as never;
    }
    if (url === '/llm/providers') return Promise.resolve(ok(options.providers ?? [provider()])) as never;
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('LlmConfigPage loading', () => {
  it('lists providers with a masked key and never shows the key itself', async () => {
    serve();
    const { container } = render(<LlmConfigPage />);
    expect(await screen.findByTestId('provider-row-p1')).toBeTruthy();
    expect(screen.getByTestId('key-p1').textContent).toBe('••••6789');
    expect(container.textContent).not.toContain(SECRET);
  });

  it('a failed load is a failure with a retry, never an empty list', async () => {
    get.mockRejectedValue(fail(500));
    render(<LlmConfigPage />);
    expect(await screen.findByTestId('llm-load-failed')).toBeTruthy();
    expect(screen.queryByTestId('providers-empty')).toBeNull();

    serve();
    fireEvent.click(screen.getByText('Thử lại'));
    expect(await screen.findByTestId('provider-row-p1')).toBeTruthy();
  });

  it('says the feature is off on 404 and that access is denied on 403', async () => {
    get.mockRejectedValue(fail(404));
    const first = render(<LlmConfigPage />);
    expect((await screen.findByTestId('llm-unavailable')).textContent).toContain('ocr_import');
    first.unmount();

    get.mockRejectedValue(fail(403));
    render(<LlmConfigPage />);
    expect((await screen.findByTestId('llm-unavailable')).textContent).toContain('không có quyền');
  });

  it('warns and blocks adding when the server cannot store keys', async () => {
    serve({ keyConfigured: false });
    render(<LlmConfigPage />);
    expect(await screen.findByTestId('key-not-configured')).toBeTruthy();
    expect((screen.getByText('Thêm nhà cung cấp').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows an empty state only when the server really returned no provider', async () => {
    serve({ providers: [] });
    render(<LlmConfigPage />);
    expect(await screen.findByTestId('providers-empty')).toBeTruthy();
  });
});

describe('roles', () => {
  const roleSelect = (label = 'Claude Haiku') =>
    screen.getByLabelText(`Vai trò: ${label}`) as HTMLSelectElement;

  it('a provider that has not passed a test can only be turned off', async () => {
    serve();
    render(<LlmConfigPage />);
    await screen.findByTestId('provider-row-p1');
    const options = Array.from(roleSelect().options);
    expect(options.find((o) => o.value === 'PRIMARY')?.disabled).toBe(true);
    expect(options.find((o) => o.value === 'FALLBACK')?.disabled).toBe(true);
    expect(options.find((o) => o.value === 'OFF')?.disabled).toBe(false);
    expect(screen.getByTestId('test-badge-p1').textContent).toBe('Chưa kiểm thử');
  });

  it('a passing test unlocks the roles, and choosing one calls the server', async () => {
    serve({ providers: [provider({ test: passed })] });
    post.mockResolvedValue(ok(provider({ role: 'PRIMARY', test: passed })) as never);
    render(<LlmConfigPage />);
    await screen.findByTestId('provider-row-p1');
    expect(roleSelect().querySelector('option[value="PRIMARY"]')?.hasAttribute('disabled')).toBe(false);

    fireEvent.change(roleSelect(), { target: { value: 'PRIMARY' } });
    await waitFor(() => expect(post).toHaveBeenCalledWith('/llm/providers/p1/role', { role: 'PRIMARY' }));
  });

  it('a test that no longer matches the settings is shown as outdated and keeps the roles locked', async () => {
    serve({ providers: [provider({ test: { ...passed, current: false } })] });
    render(<LlmConfigPage />);
    await screen.findByTestId('provider-row-p1');
    expect(screen.getByTestId('test-badge-p1').textContent).toContain('cấu hình đã đổi');
    expect(roleSelect().querySelector('option[value="PRIMARY"]')?.hasAttribute('disabled')).toBe(true);
  });

  it('explains in Vietnamese why the server blocked a role, from its reason code', async () => {
    serve({ providers: [provider({ test: passed })] });
    post.mockRejectedValue(fail(409, 'LLM_ROLE_BLOCKED', [{ reason: 'TRANSFER_ASSESSMENT_REQUIRED' }]));
    render(<LlmConfigPage />);
    await screen.findByTestId('provider-row-p1');
    fireEvent.change(roleSelect(), { target: { value: 'PRIMARY' } });
    const alert = await screen.findByTestId('action-errors');
    expect(alert.textContent).toContain('Chưa thể gán vai trò');
    expect(alert.textContent).toContain('hồ sơ đánh giá tác động');
  });
});

describe('testing a saved key', () => {
  it('runs the test and shows each step with advice for the failing one', async () => {
    serve();
    post.mockResolvedValue(ok(report(false)) as never);
    render(<LlmConfigPage />);
    await screen.findByTestId('provider-row-p1');
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm thử' }));
    const view = await screen.findByTestId('key-test-report');
    expect(post).toHaveBeenCalledWith('/llm/providers/p1/test');
    expect(within(view).getByTestId('key-test-step-KEY')).toBeTruthy();
    expect(within(view).getByTestId('key-test-advice').textContent).toContain('Khoá bị từ chối');
    expect(view.textContent).toContain('3400 ms');
  });
});

describe('transfer assessment', () => {
  it('warns that cloud providers are blocked while no assessment is in force', async () => {
    serve();
    render(<LlmConfigPage />);
    expect((await screen.findByTestId('assessment-none')).textContent).toContain('bị chặn');
  });

  it('files an assessment with trimmed values', async () => {
    serve();
    post.mockResolvedValue(ok({ id: 'a1' }) as never);
    render(<LlmConfigPage />);
    await screen.findByTestId('assessment-none');
    fireEvent.click(screen.getByText('Ghi nhận hồ sơ'));
    fireEvent.change(screen.getByLabelText('Số hồ sơ'), { target: { value: '  DGTD-01 ' } });
    fireEvent.change(screen.getByLabelText('Ngày nộp'), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByText('Lưu hồ sơ'));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/llm/transfer-assessment', { fileNumber: 'DGTD-01', filedAt: '2026-11-01' }),
    );
  });

  it('withdrawing asks first, and reports how many cloud providers were stopped', async () => {
    serve({ assessment: { id: 'a1', fileNumber: 'DGTD-01', filedAt: '2026-11-01T00:00:00.000Z' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    post.mockResolvedValue(ok({ providersStopped: 2 }) as never);
    render(<LlmConfigPage />);
    await screen.findByTestId('assessment-active');

    fireEvent.click(screen.getByText('Rút hồ sơ'));
    expect(post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Rút hồ sơ'));
    expect((await screen.findByTestId('notice')).textContent).toContain('ngừng 2 nhà cung cấp');
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});

describe('archive and delete', () => {
  it('does nothing when the confirmation is declined, and acts when accepted', async () => {
    serve();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    post.mockResolvedValue(ok(provider({ archivedAt: '2026-11-03T02:00:00.000Z' })) as never);
    render(<LlmConfigPage />);
    await screen.findByTestId('provider-row-p1');

    fireEvent.click(screen.getByText('Lưu trữ'));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Lưu trữ'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/llm/providers/p1/archive'));
  });

  it('deletes through the API and reports an in-use refusal in Vietnamese', async () => {
    serve();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    del.mockRejectedValue(fail(409, 'LLM_PROVIDER_IN_USE'));
    render(<LlmConfigPage />);
    await screen.findByTestId('provider-row-p1');
    fireEvent.click(screen.getByText('Xoá'));
    expect((await screen.findByTestId('action-errors')).textContent).toContain('đang giữ vai trò');
    expect(del).toHaveBeenCalledWith('/llm/providers/p1');
  });

  it('hides archived providers until asked, and offers restore for them', async () => {
    serve({ providers: [provider(), provider({ id: 'p2', label: 'Old', archivedAt: '2026-11-02T00:00:00.000Z' })] });
    render(<LlmConfigPage />);
    await screen.findByTestId('provider-row-p1');
    expect(screen.queryByTestId('provider-row-p2')).toBeNull();
    fireEvent.click(screen.getByLabelText('Hiện cả nhà cung cấp đã lưu trữ'));
    expect(await screen.findByTestId('provider-row-p2')).toBeTruthy();
    expect(within(screen.getByTestId('provider-row-p2')).getByText('Khôi phục')).toBeTruthy();
  });
});

describe('the provider form', () => {
  const open = async () => {
    serve({ providers: [] });
    render(<LlmConfigPage />);
    await screen.findByTestId('providers-empty');
    fireEvent.click(screen.getByText('Thêm nhà cung cấp'));
    return screen.getByRole('dialog');
  };
  const fill = (dialog: HTMLElement, label: string, value: string) =>
    fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });

  it('loads the models of the typed key and preselects the preferred one', async () => {
    const dialog = await open();
    fill(dialog, 'Khoá API', SECRET);
    post.mockResolvedValue(ok([{ id: 'claude-opus-5-5' }, { id: 'claude-haiku-5-5' }]) as never);
    fireEvent.click(within(dialog).getByText('Tải danh sách model'));
    await within(dialog).findByText('Đã tải 2 model từ nhà cung cấp.');
    expect(post).toHaveBeenCalledWith('/llm/providers/list-models', { kind: 'ANTHROPIC', apiKey: SECRET });
    expect((within(dialog).getByLabelText('Model') as HTMLSelectElement).value).toBe('claude-haiku-5-5');
  });

  it('tests the typed key before it is saved, and shows the steps', async () => {
    const dialog = await open();
    fill(dialog, 'Tên hiển thị', 'Claude');
    fill(dialog, 'Khoá API', SECRET);
    fill(dialog, 'Model', 'claude-haiku-5-5');
    post.mockResolvedValue(ok(report(true)) as never);
    fireEvent.click(within(dialog).getByText('Kiểm thử khoá'));
    await within(dialog).findByTestId('key-test-report');
    const [url, body] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/llm/providers/test-draft');
    expect(body).toMatchObject({ kind: 'ANTHROPIC', apiKey: SECRET, model: 'claude-haiku-5-5' });
  });

  it('warns that a cloud provider sends data abroad, and not for a self-hosted one', async () => {
    const dialog = await open();
    expect(within(dialog).getByTestId('cloud-notice')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Loại nhà cung cấp'), { target: { value: 'SELF_HOSTED' } });
    expect(within(dialog).queryByTestId('cloud-notice')).toBeNull();
    expect(within(dialog).getByLabelText('Địa chỉ máy chủ')).toBeTruthy();
  });

  it('says plainly when a kind has no working adapter yet', async () => {
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText('Loại nhà cung cấp'), { target: { value: 'GEMINI' } });
    expect(within(dialog).getByTestId('kind-not-supported')).toBeTruthy();
  });

  it('saves with prices converted to micro-USD and shows server rule violations in Vietnamese', async () => {
    const dialog = await open();
    fill(dialog, 'Tên hiển thị', 'Claude');
    fill(dialog, 'Khoá API', SECRET);
    fill(dialog, 'Model', 'claude-haiku-5-5');
    fill(dialog, 'Giá vào (USD / 1 triệu token)', '1,5');
    fill(dialog, 'Giá ra (USD / 1 triệu token)', '7.5');

    post.mockRejectedValueOnce(fail(400, 'LLM_PROVIDER_INVALID', [{ violations: [{ code: 'API_KEY_INVALID' }] }]));
    fireEvent.click(within(dialog).getByText('Lưu'));
    expect((await within(dialog).findByTestId('form-errors')).textContent).toContain('Khoá API không hợp lệ');
    expect(post.mock.calls[0][1]).toMatchObject({
      inputPriceMicroUsdPerMTok: 1_500_000,
      outputPriceMicroUsdPerMTok: 7_500_000,
    });

    post.mockResolvedValueOnce(ok(provider()) as never);
    fireEvent.click(within(dialog).getByText('Lưu'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('editing keeps the stored key: an empty key field sends no apiKey, and the kind cannot change', async () => {
    serve({ providers: [provider()] });
    patch.mockResolvedValue(ok(provider({ label: 'Renamed' })) as never);
    render(<LlmConfigPage />);
    await screen.findByTestId('provider-row-p1');
    fireEvent.click(screen.getByText('Sửa'));
    const dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('Loại nhà cung cấp') as HTMLSelectElement).disabled).toBe(true);
    expect(within(dialog).getByText('Khoá hiện tại kết thúc bằng 6789')).toBeTruthy();

    fill(dialog, 'Tên hiển thị', 'Renamed');
    fireEvent.click(within(dialog).getByText('Lưu'));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [url, body] = patch.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/llm/providers/p1');
    expect(body.label).toBe('Renamed');
    expect('apiKey' in body).toBe(false);
  });

  it('editing with a saved key tests the stored key through the per-id route', async () => {
    serve({ providers: [provider()] });
    post.mockResolvedValue(ok(report(true)) as never);
    render(<LlmConfigPage />);
    await screen.findByTestId('provider-row-p1');
    fireEvent.click(screen.getByText('Sửa'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Kiểm thử khoá'));
    await within(screen.getByRole('dialog')).findByTestId('key-test-report');
    expect(post).toHaveBeenCalledWith('/llm/providers/p1/test');
  });
});
