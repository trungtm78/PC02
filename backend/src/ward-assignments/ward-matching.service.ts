import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, type WardMatchSource } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { userHoldingPermission } from '../authz/enforcement';
import { CaseChildAccessService } from '../case-child-access/case-child-access.service';
import { boDauTiengViet } from '../common/utils/chuan-hoa-ten.util';
import { actionConditions, buildPetitionScopeFilter, recordInActionScope, recordReadable, scopeConditions } from '../common/utils/scope-filter.util';
import { PrismaService } from '../prisma/prisma.service';
import { WARD_ERROR } from './ward-assignment.codes';
import { WARD_ALERT_AUDIT, WARD_ALERT_ERROR } from './ward-alerts.codes';
import { wardBody } from './ward-errors';
import { reachOf } from './ward-locks';

/**
 * Subject matching of a ward assignment request ("Dò trùng đối tượng", plan R4, A5, C3, C4).
 *
 * Levels: CERTAIN = the same identity number (digits only); POSSIBLE = the same normalised name and the same birth
 * year. Sources and what each can say:
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

export type MatchLevel = 'CERTAIN' | 'POSSIBLE';

export interface SubjectMatch {
  subjectPosition: number;
  level: MatchLevel;
  source: WardMatchSource;
  recordId: string;
  code: string | null;
  unitName: string | null;
  /** The name as written in the other record. */
  name: string;
  /** A reviewer concluded "the same person" for this pair (pairs concluded "not the same" are not listed). */
  concludedSame: boolean;
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
/** A regular expression that matches `name` as whole words (the name is letters, digits and spaces only). */
const wordsPattern = (name: string) => `(^|[^a-z0-9])${name.replace(/[^a-z0-9 ]/g, '').replace(/ +/g, ' ')}($|[^a-z0-9])`;

