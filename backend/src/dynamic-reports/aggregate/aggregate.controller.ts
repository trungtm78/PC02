import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AggregateService, type SummaryMode } from './aggregate.service';
import { ReportLifecycleService } from '../config/report-lifecycle.service';
import { ReportConfigError } from '../config/report-config.service';
import { SubmissionError } from '../submission/submission.service';
import { ReopenPeriodDto } from './dto/reopen-period.dto';
import { FinalizePeriodDto } from './dto/finalize-period.dto';
import { PreviewAddTeamDto } from './dto/preview-add-team.dto';
import { AddTeamMidPeriodDto } from './dto/add-team-mid-period.dto';
import { ExemptTeamMidPeriodDto } from './dto/exempt-team-mid-period.dto';

const CONFLICT_CODES = new Set(['INVALID_STATE_TRANSITION', 'HAS_DATA', 'UNAPPROVED_TEAMS']);

interface AuthenticatedUser {
  id: string;
  roleId: string;
}

const VALID_MODES: readonly SummaryMode[] = [
  'SUBMITTED',
  'APPROVED',
  'ALL_SAVED',
];

/**
 * S15 thu nhỏ (spec §6.1 PR7 slice 2). `read:DynamicReport` only — the
 * same coarse module-entry gate every dynamic-reports route uses; the
 * real access boundary is `AggregateService`'s own `DynReportRole`/
 * `admin:DynamicReport` check (R13), which 404s a period the caller
 * doesn't manage instead of 403ing it (AC-012/AC-035 anti-probe
 * convention already used by every other route in this module).
 */
