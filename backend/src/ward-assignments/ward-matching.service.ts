import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, type WardMatchSource } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { userHoldingPermission } from '../authz/enforcement';
import { CaseChildAccessService } from '../case-child-access/case-child-access.service';
import { boDauTiengViet } from '../common/utils/chuan-hoa-ten.util';
import { actionConditions, buildPetitionScopeFilter, recordInActionScope } from '../common/utils/scope-filter.util';
import { PrismaService } from '../prisma/prisma.service';
import { WARD_ERROR } from './ward-assignment.codes';
import { WARD_ALERT_AUDIT, WARD_ALERT_ERROR } from './ward-alerts.codes';
import { wardBody } from './ward-errors';
import { reachOf, wardReadConditions, wardReadable } from './ward-locks';

/**
 * Subject matching of a ward assignment request ("Dò trùng đối tượng", plan R4, A5, C3, C4).
 *
 * Levels: CERTAIN = the same identity number (digits only); POSSIBLE = the same normalised name and the same birth
 * year; NEAR = the same normalised name where a birth year is missing on either side or the two differ by one year (a
 * typing slip). Every line says WHY (`reasons`). Sources and what each can say:
 *   - other ward requests: both levels (structured subjects);
 *   - the subjects of CASES: both levels (identity number, date of birth);
 *   - PETITIONS: POSSIBLE by name only, the suspect being free text ("người bị tố giác"), compared word by word with
 *     its normalised shadow column `suspected_person_bd`;
 *   - INCIDENTS: none. Their suspect (`doiTuongCaNhan`) is free text with no normalised shadow column: comparing it
 *     would scan the table with a function on every row. Left out until such a column exists.
 *
 * Confidentiality: every source's OWN read rule is part of the query that finds the candidates, so a record the person
 * may not open is never listed and never counted. On top: other ward units' requests only within the person's
 * `matchSubjects` reach (a ward officer sees matches in their own unit's requests only); petitions and cases only for
 * somebody whose `matchSubjects` reach covers THIS request. A pair concluded "not the same person" is not shown again.
 */

export type MatchLevel = 'CERTAIN' | 'POSSIBLE' | 'NEAR';
export type MatchReason = 'ID_NUMBER' | 'NAME' | 'NAME_IN_TEXT' | 'BIRTH_YEAR' | 'BIRTH_YEAR_NEAR' | 'ADDRESS';
const RANK: Record<MatchLevel, number> = { CERTAIN: 0, POSSIBLE: 1, NEAR: 2 };

export interface SubjectMatch {
  subjectPosition: number;
  level: MatchLevel;
  /** What is the same on both sides. */
  reasons: MatchReason[];
  source: WardMatchSource;
  recordId: string;
  code: string | null;
  unitName: string | null;
  /** The name as written in the other record. */
  name: string;
  /** A reviewer concluded "the same person" for this pair (pairs concluded "not the same" are not listed). */
  concludedSame: boolean;
  /** A conclusion in force exists for this pair (only "the same person" ones are listed). */
  concluded: boolean;
}

/** What the request's reviewer is shown of the other record, read only (`preview`). */
export interface MatchPreview {
  source: WardMatchSource;
  recordId: string;
  code: string | null;
  unitName: string | null;
  status: string | null;
  /** The day the other record was received, submitted or opened (YYYY-MM-DD, Viet Nam). */
  day: string | null;
  summary: string | null;
  /** The people the other record names, as written there. */
  people: { name: string; birthYear: number | null; idNumber: string | null; address: string | null }[];
}

type Scope = DataScope | null | undefined;

/** Below this many letters a name says too little to be compared with free text. */
const FREE_TEXT_NAME_MIN = 6;
/** The most matches of one source for one request (a common name must not flood the screen). */
const MATCHES_MAX = 200;
/** Case subjects looked at for one request before the case rule and the name comparison keep the matches. */
const CASE_CANDIDATES_MAX = 5000;

const digitsOf = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');
/** 1 January of a year, 00:00 in Viet Nam (UTC+7, no daylight saving), as an instant. */
const vnYearStart = (year: number) => new Date(Date.UTC(year, 0, 1) - 7 * 3_600_000);
const vnYearOf = (instant: Date) => new Date(instant.getTime() + 7 * 3_600_000).getUTCFullYear();
/** A regular expression that matches `name` as whole words, every character of the name taken literally. */
export const wordsPattern = (name: string) => `(^|[^a-z0-9])${name.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')}($|[^a-z0-9])`;

