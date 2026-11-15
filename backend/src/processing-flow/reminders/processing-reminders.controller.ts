import { Body, Controller, HttpCode, HttpStatus, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { PROCESSING_ERROR } from '../contract/processing-codes';
import { RecordGateway } from '../gateway/record-gateway';
import { RECORD_KINDS, type RecordKind } from '../gateway/record-snapshot';
import { MAX_NUDGE_MESSAGE, ProcessingReminderService, REMINDERS_SWITCH } from './processing-reminder.service';

interface AuthenticatedUser {
  id: string;
  role?: string | { name?: string };
  canDispatch?: boolean;
}

export class NudgeDto {
  @IsString() @MaxLength(MAX_NUDGE_MESSAGE) message!: string;
  /** Chosen by the client for ONE nudge: sent again (a lost answer), it gets the first answer and does nothing. */
  @IsOptional() @IsString() @MaxLength(100) idempotencyKey?: string;
}

/**
 * The nudge ("Đôn đốc") of a step: behind the switch of the reminders (404 while it is off). As every route of a
 * record's flow, two answers must be yes: the person holds the permission of the route (`nudge:ProcessingStep`), and
 * the record's OWN detail route would show them the record (never by a step alone: pressing a unit is an act of the
 * people above the record, not of a unit named in it). A record they cannot read answers as one that does not exist.
 */
@Controller('processing/records')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag(REMINDERS_SWITCH)
export class ProcessingRemindersController {
  constructor(
    private readonly reminders: ProcessingReminderService,
    private readonly gateway: RecordGateway,
  ) {}

  @Post(':kind/:id/steps/:stepKey/nudge')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'nudge', subject: 'ProcessingStep' })
  async nudge(@Param('kind') kind: string, @Param('id') id: string, @Param('stepKey') stepKey: string, @Body() body: NudgeDto, @CurrentUser() user: AuthenticatedUser) {
    if (!(RECORD_KINDS as readonly string[]).includes(kind)) throw new NotFoundException({ code: PROCESSING_ERROR.RECORD_KIND_INVALID });
    const recordKind = kind as RecordKind;
    const role = typeof user.role === 'string' ? user.role : (user.role?.name ?? '');
    if (!(await this.gateway.canRead(recordKind, id, { id: user.id, role, canDispatch: user.canDispatch ?? false }))) throw new NotFoundException({ code: PROCESSING_ERROR.RECORD_FLOW_NOT_FOUND });
    return this.reminders.nudge(user.id, recordKind, id, stepKey, { message: body.message, idempotencyKey: body.idempotencyKey });
  }
}
