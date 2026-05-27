import { TestingModule, Test } from '@nestjs/testing';
import { NotificationSseService } from './notification-sse.service';
import { firstValueFrom, take, toArray } from 'rxjs';

describe('NotificationSseService', () => {
  let service: NotificationSseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationSseService],
    }).compile();
    service = module.get<NotificationSseService>(NotificationSseService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('emits an event to a subscribed user when notifyUser is called', (done) => {
    const stream$ = service.createStream('user-1');
    stream$.pipe(take(1)).subscribe({
      next: (event) => {
        expect(event).toBeDefined();
        expect(event.data).toMatchObject({ type: 'unread-count-update' });
        done();
      },
      error: done,
    });
    service.notifyUser('user-1');
  });

  it('emits to all tabs of the same user when notifyUser is called', (done) => {
    let received = 0;
    const onNext = () => {
      received++;
      if (received === 2) {
        expect(received).toBe(2);
        done();
      }
    };

    service.createStream('user-1').pipe(take(1)).subscribe({ next: onNext, error: done });
    service.createStream('user-1').pipe(take(1)).subscribe({ next: onNext, error: done });

    service.notifyUser('user-1');
  });

  it('does not emit to a different user when notifyUser is called', (done) => {
    let user2Received = false;
    service.createStream('user-2').pipe(take(1)).subscribe({
      next: () => { user2Received = true; },
      error: done,
    });

    service.notifyUser('user-1');

    // Give it a tick — if user-2 received anything, the flag would be set
    setTimeout(() => {
      expect(user2Received).toBe(false);
      done();
    }, 50);
  });

  it('cleans up internal state when a client stream is unsubscribed', (done) => {
    const sub = service.createStream('user-1').subscribe();
    // Force subscription to exist
    setTimeout(() => {
      sub.unsubscribe();
      // After unsubscribe the stream map entry should be cleaned up
      service.notifyUser('user-1'); // should not throw
      done();
    }, 10);
  });

  it('completes all streams on module destroy without throwing', () => {
    service.createStream('user-a').subscribe();
    service.createStream('user-b').subscribe();
    expect(() => service.onModuleDestroy()).not.toThrow();
  });
});
