import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import { CaseEvidenceGovernanceService } from './evidence-governance.service';
import type { EvidenceCommand } from './evidence-governance.service';

@Controller('cases/:id/evidence-governance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({ action: 'read', subject: 'Case' })
export class CaseEvidenceGovernanceController {
  constructor(private readonly evidence: CaseEvidenceGovernanceService) {}
  private actor(user: AuthUser, req: ScopedRequest) {
    return { actorId: user.id, dataScope: req.dataScope };
  }
  @Get() summary(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.getSummary(id, this.actor(user, req));
  }
  @Post('assets/register') register(
    @Param('id') id: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.registerAsset(id, body, this.actor(user, req));
  }
  @Post('assets/:assetId/derivative') derivative(
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.registerAsset(
      id,
      body,
      this.actor(user, req),
      assetId,
    );
  }
  @Post('assets/:assetId/verify') verify(
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.verifyAsset(id, assetId, this.actor(user, req));
  }
  @Post('custody') custody(
    @Param('id') id: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.appendCustody(id, body, this.actor(user, req));
  }
  @Post('packets') createPacket(
    @Param('id') id: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.createPacket(id, body, this.actor(user, req));
  }
  @Patch('packets/:packetId') revisePacket(
    @Param('id') id: string,
    @Param('packetId') packetId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.revisePacket(
      id,
      packetId,
      body,
      this.actor(user, req),
    );
  }
  @Post('packets/:packetId/submit') submitPacket(
    @Param('id') id: string,
    @Param('packetId') packetId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.submitPacket(
      id,
      packetId,
      body,
      this.actor(user, req),
    );
  }
  @Post('packets/:packetId/review') reviewPacket(
    @Param('id') id: string,
    @Param('packetId') packetId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.reviewPacket(
      id,
      packetId,
      body,
      this.actor(user, req),
    );
  }
  @Post('packets/:packetId/export') exportPacket(
    @Param('id') id: string,
    @Param('packetId') packetId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.exportPacket(id, packetId, this.actor(user, req));
  }
  @Post('packets/:packetId/revoke') revokePacket(
    @Param('id') id: string,
    @Param('packetId') packetId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.revokePacket(
      id,
      packetId,
      body,
      this.actor(user, req),
    );
  }
  @Post('holds') addHold(
    @Param('id') id: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.addHold(id, body, this.actor(user, req));
  }
  @Post('holds/:holdId/release') releaseHold(
    @Param('id') id: string,
    @Param('holdId') holdId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.releaseHold(id, holdId, body, this.actor(user, req));
  }
  @Post('representations') addRepresentation(
    @Param('id') id: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.addRepresentation(id, body, this.actor(user, req));
  }
  @Post('representations/:grantId/revoke') revokeRepresentation(
    @Param('id') id: string,
    @Param('grantId') grantId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.revokeRepresentation(
      id,
      grantId,
      body,
      this.actor(user, req),
    );
  }
  @Post('retention') createRetention(
    @Param('id') id: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.createRetention(id, body, this.actor(user, req));
  }
  @Get('retention/eligibility') eligibility(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.eligibility(id, this.actor(user, req));
  }
  @Patch('retention/:policyId') reviseRetention(
    @Param('id') id: string,
    @Param('policyId') policyId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.retentionTransition(
      id,
      policyId,
      'revise',
      body,
      this.actor(user, req),
    );
  }
  @Post('retention/:policyId/review') reviewRetention(
    @Param('id') id: string,
    @Param('policyId') policyId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.retentionTransition(
      id,
      policyId,
      'review',
      body,
      this.actor(user, req),
    );
  }
  @Post('retention/:policyId/publish') publishRetention(
    @Param('id') id: string,
    @Param('policyId') policyId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.retentionTransition(
      id,
      policyId,
      'publish',
      body,
      this.actor(user, req),
    );
  }
  @Post('dispositions') createDisposition(
    @Param('id') id: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.createDisposition(id, body, this.actor(user, req));
  }
  @Patch('dispositions/:dispositionId') reviseDisposition(
    @Param('id') id: string,
    @Param('dispositionId') dispositionId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.dispositionTransition(
      id,
      dispositionId,
      'revise',
      body,
      this.actor(user, req),
    );
  }
  @Post('dispositions/:dispositionId/submit') submitDisposition(
    @Param('id') id: string,
    @Param('dispositionId') dispositionId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.dispositionTransition(
      id,
      dispositionId,
      'submit',
      body,
      this.actor(user, req),
    );
  }
  @Post('dispositions/:dispositionId/review') reviewDisposition(
    @Param('id') id: string,
    @Param('dispositionId') dispositionId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.dispositionTransition(
      id,
      dispositionId,
      'review',
      body,
      this.actor(user, req),
    );
  }
  @Post('dispositions/:dispositionId/execute') executeDisposition(
    @Param('id') id: string,
    @Param('dispositionId') dispositionId: string,
    @Body() body: EvidenceCommand,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.evidence.dispositionTransition(
      id,
      dispositionId,
      'execute',
      body,
      this.actor(user, req),
    );
  }
}
