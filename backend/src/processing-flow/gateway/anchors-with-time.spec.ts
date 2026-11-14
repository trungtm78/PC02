import { caseSnapshot, type CaseSnapshotRow } from './case.adapter';
import { incidentSnapshot, type IncidentSnapshotRow } from './incident.adapter';
import { petitionSnapshot, type PetitionSnapshotRow } from './petition.adapter';
import { ANCHOR_KEYS, ANCHORS_WITH_TIME, RECORD_KINDS, type RecordSnapshot } from './record-snapshot';

/**
 * `ANCHORS_WITH_TIME` is what the flow configuration reads to refuse a duration in hours on a date that has no time of
 * day. It must say what the adapters really do: each one is fed a row in which EVERY column is filled (dates, and a
 * time wherever a column could be one), and the anchors that come out with a time are compared with the list.
 */
const DAY = new Date('2026-03-02T00:00:00.000Z');

/** Every column the select asks for, filled: a date for a date, "09:30" for anything that could be a time of day. */
function filledRow<T>(row: Record<string, unknown>): T {
  return row as T;
}

const withTime = (snapshot: RecordSnapshot) => ANCHOR_KEYS.filter((key) => snapshot.anchors[key].hasTime);

describe('which anchors carry a time of day', () => {
  it('a petition: only the date it was received (with the declared time)', () => {
    const snapshot = petitionSnapshot(
      filledRow<PetitionSnapshotRow>({
        id: 'p',
        stt: '2026-00001',
        loaiThongTin: 'Tố cáo',
        assignedTeamId: null,
        assignedToId: null,
        status: 'MOI_TIEP_NHAN',
        deadline: DAY,
        receivedDate: DAY,
        gioTiepNhan: '09:30',
        ngayDeXuat: DAY,
        ngayGiaoDonViGiaiQuyet: DAY,
      }),
    );
    expect(withTime(snapshot)).toEqual([...ANCHORS_WITH_TIME.PETITION]);
    expect(ANCHORS_WITH_TIME.PETITION).toEqual(['RECEIVED']);
  });

  it('an incident: none', () => {
    const snapshot = incidentSnapshot(
      filledRow<IncidentSnapshotRow>({
        id: 'i',
        code: 'VV-1',
        loaiThongTin: 'Tố giác',
        assignedTeamId: null,
        investigatorId: null,
        status: 'TIEP_NHAN',
        deadline: DAY,
        ngayTiepNhanNguonTin: DAY,
        ngayDeXuat: DAY,
        ngayGiaoDonViGiaiQuyet: DAY,
        gioTiepNhan: '09:30',
      }),
    );
    expect(withTime(snapshot)).toEqual([...ANCHORS_WITH_TIME.INCIDENT]);
    expect(ANCHORS_WITH_TIME.INCIDENT).toEqual([]);
  });

  it('a case: none', () => {
    const snapshot = caseSnapshot(
      filledRow<CaseSnapshotRow>({
        id: 'c',
        caseCode: 'VA-1',
        loaiThongTin: 'Vụ án',
        assignedTeamId: null,
        investigatorId: null,
        status: 'DANG_DIEU_TRA',
        deadline: DAY,
        receiveDate: DAY,
        ngayTiepNhan: DAY,
        ngayDeXuat: DAY,
        ngayGiaoDonViGiaiQuyet: DAY,
        ngayKhoiTo: DAY,
        gioTiepNhan: '09:30',
      }),
    );
    expect(withTime(snapshot)).toEqual([...ANCHORS_WITH_TIME.CASE]);
    expect(ANCHORS_WITH_TIME.CASE).toEqual([]);
  });

  it('the list covers every record kind', () => {
    expect(Object.keys(ANCHORS_WITH_TIME).sort()).toEqual([...RECORD_KINDS].sort());
  });
});
