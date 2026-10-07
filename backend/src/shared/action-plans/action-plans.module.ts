import { CaseGraphAccessModule } from '../../reports/graph-access/case-graph-access.module';
import { Module } from '@nestjs/common';
import { ActionPlansService } from './action-plans.service';
import {
  CaseActionPlansController,
  IncidentActionPlansController,
} from './action-plans.controller';

@Module({
  imports: [CaseGraphAccessModule],
  controllers: [CaseActionPlansController, IncidentActionPlansController],
  providers: [ActionPlansService],
  exports: [ActionPlansService],
})
export class ActionPlansModule {}
