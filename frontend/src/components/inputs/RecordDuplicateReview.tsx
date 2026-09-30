import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { recordReview } from '@/locales/vi';

type RecordKind = 'incident' | 'case' | 'delegation' | 'petition';
type DuplicateCandidate = {
  id: string;
  name: string;
  code?: string;
  caseCode?: string;
  stt?: string;
  summary?: string | null;
  receivedDate?: string | null;
  confidence: 'HIGH' | 'MEDIUM';
  reasons: string[];
};

export interface RecordDuplicateReviewHandle {
  verify: () => Promise<{ ok: boolean; acknowledgedIds: string[] }>;
}

interface RecordDuplicateReviewProps {
  kind: RecordKind;
  name: string;
  excludeId?: string;
  decisionNumber?: string;
  idNumber?: string;
  phone?: string;
  reporter?: string;
  content?: string;
  date?: string;
  location?: string;
}

export const RecordDuplicateReview = forwardRef<
  RecordDuplicateReviewHandle,
  RecordDuplicateReviewProps
>(function RecordDuplicateReview({ kind, name, excludeId, decisionNumber, idNumber, phone, reporter, content, date, location }, ref) {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [checked, setChecked] = useState(false);
  const [checkedKey, setCheckedKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [openCandidateId, setOpenCandidateId] = useState<string | null>(null);
  const acceptedRef = useRef<{ key: string; ids: string[] } | null>(null);
  const incidentSignals = `${reporter?.trim() ?? ''}:${idNumber?.trim() ?? ''}:${phone?.trim() ?? ''}:${content?.trim() ?? ''}:${date?.trim() ?? ''}:${location?.trim() ?? ''}`;
  const currentKey = `${kind}:${name.trim()}:${excludeId ?? ''}:${kind === 'delegation' ? decisionNumber?.trim() ?? '' : ''}:${kind === 'petition' ? `${idNumber?.trim() ?? ''}:${phone?.trim() ?? ''}` : kind === 'incident' ? incidentSignals : ''}`;
  const latestKeyRef = useRef(currentKey);
  latestKeyRef.current = currentKey;

  const verify = async (): Promise<{ ok: boolean; acknowledgedIds: string[] }> => {
    const hasIncidentSignal = kind === 'incident' && [reporter, idNumber, phone, content, date, location].some((value) => value?.trim());
    if (name.trim().length < 2 && !(kind === 'delegation' && decisionNumber?.trim()) && !(kind === 'petition' && (idNumber?.trim() || phone?.trim())) && !hasIncidentSignal) {
      return { ok: true, acknowledgedIds: [] };
    }
    setLoading(true);
    setError('');
    try {
      const params = kind === 'petition'
        ? { name, idNumber: idNumber?.trim(), phone: phone?.trim(), excludeId }
        : kind === 'incident'
        ? { name, reporter, idNumber, phone, content, date, location, excludeId }
        : {
          name,
          excludeId,
          caseType: kind === 'delegation' ? 'UY_THAC_DIEU_TRA' : 'REGULAR',
          ...(kind === 'delegation' && { decisionNumber: decisionNumber?.trim() }),
        };
      const path = kind === 'petition' ? '/petitions/duplicate-review' : kind === 'incident' ? '/incidents/duplicate-review' : '/cases/duplicate-review';
      const response = kind === 'incident'
        ? await api.post<DuplicateCandidate[]>(path, params)
        : await api.get<DuplicateCandidate[]>(path, { params });
      if (latestKeyRef.current !== currentKey) return { ok: false, acknowledgedIds: [] };
      const matches = Array.isArray(response.data) ? response.data : [];
      const highIds = matches.filter((item) => item.confidence === 'HIGH').map((item) => item.id);
      const accepted = acceptedRef.current?.key === currentKey ? acceptedRef.current.ids : [];
      const ok = highIds.every((candidateId) => accepted.includes(candidateId));
      setCandidates(matches);
      setChecked(true);
      setCheckedKey(currentKey);
      setAcknowledged(ok && highIds.length > 0);
      setExpanded(true);
      return { ok, acknowledgedIds: ok ? accepted : [] };
    } catch {
      if (latestKeyRef.current === currentKey) {
        setError(recordReview.reviewUnavailable);
        setErrorKey(currentKey);
      }
      return { ok: false, acknowledgedIds: [] };
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({ verify }));

  const acknowledge = () => {
    acceptedRef.current = {
      key: currentKey,
      ids: candidates.filter((item) => item.confidence === 'HIGH').map((item) => item.id),
    };
    setAcknowledged(true);
    setExpanded(false);
  };

  const hasHigh = candidates.some((item) => item.confidence === 'HIGH');
  const isAcknowledged = acknowledged && acceptedRef.current?.key === currentKey;
  const hasCurrentReview = checked && checkedKey === currentKey;
  const visibleCandidates = hasCurrentReview && candidates.length > 0;
  const selectedCandidate = hasCurrentReview
    ? candidates.find((candidate) => candidate.id === openCandidateId)
    : undefined;
  const reasonLabel = (reason: string) => recordReview.reasons[reason as keyof typeof recordReview.reasons] ?? recordReview.reasons.OTHER;

  useEffect(() => {
    if (!selectedCandidate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenCandidateId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCandidate]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3" aria-label={recordReview.sectionLabel}>
      <button type="button" onClick={() => void verify()} disabled={loading || (name.trim().length < 2 && !(kind === 'delegation' && decisionNumber?.trim()) && !(kind === 'petition' && (idNumber?.trim() || phone?.trim())) && !(kind === 'incident' && [reporter, idNumber, phone, content, date, location].some((value) => value?.trim())))}
        className="text-sm font-medium text-blue-700 hover:underline disabled:text-slate-400">
        {loading ? recordReview.reviewLoading : recordReview.reviewAction}
      </button>
      {error && errorKey === currentKey && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      {hasCurrentReview && candidates.length === 0 && !(error && errorKey === currentKey) && <p className="mt-2 text-sm text-slate-600">{recordReview.noMatches}</p>}
      {visibleCandidates && (
        <div className="mt-2 space-y-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            {expanded ? recordReview.collapseAction : recordReview.expandAction}
          </button>
          {!expanded && <p className="text-sm text-slate-600">{recordReview.candidateCount.replace('{count}', String(candidates.length))}</p>}
          {hasHigh && isAcknowledged && <p className="text-sm text-green-700">{recordReview.acknowledged} {recordReview.continueForm}</p>}
          {expanded && <>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
              <button
                type="button"
                onClick={() => setOpenCandidateId(candidate.id)}
                className="font-semibold text-blue-700 underline-offset-2 hover:underline"
                aria-label={`${recordReview.candidateDetails}: ${candidate.caseCode ?? candidate.code ?? candidate.stt ?? candidate.name}`}
              >
                {candidate.caseCode ?? candidate.code ?? candidate.stt}
              </button>
              <span className="ml-2">{candidate.name}</span>
              <span className="ml-2 text-slate-500">
                {candidate.confidence === 'HIGH' ? recordReview.highConfidence : recordReview.possibleMatch}
              </span>
              {candidate.reasons.length > 0 && <p className="mt-1 text-slate-600">{candidate.reasons.map(reasonLabel).join(', ')}</p>}
            </div>
          ))}
          </div>
          {hasHigh && !isAcknowledged && (
            <button type="button" onClick={acknowledge} className="rounded bg-blue-700 px-3 py-2 text-sm text-white">
              {recordReview.acknowledgeAction}
            </button>
          )}
          </>}
        </div>
      )}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpenCandidateId(null);
        }}>
          <div role="dialog" aria-modal="true" aria-label={recordReview.candidateDetails} className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-900">{recordReview.candidateDetails}</h2>
              <div className="flex flex-wrap gap-3 text-sm">
                <button type="button" onClick={() => { setOpenCandidateId(null); setExpanded(false); }} className="text-blue-700 hover:underline">{recordReview.minimizeDetails}</button>
                <button type="button" autoFocus onClick={() => setOpenCandidateId(null)} className="text-blue-700 hover:underline">{recordReview.closeDetails}</button>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="font-medium text-slate-600">{recordReview.recordNumber}</dt><dd>{selectedCandidate.stt ?? selectedCandidate.caseCode ?? selectedCandidate.code ?? '—'}</dd>
              <dt className="font-medium text-slate-600">{recordReview.candidateName}</dt><dd>{selectedCandidate.name}</dd>
              <dt className="font-medium text-slate-600">{recordReview.confidence}</dt><dd>{selectedCandidate.confidence === 'HIGH' ? recordReview.highConfidence : recordReview.possibleMatch}</dd>
              <dt className="font-medium text-slate-600">{recordReview.reason}</dt><dd>{selectedCandidate.reasons.map(reasonLabel).join(', ') || recordReview.reasons.OTHER}</dd>
              {selectedCandidate.receivedDate && <><dt className="font-medium text-slate-600">{recordReview.receivedDate}</dt><dd>{selectedCandidate.receivedDate}</dd></>}
              {selectedCandidate.summary && <><dt className="font-medium text-slate-600">{recordReview.summary}</dt><dd className="break-words">{selectedCandidate.summary}</dd></>}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
});
