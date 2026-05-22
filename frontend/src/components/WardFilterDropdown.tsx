import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FKSelect } from './FKSelect';
import { X } from 'lucide-react';

/**
 * WardFilterDropdown — v0.36.0.0
 *
 * Cross-ward filter for list pages (PC02/ADMIN users). Lets caller filter
 * Case/Incident/Petition lists by Team.wardId (the geographic team the record
 * is assigned to).
 *
 * Hidden cho ward officer (per UC3): ward officer's data scope đã lock tới
 * wardTeam mình rồi → filter này redundant. Caller pass `hideForWardOfficer`.
 */

interface Province {
  id: string;
  code: string;
  name: string;
  officialCode: string | null;
}

interface WardOption {
  id: string;
  code: string;
  name: string;
}

interface WardFilterDropdownProps {
  value: string | null; // wardId (DB id) — pass to backend as ?wardTeamId=X
  onChange: (wardId: string | null) => void;
  /** Hide entirely khi current user là ward officer (their scope đã lock) */
  hideForWardOfficer?: boolean;
  isWardOfficer?: boolean;
  testIdPrefix?: string;
}

export function WardFilterDropdown({
  value,
  onChange,
  hideForWardOfficer = true,
  isWardOfficer = false,
  testIdPrefix = 'ward-filter',
}: WardFilterDropdownProps) {
  const skipForWardOfficer = hideForWardOfficer && isWardOfficer;

  // Load 34 provinces (cached 1h) — only when not skipped
  const { data: provinces } = useQuery({
    queryKey: ['admin-units', 'provinces'],
    queryFn: async () => {
      const res = await api.get<Province[]>('/admin-units/provinces');
      return res.data;
    },
    staleTime: 60 * 60 * 1000,
    enabled: !skipForWardOfficer,
  });

  // Load wards for all provinces — flatten cho 1 dropdown filter
  const { data: allWards } = useQuery({
    queryKey: ['admin-units', 'all-wards-flat'],
    queryFn: async () => {
      if (!provinces || provinces.length === 0) return [];
      const results = await Promise.all(
        provinces.map((p) =>
          api
            .get<WardOption[]>('/admin-units/wards', { params: { provinceId: p.id } })
            .then((r) =>
              r.data.map((w) => ({
                ...w,
                provinceName: p.name,
              })),
            ),
        ),
      );
      return results.flat();
    },
    enabled: !skipForWardOfficer && !!provinces && provinces.length > 0,
    staleTime: 60 * 60 * 1000,
  });

  const options = useMemo(() => {
    return (allWards ?? []).map((w) => ({
      value: w.id,
      label: `${w.name} — ${(w as any).provinceName}`,
    }));
  }, [allWards]);

  // Bail out cho ward officer — họ thấy chỉ phường mình rồi
  if (skipForWardOfficer) return null;

  return (
    <div className="flex items-center gap-1" data-testid={`${testIdPrefix}-container`}>
      <div className="flex-1 min-w-[240px]">
        <FKSelect
          label="Lọc theo phường"
          value={value ?? ''}
          onChange={(v) => onChange(v || null)}
          options={options}
          placeholder={
            options.length === 0 ? 'Đang tải phường...' : '-- Tất cả phường --'
          }
          searchPlaceholder="Nhập tên phường..."
          canCreate={false}
          testId={testIdPrefix}
        />
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
          title="Xóa filter phường"
          data-testid={`${testIdPrefix}-clear`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
