import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { wardReadConditions } from './ward-locks';
import { PrismaService } from '../prisma/prisma.service';
import { alertOf, firstSubmittedWhere } from './ward-alerts';
import { WARD_ALERT_ERROR } from './ward-alerts.codes';
import { wardBody } from './ward-errors';
import { decisionInForce, vnDay } from './ward-review.rules';

/**
 * Statistics of ward assignment requests (plan section 7, R1, R2), within the person's read scope.
 *
 * Counted: requests submitted at least once ("Lần trình" ≥ 1), not archived. The period is the request's FIRST
 * submission, on the Viet Nam calendar. Every count is the count of the list with the same filters (`status`,
 * `alert`, `teamId`, `crimeId`, `caseType`), judged on the same "today".
 *
 *   firstPassRate   approved at their first submission / approved;
 *   onTimeRate      completed on or before the deadline / completed;
 *   avgSubmissions  mean "Lần trình";
 *   avgReviewDays   per decided round, days from its submission to PC02's decision in force (mean, one decimal).
 * A rate with nothing to divide by is null (shown "—"), never 0.
 */

export interface WardStatsQuery {
  from?: string;
  to?: string;
  teamId?: string;
  crimeId?: string;
  caseType?: 'INCIDENT' | 'CASE';
}

const DAY_MS = 86_400_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A period bound `YYYY-MM-DD` as the calendar day, or a 400 with a code; nothing given, no bound. */
export function periodDay(value: string | undefined): Date | null {
  if (!value) return null;
  const day = new Date(`${value}T00:00:00.000Z`);
  if (!DAY.test(value) || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== value) throw new BadRequestException(wardBody(WARD_ALERT_ERROR.STATS_RANGE_INVALID));
  return day;
}

const rate = (num: number, den: number): number | null => (den === 0 ? null : Math.round((num / den) * 1000) / 10);
const mean = (values: number[], digits = 1): number | null => (values.length === 0 ? null : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10 ** digits) / 10 ** digits);

interface Tally {
  total: number;
  new: number;
  reassign: number;
  pending: number;
  returned: number;
  overdue: number;
  approved: number;
  firstPass: number;
  completed: number;
  onTime: number;
  submissions: number[];
  reviewDays: number[];
}

const emptyTally = (): Tally => ({ total: 0, new: 0, reassign: 0, pending: 0, returned: 0, overdue: 0, approved: 0, firstPass: 0, completed: 0, onTime: 0, submissions: [], reviewDays: [] });

@Injectable()
export class WardStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(scope: DataScope | null | undefined, query: WardStatsQuery, now: Date = new Date()) {
    const from = periodDay(query.from);
    const to = periodDay(query.to);
    if (from && to && from > to) throw new BadRequestException(wardBody(WARD_ALERT_ERROR.STATS_RANGE_INVALID));
    const today = vnDay(now);
    const reach = wardReadConditions(scope);
    const rows =
      reach !== null && reach.length === 0
        ? []
        : await this.prisma.wardAssignment.findMany({
            where: {
              AND: [
                ...(reach ? [{ OR: reach as Prisma.WardAssignmentWhereInput[] }] : []),
                { archivedAt: null, submissionCount: { gt: 0 } },
                firstSubmittedWhere(from, to),
                ...(query.teamId ? [{ assignedTeamId: query.teamId }] : []),
                ...(query.crimeId ? [{ crimeId: query.crimeId }] : []),
                ...(query.caseType ? [{ caseType: query.caseType }] : []),
              ],
            },
            select: {
              id: true,
              status: true,
              kind: true,
              assignedTeamId: true,
              crimeId: true,
              submissionCount: true,
              resultDueOn: true,
              completedOn: true,
              assignedTeam: { select: { name: true } },
              crime: { select: { name: true } },
              rounds: {
                where: { status: { not: 'WITHDRAWN' } },
                select: { submittedAt: true, status: true, decisions: { select: { id: true, kind: true, decidedAt: true, revokedAt: true } } },
              },
            },
          });

