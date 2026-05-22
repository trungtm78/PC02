import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FKSelect } from './FKSelect';

interface ProvinceWardSelectProps {
  /** Province code stored in form data (e.g. 'HCM', 'HN') */
  provinceCode: string;
  /** Ward name stored in form data */
  ward: string;
  onProvinceChange: (code: string) => void;
  onWardChange: (wardName: string) => void;
  errors?: { province?: string; ward?: string };
  required?: boolean;
  testIdPrefix?: string;
}

interface ProvinceEntry {
  id: string;
  code: string;
  name: string;
}

interface WardEntry {
  id: string;
  name: string;
}

/**
 * Cascade address select: Tỉnh/TP → Phường/Xã (LEGACY — stores codes/names as strings).
 *
 * v0.34.0.2: switched from /directories endpoint → /admin-units to pick up only
 * active post-reform 2025 entries (filter abolished legacy automatically) and
 * give consistent smart-search behaviour with SingleWardPicker.
 *
 * Architecture:
 *   Province (34 entries) → GET /admin-units/provinces
 *   Ward (up to ~600/province) → GET /admin-units/wards?provinceId=X
 *
 * Province code (HCM, HN, ...) is stored in formData for stability.
 * Province id is looked up at query time from the province list.
 *
 * For new code prefer SingleWardPicker (returns wardId DB id, not stringly typed).
 */
export function ProvinceWardSelect({
  provinceCode,
  ward,
  onProvinceChange,
  onWardChange,
  errors,
  required = false,
  testIdPrefix = '',
}: ProvinceWardSelectProps) {
  // Step 1: Load all 34 provinces từ admin-units (cached 1h)
  const { data: provinces, isLoading: provincesLoading } = useQuery({
    queryKey: ['admin-units', 'provinces'],
    queryFn: async () => {
      const res = await api.get<ProvinceEntry[]>('/admin-units/provinces');
      return res.data;
    },
    staleTime: 60 * 60 * 1000,
  });

  const provinceOptions = (provinces ?? []).map(p => ({
    value: p.code,
    label: p.name,
  }));

  // Step 2: Look up province DB id by code (stable — codes don't change)
  const selectedProvince = (provinces ?? []).find(p => p.code === provinceCode);

  // Step 3: Load wards for selected province (admin-units endpoint = active only)
  const { data: wards, isLoading: wardsLoading } = useQuery({
    queryKey: ['admin-units', 'wards', selectedProvince?.id],
    queryFn: async () => {
      const res = await api.get<WardEntry[]>('/admin-units/wards', {
        params: { provinceId: selectedProvince!.id },
      });
      return res.data;
    },
    enabled: !!selectedProvince?.id,
    staleTime: 5 * 60 * 1000,
  });

  const wardOptions = (wards ?? []).map(w => ({ value: w.name, label: w.name }));
  const wardEmpty = !wardsLoading && !!selectedProvince && wardOptions.length === 0;

  const wardPlaceholder = !selectedProvince
    ? '-- Chọn tỉnh/TP trước --'
    : wardsLoading
    ? 'Đang tải phường/xã...'
    : wardEmpty
    ? 'Không có dữ liệu'
    : '-- Tìm hoặc chọn phường/xã --';

  return (
    <>
      <FKSelect
        label="Tỉnh/Thành phố"
        required={required}
        value={provinceCode}
        onChange={(v) => {
          onProvinceChange(v);
          onWardChange(''); // reset ward when province changes
        }}
        options={provinceOptions}
        loading={provincesLoading}
        placeholder="-- Chọn tỉnh/TP --"
        canCreate={false}
        error={errors?.province}
        testId={testIdPrefix ? `${testIdPrefix}-province` : 'fk-province'}
      />

      <FKSelect
        label="Phường/Xã"
        required={required}
        value={ward}
        onChange={onWardChange}
        options={selectedProvince ? wardOptions : []}
        loading={wardsLoading}
        placeholder={wardPlaceholder}
        canCreate={false}
        error={errors?.ward}
        testId={testIdPrefix ? `${testIdPrefix}-ward` : 'fk-ward'}
      />

      {wardEmpty && (
        <p className="text-xs text-amber-600 col-span-2 -mt-2">
          Chưa có phường/xã cho tỉnh này. Liên hệ admin chạy{' '}
          <code className="font-mono">npm run db:seed</code>.
        </p>
      )}
    </>
  );
}
