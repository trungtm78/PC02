import { createContext } from 'react';
import type { FeatureFlag } from './types';

export interface FeatureFlagsContextValue {
  flags: Map<string, FeatureFlag>;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Đối tượng context tách khỏi `FeatureFlagsContext.tsx`: hook đọc cờ đặt ở tệp `.ts` được, không
 * làm tệp component xuất thêm thứ không phải component (phá fast refresh).
 */
export const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);
