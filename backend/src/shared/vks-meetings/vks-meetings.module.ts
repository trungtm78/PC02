import { CaseGraphAccessModule } from '../../reports/graph-access/case-graph-access.module';
import { Module } from '@nestjs/common';
import { VksMeetingsService } from './vks-meetings.service';
import {
  CaseVksMeetingsController,
  IncidentVksMeetingsController,
} from './vks-meetings.controller';

@Module({
  imports: [CaseGraphAccessModule],
  controllers: [CaseVksMeetingsController, IncidentVksMeetingsController],
  providers: [VksMeetingsService],
  exports: [VksMeetingsService],
})
export class VksMeetingsModule {}
