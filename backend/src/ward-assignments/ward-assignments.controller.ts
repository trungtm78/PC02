import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { DataScope } from '../auth/services/unit-scope.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireAnyPermissions, RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../feature-flags/guards/feature-flag.guard';
import {
  AddReturnReasonDto,
  ApproveDto,
  CompleteDto,
  DeleteWithDataDto,
  ExtendDto,
  FollowUpDto,
  ReasonDto,
  ReturnDto,
  CreateWardAssignmentDto,
  CreateWardInvestigatorDto,
  ExpectedStampDto,
  ListWardAssignmentsQuery,
  WardListExportQuery,
  WardListStatsQuery,
  ListWardInvestigatorsQuery,
  UpdateWardAssignmentDto,
  UpdateWardInvestigatorDto,
} from './dto/ward-assignment.dto';
import { WARD_ERROR } from './ward-assignment.codes';
import { wardBody } from './ward-errors';
import { WardAssignmentCommandService } from './ward-assignment-command.service';
import { WardAssignmentQueryService } from './ward-assignment-query.service';
import { WardInvestigatorsService } from './ward-investigators.service';
import { WardReviewService } from './ward-review.service';

/**
 * The scope the request interceptor resolved: null for an administrator, a scope for everybody else. A request that
 * reached here without one is refused: the record helpers read "no scope" as "no restriction", and a route of this
 * module must never be opened by a scope that was not resolved.
 */
function scopeOf(req: ScopedRequest): DataScope | null {
  if (req.dataScope === undefined) throw new ForbiddenException(wardBody(WARD_ERROR.FORBIDDEN));
  return req.dataScope;
}

/**
 * Ward assignment requests ("Hồ sơ phân công Công an cấp phường/xã"). Behind the `ward-assignments` switch (404 while it
 * is off). The guard asks for the permission of the action; how far it reaches and in which state it may be done is
 * the service's.
 */
@Controller('ward-assignments')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('ward-assignments')
export class WardAssignmentsController {
  constructor(
    private readonly commands: WardAssignmentCommandService,
    private readonly queries: WardAssignmentQueryService,
    private readonly review: WardReviewService,
  ) {}

  /** The catalogue of return reasons. Declared before `:id` so that it is not read as an id. */
  @Get('return-reasons')
  @RequirePermissions({ action: 'read', subject: 'WardAssignment' })
  returnReasons() {
    return this.review.returnReasons();
  }

  /** A reviewer adds a reason to the catalogue from the review ("Tạo mới" of the field). */
  @Post('return-reasons')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  addReturnReason(@Body() body: AddReturnReasonDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    scopeOf(req);
    return this.review.addReturnReason(user, body);
  }

  /**
   * Who may follow an approval and in which unit: the active PC02 units (not ward units) and their active members.
   * The reviewers' own choices, so that the form never needs the administration screens' lists. Before `:id`.
   */
  @Get('follow-up-choices')
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  followUpChoices() {
    return this.queries.followUpChoices();
  }

  /** The ward units the person may enter a request for (what `create` accepts). Before `:id`. */
  @Get('unit-choices')
  @RequirePermissions({ action: 'write', subject: 'WardAssignment' })
  unitChoices(@Req() req: ScopedRequest) {
    return this.queries.unitChoices(scopeOf(req));
  }

  /** The ward units the list's filter offers (those with a request the person may read). Before `:id`. */
  @Get('filter-units')
  @RequirePermissions({ action: 'read', subject: 'WardAssignment' })
  filterUnits(@Req() req: ScopedRequest) {
    return this.queries.filterUnits(scopeOf(req));
  }

  /** The numbers of the list's cards, under the list's own filters. Before `:id`. */
  @Get('list-stats')
  @RequirePermissions({ action: 'read', subject: 'WardAssignment' })
  listStats(@Query() query: WardListStatsQuery, @Req() req: ScopedRequest) {
    return this.queries.listStats(scopeOf(req), query);
  }

