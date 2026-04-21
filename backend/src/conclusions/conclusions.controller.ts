import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { ConclusionsService, QueryConclusionsDto } from './conclusions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateConclusionDto } from './dto/create-conclusion.dto';

@Controller('conclusions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ConclusionsController {
  constructor(private readonly conclusionsService: ConclusionsService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getList(@Query() query: QueryConclusionsDto) {
    return this.conclusionsService.getList(query);
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.conclusionsService.getById(id, (req as any).dataScope);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(@Body() dto: CreateConclusionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.conclusionsService.create(dto, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Case' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateConclusionDto>, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.conclusionsService.update(id, dto, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Case' })
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.conclusionsService.delete(id, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }
}
