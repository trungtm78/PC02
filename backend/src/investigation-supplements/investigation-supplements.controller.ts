import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { InvestigationSupplementsService, QueryInvestigationSupplementsDto } from './investigation-supplements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateInvestigationSupplementDto } from './dto/create-investigation-supplement.dto';

@Controller('investigation-supplements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvestigationSupplementsController {
  constructor(private readonly service: InvestigationSupplementsService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getList(@Query() query: QueryInvestigationSupplementsDto) {
    return this.service.getList(query);
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.service.getById(id, (req as any).dataScope);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(@Body() dto: CreateInvestigationSupplementDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.service.create(dto, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Case' })
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.service.delete(id, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }
}
