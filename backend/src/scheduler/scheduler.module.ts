import { Module } from '@nestjs/common';
import { DeadlineScheduler } from './deadline.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PrismaModule, PushModule],
  providers: [DeadlineScheduler],
})
export class SchedulerModule {}
