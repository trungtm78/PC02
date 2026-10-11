import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma, DynReportReminderWindow } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DynReportDeadlineReminderEvent } from '../../notifications/events/notification.events';

/**
 * ReminderScheduler (spec §6.1 PR9, R17). Nhắc tổ CHƯA nộp ở 3 mốc trước
 * hạn — T-3 ngày/T-24h/T-3h — mỗi mốc gửi ĐÚNG MỘT LẦN cho mỗi lượt giao
 * (`DynReportReminder` unique trên `[assignmentId, window]`, cùng khuôn
 * chống trùng với `PeriodSchedulerService`'s unique period/assignment).
 *
 * "Kiểm quyền lại lúc gửi" không cần một bước riêng: danh sách editor
 * đang hoạt động được đọc TƯƠI ngay tại thời điểm tick (không phải
 * snapshot cũ từ lúc tạo assignment), nên tự nhiên phản ánh đúng ai còn
 * quyền nhận nhắc ngay lúc gửi.
 *
 * R17: cùng `pg_try_advisory_xact_lock` không chặn (non-blocking) như
 * `PeriodSchedulerService` — một tick thấy tick trước còn chạy thì bỏ qua
 * thay vì xếp hàng.
 */

const SCHEDULER_LOCK_KEY = 'dynamic-reports-reminder-scheduler';

const WINDOWS: Array<{
  key: DynReportReminderWindow;
  ms: number;
  label: string;
}> = [
  { key: 'T3D', ms: 3 * 24 * 60 * 60 * 1000, label: 'còn 3 ngày' },
  { key: 'T24H', ms: 24 * 60 * 60 * 1000, label: 'còn 24 giờ' },
  { key: 'T3H', ms: 3 * 60 * 60 * 1000, label: 'còn 3 giờ' },
];

const NOT_YET_SUBMITTED_STATES = ['NOT_STARTED', 'DRAFT', 'RETURNED'];

interface LockRow {
  locked: boolean;
}

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('*/15 * * * *', { name: SCHEDULER_LOCK_KEY })
  async run(): Promise<void> {
    const toNotify = await this.prisma.$transaction(async (tx) => {
      const [lockRow] = await tx.$queryRaw<LockRow[]>`
        SELECT pg_try_advisory_xact_lock(hashtext(${SCHEDULER_LOCK_KEY})) AS locked
      `;
      if (!lockRow?.locked) {
        this.logger.log('Previous tick still running — skipping this one.');
        return [];
      }
      return this.sendDueReminders(tx, new Date());
    });
    for (const n of toNotify) {
      this.eventEmitter.emit('dyn-report.deadline-reminder', n);
    }
  }

  /**
   * Tách riêng khỏi `run()` để test gọi trực tiếp, truyền `now` điều khiển
   * được (spec §10 — mọi engine/scheduler liên quan tới thời gian phải
   * nhận `now` qua tham số, không tự đọc đồng hồ hệ thống bên trong).
   */
  async sendDueReminders(
    tx: Prisma.TransactionClient,
    now: Date,
  ): Promise<DynReportDeadlineReminderEvent[]> {
    const events: DynReportDeadlineReminderEvent[] = [];
    const periods = await tx.dynReportPeriod.findMany({
      where: { status: 'OPEN' },
      include: {
        report: true,
        assignments: {
          include: {
            submission: true,
            editors: { where: { isActive: true } },
          },
        },
      },
    });

    for (const period of periods) {
      for (const window of WINDOWS) {
        const windowStart = new Date(period.dueAt.getTime() - window.ms);
        if (now < windowStart) continue;

        for (const assignment of period.assignments) {
          if (assignment.obligation === 'EXEMPT') continue;
          const state = assignment.submission?.state ?? 'NOT_STARTED';
          if (!NOT_YET_SUBMITTED_STATES.includes(state)) continue;

          const editorIds = assignment.editors.map((e) => e.userId);
          if (editorIds.length === 0) continue;

          // Pre-check rather than create-and-catch-P2002: the advisory
          // lock already guarantees only one tick runs at a time, so
          // there's no race to protect against here — and a unique
          // violation would abort the REST of this transaction in
          // Postgres (every later statement errors with "current
          // transaction is aborted" until rollback), silently dropping
          // every reminder after the first duplicate in the same tick.
          const alreadySent = await tx.dynReportReminder.findUnique({
            where: {
              assignmentId_window: {
                assignmentId: assignment.id,
                window: window.key,
              },
            },
          });
          if (alreadySent) continue;

          await tx.dynReportReminder.create({
            data: { assignmentId: assignment.id, window: window.key },
          });

          events.push(
            new DynReportDeadlineReminderEvent(
              assignment.id,
              period.report.name,
              period.periodKey,
              editorIds,
              period.dueAt.toISOString(),
              window.label,
            ),
          );
        }
      }
    }
    return events;
  }
}
