import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { SseController } from './sse.controller';
import { NotificationsService } from './notifications.service';
import { NotificationSseService } from './notification-sse.service';
import { NotificationEventService } from './notification-event.service';
import { NotificationPushScheduler } from './notification-push.scheduler';
import { NotificationCleanupScheduler } from './notification-cleanup.scheduler';
import { RecipientResolverService } from './recipient-resolver.service';
import { SseJwtGuard } from '../auth/guards/sse-jwt.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    PrismaModule,
    PushModule,
    JwtModule.register({ signOptions: { algorithm: 'RS256' } }),
  ],
  controllers: [NotificationsController, SseController],
  providers: [
    NotificationsService,
    NotificationSseService,
    NotificationEventService,
    NotificationPushScheduler,
    NotificationCleanupScheduler,
    RecipientResolverService,
    SseJwtGuard,
  ],
  exports: [NotificationsService, NotificationSseService],
})
export class NotificationsModule {}
