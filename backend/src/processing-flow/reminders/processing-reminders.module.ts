import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { ProcessingFlowModule } from '../processing-flow.module';
import { ProcessingReminderService } from './processing-reminder.service';
import { ProcessingRemindersController } from './processing-reminders.controller';

/**
 * The reminders of the processing flow. A module of its own, and not part of `ProcessingFlowModule`, because it needs
 * the notification path: the notifications reach the case modules, the case modules import `ProcessingFlowModule`, and
 * importing the notifications there would close a circle. Nothing imports this module.
 */
@Module({
  imports: [ProcessingFlowModule, NotificationsModule, AuthModule],
  controllers: [ProcessingRemindersController],
  providers: [ProcessingReminderService],
})
export class ProcessingRemindersModule {}
