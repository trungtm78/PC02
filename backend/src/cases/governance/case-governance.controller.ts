import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { CaseGovernanceService } from './case-governance.service';
@Controller('cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({ action: 'read', subject: 'Case' })
export class CaseGovernanceController {
  constructor(private readonly governance: CaseGovernanceService) {}
  @Get(':id/governance') snapshot(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.governance.snapshot(id, { actorId: user.id });
  }
  @Get(':id/capabilities') capabilities(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.governance.capabilities(id, { actorId: user.id });
  }
  @Get('handoffs/inbox') inbox(@CurrentUser() user: AuthUser) {
    return this.governance.handoffInbox({ actorId: user.id });
  }
  @Post(':id/handoffs') send(
    @Param('id') id: string,
    @Body() dto: Parameters<CaseGovernanceService['sendHandoff']>[1],
    @CurrentUser() user: AuthUser,
  ) {
    return this.governance.sendHandoff(id, dto, { actorId: user.id });
  }
  @Post(':id/handoffs/:handoffId/accept') accept(
    @Param('id') id: string,
    @Param('handoffId') handoffId: string,
    @Body() dto: Parameters<CaseGovernanceService['resolveHandoff']>[3],
    @CurrentUser() user: AuthUser,
  ) {
    return this.governance.resolveHandoff(id, handoffId, 'accept', dto, {
      actorId: user.id,
    });
  }
  @Post(':id/handoffs/:handoffId/cancel') cancel(
    @Param('id') id: string,
    @Param('handoffId') handoffId: string,
    @Body() dto: Parameters<CaseGovernanceService['resolveHandoff']>[3],
    @CurrentUser() user: AuthUser,
  ) {
    return this.governance.resolveHandoff(id, handoffId, 'cancel', dto, {
      actorId: user.id,
    });
  }
  @Post(':id/handoffs/:handoffId/return') returnHandoff(
    @Param('id') id: string,
    @Param('handoffId') handoffId: string,
    @Body() dto: Parameters<CaseGovernanceService['resolveHandoff']>[3],
    @CurrentUser() user: AuthUser,
  ) {
    return this.governance.resolveHandoff(id, handoffId, 'return', dto, {
      actorId: user.id,
    });
  }
}