interface SubjectRow {
  position: number;
  fullNameNorm: string;
  birthYear: number | null;
  idNumberNorm: string | null;
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
    const verdict = new Map(conclusions.map((c) => [`${c.subjectPosition}|${c.otherSource}|${c.otherRecordId}`, c.samePerson]));
    // One line per (subject, record): the strongest level wins.
    const best = new Map<string, SubjectMatch>();
    for (const match of found) {
      const key = `${match.subjectPosition}|${match.source}|${match.recordId}`;
      const said = verdict.get(key);
      if (said === false) continue;
      const kept = best.get(key);
      if (!kept || (kept.level === 'POSSIBLE' && match.level === 'CERTAIN')) best.set(key, { ...match, concludedSame: said === true });
    }
    return [...best.values()].sort(
      (a, b) => a.subjectPosition - b.subjectPosition || (a.level === b.level ? 0 : a.level === 'CERTAIN' ? -1 : 1) || a.source.localeCompare(b.source) || (a.code ?? '').localeCompare(b.code ?? ''),
    );
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
    return this.prisma.$transaction(async (tx) => {
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

  private async matchesIgnoringConclusions(scope: Scope, actorId: string, row: { id: string; assignedTeamId: string; enteredById: string }, subjects: SubjectRow[]): Promise<SubjectMatch[]> {
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
    const row = await this.prisma.wardAssignment.findUnique({ where: { id }, select: { id: true, assignedTeamId: true, enteredById: true } });
    if (!row || !recordReadable('WardAssignment', { assignedTeamId: row.assignedTeamId, enteredById: row.enteredById }, scope)) {
      throw new NotFoundException(wardBody(WARD_ERROR.NOT_FOUND));
    }
    const subjects = await this.prisma.wardAssignmentSubject.findMany({
      where: { assignmentId: row.id },
      select: { position: true, fullNameNorm: true, birthYear: true, idNumberNorm: true },
      orderBy: { position: 'asc' },
    });
    return { row, subjects };
  }

  /** Other ward requests: readable, and of the same unit or within the `matchSubjects` reach. */
  private async wardMatches(scope: Scope, row: { id: string; assignedTeamId: string }, subjects: SubjectRow[]): Promise<SubjectMatch[]> {
    const read = scopeConditions(scope, 'read', 'WardAssignment');
    if (read !== null && read.length === 0) return [];
    const cross = actionConditions(scope, 'WardAssignment', 'matchSubjects');
    const reach: Prisma.WardAssignmentWhereInput = {
      AND: [
        ...(read ? [{ OR: read as Prisma.WardAssignmentWhereInput[] }] : []),
        ...(cross === null ? [] : [{ OR: [{ assignedTeamId: row.assignedTeamId }, ...(cross as Prisma.WardAssignmentWhereInput[])] }]),
      ],
    };
    const keys = subjects.flatMap((s): Prisma.WardAssignmentSubjectWhereInput[] => [
      ...(s.idNumberNorm ? [{ idNumberNorm: s.idNumberNorm }] : []),
      ...(s.birthYear !== null ? [{ fullNameNorm: s.fullNameNorm, birthYear: s.birthYear }] : []),
    ]);
    if (keys.length === 0) return [];
    const others = await this.prisma.wardAssignmentSubject.findMany({
      where: { assignmentId: { not: row.id }, OR: keys, assignment: reach },
      select: {
        fullName: true,
        fullNameNorm: true,
        birthYear: true,
        idNumberNorm: true,
        assignment: { select: { id: true, code: true, assignedTeam: { select: { name: true } } } },
      },
      take: MATCHES_MAX * subjects.length,
    });
    const out: SubjectMatch[] = [];
    for (const s of subjects) {
      for (const o of others) {
        const level: MatchLevel | null =
          s.idNumberNorm && o.idNumberNorm === s.idNumberNorm ? 'CERTAIN' : s.birthYear !== null && o.birthYear === s.birthYear && o.fullNameNorm === s.fullNameNorm ? 'POSSIBLE' : null;
        if (!level) continue;
        out.push({
          subjectPosition: s.position,
          level,
          source: 'WARD_ASSIGNMENT',
          recordId: o.assignment.id,
          code: o.assignment.code,
          unitName: o.assignment.assignedTeam.name,
          name: o.fullName,
          concludedSame: false,
        });
      }
    }
    return out;
  }

  /**
   * The subjects of cases the person may read: the case read rule of the governance core (scope, sensitivity,
   * representation, `read:Case`) and the permission to read subjects. Without either: none (never "some, hidden").
   */
  private async caseMatches(actorId: string, subjects: SubjectRow[]): Promise<SubjectMatch[]> {
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
    const named = subjects.filter((s) => s.birthYear !== null);
    if (ids.length === 0 && named.length === 0) return [];
    // By identity number: the digits of the stored number (written with spaces or dashes in old rows). A short list of
    // candidates by the comparison alone; nothing of it leaves this function unless the case rule below keeps it.
    const byId =
      ids.length === 0
        ? []
        : await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT s.id FROM "subjects" s
            WHERE s."deletedAt" IS NULL AND s."idNumber" IS NOT NULL AND regexp_replace(s."idNumber", '\\D', '', 'g') IN (${Prisma.join(ids)})
            LIMIT ${CASE_CANDIDATES_MAX}`;
    // By name and birth year, the case rule in the same query: the name's shadow column; a row whose shadow is not
    // filled yet by its birth year alone, its name compared below with the normalisation of the request's subjects.
    const byName: Prisma.SubjectWhereInput[] = named.map((s) => ({
      OR: [{ fullNameBd: ' ' + s.fullNameNorm }, { fullNameBd: null }],
      dateOfBirth: { gte: vnYearStart(s.birthYear as number), lt: vnYearStart((s.birthYear as number) + 1) },
    }));
    const rows = await this.prisma.subject.findMany({
      where: { AND: [{ deletedAt: null }, { case: caseWhere }, { OR: [...(byId.length > 0 ? [{ id: { in: byId.map((c) => c.id) } }] : []), ...byName] }] },
      select: { fullName: true, idNumber: true, dateOfBirth: true, case: { select: { id: true, name: true, assignedTeam: { select: { name: true } } } } },
      take: CASE_CANDIDATES_MAX,
    });
    const out: SubjectMatch[] = [];
    for (const s of subjects) {
      for (const o of rows) {
        const year = o.dateOfBirth ? vnYearOf(o.dateOfBirth) : null;
        const sameName = boDauTiengViet(o.fullName) === s.fullNameNorm;
        const level: MatchLevel | null =
          s.idNumberNorm && digitsOf(o.idNumber) === s.idNumberNorm ? 'CERTAIN' : s.birthYear !== null && year === s.birthYear && sameName ? 'POSSIBLE' : null;
        if (!level) continue;
        out.push({ subjectPosition: s.position, level, source: 'CASE', recordId: o.case.id, code: null, unitName: o.case.assignedTeam?.name ?? null, name: o.fullName, concludedSame: false });
      }
    }
    return out;
  }

  /** Petitions the person may read (`read:Petition` and the petition scope), POSSIBLE by the suspect's name. */
  private async petitionMatches(scope: Scope, actorId: string, subjects: SubjectRow[]): Promise<SubjectMatch[]> {
    const holds = await this.prisma.user.count({ where: { AND: [{ id: actorId }, userHoldingPermission('read', 'Petition')] } });
    if (holds === 0) return [];
    const named = subjects.filter((s) => s.fullNameNorm.replace(/ /g, '').length >= FREE_TEXT_NAME_MIN);
    if (named.length === 0) return [];
    const out: SubjectMatch[] = [];
    const filter = buildPetitionScopeFilter(scope, 'read') as Prisma.PetitionWhereInput | null;
    for (const s of named) {
      // The petition scope in the query itself (trigram index on the shadow column); whole words checked here.
      const words = new RegExp(wordsPattern(s.fullNameNorm));
      const rows = await this.prisma.petition.findMany({
        where: { AND: [{ deletedAt: null }, { suspectedPersonBd: { contains: s.fullNameNorm } }, ...(filter ? [filter] : [])] },
        select: { id: true, stt: true, suspectedPerson: true, suspectedPersonBd: true, assignedTeam: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: CASE_CANDIDATES_MAX,
      });
      for (const p of rows.filter((r) => words.test(r.suspectedPersonBd ?? '')).slice(0, MATCHES_MAX)) {
        out.push({ subjectPosition: s.position, level: 'POSSIBLE', source: 'PETITION', recordId: p.id, code: p.stt, unitName: p.assignedTeam?.name ?? null, name: p.suspectedPerson ?? '', concludedSame: false });
      }
    }
    return out;
  }
}
