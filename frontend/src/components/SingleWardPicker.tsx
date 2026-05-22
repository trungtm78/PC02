import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

/**
 * SingleWardPicker — 2-tier cascade (Tỉnh → Phường) returning ward DB id.
 * v0.34.0.0
 *
 * Replaces plain text wardId input in TeamsPage.
 *
 * Design decisions from /autoplan Phase 2 Design consensus:
 * - D3 reverse lookup: if `value` is set on mount but provinces not loaded,
 *   call GET /admin-units/wards/:id to pre-render province + ward labels
 *   immediately (no layout shift, no flash of empty dropdown)
 * - D5 cascade: choosing province resets ward; ward search-as-you-type
 * - D7 tablet-first: 44px touch targets; native <select> fallback < 768px
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
  disabled?: boolean;
  testIdPrefix?: string;
}

export function SingleWardPicker({
  value,
  onChange,
  label,
  helperText,
  disabled = false,
  testIdPrefix = 'ward-picker',
}: SingleWardPickerProps) {
  // Local state: selected province id (independent from form value — ward picker
  // owns this to support cascade reset)
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);

  // 1. Load all provinces (cached 1h — list ~34 items)
  const { data: provinces, isLoading: provincesLoading } = useQuery({
    queryKey: ['admin-units', 'provinces'],
    queryFn: async () => {
      const res = await api.get<Province[]>('/admin-units/provinces');
      return res.data;
    },
    staleTime: 60 * 60 * 1000, // 1h
  });

  // 2. D3 reverse lookup: if `value` set but no province selected yet, fetch
  // ward + province to pre-fill labels immediately
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

  // Sync: when reverse lookup completes, set selectedProvinceId
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
    staleTime: 5 * 60 * 1000, // 5min
  });

  // 4. Sort + display options
  const provinceOptions = useMemo(() => provinces ?? [], [provinces]);
  const wardOptions = useMemo(() => wards ?? [], [wards]);

  // 5. Handle province change → reset ward
  const handleProvinceChange = (provinceId: string) => {
    setSelectedProvinceId(provinceId || null);
    onChange(null); // reset selected ward when province changes
  };

  const handleWardChange = (wardId: string) => {
    onChange(wardId || null);
  };

  const handleClear = () => {
    setSelectedProvinceId(null);
    onChange(null);
  };

  // Render
  const showReverseLookupSkeleton = !!value && !selectedProvinceId && initialWardLoading;

  return (
    <div data-testid={`${testIdPrefix}-container`}>
      {label && (
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {label}
        </label>
      )}

      {showReverseLookupSkeleton ? (
        // D3 fix: no layout shift while reverse lookup loads
        <div
          className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md text-sm bg-slate-50 min-h-[44px]"
          data-testid={`${testIdPrefix}-skeleton`}
        >
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          <span className="text-slate-500">Đang tải phường đã chọn...</span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Province dropdown */}
          <select
            value={selectedProvinceId ?? ''}
            onChange={(e) => handleProvinceChange(e.target.value)}
            disabled={disabled || provincesLoading}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm min-h-[44px] disabled:bg-slate-100"
            data-testid={`${testIdPrefix}-province`}
            aria-label="Tỉnh / Thành phố"
          >
            <option value="">
              {provincesLoading ? 'Đang tải tỉnh/TP...' : '-- Chọn Tỉnh / TP --'}
            </option>
            {provinceOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Ward dropdown */}
          <select
            value={value ?? ''}
            onChange={(e) => handleWardChange(e.target.value)}
            disabled={disabled || !selectedProvinceId || wardsLoading}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm min-h-[44px] disabled:bg-slate-100"
            data-testid={`${testIdPrefix}-ward`}
            aria-label="Phường / Xã"
          >
            <option value="">
              {!selectedProvinceId
                ? '-- Chọn tỉnh trước --'
                : wardsLoading
                  ? 'Đang tải phường...'
                  : wardOptions.length === 0
                    ? 'Không có phường'
                    : '-- Chọn Phường / Xã --'}
            </option>
            {wardOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.officialCode ? ` (${w.officialCode})` : ''}
              </option>
            ))}
          </select>

          {/* Clear button */}
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md min-h-[44px]"
              data-testid={`${testIdPrefix}-clear`}
              aria-label="Xóa lựa chọn"
            >
              Xóa
            </button>
          )}
        </div>
      )}

      {helperText && (
        <p className="text-[10px] text-slate-500 mt-1">{helperText}</p>
      )}
    </div>
  );
}
