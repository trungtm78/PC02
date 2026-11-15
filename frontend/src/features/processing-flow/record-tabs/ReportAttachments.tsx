/**
 * The files of ONE report (decision C4): the list (each name downloads the file), and, for the author while the step
 * is being worked, adding files and removing one.
 *
 * Attaching is not a command on the flow of the record: it answers no new flow and moves no revision, so it does not go
 * through `useRecordWrite`; it refreshes the book of the step. Several files are sent ONE AFTER ANOTHER (the route
 * takes one file per call), each with its own line: sent, or the sentence of its refusal.
 *
 * No <form> here: the tab sits inside the record's own form. The file box is a bare input, the buttons are
 * `type="button"`.
 */
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { triggerDownload } from '@/features/document-templates/export.api';
import { formatVNDateTime } from '@/lib/dates';
import { randomUUID } from '@/lib/uuid';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { explainError } from '../errors';
import { processingRecordApi } from './api';
import { RECORD_QUERY_KEYS } from './queryKeys';
import { LINK_BUTTON, SMALL_DANGER, SMALL_SECONDARY } from './styles';
import type { RecordKind, ReportAttachmentDto, ReportDto } from './types';

const A = L.recordTabs.results.attachments;

interface Props {
  kind: RecordKind;
  recordId: string;
  stepKey: string;
  report: ReportDto;
  /** The author, on a standing report of a step being worked. */
  canManage: boolean;
  /** A write on the record runs, or the screen is locked by a conflict. */
  locked: boolean;
}

interface UploadLine {
  id: string;
  name: string;
  state: 'sending' | 'sent' | 'failed';
  error?: string;
}

export function ReportAttachments({ kind, recordId, stepKey, report, canManage, locked }: Props) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<UploadLine[]>([]);
  const [sending, setSending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const attachments = report.attachments ?? [];
  const testId = `report-${report.id}-attachments`;

  const refresh = () => queryClient.invalidateQueries({ queryKey: RECORD_QUERY_KEYS.results(kind, recordId, stepKey) });

  const send = async (files: File[]) => {
    if (files.length === 0 || sending) return;
    const queued = files.map((file): UploadLine => ({ id: randomUUID(), name: file.name, state: 'sending' }));
    setLines(queued);
    setProblem(null);
    setSending(true);
    const settle = (id: string, patch: Partial<UploadLine>) => setLines((now) => now.map((line) => (line.id === id ? { ...line, ...patch } : line)));
    // One after another: the route takes one file, and a refused file must not stop the ones after it.
    for (const [index, file] of files.entries()) {
      try {
        await processingRecordApi.attach(kind, recordId, stepKey, report.id, file);
        settle(queued[index].id, { state: 'sent' });
      } catch (err) {
        settle(queued[index].id, { state: 'failed', error: explainError(err).message });
      }
    }
    setSending(false);
    if (input.current) input.current.value = '';
    await refresh();
  };

  const download = async (attachment: ReportAttachmentDto) => {
    setProblem(null);
    try {
      // The bytes come through the API with the session's header; the name on the disk is the one the server sends.
      triggerDownload(await processingRecordApi.downloadAttachment(kind, recordId, stepKey, report.id, attachment.id), attachment.fileName);
    } catch {
      setProblem(A.downloadFailed(attachment.fileName));
    }
  };

  const remove = async (attachment: ReportAttachmentDto) => {
    setProblem(null);
    setRemovingId(attachment.id);
    try {
      await processingRecordApi.removeAttachment(kind, recordId, stepKey, report.id, attachment.id);
      setConfirmingId(null);
      await refresh();
    } catch (err) {
      setProblem(explainError(err).message);
    } finally {
      setRemovingId(null);
    }
  };

  if (attachments.length === 0 && !canManage) return null;

  return (
    <div className="flex flex-col gap-1.5" data-testid={testId}>
      {attachments.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label={A.title}>
          {attachments.map((attachment) => (
            <li key={attachment.id} data-testid={`attachment-${attachment.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <button type="button" data-testid={`attachment-${attachment.id}-download`} className={`${LINK_BUTTON} break-all text-left`} title={A.download} onClick={() => void download(attachment)}>
                {attachment.fileName}
              </button>
              <span className="text-xs text-slate-500">{A.meta(A.size(attachment.size), attachment.uploaderName ?? L.recordTabs.results.unknownAuthor, formatVNDateTime(attachment.uploadedAt))}</span>
              {canManage &&
                (confirmingId === attachment.id ? (
                  <span role="group" aria-label={A.removeAsk(attachment.fileName)} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                    <span>{A.removeAsk(attachment.fileName)}</span>
                    <button type="button" data-testid={`attachment-${attachment.id}-remove-yes`} className={SMALL_DANGER} disabled={locked || removingId !== null} onClick={() => void remove(attachment)}>
                      {A.removeYes}
                    </button>
                    <button type="button" data-testid={`attachment-${attachment.id}-remove-no`} className={SMALL_SECONDARY} disabled={removingId !== null} onClick={() => setConfirmingId(null)}>
                      {A.removeNo}
                    </button>
                  </span>
                ) : (
                  <button type="button" data-testid={`attachment-${attachment.id}-remove`} className={LINK_BUTTON} disabled={locked || sending} onClick={() => setConfirmingId(attachment.id)}>
                    {A.remove}
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="flex flex-col gap-1">
          <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
            <span>{A.add}</span>
            <input
              ref={input}
              type="file"
              multiple
              data-testid={`${testId}-input`}
              className="text-xs text-slate-700 file:mr-2 file:rounded file:border file:border-slate-300 file:bg-white file:px-2 file:py-1 file:text-xs disabled:cursor-not-allowed disabled:opacity-50"
              disabled={locked || sending}
              onChange={(event) => void send(Array.from(event.target.files ?? []))}
            />
          </label>
          <p className="text-xs text-slate-500">{A.hint}</p>
        </div>
      )}

      {lines.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs" aria-label={A.sendingTitle} aria-live="polite">
          {lines.map((line) => (
            <li key={line.id} data-testid={`${testId}-line`} data-state={line.state} className={line.state === 'failed' ? 'text-red-700' : line.state === 'sent' ? 'text-emerald-700' : 'text-slate-600'}>
              {line.state === 'sending' && A.sending(line.name)}
              {line.state === 'sent' && A.sent(line.name)}
              {line.state === 'failed' && A.failed(line.name, line.error ?? L.errorFallback)}
            </li>
          ))}
        </ul>
      )}

      {problem && (
        <p role="alert" data-testid={`${testId}-problem`} className="text-xs text-red-700">
          {problem}
        </p>
      )}
    </div>
  );
}
