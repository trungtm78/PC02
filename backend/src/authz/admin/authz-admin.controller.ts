import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { Reach } from '../engine/types';
import { AUTHZ_ADMIN_ERROR, AuthzAdminService } from './authz-admin.service';
import type { OverrideDoc, TeamDoc, WantedItem } from './documents';
import {
  ApplyTeamsDto,
  CopyTemplateDto,
  CreateTemplateDto,
  OverrideDto,
  PreviewDto,
  SaveTeamConfigDto,
  SaveUserOverridesDto,
  TeamConfigDto,
  TemplateStateDto,
  UpdateTemplateDto,
} from './dto';

const REACHES: readonly string[] = ['OWN', 'TEAM', 'TEAM_TREE', 'ALL'];
const meta = (req: Request) => ({ ipAddress: req.ip, userAgent: req.headers['user-agent'] });

/** `action:subject` -> reach, as sent; a value that is not a reach is refused here, the rest by the service. */
function entriesOf(raw: Record<string, string>): Record<string, Reach> {
  const bad = Object.entries(raw).filter(([, reach]) => !REACHES.includes(reach));
  if (bad.length) {
    throw new BadRequestException({
      code: AUTHZ_ADMIN_ERROR.INVALID,
      details: bad.map(([permission, reach]) => ({ code: 'REACH_NOT_ALLOWED', permission, reach })),
    });
  }
  return raw as Record<string, Reach>;
}
const overrideDoc = (o: OverrideDto): OverrideDoc => ({
  permission: o.permission,
  effect: o.effect,
  reach: o.effect === 'GRANT' ? (o.reach ?? null) : null,
  reason: o.reason,
  expiresAt: o.expiresAt ? new Date(o.expiresAt).toISOString() : null,
});
const teamDoc = (c: TeamConfigDto): TeamDoc => ({
  mode: c.mode,
  memberTemplateId: c.memberTemplateId ?? null,
  leaderTemplateId: c.leaderTemplateId ?? null,
  overrides: (c.overrides ?? []).map((o) => ({ ...overrideDoc(o), audience: o.audience })),
});

/**
 * The permission configuration: templates, what each team gives, per-person overrides, the history. Reading needs
 * `read:Role`, changing needs `write:Role` (the permissions that already guard the role administration).
 *
 * Every "create" here has its edit and its way back on the same resource: a template is edited, copied, archived and
 * restored, and deleted while no team uses it; a team's configuration is replaced or removed; overrides are replaced
 * as a list; and any saved change can be undone from the history.
 */
