import { QueryClient } from '@tanstack/react-query';

/**
 * The app's query client.
 *
 * Most screens read data that changes rarely, so a copy is good for five minutes. The "Báo cáo động" screens are the
 * opposite: they show figures, states and revisions that other people change (an editor saves, a manager returns or
 * approves), and the next write is judged against the revision the screen holds. A five-minute copy meant a reopened
 * screen showed old values and an old "editable", and the next save was refused as a revision conflict. So everything
 * under `['dynamic-reports', …]` is stale at once and dropped when no screen shows it: reopening a screen always asks
 * the server.
 *
 * The input grid is the one exception to refetching on window focus: a refetch while someone is typing would put a
 * newer revision under their unsaved edits.
 */
export function createAppQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 5 * 60 * 1000 },
    },
  });
  client.setQueryDefaults(['dynamic-reports'], { staleTime: 0, gcTime: 0 });
  client.setQueryDefaults(['dynamic-reports', 'submission'], { refetchOnWindowFocus: false });
  return client;
}
