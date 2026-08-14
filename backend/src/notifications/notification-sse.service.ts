import { Injectable, OnModuleDestroy, MessageEvent } from '@nestjs/common';
import { Subject, Observable, merge, interval } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class NotificationSseService implements OnModuleDestroy {
  // Map<userId, Set<Subject>> — support multiple tabs per user
  private readonly streams = new Map<string, Set<Subject<void>>>();

  /** Called by NotificationEventService after creating a notification */
  notifyUser(userId: string): void {
    this.streams.get(userId)?.forEach((s) => s.next());
  }

  /** Called by SseController to create a per-tab stream */
  createStream(userId: string): Observable<MessageEvent> {
    const subject = new Subject<void>();
    if (!this.streams.has(userId)) this.streams.set(userId, new Set());
    this.streams.get(userId)!.add(subject);

    const notify$ = subject.pipe(
      map(() => ({ data: { type: 'unread-count-update' } }) as MessageEvent),
    );

    // D4: heartbeat every 30s — keeps connection alive through NAT/firewall
    const heartbeat$ = interval(30_000).pipe(
      map(() => ({ data: { type: 'heartbeat' } }) as MessageEvent),
    );

    return new Observable<MessageEvent>((observer) => {
      const sub = merge(notify$, heartbeat$).subscribe(observer);

      return () => {
        sub.unsubscribe();
        this.streams.get(userId)?.delete(subject);
        if (this.streams.get(userId)?.size === 0) {
          this.streams.delete(userId);
        }
      };
    });
  }

  onModuleDestroy(): void {
    this.streams.forEach((set) => set.forEach((s) => s.complete()));
    this.streams.clear();
  }
}
