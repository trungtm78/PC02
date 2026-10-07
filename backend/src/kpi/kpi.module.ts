import { CaseGraphAccessModule } from '../reports/graph-access/case-graph-access.module';
import { Module } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { KpiController } from './kpi.controller';

@Module({
  imports: [CaseGraphAccessModule],
  controllers: [KpiController],
  providers: [KpiService],
  exports: [KpiService],
})
export class KpiModule {}