interface SubjectRow {
  position: number;
  fullNameNorm: string;
  birthYear: number | null;
  idNumberNorm: string | null;
  address: string | null;
  createdAt: Date;
}

/**
 * A match as found, with when the other side last changed (its subject row, the case subject, the petition): a
 * conclusion made before that is about another person and stops counting.
 */
type Found = SubjectMatch & { otherSince?: Date };

/** The level and the reasons of one pair, from what both sides say; null = not a match. */
export function judge(
  mine: { fullNameNorm: string; birthYear: number | null; idNumberNorm: string | null; address?: string | null },
  other: { nameNorm: string; birthYear: number | null; idNumberNorm: string | null; address?: string | null },
): { level: MatchLevel; reasons: MatchReason[] } | null {
  const reasons: MatchReason[] = [];
  const sameId = !!mine.idNumberNorm && other.idNumberNorm === mine.idNumberNorm;
  const sameName = mine.fullNameNorm.length > 0 && other.nameNorm === mine.fullNameNorm;
  const sameYear = mine.birthYear !== null && other.birthYear === mine.birthYear;
  const nearYear = mine.birthYear !== null && other.birthYear !== null && Math.abs(other.birthYear - mine.birthYear) === 1;
  const yearUnknown = mine.birthYear === null || other.birthYear === null;
  if (sameId) reasons.push('ID_NUMBER');
  if (sameName) reasons.push('NAME');
  if (sameYear) reasons.push('BIRTH_YEAR');
  if (nearYear && sameName) reasons.push('BIRTH_YEAR_NEAR');
  const address = (v: string | null | undefined) => boDauTiengViet(v ?? '').trim();
  if (address(mine.address) && address(mine.address) === address(other.address)) reasons.push('ADDRESS');
  if (sameId) return { level: 'CERTAIN', reasons };
  if (sameName && sameYear) return { level: 'POSSIBLE', reasons };
  if (sameName && (yearUnknown || nearYear)) return { level: 'NEAR', reasons };
  return null;
}

