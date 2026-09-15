import { useContext } from 'react';
import { useFeatureFlagsContext } from './FeatureFlagsContext';
import { FeatureFlagsContext } from './featureFlagsContextObject';

/**
 * Cờ dạng CÔNG TẮC KHẨN: BẬT trừ khi quản trị chủ động tắt cờ ấy.
 *
 * Ngược với `useFeature` (tắt khi đang nạp hoặc cờ chưa seed). Dùng cho tính năng THAY THẾ một
 * thứ đang chạy: ở đó "chưa seed cờ" mà làm tính năng biến mất thì mỗi lần deploy quên chạy
 * `db:seed:features` là một lần giao diện lùi về bản cũ không ai hay.
 */
export function useFeatureBatMacDinh(key: string): boolean {
  // Đọc context thẳng (không qua `useFeatureFlagsContext`): thiếu provider thì trả null thay vì ném.
  return useContext(FeatureFlagsContext)?.flags.get(key)?.enabled !== false;
}

/**
 * Returns true when the given feature key is enabled for the current user.
 *
 * Conservative default during initial load: returns `false` while flags are
 * still loading so that UI never flashes a disabled feature. Callers that
 * want optimistic rendering can read `isLoading` directly via
 * `useFeatureFlagsContext`.
 *
 * If a flag key has never been seeded (e.g. a brand new module), this
 * returns `false` because the backend does not know about it. To allow
 * unseeded features, use the `allowUnknown` option.
 */
export function useFeature(
  key: string,
  opts: { allowUnknown?: boolean } = {},
): boolean {
  const { flags, isLoading } = useFeatureFlagsContext();
  if (isLoading) return false;
  const flag = flags.get(key);
  if (!flag) return opts.allowUnknown ?? false;
  return flag.enabled;
}

/**
 * Returns all enabled flags. Useful for building a dynamic menu.
 */
export function useEnabledFeatures(): string[] {
  const { flags } = useFeatureFlagsContext();
  return Array.from(flags.values())
    .filter((f) => f.enabled)
    .map((f) => f.key);
}
