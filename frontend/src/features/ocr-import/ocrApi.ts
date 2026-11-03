import { api } from '@/lib/api';
import type { Projection } from './fillPlan';

export type OcrEntityName = 'PETITION' | 'INCIDENT' | 'CASE';
export type OcrJobState = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface OcrSessionView {
  id: string;
  entity: OcrEntityName;
  status: 'OPEN' | 'BOUND' | 'CANCELLED' | 'EXPIRED';
  pageSetRevision: number;
  boundRecordId: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface OcrPageView {
  id: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

/** What a screen needs to follow a job; the code is stable, the screen translates it. */
export interface OcrJobView {
  id: string;
  kind: 'READ' | 'ANALYSE';
  state: OcrJobState;
  attempts: number;
  lastErrorCode: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface OcrSessionState {
  session: OcrSessionView;
  pages: OcrPageView[];
  job: OcrJobView | null;
}

export interface OcrIssue {
  code: string;
  [key: string]: unknown;
}

/** The analysis a form is filled from. The raw model output never reaches the browser. */
export interface OcrAnalysisView {
  /** Sent back as `ocrPhienBan` when the record is saved. */
  id: string;
  entity: OcrEntityName;
  pageSetRevision: number;
  inputFingerprint: string;
  cleaned: {
    summary?: string;
    [key: string]: unknown;
  };
  issues: OcrIssue[];
  projection: Projection;
  promptVersions: Record<string, string>;
}

export interface OcrTranscript {
  text: string;
  revision: number;
  source: 'MODEL' | 'OFFICER';
}

export type ReadMode = 'READ' | 'ANALYSE';

export const ocrApi = {
  openSession: async (entity: OcrEntityName) =>
    (await api.post<OcrSessionView>('/ocr/sessions', { entity })).data,

  /** Reads the scans attached to a saved record again: a new temporary session and the job to follow. */
  startReread: async (entity: OcrEntityName, recordId: string) =>
    (await api.post<{ sessionId: string; jobId: string; pages: number }>('/ocr/rereads', { entity, recordId })).data,

  getSession: async (id: string) =>
    (await api.get<OcrSessionState>(`/ocr/sessions/${id}`)).data,

  cancel: async (id: string) => {
    await api.delete(`/ocr/sessions/${id}`);
  },

  /** One scan per request, as the bytes the officer chose: nothing is re-encoded in the browser. */
  uploadPage: async (id: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return (
      await api.post<{ page: OcrPageView; pageSetRevision: number }>(
        `/ocr/sessions/${id}/pages`,
        body,
      )
    ).data;
  },

  reorder: async (id: string, pageIds: string[]) =>
    (await api.put<{ pageSetRevision: number }>(`/ocr/sessions/${id}/pages/order`, { pageIds }))
      .data,

  removePage: async (id: string, pageId: string) =>
    (await api.delete<{ pageSetRevision: number }>(`/ocr/sessions/${id}/pages/${pageId}`)).data,

  /** The scan itself, for the side-by-side view. Fetched with the login, so it is a blob, not a bare URL. */
  pageImage: async (id: string, pageId: string) =>
    (await api.get<Blob>(`/ocr/sessions/${id}/pages/${pageId}/image`, { responseType: 'blob' }))
      .data,

  transcripts: async (id: string) =>
    (await api.get<Record<string, OcrTranscript>>(`/ocr/sessions/${id}/transcripts`)).data,

  saveTranscript: async (id: string, pageId: string, text: string) =>
    (await api.put<{ revision: number }>(`/ocr/sessions/${id}/pages/${pageId}/transcript`, { text }))
      .data,

  read: async (id: string, mode: ReadMode) =>
    (await api.post<{ id: string; deduplicated: boolean }>(`/ocr/sessions/${id}/read`, { mode }))
      .data,

  job: async (id: string) =>
    (await api.get<{ job: OcrJobView | null }>(`/ocr/sessions/${id}/job`)).data.job,

  analysis: async (id: string) =>
    (await api.get<{ analysis: OcrAnalysisView | null }>(`/ocr/sessions/${id}/analysis`)).data
      .analysis,
};
