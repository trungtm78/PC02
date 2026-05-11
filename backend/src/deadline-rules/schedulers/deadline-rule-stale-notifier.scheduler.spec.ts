import { Test, TestingModule } from '@nestjs/testing';
import { DeadlineRuleStaleNotifierScheduler } from './deadline-rule-stale-notifier.scheduler';
import { DeadlineRulesService } from '../deadline-rules.service';

describe('DeadlineRuleStaleNotifierScheduler', () => {
  let scheduler: DeadlineRuleStaleNotifierScheduler;
  let service: { notifyStaleSubmissions: jest.Mock };

  beforeEach(async () => {
    service = { notifyStaleSubmissions: jest.fn().mockResolvedValue({ notified: [] }) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadlineRuleStaleNotifierScheduler,
        { provide: DeadlineRulesService, useValue: service },
      ],
    }).compile();
    scheduler = module.get(DeadlineRuleStaleNotifierScheduler);
  });

  it('calls service.notifyStaleSubmissions with default 24h threshold', async () => {
    await scheduler.run();
    expect(service.notifyStaleSubmissions).toHaveBeenCalledWith(24);
  });

  it('swallows errors', async () => {
    service.notifyStaleSubmissions.mockRejectedValue(new Error('notif fail'));
    await expect(scheduler.run()).resolves.toBeUndefined();
  });
});
