import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AuthzService } from '../authz.service';
import { governingConfig } from '../engine/compile';
import type { Reach } from '../engine/types';
import {
  impactOf,
  normalise,
  problemsOf,
  sameDoc,
  tokenOf,
  viewProblemsOfTeam,
  type ChangeItem,
  type OverrideDoc,
  type PersonImpact,
  type TeamDoc,
  type TemplateDoc,
  type WantedItem,
} from './documents';

type Tx = Prisma.TransactionClient;
type Meta = { ipAddress?: string; userAgent?: string };
const pair = (p: { action: string; subject: string }) => `${p.action}:${p.subject}`;

export const AUTHZ_ADMIN_ERROR = {
  INVALID: 'AUTHZ_CHANGE_INVALID',
  REVISION_CONFLICT: 'REVISION_CONFLICT',
  TEMPLATE_IN_USE: 'TEMPLATE_IN_USE',
  TEMPLATE_CODE_TAKEN: 'TEMPLATE_CODE_TAKEN',
  CHANGED_SINCE: 'AUTHZ_CHANGED_SINCE',
  ALREADY_UNDONE: 'AUTHZ_ALREADY_UNDONE',
} as const;

/** One lock for every writer of the permission configuration (pg_advisory_xact_lock). */
const CONFIG_WRITE_LOCK = 7226001;

export interface Expected {
  /** `type:id` -> the revision the editor read (templates and team configurations). */
  [key: string]: number;
}

export interface CommitResult {
  changed: boolean;
  changeSetId: string | null;
  items: { type: ChangeItem['type']; id: string }[];
}

/**
 * The only writer of the permission configuration. Every save is a set of documents becoming other documents, in
 * one transaction, checked before anything is written, recorded with what it replaced, and undoable.
 */
