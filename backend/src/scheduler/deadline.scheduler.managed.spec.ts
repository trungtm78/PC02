import { Test, TestingModule } from '@nestjs/testing';
import { DeadlineScheduler } from './deadline.scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { RecordDeadlineWriter } from '../processing-flow/records/record-deadline-writer.service';

/**
 * Once the new reminders are on (`processing_flow_reminders`) the legacy scheduler leaves the records whose deadline a
 * flow keeps to them: no second notice about the same deadline. While the switch is off, or nothing is wired, its
 * queries are exactly the old ones (deadline.scheduler.spec.ts covers that without these providers).
 */
const mockPrisma = {
  systemSetting: { findUnique: jest.fn() },
  case: { findMany: jest.fn() },
  incident: { findMany: jest.fn() },
  petition: { findMany: jest.fn() },
  overdueNotification: { findUnique: jest.fn(), upsert: jest.fn() },
  userTeam: { findMany: jest.fn() },
  dataAccessGrant: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  notification: { create: jest.fn() },
};
const flags = { isEnabled: jest.fn() };
const writer = { managedRecordIds: jest.fn() };

const TODAY = new Date('2026-04-24T07:00:00Z');
const queries = (model: 'case' | 'incident' | 'petition') => mockPrisma[model].findMany.mock.calls.map((call) => (call[0] as { where: Record<string, unknown> }).where);

describe('DeadlineScheduler and the records whose deadline a flow keeps', () => {
  async function build(providers: unknown[]): Promise<DeadlineScheduler> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeadlineScheduler, { provide: PrismaService, useValue: mockPrisma }, { provide: PushService, useValue: { sendToUser: jest.fn() } }, ...(providers as never[])],
    }).compile();
    return module.get(DeadlineScheduler);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(TODAY);
    mockPrisma.systemSetting.findUnique.mockResolvedValue({ value: '7' });
    mockPrisma.case.findMany.mockResolvedValue([]);
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.petition.findMany.mockResolvedValue([]);
    writer.managedRecordIds.mockImplementation((kind: string) => Promise.resolve(kind === 'CASE' ? ['c-1', 'c-2'] : kind === 'INCIDENT' ? ['i-1'] : ['p-1']));
  });
  afterEach(() => jest.useRealTimers());

  const wired = [
    { provide: FeatureFlagsService, useValue: flags },
    { provide: RecordDeadlineWriter, useValue: writer },
  ];

  it('with the reminders switch ON the managed ids are left out of every query of the run, per kind', async () => {
    flags.isEnabled.mockResolvedValue(true);
    const scheduler = await build(wired);
    await scheduler.checkDeadlines();
    expect(flags.isEnabled).toHaveBeenCalledWith('processing_flow_reminders');
    expect(queries('case')).toHaveLength(2);
    for (const where of queries('case')) expect(where.id).toEqual({ notIn: ['c-1', 'c-2'] });
    expect(queries('incident')).toHaveLength(2);
    for (const where of queries('incident')) expect(where.id).toEqual({ notIn: ['i-1'] });
    expect(queries('petition')).toHaveLength(2);
    for (const where of queries('petition')) expect(where.id).toEqual({ notIn: ['p-1'] });
  });

  it('with the switch ON but no managed record the queries carry no id condition at all', async () => {
    flags.isEnabled.mockResolvedValue(true);
    writer.managedRecordIds.mockResolvedValue([]);
    const scheduler = await build(wired);
    await scheduler.checkDeadlines();
    for (const model of ['case', 'incident', 'petition'] as const) for (const where of queries(model)) expect(where).not.toHaveProperty('id');
  });

  it('with the switch OFF nothing is excluded and the ids are not even read', async () => {
    flags.isEnabled.mockResolvedValue(false);
    const scheduler = await build(wired);
    await scheduler.checkDeadlines();
    expect(writer.managedRecordIds).not.toHaveBeenCalled();
    for (const model of ['case', 'incident', 'petition'] as const) {
      expect(queries(model)).toHaveLength(2);
      for (const where of queries(model)) expect(where).not.toHaveProperty('id');
    }
  });

  it('without the feature-flag service or the writer nothing is excluded', async () => {
    const scheduler = await build([]);
    await scheduler.checkDeadlines();
    expect(flags.isEnabled).not.toHaveBeenCalled();
    for (const model of ['case', 'incident', 'petition'] as const) for (const where of queries(model)) expect(where).not.toHaveProperty('id');
  });

  it('when the lookup of the managed ids fails the run still reminds about every record', async () => {
    flags.isEnabled.mockResolvedValue(true);
    writer.managedRecordIds.mockRejectedValue(new Error('db down'));
    const scheduler = await build(wired);
    await expect(scheduler.checkDeadlines()).resolves.toBeUndefined();
    expect(queries('case')).toHaveLength(2);
    for (const where of queries('case')) expect(where).not.toHaveProperty('id');
  });
});
