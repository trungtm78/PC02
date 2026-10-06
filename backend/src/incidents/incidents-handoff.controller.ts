import {
  Controller,
  Headers,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { IncidentsHandoffService } from './incidents-handoff.service';
import { IncidentsService } from './incidents.service';
import {
  SendIncidentHandoffDto,
  ResolveIncidentHandoffDto,
} from './dto/incident-handoff.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Controller('incidents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncidentsHandoffController {
  constructor(
    private readonly handoffs: IncidentsHandoffService,
    private readonly incidents: IncidentsService,
  ) {}
  @Get('handoffs/inbox')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  inbox(
    @Req() req: ScopedRequest,
    @Query('offset') offset = '0',
    @Query('limit') limit = '20',
  ) {
    return this.handoffs.inbox(
      req.dataScope,
      Number(offset) || 0,
      Number(limit) || 20,
    );
  }
  @Post('intake')
  @RequirePermissions({ action: 'write', subject: 'Incident' })
  async intake(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    await this.handoffs.ensureEnabled();
    return this.incidents.create(
      dto,
      user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      req.dataScope,
      idempotencyKey,
      { intake: true },
    );
  }
  @Post(':id/handoffs')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  send(
    @Param('id') id: string,
    @Body() dto: SendIncidentHandoffDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.handoffs.send(id, dto, user.id, req.dataScope);
  }
  @Get(':id/handoffs')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  history(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.handoffs.history(id, req.dataScope);
  }
  @Post(':id/handoffs/:handoffId/accept')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  accept(
    @Param('id') id: string,
    @Param('handoffId') handoffId: string,
    @Body() dto: ResolveIncidentHandoffDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.handoffs.accept(id, handoffId, dto, user.id, req.dataScope);
  }
  @Post(':id/handoffs/:handoffId/cancel')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  cancel(
    @Param('id') id: string,
    @Param('handoffId') handoffId: string,
    @Body() dto: ResolveIncidentHandoffDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.handoffs.cancel(id, handoffId, dto, user.id, req.dataScope);
  }
}
