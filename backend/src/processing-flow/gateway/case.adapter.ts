import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { Case, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordStepAccessService } from '../records/record-step-access.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { CaseGovernanceService } from '../../cases/governance/case-governance.service';
import { laKetThuc, laTamDinhChi } from '../../common/trang-thai/trang-thai-ket-thuc';
import { recordReadable } from '../../common/utils/scope-filter.util';
import { requestScopeOf } from './read-access';
import {
  NO_ANCHOR,
  dayAnchor,
  type CanReadOptions,
  type GatewayUser,
  type Reader,
  type RecordAdapter,
  type RecordSnapshot,
} from './record-snapshot';

export const CASE_SNAPSHOT_SELECT = {
  id: true,
  caseCode: true,
  loaiThongTin: true,
  assignedTeamId: true,
  investigatorId: true,
  status: true,
  deadline: true,
  ngayTiepNhan: true,
  receiveDate: true,
  ngayDeXuat: true,
  ngayGiaoDonViGiaiQuyet: true,
  ngayKhoiTo: true,
  capDoToiPham: true,
} satisfies Prisma.CaseSelect;

export type CaseSnapshotRow = Prisma.CaseGetPayload<{ select: typeof CASE_SNAPSHOT_SELECT }>;

export function caseSnapshot(row: CaseSnapshotRow): RecordSnapshot {
  return {
    kind: 'CASE',
    id: row.id,
    code: row.caseCode,
    informationType: row.loaiThongTin,
    assignedTeamId: row.assignedTeamId,
    ownerUserId: row.investigatorId,
    status: row.status,
    isFinished: laKetThuc('case', row.status),
    isSuspended: laTamDinhChi('case', row.status),
    deadline: row.deadline,
    anchors: {
      // Two columns say "received". The schema documents `receiveDate` as the day the case was received and
      // `ngayTiepNhan` as the date on the hand-over minutes: the received day first, the minutes only when it is empty.
      RECEIVED: dayAnchor(row.receiveDate ?? row.ngayTiepNhan),
      PROPOSED: dayAnchor(row.ngayDeXuat),
      ASSIGNED_TO_UNIT: dayAnchor(row.ngayGiaoDonViGiaiQuyet),
      // "Ngày thụ lý": a case has no such column. Looked for `ngayThuLy` / `thu_ly`; `soHoSoCu` is the old system's
      // acceptance NUMBER, and `CaseStatistic.ngayPhanCongGiaiQuyetToGiac` is a statistics date of another table.
      ACCEPTED: NO_ANCHOR,
      PROSECUTED: dayAnchor(row.ngayKhoiTo),
      // The date on the hand-over minutes itself, never replaced by the received day.
      MINUTES_RECEIVED: dayAnchor(row.ngayTiepNhan),
    },
    conditions: row.capDoToiPham ? { CRIME_GRAVITY: row.capDoToiPham } : {},
  };
}

@Injectable()
export class CaseAdapter implements RecordAdapter {
  readonly kind = 'CASE' as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: UnitScopeService,
    @Optional() private readonly stepAccess?: RecordStepAccessService,
  ) {}

  async load(id: string, tx: Reader = this.prisma): Promise<RecordSnapshot | null> {
    const row = await tx.case.findFirst({ where: { id, deletedAt: null }, select: CASE_SNAPSHOT_SELECT });
    return row ? caseSnapshot(row) : null;
  }

  /**
   * `GET /cases/:id` (`CasesService.getById` with the actor): the case governance policy first (active actor,
   * `read:Case`, representation, the actor's own scope, sensitivity), then the scope the request carries.
   */
  async writeDeadline(id: string, at: Date, tx: Prisma.TransactionClient): Promise<void> {
    await tx.case.update({ where: { id }, data: { deadline: at } });
  }

  async canRead(id: string, user: GatewayUser, options?: CanReadOptions): Promise<boolean> {
    let record: Case;
    try {
      // Built by hand exactly as `CasesService` does: it holds no state, and asks the process's enforcement itself.
      record = await new CaseGovernanceService(this.prisma).assertCaseReadable(this.prisma, id, { actorId: user.id }, undefined, {
        // Only for a route that reads: a write keeps the case's own scope check.
        stepAssignee: async () => (options?.viaStep ? ((await this.stepAccess?.mayOpen('CASE', id, user.id)) ?? false) : false),
      });
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) return false;
      throw error;
    }
    if (recordReadable('Case', record, await requestScopeOf(this.scopes, user))) return true;
    // Not in the reader's scope: a step being worked on the case may still hand it to their unit (read-only).
    if (!options?.viaStep) return false;
    return (await this.stepAccess?.mayOpen('CASE', id, user.id)) ?? false;
  }
}
