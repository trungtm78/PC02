import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { FKSelect } from './FKSelect';

/**
 * SingleWardPicker — 2-tier smart cascade (Tỉnh → Phường) returning ward DB id.
 * v0.34.0.2 — refactored to FKSelect (autocomplete + fuzzy + Vietnamese diacritics)
 *
 * Replaces plain text wardId input in TeamsPage. Used by any form needing
 * single-ward selection.
 *
 * Design decisions:
 * - FKSelect underneath gives search-as-you-type, keyboard nav, diacritics
 *   stripping for matching (Phase 2 D1 search-first + D6 a11y)
 * - D3 reverse lookup: if `value` is set on mount but provinces not loaded,
 *   call GET /admin-units/wards/:id to derive selected provinceId immediately
 *   so both dropdowns render with correct labels (no flash of empty)
 * - D5 cascade: choosing province resets ward
 * - D7 tablet-friendly: FKSelect input has 44px+ touch target
 */

interface Province {
  id: string;
  code: string;
  name: string;
  officialCode: string | null;
}

interface Ward {
  id: string;
  code: string;
  name: string;
  officialCode: string | null;
}

interface WardDetail extends Ward {
  province: Province | null;
}

interface SingleWardPickerProps {
  value: string | null; // wardId (DB id)
  onChange: (wardId: string | null) => void;
  label?: string;
  helperText?: string;
  required?: boolean;
  testIdPrefix?: string;
}

export function SingleWardPicker({
  value,
  onChange,
  label,
  helperText,
  required = false,
  testIdPrefix = 'ward-picker',
}: SingleWardPickerProps) {
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);

  // 1. Load all provinces (cached 1h)
  const { data: provinces, isLoading: provincesLoading } = useQuery({
    queryKey: ['admin-units', 'provinces'],
    queryFn: async () => {
      const res = await api.get<Province[]>('/admin-units/provinces');
      return res.data;
    },
    staleTime: 60 * 60 * 1000,
  });

  // 2. D3 reverse lookup: if `value` set but no province selected yet
  const { data: initialWard, isLoading: initialWardLoading } = useQuery({
    queryKey: ['admin-units', 'ward', value],
    queryFn: async () => {
      if (!value) return null;
      const res = await api.get<WardDetail>(`/admin-units/wards/${value}`);
      return res.data;
    },
    enabled: !!value && !selectedProvinceId,
    staleTime: 60 * 60 * 1000,
  });

  // Sync: when reverse lookup completes, derive selectedProvinceId
  useEffect(() => {
    if (initialWard?.province?.id && !selectedProvinceId) {
      setSelectedProvinceId(initialWard.province.id);
    }
  }, [initialWard, selectedProvinceId]);

  // 3. Load wards for selected province
  const { data: wards, isLoading: wardsLoading } = useQuery({
    queryKey: ['admin-units', 'wards', selectedProvinceId],
    queryFn: async () => {
      if (!selectedProvinceId) return [];
      const res = await api.get<Ward[]>('/admin-units/wards', {
        params: { provinceId: selectedProvinceId },
      });
      return res.data;
    },
    enabled: !!selectedProvinceId,
    staleTime: 5 * 60 * 1000,
  });

  // Convert to FKSelect options
  const provinceOptions = useMemo(
    () =>
      (provinces ?? []).map((p) => ({
        value: p.id,
        label: p.name,
      })),
    [provinces],
  );

  const wardOptions = useMemo(
    () =>
      (wards ?? []).map((w) => ({
        value: w.id,
        label: w.officialCode ? `${w.name} (${w.officialCode})` : w.name,
      })),
    [wards],
  );

  const wardPlaceholder = !selectedProvinceId
    ? '-- Chọn tỉnh/TP trước --'
    : wardsLoading
      ? 'Đang tải phường/xã...'
      : wardOptions.length === 0
        ? 'Không có phường/xã'
        : '-- Tìm hoặc chọn phường/xã --';

  // Skeleton shown only during cold-cache reverse lookup (no layout shift)
  const showReverseLookupSkeleton = !!value && !selectedProvinceId && initialWardLoading;

  return (
    <div data-testid={`${testIdPrefix}-container`} className="space-y-2">
      {label && (
        <label className="block text-xs font-medium text-slate-600">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {showReverseLookupSkeleton ? (
        <div
          className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md text-sm bg-slate-50 min-h-[44px]"
          data-testid={`${testIdPrefix}-skeleton`}
        >
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          <span className="text-slate-500">Đang tải phường đã chọn...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FKSelect
            label="Tỉnh / Thành phố"
            value={selectedProvinceId ?? ''}
            onChange={(provinceId) => {
              setSelectedProvinceId(provinceId || null);
              onChange(null); // reset ward when province changes
            }}
            options={provinceOptions}
            loading={provincesLoading}
            placeholder="-- Tìm hoặc chọn tỉnh/TP --"
            searchPlaceholder="Nhập tên tỉnh/TP..."
            canCreate={false}
            testId={`${testIdPrefix}-province`}
            required={required}
          />
          <FKSelect
            label="Phường / Xã"
            value={value ?? ''}
            onChange={(wardId) => onChange(wardId || null)}
            options={wardOptions}
            loading={wardsLoading}
            placeholder={wardPlaceholder}
            searchPlaceholder="Nhập tên phường/xã..."
            canCreate={false}
            testId={`${testIdPrefix}-ward`}
            required={required}
          />
        </div>
      )}

      {helperText && <p className="text-[10px] text-slate-500">{helperText}</p>}
    </div>
  );
}