@Injectable()
export class WardMatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly caseAccess?: CaseChildAccessService,
  ) {}

  async matches(scope: Scope, actorId: string, id: string): Promise<SubjectMatch[]> {
    const { row, subjects } = await this.readable(scope, id);
    if (subjects.length === 0) return [];
    const found = await this.matchesIgnoringConclusions(scope, actorId, row, subjects);
    const conclusions = await this.prisma.wardSubjectMatchConclusion.findMany({ where: { assignmentId: row.id } });
    const verdict = new Map(conclusions.map((c) => [`${c.subjectPosition}|${c.otherSource}|${c.otherRecordId}`, c]));
    const since = new Map(subjects.map((s) => [s.position, s.createdAt]));
    // One line per (subject, record): the strongest level wins.
    const best = new Map<string, SubjectMatch>();
    for (const { otherSince, ...match } of found) {
      const key = `${match.subjectPosition}|${match.source}|${match.recordId}`;
      const conclusion = verdict.get(key);
      // A conclusion is about the people as they were: the request's subjects are rewritten on every edit (and the
      // other request's too), so a subject row newer than the conclusion is another person until concluded again.
      const current =
        conclusion &&
        conclusion.decidedAt >= (since.get(match.subjectPosition) ?? new Date(8.64e15)) &&
        (!otherSince || conclusion.decidedAt >= otherSince);
      const said = current ? conclusion.samePerson : undefined;
      if (said === false) continue;
      const kept = best.get(key);
      if (!kept || RANK[match.level] < RANK[kept.level]) best.set(key, { ...match, concludedSame: said === true, concluded: said !== undefined });
    }
    return [...best.values()].sort(
      (a, b) => a.subjectPosition - b.subjectPosition || RANK[a.level] - RANK[b.level] || a.source.localeCompare(b.source) || (a.code ?? '').localeCompare(b.code ?? ''),
    );
  }

  /**
   * The matches of the same identity number nobody has concluded on yet: what stops an approval (as a petition's
   * "high" duplicates stop its save). Concluded "the same person" or "not the same" both count as reviewed.
   */
  async unreviewedCertain(scope: Scope, actorId: string, id: string): Promise<SubjectMatch[]> {
    return (await this.matches(scope, actorId, id)).filter((m) => m.level === 'CERTAIN' && !m.concluded);
  }

  /** The conclusions in force on the request ("the same person" ones; "not the same" are counted apart), for the audit. */
  async reviewedForApproval(scope: Scope, actorId: string, id: string) {
    const listed = await this.matches(scope, actorId, id);
    const { row } = await this.readable(scope, id);
    const notSame = await this.prisma.wardSubjectMatchConclusion.count({ where: { assignmentId: row.id, samePerson: false } });
    return {
      samePerson: listed.filter((m) => m.concludedSame).map((m) => ({ subjectPosition: m.subjectPosition, source: m.source, recordId: m.recordId, level: m.level })),
      notSamePerson: notSame,
      shown: listed.length,
    };
  }

  /**
   * The other record of one match, read only, for the reviewer to compare: only a pair the person sees as a match
   * now (the sources' own read rules are part of finding it), otherwise 404 as if it did not exist.
   */
  async preview(scope: Scope, actorId: string, id: string, source: WardMatchSource, recordId: string): Promise<MatchPreview> {
    const { row, subjects } = await this.readable(scope, id);
    const visible = await this.matchesIgnoringConclusions(scope, actorId, row, subjects);
    if (!visible.some((m) => m.source === source && m.recordId === recordId)) throw new NotFoundException(wardBody(WARD_ALERT_ERROR.MATCH_NOT_FOUND));
    const day = (d: Date | null | undefined) => (d ? new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10) : null);
    if (source === 'WARD_ASSIGNMENT') {
      const r = await this.prisma.wardAssignment.findUniqueOrThrow({
        where: { id: recordId },
        select: {
          code: true, status: true, submittedAt: true, createdAt: true, summary: true, assignedTeam: { select: { name: true } },
          subjects: { orderBy: { position: 'asc' }, select: { fullName: true, birthYear: true, idNumber: true, address: true } },
        },
      });
      return {
        source, recordId, code: r.code, unitName: r.assignedTeam.name, status: r.status, day: day(r.submittedAt ?? r.createdAt), summary: r.summary,
        people: r.subjects.map((x) => ({ name: x.fullName, birthYear: x.birthYear, idNumber: x.idNumber, address: x.address })),
      };
    }
    if (source === 'CASE') {
      const r = await this.prisma.case.findUniqueOrThrow({
        where: { id: recordId },
        select: { name: true, status: true, createdAt: true, assignedTeam: { select: { name: true } }, subjects: { where: { deletedAt: null }, select: { fullName: true, dateOfBirth: true, idNumber: true, address: true } } },
      });
      return {
        source, recordId, code: null, unitName: r.assignedTeam?.name ?? null, status: r.status, day: day(r.createdAt), summary: r.name,
        people: r.subjects.map((x) => ({ name: x.fullName, birthYear: x.dateOfBirth ? vnYearOf(x.dateOfBirth) : null, idNumber: x.idNumber, address: x.address })),
      };
    }
    const r = await this.prisma.petition.findUniqueOrThrow({
      where: { id: recordId },
      select: { stt: true, status: true, receivedDate: true, summary: true, suspectedPerson: true, assignedTeam: { select: { name: true } } },
    });
    return {
      source, recordId, code: r.stt, unitName: r.assignedTeam?.name ?? null, status: r.status, day: day(r.receivedDate), summary: r.summary,
      people: r.suspectedPerson ? [{ name: r.suspectedPerson, birthYear: null, idNumber: null, address: null }] : [],
    };
  }

  /**
   * A reviewer's conclusion on one pair: the review reach on the request, and the pair must be a match the person sees
   * now (nobody records a conclusion about a record they cannot see). Written again = changed (one row per pair).
   */
  async conclude(
    scope: Scope,
    actorId: string,
    id: string,
    input: { subjectPosition: number; otherSource: WardMatchSource; otherRecordId: string; samePerson: boolean },
  ) {
    if (typeof input.samePerson !== 'boolean') throw new BadRequestException(wardBody(WARD_ALERT_ERROR.CONCLUSION_INVALID));
    const { row, subjects } = await this.readable(scope, id);
    if (!recordInActionScope(reachOf(row), scope, 'WardAssignment', 'review')) throw new ForbiddenException(wardBody(WARD_ERROR.FORBIDDEN));
    if (!subjects.some((s) => s.position === input.subjectPosition)) throw new BadRequestException(wardBody(WARD_ALERT_ERROR.SUBJECT_NOT_FOUND));
    // Seen now, before the conclusion hides it: the pair as listed (a pair concluded "not the same" is looked up again
    // without the conclusions, so that it can be turned back to "the same").
    const visible = await this.matchesIgnoringConclusions(scope, actorId, row, subjects);
    if (!visible.some((m) => m.subjectPosition === input.subjectPosition && m.source === input.otherSource && m.recordId === input.otherRecordId)) {
      throw new NotFoundException(wardBody(WARD_ALERT_ERROR.MATCH_NOT_FOUND));
    }
    const key = { assignmentId: row.id, subjectPosition: input.subjectPosition, otherSource: input.otherSource, otherRecordId: input.otherRecordId };
    const seen = subjects.find((x) => x.position === input.subjectPosition)!;
    const seenOther = visible.find((m) => m.subjectPosition === input.subjectPosition && m.source === input.otherSource && m.recordId === input.otherRecordId)?.otherSince;
    return this.prisma.$transaction(async (tx) => {
      // The requests concluded about, locked for share (in id order) for the rest of the transaction: an edit of their
      // subjects or a delete with data (which lock them for update) either waits for this conclusion or has already
      // happened and is seen below. Never a conclusion about a person replaced meanwhile, nor one left behind a deleted request.
      const ids = [...new Set([row.id, ...(input.otherSource === 'WARD_ASSIGNMENT' ? [input.otherRecordId] : [])])].sort();
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ward_assignments" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`;
      if (!locked.some((l) => l.id === row.id)) throw new NotFoundException(wardBody(WARD_ERROR.NOT_FOUND));
      if (locked.length !== ids.length) throw new NotFoundException(wardBody(WARD_ALERT_ERROR.MATCH_NOT_FOUND));
      const now = await tx.wardAssignmentSubject.findFirst({ where: { assignmentId: row.id, position: input.subjectPosition }, select: { createdAt: true } });
      if (!now || now.createdAt.getTime() !== seen.createdAt.getTime()) throw new ConflictException(wardBody(WARD_ERROR.CONFLICT));
      if (input.otherSource === 'WARD_ASSIGNMENT' && seenOther) {
        const other = await tx.wardAssignmentSubject.findFirst({ where: { assignmentId: input.otherRecordId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
        if (!other || other.createdAt.getTime() > seenOther.getTime()) throw new ConflictException(wardBody(WARD_ERROR.CONFLICT));
      }
      // A case subject or a petition changed since it was shown: the conclusion would be about what it said before.
      if (input.otherSource !== 'WARD_ASSIGNMENT' && seenOther && (await this.changedSince(tx, input.otherSource, input.otherRecordId, seenOther))) {
        throw new ConflictException(wardBody(WARD_ERROR.CONFLICT));
      }
      const saved = await tx.wardSubjectMatchConclusion.upsert({
        where: { assignmentId_subjectPosition_otherSource_otherRecordId: key },
        create: { ...key, samePerson: input.samePerson, decidedById: actorId },
        update: { samePerson: input.samePerson, decidedById: actorId, decidedAt: new Date() },
      });
      await this.audit.log(
        {
          userId: actorId,
          action: WARD_ALERT_AUDIT.MATCH_CONCLUDED,
          subject: 'WardAssignment',
          subjectId: row.id,
          metadata: { subjectPosition: input.subjectPosition, otherSource: input.otherSource, otherRecordId: input.otherRecordId, samePerson: input.samePerson },
        },
        tx,
      );
      return saved;
    });
  }

  /** Whether the other record (its case subjects, the petition) changed after `since`. */
  private async changedSince(tx: Prisma.TransactionClient, source: WardMatchSource, recordId: string, since: Date): Promise<boolean> {
    if (source === 'CASE') {
      const latest = await tx.subject.findFirst({ where: { caseId: recordId }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } });
      return !latest || latest.updatedAt.getTime() > since.getTime();
    }
    if (source === 'PETITION') {
      const p = await tx.petition.findUnique({ where: { id: recordId }, select: { updatedAt: true } });
      return !p || p.updatedAt.getTime() > since.getTime();
    }
    return false;
  }

  private async matchesIgnoringConclusions(scope: Scope, actorId: string, row: { id: string; assignedTeamId: string; enteredById: string }, subjects: SubjectRow[]): Promise<Found[]> {
    if (subjects.length === 0) return [];
    const crossReach = recordInActionScope(reachOf(row), scope, 'WardAssignment', 'matchSubjects');
    return [
      ...(await this.wardMatches(scope, row, subjects)),
      ...(crossReach ? await this.caseMatches(actorId, subjects) : []),
      ...(crossReach ? await this.petitionMatches(scope, actorId, subjects) : []),
    ];
  }

  /** The request, if the person may open it (404 otherwise, as everywhere in the module), and its subjects. */
  private async readable(scope: Scope, id: string) {
    const row = await this.prisma.wardAssignment.findUnique({ where: { id }, select: { id: true, assignedTeamId: true, enteredById: true, code: true } });
    if (!row || !wardReadable(row, scope)) {
      throw new NotFoundException(wardBody(WARD_ERROR.NOT_FOUND));
    }
    const subjects = await this.prisma.wardAssignmentSubject.findMany({
      where: { assignmentId: row.id },
      select: { position: true, fullNameNorm: true, birthYear: true, idNumberNorm: true, address: true, createdAt: true },
      orderBy: { position: 'asc' },
    });
    return { row, subjects };
  }

  /** Other ward requests: readable, and of the same unit or within the `matchSubjects` reach. */
  private async wardMatches(scope: Scope, row: { id: string; assignedTeamId: string }, subjects: SubjectRow[]): Promise<Found[]> {
    const read = wardReadConditions(scope);
    if (read !== null && read.length === 0) return [];
    const cross = actionConditions(scope, 'WardAssignment', 'matchSubjects');
    const reach: Prisma.WardAssignmentWhereInput = {
      AND: [
        ...(read ? [{ OR: read as Prisma.WardAssignmentWhereInput[] }] : []),
        ...(cross === null ? [] : [{ OR: [{ assignedTeamId: row.assignedTeamId }, ...(cross as Prisma.WardAssignmentWhereInput[])] }]),
      ],
    };
    const select = {
      fullName: true,
      fullNameNorm: true,
      birthYear: true,
      idNumberNorm: true,
      address: true,
      createdAt: true,
      assignment: { select: { id: true, code: true, assignedTeam: { select: { name: true } } } },
    } as const;
    const ids = [...new Set(subjects.map((s) => s.idNumberNorm).filter((v): v is string => !!v))];
    const names = [...new Set(subjects.map((s) => s.fullNameNorm).filter((v) => v.length > 0))];
    // The same identity number: every one of them, no limit (an index on the number; a handful of rows). A limit
    // shared with the name matches would let many namesakes push out the one match that stops an approval.
    const byId =
      ids.length === 0 ? [] : await this.prisma.wardAssignmentSubject.findMany({ where: { assignmentId: { not: row.id }, idNumberNorm: { in: ids }, assignment: reach }, select });
    // The same name (whatever the birth year: judged below), newest first, at most so many per subject.
    const byName =
      names.length === 0
        ? []
        : await this.prisma.wardAssignmentSubject.findMany({
            where: { assignmentId: { not: row.id }, fullNameNorm: { in: names }, assignment: reach },
            select,
            orderBy: { createdAt: 'desc' },
            take: MATCHES_MAX * subjects.length,
          });
    const out: Found[] = [];
    for (const s of subjects) {
      for (const o of [...byId, ...byName]) {
        const judged = judge(s, { nameNorm: o.fullNameNorm, birthYear: o.birthYear, idNumberNorm: o.idNumberNorm, address: o.address });
        if (!judged) continue;
        out.push({
          subjectPosition: s.position,
          level: judged.level,
          reasons: judged.reasons,
          concluded: false,
          source: 'WARD_ASSIGNMENT',
          recordId: o.assignment.id,
          code: o.assignment.code,
          unitName: o.assignment.assignedTeam.name,
          name: o.fullName,
          concludedSame: false,
          otherSince: o.createdAt,
        });
      }
    }
    return out;
  }

  /**
   * The subjects of cases the person may read: the case read rule of the governance core (scope, sensitivity,
   * representation, `read:Case`) and the permission to read subjects. Without either: none (never "some, hidden").
   */
  private async caseMatches(actorId: string, subjects: SubjectRow[]): Promise<Found[]> {
    if (!this.caseAccess) return [];
    let caseWhere: Prisma.CaseWhereInput;
    try {
      await this.caseAccess.entity('Subject', 'read', actorId);
      caseWhere = (await this.caseAccess.listWhere(actorId)) as Prisma.CaseWhereInput;
    } catch (error) {
      if (error instanceof ForbiddenException) return [];
      throw error;
    }
    const ids = subjects.map((s) => s.idNumberNorm).filter((v): v is string => !!v);
    const named = subjects.filter((s) => s.fullNameNorm.length > 0);
    if (ids.length === 0 && named.length === 0) return [];
    // By identity number: the digits of the stored number (written with spaces or dashes in old rows). A short list of
    // candidates by the comparison alone; nothing of it leaves this function unless the case rule below keeps it.
    const byId =
      ids.length === 0
        ? []
        : await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT s.id FROM "subjects" s
            WHERE s."deletedAt" IS NULL AND s."idNumber" IS NOT NULL AND regexp_replace(s."idNumber", '\\D', '', 'g') IN (${Prisma.join(ids)})`;
    // No limit here: a limit before the case rule would let records the person cannot read push readable ones out
    // (and the answer would then depend on them). The same identity number is a handful of rows.
    // By name and birth year, the case rule in the same query: the name's shadow column; a row whose shadow is not
    // filled yet by its birth year alone, its name compared below with the normalisation of the request's subjects.
    // By name (the shadow column; a row whose shadow is not filled yet, by its birth year near or equal), any birth
    // year, judged below: the "near" level needs the rows with no or another year too.
    const byName: Prisma.SubjectWhereInput[] = named.map((s) => ({
      OR: [
        { fullNameBd: ' ' + s.fullNameNorm },
        ...(s.birthYear !== null ? [{ fullNameBd: null, dateOfBirth: { gte: vnYearStart(s.birthYear - 1), lt: vnYearStart(s.birthYear + 2) } }] : []),
      ],
    }));
    const select = {
      fullName: true, idNumber: true, dateOfBirth: true, address: true, updatedAt: true,
      case: { select: { id: true, name: true, assignedTeam: { select: { name: true } } } },
    } as const;
    // The same identity number apart, no limit: many namesakes must not push it out.
    const certain =
      byId.length === 0 ? [] : await this.prisma.subject.findMany({ where: { AND: [{ deletedAt: null }, { case: caseWhere }, { id: { in: byId.map((c) => c.id) } }] }, select });
    const rows =
      byName.length === 0 ? [] : await this.prisma.subject.findMany({ where: { AND: [{ deletedAt: null }, { case: caseWhere }, { OR: byName }] }, select, take: CASE_CANDIDATES_MAX });
    const out: Found[] = [];
    for (const s of subjects) {
      for (const o of [...certain, ...rows]) {
        const judged = judge(s, { nameNorm: boDauTiengViet(o.fullName), birthYear: o.dateOfBirth ? vnYearOf(o.dateOfBirth) : null, idNumberNorm: digitsOf(o.idNumber) || null, address: o.address });
        if (!judged) continue;
        out.push({
          subjectPosition: s.position, level: judged.level, reasons: judged.reasons, source: 'CASE', recordId: o.case.id, code: null,
          unitName: o.case.assignedTeam?.name ?? null, name: o.fullName, concludedSame: false, concluded: false, otherSince: o.updatedAt,
        });
      }
    }
    return out;
  }

  /** Petitions the person may read (`read:Petition` and the petition scope), POSSIBLE by the suspect's name. */
  private async petitionMatches(scope: Scope, actorId: string, subjects: SubjectRow[]): Promise<Found[]> {
    const holds = await this.prisma.user.count({ where: { AND: [{ id: actorId }, userHoldingPermission('read', 'Petition')] } });
    if (holds === 0) return [];
    const named = subjects.filter((s) => s.fullNameNorm.replace(/ /g, '').length >= FREE_TEXT_NAME_MIN);
    if (named.length === 0) return [];
    const out: Found[] = [];
    const filter = buildPetitionScopeFilter(scope, 'read') as Prisma.PetitionWhereInput | null;
    for (const s of named) {
      // The petition scope in the query itself (trigram index on the shadow column); whole words checked here.
      const words = new RegExp(wordsPattern(s.fullNameNorm));
      const rows = await this.prisma.petition.findMany({
        where: { AND: [{ deletedAt: null }, { suspectedPersonBd: { contains: s.fullNameNorm } }, ...(filter ? [filter] : [])] },
        select: { id: true, stt: true, suspectedPerson: true, suspectedPersonBd: true, updatedAt: true, assignedTeam: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: CASE_CANDIDATES_MAX,
      });
      for (const p of rows.filter((r) => words.test(r.suspectedPersonBd ?? '')).slice(0, MATCHES_MAX)) {
        out.push({
          subjectPosition: s.position, level: 'POSSIBLE', reasons: ['NAME_IN_TEXT'], source: 'PETITION', recordId: p.id, code: p.stt,
          unitName: p.assignedTeam?.name ?? null, name: p.suspectedPerson ?? '', concludedSame: false, concluded: false, otherSince: p.updatedAt,
        });
      }
    }
    return out;
  }
}
