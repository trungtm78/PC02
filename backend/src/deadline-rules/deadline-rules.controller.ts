import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DeadlineRulesService } from './deadline-rules.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { ProposeRuleDto } from './dto/propose-rule.dto';
import { UpdateDraftDto } from './dto/update-draft.dto';
import { ApproveRuleDto } from './dto/approve-rule.dto';
import { RejectRuleDto } from './dto/reject-rule.dto';
import { QueryRulesDto } from './dto/query-rules.dto';

/**
 * Routes (mounted at `/api/v1` global prefix):
 *
 *   GET    /deadline-rules                        list active rules
 *   GET    /deadline-rules/summary                top-strip counts
 *   GET    /deadline-rules/approval-queue         submitted versions (approver)
 *   GET    /deadline-rules/query                  filtered list
 *   GET    /deadline-rules/:key/history           version history per key
 *   GET    /deadline-rules/version/:id            single version detail
 *   GET    /deadline-rules/version/:id/impact     impact preview
 *   POST   /deadline-rules                        propose new draft
 *   PATCH  /deadline-rules/:id                    update draft
 *   POST   /deadline-rules/:id/submit             draft → submitted
 *   POST   /deadline-rules/:id/approve            submitted → approved/active (DEADLINE_APPROVER only)
 *   POST   /deadline-rules/:id/reject             submitted → rejected (DEADLINE_APPROVER only)
 *   DELETE /deadline-rules/:id                    delete draft
 */
@Controller('deadline-rules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeadlineRulesController {
  constructor(private readonly service: DeadlineRulesService) {}

  // ─── READ ────────────────────────────────────────────────────────────────
  @Get()
  @RequirePermissions({ action: 'read', subject: 'DeadlineRuleVersion' })
  listActive() {
    return this.service.listActive();
  }

  @Get('summary')
  @RequirePermissions({ action: 'read', subject: 'DeadlineRuleVersion' })
  getSummary() {
    return this.service.getSummary();
  }

  @Get('approval-queue')
  @RequirePermissions({ action: 'approve', subject: 'DeadlineRuleVersion' })
  getApprovalQueue() {
    return this.service.getApprovalQueue();
  }

  @Get('query')
  @RequirePermissions({ action: 'read', subject: 'DeadlineRuleVersion' })
  query(@Query() q: QueryRulesDto) {
    return this.service.query(q);
  }

  @Get(':key/history')
  @RequirePermissions({ action: 'read', subject: 'DeadlineRuleVersion' })
  getHistory(@Param('key') key: string) {
    return this.service.getHistory(key);
  }

  @Get('version/:id')
  @RequirePermissions({ action: 'read', subject: 'DeadlineRuleVersion' })
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Get('version/:id/impact')
  @RequirePermissions({ action: 'read', subject: 'DeadlineRuleVersion' })
  previewImpact(@Param('id') id: string) {
    return this.service.previewImpact(id);
  }

  // ─── WRITE ───────────────────────────────────────────────────────────────
  @Post()
  @RequirePermissions({ action: 'write', subject: 'DeadlineRuleVersion' })
  propose(@Body() dto: ProposeRuleDto, @CurrentUser() user: AuthUser, @Req() req: ExpressLikeRequest) {
    return this.service.propose(dto, user.id, extractMeta(req));
  }

  @Patch(':id')
  @RequirePermissions({ action: 'write', subject: 'DeadlineRuleVersion' })
  updateDraft(
    @Param('id') id: string,
    @Body() dto: UpdateDraftDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ExpressLikeRequest,
  ) {
    return this.service.updateDraft(id, dto, user.id, extractMeta(req));
  }

  @Post(':id/submit')
  @RequirePermissions({ action: 'write', subject: 'DeadlineRuleVersion' })
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: ExpressLikeRequest) {
    return this.service.submit(id, user.id, extractMeta(req));
  }

  @Post(':id/approve')
  @RequirePermissions({ action: 'approve', subject: 'DeadlineRuleVersion' })
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveRuleDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ExpressLikeRequest,
  ) {
    return this.service.approve(id, dto, user.id, extractMeta(req));
  }

  @Post(':id/reject')
  @RequirePermissions({ action: 'approve', subject: 'DeadlineRuleVersion' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectRuleDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ExpressLikeRequest,
  ) {
    return this.service.reject(id, dto, user.id, extractMeta(req));
  }

  @Delete(':id')
  @RequirePermissions({ action: 'write', subject: 'DeadlineRuleVersion' })
  deleteDraft(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: ExpressLikeRequest) {
    return this.service.deleteDraft(id, user.id, extractMeta(req));
  }
}

// Minimal request shape for IP/UA extraction without importing express types
interface ExpressLikeRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

function extractMeta(req: ExpressLikeRequest): { ipAddress?: string; userAgent?: string } {
  const ua = req.headers?.['user-agent'];
  return {
    ipAddress: req.ip,
    userAgent: typeof ua === 'string' ? ua : Array.isArray(ua) ? ua[0] : undefined,
  };
}
