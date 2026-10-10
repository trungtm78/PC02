/**
 * S05-S08 — Đặt lịch (spec §6.1 PR4 bước 3/4). Pure client-side preview:
 * `generatePeriods` is the same engine the real PeriodScheduler (PR5) runs
 * server-side, mirrored byte-for-byte to the frontend (R2 gen:dr-engine),
 * so this preview can never disagree with what periods actually get
 * created once the report is published.
 *
 * `nonWorkingDates` (R7) is the one input the pure engine cannot supply
 * itself — it is fetched from `/bao-cao-dong/schedule/non-working-dates`,
 * the same `CalendarEventsService.expandOccurrences()` call
 * `period-scheduler.service.ts#resolveNonWorkingDates` makes when it
 * actually generates periods.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import { generatePeriods } from '@/features/dynamic-reports/engine/generated/period';
import type {
  DueRule,
  OpenRule,
  PeriodType,
  ScheduleRule,
} from '@/features/dynamic-reports/engine/generated/period';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { A11Y_FOCUS_RING } from '@/constants/styles';

const PERIOD_TYPE_LABEL: Record<PeriodType, string> = {
  DAILY: 'Hằng ngày',
  WEEKLY: 'Hằng tuần',
  MONTHLY: 'Hằng tháng',
  QUARTERLY: 'Hằng quý',
  SEMI_ANNUAL: 'Nửa năm',
  YEARLY: 'Hằng năm',
  ONE_TIME: 'Một lần',
};

const WEEKDAY_LABEL = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];

const NON_WORKING_FETCH_DAYS = 730;

function toIsoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Props {
  onBack: () => void;
  onNext: (rule: ScheduleRule) => void;
}

export default function ReportScheduleStep({ onBack, onNext }: Props) {
  const [now] = useState(() => new Date());
  const [periodType, setPeriodType] = useState<PeriodType>('MONTHLY');
  const [periodStartDay, setPeriodStartDay] = useState(1);
  const [oneTimeDate, setOneTimeDate] = useState('');

  const [dueKind, setDueKind] = useState<DueRule['kind']>('FIXED_IN_PERIOD');
  const [periodOffset, setPeriodOffset] = useState<0 | 1>(1);
  const [anchorDay, setAnchorDay] = useState(5);
  const [anchorWeekday, setAnchorWeekday] = useState(1);
  const [anchorMonth, setAnchorMonth] = useState(1);
  const [dueTime, setDueTime] = useState('17:00');
  const [daysAfterEnd, setDaysAfterEnd] = useState(5);

  const [openKind, setOpenKind] = useState<OpenRule['kind']>('AT_PERIOD_START');
  const [openDaysBeforeDue, setOpenDaysBeforeDue] = useState(3);

  const [shiftNonWorking, setShiftNonWorking] = useState(true);
  const [nonWorkingDates, setNonWorkingDates] = useState<Set<string>>(new Set());
  const [nonWorkingError, setNonWorkingError] = useState<string | null>(null);

  useEffect(() => {
    if (!shiftNonWorking) {
      setNonWorkingDates(new Set());
      return;
    }
    const from = toIsoDateOnly(now);
    const to = toIsoDateOnly(new Date(now.getTime() + NON_WORKING_FETCH_DAYS * 86_400_000));
    let cancelled = false;
    dynamicReportsApi
      .getNonWorkingDates(from, to)
      .then((dates) => {
        if (!cancelled) {
          setNonWorkingDates(new Set(dates));
          setNonWorkingError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNonWorkingError('Không tải được danh sách ngày nghỉ — xem trước sẽ không dời hạn.');
          setNonWorkingDates(new Set());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [shiftNonWorking, now]);

  const due: DueRule =
    dueKind === 'FIXED_IN_PERIOD'
      ? {
          kind: 'FIXED_IN_PERIOD',
          periodOffset,
          anchorWeekday: periodType === 'WEEKLY' ? anchorWeekday : undefined,
          anchorMonth: ['QUARTERLY', 'SEMI_ANNUAL', 'YEARLY'].includes(periodType)
            ? anchorMonth
            : undefined,
          anchorDay: periodType !== 'WEEKLY' ? anchorDay : undefined,
          time: dueTime,
        }
      : { kind: 'DAYS_AFTER_END', days: daysAfterEnd, time: dueTime };

  const open: OpenRule =
    openKind === 'AT_PERIOD_START'
      ? { kind: 'AT_PERIOD_START' }
      : { kind: 'DAYS_BEFORE_DUE', days: openDaysBeforeDue };

  const rule: ScheduleRule = useMemo(
    () => ({
      periodType,
      periodStartDay: periodType === 'MONTHLY' ? periodStartDay : undefined,
      due,
      open,
      shiftNonWorking,
      oneTimeDate: periodType === 'ONE_TIME' ? oneTimeDate || undefined : undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodType, periodStartDay, JSON.stringify(due), JSON.stringify(open), shiftNonWorking, oneTimeDate],
  );

  const { periods, previewError } = useMemo(() => {
    if (periodType === 'ONE_TIME' && !oneTimeDate) {
      return { periods: [], previewError: null };
    }
    try {
      return { periods: generatePeriods(rule, now, 6, nonWorkingDates), previewError: null };
    } catch (err) {
      return {
        periods: [],
        previewError: err instanceof Error ? err.message : 'Không tính được kỳ.',
      };
    }
  }, [rule, now, nonWorkingDates, periodType, oneTimeDate]);

  const canSubmit = periodType !== 'ONE_TIME' || !!oneTimeDate;

  return (
    <div data-testid="schedule-step">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Đặt lịch báo cáo</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Loại kỳ</label>
          <select
            data-testid="select-period-type"
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as PeriodType)}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          >
            {Object.entries(PERIOD_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {periodType === 'MONTHLY' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ngày đầu kỳ</label>
            <input
              type="number"
              min={1}
              max={31}
              data-testid="input-period-start-day"
              value={periodStartDay}
              onChange={(e) => setPeriodStartDay(Number(e.target.value))}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </div>
        )}

        {periodType === 'ONE_TIME' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ngày của kỳ</label>
            <input
              type="date"
              data-testid="input-one-time-date"
              value={oneTimeDate}
              onChange={(e) => setOneTimeDate(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

      <fieldset className="border border-slate-200 rounded-lg p-3 mb-4">
        <legend className="text-xs font-semibold text-slate-600 px-1">Hạn nộp</legend>
        <div className="flex gap-4 mb-2 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="dueKind"
              checked={dueKind === 'FIXED_IN_PERIOD'}
              onChange={() => setDueKind('FIXED_IN_PERIOD')}
            />
            Ngày cố định trong kỳ
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="dueKind"
              data-testid="radio-due-days-after-end"
              checked={dueKind === 'DAYS_AFTER_END'}
              onChange={() => setDueKind('DAYS_AFTER_END')}
            />
            N ngày sau khi kỳ kết thúc
          </label>
        </div>

        {dueKind === 'FIXED_IN_PERIOD' ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-600">
              Thuộc kỳ
              <select
                value={periodOffset}
                onChange={(e) => setPeriodOffset(Number(e.target.value) as 0 | 1)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
              >
                <option value={0}>Kỳ hiện tại</option>
                <option value={1}>Kỳ kế tiếp</option>
              </select>
            </label>
            {periodType === 'WEEKLY' ? (
              <label className="text-xs text-slate-600">
                Ngày trong tuần
                <select
                  value={anchorWeekday}
                  onChange={(e) => setAnchorWeekday(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
                >
                  {WEEKDAY_LABEL.map((label, i) => (
                    <option key={label} value={i + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="text-xs text-slate-600">
                Ngày trong {['QUARTERLY', 'SEMI_ANNUAL', 'YEARLY'].includes(periodType) ? 'tháng' : 'kỳ'}
                <input
                  type="number"
                  min={1}
                  max={31}
                  data-testid="input-anchor-day"
                  value={anchorDay}
                  onChange={(e) => setAnchorDay(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
                />
              </label>
            )}
            {['QUARTERLY', 'SEMI_ANNUAL', 'YEARLY'].includes(periodType) && (
              <label className="text-xs text-slate-600">
                Tháng thứ mấy trong {periodType === 'QUARTERLY' ? 'quý' : periodType === 'SEMI_ANNUAL' ? 'nửa năm' : 'năm'}
                <input
                  type="number"
                  min={1}
                  data-testid="input-anchor-month"
                  value={anchorMonth}
                  onChange={(e) => setAnchorMonth(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
                />
              </label>
            )}
            <label className="text-xs text-slate-600">
              Giờ
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
              />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-600">
              Số ngày sau khi kỳ kết thúc
              <input
                type="number"
                min={0}
                data-testid="input-days-after-end"
                value={daysAfterEnd}
                onChange={(e) => setDaysAfterEnd(Number(e.target.value))}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
              />
            </label>
            <label className="text-xs text-slate-600">
              Giờ
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
              />
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="border border-slate-200 rounded-lg p-3 mb-4">
        <legend className="text-xs font-semibold text-slate-600 px-1">Mở nhập</legend>
        <div className="flex gap-4 items-center text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="openKind"
              checked={openKind === 'AT_PERIOD_START'}
              onChange={() => setOpenKind('AT_PERIOD_START')}
            />
            Ngay đầu kỳ
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="openKind"
              data-testid="radio-open-days-before-due"
              checked={openKind === 'DAYS_BEFORE_DUE'}
              onChange={() => setOpenKind('DAYS_BEFORE_DUE')}
            />
            N ngày trước hạn
          </label>
          {openKind === 'DAYS_BEFORE_DUE' && (
            <input
              type="number"
              min={0}
              data-testid="input-open-days-before-due"
              value={openDaysBeforeDue}
              onChange={(e) => setOpenDaysBeforeDue(Number(e.target.value))}
              className="w-20 border border-slate-300 rounded px-2 py-1 text-sm"
            />
          )}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-slate-700 mb-4">
        <input
          type="checkbox"
          data-testid="checkbox-shift-non-working"
          checked={shiftNonWorking}
          onChange={(e) => setShiftNonWorking(e.target.checked)}
        />
        Dời hạn khỏi ngày nghỉ (lễ/Tết, theo lịch hệ thống)
      </label>
      {nonWorkingError && (
        <p className="text-xs text-amber-600 mb-4 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          {nonWorkingError}
        </p>
      )}

      <div className="border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Xem trước ít nhất 6 kỳ</h3>
        {previewError ? (
          <p className="text-sm text-red-700">{previewError}</p>
        ) : periods.length === 0 ? (
          <p className="text-sm text-slate-500">Chọn ngày của kỳ để xem trước.</p>
        ) : (
          <ul className="space-y-2 text-sm" data-testid="period-preview-list">
            {periods.map((p) => (
              <li
                key={p.periodKey}
                className="border border-slate-200 rounded-lg p-2"
                data-testid={`period-${p.periodKey}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{p.periodKey}</span>
                  <span className="text-xs text-slate-500">
                    {p.periodStart} → {p.periodEnd}
                  </span>
                </div>
                <p className="text-slate-600 text-xs mt-1">{p.description}</p>
                {p.warnings.length > 0 && (
                  <ul className="mt-1">
                    {p.warnings.map((w) => (
                      <li key={w.code} className="text-amber-700 text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {w.message}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={onBack}
          className={`flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg ${A11Y_FOCUS_RING}`}
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>
        <button
          type="button"
          data-testid="btn-schedule-next"
          disabled={!canSubmit}
          onClick={() => onNext(rule)}
          className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${A11Y_FOCUS_RING}`}
        >
          Tiếp theo
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
