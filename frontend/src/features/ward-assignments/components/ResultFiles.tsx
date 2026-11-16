import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';
import { wardAssignmentDocs as t, wardDocsErrorText } from '@/locales/wardAssignmentDocs.vi';
import { saveDownloadedFile, wardDocsApi, type WardFile } from '../api/docs';

export interface ResultFilesProps {
  assignmentId: string;
  /** PC02 with the review reach on an approved request: upload and remove. Everybody else only lists and downloads. */
  canWrite: boolean;
  /** After a file is added or removed: what the request allows depends on its files ("Huỷ duyệt" is refused while one is there). */
  onChanged?: () => void;
}

function errorText(error: unknown): string {
  const e = extractApiError(error);
  return wardDocsErrorText(e.code, e.status);
}

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function uploaderName(file: WardFile): string {
  const u = file.uploadedBy;
  if (!u) return '';
  return [u.lastName, u.firstName].filter(Boolean).join(' ').trim() || u.username;
}

/** "Kết quả": the result files of a ward assignment request — list, upload with progress, download, remove with confirm. */
export function ResultFiles({ assignmentId, canWrite, onChanged }: ResultFilesProps) {
  const [files, setFiles] = useState<WardFile[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ name: string; percent: number } | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirming, setConfirming] = useState<WardFile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setFiles(await wardDocsApi.listFiles(assignmentId));
    } catch (error) {
      setFiles(null);
      setLoadError(errorText(error));
    }
  }, [assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File) => {
    setMessage(null);
    setProgress({ name: file.name, percent: 0 });
    try {
      await wardDocsApi.uploadFile(assignmentId, file, (percent) => setProgress({ name: file.name, percent }));
      setMessage({ kind: 'ok', text: t.files.uploaded(file.name) });
      await load();
      onChanged?.();
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error) });
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  };

  const download = async (file: WardFile) => {
    setMessage(null);
    setBusyId(file.id);
    try {
      saveDownloadedFile(await wardDocsApi.downloadFile(assignmentId, file));
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error) });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (file: WardFile) => {
    setMessage(null);
    setBusyId(file.id);
    try {
      await wardDocsApi.removeFile(assignmentId, file.id);
      setConfirming(null);
      setMessage({ kind: 'ok', text: t.files.removed(file.originalName) });
      await load();
      onChanged?.();
    } catch (error) {
      setConfirming(null);
      setMessage({ kind: 'error', text: errorText(error) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-label={t.files.title} className="space-y-3" data-testid="ward-result-files">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{t.files.title}</h3>
        {canWrite && (
          <>
            <input
              ref={input}
              type="file"
              className="hidden"
              data-testid="ward-file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <Button type="button" size="sm" variant="outline" disabled={progress !== null} onClick={() => input.current?.click()}>
              <Upload className="mr-1 h-4 w-4" aria-hidden />
              {t.files.upload}
            </Button>
          </>
        )}
      </div>
      {canWrite && <p className="text-xs text-slate-500">{t.files.hint}</p>}

      {progress && (
        <div role="status" className="space-y-1">
          <p className="text-xs text-slate-600">{t.files.uploading(progress.name, progress.percent)}</p>
          <div className="h-1.5 w-full rounded bg-slate-200">
            <div className="h-1.5 rounded bg-blue-600 transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      )}

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'text-sm text-red-600' : 'text-sm text-green-700'}>
          {message.text}
        </p>
      )}

      {loadError ? (
        <div role="alert" className="flex items-center gap-2 text-sm text-red-600">
          <span>{t.files.loadFailed}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => void load()}>
            {t.files.retry}
          </Button>
        </div>
      ) : files === null ? (
        <p className="text-sm text-slate-500">{t.files.loading}</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-slate-500">{t.files.empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded border border-slate-200">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-800" title={file.originalName}>
                  {file.originalName}
                </p>
                <p className="text-xs text-slate-500">
                  {sizeText(file.size)} · {t.files.uploadedBy(uploaderName(file), formatVNDateTime(file.createdAt))}
                </p>
              </div>
              <Button type="button" size="sm" variant="ghost" disabled={busyId === file.id} onClick={() => void download(file)} aria-label={`${t.files.download} ${file.originalName}`}>
                <Download className="h-4 w-4" aria-hidden />
              </Button>
              {canWrite && (
                <Button type="button" size="sm" variant="ghost" disabled={busyId === file.id} onClick={() => setConfirming(file)} aria-label={`${t.files.remove} ${file.originalName}`}>
                  <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <div role="dialog" aria-modal="true" aria-label={t.files.confirm} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl">
            <p className="text-sm text-slate-800">{t.files.confirmRemove(confirming.originalName)}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(null)}>
                {t.files.cancel}
              </Button>
              <Button type="button" variant="destructive" size="sm" disabled={busyId === confirming.id} onClick={() => void remove(confirming)}>
                {t.files.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ResultFiles;
