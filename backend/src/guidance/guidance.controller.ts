import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { GuidanceService } from './guidance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateGuidanceDto } from './dto/create-guidance.dto';
import { QueryGuidanceDto } from './dto/query-guidance.dto';

@Controller('guidance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GuidanceController {
  constructor(private readonly guidanceService: GuidanceService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getList(@Query() query: QueryGuidanceDto, @Req() req: ScopedRequest) {
    return this.guidanceService.getList(query, req.dataScope);
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getById(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.guidanceService.getById(id, req.dataScope);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(@Body() dto: CreateGuidanceDto, @CurrentUser() user: AuthUser, @Req() req: ScopedRequest) {
    return this.guidanceService.create(dto, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Case' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateGuidanceDto>, @CurrentUser() user: AuthUser, @Req() req: ScopedRequest) {
    return this.guidanceService.update(id, dto, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] }, req.dataScope);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Case' })
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: ScopedRequest) {
    return this.guidanceService.delete(id, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] }, req.dataScope);
  }
}
