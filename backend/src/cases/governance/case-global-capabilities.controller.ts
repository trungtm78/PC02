import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { CaseGovernanceService } from './case-governance.service';
@Controller('cases/governance')
@UseGuards(JwtAuthGuard)
export class CaseGlobalCapabilitiesController {
  constructor(private readonly core: CaseGovernanceService) {}
  @Get('capabilities') get(@CurrentUser() user: AuthUser) {
    return this.core.globalCapabilities({ actorId: user.id });
  }
}
