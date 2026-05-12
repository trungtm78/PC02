import { Module } from '@nestjs/common';
import { EventRemindersController } from './event-reminders.controller';
import { EventRemindersService } from './event-reminders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EventRemindersController],
  providers: [EventRemindersService],
  exports: [EventRemindersService],
})
export class EventRemindersModule {}
