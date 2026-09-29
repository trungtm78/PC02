import { useCallback } from 'react';
import { api } from '@/lib/api';
import { recordReview } from '@/locales/vi';
import { ONhapGoiY } from './ONhapGoiY';

type RecordKind = 'incident' | 'case' | 'delegation';
type NameSuggestion = { name: string; count: number };

interface RecordNameSuggestionsProps {
  kind: RecordKind;
  value: string;
  onChange: (value: string) => void;
  testId: string;
  className?: string;
  disabled?: boolean;
  incidentField?: 'title' | 'reporter';
}

export function RecordNameSuggestions({
  kind,
  value,
  onChange,
  testId,
  className,
  disabled,
  incidentField = 'title',
}: RecordNameSuggestionsProps) {
  const findSuggestions = useCallback(async (q: string): Promise<NameSuggestion[]> => {
    const params = kind === 'incident'
      ? { q }
      : { q, caseType: kind === 'delegation' ? 'UY_THAC_DIEU_TRA' : 'REGULAR' };
    const path = kind === 'incident'
      ? incidentField === 'reporter' ? '/incidents/reporter-suggestions' : '/incidents/name-suggestions'
      : '/cases/name-suggestions';
    const response = await api.get<NameSuggestion[]>(path, { params });
    return Array.isArray(response.data) ? response.data : [];
  }, [incidentField, kind]);

  return (
    <ONhapGoiY<NameSuggestion>
      value={value}
      onChange={onChange}
      timGoiY={findSuggestions}
      khoa={(item) => item.name}
      nhan={(item) => item.name}
      hien={(item) => (
        <>
          <span className="font-medium">{item.name}</span>
          <span className="ml-2 text-xs text-slate-500">
            {recordReview.usedCount.replace('{count}', String(item.count))}
          </span>
        </>
      )}
      placeholder={recordReview.namePlaceholder}
      className={className}
      testId={testId}
      disabled={disabled}
    />
  );
}
