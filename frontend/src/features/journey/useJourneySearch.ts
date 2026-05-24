import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

export type EntitySearchType = 'CASE' | 'PETITION' | 'INCIDENT';

export interface EntitySearchResult {
  id: string;
  stt: string;
  name?: string;
  code?: string;
  status?: string;
  entityType: EntitySearchType;
}

interface SearchState {
  results: EntitySearchResult[];
  isLoading: boolean;
  isError: boolean;
}

export function useJourneySearch(query: string, debounceMs = 300) {
  const [state, setState] = useState<SearchState>({ results: [], isLoading: false, isError: false });
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setState({ results: [], isLoading: false, isError: false });
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      setState((s) => ({ ...s, isLoading: true, isError: false }));

      try {
        const [casesRes, petitionsRes, incidentsRes] = await Promise.allSettled([
          api.get(`/cases?search=${encodeURIComponent(query)}&limit=20`, { signal }),
          api.get(`/petitions?search=${encodeURIComponent(query)}&limit=20`, { signal }),
          api.get(`/incidents?search=${encodeURIComponent(query)}&limit=20`, { signal }),
        ]);

        if (signal.aborted) return;

        const results: EntitySearchResult[] = [];

        if (casesRes.status === 'fulfilled') {
          const items = (casesRes.value.data?.data ?? casesRes.value.data ?? []) as any[];
          results.push(...items.map((c: any) => ({
            id: c.id,
            stt: c.stt ?? '',
            name: c.name ?? '',
            status: c.status,
            entityType: 'CASE' as EntitySearchType,
          })));
        }

        if (petitionsRes.status === 'fulfilled') {
          const items = (petitionsRes.value.data?.data ?? petitionsRes.value.data ?? []) as any[];
          results.push(...items.map((p: any) => ({
            id: p.id,
            stt: p.stt ?? '',
            name: p.name ?? p.petitionTitle ?? '',
            status: p.status,
            entityType: 'PETITION' as EntitySearchType,
          })));
        }

        if (incidentsRes.status === 'fulfilled') {
          const items = (incidentsRes.value.data?.data ?? incidentsRes.value.data ?? []) as any[];
          results.push(...items.map((i: any) => ({
            id: i.id,
            stt: i.code ?? '',
            name: i.name ?? i.description ?? '',
            status: i.status,
            entityType: 'INCIDENT' as EntitySearchType,
          })));
        }

        setState({ results, isLoading: false, isError: false });
      } catch (err: any) {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
        setState({ results: [], isLoading: false, isError: true });
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs]);

  return state;
}
