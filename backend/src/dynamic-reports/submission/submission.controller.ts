import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SubmissionService, SubmissionError } from './submission.service';
import { SaveValuesDto, SubmitDto } from './dto/save-values.dto';
import {
  ApproveDto,
  ReturnDto,
  UnapproveDto,
  GrantUnlockDto,
  RevokeUnlockDto,
  RequestUnlockDto,
  DecideUnlockRequestDto,
  BulkGrantUnlockDto,
} from './dto/review.dto';

const CONFLICT_CODES = new Set([
  'REVISION_CONFLICT',
  'REPORT_LOCKED',
  'INVALID_STATE_TRANSITION',
]);

interface AuthenticatedUser {
  id: string;
  roleId: string;
}

/**
 * S11-S14 (spec §6.1 PR6). `read:DynamicReport` only — this is the
 * editor's own input screen, the same permission the module's menu entry
 * itself already requires (every authenticated member can reach the
 * module; `loadEditorAssignment`'s 404 is the real access boundary, per
 * AC-012/AC-035: an assignment outside the caller's scope must look
 * identical to one that doesn't exist, not merely 403).
 */
@Controller('bao-cao-dong/submissions')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.submissionService.listMyAssignments(user.id);
  }

  /**
   * S33/PR7 — the manager's own list. Declared BEFORE `:assignmentId`:
   * Nest/Express resolves overlapping routes in declaration order, so a
   * static segment registered after a param route would never be reached
   * (it would always be captured as an `assignmentId` value instead).
   */
  @Get('manager')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async listManager(@CurrentUser() user: AuthenticatedUser) {
    return this.submissionService.listForManager(user.id, user.roleId);
  }

  /**
   * S34 — the manager's reopen-request queue. Declared BEFORE `:assignmentId`
   * for the same reason `manager` is (see comment above): a static segment
   * registered after a param route would never be reached.
   */
  @Get('unlock-requests')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async listUnlockRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.submissionService.listPendingRequests(user.id, user.roleId);
  }

  @Post('unlock-requests/:unlockId/decide')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async decideUnlockRequest(
    @Param('unlockId') unlockId: string,
    @Body() body: DecideUnlockRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.submissionService.decideRequest(
        unlockId,
        user.id,
        user.roleId,
        body.decision,
        body.decisionReason,
        body.expiresAt,
      ),
    );
  }

  @Post('unlock/bulk-grant')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async bulkGrantUnlock(
    @Body() body: BulkGrantUnlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.submissionService.bulkGrantUnlock(
        body.assignmentIds,
        user.id,
        user.roleId,
        body.reason,
        body.expiresAt,
      ),
    );
  }

  @Get(':assignmentId')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async get(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissionService.getSubmission(assignmentId, user.id);
  }

  @Get(':assignmentId/review')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async getForManager(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissionService.getSubmissionForManager(
      assignmentId,
      user.id,
      user.roleId,
    );
  }

  @Patch(':assignmentId/values')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async save(
    @Param('assignmentId') assignmentId: string,
    @Body() body: SaveValuesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.submissionService.save(
        assignmentId,
        user.id,
        body.values,
        body.expectedRevision,
        body.idempotencyKey,
      ),
    );
  }

  @Post(':assignmentId/submit')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async submit(
    @Param('assignmentId') assignmentId: string,
    @Body() body: SubmitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.submissionService.submit(
        assignmentId,
        user.id,
        body.expectedRevision,
      ),
    );
  }

  @Post(':assignmentId/approve')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async approve(
    @Param('assignmentId') assignmentId: string,
    @Body() body: ApproveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.submissionService.approve(
        assignmentId,
        user.id,
        user.roleId,
        body.expectedRevision,
        body.reason,
      ),
    );
  }

  @Post(':assignmentId/return')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async returnSubmission(
    @Param('assignmentId') assignmentId: string,
    @Body() body: ReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.submissionService.returnSubmission(
        assignmentId,
        user.id,
        user.roleId,
        body.expectedRevision,
        body.reason,
        body.returnDueAt,
      ),
    );
  }

  @Post(':assignmentId/unapprove')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async unapprove(
    @Param('assignmentId') assignmentId: string,
    @Body() body: UnapproveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.submissionService.unapprove(
        assignmentId,
        user.id,
        user.roleId,
        body.expectedRevision,
        body.reason,
      ),
    );
  }

  @Post(':assignmentId/unlock')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async grantUnlock(
    @Param('assignmentId') assignmentId: string,
    @Body() body: GrantUnlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.submissionService.grantUnlock(
        assignmentId,
        user.id,
        user.roleId,
        body.reason,
        body.expiresAt,
      ),
    );
  }

  @Post(':assignmentId/unlock/revoke')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async revokeUnlock(
    @Param('assignmentId') assignmentId: string,
    @Body() body: RevokeUnlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.submissionService.revokeActiveGrant(
        assignmentId,
        user.id,
        user.roleId,
        body.reason,
      ),
    );
  }

  /** S34 — the editor-side half: a team asks its manager to reopen a locked assignment. */
  @Post(':assignmentId/unlock/request')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async requestUnlock(
    @Param('assignmentId') assignmentId: string,
    @Body() body: RequestUnlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.submissionService.requestUnlock(assignmentId, user.id, body.reason),
    );
  }

  private async handleWrite<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof SubmissionError) {
        if (CONFLICT_CODES.has(err.code)) {
          throw new ConflictException({ code: err.code, message: err.message });
        }
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }
}
