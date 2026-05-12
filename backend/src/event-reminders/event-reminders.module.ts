import { Module } from '@nestjs/common';
import { EventRemindersController } from './event-reminders.controller';
import { EventRemindersService } from './event-reminders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, AuthModule, PushModule, EmailModule],
  controllers: [EventRemindersController],
  providers: [EventRemindersService],
  exports: [EventRemindersService],
})
export class EventRemindersModule {}
