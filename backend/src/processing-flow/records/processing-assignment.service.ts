import { ConflictException, ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { userHoldingPermission } from '../../authz/enforcement';
import { PrismaService } from '../../prisma/prisma.service';
import { PROCESSING_ERROR, type ProcessingErrorCode } from '../contract/processing-codes';
import { RecordGateway } from '../gateway/record-gateway';
import type { GatewayUser, RecordKind } from '../gateway/record-snapshot';
import { ProcessingCommandService, type CommandInput } from './processing-command.service';
import { displayNameOf, type RecordFlowDto } from './record-flow.dto';

const refuse = {
  bad: (code: ProcessingErrorCode) => new BadRequestException({ code }),
  conflict: (code: ProcessingErrorCode) => new ConflictException({ code }),
  notFound: (code: ProcessingErrorCode) => new NotFoundException({ code }),
  forbidden: (code: ProcessingErrorCode) => new ForbiddenException({ code }),
};

export interface AssignPartyInput extends CommandInput {
  /** The person who answers for the party from now on; `null`: nobody is named, the heads of the unit answer. */
  userId: string | null;
}

export interface CandidateDto {
  userId: string;
  name: string;
  isLeader: boolean;
}

/**
 * Who answers for a party of a step. A step is given to a UNIT; a person of that unit may be named, and while nobody is,
 * the heads of the unit answer.
 *
 * WHO may name a person (the rule, in one place: `mayAssign`):
 *   1. a person who holds `assign:ProcessingStep` AND has the record in their own scope (the record's own read policy,
 *      never the step) names anybody eligible, or nobody;
 *   2. a head of the party's (active) unit does the same for that party;
 *   3. a member of the party's (active) unit takes the work THEMSELF while nobody is named ("Nhận việc"), and gives back
 *      what they took (names nobody while they are the one named). Nothing else: a member never names a colleague and
 *      never takes work away from the person a head named.
 *
 * WHO may be named: an ACTIVE user who is a member of the party's ACTIVE unit (for a party that names "the unit holding
 * the record", the unit it resolved to when the flow was applied). A party with no unit can only be given back.
 */
@Injectable()
export class ProcessingAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: ProcessingCommandService,
    private readonly gateway: RecordGateway,
  ) {}

  /** Rule 1 of the class comment, asked once per request, outside the transaction of the write. */
  private async assignsByPermission(actor: GatewayUser, kind: RecordKind, recordId: string): Promise<boolean> {
    const holders = await this.prisma.user.count({ where: { AND: [{ id: actor.id, isActive: true }, userHoldingPermission('assign', 'ProcessingStep')] } });
    return holders > 0 && (await this.gateway.canRead(kind, recordId, actor, { viaStep: false }));
  }

  async assign(actor: GatewayUser, kind: RecordKind, recordId: string, stepKey: string, partyId: string, input: AssignPartyInput): Promise<RecordFlowDto> {
    const userId = input.userId ?? null;
    if (userId !== null && (typeof userId !== 'string' || userId.trim() === '')) throw refuse.bad(PROCESSING_ERROR.ASSIGNEE_NOT_ELIGIBLE);
    const byPermission = await this.assignsByPermission(actor, kind, recordId);

    return this.commands.writeStep(kind, recordId, actor.id, stepKey, 'ASSIGN_PARTY', input, async (tx, flow, step) => {
      const party = step.parties.find((candidate) => candidate.id === partyId);
      if (!party) throw refuse.notFound(PROCESSING_ERROR.PARTY_NOT_FOUND);

      // The people the rule is about, as members of the party's unit while it is active.
      const members = party.teamId
        ? await tx.userTeam.findMany({
            where: { teamId: party.teamId, team: { status: 'ACTIVE' }, userId: { in: userId ? [actor.id, userId] : [actor.id] } },
            select: { userId: true, isLeader: true, user: { select: { isActive: true } } },
          })
        : [];
      const actorRow = members.find((member) => member.userId === actor.id && member.user.isActive);
      if (!mayAssign({ byPermission, leads: actorRow?.isLeader === true, member: actorRow !== undefined, actorId: actor.id, current: party.assigneeUserId, next: userId })) {
        throw refuse.forbidden(PROCESSING_ERROR.ASSIGN_NOT_ALLOWED);
      }
      if (step.status === 'DONE' || step.status === 'SKIPPED') throw refuse.conflict(PROCESSING_ERROR.STEP_CLOSED);
      if (userId !== null && !members.some((member) => member.userId === userId && member.user.isActive)) throw refuse.bad(PROCESSING_ERROR.ASSIGNEE_NOT_ELIGIBLE);

      await tx.procRecordStepParty.update({ where: { id: party.id }, data: { assigneeUserId: userId } });
      await tx.procRecordStep.update({ where: { id: step.id }, data: { revision: { increment: 1 } } });
      await this.commands.change(tx, flow, step.stepKey, 'PARTY_ASSIGNED', { partyId: party.id, assigneeUserId: party.assigneeUserId }, { partyId: party.id, assigneeUserId: userId }, null, actor.id);
    });
  }

  /** The people who may be named on a party: the active members of its active unit. Shown to whoever may name one. */
  async candidates(actor: GatewayUser, kind: RecordKind, recordId: string, stepKey: string, partyId: string): Promise<CandidateDto[]> {
    const party = await this.prisma.procRecordStepParty.findFirst({ where: { id: partyId, recordStep: { recordKind: kind, recordId, stepKey } }, select: { teamId: true } });
    if (!party) throw refuse.notFound(PROCESSING_ERROR.PARTY_NOT_FOUND);
    const members = party.teamId
      ? await this.prisma.userTeam.findMany({
          where: { teamId: party.teamId, team: { status: 'ACTIVE' }, user: { isActive: true } },
          select: { userId: true, isLeader: true, user: { select: { firstName: true, lastName: true, username: true } } },
        })
      : [];
    if (!members.some((member) => member.userId === actor.id) && !(await this.assignsByPermission(actor, kind, recordId))) throw refuse.forbidden(PROCESSING_ERROR.ASSIGN_NOT_ALLOWED);
    return members
      .map((member) => ({ userId: member.userId, name: displayNameOf(member.user), isLeader: member.isLeader }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.userId.localeCompare(b.userId));
  }
}

/** The rule of the class comment. Pure. */
export function mayAssign(ask: { byPermission: boolean; leads: boolean; member: boolean; actorId: string; current: string | null; next: string | null }): boolean {
  if (ask.byPermission || ask.leads) return true;
  if (!ask.member) return false;
  const takes = ask.next === ask.actorId && ask.current === null;
  const givesBack = ask.next === null && ask.current === ask.actorId;
  return takes || givesBack;
}
