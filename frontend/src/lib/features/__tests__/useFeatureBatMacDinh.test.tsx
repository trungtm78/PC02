import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { FeatureFlagsProvider } from '../FeatureFlagsContext';
import { useFeatureBatMacDinh } from '../useFeature';
import type { FeatureFlag } from '../types';

const co = (enabled: boolean): FeatureFlag => ({
  key: 'TIM_KIEM_THE',
  label: 'Tìm kiếm dạng thẻ',
  description: null,
  enabled,
  domain: null,
  rolloutPct: 100,
});

const boc =
  (flags?: FeatureFlag[]) =>
  ({ children }: { children: ReactNode }) =>
    flags ? <FeatureFlagsProvider initialFlags={flags}>{children}</FeatureFlagsProvider> : <>{children}</>;

/**
 * Cờ dạng CÔNG TẮC KHẨN: tính năng BẬT trừ khi quản trị chủ động tắt. Khác `useFeature` (tắt khi
 * chưa nạp/chưa seed) — với tính năng thay thế ô đang dùng, "chưa seed cờ" mà làm biến mất tính
 * năng thì mỗi lần deploy quên `db:seed:features` là một lần lùi giao diện.
 */
describe('useFeatureBatMacDinh', () => {
  it('không có provider (ca kiểm, trang nhúng) → bật', () => {
    expect(renderHook(() => useFeatureBatMacDinh('TIM_KIEM_THE')).result.current).toBe(true);
  });

  it('cờ chưa seed → bật', () => {
    const { result } = renderHook(() => useFeatureBatMacDinh('TIM_KIEM_THE'), { wrapper: boc([]) });
    expect(result.current).toBe(true);
  });

  it('cờ bật → bật; cờ tắt → tắt', () => {
    expect(
      renderHook(() => useFeatureBatMacDinh('TIM_KIEM_THE'), { wrapper: boc([co(true)]) }).result
        .current,
    ).toBe(true);
    expect(
      renderHook(() => useFeatureBatMacDinh('TIM_KIEM_THE'), { wrapper: boc([co(false)]) }).result
        .current,
    ).toBe(false);
  });
});
