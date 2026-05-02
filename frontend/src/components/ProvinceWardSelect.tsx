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
 * Cascade address select: Tỉnh/TP → Phường/Xã
 *
 * Architecture:
 *   Province (32 entries) → fetched by type=PROVINCE
 *   Ward (up to 1000/province) → fetched by parentId={province.id}
 *                                  after province is selected
 *
 * Province code (HCM, HN, ...) is stored in formData for stability.
 * Province id is looked up at query time from the province list.
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
  // Step 1: Load all 32 provinces (small list — cache 10 min)
  const { data: provinces, isLoading: provincesLoading } = useQuery({
    queryKey: ['directories', 'PROVINCE', 'all'],
    queryFn: async () => {
      const res = await api.get('/directories?type=PROVINCE&limit=100&isActive=true');
      return (res.data?.data ?? []) as ProvinceEntry[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const provinceOptions = (provinces ?? []).map(p => ({
    value: p.code,
    label: p.name,
  }));

  // Step 2: Look up province DB id by code (stable — codes don't change)
  const selectedProvince = (provinces ?? []).find(p => p.code === provinceCode);

  // Step 3: Load wards for selected province only — up to 1000 (max province HN=647)
  const { data: wards, isLoading: wardsLoading } = useQuery({
    queryKey: ['directories', 'WARD', selectedProvince?.id],
    queryFn: async () => {
      const res = await api.get(
        `/directories?type=WARD&parentId=${selectedProvince!.id}&limit=1000&isActive=true`,
      );
      return (res.data?.data ?? []) as WardEntry[];
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
        options={wardOptions}
        loading={wardsLoading}
        placeholder={wardPlaceholder}
        disabled={!selectedProvince || wardsLoading}
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
