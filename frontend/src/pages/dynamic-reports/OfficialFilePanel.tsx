/**
 * "File chính thức" — the workbook a closed period is kept as. The server makes it by itself a few seconds after the
 * period is closed; this panel waits for it (asking again for a short while, never a fixed pause), lists the current
 * file and the ones before it, and lets a manager make it again.
 *
 * A list that could not be loaded says so: it must never look like "no file yet".
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Download, FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { OfficialFileStatus, OfficialFileView } from '@/features/dynamic-reports/types';
import {
  OFFICIAL_FILE_FALLBACK_NAME,
  OFFICIAL_FILE_POLL_EVERY_MS,
  OFFICIAL_FILE_POLL_FOR_MS,
  isOfficialFileSettled,
  officialFilePollDelay,
  officialFileRows,
  officialFilesKey,
} from '@/features/dynamic-reports/officialFile';
import { extractApiError } from '@/lib/api-errors';
import { parseBlobError } from '@/features/document-templates/export.api';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { officialFileErrorText, reportCriteria } from '@/locales/reportCriteria.vi';

const t = reportCriteria.officialFile;

const STATUS_TEXT: Record<OfficialFileStatus, string> = {
  READY: t.current,
  FAILED: t.failed,
  SUPERSEDED: t.superseded,
  VOID: t.voided,
};

interface Props {
  periodId: string;
  /** How often to ask again while the file is being made, and for how long (tests shorten both). */
  pollEveryMs?: number;
  pollForMs?: number;
}

export default function OfficialFilePanel({
  periodId,
  pollEveryMs = OFFICIAL_FILE_POLL_EVERY_MS,
  pollForMs = OFFICIAL_FILE_POLL_FOR_MS,
}: Props) {
  const queryClient = useQueryClient();
  // The file is made within seconds of the closing. After this long with nothing, stop asking and offer to make it.
  const [waitingOver, setWaitingOver] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaitingOver(true), pollForMs);
    return () => window.clearTimeout(timer);
  }, [pollForMs]);

  const filesQ = useQuery({
    queryKey: officialFilesKey(periodId),
    queryFn: () => dynamicReportsApi.listOfficialFiles(periodId),
    refetchInterval: (query) => officialFilePollDelay(query.state.data, waitingOver, pollEveryMs),
  });

  const [remaking, setRemaking] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDownload(file: OfficialFileView) {
    setDownloadingId(file.id);
    setActionError(null);
    try {
      await dynamicReportsApi.downloadOfficialFile(file.id, file.fileName ?? OFFICIAL_FILE_FALLBACK_NAME);
    } catch (err) {
      const e = extractApiError(await parseBlobError(err));
      setActionError(officialFileErrorText(e.code, e.message));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleRemake(needsConfirm: boolean) {
    if (needsConfirm && !window.confirm(t.confirmRemake)) return;
    setRemaking(true);
    setActionError(null);
    try {
      await dynamicReportsApi.remakeOfficialFile(periodId);
    } catch (err) {
      const e = extractApiError(err);
      setActionError(officialFileErrorText(e.code, e.message));
    } finally {
      // Read the list again either way: a refused making may still have left a "could not make" row.
      await queryClient.invalidateQueries({ queryKey: officialFilesKey(periodId) });
      setRemaking(false);
    }
  }

  const smallButton = `inline-flex items-center gap-1 px-2.5 py-1 border border-slate-300 text-slate-700 text-xs rounded-lg hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`;
  const files = filesQ.data;
  const rows = files ? officialFileRows(files) : [];
  const waiting = !!files && !isOfficialFileSettled(files) && !waitingOver;

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 mb-6" data-testid="official-file-panel">
      <div className="flex items-center gap-2 mb-1">
        <FileSpreadsheet className="w-4 h-4 text-blue-700" />
        <h2 className="text-sm font-semibold text-slate-700">{t.title}</h2>
      </div>
      <p className="text-xs text-slate-500 mb-3">{t.hint}</p>

      {filesQ.isLoading && (
        <p className="text-sm text-slate-500" data-testid="official-file-loading">
          {reportCriteria.picker.loading}
        </p>
      )}

      {filesQ.isError && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between gap-2"
          data-testid="official-file-load-error"
          role="alert"
        >
          <p className="text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {t.loadError}
          </p>
          <button
            type="button"
            data-testid="btn-official-file-retry"
            disabled={filesQ.isFetching}
            onClick={() => void filesQ.refetch()}
            className={smallButton}
          >
            {t.retry}
          </button>
        </div>
      )}

      {!filesQ.isError && files && (
        <>
          {waiting && (
            <p className="text-sm text-slate-600 flex items-center gap-2 mb-2" data-testid="official-file-making" role="status">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.making}
            </p>
          )}
          {!waiting && !isOfficialFileSettled(files) && (
            <div className="flex items-center justify-between gap-2 mb-2" data-testid="official-file-none">
              <p className="text-sm text-slate-600">{t.none}</p>
              <button
                type="button"
                data-testid="btn-official-file-make"
                disabled={remaking}
                onClick={() => void handleRemake(false)}
                className={smallButton}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {remaking ? t.remaking : t.make}
              </button>
            </div>
          )}

          {rows.length > 0 && (
            <ul className="divide-y divide-slate-100" data-testid="official-file-list">
              {rows.map((row) => (
                <li
                  key={row.file.id}
                  data-testid={`official-file-row-${row.file.id}`}
                  data-status={row.file.status}
                  className={`flex flex-wrap items-center justify-between gap-2 py-2 text-sm ${row.muted ? 'text-slate-400' : 'text-slate-700'}`}
                >
                  <div className="min-w-0">
                    <p className={row.file.status === 'FAILED' ? 'text-red-700 font-medium' : row.current ? 'font-medium text-slate-800' : ''}>
                      <span data-testid={`official-file-status-${row.file.id}`}>{STATUS_TEXT[row.file.status]}</span>
                      {row.file.fileName && <span className="ml-2 font-normal break-all">{row.file.fileName}</span>}
                    </p>
                    <p className="text-xs text-slate-500" data-testid={`official-file-created-${row.file.id}`}>
                      {t.createdAt(formatVNDateTime(row.file.createdAt))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.downloadable && (
                      <button
                        type="button"
                        data-testid={`btn-official-file-download-${row.file.id}`}
                        disabled={downloadingId !== null}
                        onClick={() => void handleDownload(row.file)}
                        className={smallButton}
                      >
                        <Download className="w-3.5 h-3.5" />
                        {downloadingId === row.file.id ? t.downloading : t.download}
                      </button>
                    )}
                    {row.canRemake && (
                      <button
                        type="button"
                        data-testid={`btn-official-file-remake-${row.file.id}`}
                        disabled={remaking}
                        onClick={() => void handleRemake(row.remakeNeedsConfirm)}
                        className={smallButton}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {remaking ? t.remaking : t.remake}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {actionError && (
        <p className="text-sm text-red-700 mt-2" data-testid="official-file-error" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}
