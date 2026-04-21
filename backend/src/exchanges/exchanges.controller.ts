import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { ExchangesService, QueryExchangesDto } from './exchanges.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateExchangeDto, CreateExchangeMessageDto } from './dto/create-exchange.dto';

@Controller('exchanges')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExchangesController {
  constructor(private readonly exchangesService: ExchangesService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getList(@Query() query: QueryExchangesDto) {
    return this.exchangesService.getList(query);
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.exchangesService.getById(id, (req as any).dataScope);
  }

  @Get(':id/messages')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getMessages(@Param('id') id: string) {
    return this.exchangesService.getMessages(id);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(@Body() dto: CreateExchangeDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.exchangesService.create(dto, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Post(':id/messages')
  @RequirePermissions({ action: 'write', subject: 'Case' })
  addMessage(@Param('id') id: string, @Body() body: { content: string; attachments?: any[] }, @CurrentUser() user: AuthUser) {
    return this.exchangesService.addMessage({ exchangeId: id, content: body.content, attachments: body.attachments }, user.id);
  }

  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Case' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateExchangeDto>, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.exchangesService.update(id, dto, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Case' })
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.exchangesService.delete(id, user.id, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }
}
