import { Module } from '@nestjs/common';
import { VksMeetingsService } from './vks-meetings.service';
import { CaseVksMeetingsController, IncidentVksMeetingsController } from './vks-meetings.controller';

@Module({
  controllers: [CaseVksMeetingsController, IncidentVksMeetingsController],
  providers: [VksMeetingsService],
  exports: [VksMeetingsService],
})
export class VksMeetingsModule {}
