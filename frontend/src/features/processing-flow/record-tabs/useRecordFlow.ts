/**
 * The flow of one record, read once and shared by both tabs through the react-query cache. `state` tells the screen
 * which of its four faces to show: loading, no flow applied yet, the feature switch off, a failed read, or the flow.
 */
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { extractApiError } from '@/lib/api-errors';
import { explainError, isFeatureOff } from '../errors';
import { processingRecordApi } from './api';
import { RECORD_QUERY_KEYS } from './queryKeys';
import type { RecordFlowDto, RecordKind } from './types';

const NOT_FOUND_CODE = 'RECORD_FLOW_NOT_FOUND';

/** 404 with the code of the contract: this record has no flow (or the person may not read it). */
export function isNoFlow(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 404 && extractApiError(err, '').code === NOT_FOUND_CODE;
}

export type RecordFlowState = 'loading' | 'none' | 'off' | 'error' | 'ready';

export interface RecordFlowHandle {
  state: RecordFlowState;
  flow: RecordFlowDto | null;
  /** The sentence of a failed first read. */
  errorMessage: string | null;
  /** A refresh is running (after a conflict, or a retry). */
  refreshing: boolean;
  /** The last read failed while an earlier answer is still held. */
  refreshFailed: boolean;
  refetch: () => Promise<unknown>;
  /** Put the flow a write answered straight into the cache. */
  setFlow: (next: RecordFlowDto) => void;
}

export function useRecordFlow(kind: RecordKind, recordId: string): RecordFlowHandle {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: RECORD_QUERY_KEYS.flow(kind, recordId),
    queryFn: () => processingRecordApi.get(kind, recordId),
    enabled: recordId !== '',
    retry: false,
    refetchOnWindowFocus: false,
  });

  const setFlow = useCallback(
    (next: RecordFlowDto) => {
      queryClient.setQueryData(RECORD_QUERY_KEYS.flow(kind, recordId), next);
    },
    [queryClient, kind, recordId],
  );

  let state: RecordFlowState = 'ready';
  if (query.data === undefined) {
    if (query.isError) state = isNoFlow(query.error) ? 'none' : isFeatureOff(query.error) ? 'off' : 'error';
    else state = 'loading';
  }

  return {
    state,
    flow: query.data ?? null,
    errorMessage: state === 'error' ? explainError(query.error).message : null,
    refreshing: query.isFetching,
    refreshFailed: query.isError && query.data !== undefined,
    refetch: query.refetch,
    setFlow,
  };
}
