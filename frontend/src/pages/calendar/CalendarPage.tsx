import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Save,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/shared/Modal';
import { usePermission } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { CreateEventModal } from './components/CreateEventModal';
import { RecurringDeleteDialog } from './components/RecurringDeleteDialog';
import { filterEvents } from './utils/filterEvents';

const COLORS = { navy: '#1B2B4E', gold: '#D4AF37', slate: '#64748B' };

export type EventType = 'deadline' | 'hearing' | 'meeting' | 'other' | 'holiday' | 'event';
export type HolidayCategory = 'NATIONAL' | 'POLICE' | 'MILITARY' | 'INTERNATIONAL' | 'OTHER';
export type EventScopeFE = 'SYSTEM' | 'TEAM' | 'PERSONAL';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: EventType;
  description?: string;
  caseId?: string;
  incidentId?: string;
  petitionId?: string;
  holidayCategory?: HolidayCategory;
  isOfficialDayOff?: boolean;
  // PR 2c — for type='event' from new calendar_events table:
  scope?: EventScopeFE;
  categorySlug?: string;
  categoryColor?: string;
  // v0.21.7.0 — extended context (category label, time, recurrence)
  categoryName?: string;
  allDay?: boolean;
  startTime?: string; // "HH:MM"
  endTime?: string;
  isRecurring?: boolean;
}

const eventTypeLabels: Record<EventType, string> = {
  deadline: 'Hạn xử lý',
  hearing: 'Phiên tòa',
  meeting: 'Cuộc họp',
  other: 'Khác',
  holiday: 'Ngày lễ',
  event: 'Sự kiện', // PR 2c — new calendar_events table entries
};

const eventTypeColors: Record<EventType, string> = {
  deadline: '#EF4444',
  hearing: '#8B5CF6',
  meeting: '#3B82F6',
  other: '#64748B',
  holiday: '#DA251D', // Đỏ cờ Việt Nam
  event: '#003973', // PR 2c — fallback color cho new events khi categoryColor null
};

const holidayCategoryColors: Record<HolidayCategory, string> = {
  NATIONAL: '#DA251D',      // Đỏ cờ
  POLICE: '#1B4D8E',        // Xanh CAND
  MILITARY: '#2E7D32',      // Xanh QĐND
  INTERNATIONAL: '#F59E0B', // Cam
  OTHER: '#64748B',
};

const holidayCategoryLabels: Record<HolidayCategory, string> = {
  NATIONAL: 'Quốc gia',
  POLICE: 'Công an',
  MILITARY: 'Quân đội',
  INTERNATIONAL: 'Quốc tế',
  OTHER: 'Khác',
};

function getEventColor(event: CalendarEvent): string {
  if (event.type === 'holiday' && event.holidayCategory) {
    return holidayCategoryColors[event.holidayCategory];
  }
  // PR 2c — type='event' uses dynamic category color from API
  if (event.type === 'event' && event.categoryColor) {
    return event.categoryColor;
  }
  return eventTypeColors[event.type];
}

/**
 * PR 2c: scope visual treatment for event-type events.
 * - SYSTEM: solid border (default)
 * - TEAM: dashed border + small users icon
 * - PERSONAL: dotted border + small user icon
 */
function getScopeBorderStyle(scope?: EventScopeFE): string {
  if (!scope) return '';
  if (scope === 'TEAM') return 'border border-dashed border-white/60';
  if (scope === 'PERSONAL') return 'border border-dotted border-white/60';
  return ''; // SYSTEM: no extra border, just solid background
}

// Calendar day cell component
interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  onClick: (date: Date) => void;
}

