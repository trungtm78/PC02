import { Module } from '@nestjs/common';
import { DeadlineScheduler } from './deadline.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { ProcessingFlowModule } from '../processing-flow/processing-flow.module';

// ProcessingFlowModule: the records whose deadline a flow keeps are left to the new reminders once their switch is on.
// FeatureFlagsService comes from the global FeatureFlagsModule.
@Module({
  imports: [PrismaModule, PushModule, ProcessingFlowModule],
  providers: [DeadlineScheduler],
})
export class SchedulerModule {}
