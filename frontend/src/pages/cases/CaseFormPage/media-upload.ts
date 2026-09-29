import type { MediaFile } from './types';

export interface MediaUploadResult {
  files: MediaFile[];
  failed: number;
}

const MEDIA_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  wmv: 'video/x-ms-wmv',
};

export function prepareMediaFile(file: File): File {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const expected = MEDIA_MIME[extension];
  if (!expected) throw new Error('Unsupported media extension');
  if (file.type && file.type !== 'application/octet-stream') return file;
  return new File([file], file.name, { type: expected, lastModified: file.lastModified });
}

export async function loadCaseMediaDocuments<T extends { id: string }>(
  caseId: string,
  get: (url: string) => Promise<{ data: T[]; total: number }>,
): Promise<T[]> {
  const pageSize = 100;
  const documents: T[] = [];
  for (const kind of ['AM_THANH', 'VIDEO']) {
    let offset = 0;
    let total = 0;
    do {
      const page = await get(`/documents?caseId=${encodeURIComponent(caseId)}&documentType=${kind}&limit=${pageSize}&offset=${offset}`);
      if (page.data.length === 0 && page.total > offset) {
        throw new Error('Incomplete media page');
      }
      documents.push(...page.data);
      offset += page.data.length;
      total = page.total;
    } while (offset < total);
  }
  if (new Set(documents.map((document) => document.id)).size !== documents.length) {
    throw new Error('Duplicate media page');
  }
  return documents;
}

export async function uploadPendingMedia(
  caseId: string,
  files: MediaFile[],
  upload: (body: FormData) => Promise<{ id: string }>,
): Promise<MediaUploadResult> {
  let failed = 0;
  const updated: MediaFile[] = [];
  for (const media of files) {
    if (!media.file) {
      updated.push(media);
      continue;
    }
    const body = new FormData();
    body.append('file', media.file);
    body.append('title', media.name);
    body.append('caseId', caseId);
    const extension = media.name.split('.').pop()?.toLowerCase();
    body.append('documentType', extension === 'mp3' || extension === 'wav' ? 'AM_THANH' : 'VIDEO');
    if (media.recordDate) body.append('recordedAt', media.recordDate);
    try {
      const saved = await upload(body);
      updated.push({ ...media, id: saved.id, file: undefined });
    } catch {
      failed += 1;
      updated.push(media);
    }
  }
  return { files: updated, failed };
}
