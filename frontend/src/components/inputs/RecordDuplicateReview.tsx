import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { recordReview } from '@/locales/vi';

type RecordKind = 'incident' | 'case' | 'delegation' | 'petition';
type DuplicateCandidate = {
  id: string;
  name: string;
  code?: string;
  caseCode?: string;
  stt?: string;
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
}

export const RecordDuplicateReview = forwardRef<
  RecordDuplicateReviewHandle,
  RecordDuplicateReviewProps
>(function RecordDuplicateReview({ kind, name, excludeId, decisionNumber, idNumber, phone }, ref) {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [checked, setChecked] = useState(false);
  const [checkedKey, setCheckedKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const acceptedRef = useRef<{ key: string; ids: string[] } | null>(null);
  const currentKey = `${kind}:${name.trim()}:${excludeId ?? ''}:${kind === 'delegation' ? decisionNumber?.trim() ?? '' : ''}:${kind === 'petition' ? `${idNumber?.trim() ?? ''}:${phone?.trim() ?? ''}` : ''}`;
  const latestKeyRef = useRef(currentKey);
  latestKeyRef.current = currentKey;

  const verify = async (): Promise<{ ok: boolean; acknowledgedIds: string[] }> => {
    if (name.trim().length < 2 && !(kind === 'delegation' && decisionNumber?.trim()) && !(kind === 'petition' && (idNumber?.trim() || phone?.trim()))) {
      return { ok: true, acknowledgedIds: [] };
    }
    setLoading(true);
    setError('');
    try {
      const params = kind === 'petition'
        ? { name, idNumber: idNumber?.trim(), phone: phone?.trim(), excludeId }
        : kind === 'incident'
        ? { name, excludeId }
        : {
          name,
          excludeId,
          caseType: kind === 'delegation' ? 'UY_THAC_DIEU_TRA' : 'REGULAR',
          ...(kind === 'delegation' && { decisionNumber: decisionNumber?.trim() }),
        };
      const path = kind === 'petition' ? '/petitions/duplicate-review' : kind === 'incident' ? '/incidents/duplicate-review' : '/cases/duplicate-review';
      const response = await api.get<DuplicateCandidate[]>(path, { params });
      if (latestKeyRef.current !== currentKey) return { ok: false, acknowledgedIds: [] };
      const matches = Array.isArray(response.data) ? response.data : [];
      const highIds = matches.filter((item) => item.confidence === 'HIGH').map((item) => item.id);
      const accepted = acceptedRef.current?.key === currentKey ? acceptedRef.current.ids : [];
      const ok = highIds.every((candidateId) => accepted.includes(candidateId));
      setCandidates(matches);
      setChecked(true);
      setCheckedKey(currentKey);
      setAcknowledged(ok && highIds.length > 0);
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
  };

  const hasHigh = candidates.some((item) => item.confidence === 'HIGH');
  const isAcknowledged = acknowledged && acceptedRef.current?.key === currentKey;
  const hasCurrentReview = checked && checkedKey === currentKey;
  const visibleCandidates = hasCurrentReview && candidates.length > 0;
  const reasonLabel = (reason: string) => recordReview.reasons[reason as keyof typeof recordReview.reasons] ?? recordReview.reasons.OTHER;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3" aria-label={recordReview.sectionLabel}>
      <button type="button" onClick={() => void verify()} disabled={loading || (name.trim().length < 2 && !(kind === 'delegation' && decisionNumber?.trim()) && !(kind === 'petition' && (idNumber?.trim() || phone?.trim())))}
        className="text-sm font-medium text-blue-700 hover:underline disabled:text-slate-400">
        {loading ? recordReview.reviewLoading : recordReview.reviewAction}
      </button>
      {error && errorKey === currentKey && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      {hasCurrentReview && candidates.length === 0 && !(error && errorKey === currentKey) && <p className="mt-2 text-sm text-slate-600">{recordReview.noMatches}</p>}
      {visibleCandidates && (
        <div className="mt-2 space-y-2">
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
              <span className="font-semibold">{candidate.caseCode ?? candidate.code ?? candidate.stt}</span>
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
          {hasHigh && isAcknowledged && <p className="text-sm text-green-700">{recordReview.acknowledged}</p>}
        </div>
      )}
    </section>
  );
});
