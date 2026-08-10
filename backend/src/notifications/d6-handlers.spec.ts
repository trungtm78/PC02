import { NotificationType } from '@prisma/client';
import { NotificationEventService } from './notification-event.service';
import {
  CaseStatusChangedEvent,
  IncidentCreatedEvent,
  PetitionReceivedEvent,
} from './events/notification.events';

/**
 * D6. Three handlers existed and did nothing but `logger.debug`, and no emitter
 * anywhere published the events they listened for. Both halves were broken, and
 * neither half reported it: the system looked like it had notifications, nobody
 * ever received one, and no log line said why.
 *
 * The emitter half is the one that fails silently forever, so these tests check
 * the handler actually writes — and that a failure inside it cannot take down
 * the business operation that already committed.
 */
function makeService(over: Record<string, unknown> = {}) {
  // Typed with the payload it really takes so the assertions can read the
  // recorded call; an argument-less mock infers an empty tuple.
  const sendInApp = jest.fn((payload: Record<string, unknown>) =>
    Promise.resolve(payload),
  );
  const recipients = {
    getAllHeadUnits: jest.fn(() => Promise.resolve(['u-lead-1', 'u-lead-2'])),
    getTeamRecipients: jest.fn(() => Promise.resolve([])),
  };
  const logger = { error: jest.fn(), debug: jest.fn() };

  const svc = Object.create(
    NotificationEventService.prototype,
  ) as NotificationEventService;
  (svc as any).recipients = recipients;
  (svc as any).logger = logger;
  (svc as any).sendInApp = sendInApp;
  Object.assign(svc as object, over);
  return { svc, sendInApp, recipients, logger };
}

describe('onCaseStatusChanged', () => {
  it('notifies the officer holding the file, not the whole team', async () => {
    // A status change belongs to one file. Broadcasting it to a team is how a
    // notification bell becomes noise and then gets switched off.
    const { svc, sendInApp } = makeService();

    await svc.onCaseStatusChanged(
      new CaseStatusChangedEvent(
        'c-1',
        'VA-2026-00001',
        'u-7',
        'DANG_DIEU_TRA',
        'DA_KET_LUAN',
      ),
    );

    expect(sendInApp).toHaveBeenCalledTimes(1);
    expect(sendInApp.mock.calls[0][0]).toMatchObject({
      toUserId: 'u-7',
      type: NotificationType.CASE_STATUS_CHANGED,
      link: '/cases/c-1',
    });
  });

  it('sends nothing when the file has no holder', async () => {
    const { svc, sendInApp } = makeService();

    await svc.onCaseStatusChanged(
      new CaseStatusChangedEvent('c-1', 'VA-2026-00001', '', 'A', 'B'),
    );

    expect(sendInApp).not.toHaveBeenCalled();
  });

  it('swallows a delivery failure rather than rethrowing', async () => {
    // The case has already been saved by the time this runs. A notification
    // that cannot be delivered must not turn a completed status change into an
    // error the officer sees.
    const { svc, logger } = makeService({
      sendInApp: jest.fn(() => Promise.reject(new Error('smtp down'))),
    });

    await expect(
      svc.onCaseStatusChanged(
        new CaseStatusChangedEvent('c-1', 'VA', 'u-7', 'A', 'B'),
      ),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('onPetitionReceived', () => {
  it('notifies every head of unit', async () => {
    const { svc, sendInApp } = makeService();

    await svc.onPetitionReceived(
      new PetitionReceivedEvent('p-1', 'DT-2026-00001', 'u-1'),
    );

    expect(sendInApp).toHaveBeenCalledTimes(2);
    expect(sendInApp.mock.calls[0][0]).toMatchObject({
      type: NotificationType.PETITION_RECEIVED,
      link: '/petitions/p-1',
    });
  });
});

describe('onIncidentCreated', () => {
  it('uses the enum value added for it', async () => {
    // `INCIDENT_CREATED` needed `ALTER TYPE ADD VALUE`, which ADR-0010 records
    // as one-way. Reaching for a near-miss like CASE_ASSIGNED instead would
    // have mislabelled every incident notification forever.
    const { svc, sendInApp } = makeService();

    await svc.onIncidentCreated(
      new IncidentCreatedEvent('i-1', 'Xác minh tin báo', 'u-1'),
    );

    expect(sendInApp.mock.calls[0][0]).toMatchObject({
      type: NotificationType.INCIDENT_CREATED,
      link: '/vu-viec/i-1',
    });
  });

  it('does not rethrow when recipient lookup fails', async () => {
    const { svc, logger } = makeService({
      recipients: {
        getAllHeadUnits: jest.fn(() => Promise.reject(new Error('db down'))),
      },
    });

    await expect(
      svc.onIncidentCreated(new IncidentCreatedEvent('i-1', 'x', 'u-1')),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
