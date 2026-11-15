import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { PROCESSING_ERROR } from '../contract/processing-codes';
import type { RecordKind } from '../gateway/record-snapshot';
import { CreateFlowDto, ExpectedRevisionDto, PreviewScheduleDto, ReplaceStepsDto, SetBindingsDto, UpdateFlowDto } from './dto/flow.dto';
import { ProcessingFlowsService } from './processing-flows.service';

interface AuthenticatedUser {
  id: string;
}

/** A revision in the query string of a delete: a whole number from 1 up, at most nine digits. */
function revisionOf(raw: string | undefined): number {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!/^[1-9]\d{0,8}$/.test(text)) throw new BadRequestException({ code: PROCESSING_ERROR.EXPECTED_REVISION_INVALID });
  return Number(text);
}

const yes = (raw: string | undefined): boolean => raw === 'true' || raw === '1';

/**
 * The configuration of processing flows: flows per record kind, their bindings to information types, their versions
 * and steps. Behind the `processing_flow` switch (404 while it is off) and one permission per route on
 * `ProcessingFlow`: `read`, `create`, `edit`, `delete`, `publish` (make a draft the version records follow), `verify`
 * (confirm the legal basis of a step against the source text).
 *
 * The fixed paths are declared before `:id`, so that "templates" and "resolve" are never read as the id of a flow.
 */
@Controller('processing-flows')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('processing_flow')
export class ProcessingFlowsController {
  constructor(private readonly flows: ProcessingFlowsService) {}

  /** The legal template catalogue a flow can be started from. */
  @Get('templates')
  @RequirePermissions({ action: 'read', subject: 'ProcessingFlow' })
  templates() {
    return this.flows.templates();
  }

  /** The flow a record of `recordKind` with this `informationType` follows, as the configuration stands. */
  @Get('resolve')
  @RequirePermissions({ action: 'read', subject: 'ProcessingFlow' })
  resolve(@Query('recordKind') recordKind: string | undefined, @Query('informationType') informationType: string | undefined) {
    return this.flows.resolve(recordKind, informationType);
  }

  /** The deadlines the steps sent would get on an imagined record. Writes nothing. */
  @Post('preview-schedule')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'ProcessingFlow' })
  previewSchedule(@Body() body: PreviewScheduleDto) {
    return this.flows.previewSchedule(body);
  }

  @Get()
  @RequirePermissions({ action: 'read', subject: 'ProcessingFlow' })
  list(@Query('recordKind') recordKind: string | undefined, @Query('includeArchived') includeArchived: string | undefined) {
    // An unknown record kind is refused by the service, with its code.
    return this.flows.list({ recordKind: recordKind as RecordKind | undefined, includeArchived: yes(includeArchived) });
  }

  @Post()
  @RequirePermissions({ action: 'create', subject: 'ProcessingFlow' })
  create(@Body() body: CreateFlowDto, @CurrentUser() user: AuthenticatedUser) {
    return this.flows.create(user.id, { ...body, recordKind: body.recordKind as RecordKind });
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'ProcessingFlow' })
  get(@Param('id') id: string) {
    return this.flows.get(id);
  }

  @Patch(':id')
  @RequirePermissions({ action: 'edit', subject: 'ProcessingFlow' })
  update(@Param('id') id: string, @Body() body: UpdateFlowDto, @CurrentUser() user: AuthenticatedUser) {
    return this.flows.update(id, user.id, { ...body });
  }

  @Put(':id/bindings')
  @RequirePermissions({ action: 'edit', subject: 'ProcessingFlow' })
  setBindings(@Param('id') id: string, @Body() body: SetBindingsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.flows.setBindings(id, user.id, { ...body });
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'edit', subject: 'ProcessingFlow' })
  archive(@Param('id') id: string, @Body() body: ExpectedRevisionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.flows.archive(id, user.id, body.expectedRevision);
  }

  /** The other way of archiving. */
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'edit', subject: 'ProcessingFlow' })
  restore(@Param('id') id: string, @Body() body: ExpectedRevisionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.flows.restore(id, user.id, body.expectedRevision);
  }

  /** Only a flow that never had a published version. `confirmName`: the name of the flow, typed back. */
  @Delete(':id')
  @RequirePermissions({ action: 'delete', subject: 'ProcessingFlow' })
  remove(
    @Param('id') id: string,
    @Query('expectedRevision') expectedRevision: string | undefined,
    @Query('confirmName') confirmName: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flows.remove(id, user.id, { expectedRevision: revisionOf(expectedRevision), confirmName });
  }

  /** A new draft: a copy of the published version under the same step keys. */
  @Post(':id/versions')
  @RequirePermissions({ action: 'edit', subject: 'ProcessingFlow' })
  createDraft(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.flows.createDraft(id, user.id);
  }

  /** ALL the steps of a draft. Answers `{ flow, warnings }`: the warnings are what would stop a publish. */
  @Put(':id/versions/:versionId/steps')
  @RequirePermissions({ action: 'edit', subject: 'ProcessingFlow' })
  replaceSteps(@Param('id') id: string, @Param('versionId') versionId: string, @Body() body: ReplaceStepsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.flows.replaceSteps(id, versionId, user.id, { steps: body.steps, expectedRevision: body.expectedRevision });
  }

  /** A draft only. `expectedRevision` (required): the revision of the draft that was looked at. */
  @Delete(':id/versions/:versionId')
  @RequirePermissions({ action: 'edit', subject: 'ProcessingFlow' })
  deleteDraft(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Query('expectedRevision') expectedRevision: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flows.deleteDraft(id, versionId, user.id, revisionOf(expectedRevision));
  }

  @Post(':id/versions/:versionId/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'publish', subject: 'ProcessingFlow' })
  publish(@Param('id') id: string, @Param('versionId') versionId: string, @Body() body: ExpectedRevisionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.flows.publish(id, versionId, user.id, body.expectedRevision);
  }

  /**
   * A person compared the figures of the step with the source text. Allowed on a published version too.
   * `expectedRevision`: the revision of the version that was compared; figures saved since are not stamped.
   */
  @Post(':id/versions/:versionId/steps/:stepKey/verify-legal')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'verify', subject: 'ProcessingFlow' })
  verifyLegal(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Param('stepKey') stepKey: string,
    @Body() body: ExpectedRevisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flows.verifyLegal(id, versionId, stepKey, user.id, body.expectedRevision);
  }

  /** The way back from `verify-legal`. */
  @Post(':id/versions/:versionId/steps/:stepKey/unverify-legal')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'verify', subject: 'ProcessingFlow' })
  unverifyLegal(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Param('stepKey') stepKey: string,
    @Body() body: ExpectedRevisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flows.unverifyLegal(id, versionId, stepKey, user.id, body.expectedRevision);
  }
}
