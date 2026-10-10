import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SubmissionService, SubmissionError } from './submission.service';
import { SaveValuesDto } from './dto/save-values.dto';

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

  @Get(':assignmentId')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async get(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissionService.getSubmission(assignmentId, user.id);
  }

  @Patch(':assignmentId/values')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async save(
    @Param('assignmentId') assignmentId: string,
    @Body() body: SaveValuesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      return await this.submissionService.save(
        assignmentId,
        user.id,
        body.values,
        body.expectedRevision,
      );
    } catch (err) {
      if (err instanceof SubmissionError) {
        if (err.code === 'REVISION_CONFLICT' || err.code === 'REPORT_LOCKED') {
          throw new ConflictException({ code: err.code, message: err.message });
        }
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }
}
