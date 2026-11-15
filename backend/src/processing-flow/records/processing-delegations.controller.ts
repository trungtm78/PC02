import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { ProcessingDelegationService } from './processing-delegation.service';

/** Shapes only: every rule is the service's, which answers with a code the screen translates. */
export class CreateDelegationDto {
  @IsString() @MaxLength(200) toUserId!: string;
  /** `YYYY-MM-DD`. */
  @IsString() @MaxLength(10) validFrom!: string;
  @IsString() @MaxLength(10) validTo!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() @MaxLength(200) fromUserId?: string;
}

/**
 * Delegation of processing work by date range. Behind the `processing_flow_records` switch (404 while it is off).
 * `read:ProcessingStep` is all the routes ask: a person sees and manages their OWN delegations; who may do what beyond
 * that is the service's rule (`ProcessingDelegationService`).
 */
@Controller('processing/delegations')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('processing_flow_records')
export class ProcessingDelegationsController {
  constructor(private readonly delegations: ProcessingDelegationService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'ProcessingStep' })
  mine(@CurrentUser() user: { id: string }) {
    return this.delegations.mine(user.id);
  }

  @Get('candidates')
  @RequirePermissions({ action: 'read', subject: 'ProcessingStep' })
  candidates(@CurrentUser() user: { id: string }) {
    return this.delegations.candidates(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ action: 'read', subject: 'ProcessingStep' })
  create(@Body() body: CreateDelegationDto, @CurrentUser() user: { id: string }) {
    return this.delegations.create(user.id, body);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'ProcessingStep' })
  revoke(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.delegations.revoke(user.id, id);
  }
}
