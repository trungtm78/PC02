import { api } from '@/lib/api';
import type { LlmProviderKind, LlmProviderRole } from '@/shared/enums/generated';

/** Mirrors the backend `ProviderView`. There is deliberately no field that could hold the API key. */
export interface ProviderView {
  id: string;
  kind: LlmProviderKind;
  label: string;
  apiKeyLast4: string;
  baseUrl: string | null;
  model: string;
  dataRegion: string | null;
  zeroRetention: boolean;
  prices: {
    inputMicroUsdPerMTok: number | null;
    outputMicroUsdPerMTok: number | null;
  };
  role: LlmProviderRole;
  fallbackOrder: number | null;
  archivedAt: string | null;
  test: {
    at: string | null;
    ok: boolean | null;
    code: string | null;
    latencyMs: number | null;
    byId: string | null;
    /** True while key, model, kind and URL are still the ones the last passing test vouched for. */
    current: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TransferAssessment {
  id: string;
  fileNumber: string;
  filedAt: string;
  approvedById: string;
  note: string | null;
  createdAt: string;
}

export interface LlmStatus {
  keyConfigured: boolean;
  assessment: TransferAssessment | null;
}

export type KeyTestStepId = 'NETWORK' | 'KEY' | 'MODEL' | 'READ_IMAGE' | 'SCHEMA';

export interface KeyTestStep {
  id: KeyTestStepId;
  ok: boolean;
  code?: string;
}

export interface KeyTestReport {
  ok: boolean;
  steps: KeyTestStep[];
  totalLatencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderInput {
  kind: LlmProviderKind;
  label: string;
  model: string;
  apiKey: string;
  baseUrl?: string | null;
  dataRegion?: string | null;
  zeroRetention?: boolean;
  inputPriceMicroUsdPerMTok?: number | null;
  outputPriceMicroUsdPerMTok?: number | null;
}

export type ProviderPatch = Partial<Omit<ProviderInput, 'kind'>>;

interface Envelope<T> {
  data: T;
}

const unwrap = <T>(res: { data: Envelope<T> | T }): T => {
  const body = res.data as Envelope<T>;
  return body && typeof body === 'object' && 'data' in body ? body.data : (res.data as T);
};

export const llmApi = {
  status: async () => unwrap<LlmStatus>(await api.get('/llm/status')),
  list: async () => unwrap<ProviderView[]>(await api.get('/llm/providers')),
  create: async (input: ProviderInput) =>
    unwrap<ProviderView>(await api.post('/llm/providers', input)),
  update: async (id: string, patch: ProviderPatch) =>
    unwrap<ProviderView>(await api.patch(`/llm/providers/${id}`, patch)),
  testDraft: async (input: ProviderInput) =>
    unwrap<KeyTestReport>(await api.post('/llm/providers/test-draft', input)),
  test: async (id: string) =>
    unwrap<KeyTestReport>(await api.post(`/llm/providers/${id}/test`)),
  listModelsDraft: async (input: Pick<ProviderInput, 'kind' | 'apiKey' | 'baseUrl'>) =>
    unwrap<Array<{ id: string }>>(await api.post('/llm/providers/list-models', input)),
  listModels: async (id: string) =>
    unwrap<Array<{ id: string }>>(await api.get(`/llm/providers/${id}/models`)),
  setRole: async (id: string, role: LlmProviderRole, fallbackOrder?: number) =>
    unwrap<ProviderView>(
      await api.post(`/llm/providers/${id}/role`, { role, ...(fallbackOrder ? { fallbackOrder } : {}) }),
    ),
  archive: async (id: string) =>
    unwrap<ProviderView>(await api.post(`/llm/providers/${id}/archive`)),
  restore: async (id: string) =>
    unwrap<ProviderView>(await api.post(`/llm/providers/${id}/restore`)),
  remove: async (id: string) => {
    await api.delete(`/llm/providers/${id}`);
  },
  createAssessment: async (input: { fileNumber: string; filedAt: string; note?: string }) =>
    unwrap<TransferAssessment>(await api.post('/llm/transfer-assessment', input)),
  withdrawAssessment: async () =>
    unwrap<{ providersStopped: number }>(await api.post('/llm/transfer-assessment/withdraw')),
};
