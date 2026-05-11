import type { DeadlineRuleVersion } from '../types';

interface DiffViewerProps {
  proposed: DeadlineRuleVersion;
  current: DeadlineRuleVersion | null;
}

interface FieldDiff {
  label: string;
  current: string | number | null;
  proposed: string | number | null;
  changed: boolean;
  /** When true, render as the hero diff (large font, full-width). */
  isHero?: boolean;
}

function fmt(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—';
  return String(v);
}

/**
 * DiffViewer — shows what changed between the current active version and a
 * proposed/historical version. Stacked field-by-field. The numeric `value`
 * is highlighted as a hero (large font) because it's the primary decision input.
 * Unchanged fields collapse to a single dimmed line.
 */
export function DiffViewer({ proposed, current }: DiffViewerProps) {
  const diffs: FieldDiff[] = [
    {
      label: 'Giá trị',
      current: current?.value ?? null,
      proposed: proposed.value,
      changed: current ? current.value !== proposed.value : true,
      isHero: true,
    },
    {
      label: 'Tên hiển thị',
      current: current?.label ?? null,
      proposed: proposed.label,
      changed: current ? current.label !== proposed.label : true,
    },
    {
      label: 'Căn cứ pháp lý',
      current: current?.legalBasis ?? null,
      proposed: proposed.legalBasis,
      changed: current ? current.legalBasis !== proposed.legalBasis : true,
    },
    {
      label: 'Loại văn bản',
      current: current?.documentType ?? null,
      proposed: proposed.documentType,
      changed: current ? current.documentType !== proposed.documentType : true,
    },
    {
      label: 'Số/ký hiệu',
      current: current?.documentNumber ?? null,
      proposed: proposed.documentNumber,
      changed: current ? current.documentNumber !== proposed.documentNumber : true,
    },
    {
      label: 'Cơ quan ban hành',
      current: current?.documentIssuer ?? null,
      proposed: proposed.documentIssuer,
      changed: current ? current.documentIssuer !== proposed.documentIssuer : true,
    },
  ];

  const heroField = diffs.find((d) => d.isHero);
  const otherFields = diffs.filter((d) => !d.isHero);

  return (
    <div className="space-y-4" data-testid="diff-viewer">
      {/* Hero diff — value change shown loud */}
      {heroField && heroField.changed && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6" data-testid="diff-hero">
          <div className="text-xs font-medium text-slate-500 uppercase mb-2">{heroField.label}</div>
          <div className="flex items-center gap-6">
            <div className="flex-1 text-right">
              <div className="text-3xl font-bold font-mono text-slate-400 line-through">
                {fmt(heroField.current)}
              </div>
              <div className="text-xs text-slate-400 mt-1">Hiện tại</div>
            </div>
            <div className="text-slate-300 text-2xl">→</div>
            <div className="flex-1">
              <div className="text-3xl font-bold font-mono text-green-700">
                {fmt(heroField.proposed)}
              </div>
              <div className="text-xs text-green-600 mt-1">Đề xuất</div>
            </div>
          </div>
        </div>
      )}

      {/* Stacked field-by-field diff */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {otherFields.map((d) => (
          <div
            key={d.label}
            className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 items-start"
            data-testid={`diff-row-${d.label}`}
          >
            <div className="col-span-3 text-xs font-medium text-slate-500 uppercase pt-1">
              {d.label}
            </div>
            <div className="col-span-9">
              {d.changed ? (
                <div className="space-y-1">
                  <div className="text-sm bg-red-50 text-red-900 px-2 py-1 rounded line-through">
                    {fmt(d.current)}
                  </div>
                  <div className="text-sm bg-green-50 text-green-900 px-2 py-1 rounded">
                    {fmt(d.proposed)}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400 italic">= Không đổi: {fmt(d.proposed)}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reason — always shown standalone */}
      <div className="border border-slate-200 rounded-lg p-4 bg-blue-50/30">
        <div className="text-xs font-medium text-slate-500 uppercase mb-2">Lý do đề xuất</div>
        <div className="text-sm text-slate-800 whitespace-pre-wrap">{proposed.reason}</div>
      </div>
    </div>
  );
}
