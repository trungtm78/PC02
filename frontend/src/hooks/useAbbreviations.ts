import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { abbreviationsApi } from '@/lib/api';

const QUERY_KEY = ['abbreviations'];

export function useAbbreviationList() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => abbreviationsApi.list().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAbbreviationMap() {
  const { data = [] } = useAbbreviationList();
  return new Map(data.map((a) => [a.shortcut, a.expansion]));
}

export function useUpsertAbbreviation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shortcut, expansion }: { shortcut: string; expansion: string }) =>
      abbreviationsApi.upsert(shortcut, expansion),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteAbbreviation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shortcut: string) => abbreviationsApi.remove(shortcut),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useCopyAbbreviations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceUserId, replace }: { sourceUserId: string; replace: boolean }) =>
      abbreviationsApi.copyFrom(sourceUserId, replace),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAbbreviationUsers() {
  return useQuery({
    queryKey: ['abbreviation-users'],
    queryFn: () => abbreviationsApi.listUsers().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}
