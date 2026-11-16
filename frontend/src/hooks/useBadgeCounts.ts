import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { usePermission } from './usePermission';

export interface BadgeCounts {
  cases: number;
  suspects: number;
  petitions: number;
  incidents: number;
  overdueRecords: number;
}

const DEFAULT_COUNTS: BadgeCounts = {
  cases: 0,
  suspects: 0,
  petitions: 0,
  incidents: 0,
  overdueRecords: 0,
};

// Refresh interval: 2 minutes
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

/**
 * The counts on the menu. The server answers them to whoever reads cases (`read:Case`); somebody who does not (a ward
 * unit's officer holding only the ward assignment template) is not asked for them every two minutes to be refused.
 * Asked once the profile says so: the profile is read again from /auth/me on every load and `usePermission` draws again
 * when it arrives, so waiting costs a moment, not the counts.
 */
export function useBadgeCounts() {
  const [counts, setCounts] = useState<BadgeCounts>(DEFAULT_COUNTS);
  const [loading, setLoading] = useState(true);
  const { permissions } = usePermission();
  // Booleans, not the list: the list may be a new array on every render, and the effect must not run again for it.
  const loaded = permissions !== null;
  const mayRead = loaded && permissions.includes('read:Case');

  const fetchCounts = useCallback(async () => {
    try {
      const { data } = await api.get<{ success: boolean; data: BadgeCounts }>(
        '/dashboard/badge-counts',
      );
      if (data.success) {
        setCounts(data.data);
      }
    } catch {
      // silently ignore - keep last known counts
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mayRead) {
      setCounts(DEFAULT_COUNTS);
      setLoading(!loaded);
      return;
    }
    fetchCounts();
    const timer = setInterval(fetchCounts, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchCounts, mayRead, loaded]);

  return { counts, loading, refresh: fetchCounts };
}
