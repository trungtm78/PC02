import { api } from '@/lib/api';

/**
 * The result files ("Kết quả") and the request slips ("Phiếu yêu cầu") of a ward assignment request. Routes of the
 * contract `ward-contract.md`, lane C. Errors come back as `{ error: { code, details } }`; the screen translates the
 * code (`locales/wardAssignmentDocs.vi.ts`).
 */

export interface WardFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: { id: string; firstName: string | null; lastName: string | null; username: string } | null;
}

/** The decision as the issue and reissue routes return it (the slip columns are what the button reads). */
export interface WardSlipDecision {
  id: string;
  kind: 'RETURN' | 'APPROVE';
  slipYear: number | null;
  slipNumber: string | null;
  slipIssuedAt: string | null;
  slipDocumentId: string | null;
  signers: { canBoThamDinh?: string; chiHuyDoi?: string; lanhDaoPhong?: string } | null;
}

export interface SlipSigners {
  canBoThamDinh?: string;
  chiHuyDoi?: string;
  lanhDaoPhong?: string;
}

/** What the print dialog is told before issuing (`GET …/slip/defaults`). */
export interface WardSlipDefaults {
  decisionId: string;
  kind: 'RETURN' | 'APPROVE';
  revoked: boolean;
  slipNumber: string | null;
  signers: SlipSigners;
  templateReady: boolean;
  /** Fields of the request the slip would print empty (`discoveredOn`, `place`). */
  missing: string[];
}

/** A file as the browser saves it: the bytes and the name the server gave. */
export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

/** The name in `Content-Disposition` (`filename*=UTF-8''…` first, then `filename="…"`), else the fallback. */
export function fileNameFrom(disposition: string | undefined | null, fallback: string): string {
  if (!disposition) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const plain = /filename="([^"]*)"/i.exec(disposition);
  const raw = star?.[1] ?? plain?.[1];
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw) || fallback;
  } catch {
    return raw || fallback;
  }
}

const base = (assignmentId: string) => `/ward-assignments/${encodeURIComponent(assignmentId)}`;

async function download(url: string, fallback: string): Promise<DownloadedFile> {
  const res = await api.get<Blob>(url, { responseType: 'blob' });
  const header = (res.headers as Record<string, string | undefined>)['content-disposition'];
  return { blob: res.data, fileName: fileNameFrom(header, fallback) };
}

export const wardDocsApi = {
  listFiles: (assignmentId: string) => api.get<WardFile[]>(`${base(assignmentId)}/files`).then((r) => r.data),

  uploadFile: (assignmentId: string, file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<WardFile>(`${base(assignmentId)}/files`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        },
      })
      .then((r) => r.data);
  },

  downloadFile: (assignmentId: string, file: Pick<WardFile, 'id' | 'originalName'>) =>
    download(`${base(assignmentId)}/files/${encodeURIComponent(file.id)}/download`, file.originalName),

  removeFile: (assignmentId: string, fileId: string) =>
    api.delete<{ id: string }>(`${base(assignmentId)}/files/${encodeURIComponent(fileId)}`).then((r) => r.data),

  issueSlip: (assignmentId: string, decisionId: string, body: { slipNumber?: string; signers?: SlipSigners } = {}) =>
    api.post<WardSlipDecision>(`${base(assignmentId)}/decisions/${encodeURIComponent(decisionId)}/slip`, body).then((r) => r.data),

  slipDefaults: (assignmentId: string, decisionId: string) =>
    api.get<WardSlipDefaults>(`${base(assignmentId)}/decisions/${encodeURIComponent(decisionId)}/slip/defaults`).then((r) => r.data),

  downloadSlip: (assignmentId: string, decisionId: string) =>
    download(`${base(assignmentId)}/decisions/${encodeURIComponent(decisionId)}/slip`, 'Phieu-yeu-cau.docx'),

  reissueSlip: (assignmentId: string, decisionId: string, body: { reason: string; signers?: SlipSigners }) =>
    api.post<WardSlipDecision>(`${base(assignmentId)}/decisions/${encodeURIComponent(decisionId)}/slip/reissue`, body).then((r) => r.data),
};

/** Hands a downloaded file to the browser under its own name (a link click: `a.download` is the name that wins). */
export function saveDownloadedFile(file: DownloadedFile): void {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