function DayCell({ date, isCurrentMonth, isToday, events, onClick }: DayCellProps) {
  const dayNumber = date.getDate();
  
  return (
    <div
      onClick={() => onClick(date)}
      className={`
        min-h-[100px] p-2 border border-slate-200 cursor-pointer transition-colors
        hover:bg-slate-50
        ${isCurrentMonth ? 'bg-white' : 'bg-slate-50 text-slate-400'}
        ${isToday ? 'ring-2 ring-inset ring-blue-500' : ''}
      `}
      data-testid={`calendar-day-${date.toISOString().split('T')[0]}`}
    >
      <div className="flex justify-between items-start">
        <span 
          className={`
            text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
            ${isToday ? 'bg-blue-500 text-white' : 'text-slate-700'}
          `}
        >
          {dayNumber}
        </span>
        {events.length > 0 && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            {events.length}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-1">
        {events.slice(0, 3).map((event) => (
          <div
            key={event.id}
            className={`text-xs px-2 py-1 rounded truncate text-white ${getScopeBorderStyle(event.scope)}`}
            style={{ backgroundColor: getEventColor(event) }}
            title={`${event.title}${event.scope ? ` (${event.scope})` : ''}`}
          >
            {event.title}
          </div>
        ))}
        {events.length > 3 && (
          <div className="text-xs text-slate-500 px-2">+{events.length - 3} sự kiện khác</div>
        )}
      </div>
    </div>
  );
}

// Event Form Component - handles form state internally
interface EventFormProps {
  initialData?: {
    title: string;
    type: EventType;
    description: string;
    date: string;
  };
  isEditing: boolean;
  onSave: (data: { title: string; type: EventType; description: string; date: string }) => void;
  onCancel: () => void;
  onDelete?: () => void;
  canSubmit: boolean;
}

function EventForm({ initialData, isEditing, onSave, onCancel, onDelete, canSubmit }: EventFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [type, setType] = useState<EventType>(initialData?.type || 'meeting');
  const [description, setDescription] = useState(initialData?.description || '');
  const [date, setDate] = useState(initialData?.date || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ title, type, description, date });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Ngày <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          data-testid="event-date-input"
        />
      </div>

      {/* Event Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Tên sự kiện <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Nhập tên sự kiện..."
          required
          minLength={3}
          maxLength={100}
          data-testid="event-title-input"
        />
      </div>

      {/* Event Type */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Loại sự kiện <span className="text-red-500">*</span>
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as EventType)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          data-testid="event-type-select"
        >
          {Object.entries(eventTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Mô tả
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Nhập mô tả chi tiết..."
          rows={3}
          data-testid="event-description-input"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t border-slate-200">
        <div>
          {isEditing && onDelete && (
            <Button
              type="button"
              variant="outline"
              onClick={onDelete}
              className="text-red-600 border-red-300 hover:bg-red-50"
              data-testid="event-delete-btn"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Xóa
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Hủy
          </Button>
          <Button 
            type="submit"
            disabled={!canSubmit}
            data-testid="event-save-btn"
          >
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? 'Cập nhật' : 'Thêm mới'}
          </Button>
        </div>
      </div>
    </form>
  );
}

// Event Modal Component
interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  editingEvent: CalendarEvent | null;
  onSave: (event: Partial<CalendarEvent>) => void;
  onDelete?: (eventId: string) => void;
  canCreate: boolean;
}

function EventModal({ 
  isOpen, 
  onClose, 
  selectedDate, 
  editingEvent, 
  onSave, 
  onDelete,
  canCreate 
}: EventModalProps) {
  const isEditing = !!editingEvent;
  
  const initialData = isEditing && editingEvent 
    ? {
        title: editingEvent.title,
        type: editingEvent.type,
        description: editingEvent.description || '',
        date: editingEvent.date,
      }
    : {
        title: '',
        type: 'meeting' as EventType,
        description: '',
        date: selectedDate ? selectedDate.toISOString().split('T')[0] : '',
      };

  const handleSave = (data: { title: string; type: EventType; description: string; date: string }) => {
    onSave({
      id: editingEvent?.id,
      ...data,
    });
    onClose();
  };

  const handleDelete = () => {
    if (editingEvent && onDelete) {
      onDelete(editingEvent.id);
      onClose();
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={isEditing ? 'Chỉnh sửa sự kiện' : 'Thêm sự kiện mới'}
      data-testid="event-modal"
    >
      <EventForm
        key={editingEvent?.id || selectedDate?.toISOString() || 'new'}
        initialData={initialData}
        isEditing={isEditing}
        onSave={handleSave}
        onCancel={onClose}
        onDelete={onDelete ? handleDelete : undefined}
        canSubmit={canCreate}
      />
    </Modal>
  );
}

// Upcoming Events Component
interface UpcomingEventsProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

function UpcomingEvents({ events, onEventClick }: UpcomingEventsProps) {
  const sortedEvents = useMemo(() => {
    return [...events]
      .filter(e => new Date(e.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }, [events]);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5" style={{ color: COLORS.navy }} />
        Sự kiện sắp tới
      </h3>
      
      <div className="space-y-3">
        {sortedEvents.length === 0 ? (
          <p className="text-slate-500 text-center py-4">Không có sự kiện sắp tới</p>
        ) : (
          sortedEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => onEventClick(event)}
              className="p-3 rounded-lg border border-slate-200 cursor-pointer hover:shadow-md transition-shadow"
              data-testid={`upcoming-event-${event.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900">{event.title}</h4>
                  {event.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{event.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: getEventColor(event) }}
                    >
                      {event.type === 'holiday' && event.holidayCategory
                        ? `${eventTypeLabels.holiday} • ${holidayCategoryLabels[event.holidayCategory]}`
                        : eventTypeLabels[event.type]}
                    </span>
                    {/* v0.21.7.0 — category badge (separate from type) */}
                    {event.categoryName && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: event.categoryColor || '#64748b' }}
                      >
                        {event.categoryName}
                      </span>
                    )}
                    {/* v0.21.7.0 — scope label */}
                    {event.scope && (
                      <span className="text-xs text-slate-600">
                        {event.scope === 'SYSTEM' && '🏛️ Toàn cơ quan'}
                        {event.scope === 'TEAM' && '👥 Cấp tổ'}
                        {event.scope === 'PERSONAL' && '🧑 Cá nhân'}
                      </span>
                    )}
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {new Date(event.date).toLocaleDateString('vi-VN')}
                      {/* v0.21.7.0 — time if not all-day */}
                      {event.allDay === false && event.startTime && (
                        <> • {event.startTime}{event.endTime ? `–${event.endTime}` : ''}</>
                      )}
                    </span>
                    {/* v0.21.7.0 — recurring badge */}
                    {event.isRecurring && (
                      <span className="text-xs text-slate-500" title="Sự kiện lặp lại hằng năm">🔁</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Main Calendar Page
export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const { canCreate, canDelete } = usePermission();
  const [isCreateApiModalOpen, setIsCreateApiModalOpen] = useState(false);
  const [createApiDefaultDate, setCreateApiDefaultDate] = useState<string>('');

  // PR 2c — scope filter chips. Default: show all scopes + legacy holidays/deadlines.
  const [scopeFilter, setScopeFilter] = useState<Set<EventScopeFE | 'LEGACY'>>(
    new Set(['SYSTEM', 'TEAM', 'PERSONAL', 'LEGACY']),
  );

  // v0.21.7.0 — top-level kind filter (Lịch vs Sự kiện) + category filter
  const [kindFilter, setKindFilter] = useState<'all' | 'lich' | 'sukien'>('all');
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(
    new Set(['national', 'police', 'military', 'international', 'other']),
  );

  // PR 2c — recurring delete dialog state.
  // v0.21.7.0: enriched với category/scope/time để dialog hiển thị đủ context
  const [deleteDialog, setDeleteDialog] = useState<{
    eventId: string;
    occurrenceDate: string;
    title: string;
    isRecurring: boolean;
    description?: string;
    categoryName?: string;
    categoryColor?: string;
    scope?: EventScopeFE;
    allDay?: boolean;
    startTime?: string;
    endTime?: string;
  } | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const res = await api.get<{ success: boolean; data: CalendarEvent[] }>(
        `/calendar/events?year=${year}&month=${month}`,
      );
      setEvents(res.data.data ?? []);
    } catch {
      setEvents([]);
    }
  }, [currentDate]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  // Calendar data
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
    
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const current = new Date(startDate);
    
    while (current <= lastDayOfMonth || days.length % 7 !== 0) {
      days.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
      });
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [currentDate]);

  const today = new Date();
  const weekDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  const handlePrevMonth = useCallback(() => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }, [currentDate]);

  const handleNextMonth = useCallback(() => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }, [currentDate]);

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setIsModalOpen(true);
  }, []);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    // PR 2c — new event-type events route to RecurringDeleteDialog instead of
    // the legacy local-state EventModal (which never persisted anything).
    if (event.type === 'event') {
      // Inline what handleEventDelete does (no closure dep on `events` yet at this point).
      if (!event.id.startsWith('event-')) return;
      const dateSuffix = event.id.slice(-10);
      const eventId = event.id.slice('event-'.length, event.id.length - 11);
      const occurrenceDates = new Set(
        events.filter((e) => e.id.startsWith(`event-${eventId}-`)).map((e) => e.id.slice(-10)),
      );
      setDeleteDialog({
        eventId,
        occurrenceDate: dateSuffix,
        title: event.title,
        isRecurring: occurrenceDates.size > 1,
        // v0.21.7.0 — pass full context vào dialog
        description: event.description,
        categoryName: event.categoryName,
        categoryColor: event.categoryColor,
        scope: event.scope,
        allDay: event.allDay,
        startTime: event.startTime,
        endTime: event.endTime,
      });
      return;
    }
    setEditingEvent(event);
    setSelectedDate(new Date(event.date));
    setIsModalOpen(true);
  }, [events]);

  const handleSaveEvent = useCallback((eventData: Partial<CalendarEvent>) => {
    if (eventData.id) {
      // Edit existing
      setEvents(prev => prev.map(e => 
        e.id === eventData.id 
          ? { ...e, ...eventData } as CalendarEvent
          : e
      ));
    } else {
      // Create new
      const newEvent: CalendarEvent = {
        id: Date.now().toString(),
        title: eventData.title || '',
        date: eventData.date || '',
        type: eventData.type || 'other',
        description: eventData.description,
      };
      setEvents(prev => [...prev, newEvent]);
    }
  }, []);

  const handleDeleteEvent = useCallback((eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
  }, []);

  // v0.21.7.0 — apply 3-level filter (kind + scope + category) via extracted
  // pure function (testable in isolation, see utils/filterEvents.spec.ts).
  const filteredEvents = useMemo(
    () => filterEvents(events, kindFilter, scopeFilter, categoryFilter),
    [events, kindFilter, scopeFilter, categoryFilter],
  );

  const getEventsForDate = useCallback((date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return filteredEvents.filter(e => e.date === dateStr);
  }, [filteredEvents]);

  const toggleScope = (s: EventScopeFE | 'LEGACY') => {
    setScopeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  // v0.21.7.0 — toggle category chip
  const toggleCategory = (slug: string) => {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  // PR 2c: event-type click handling is inlined into handleEventClick below
  // (recurring delete dialog path). Kept dedicated function for clarity if
  // future code needs to open the dialog without going through handleEventClick.

  const monthYearLabel = currentDate.toLocaleDateString('vi-VN', { 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <div className="h-full bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900">Lịch làm việc</h1>
            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
              <button
                onClick={handlePrevMonth}
                className="p-1 hover:bg-slate-100 rounded"
                data-testid="prev-month-btn"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-4 font-medium min-w-[180px] text-center">
                {monthYearLabel}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1 hover:bg-slate-100 rounded"
                data-testid="next-month-btn"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {canCreate('calendar') && (
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setCreateApiDefaultDate(new Date().toISOString().slice(0, 10));
                  setIsCreateApiModalOpen(true);
                }}
                data-testid="create-event-api-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tạo sự kiện
              </Button>
            </div>
          )}
        </div>

        <CreateEventModal
          isOpen={isCreateApiModalOpen}
          onClose={() => setIsCreateApiModalOpen(false)}
          defaultDate={createApiDefaultDate}
          onCreated={fetchEvents}
        />

        {deleteDialog && (
          <RecurringDeleteDialog
            isOpen={true}
            onClose={() => setDeleteDialog(null)}
            eventId={deleteDialog.eventId}
            occurrenceDate={deleteDialog.occurrenceDate}
            eventTitle={deleteDialog.title}
            isRecurring={deleteDialog.isRecurring}
            description={deleteDialog.description}
            categoryName={deleteDialog.categoryName}
            categoryColor={deleteDialog.categoryColor}
            scope={deleteDialog.scope}
            allDay={deleteDialog.allDay}
            startTime={deleteDialog.startTime}
            endTime={deleteDialog.endTime}
            onDeleted={fetchEvents}
          />
        )}

        {/* v0.21.7.0 — top-level kind segmented control */}
        <div className="flex gap-1 mb-3" data-testid="kind-filter">
          {([
            { value: 'all', label: 'Tất cả' },
            { value: 'lich', label: 'Lịch' },
            { value: 'sukien', label: 'Sự kiện' },
          ] as const).map((k) => (
            <button
              key={k.value}
              onClick={() => setKindFilter(k.value)}
              className={`px-4 py-1.5 text-sm font-medium border first:rounded-l-lg last:rounded-r-lg ${
                kindFilter === k.value
                  ? 'bg-[#003973] text-white border-[#003973]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              data-testid={`kind-chip-${k.value}`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* PR 2c — scope filter chips */}
        <div className="flex gap-2 mb-3 text-sm flex-wrap items-center" data-testid="scope-filter-chips">
          <span className="text-xs text-slate-500 uppercase tracking-wide mr-1">Phạm vi:</span>
          {([
            { value: 'LEGACY', label: 'Deadline + Lễ', desc: 'Vụ án/Vụ việc/Đơn thư + ngày lễ' },
            { value: 'SYSTEM', label: 'Hệ thống', desc: 'Sự kiện toàn cơ quan' },
            { value: 'TEAM', label: 'Tổ', desc: 'Sự kiện cấp tổ' },
            { value: 'PERSONAL', label: 'Cá nhân', desc: 'Sự kiện riêng của tôi' },
          ] as const).map((s) => (
            <label
              key={s.value}
              title={s.desc}
              className="cursor-pointer px-3 py-1 border border-slate-300 rounded-full has-[:checked]:bg-[#003973] has-[:checked]:text-white has-[:checked]:border-[#003973]"
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={scopeFilter.has(s.value)}
                onChange={() => toggleScope(s.value)}
                data-testid={`scope-chip-${s.value}`}
              />
              {s.label}
            </label>
          ))}
        </div>

        {/* v0.21.7.0 — category filter chips */}
        <div className="flex gap-2 mb-4 text-sm flex-wrap items-center overflow-x-auto" data-testid="category-filter-chips">
          <span className="text-xs text-slate-500 uppercase tracking-wide mr-1">Danh mục:</span>
          {([
            { value: 'national', label: 'Quốc gia', color: '#dc2626' },
            { value: 'police', label: 'Công an', color: '#1e40af' },
            { value: 'military', label: 'Quân đội', color: '#15803d' },
            { value: 'international', label: 'Quốc tế', color: '#ea580c' },
            { value: 'other', label: 'Khác', color: '#64748b' },
          ] as const).map((c) => (
            <label
              key={c.value}
              className="cursor-pointer px-3 py-1 border rounded-full text-xs flex items-center gap-1.5"
              style={categoryFilter.has(c.value) ? { backgroundColor: c.color, color: 'white', borderColor: c.color } : { borderColor: '#cbd5e1', color: '#475569' }}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={categoryFilter.has(c.value)}
                onChange={() => toggleCategory(c.value)}
                data-testid={`category-chip-${c.value}`}
              />
              {c.label}
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                {weekDays.map((day) => (
                  <div 
                    key={day} 
                    className="py-2 text-center text-sm font-medium text-slate-600"
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar days */}
              <div className="grid grid-cols-7">
                {calendarData.map(({ date, isCurrentMonth }, index) => (
                  <DayCell
                    key={index}
                    date={date}
                    isCurrentMonth={isCurrentMonth}
                    isToday={
                      date.getDate() === today.getDate() &&
                      date.getMonth() === today.getMonth() &&
                      date.getFullYear() === today.getFullYear()
                    }
                    events={getEventsForDate(date)}
                    onClick={handleDayClick}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming Events Sidebar */}
          <div className="lg:col-span-1">
            <UpcomingEvents 
              events={events} 
              onEventClick={handleEventClick}
            />
          </div>
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate}
        editingEvent={editingEvent}
        onSave={handleSaveEvent}
        onDelete={canDelete('calendar') ? handleDeleteEvent : undefined}
        canCreate={canCreate('calendar')}
      />
    </div>
  );
}
