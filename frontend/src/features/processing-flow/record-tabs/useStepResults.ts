import { useQuery } from '@tanstack/react-query';
import { processingRecordApi } from './api';
import { RECORD_QUERY_KEYS } from './queryKeys';
import type { RecordKind } from './types';

/** The book (reports and opinions) of one step. Read only when the step is opened; every write refreshes it. */
export function useStepResults(kind: RecordKind, recordId: string, stepKey: string, enabled: boolean) {
  return useQuery({
    queryKey: RECORD_QUERY_KEYS.results(kind, recordId, stepKey),
    queryFn: () => processingRecordApi.results(kind, recordId, stepKey),
    enabled: enabled && recordId !== '',
    retry: false,
    refetchOnWindowFocus: false,
  });
}