    const cards = emptyTally();
    const byUnit = new Map<string, { name: string; tally: Tally }>();
    const byCrime = new Map<string, { crimeId: string | null; name: string | null; total: number; new: number; reassign: number }>();
    const byMonth = new Map<string, { new: number; reassign: number }>();

    for (const row of rows) {
      const first = row.rounds.reduce<Date | null>((min, r) => (!min || r.submittedAt < min ? r.submittedAt : min), null);
      if (!first) continue;
      const firstDay = vnDay(first);

      const reviewDays = row.rounds.flatMap((r) => {
        const inForce = r.status === 'DECIDED' ? decisionInForce(r.decisions) : null;
        return inForce ? [(inForce.decidedAt.getTime() - r.submittedAt.getTime()) / DAY_MS] : [];
      });
      const unit = byUnit.get(row.assignedTeamId) ?? { name: row.assignedTeam.name, tally: emptyTally() };
      byUnit.set(row.assignedTeamId, unit);
      for (const tally of [cards, unit.tally]) this.add(tally, row, today, reviewDays);

      const crimeKey = row.crimeId ?? '';
      const crime = byCrime.get(crimeKey) ?? { crimeId: row.crimeId, name: row.crime?.name ?? null, total: 0, new: 0, reassign: 0 };
      crime.total += 1;
      if (row.kind === 'NEW') crime.new += 1;
      else crime.reassign += 1;
      byCrime.set(crimeKey, crime);

      const month = firstDay.toISOString().slice(0, 7);
      const m = byMonth.get(month) ?? { new: 0, reassign: 0 };
      if (row.kind === 'NEW') m.new += 1;
      else m.reassign += 1;
      byMonth.set(month, m);
    }

    return {
      cards: {
        total: cards.total,
        new: cards.new,
        reassign: cards.reassign,
        pending: cards.pending,
        returned: cards.returned,
        overdue: cards.overdue,
        onTimeRate: rate(cards.onTime, cards.completed),
        avgSubmissions: mean(cards.submissions, 2),
        firstPassRate: rate(cards.firstPass, cards.approved),
        avgReviewDays: mean(cards.reviewDays),
      },
      byMonth: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, m]) => ({ month, ...m })),
      byUnit: [...byUnit.entries()]
        .map(([teamId, { name, tally }]) => ({
          teamId,
          name,
          total: tally.total,
          new: tally.new,
          reassign: tally.reassign,
          pending: tally.pending,
          returned: tally.returned,
          overdue: tally.overdue,
          onTimeRate: rate(tally.onTime, tally.completed),
          avgSubmissions: mean(tally.submissions, 2),
          firstPassRate: rate(tally.firstPass, tally.approved),
          avgReviewDays: mean(tally.reviewDays),
        }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
      byCrime: [...byCrime.values()].sort((a, b) => b.total - a.total || (a.name ?? '').localeCompare(b.name ?? '')),
    };
  }

  private add(
    tally: Tally,
    row: { status: string; kind: string; submissionCount: number; resultDueOn: Date | null; completedOn: Date | null },
    today: Date,
    reviewDays: number[],
  ) {
    tally.total += 1;
    if (row.kind === 'NEW') tally.new += 1;
    else tally.reassign += 1;
    if (row.status === 'SUBMITTED') tally.pending += 1;
    if (row.status === 'RETURNED') tally.returned += 1;
    if (alertOf(row, today).level === 'OVERDUE') tally.overdue += 1;
    if (row.status === 'APPROVED') {
      tally.approved += 1;
      if (row.submissionCount === 1) tally.firstPass += 1;
      // A completion without a deadline says nothing about being on time: left out of both sides of the rate.
      if (row.completedOn && row.resultDueOn) {
        tally.completed += 1;
        if (row.completedOn.getTime() <= row.resultDueOn.getTime()) tally.onTime += 1;
      }
    }
    tally.submissions.push(row.submissionCount);
    tally.reviewDays.push(...reviewDays);
  }
}
