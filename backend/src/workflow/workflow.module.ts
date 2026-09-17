import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { PetitionsModule } from '../petitions/petitions.module';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

/** Màn nghiệp vụ gộp nhiều loại hồ sơ (Chuyển đội / Trả hồ sơ). */
@Module({
  imports: [CasesModule, IncidentsModule, PetitionsModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
})
export class WorkflowModule {}
