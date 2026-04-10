import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

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

export function useBadgeCounts() {
  const [counts, setCounts] = useState<BadgeCounts>(DEFAULT_COUNTS);
  const [loading, setLoading] = useState(true);

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
    fetchCounts();
    const timer = setInterval(fetchCounts, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchCounts]);

  return { counts, loading, refresh: fetchCounts };
}
