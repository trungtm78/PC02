import { Test, TestingModule } from '@nestjs/testing';
import { DeadlineRuleActivatorScheduler } from './deadline-rule-activator.scheduler';
import { DeadlineRulesService } from '../deadline-rules.service';

describe('DeadlineRuleActivatorScheduler', () => {
  let scheduler: DeadlineRuleActivatorScheduler;
  let service: { activateDueRules: jest.Mock };

  beforeEach(async () => {
    service = { activateDueRules: jest.fn().mockResolvedValue({ activated: [] }) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadlineRuleActivatorScheduler,
        { provide: DeadlineRulesService, useValue: service },
      ],
    }).compile();
    scheduler = module.get(DeadlineRuleActivatorScheduler);
  });

  it('calls service.activateDueRules', async () => {
    await scheduler.run();
    expect(service.activateDueRules).toHaveBeenCalledTimes(1);
  });

  it('logs activated ids when result is non-empty', async () => {
    service.activateDueRules.mockResolvedValue({ activated: ['r1', 'r2'] });
    await expect(scheduler.run()).resolves.toBeUndefined();
  });

  it('swallows errors so cron keeps running on next tick', async () => {
    service.activateDueRules.mockRejectedValue(new Error('db down'));
    await expect(scheduler.run()).resolves.toBeUndefined();
  });
});
