import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CaseChildAccessModule } from './case-child-access.module';
import { CaseChildAccessService } from './case-child-access.service';
import { CaseSourceCreationService } from './case-source-creation.service';
import { CaseGraphPolicyInterceptor } from './case-graph.interceptor';
import { PrismaService } from '../prisma/prisma.service';
describe('CG14 real Nest child provider wiring',()=>{
  it('provides every mandatory source/JSON boundary and rejects a missing actor through the real service',async()=>{
    const module=await Test.createTestingModule({imports:[CaseChildAccessModule]}).overrideProvider(PrismaService).useValue({}).compile();
    expect(module.get(CaseSourceCreationService)).toBeInstanceOf(CaseSourceCreationService);
    expect(module.get(CaseGraphPolicyInterceptor)).toBeInstanceOf(CaseGraphPolicyInterceptor);
    await expect(module.get(CaseChildAccessService).listWhere()).rejects.toBeInstanceOf(ForbiddenException);
    await module.close();
  });
});
