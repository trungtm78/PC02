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

const ok = <T,>(data: T) => ({ data: { success: true, data } });
const fail = (status: number, code: string, details: unknown[] = []) => ({
  response: { status, data: { success: false, code, error: { code, message: 'x', details } } },
});

const passed = { at: '2026-11-03T01:00:00.000Z', ok: true, code: null, latencyMs: 900, byId: 'u1', current: true };

const provider = (overrides: Partial<ProviderView> = {}): ProviderView => ({
  id: 'p1',
  kind: 'ANTHROPIC',
  label: 'Claude Sonnet',
  apiKeyLast4: '6789',
  baseUrl: null,
  model: 'claude-sonnet-5-5',
  dataRegion: null,
  zeroRetention: false,
  prices: { inputMicroUsdPerMTok: null, outputMicroUsdPerMTok: null },
  role: 'OFF',
  fallbackOrder: null,
  archivedAt: null,
  test: { at: null, ok: null, code: null, latencyMs: null, byId: null, current: false },
  createdAt: '2026-11-03T00:00:00.000Z',
  updatedAt: '2026-11-03T00:00:00.000Z',
  ...overrides,
});

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
  totalLatencyMs: 1000,
  inputTokens: 10,
  outputTokens: 5,
});

function serve(options: { providers?: ProviderView[]; keyConfigured?: boolean } = {}) {
  get.mockImplementation((url: string) => {
    if (url === '/llm/status') {
      return Promise.resolve(
        ok({ keyConfigured: options.keyConfigured ?? true }),
      ) as never;
    }
    if (url === '/llm/providers') return Promise.resolve(ok(options.providers ?? [])) as never;
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

const rolePosts = () => post.mock.calls.filter(([url]) => String(url).endsWith('/role'));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('setup guide', () => {
  it('lists the steps in order, and its button does the next one', async () => {
    serve({ providers: [] });
    render(<LlmConfigPage />);
    const guide = await screen.findByTestId('setup-guide');
    expect(within(guide).getByTestId('setup-step-KEY').getAttribute('data-done')).toBe('true');
    expect(within(guide).getByTestId('setup-step-PROVIDER').getAttribute('data-done')).toBe('false');
    expect(within(guide).getByTestId('setup-step-PROVIDER').getAttribute('data-next')).toBe('true');

    fireEvent.click(within(guide).getByRole('button', { name: 'Thêm nhà cung cấp đầu tiên' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('with the server key missing, says who has to fix it instead of offering a button that cannot work', async () => {
    serve({ providers: [], keyConfigured: false });
    render(<LlmConfigPage />);
    const guide = await screen.findByTestId('setup-guide');
    expect(guide.textContent).toContain('LLM_KEY_ENCRYPTION_KEY');
    expect(within(guide).queryByRole('button')).toBeNull();
  });

  it('points at the last step once a provider has passed its test, and that button makes it the one in use', async () => {
    serve({ providers: [provider({ test: passed })] });
    post.mockResolvedValue(ok(provider({ role: 'PRIMARY', test: passed })) as never);
    render(<LlmConfigPage />);
    const guide = await screen.findByTestId('setup-guide');
    expect(within(guide).getByTestId('setup-step-TEST').getAttribute('data-done')).toBe('true');
    expect(within(guide).getByTestId('setup-step-ACTIVE').getAttribute('data-next')).toBe('true');
    fireEvent.click(within(guide).getByRole('button', { name: 'Dùng nhà cung cấp này' }));
    await waitFor(() => expect(rolePosts()).toHaveLength(1));
    expect(rolePosts()[0]).toEqual(['/llm/providers/p1/role', { role: 'PRIMARY' }]);
  });

  it('says it is all done when a tested provider is in use', async () => {
    serve({ providers: [provider({ test: passed, role: 'PRIMARY' })] });
    render(<LlmConfigPage />);
    expect((await screen.findByTestId('setup-guide')).textContent).toContain('Đã cài đặt xong');
  });
});

describe('Dùng nhà cung cấp này', () => {
  it('tests an untested provider first, then makes it the one in use', async () => {
    serve({ providers: [provider()] });
    post.mockImplementation((url: string) => {
      if (url.endsWith('/test')) return Promise.resolve(ok(report(true))) as never;
      return Promise.resolve(ok(provider({ role: 'PRIMARY', test: passed }))) as never;
    });
    render(<LlmConfigPage />);
    const row = await screen.findByTestId('provider-row-p1');
    fireEvent.click(within(row).getByRole('button', { name: 'Dùng nhà cung cấp này' }));
    await waitFor(() => expect(rolePosts()).toHaveLength(1));
    expect(rolePosts()[0]).toEqual(['/llm/providers/p1/role', { role: 'PRIMARY' }]);
    const urls = post.mock.calls.map(([url]) => url);
    expect(urls.indexOf('/llm/providers/p1/test')).toBeLessThan(urls.indexOf('/llm/providers/p1/role'));
    expect((await screen.findByTestId('notice')).textContent).toContain('đang dùng');
  });

  it('stops at a failed test and shows why, without touching the role', async () => {
    serve({ providers: [provider()] });
    post.mockResolvedValue(ok(report(false)) as never);
    render(<LlmConfigPage />);
    const row = await screen.findByTestId('provider-row-p1');
    fireEvent.click(within(row).getByRole('button', { name: 'Dùng nhà cung cấp này' }));
    expect(await screen.findByTestId('key-test-report')).toBeTruthy();
    expect(rolePosts()).toHaveLength(0);
  });
});

describe('a role the server refuses', () => {
  it('is explained in the row where the administrator was working, not only at the top of the page', async () => {
    serve({ providers: [provider({ test: passed })] });
    post.mockRejectedValue(fail(409, 'LLM_ROLE_BLOCKED', [{ reason: 'NOT_TESTED' }]));
    render(<LlmConfigPage />);
    await screen.findByTestId('provider-row-p1');
    fireEvent.change(screen.getByLabelText('Vai trò: Claude Sonnet'), { target: { value: 'PRIMARY' } });
    const hint = await screen.findByTestId('row-error-p1');
    expect(hint.textContent).toContain('Cần kiểm thử đạt');
  });
});

describe('a model that real scans showed to be weak', () => {
  it('is flagged in the row', async () => {
    serve({ providers: [provider({ model: 'claude-haiku-5-5', label: 'Claude Haiku' })] });
    render(<LlmConfigPage />);
    const row = await screen.findByTestId('provider-row-p1');
    expect(within(row).getByTestId('model-warning-p1').textContent).toContain('Sonnet');
  });

  it('is not flagged when the model is a larger one', async () => {
    serve({ providers: [provider()] });
    render(<LlmConfigPage />);
    const row = await screen.findByTestId('provider-row-p1');
    expect(within(row).queryByTestId('model-warning-p1')).toBeNull();
  });
});

describe('the add-provider form', () => {
  it('names a new provider after its kind and tells the browser not to autofill its fields', async () => {
    serve({ providers: [] });
    render(<LlmConfigPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm nhà cung cấp' }));
    const dialog = await screen.findByRole('dialog');
    const label = within(dialog).getByLabelText('Tên hiển thị') as HTMLInputElement;
    expect(label.value).toBe('Gemini');
    expect(label.getAttribute('autocomplete')).toBe('off');
    expect(within(dialog).getByLabelText('Khoá API').getAttribute('autocomplete')).toBe('new-password');

    fireEvent.change(within(dialog).getByLabelText('Loại nhà cung cấp'), { target: { value: 'ANTHROPIC' } });
    expect(label.value).toBe('Claude');
  });

  it('keeps a name the administrator typed when the kind changes', async () => {
    serve({ providers: [] });
    render(<LlmConfigPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm nhà cung cấp' }));
    const dialog = await screen.findByRole('dialog');
    const label = within(dialog).getByLabelText('Tên hiển thị') as HTMLInputElement;
    fireEvent.change(label, { target: { value: 'Tài khoản của phòng' } });
    fireEvent.change(within(dialog).getByLabelText('Loại nhà cung cấp'), { target: { value: 'ANTHROPIC' } });
    expect(label.value).toBe('Tài khoản của phòng');
  });
});