@Controller('bao-cao-dong/periods')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class AggregateController {
  constructor(
    private readonly aggregateService: AggregateService,
    private readonly lifecycleService: ReportLifecycleService,
  ) {}

  /**
   * T-VIEWER-NAV — declared BEFORE `:periodId/*`, same reason every other
   * static-before-param route in this module is: a literal segment
   * registered after a param route would never be reached. No bare
   * `GET :periodId` route exists in this controller, so there is no
   * collision either way, but the ordering convention stays consistent.
   */
  @Get()
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async listViewablePeriods(@CurrentUser() user: AuthenticatedUser) {
    return this.aggregateService.listPeriodsForViewer(user.id, user.roleId);
  }

  @Get(':periodId/summary')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async getSummary(
    @Param('periodId') periodId: string,
    @Query('mode') mode: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const resolvedMode: SummaryMode = VALID_MODES.includes(mode as SummaryMode)
      ? (mode as SummaryMode)
      : 'SUBMITTED';
    return this.aggregateService.getPeriodSummary(
      periodId,
      user.id,
      user.roleId,
      resolvedMode,
    );
  }

  @Post(':periodId/finalize')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async finalize(
    @Param('periodId') periodId: string,
    @Body() body: FinalizePeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.aggregateService.finalizePeriod(
        periodId,
        user.id,
        user.roleId,
        body?.acknowledgeExcluded === true,
      ),
    );
  }

  @Post(':periodId/reopen')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async reopen(
    @Param('periodId') periodId: string,
    @Body() body: ReopenPeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.aggregateService.reopenPeriod(
        periodId,
        user.id,
        user.roleId,
        body.reason,
      ),
    );
  }

  /** S30 — danh sách tổ của kỳ, cho màn thêm tổ/miễn nộp chọn tổ. */
  @Get(':periodId/assignments')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async listAssignments(
    @Param('periodId') periodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aggregateService.listAssignmentsForPeriod(
      periodId,
      user.id,
      user.roleId,
    );
  }

  /** S30 — xem trước tác động lên mẫu số của việc THÊM 1 tổ, trước khi xác nhận. */
  @Post(':periodId/assignments/add-team/preview')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async previewAddTeam(
    @Param('periodId') periodId: string,
    @Body() body: PreviewAddTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.aggregateService.previewAddTeam(
        periodId,
        user.id,
        user.roleId,
        body.teamId,
      ),
    );
  }

  /** S30 — thêm tổ vào kỳ đang mở, giữa chừng (D09, bắt buộc lý do). */
  @Post(':periodId/assignments/add-team')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async addTeamMidPeriod(
    @Param('periodId') periodId: string,
    @Body() body: AddTeamMidPeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.aggregateService.addTeamMidPeriod(
        periodId,
        user.id,
        user.roleId,
        body.teamId,
        body.reason,
      ),
    );
  }

  /** S30 — xem trước tác động lên mẫu số của việc MIỄN NỘP 1 tổ, trước khi xác nhận. */
  @Post(':periodId/assignments/:assignmentId/exempt/preview')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async previewExemptTeam(
    @Param('periodId') periodId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.aggregateService.previewExemptTeam(
        periodId,
        user.id,
        user.roleId,
        assignmentId,
      ),
    );
  }

  /** S30 — miễn nộp 1 tổ trong kỳ đang mở, giữa chừng (D09, bắt buộc lý do). */
  @Post(':periodId/assignments/:assignmentId/exempt')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async exemptTeamMidPeriod(
    @Param('periodId') periodId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() body: ExemptTeamMidPeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.aggregateService.exemptTeamMidPeriod(
        periodId,
        user.id,
        user.roleId,
        assignmentId,
        body.reason,
      ),
    );
  }

  /** Xoá kỳ: cái gì sẽ mất, đọc trước khi hiện hộp xác nhận. Quản lý của báo cáo hoặc quản trị viên. */
  @Get(':periodId/deletion-impact')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async periodDeletionImpact(
    @Param('periodId') periodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() => this.lifecycleService.getPeriodDeletionImpact(periodId, user));
  }

  /** Xoá một kỳ chưa ai nhập gì (kỳ sinh nhầm, kỳ thử). Đã có số liệu thì 409 HAS_DATA. */
  @Delete(':periodId')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async deletePeriod(
    @Param('periodId') periodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() => this.lifecycleService.deletePeriod(periodId, { withData: false }, user));
  }

  /** Xoá kỳ kèm số liệu — chỉ quản trị viên, phải gõ lại mã kỳ. */
  @Delete(':periodId/with-data')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async deletePeriodWithData(
    @Param('periodId') periodId: string,
    @Query('confirmKey') confirmKey: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.lifecycleService.deletePeriod(periodId, { withData: true, confirmKey }, user),
    );
  }

  /** S30 — bỏ miễn nộp (chiều ngược của miễn nộp). */
  @Post(':periodId/assignments/:assignmentId/unexempt')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async unexemptTeamMidPeriod(
    @Param('periodId') periodId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.aggregateService.unexemptTeamMidPeriod(periodId, user.id, user.roleId, assignmentId),
    );
  }

  /** S30 — gỡ tổ đã thêm nhầm giữa kỳ (chiều ngược của thêm tổ), khi chưa ai nhập gì. */
  @Delete(':periodId/assignments/:assignmentId')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async removeAddedTeamMidPeriod(
    @Param('periodId') periodId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.aggregateService.removeAddedTeamMidPeriod(periodId, user.id, user.roleId, assignmentId),
    );
  }

  /** S21 — whole-period history/audit, every assignment at once (read-only). */
  @Get(':periodId/history')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async getHistory(
    @Param('periodId') periodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aggregateService.getReportHistory(
      periodId,
      user.id,
      user.roleId,
    );
  }

  /** S25 — creates the stored export; downloading it is a SEPARATE call (`ExportController`) that re-checks standing. */
  @Post(':periodId/export')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async exportPeriod(
    @Param('periodId') periodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.aggregateService.exportPeriod(periodId, user.id, user.roleId),
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
      if (err instanceof ReportConfigError) {
        if (err.code === 'REPORT_NOT_FOUND') throw new NotFoundException(err.message);
        if (err.code === 'HAS_DATA') throw new ConflictException({ code: err.code, message: err.message });
        // A valid request refused for lack of standing is a refusal, not a malformed request.
        if (err.code === 'ADMIN_REQUIRED') throw new ForbiddenException({ code: err.code, message: err.message });
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }
}
