import type { FeatureManifest } from '../feature-flags/feature-manifest';

/**
 * Ward assignment requests ("Hồ sơ phân công Công an cấp phường/xã"): a ward or commune police unit asks PC02 to
 * assign an investigator; PC02 reviews each submission, returns it or approves it, and follows the result.
 *
 * OFF until an administrator turns it on: its row is inserted disabled by the migration `ward_assignments` (a flag with
 * no row would read as ON).
 */
export const WARD_ASSIGNMENTS_MANIFEST: FeatureManifest = {
  key: 'ward-assignments',
  label: 'Hồ sơ phân công phường/xã',
  description: 'Công an cấp phường/xã trình hồ sơ xin phân công Điều tra viên; PC02 thẩm định, duyệt hoặc trả về, theo dõi hạn báo kết quả',
  domain: 'case-domain',
  defaultEnabled: false,
  permissions: [
    { action: 'read', subject: 'WardAssignment' },
    { action: 'write', subject: 'WardAssignment' },
    { action: 'edit', subject: 'WardAssignment' },
    { action: 'delete', subject: 'WardAssignment' },
    { action: 'review', subject: 'WardAssignment' },
    { action: 'matchSubjects', subject: 'WardAssignment' },
  ],
};
