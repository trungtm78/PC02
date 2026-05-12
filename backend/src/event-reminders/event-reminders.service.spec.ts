import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventRemindersService } from './event-reminders.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { EmailService } from '../email/email.service';
import { ReminderChannelDto } from './dto/create-reminder.dto';

describe('EventRemindersService', () => {
  let service: EventRemindersService;
  let mockPrisma: any;
  let mockPush: { sendToUser: jest.Mock };
  let mockEmail: { sendEventReminder: jest.Mock };

  beforeEach(async () => {
    mockPrisma = {
      eventReminder: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      calendarEvent: {
        findUnique: jest.fn(),
      },
      eventReminderDispatch: {
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'u1@pc02.local' }),
      },
    };
    mockPush = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    mockEmail = { sendEventReminder: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventRemindersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPush },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();
    service = module.get<EventRemindersService>(EventRemindersService);
  });

  describe('listForEvent()', () => {
    it('returns reminders for an event owned by the current user', async () => {
      const rows = [{ id: 'r1', eventId: 'e1', userId: 'u1', minutesBefore: 30, channels: ['FCM'] }];
      mockPrisma.eventReminder.findMany.mockResolvedValue(rows);
      const result = await service.listForEvent('e1', 'u1');
      expect(result).toEqual(rows);
    });
  });

  describe('create()', () => {
    it('rejects when the event does not exist', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue(null);
      await expect(
        service.create('e1', { minutesBefore: 30, channels: [ReminderChannelDto.FCM] }, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the event is soft-deleted', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue({
        id: 'e1',
        deletedAt: new Date(),
      });
      await expect(
        service.create('e1', { minutesBefore: 30, channels: [ReminderChannelDto.FCM] }, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects duplicate (same eventId + userId + minutesBefore)', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue({ id: 'e1', deletedAt: null });
      mockPrisma.eventReminder.findFirst.mockResolvedValue({ id: 'r-existing' });
      await expect(
        service.create('e1', { minutesBefore: 30, channels: [ReminderChannelDto.FCM] }, 'u1'),
      ).rejects.toThrow(ConflictException);
    });

    it('creates reminder when no duplicate exists', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue({ id: 'e1', deletedAt: null });
      mockPrisma.eventReminder.findFirst.mockResolvedValue(null);
      mockPrisma.eventReminder.create.mockResolvedValue({ id: 'r-new', minutesBefore: 30 });

      const result = await service.create(
        'e1',
        { minutesBefore: 30, channels: [ReminderChannelDto.FCM, ReminderChannelDto.EMAIL] },
        'u1',
      );
      expect(result.id).toBe('r-new');
      const callArgs = mockPrisma.eventReminder.create.mock.calls[0][0];
      expect(callArgs.data.userId).toBe('u1');
      expect(callArgs.data.eventId).toBe('e1');
      expect(callArgs.data.minutesBefore).toBe(30);
      expect(callArgs.data.channels).toEqual(['FCM', 'EMAIL']);
    });
  });

  describe('remove()', () => {
    it('throws NotFoundException when reminder does not exist', async () => {
      mockPrisma.eventReminder.findUnique.mockResolvedValue(null);
      await expect(service.remove('e1', 'r-nope', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when reminder belongs to another user', async () => {
      mockPrisma.eventReminder.findUnique.mockResolvedValue({
        id: 'r1',
        eventId: 'e1',
        userId: 'someone-else',
      });
      await expect(service.remove('e1', 'r1', 'u1')).rejects.toThrow(ForbiddenException);
    });

    it('deletes when reminder belongs to current user', async () => {
      mockPrisma.eventReminder.findUnique.mockResolvedValue({
        id: 'r1',
        eventId: 'e1',
        userId: 'u1',
      });
      mockPrisma.eventReminder.delete.mockResolvedValue({ id: 'r1' });
      const result = await service.remove('e1', 'r1', 'u1');
      expect(result.id).toBe('r1');
      expect(mockPrisma.eventReminder.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    });
  });

  // ─── Cron dispatcher (the core piece) ─────────────────────────────────────
  describe('runDispatcher()', () => {
    it('mutex skips overlapping execution', async () => {
      mockPrisma.eventReminder.findMany.mockResolvedValue([]);
      // First call sets mutex true, but it should reset to false after.
      await service.runDispatcher();
      // If mutex reset works, second call should proceed (not throw).
      await service.runDispatcher();
      expect(mockPrisma.eventReminder.findMany).toHaveBeenCalledTimes(2);
    });

    it('skips when mutex says previous run still in flight', async () => {
      // Simulate a stuck previous run by setting flag manually via test hook.
      (service as any).running = true;
      mockPrisma.eventReminder.findMany.mockResolvedValue([]);
      await service.runDispatcher();
      expect(mockPrisma.eventReminder.findMany).not.toHaveBeenCalled();
      (service as any).running = false; // cleanup
    });

    it('sends FCM + email when reminder window matches an occurrence', async () => {
      // Event starts at NOW + 30 minutes. Reminder minutesBefore=30 → fire NOW.
      const now = new Date();
      const eventStart = new Date(now.getTime() + 30 * 60 * 1000);

      mockPrisma.eventReminder.findMany.mockResolvedValue([
        {
          id: 'r1',
          eventId: 'e1',
          userId: 'u1',
          minutesBefore: 30,
          channels: ['FCM', 'EMAIL'],
          event: {
            id: 'e1',
            title: 'Họp giao ban',
            startDate: eventStart,
            startTime: null,
            allDay: true,
            recurrenceRule: null,
            recurrenceEndDate: null,
            deletedAt: null,
            overrides: [],
          },
          user: { id: 'u1', email: 'u1@pc02.local' },
        },
      ]);
      mockPrisma.eventReminderDispatch.create.mockResolvedValue({ id: 'd1' });

      await service.runDispatcher();

      expect(mockPrisma.eventReminderDispatch.create).toHaveBeenCalled();
      expect(mockPush.sendToUser).toHaveBeenCalledWith('u1', expect.objectContaining({
        title: expect.stringContaining('Họp giao ban'),
      }));
      expect(mockEmail.sendEventReminder).toHaveBeenCalledWith('u1@pc02.local', 'Họp giao ban', expect.any(Date));
    });

    it('does NOT send when occurrence is outside the [now, now+6min] window', async () => {
      const now = new Date();
      const farFuture = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
      mockPrisma.eventReminder.findMany.mockResolvedValue([
        {
          id: 'r1',
          eventId: 'e1',
          userId: 'u1',
          minutesBefore: 30,
          channels: ['FCM'],
          event: {
            id: 'e1',
            title: 'Far event',
            startDate: farFuture,
            startTime: null,
            allDay: true,
            recurrenceRule: null,
            recurrenceEndDate: null,
            deletedAt: null,
            overrides: [],
          },
          user: { id: 'u1', email: 'u1@pc02.local' },
        },
      ]);

      await service.runDispatcher();

      expect(mockPrisma.eventReminderDispatch.create).not.toHaveBeenCalled();
      expect(mockPush.sendToUser).not.toHaveBeenCalled();
    });

    it('skips when dispatch row already exists (UNIQUE caught duplicate)', async () => {
      const now = new Date();
      const eventStart = new Date(now.getTime() + 30 * 60 * 1000);
      mockPrisma.eventReminder.findMany.mockResolvedValue([
        {
          id: 'r1',
          eventId: 'e1',
          userId: 'u1',
          minutesBefore: 30,
          channels: ['FCM'],
          event: {
            id: 'e1',
            title: 'Already sent',
            startDate: eventStart,
            startTime: null,
            allDay: true,
            recurrenceRule: null,
            recurrenceEndDate: null,
            deletedAt: null,
            overrides: [],
          },
          user: { id: 'u1', email: 'u1@pc02.local' },
        },
      ]);
      // Simulate UNIQUE violation: create throws Prisma P2002
      const err: any = new Error('Unique constraint failed');
      err.code = 'P2002';
      mockPrisma.eventReminderDispatch.create.mockRejectedValue(err);

      await service.runDispatcher();

      expect(mockPush.sendToUser).not.toHaveBeenCalled();
      expect(mockEmail.sendEventReminder).not.toHaveBeenCalled();
    });
  });

  // ─── Prune cron ───────────────────────────────────────────────────────────
  describe('prune()', () => {
    it('deletes dispatch rows older than 90 days', async () => {
      mockPrisma.eventReminderDispatch.deleteMany.mockResolvedValue({ count: 123 });
      const deletedCount = await service.prune();
      expect(deletedCount).toBe(123);
      const callArgs = mockPrisma.eventReminderDispatch.deleteMany.mock.calls[0][0];
      const cutoff = callArgs.where.sentAt.lt;
      const daysAgo = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysAgo).toBeGreaterThan(89.9);
      expect(daysAgo).toBeLessThan(90.1);
    });
  });
});
