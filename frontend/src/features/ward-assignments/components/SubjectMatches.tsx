import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractApiError } from '@/lib/api-errors';
import { wardAssignmentAlerts as t } from '@/locales/wardAssignmentAlerts.vi';
import { wardAlertsApi, type MatchSource, type SubjectMatch } from '../api/alerts';

/**
 * "Đối tượng trùng" of a ward assignment request: what the server found within the person's reach (it lists and
 * counts nothing else, so nothing here hints at more). A reviewer (`canConclude`) marks a pair "the same person" or
 * "not the same"; "not the same" removes it from the list.
 */
export interface SubjectMatchesProps {
  assignmentId: string;
  canConclude: boolean;
}

const LINK: Record<MatchSource, (id: string) => string | null> = {
  WARD_ASSIGNMENT: (id) => `/ho-so-phan-cong/${encodeURIComponent(id)}`,
  PETITION: (id) => `/petitions/${encodeURIComponent(id)}`,
  CASE: (id) => `/cases/${encodeURIComponent(id)}`,
  INCIDENT: (id) => `/incidents/${encodeURIComponent(id)}`,
};

const keyOf = (m: SubjectMatch) => `${m.subjectPosition}|${m.source}|${m.recordId}`;

export function SubjectMatches({ assignmentId, canConclude }: SubjectMatchesProps) {
  const [matches, setMatches] = useState<SubjectMatch[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The answer of the latest load only: switching to another request (or reloading) makes earlier answers stale.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setLoadError(false);
    try {
      const found = await wardAlertsApi.subjectMatches(assignmentId);
      if (ticket === latest.current) setMatches(found);
    } catch {
      if (ticket !== latest.current) return;
      setMatches(null);
      setLoadError(true);
    }
  }, [assignmentId]);

  useEffect(() => {
    // Another request: nothing of the previous one stays on screen (nor can be concluded on).
    setMatches(null);
    setSaveError(null);
    void load();
  }, [load]);

  const conclude = async (match: SubjectMatch, samePerson: boolean) => {
    const key = keyOf(match);
    setSaving(key);
    setSaveError(null);
    try {
      await wardAlertsApi.conclude(assignmentId, { subjectPosition: match.subjectPosition, otherSource: match.source, otherRecordId: match.recordId, samePerson });
      await load();
    } catch (error) {
      const code = extractApiError(error).code;
      setSaveError((code && t.errors[code]) || t.matches.saveFailed);
    } finally {
      setSaving(null);
    }
  };

  if (loadError) {
    return (
      <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {t.matches.loadFailed}{' '}
        <button type="button" className="underline" onClick={() => void load()}>
          {t.matches.retry}
        </button>
      </div>
    );
  }
  if (matches === null) return <p className="text-sm text-slate-500">{t.matches.loading}</p>;
  if (matches.length === 0) return <p className="text-sm text-slate-500" data-testid="ward-matches-none">{t.matches.none}</p>;

  const positions = [...new Set(matches.map((m) => m.subjectPosition))].sort((a, b) => a - b);
  return (
    <section aria-label={t.matches.title} className="space-y-3">
      {saveError && (
        <p role="alert" className="text-sm text-red-700">
          {saveError}
        </p>
      )}
      {positions.map((position) => (
        <div key={position}>
          <h4 className="mb-1 text-sm font-semibold text-slate-700">{t.matches.subject(position)}</h4>
          <ul className="divide-y rounded border">
            {matches
              .filter((m) => m.subjectPosition === position)
              .map((m) => {
                const href = LINK[m.source]?.(m.recordId) ?? null;
                const label = `${t.matches.source[m.source] ?? m.source}${m.code ? ` ${m.code}` : ''}`;
                const key = keyOf(m);
                return (
                  <li key={key} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm" data-testid="ward-match-row">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${m.level === 'CERTAIN' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                      {m.source === 'PETITION' ? t.matches.possibleByName : t.matches.level[m.level]}
                    </span>
                    {href ? (
                      <Link to={href} className="font-medium text-blue-700 hover:underline">
                        {label}
                      </Link>
                    ) : (
                      <span className="font-medium">{label}</span>
                    )}
                    {m.unitName && <span className="text-slate-500">· {m.unitName}</span>}
                    <span className="text-slate-700">· {m.name}</span>
                    {m.concludedSame && <span className="text-xs text-green-700">{t.matches.concludedSame}</span>}
                    {canConclude && (
                      <span className="ml-auto flex gap-1">
                        <button type="button" disabled={saving === key} className="rounded border px-2 py-0.5 text-xs hover:bg-slate-50 disabled:opacity-50" onClick={() => void conclude(m, true)}>
                          {t.matches.same}
                        </button>
                        <button type="button" disabled={saving === key} className="rounded border px-2 py-0.5 text-xs hover:bg-slate-50 disabled:opacity-50" onClick={() => void conclude(m, false)}>
                          {t.matches.notSame}
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      <p className="text-xs text-slate-500">{t.matches.scopeNote}</p>
    </section>
  );
}

export default SubjectMatches;
