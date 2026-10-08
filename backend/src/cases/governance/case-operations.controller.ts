import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import { CaseOperationsService } from './case-operations.service';
import { governanceActor } from './legal-workflow.controller';
type TaskBody = {
  requestKey: string;
  expectedUpdatedAt: string;
  expectedAggregateUpdatedAt?: string;
  type: string;
  sourceId: string;
  assigneeId?: string | null;
  status?: string;
  dueAt?: string | null;
  payload: unknown;
};
@Controller('cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({ action: 'read', subject: 'Case' })
export class CaseOperationsController {
  constructor(private readonly service: CaseOperationsService) {}
  @Get('governance/tasks') tasks(@Req() req: ScopedRequest) {
    return this.service.tasks(governanceActor(req));
  }
  @Get('governance/dashboard') dashboard(@Req() req: ScopedRequest) {
    return this.service.dashboard(governanceActor(req));
  }
  @Get('governance/queues/:key') queue(
    @Param('key') key: string,
    @Query('clock') clock: string | undefined,
    @Req() req: ScopedRequest,
  ) {
    return this.service.queue(
      key,
      governanceActor(req),
      clock ? new Date(clock) : new Date(),
    );
  }
  @Post(':id/governance/tasks') createTask(
    @Param('id') id: string,
    @Body() dto: TaskBody,
    @Req() req: ScopedRequest,
  ) {
    return this.service.saveTask(id, null, dto, governanceActor(req));
  }
  @Patch(':id/governance/tasks/:taskId') reviseTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: TaskBody,
    @Req() req: ScopedRequest,
  ) {
    return this.service.saveTask(id, taskId, dto, governanceActor(req));
  }
  @Get(':id/relations') relations(
    @Param('id') id: string,
    @Req() req: ScopedRequest,
  ) {
    return this.service.relations(id, governanceActor(req));
  }
  @Post(':id/relations') relate(
    @Param('id') id: string,
    @Body()
    dto: {
      requestKey: string;
      expectedUpdatedAt: string;
      targetCaseId: string;
      decisionId: string;
      type: 'RELATED';
    },
    @Req() req: ScopedRequest,
  ) {
    return this.service.relate(id, dto, governanceActor(req));
  }
}
