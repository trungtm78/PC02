import { useState } from 'react';
import {
  FileText,
  Mail,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Clock,
  AlertCircle,
  Copy,
  Printer,
} from 'lucide-react';
import { useCaseJourney } from './useCaseJourney';
import { formatVNDateTime, formatVNDate } from '../../lib/dates';
import { usePetitionJourney } from './usePetitionJourney';
import { useIncidentJourney } from './useIncidentJourney';
import type { TimelineEntityType, TimelineEvent } from './useCaseJourney';

// ─── Constants ────────────────────────────────────────────────────────────────

type FilterChip = TimelineEntityType | 'ALL';

const FILTER_CHIPS: { id: FilterChip; label: string }[] = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'CASE', label: 'Vụ việc' },
  { id: 'PETITION', label: 'Đơn thư' },
  { id: 'INCIDENT', label: 'Vụ án' },
];

const ENTITY_BADGE_STYLE: Record<TimelineEntityType, { bg: string; text: string; icon: React.ReactNode }> = {
  CASE: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    icon: <FileText className="w-3 h-3" />,
  },
  PETITION: {
    bg: 'bg-violet-100',
    text: 'text-violet-700',
    icon: <Mail className="w-3 h-3" />,
  },
  INCIDENT: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
};

const ENTITY_LABEL: Record<TimelineEntityType, string> = {
  CASE: 'Vụ việc',
  PETITION: 'Đơn thư',
  INCIDENT: 'Vụ án',
};


function daysDiff(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EntityBadge({ event }: { event: TimelineEvent }) {
  const style = ENTITY_BADGE_STYLE[event.entityType];
  return (
    <span
      data-testid={`entity-badge-${event.id}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.icon}
      {ENTITY_LABEL[event.entityType]}
    </span>
  );
}

function EventRow({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  const isFieldUpdate = event.eventType === 'FIELD_UPDATE';

  return (
    <div data-testid={`event-${event.id}`} className="flex gap-3 pb-4 relative">
      {/* Timeline dot */}
      <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-gray-400" />

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <EntityBadge event={event} />
          <span className="text-xs text-gray-500">{formatVNDateTime(event.actedAt)}</span>
          {event.actor && (
            <span className="text-xs text-gray-600 font-medium">{event.actor.name}</span>
          )}
          {!event.actor && <span className="text-xs text-gray-400 italic">Hệ thống</span>}
        </div>

        <div className="flex items-start gap-1">
          {isFieldUpdate && (
            <button
              data-testid={`expand-${event.id}`}
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 p-0.5 rounded hover:bg-gray-100"
              aria-label={expanded ? 'Thu gọn' : 'Xem chi tiết'}
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          <span className="text-sm text-gray-800">{event.title}</span>
        </div>

        {/* FIELD_UPDATE diff — shown only when expanded */}
        {isFieldUpdate && expanded && (
          <div data-testid={`field-diff-${event.id}`} className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
            {event.metadata.hasDiff && event.metadata.changedFields && (
              <span>Trường đã thay đổi: {event.metadata.changedFields.join(', ')}</span>
            )}
            {!event.metadata.hasDiff && (
              <span className="text-gray-400 italic">Không có dữ liệu diff</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface HoSoJourneyProps {
  /** @deprecated use entityId instead */
  caseId?: string;
  entityType?: TimelineEntityType;
  entityId?: string;
  caseStt?: string;
  deadline?: Date;
  className?: string;
}

function useEntityJourney(entityType: TimelineEntityType, entityId: string, page: number) {
  const caseResult = useCaseJourney(entityType === 'CASE' ? entityId : '', page);
  const petitionResult = usePetitionJourney(entityType === 'PETITION' ? entityId : '', page);
  const incidentResult = useIncidentJourney(entityType === 'INCIDENT' ? entityId : '', page);
  if (entityType === 'PETITION') return petitionResult;
  if (entityType === 'INCIDENT') return incidentResult;
  return caseResult;
}

export function HoSoJourney({ caseId, entityType = 'CASE', entityId, caseStt, deadline, className = '' }: HoSoJourneyProps) {
  const resolvedEntityId = entityId ?? caseId ?? '';
  const [activeFilter, setActiveFilter] = useState<FilterChip>('ALL');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useEntityJourney(entityType, resolvedEntityId, page);

  // ── Loading ──
  if (isLoading) {
    return (
      <div data-testid="journey-loading" className={`space-y-3 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-2 h-2 mt-2 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error ──
  if (isError) {
    return (
      <div data-testid="journey-error" className={`text-center py-8 ${className}`}>
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 mb-3">Không thể tải hành trình hồ sơ</p>
        <button
          data-testid="journey-retry"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <RefreshCw className="w-4 h-4" />
          Thử lại
        </button>
      </div>
    );
  }

  const allEvents = data?.events ?? [];

  // ── Empty ──
  if (allEvents.length === 0) {
    return (
      <div data-testid="journey-empty" className={`text-center py-8 ${className}`}>
        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Chưa có sự kiện nào</p>
      </div>
    );
  }

  // ── Client-side filter (current page only) ──
  const filteredEvents =
    activeFilter === 'ALL' ? allEvents : allEvents.filter((e) => e.entityType === activeFilter);

  // ── Deadline banner ──
  const DEADLINE_WARNING_DAYS = 7;
  const deadlineDays = deadline ? daysDiff(new Date(), deadline) : null;
  const deadlineStatus =
    deadlineDays === null ? null :
    deadlineDays < 0 ? 'overdue' :
    deadlineDays <= DEADLINE_WARNING_DAYS ? 'warning' : 'ok';

  const deadlineBannerStyle =
    deadlineStatus === 'overdue' ? 'bg-red-50 border-red-200 text-red-700' :
    deadlineStatus === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
    'bg-green-50 border-green-200 text-green-700';

  const deadlineLabel =
    deadlineStatus === 'overdue' ? `Quá hạn ${Math.abs(deadlineDays!)} ngày` :
    `Còn ${deadlineDays} ngày`;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">
          Hành Trình Hồ Sơ{caseStt ? `: ${caseStt}` : ''}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
            }}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
            title="Sao chép liên kết"
          >
            <Copy className="w-4 h-4" />
            Chia sẻ
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
            title="In báo cáo"
          >
            <Printer className="w-4 h-4" />
            In báo cáo
          </button>
        </div>
      </div>

      {/* Deadline Banner */}
      {deadline && deadlineStatus && (
        <div
          data-testid="deadline-banner"
          className={`flex items-center gap-2 px-3 py-2 rounded border mb-4 text-sm ${deadlineBannerStyle}`}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            Hạn xử lý:{' '}
            <strong>{formatVNDate(deadline)}</strong>
            {' — '}{deadlineLabel}
          </span>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.id}
            data-testid={chip.id === 'ALL' ? 'filter-chip-ALL' : `filter-chip-${chip.id}`}
            onClick={() => { setActiveFilter(chip.id); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              activeFilter === chip.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative pl-3 border-l border-gray-200">
        {filteredEvents.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">Không có kết quả cho bộ lọc này</p>
        ) : (
          filteredEvents.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </div>

      {/* Load more */}
      {data?.hasNextPage && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="text-sm text-blue-600 hover:underline"
          >
            Tải thêm
          </button>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body > *:not([data-print-root]) { display: none !important; }
        }
      `}</style>
    </div>
  );
}
