import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { QueryIncidentsDto } from './dto/query-incidents.dto';
import { AssignInvestigatorDto } from './dto/assign-investigator.dto';
import { ProsecuteIncidentDto } from './dto/prosecute-incident.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { MergeIncidentDto } from './dto/merge-incident.dto';
import { TransferIncidentDto } from './dto/transfer-incident.dto';
import { DeleteIncidentDto } from './dto/delete-incident.dto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

@Controller('incidents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  // GET /api/v1/incidents — Danh sách vụ việc
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  getList(@Query() query: QueryIncidentsDto, @Req() req: Request) {
    return this.incidentsService.getList(query, (req as any).dataScope);
  }

  // GET /api/v1/incidents/stats — Count theo status
  @Get('stats')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  getStats(@Req() req: Request) {
    return this.incidentsService.getStats((req as any).dataScope);
  }

  // GET /api/v1/incidents/investigators — Danh sách điều tra viên
  @Get('investigators')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  getInvestigators(@Query('search') search?: string) {
    return this.incidentsService.getInvestigators(search);
  }

  // GET /api/v1/incidents/:id — Chi tiết vụ việc
  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.incidentsService.getById(id, (req as any).dataScope);
  }

  // POST /api/v1/incidents — Tạo vụ việc mới
  @Post()
  @RequirePermissions({ action: 'write', subject: 'Incident' })
  create(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.incidentsService.create(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // PUT /api/v1/incidents/:id — Cập nhật vụ việc
  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.incidentsService.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // DELETE /api/v1/incidents/:id — Xóa vụ việc (soft delete, 6 business rules)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Incident' })
  delete(
    @Param('id') id: string,
    @Body() dto: DeleteIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const dataScope = (req as any).dataScope ?? null;
    return this.incidentsService.delete(
      id,
      dto.reason,
      user.id,
      user.role,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      dataScope,
    );
  }

  // PATCH /api/v1/incidents/:id/status — Đổi trạng thái
  @Patch(':id/status')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.incidentsService.updateStatus(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // PATCH /api/v1/incidents/:id/merge — Nhập vào vụ khác
  @Patch(':id/merge')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  mergeInto(
    @Param('id') id: string,
    @Body() dto: MergeIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.incidentsService.mergeInto(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // PATCH /api/v1/incidents/:id/transfer — Chuyển đơn vị
  @Patch(':id/transfer')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  transferUnit(
    @Param('id') id: string,
    @Body() dto: TransferIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.incidentsService.transferUnit(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // PATCH /api/v1/incidents/:id/assign — Phân công điều tra viên
  @Patch(':id/assign')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  assignInvestigator(
    @Param('id') id: string,
    @Body() dto: AssignInvestigatorDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.incidentsService.assignInvestigator(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // POST /api/v1/incidents/:id/prosecute — Khởi tố vụ việc → Vụ án
  @Post(':id/prosecute')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  prosecute(
    @Param('id') id: string,
    @Body() dto: ProsecuteIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.incidentsService.prosecute(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
