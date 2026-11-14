import 'reflect-metadata';
import { DeadlineScheduler } from './deadline.scheduler';

/**
 * REGRESSION CONTRACT: when the legacy deadline reminder runs. Read from the decorator itself, so that a change of
 * the schedule (or a second reminder taking this slot) shows here.
 */
describe('the schedule of the daily deadline reminder', () => {
  // The keys `@nestjs/schedule` stores a `@Cron(...)` under.
  const options = Reflect.getMetadata('SCHEDULE_CRON_OPTIONS', DeadlineScheduler.prototype.checkDeadlines) as Record<string, unknown>;

  it('it runs once a day at 07:00', () => {
    expect(options.cronTime).toBe('0 7 * * *');
  });

  it('it names no time zone: 07:00 is the clock of the server process', () => {
    expect(options.timeZone).toBeUndefined();
    expect(options.utcOffset).toBeUndefined();
  });

  it('it is the only scheduled method of the class', () => {
    const scheduled = Object.getOwnPropertyNames(DeadlineScheduler.prototype).filter((name) =>
      Reflect.hasMetadata('SCHEDULE_CRON_OPTIONS', DeadlineScheduler.prototype[name as keyof DeadlineScheduler] as object),
    );
    expect(scheduled).toEqual(['checkDeadlines']);
  });
});
