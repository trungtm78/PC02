import { api } from '@/lib/api';

/** A ward team the picker offers (`GET /teams/ward-charge-choices`). */
export interface WardChargeChoice {
  teamId: string;
  name: string;
  wardId: string;
  managerTeam: { id: string; name: string } | null;
}

/** One ward a team is in charge of (`GET /teams/:id/ward-charges`). */
export interface WardCharge {
  wardId: string;
  wardName: string;
  wardTeamId: string | null;
  wardTeamName: string | null;
}

/** One entry of the 409 `TEAM_WARD_ALREADY_CHARGED`. */
export interface WardChargeConflict {
  wardId: string;
  wardName: string;
  teamId: string;
  teamName: string;
}

export interface ImportIssue {
  code: string;
  ward?: string;
  teamName?: string;
  expected?: number;
  listed?: number;
}

export interface ImportPreviewRow {
  rowNumber: number;
  teamName: string;
  teamId: string | null;
  wards: { name: string; wardId: string | null; wardName: string | null }[];
  count: number | null;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

export interface ImportPreview {
  previewToken: string;
  rows: ImportPreviewRow[];
  totals: { rows: number; wards: number; errors: number; warnings: number };
  canConfirm: boolean;
}

export const WARD_CHARGE_IMPORT_MAX_BYTES = 1024 * 1024;
export const WARD_CHARGE_TEMPLATE_NAME = 'phuong-xa-phu-trach.xlsx';

export const wardChargesApi = {
  choices: () => api.get<WardChargeChoice[]>('/teams/ward-charge-choices').then((r) => r.data),
  list: (teamId: string) => api.get<WardCharge[]>(`/teams/${teamId}/ward-charges`).then((r) => r.data),
  replace: (teamId: string, wardIds: string[]) => api.put<WardCharge[]>(`/teams/${teamId}/ward-charges`, { wardIds }).then((r) => r.data),
  preview: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<ImportPreview>('/teams/ward-charges/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
  confirm: (previewToken: string, replaceTeamsInFile: boolean) =>
    api
      .post<{ added: number; moved: number; removed: number }>('/teams/ward-charges/import/confirm', { previewToken, replaceTeamsInFile })
      .then((r) => r.data),
  template: () => api.get<Blob>('/teams/ward-charges/import/template.xlsx', { responseType: 'blob' }).then((r) => r.data),
};

/** The `details` array of the server's error envelope (`{ error: { code, details } }`), as sent. */
export function errorDetails(err: unknown): unknown[] {
  const data = (err as { response?: { data?: { error?: { details?: unknown } } } })?.response?.data;
  const details = data?.error?.details;
  return Array.isArray(details) ? details : [];
}

/** The conflicts of a 409 `TEAM_WARD_ALREADY_CHARGED`, one per ward. */
export function conflictsOf(err: unknown): WardChargeConflict[] {
  return errorDetails(err).filter(
    (d): d is WardChargeConflict =>
      !!d && typeof d === 'object' && typeof (d as WardChargeConflict).wardId === 'string' && typeof (d as WardChargeConflict).teamName === 'string',
  );
}

/** Saves a blob under the name given (the browser ignores Content-Disposition for a blob link). */
export function saveBlob(blob: Blob, filename: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