  /** The list as an Excel file: the filters, the order and the columns of the screen. Before `:id`. */
  @Get('export/danh-sach')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'WardAssignment' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportList(@Query() query: WardListExportQuery, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest, @Res() res: Response): Promise<void> {
    await this.queries.exportList(scopeOf(req), query, res, { userId: user.id, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Get()
  @RequirePermissions({ action: 'read', subject: 'WardAssignment' })
  list(@Query() query: ListWardAssignmentsQuery, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.queries.list(scopeOf(req), query, new Date(), user.id);
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'WardAssignment' })
  get(@Param('id') id: string, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.queries.get(scopeOf(req), user.id, id);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'WardAssignment' })
  create(@Body() body: CreateWardAssignmentDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.commands.create(user, scopeOf(req), body);
  }

  @Patch(':id')
  @RequirePermissions({ action: 'edit', subject: 'WardAssignment' })
  update(@Param('id') id: string, @Body() body: UpdateWardAssignmentDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.commands.update(user, scopeOf(req), id, body);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'edit', subject: 'WardAssignment' })
  submit(@Param('id') id: string, @Body() body: ExpectedStampDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.commands.submit(user, scopeOf(req), id, body.expectedUpdatedAt);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'edit', subject: 'WardAssignment' })
  withdraw(@Param('id') id: string, @Body() body: ExpectedStampDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.commands.withdraw(user, scopeOf(req), id, body.expectedUpdatedAt);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'WardAssignment' })
  remove(@Param('id') id: string, @Query() query: ExpectedStampDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.commands.remove(user, scopeOf(req), id, query.expectedUpdatedAt);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  archive(@Param('id') id: string, @Body() body: ExpectedStampDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.commands.archive(user, scopeOf(req), id, body.expectedUpdatedAt);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  restore(@Param('id') id: string, @Body() body: ExpectedStampDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.commands.restore(user, scopeOf(req), id, body.expectedUpdatedAt);
  }

  // ── PC02's review and the follow-up after approval ──

  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  returnIt(@Param('id') id: string, @Body() body: ReturnDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.review.returnIt(user, scopeOf(req), id, body);
  }

  @Post(':id/return/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  revokeReturn(@Param('id') id: string, @Body() body: ReasonDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.review.revokeReturn(user, scopeOf(req), id, body);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  approve(@Param('id') id: string, @Body() body: ApproveDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.review.approve(user, scopeOf(req), id, body);
  }

  @Post(':id/approval/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  cancelApproval(@Param('id') id: string, @Body() body: ReasonDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.review.cancelApproval(user, scopeOf(req), id, body);
  }

  @Patch(':id/follow-up')
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  followUp(@Param('id') id: string, @Body() body: FollowUpDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.review.followUp(user, scopeOf(req), id, body);
  }

  @Post(':id/deadline/extend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  extend(@Param('id') id: string, @Body() body: ExtendDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.review.extend(user, scopeOf(req), id, body);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  complete(@Param('id') id: string, @Body() body: CompleteDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.review.complete(user, scopeOf(req), id, body);
  }

  @Post(':id/complete/reopen')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  reopen(@Param('id') id: string, @Body() body: ReasonDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.review.reopen(user, scopeOf(req), id, body);
  }

  // ── administrators: delete with data ──

  @Get(':id/deletion-impact')
  @RequirePermissions({ action: 'delete', subject: 'WardAssignment' })
  deletionImpact(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.review.deletionImpact(scopeOf(req), id);
  }

  @Delete(':id/with-data')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'WardAssignment' })
  deleteWithData(@Param('id') id: string, @Body() body: DeleteWithDataDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.review.deleteWithData(user, scopeOf(req), id, body);
  }
}

/** The investigators of a ward unit: kept by whoever changes that unit's requests, and by the reviewers of PC02. */
@Controller('ward-investigators')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('ward-assignments')
export class WardInvestigatorsController {
  constructor(private readonly investigators: WardInvestigatorsService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'WardAssignment' })
  list(@Query() query: ListWardInvestigatorsQuery, @Req() req: ScopedRequest) {
    return this.investigators.list(scopeOf(req), query.teamId, query.includeStopped ?? false);
  }

  @Post()
  @RequireAnyPermissions({ action: 'edit', subject: 'WardAssignment' }, { action: 'review', subject: 'WardAssignment' })
  create(@Body() body: CreateWardInvestigatorDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.investigators.create(user, scopeOf(req), body);
  }

  @Patch(':id')
  @RequireAnyPermissions({ action: 'edit', subject: 'WardAssignment' }, { action: 'review', subject: 'WardAssignment' })
  update(@Param('id') id: string, @Body() body: UpdateWardInvestigatorDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.investigators.update(user, scopeOf(req), id, body);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions({ action: 'edit', subject: 'WardAssignment' }, { action: 'review', subject: 'WardAssignment' })
  deactivate(@Param('id') id: string, @Body() body: ExpectedStampDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.investigators.setActive(user, scopeOf(req), id, false, body.expectedUpdatedAt);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions({ action: 'edit', subject: 'WardAssignment' }, { action: 'review', subject: 'WardAssignment' })
  reactivate(@Param('id') id: string, @Body() body: ExpectedStampDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.investigators.setActive(user, scopeOf(req), id, true, body.expectedUpdatedAt);
  }
}
