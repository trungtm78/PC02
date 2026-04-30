import { Module } from '@nestjs/common';
import { ActionPlansService } from './action-plans.service';
import { CaseActionPlansController, IncidentActionPlansController } from './action-plans.controller';

@Module({
  controllers: [CaseActionPlansController, IncidentActionPlansController],
  providers: [ActionPlansService],
  exports: [ActionPlansService],
})
export class ActionPlansModule {}
