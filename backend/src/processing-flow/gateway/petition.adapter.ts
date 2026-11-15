import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { laKetThuc, laTamDinhChi } from '../../common/trang-thai/trang-thai-ket-thuc';
import { recordReadable } from '../../common/utils/scope-filter.util';
import { holdsReadPermission, requestScopeOf } from './read-access';
import {
  NO_ANCHOR,
  dayAnchor,
  dayWithVietnamTime,
  type GatewayUser,
  type Reader,
  type RecordAdapter,
  type RecordSnapshot,
} from './record-snapshot';

export const PETITION_SNAPSHOT_SELECT = {
  id: true,
  stt: true,
  loaiThongTin: true,
  assignedTeamId: true,
  assignedToId: true,
  status: true,
  deadline: true,
  receivedDate: true,
  gioTiepNhan: true,
  ngayDeXuat: true,
  ngayGiaoDonViGiaiQuyet: true,
} satisfies Prisma.PetitionSelect;

export type PetitionSnapshotRow = Prisma.PetitionGetPayload<{ select: typeof PETITION_SNAPSHOT_SELECT }>;

export function petitionSnapshot(row: PetitionSnapshotRow): RecordSnapshot {
  return {
    kind: 'PETITION',
    id: row.id,
    code: row.stt,
    informationType: row.loaiThongTin,
    assignedTeamId: row.assignedTeamId,
    // The assignee works the petition. (Who ENTERED it, `enteredById`, is what the read scope measures: see canRead.)
    ownerUserId: row.assignedToId,
    status: row.status,
    isFinished: laKetThuc('petition', row.status),
    isSuspended: laTamDinhChi('petition', row.status),
    deadline: row.deadline,
    anchors: {
      RECEIVED: dayWithVietnamTime(row.receivedDate, row.gioTiepNhan),
      PROPOSED: dayAnchor(row.ngayDeXuat),
      ASSIGNED_TO_UNIT: dayAnchor(row.ngayGiaoDonViGiaiQuyet),
      // "Ngày thụ lý": a petition has no such column. Looked for `ngayThuLy` / `thu_ly`; the nearest ones mean
      // something else (`ngayTiepNhanNguonTin`: received per the source-report minutes; `ngayQDPhanCongNguonTin`: the
      // date of the assignment decision).
      ACCEPTED: NO_ANCHOR,
      // A petition is not prosecuted; `ngayKhoiToBd` is a search shadow of the linked case, not a date of this record.
      PROSECUTED: NO_ANCHOR,
      // Hand-over minutes belong to a case.
      MINUTES_RECEIVED: NO_ANCHOR,
    },
    conditions: {},
  };
}

@Injectable()
export class PetitionAdapter implements RecordAdapter {
  readonly kind = 'PETITION' as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: UnitScopeService,
  ) {}

  async load(id: string, tx: Reader = this.prisma): Promise<RecordSnapshot | null> {
    const row = await tx.petition.findFirst({ where: { id, deletedAt: null }, select: PETITION_SNAPSHOT_SELECT });
    return row ? petitionSnapshot(row) : null;
  }

  async writeDeadline(id: string, at: Date, tx: Prisma.TransactionClient): Promise<void> {
    await tx.petition.update({ where: { id }, data: { deadline: at } });
  }

  /** `GET /petitions/:id`: the guard's `read:Petition`, then `PetitionsService.getById` (exists, within the scope). */
  async canRead(id: string, user: GatewayUser): Promise<boolean> {
    if (!(await holdsReadPermission(this.prisma, user.id, 'Petition'))) return false;
    const row = await this.prisma.petition.findFirst({
      where: { id, deletedAt: null },
      select: { assignedTeamId: true, enteredById: true },
    });
    if (!row) return false;
    return recordReadable('Petition', row, await requestScopeOf(this.scopes, user));
  }
}
