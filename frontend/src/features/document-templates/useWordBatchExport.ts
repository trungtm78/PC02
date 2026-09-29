import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { parseBlobError, triggerDownload, resolveFilename, type ExportEntity } from './export.api';
import { wordBatchMessages } from './wordBatch.messages';

interface WordBatchOptions {
  entity: ExportEntity;
  caseType?: 'REGULAR' | 'UY_THAC_DIEU_TRA';
}

export function useWordBatchExport({ entity, caseType }: WordBatchOptions) {
  const [ids, setIds] = useState<string[] | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const confirm = useCallback(async (selectedIds: string[], docTypes: string[]) => {
    if (!selectedIds.length || !docTypes.length) return;
    setIsExporting(true);
    setStatus(null);
    try {
      const idKey = entity === 'cases' ? 'caseIds' : entity === 'incidents' ? 'incidentIds' : 'petitionIds';
      const response = await api.post<Blob>(
        `/${entity}/export-document-batch`,
        { [idKey]: selectedIds, docTypes, ...(caseType && { caseType }) },
        { responseType: 'blob' },
      );
      const headers = response.headers as Record<string, string>;
      const filename = resolveFilename(headers, wordBatchMessages.fallbackFilename);
      triggerDownload(response, wordBatchMessages.fallbackFilename);
      const total = Number(headers['x-batch-total'] ?? selectedIds.length * docTypes.length);
      const failed = Number(headers['x-batch-failed'] ?? 0);
      const ok = Number(headers['x-batch-ok'] ?? Math.max(0, total - failed));
      setStatus({
        kind: failed > 0 ? 'error' : 'success',
        text: failed > 0
          ? wordBatchMessages.partial(ok, total, filename)
          : wordBatchMessages.success(ok, total, filename),
      });
    } catch (error) {
      const parsed = await parseBlobError(error);
      const message = extractApiError(parsed, wordBatchMessages.failed).message;
      setStatus({ kind: 'error', text: message });
      throw new Error(message);
    } finally {
      setIsExporting(false);
    }
  }, [entity, caseType]);

  return { ids, setIds, confirm, status, isExporting };
}
