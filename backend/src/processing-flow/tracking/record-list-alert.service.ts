import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { SETTINGS_KEY } from '../../common/constants/settings-keys.constants';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ALERT_SOURCE, type AlertSource } from '../contract/processing-codes';
import { bandAt, deadlineDayBand, deadlineDayWhere, remainingDays, type Thresholds } from '../engine/bands';
import { civilDayOf, endOfCivilDay } from '../engine/civil-day';
import type { Band } from '../engine/types';
import type { RecordKind } from '../gateway/record-snapshot';
import { clocklessStatuses, COUNTED_STEP_STATUSES } from '../records/record-alert';
import { bandConditions } from './band-conditions';

/** The switch that lets a record carry the steps of a flow: the alert column of the lists exists only while it is on. */
const RECORDS_SWITCH = 'processing_flow_records';

/** The value of `sortBy` that orders a list by its alert. */
export const ALERT_SORT = 'alert';

const DEFAULT_WARN_DAYS = 7;
const MAX_WARN_DAYS = 3_650;

/** The alert of one record on a list. */
export interface RecordAlert {
  /** `FLOW`: from the steps of the record's flow. `RECORD_DEADLINE`: the record has no flow; from its own deadline. */
  source: AlertSource;
  band: Band;
  /** Civil days left (Vietnam); 0 on the due day, negative after it. */
  remainingDays: number;
  /** The step the colour comes from; `null` for a record with no flow. */
  stepName: string | null;
  /** The instant after which it is overdue. */
  dueAt: string;
}

const FACTS = {
  id: true,
  status: true,
  deadline: true,
  procFlow: {
    select: {
      alertDueAt: true,
      alertRedFrom: true,
      alertYellowFrom: true,
      alertGreenFrom: true,
      steps: {
        where: { status: { in: [...COUNTED_STEP_STATUSES] } },
        orderBy: { order: 'asc' },
        select: { internalDueAt: true, redFrom: true, yellowFrom: true, greenFrom: true, step: { select: { name: true } } },
      },
    },
  },
} satisfies Prisma.PetitionSelect;

interface Facts {
  id: string;
  status: string;
  deadline: Date | null;
  procFlow: {
    alertDueAt: Date | null;
    alertRedFrom: Date | null;
    alertYellowFrom: Date | null;
    alertGreenFrom: Date | null;
    steps: Array<{ internalDueAt: Date | null; redFrom: Date | null; yellowFrom: Date | null; greenFrom: Date | null; step: { name: string } }>;
  } | null;
}

/**
 * The alert column of the three lists (petitions, incidents, cases): the colour of each row, a filter by colour and an
 * order by urgency. Everything is read from STORED instants: the four alert columns of the record's flow, or the
 * record's own `deadline` when it has no flow, so a filter or an order is an indexed comparison and a page costs one
 * extra query whatever its length.
 *
 *   A record WITH a flow     the worst colour among its steps being worked (`FLOW`); none when no step counts.
 *   A record WITHOUT a flow  its own deadline, a calendar day: overdue after that day, RED on the day, YELLOW within the
 *                            system's warning threshold (`CANH_BAO_SAP_HAN`, the days the old reminder warns ahead)
 *                            (`RECORD_DEADLINE`); none without a deadline.
 *   A record that is finished or suspended has no alert, whatever its flow says (the row's own status decides, so the
 *   list never waits for the worker that reconciles the stored alert).
 *
 * While the switch `processing_flow_records` is OFF, `clock` answers `null` and the lists do nothing new at all. The
 * switch and the threshold are read in the background, never by a request.
 */
