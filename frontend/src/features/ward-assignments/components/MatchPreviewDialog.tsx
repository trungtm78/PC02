import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { extractApiError } from '@/lib/api-errors';
import { wardAssignmentAlerts as t } from '@/locales/wardAssignmentAlerts.vi';
import { wardAlertsApi, type SubjectMatch } from '../api/alerts';
import { RECORD_LINK } from '../recordLinks';
import { CASE_STATUS_LABEL, INCIDENT_STATUS_LABEL, PETITION_STATUS_LABEL } from '@/shared/enums/status-labels';
import { wardAssignments as WL } from '@/locales/wardAssignments.vi';

/** The status in words, by the kind of record (the server sends the code). */
const statusLabel = (source: SubjectMatch['source'], status: string | null): string => {
  if (!status) return '—';
  const labels: Record<string, Record<string, string>> = {
    WARD_ASSIGNMENT: WL.status as Record<string, string>,
    CASE: CASE_STATUS_LABEL,
    PETITION: PETITION_STATUS_LABEL,
    INCIDENT: INCIDENT_STATUS_LABEL,
  };
  return labels[source]?.[status] ?? status;
};

const dmy = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

/**
 * The other record of one match, read only, on top of the review: the officer compares without leaving the request.
 * The server shows it only for a pair the person sees as a match now.
 */
export function MatchPreviewDialog({ assignmentId, match, onClose }: { assignmentId: string; match: SubjectMatch; onClose: () => void }) {
  const P = t.preview;
  const q = useQuery({
    queryKey: ['ward-assignments', 'match-preview', assignmentId, match.source, match.recordId],
    queryFn: () => wardAlertsApi.preview(assignmentId, match.source, match.recordId),
    retry: false,
    // Read fresh every time it opens: a conclusion is made against what the officer was shown, and another officer
    // may have corrected the other record meanwhile.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
  const title = `${t.matches.source[match.source] ?? match.source}${match.code ? ` ${match.code}` : ''}`;
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      maxWidth="max-w-3xl"
      footer={
        <div className="flex justify-between gap-2">
          <a
            href={RECORD_LINK[match.source](match.recordId)}
            target="_blank"
            rel="noreferrer"
            data-testid="ward-match-preview-open"
            className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm text-blue-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {P.open}
          </a>
          <button type="button" data-testid="ward-match-preview-close" className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50" onClick={onClose}>
            {P.close}
          </button>
        </div>
      }
    >
      <div data-testid="ward-match-preview" className="space-y-3 text-sm">
        {q.isLoading && (
          <p className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {P.loading}
          </p>
        )}
        {q.isError && (
          <p role="alert" className="text-red-700">
            {t.errors[extractApiError(q.error).code ?? ''] ?? P.failed}
          </p>
        )}
        {q.data && (
          <>
            <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1">
              <dt className="text-slate-500">{P.unit}</dt>
              <dd>{q.data.unitName ?? '—'}</dd>
              <dt className="text-slate-500">{P.status}</dt>
              <dd>{statusLabel(match.source, q.data.status)}</dd>
              <dt className="text-slate-500">{P.day}</dt>
              <dd>{dmy(q.data.day)}</dd>
              <dt className="text-slate-500">{P.summary}</dt>
              <dd className="whitespace-pre-line">{q.data.summary || '—'}</dd>
            </dl>
            <div>
              <h4 className="mb-1 font-semibold text-slate-700">{P.people}</h4>
              {q.data.people.length === 0 ? (
                <p className="text-slate-500">{P.noPeople}</p>
              ) : (
                <table className="w-full border text-left">
                  <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th className="px-2 py-1">{P.name}</th>
                      <th className="px-2 py-1">{P.birthYear}</th>
                      <th className="px-2 py-1">{P.idNumber}</th>
                      <th className="px-2 py-1">{P.address}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.people.map((p, i) => (
                      <tr key={i} className="border-t" data-testid="ward-match-preview-person">
                        <td className="px-2 py-1">{p.name}</td>
                        <td className="px-2 py-1">{p.birthYear ?? '—'}</td>
                        <td className="px-2 py-1">{p.idNumber || '—'}</td>
                        <td className="px-2 py-1">{p.address || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default MatchPreviewDialog;
