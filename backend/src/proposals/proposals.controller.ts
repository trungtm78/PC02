import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { ProposalsService } from './proposals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { QueryProposalsDto } from './dto/query-proposals.dto';

@Controller('proposals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getList(@Query() query: QueryProposalsDto, @Req() req: ScopedRequest) {
    return this.proposalsService.getList(query, req.dataScope);
  }

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'Case' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportExcel(
    @Query() query: { status?: string; unit?: string; fromDate?: string; toDate?: string },
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.proposalsService.exportToExcel(query, req.dataScope, res);
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getById(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.proposalsService.getById(id, req.dataScope);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(@Body() dto: CreateProposalDto, @CurrentUser() user: AuthUser, @Req() req: ScopedRequest) {
    return this.proposalsService.create(dto, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Case' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateProposalDto>, @CurrentUser() user: AuthUser, @Req() req: ScopedRequest) {
    return this.proposalsService.update(id, dto, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] }, req.dataScope);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Case' })
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: ScopedRequest) {
    return this.proposalsService.delete(id, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] }, req.dataScope);
  }
}