@Injectable()
export class AuthzAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
    private readonly audit: AuditService,
  ) {}

  // ── reading documents ───────────────────────────────────────────────────────────────────────────────────────

  private async readTemplate(db: Tx | PrismaService, id: string): Promise<{ doc: TemplateDoc; revision: number } | null> {
    const row = await db.permissionTemplate.findUnique({
      where: { id },
      include: { entries: { include: { permission: { select: { action: true, subject: true } } } } },
    });
    if (!row) return null;
    return {
      revision: row.revision,
      doc: {
        code: row.code,
        name: row.name,
        description: row.description,
        status: row.status,
        entries: Object.fromEntries(row.entries.map((e) => [pair(e.permission), e.reach as Reach])),
      },
    };
  }

  private async readTeam(db: Tx | PrismaService, teamId: string): Promise<{ doc: TeamDoc; revision: number } | null> {
    const row = await db.teamPermissionConfig.findUnique({
      where: { teamId },
      include: { overrides: { include: { permission: { select: { action: true, subject: true } } } } },
    });
    if (!row) return null;
    return {
      revision: row.revision,
      doc: {
        mode: row.mode,
        memberTemplateId: row.memberTemplateId,
        leaderTemplateId: row.leaderTemplateId,
        overrides: row.overrides.map((o) => ({
          permission: pair(o.permission),
          effect: o.effect,
          reach: o.reach as Reach | null,
          reason: o.reason,
          expiresAt: o.expiresAt?.toISOString() ?? null,
          audience: o.audience,
        })),
      },
    };
  }

  private async readUser(db: Tx | PrismaService, userId: string): Promise<OverrideDoc[]> {
    const rows = await db.userPermissionOverride.findMany({
      where: { userId },
      include: { permission: { select: { action: true, subject: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((o) => ({
      permission: pair(o.permission),
      effect: o.effect,
      reach: o.reach as Reach | null,
      reason: o.reason,
      expiresAt: o.expiresAt?.toISOString() ?? null,
    }));
  }

  // ── writing documents (inside a transaction) ────────────────────────────────────────────────────────────────

  private async permissionIds(tx: Tx): Promise<Map<string, string>> {
    const rows = await tx.permission.findMany({ select: { id: true, action: true, subject: true } });
    return new Map(rows.map((p) => [pair(p), p.id]));
  }

  private async writeTemplate(tx: Tx, id: string, doc: TemplateDoc | null, ids: Map<string, string>, actorId: string) {
    if (!doc) {
      await tx.permissionTemplate.delete({ where: { id } });
      return;
    }
    const data = {
      code: doc.code,
      name: doc.name.trim(),
      description: doc.description,
      status: doc.status,
      archivedAt: doc.status === 'ARCHIVED' ? new Date() : null,
    };
    await tx.permissionTemplate.upsert({
      where: { id },
      create: { id, ...data, createdById: actorId },
      update: { ...data, revision: { increment: 1 } },
    });
    await tx.permissionTemplateEntry.deleteMany({ where: { templateId: id } });
    await tx.permissionTemplateEntry.createMany({
      data: Object.entries(doc.entries).map(([permission, reach]) => ({ templateId: id, permissionId: ids.get(permission) as string, reach })),
    });
  }

  private async writeTeam(tx: Tx, teamId: string, doc: TeamDoc | null, ids: Map<string, string>, actorId: string) {
    if (!doc) {
      await tx.teamPermissionConfig.deleteMany({ where: { teamId } });
      return;
    }
    const data = { mode: doc.mode, memberTemplateId: doc.memberTemplateId, leaderTemplateId: doc.leaderTemplateId, updatedById: actorId };
    await tx.teamPermissionConfig.upsert({ where: { teamId }, create: { teamId, ...data }, update: { ...data, revision: { increment: 1 } } });
    await tx.teamPermissionOverride.deleteMany({ where: { teamId } });
    await tx.teamPermissionOverride.createMany({
      data: doc.overrides.map((o) => ({
        teamId,
        permissionId: ids.get(o.permission) as string,
        audience: o.audience,
        effect: o.effect,
        reach: o.effect === 'GRANT' ? o.reach : null,
        reason: o.reason.trim(),
        expiresAt: o.expiresAt ? new Date(o.expiresAt) : null,
        createdById: actorId,
      })),
    });
  }

  private async writeUser(tx: Tx, userId: string, docs: OverrideDoc[], ids: Map<string, string>, actorId: string) {
    await tx.userPermissionOverride.deleteMany({ where: { userId } });
    await tx.userPermissionOverride.createMany({
      data: docs.map((o) => ({
        userId,
        permissionId: ids.get(o.permission) as string,
        effect: o.effect,
        reach: o.effect === 'GRANT' ? o.reach : null,
        reason: o.reason.trim(),
        expiresAt: o.expiresAt ? new Date(o.expiresAt) : null,
        createdById: actorId,
      })),
    });
  }

  private async write(tx: Tx, item: ChangeItem, doc: unknown, ids: Map<string, string>, actorId: string) {
    if (item.type === 'template') await this.writeTemplate(tx, item.id, doc as TemplateDoc | null, ids, actorId);
    else if (item.type === 'team') await this.writeTeam(tx, item.id, doc as TeamDoc | null, ids, actorId);
    else await this.writeUser(tx, item.id, doc as OverrideDoc[], ids, actorId);
  }

  /** The object as it is now, with the revision an editor would have read (0 = it does not exist). */
  private async current(tx: Tx, wanted: { type: ChangeItem['type']; id: string }): Promise<{ before: unknown; revision: number }> {
    if (wanted.type === 'template') {
      const t = await this.readTemplate(tx, wanted.id);
      return { before: t?.doc ?? null, revision: t?.revision ?? 0 };
    }
    if (wanted.type === 'team') {
      if (!(await tx.team.findUnique({ where: { id: wanted.id }, select: { id: true } }))) throw new NotFoundException({ code: 'TEAM_NOT_FOUND' });
      const c = await this.readTeam(tx, wanted.id);
      return { before: c?.doc ?? null, revision: c?.revision ?? 0 };
    }
    if (!(await tx.user.findUnique({ where: { id: wanted.id }, select: { id: true } }))) throw new NotFoundException({ code: 'AUTHZ_USER_NOT_FOUND' });
    return { before: await this.readUser(tx, wanted.id), revision: 0 };
  }

  // ── the one write path ──────────────────────────────────────────────────────────────────────────────────────

  /**
   * Makes the wanted documents the configuration, or changes nothing at all.
   *
   * Guards against a stale editor, all checked INSIDE the transaction, after the one lock every writer of this
   * configuration takes: `expected` (the revision a template / team configuration was read at) and `expectedTokens`
   * (the fingerprint of the document that was read: a person's override list has no revision, and an undo must find
   * exactly what the change it undoes left). A mismatch is a conflict, never an overwrite.
   *
   * Every change is judged by the same rules, an undo included: putting a grant BACK is giving it, and whoever does
   * it must hold it (and say why, when it is sensitive).
   */
  async commit(
    actorId: string,
    kind: string,
    asked: readonly WantedItem[],
    options: {
      reason?: string | null;
      expected?: Expected;
      expectedTokens?: Record<string, string>;
      /** The code a token mismatch is reported with (an undo says "changed since"). */
      tokenConflictCode?: string;
      meta?: Meta;
      revertsId?: string;
    } = {},
  ): Promise<CommitResult> {
    // What the saver holds NOW, before the change: nobody lifts themselves by the change they are saving.
    const actorKeys = new Set((await this.authz.effective(actorId)).keys);
    const now = new Date();
    const wanted = asked.map(normalise);
    const result = await this.prisma.$transaction(async (tx) => {
      // Saves of the permission configuration are rare and must not interleave: a template edited while a team that
      // uses it is being validated would let through a configuration nobody checked as a whole.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CONFIG_WRITE_LOCK})`;
      const ids = await this.permissionIds(tx);
      const items: ChangeItem[] = [];
      for (const w of wanted) {
        const key = `${w.type}:${w.id}`;
        const { before, revision } = await this.current(tx, w);
        const expected = options.expected?.[key];
        if (expected !== undefined && expected !== revision) {
          throw new ConflictException({ code: AUTHZ_ADMIN_ERROR.REVISION_CONFLICT, details: [{ type: w.type, id: w.id }] });
        }
        const token = options.expectedTokens?.[key];
        if (token !== undefined && token !== tokenOf(before)) {
          throw new ConflictException({
            code: options.tokenConflictCode ?? AUTHZ_ADMIN_ERROR.REVISION_CONFLICT,
            details: [{ type: w.type, id: w.id }],
          });
        }
        if (!sameDoc(before, w.after)) items.push({ type: w.type, id: w.id, before, after: w.after } as ChangeItem);
      }
      if (items.length === 0) return null;

      // The templates as they will be once this change is in.
      const templates = new Map<string, TemplateDoc>();
      for (const row of await tx.permissionTemplate.findMany({ select: { id: true } })) {
        const t = await this.readTemplate(tx, row.id);
        if (t) templates.set(row.id, t.doc);
      }
      const edited = new Set<string>();
      for (const item of items) {
        if (item.type !== 'template') continue;
        edited.add(item.id);
        if (item.after) templates.set(item.id, item.after);
        else templates.delete(item.id);
      }
      const problems: (Record<string, unknown> & { type: string; id: string })[] = items.flatMap((item) =>
        problemsOf(item, { templates, actorKeys, reason: options.reason ?? null, now }).map((p) => ({ ...p, type: item.type, id: item.id })),
      );
      // A template that changed is also judged where it is USED: a team whose own overrides were fine with the old
      // template may now let people change what they can no longer see.
      const inThisChange = new Set(items.filter((i) => i.type === 'team').map((i) => i.id));
      const users = await tx.teamPermissionConfig.findMany({
        where: { OR: [{ memberTemplateId: { in: [...edited] } }, { leaderTemplateId: { in: [...edited] } }] },
        select: { teamId: true, team: { select: { name: true } } },
      });
      for (const u of users) {
        if (inThisChange.has(u.teamId)) continue;
        const doc = (await this.readTeam(tx, u.teamId))?.doc;
        if (!doc) continue;
        const gone = [doc.memberTemplateId, doc.leaderTemplateId].some((t) => t && edited.has(t) && !templates.has(t));
        if (gone) throw new ConflictException({ code: AUTHZ_ADMIN_ERROR.TEMPLATE_IN_USE, details: users.map((x) => ({ teamId: x.teamId, name: x.team.name })) });
        problems.push(...viewProblemsOfTeam(doc, templates).map((p) => ({ ...p, type: 'team', id: u.teamId })));
      }
      if (problems.length) throw new BadRequestException({ code: AUTHZ_ADMIN_ERROR.INVALID, details: problems });

      // Teams first when a template goes away (they must let go of it), templates first when one appears.
      const rank = (item: ChangeItem) => (item.type === 'template' ? (item.after ? 0 : 2) : 1);
      for (const item of [...items].sort((a, b) => rank(a) - rank(b))) {
        try {
          await this.write(tx, item, item.after, ids, actorId);
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && item.type === 'template') {
            throw new ConflictException({ code: AUTHZ_ADMIN_ERROR.TEMPLATE_CODE_TAKEN });
          }
          throw err;
        }
      }
      const changeSet = await tx.permissionChangeSet.create({
        data: {
          kind,
          actorId,
          reason: options.reason?.trim() || null,
          changes: items as unknown as Prisma.InputJsonValue,
          revertsId: options.revertsId ?? null,
        },
      });
      const touched = items.map((i) => ({ type: i.type, id: i.id }));
      // In the same transaction: a change that is saved is a change that is audited. Metadata only, never documents.
      await this.audit.log(
        {
          userId: actorId,
          action: 'AUTHZ_CONFIG_CHANGED',
          subject: 'Role',
          subjectId: changeSet.id,
          metadata: { kind, items: touched },
          ipAddress: options.meta?.ipAddress,
          userAgent: options.meta?.userAgent,
        },
        tx,
      );
      return { changeSetId: changeSet.id, items: touched };
    });

    if (!result) return { changed: false, changeSetId: null, items: [] };
    return { changed: true, changeSetId: result.changeSetId, items: result.items };
  }

  /** Who would gain or lose what if the wanted documents were saved now. Nothing is written or checked for validity. */
  async preview(
    asked: readonly WantedItem[],
  ): Promise<{ people: number; impacts: (PersonImpact & { name: string })[]; teamNames: Record<string, string> }> {
    const snapshot = await this.authz.snapshot();
    const impacts = impactOf(snapshot.org, snapshot.config, snapshot.users, asked.map(normalise), new Date());
    const names = await this.prisma.user.findMany({
      where: { id: { in: impacts.map((i) => i.userId) } },
      select: { id: true, username: true, firstName: true, lastName: true },
    });
    const nameOf = new Map(names.map((u) => [u.id, [u.lastName, u.firstName].filter(Boolean).join(' ') || u.username]));
    const teamIds = new Set(impacts.flatMap((i) => [...i.gained, ...i.lost, ...i.changed].flatMap((d) => [...(d.teamsGained ?? []), ...(d.teamsLost ?? [])])));
    return {
      people: snapshot.users.size,
      impacts: impacts.map((i) => ({ ...i, name: nameOf.get(i.userId) ?? i.userId })),
      teamNames: Object.fromEntries([...teamIds].map((id) => [id, snapshot.teamNames.get(id) ?? id])),
    };
  }

  // ── history and undo ────────────────────────────────────────────────────────────────────────────────────────

  async history(limit = 50, before?: string) {
    const rows = await this.prisma.permissionChangeSet.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(limit, 1), 200),
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    });
    const undone = await this.prisma.permissionChangeSet.findMany({
      where: { revertsId: { in: rows.map((r) => r.id) } },
      select: { revertsId: true, id: true },
    });
    const undoneBy = new Map(undone.map((u) => [u.revertsId as string, u.id]));
    const actors = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } },
      select: { id: true, username: true, firstName: true, lastName: true },
    });
    const actorName = new Map(actors.map((u) => [u.id, [u.lastName, u.firstName].filter(Boolean).join(' ') || u.username]));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      actorId: r.actorId,
      actorName: actorName.get(r.actorId) ?? r.actorId,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
      revertsId: r.revertsId,
      undoneById: undoneBy.get(r.id) ?? null,
      changes: r.changes as unknown as ChangeItem[],
    }));
  }

  /**
   * Puts back what a change replaced, as a new change. Refused when anything it touched has been changed again since
   * (undoing would silently throw that later change away): that is decided inside the write transaction, against
   * what is in the database at that moment. It is judged like any other save: `reason` is the undoer's own.
   */
  async undo(changeSetId: string, actorId: string, options: { reason?: string | null; meta?: Meta } = {}): Promise<CommitResult> {
    const set = await this.prisma.permissionChangeSet.findUnique({ where: { id: changeSetId } });
    if (!set) throw new NotFoundException({ code: 'AUTHZ_CHANGE_NOT_FOUND' });
    if (await this.prisma.permissionChangeSet.findUnique({ where: { revertsId: changeSetId }, select: { id: true } })) {
      throw new ConflictException({ code: AUTHZ_ADMIN_ERROR.ALREADY_UNDONE });
    }
    const items = set.changes as unknown as ChangeItem[];
    try {
      return await this.commit(
        actorId,
        'UNDO',
        items.map((i) => ({ type: i.type, id: i.id, after: i.before }) as WantedItem),
        {
          reason: options.reason,
          meta: options.meta,
          revertsId: changeSetId,
          expectedTokens: Object.fromEntries(items.map((i) => [`${i.type}:${i.id}`, tokenOf(i.after)])),
          tokenConflictCode: AUTHZ_ADMIN_ERROR.CHANGED_SINCE,
        },
      );
    } catch (err) {
      // Two people undoing the same change at once: the unique key on `revertsId` lets one through.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: AUTHZ_ADMIN_ERROR.ALREADY_UNDONE });
      }
      throw err;
    }
  }

  // ── what the screens list ───────────────────────────────────────────────────────────────────────────────────

  async listTemplates() {
    const rows = await this.prisma.permissionTemplate.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        entries: { include: { permission: { select: { action: true, subject: true } } } },
        _count: { select: { memberOfTeams: true, leaderOfTeams: true } },
      },
    });
    return rows.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      status: t.status,
      revision: t.revision,
      entries: Object.fromEntries(t.entries.map((e) => [pair(e.permission), e.reach])),
      usedByTeams: t._count.memberOfTeams + t._count.leaderOfTeams,
    }));
  }

  async getTemplate(id: string) {
    const t = await this.readTemplate(this.prisma, id);
    if (!t) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND' });
    return { id, revision: t.revision, ...t.doc };
  }

  /** Every team that counts or is paused, with its configuration and the team whose configuration governs it. */
  async listTeams() {
    const snapshot = await this.authz.snapshot();
    const teams = await this.prisma.team.findMany({
      where: { status: { not: 'ARCHIVED' } },
      orderBy: [{ level: 'asc' }, { order: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, code: true, parentId: true, status: true, _count: { select: { members: true } } },
    });
    const configs = new Map<string, { doc: TeamDoc; revision: number }>();
    for (const team of teams) {
      const c = await this.readTeam(this.prisma, team.id);
      if (c) configs.set(team.id, c);
    }
    return teams.map((t) => {
      const governing = governingConfig(snapshot.org, snapshot.config, t.id);
      return {
        teamId: t.id,
        name: t.name,
        code: t.code,
        parentId: t.parentId,
        status: t.status,
        members: t._count.members,
        revision: configs.get(t.id)?.revision ?? 0,
        config: configs.get(t.id)?.doc ?? null,
        // Null = nobody up the line has set anything: each member keeps what their role holds.
        governedByTeamId: governing?.teamId ?? null,
        governedByTeamName: governing ? (snapshot.teamNames.get(governing.teamId) ?? null) : null,
      };
    });
  }

  async getUserOverrides(userId: string) {
    if (!(await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
      throw new NotFoundException({ code: 'AUTHZ_USER_NOT_FOUND' });
    }
    const overrides = await this.readUser(this.prisma, userId);
    // The token is what a save must send back: a person's list has no revision of its own.
    return { overrides, token: tokenOf(overrides) };
  }

  /** A new template's id, made here so the caller can refer to it in the same change. */
  newTemplateId(): string {
    return randomUUID();
  }

  /** The template as a document, for callers that build a change from it (copy, archive). */
  async templateDoc(id: string): Promise<{ doc: TemplateDoc; revision: number }> {
    const t = await this.readTemplate(this.prisma, id);
    if (!t) throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND' });
    return t;
  }
}
