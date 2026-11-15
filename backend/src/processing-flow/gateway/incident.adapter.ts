import { Injectable, Optional } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordStepAccessService } from '../records/record-step-access.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { laKetThuc, laTamDinhChi } from '../../common/trang-thai/trang-thai-ket-thuc';
import { recordReadable } from '../../common/utils/scope-filter.util';
import { holdsReadPermission, requestScopeOf } from './read-access';
import {
  NO_ANCHOR,
  dayAnchor,
  type CanReadOptions,
  type GatewayUser,
  type Reader,
  type RecordAdapter,
  type RecordSnapshot,
} from './record-snapshot';

export const INCIDENT_SNAPSHOT_SELECT = {
  id: true,
  code: true,
  loaiThongTin: true,
  assignedTeamId: true,
  investigatorId: true,
  status: true,
  deadline: true,
  ngayTiepNhanNguonTin: true,
  ngayDeXuat: true,
  ngayGiaoDonViGiaiQuyet: true,
} satisfies Prisma.IncidentSelect;

export type IncidentSnapshotRow = Prisma.IncidentGetPayload<{ select: typeof INCIDENT_SNAPSHOT_SELECT }>;

export function incidentSnapshot(row: IncidentSnapshotRow): RecordSnapshot {
  return {
    kind: 'INCIDENT',
    id: row.id,
    code: row.code,
    informationType: row.loaiThongTin,
    assignedTeamId: row.assignedTeamId,
    ownerUserId: row.investigatorId,
    status: row.status,
    isFinished: laKetThuc('incident', row.status),
    isSuspended: laTamDinhChi('incident', row.status),
    deadline: row.deadline,
    anchors: {
      RECEIVED: dayAnchor(row.ngayTiepNhanNguonTin),
      PROPOSED: dayAnchor(row.ngayDeXuat),
      ASSIGNED_TO_UNIT: dayAnchor(row.ngayGiaoDonViGiaiQuyet),
      // "Ngày thụ lý": an incident has no such column. Looked for `ngayThuLy` / `thu_ly`; the candidates mean
      // something else (`ngayQDPhanCongNguonTin`: the date of the assignment decision; `IncidentHandoff.receivedAt`:
      // another unit confirming it received the file).
      ACCEPTED: NO_ANCHOR,
      // Prosecuting an incident creates a case; the date of that decision lives on the case (`Case.ngayKhoiTo`).
      PROSECUTED: NO_ANCHOR,
      // Hand-over minutes belong to a case.
      MINUTES_RECEIVED: NO_ANCHOR,
    },
    conditions: {},
  };
}

@Injectable()
export class IncidentAdapter implements RecordAdapter {
  readonly kind = 'INCIDENT' as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: UnitScopeService,
    @Optional() private readonly stepAccess?: RecordStepAccessService,
  ) {}

  async load(id: string, tx: Reader = this.prisma): Promise<RecordSnapshot | null> {
    const row = await tx.incident.findFirst({ where: { id, deletedAt: null }, select: INCIDENT_SNAPSHOT_SELECT });
    return row ? incidentSnapshot(row) : null;
  }

  async writeDeadline(id: string, at: Date, tx: Prisma.TransactionClient): Promise<void> {
    await tx.incident.update({ where: { id }, data: { deadline: at } });
  }

  /** `GET /incidents/:id`: the guard's `read:Incident`, then `IncidentsService.getById` (exists, within the scope). */
  async canRead(id: string, user: GatewayUser, options?: CanReadOptions): Promise<boolean> {
    if (!(await holdsReadPermission(this.prisma, user.id, 'Incident'))) return false;
    const row = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
      select: { assignedTeamId: true, investigatorId: true },
    });
    if (!row) return false;
    if (recordReadable('Incident', row, await requestScopeOf(this.scopes, user))) return true;
    // Not in the reader's scope: a step being worked on the record may still hand it to their unit (read-only).
    if (!options?.viaStep) return false;
    return (await this.stepAccess?.mayOpen('INCIDENT', id, user.id)) ?? false;
  }
}
