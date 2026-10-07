import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import {
  CaseGraphAccessService,
  GRAPH_PRISMA,
} from './case-graph-access.service';
import { CaseGraphAccessInterceptor } from './case-graph-access.interceptor';
@Module({
  imports: [PrismaModule],
  providers: [
    CaseGraphAccessService,
    CaseGraphAccessInterceptor,
    {
      provide: GRAPH_PRISMA,
      useFactory: (access: CaseGraphAccessService) => access.wrap(),
      inject: [CaseGraphAccessService],
    },
  ],
  exports: [CaseGraphAccessService, CaseGraphAccessInterceptor, GRAPH_PRISMA],
})
export class CaseGraphAccessModule {}
