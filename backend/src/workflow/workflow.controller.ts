import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { WorkflowService } from './workflow.service';
import { QueryChuyenTraDto } from './dto/query-chuyen-tra.dto';

@Controller('workflow')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  // GET /api/v1/workflow/chuyen-tra — danh sách gộp Vụ án + Vụ việc + Đơn thư cho màn Chuyển đội/Trả hồ sơ.
  @Get('chuyen-tra')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  listChuyenTra(@Query() query: QueryChuyenTraDto, @Req() req: ScopedRequest) {
    return this.workflow.listChuyenTra(query, req.dataScope);
  }
}
