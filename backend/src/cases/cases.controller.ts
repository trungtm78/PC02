import {
  Controller,
  Get,
  Post,
  Put,
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
import { CasesService } from './cases.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
@Controller('cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  // GET /api/v1/cases — Danh sách vụ án (paginated + filtered)
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getList(@Query() query: QueryCasesDto, @Req() req: Request) {
    return this.casesService.getList(query, (req as any).dataScope);
  }

  // GET /api/v1/cases/:id/status-history — Lịch sử thay đổi trạng thái
  @Get(':id/status-history')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getStatusHistory(@Param('id') id: string) {
    return this.casesService.getStatusHistory(id);
  }

  // GET /api/v1/cases/:id — Chi tiết vụ án
  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.casesService.getById(id, (req as any).dataScope);
  }

  // POST /api/v1/cases — Tạo vụ án mới
  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(
    @Body() dto: CreateCaseDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casesService.create(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // PUT /api/v1/cases/:id — Cập nhật vụ án
  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Case' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCaseDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casesService.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, (req as any).dataScope);
  }

  // DELETE /api/v1/cases/:id — Xóa vụ án (soft delete)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Case' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.casesService.delete(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, (req as any).dataScope);
  }
}
