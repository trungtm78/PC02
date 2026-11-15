import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { PROCESSING_ERROR } from '../contract/processing-codes';
import { RecordGateway } from '../gateway/record-gateway';
import { RECORD_KINDS, type RecordKind } from '../gateway/record-snapshot';
import { AcceptedDateDto, AdjustDueDto, ApplyFlowDto, ExtendStepDto, ReapplyFlowDto, ReasonedCommandDto, RevisionCommandDto } from './dto/record-flow.dto';
import { ProcessingCommandService } from './processing-command.service';
import { ProcessingDeadlineService } from './processing-deadline.service';

interface AuthenticatedUser {
  id: string;
  role?: string | { name?: string };
  canDispatch?: boolean;
}

const roleName = (user: AuthenticatedUser): string => (typeof user.role === 'string' ? user.role : (user.role?.name ?? ''));

/**
 * The flow of ONE record: read it, apply a flow, confirm a proposed one, record the date of acceptance, and the actions
 * on a step. Behind the `processing_flow_records` switch (404 while it is off).
 *
 * Two questions are asked of every route, and the answers must both be yes:
 *   - does this person hold the permission of the ROUTE (`read`, `assign`, `complete`, `reopen`, `skip` on
 *     `ProcessingStep`), and
 *   - would the record's OWN detail route show them this record (`RecordGateway.canRead`: its read policy, its scope,
 *     its sensitivity). A step never reveals a record the person could not open; a record they cannot read answers
 *     exactly as a record that does not exist.
 */
@Controller('processing/records')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('processing_flow_records')
export class ProcessingRecordsController {
  constructor(
    private readonly commands: ProcessingCommandService,
    private readonly deadlines: ProcessingDeadlineService,
    private readonly gateway: RecordGateway,
  ) {}

  /** The record kind in the path, and the record behind it, readable by this person; else the same 404 as a missing one. */
  private async readable(kind: string, recordId: string, user: AuthenticatedUser): Promise<RecordKind> {
    if (!(RECORD_KINDS as readonly string[]).includes(kind)) throw new NotFoundException({ code: PROCESSING_ERROR.RECORD_KIND_INVALID });
    const recordKind = kind as RecordKind;
    const gatewayUser = { id: user.id, role: roleName(user), canDispatch: user.canDispatch ?? false };
    if (!(await this.gateway.canRead(recordKind, recordId, gatewayUser))) throw new NotFoundException({ code: PROCESSING_ERROR.RECORD_FLOW_NOT_FOUND });
    return recordKind;
  }

  @Get(':kind/:id')
  @RequirePermissions({ action: 'read', subject: 'ProcessingStep' })
  async get(@Param('kind') kind: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commands.get(await this.readable(kind, id, user), id);
  }

  @Post(':kind/:id/apply')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'assign', subject: 'ProcessingStep' })
  async apply(@Param('kind') kind: string, @Param('id') id: string, @Body() body: ApplyFlowDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commands.apply(user.id, await this.readable(kind, id, user), id, body);
  }

  @Post(':kind/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'assign', subject: 'ProcessingStep' })
  async confirm(@Param('kind') kind: string, @Param('id') id: string, @Body() body: RevisionCommandDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commands.confirmFlow(user.id, await this.readable(kind, id, user), id, body);
  }

  @Post(':kind/:id/reapply')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'assign', subject: 'ProcessingStep' })
  async reapply(@Param('kind') kind: string, @Param('id') id: string, @Body() body: ReapplyFlowDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commands.reapplyFlow(user.id, await this.readable(kind, id, user), id, body);
  }

  @Post(':kind/:id/accepted')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'assign', subject: 'ProcessingStep' })
  async accepted(@Param('kind') kind: string, @Param('id') id: string, @Body() body: AcceptedDateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commands.recordAccepted(user.id, await this.readable(kind, id, user), id, body);
  }

  @Post(':kind/:id/steps/:stepKey/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'complete', subject: 'ProcessingStep' })
  async complete(@Param('kind') kind: string, @Param('id') id: string, @Param('stepKey') stepKey: string, @Body() body: RevisionCommandDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commands.completeStep(user.id, await this.readable(kind, id, user), id, stepKey, body);
  }

  @Post(':kind/:id/steps/:stepKey/reopen')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'reopen', subject: 'ProcessingStep' })
  async reopen(@Param('kind') kind: string, @Param('id') id: string, @Param('stepKey') stepKey: string, @Body() body: ReasonedCommandDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commands.reopenStep(user.id, await this.readable(kind, id, user), id, stepKey, body);
  }

  @Post(':kind/:id/steps/:stepKey/skip')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'skip', subject: 'ProcessingStep' })
  async skip(@Param('kind') kind: string, @Param('id') id: string, @Param('stepKey') stepKey: string, @Body() body: ReasonedCommandDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commands.skipStep(user.id, await this.readable(kind, id, user), id, stepKey, { ...body, reason: body.reason ?? '' });
  }

  @Post(':kind/:id/steps/:stepKey/due')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'adjustDue', subject: 'ProcessingStep' })
  async adjustDue(@Param('kind') kind: string, @Param('id') id: string, @Param('stepKey') stepKey: string, @Body() body: AdjustDueDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deadlines.adjustDue(user.id, await this.readable(kind, id, user), id, stepKey, { ...body, date: body.date ?? null });
  }

  @Post(':kind/:id/steps/:stepKey/extend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'extend', subject: 'ProcessingStep' })
  async extend(@Param('kind') kind: string, @Param('id') id: string, @Param('stepKey') stepKey: string, @Body() body: ExtendStepDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deadlines.extendStep(user.id, await this.readable(kind, id, user), id, stepKey, body);
  }

  @Post(':kind/:id/steps/:stepKey/unskip')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'skip', subject: 'ProcessingStep' })
  async unskip(@Param('kind') kind: string, @Param('id') id: string, @Param('stepKey') stepKey: string, @Body() body: RevisionCommandDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commands.unskipStep(user.id, await this.readable(kind, id, user), id, stepKey, body);
  }
}