@Controller('authz')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuthzAdminController {
  constructor(private readonly admin: AuthzAdminService) {}

  // ── templates ───────────────────────────────────────────────────────────────────────────────────────────────
  @Get('templates')
  @RequirePermissions({ action: 'read', subject: 'Role' })
  listTemplates() {
    return this.admin.listTemplates();
  }

  @Get('templates/:id')
  @RequirePermissions({ action: 'read', subject: 'Role' })
  getTemplate(@Param('id') id: string) {
    return this.admin.getTemplate(id);
  }

  @Post('templates')
  @RequirePermissions({ action: 'write', subject: 'Role' })
  async createTemplate(@Body() body: CreateTemplateDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const id = this.admin.newTemplateId();
    const result = await this.admin.commit(
      user.id,
      'TEMPLATE_CREATED',
      [
        {
          type: 'template',
          id,
          after: {
            code: body.code?.trim() || `MAU-${randomUUID().slice(0, 8).toUpperCase()}`,
            name: body.name,
            description: body.description ?? null,
            status: 'ACTIVE',
            entries: entriesOf(body.entries),
          },
        },
      ],
      { reason: body.reason, meta: meta(req) },
    );
    return { ...result, id };
  }

  @Patch('templates/:id')
  @RequirePermissions({ action: 'write', subject: 'Role' })
  async updateTemplate(@Param('id') id: string, @Body() body: UpdateTemplateDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const { doc } = await this.admin.templateDoc(id);
    return this.admin.commit(
      user.id,
      'TEMPLATE_UPDATED',
      [
        {
          type: 'template',
          id,
          after: {
            ...doc,
            name: body.name ?? doc.name,
            description: body.description === undefined ? doc.description : body.description,
            entries: body.entries ? entriesOf(body.entries) : doc.entries,
          },
        },
      ],
      { reason: body.reason, expected: { [`template:${id}`]: body.expectedRevision }, meta: meta(req) },
    );
  }

  @Post('templates/:id/copy')
  @RequirePermissions({ action: 'write', subject: 'Role' })
  async copyTemplate(@Param('id') id: string, @Body() body: CopyTemplateDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const { doc } = await this.admin.templateDoc(id);
    const newId = this.admin.newTemplateId();
    const result = await this.admin.commit(
      user.id,
      'TEMPLATE_COPIED',
      [{ type: 'template', id: newId, after: { ...doc, code: `MAU-${randomUUID().slice(0, 8).toUpperCase()}`, name: body.name, status: 'ACTIVE' } }],
      { meta: meta(req) },
    );
    return { ...result, id: newId };
  }

  private async setTemplateStatus(id: string, status: 'ACTIVE' | 'ARCHIVED', body: TemplateStateDto, user: AuthUser, req: Request) {
    const { doc } = await this.admin.templateDoc(id);
    return this.admin.commit(
      user.id,
      status === 'ARCHIVED' ? 'TEMPLATE_ARCHIVED' : 'TEMPLATE_RESTORED',
      [{ type: 'template', id, after: { ...doc, status } }],
      { expected: { [`template:${id}`]: body.expectedRevision }, meta: meta(req) },
    );
  }

  /** Archived: no longer offered when configuring a team; teams that use it keep it. Way back: restore. */
  @Post('templates/:id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Role' })
  archiveTemplate(@Param('id') id: string, @Body() body: TemplateStateDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.setTemplateStatus(id, 'ARCHIVED', body, user, req);
  }

  @Post('templates/:id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Role' })
  restoreTemplate(@Param('id') id: string, @Body() body: TemplateStateDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.setTemplateStatus(id, 'ACTIVE', body, user, req);
  }

  /** Real delete, only while no team uses the template (else TEMPLATE_IN_USE with the teams; archive instead). */
  @Delete('templates/:id')
  @RequirePermissions({ action: 'write', subject: 'Role' })
  async deleteTemplate(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    await this.admin.templateDoc(id);
    return this.admin.commit(user.id, 'TEMPLATE_DELETED', [{ type: 'template', id, after: null }], { meta: meta(req) });
  }

  // ── teams ───────────────────────────────────────────────────────────────────────────────────────────────────
  @Get('teams')
  @RequirePermissions({ action: 'read', subject: 'Role' })
  listTeams() {
    return this.admin.listTeams();
  }

  @Put('teams/:teamId')
  @RequirePermissions({ action: 'write', subject: 'Role' })
  saveTeam(@Param('teamId') teamId: string, @Body() body: SaveTeamConfigDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.admin.commit(user.id, 'TEAM_CONFIG_SAVED', [{ type: 'team', id: teamId, after: teamDoc(body) }], {
      reason: body.reason,
      expected: { [`team:${teamId}`]: body.expectedRevision },
      meta: meta(req),
    });
  }

  /** Removes the team's own configuration: it follows its parent again (or the roles, if nobody above has any). */
  @Delete('teams/:teamId')
  @RequirePermissions({ action: 'write', subject: 'Role' })
  clearTeam(@Param('teamId') teamId: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.admin.commit(user.id, 'TEAM_CONFIG_REMOVED', [{ type: 'team', id: teamId, after: null }], { meta: meta(req) });
  }

  /** The same configuration for many teams at once: all of them, or none. */
  @Post('teams/apply')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Role' })
  applyTeams(@Body() body: ApplyTeamsDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const after = body.config ? teamDoc(body.config) : null;
    const teamIds = [...new Set(body.teamIds)];
    return this.admin.commit(
      user.id,
      'TEAM_CONFIG_APPLIED',
      teamIds.map((id) => ({ type: 'team', id, after }) as WantedItem),
      {
        reason: body.reason,
        expected: Object.fromEntries(teamIds.filter((id) => body.expected[id] !== undefined).map((id) => [`team:${id}`, Number(body.expected[id])])),
        meta: meta(req),
      },
    );
  }

  // ── people ──────────────────────────────────────────────────────────────────────────────────────────────────
  @Get('users/:userId/overrides')
  @RequirePermissions({ action: 'read', subject: 'Role' })
  userOverrides(@Param('userId') userId: string) {
    return this.admin.getUserOverrides(userId);
  }

  /** The person's whole list: an empty list removes every override. */
  @Put('users/:userId/overrides')
  @RequirePermissions({ action: 'write', subject: 'Role' })
  saveUserOverrides(@Param('userId') userId: string, @Body() body: SaveUserOverridesDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.admin.commit(user.id, 'USER_OVERRIDES_SAVED', [{ type: 'user', id: userId, after: body.overrides.map(overrideDoc) }], {
      reason: body.reason,
      meta: meta(req),
    });
  }

  // ── preview, history, undo ──────────────────────────────────────────────────────────────────────────────────
  /** Who would gain or lose what. Changes nothing. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'Role' })
  async preview(@Body() body: PreviewDto) {
    const wanted: WantedItem[] = [];
    for (const t of body.templates ?? []) {
      if (t.entries === null || t.entries === undefined) wanted.push({ type: 'template', id: t.id, after: null });
      else {
        const current = await this.admin.templateDoc(t.id).catch(() => null);
        wanted.push({
          type: 'template',
          id: t.id,
          after: { code: current?.doc.code ?? t.id, name: current?.doc.name ?? t.id, description: null, status: 'ACTIVE', entries: entriesOf(t.entries) },
        });
      }
    }
    for (const t of body.teams ?? []) wanted.push({ type: 'team', id: t.teamId, after: t.config ? teamDoc(t.config) : null });
    for (const u of body.users ?? []) wanted.push({ type: 'user', id: u.userId, after: u.overrides.map(overrideDoc) });
    return this.admin.preview(wanted);
  }

  @Get('changes')
  @RequirePermissions({ action: 'read', subject: 'Role' })
  history(@Query('limit') limit?: string, @Query('before') before?: string) {
    return this.admin.history(limit ? Number(limit) || 50 : 50, before || undefined);
  }

  /** Puts back what the change replaced, as a new change (which can itself be undone). */
  @Post('changes/:id/undo')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Role' })
  undo(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.admin.undo(id, user.id, meta(req));
  }
}