@Injectable()
export class RecordListAlertService implements OnModuleInit {
  private readonly logger = new Logger(RecordListAlertService.name);
  private recordsOn = false;
  private warnDays = DEFAULT_WARN_DAYS;
  /** The clock, replaceable by a spec. */
  now: () => Date = () => new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refresh().catch((error: unknown) => this.logger.warn(`Reading the switch failed: ${String(error)}`));
  }

  @Interval(10_000)
  async tick(): Promise<void> {
    await this.refresh().catch((error: unknown) => this.logger.warn(`Reading the switch failed: ${String(error)}`));
  }

  /** Reads the switch and the warning threshold (outside any request) and remembers them. */
  async refresh(): Promise<boolean> {
    this.recordsOn = await this.flags.isEnabled(RECORDS_SWITCH);
    if (this.recordsOn) {
      const setting = await this.prisma.systemSetting.findUnique({ where: { key: SETTINGS_KEY.CANH_BAO_SAP_HAN }, select: { value: true } });
      const days = Number.parseInt(setting?.value ?? '', 10);
      this.warnDays = Number.isInteger(days) && days >= 0 && days <= MAX_WARN_DAYS ? days : DEFAULT_WARN_DAYS;
    }
    return this.recordsOn;
  }

  /** The thresholds of a record's own deadline: red on the day itself, yellow within the warning days, no green band. */
  thresholds(): Thresholds {
    return { redDays: 0, yellowDays: this.warnDays, greenDays: this.warnDays };
  }

  /**
   * The instant the alerts of one request are judged at, or `null` while the switch is off (the caller then does
   * nothing). `asOf`: the instant an earlier answer was judged at, passed back by the screen.
   */
  clock(asOf?: string): Date | null {
    if (!this.recordsOn) return null;
    const at = asOf ? new Date(asOf) : this.now();
    return Number.isNaN(at.getTime()) ? this.now() : at;
  }

  /**
   * Whether a list asked for `sortBy` is ordered by alert: only that value, and only while the switch is on. The list
   * and every export of it ask HERE, so a sheet comes out in the order of the screen it was exported from.
   */
  sortsByAlert(sortBy: string | undefined): boolean {
    return this.recordsOn && sortBy === ALERT_SORT;
  }

  /** The records of a kind whose alert is in `band` at `at`: a condition for the list's own `where`. */
  where(kind: RecordKind, band: Band, at: Date): Record<string, unknown> {
    const day = deadlineDayWhere(band, at, this.thresholds());
    const sources: Record<string, unknown>[] = [{ procFlow: { is: bandConditions(band, at).flow } }];
    if (day) sources.push({ procFlow: { is: null }, deadline: day });
    return { AND: [{ status: { notIn: clocklessStatuses(kind) } }, { OR: sources }] };
  }

  /**
   * The order of a list by urgency: the earliest alert deadline first when `asc` (the latest first when `desc`), records
   * with a flow before records without one, those by their own deadline, and the id last so that pages are stable.
   */
  orderBy(order: 'asc' | 'desc'): Record<string, unknown>[] {
    return [{ procFlow: { alertDueAt: { sort: order, nulls: 'last' } } }, { deadline: { sort: order, nulls: 'last' } }, { id: 'asc' }];
  }

  /**
   * The alert of each record of a page, by id (`null`: no alert). ONE query. `visible`: a condition the record must
   * also meet for its deadline to be shown to this reader (the field policy of a case); a record that does not meet it
   * has no alert.
   */
  async forRecords(kind: RecordKind, ids: readonly string[], at: Date, visible?: Record<string, unknown>): Promise<Map<string, RecordAlert | null>> {
    const alerts = new Map<string, RecordAlert | null>(ids.map((id) => [id, null]));
    if (ids.length === 0) return alerts;
    const where = { AND: [{ id: { in: [...ids] } }, visible ?? {}] };
    let facts: Facts[];
    if (kind === 'PETITION') facts = await this.prisma.petition.findMany({ where, select: FACTS });
    else if (kind === 'INCIDENT') facts = await this.prisma.incident.findMany({ where, select: FACTS });
    else facts = await this.prisma.case.findMany({ where, select: FACTS });

    const clockless = new Set(clocklessStatuses(kind));
    for (const row of facts) alerts.set(row.id, clockless.has(row.status) ? null : this.alertOf(row, at));
    return alerts;
  }

  /** The rows of a page with their `alert`. */
  async decorate<T extends { id: string }>(kind: RecordKind, rows: readonly T[], at: Date, visible?: Record<string, unknown>): Promise<Array<T & { alert: RecordAlert | null }>> {
    const alerts = await this.forRecords(kind, rows.map((row) => row.id), at, visible);
    return rows.map((row) => ({ ...row, alert: alerts.get(row.id) ?? null }));
  }

  private alertOf(row: Facts, at: Date): RecordAlert | null {
    const flow = row.procFlow;
    if (!flow) {
      if (!row.deadline) return null;
      const dueAt = endOfCivilDay(civilDayOf(row.deadline));
      return { source: ALERT_SOURCE.RECORD_DEADLINE, band: deadlineDayBand(at, row.deadline, this.thresholds()), remainingDays: remainingDays(at, dueAt), stepName: null, dueAt: dueAt.toISOString() };
    }
    if (!flow.alertDueAt || !flow.alertRedFrom || !flow.alertYellowFrom || !flow.alertGreenFrom) return null;
    // The colour comes from the stored alert: the very columns the filter compares, so a row found by a band shows it.
    const band = bandAt(at, { dueAt: flow.alertDueAt, redFrom: flow.alertRedFrom, yellowFrom: flow.alertYellowFrom, greenFrom: flow.alertGreenFrom });
    // The step that gives the record this colour: among the steps in that band, the one due first.
    let worst: { name: string; dueAt: Date } | null = null;
    for (const step of flow.steps) {
      if (!step.internalDueAt || !step.redFrom || !step.yellowFrom || !step.greenFrom) continue;
      if (bandAt(at, { dueAt: step.internalDueAt, redFrom: step.redFrom, yellowFrom: step.yellowFrom, greenFrom: step.greenFrom }) !== band) continue;
      if (!worst || step.internalDueAt.getTime() < worst.dueAt.getTime()) worst = { name: step.step.name, dueAt: step.internalDueAt };
    }
    const dueAt = worst?.dueAt ?? flow.alertDueAt;
    return { source: ALERT_SOURCE.FLOW, band, remainingDays: remainingDays(at, dueAt), stepName: worst?.name ?? null, dueAt: dueAt.toISOString() };
  }
}
