import { CaseStatus, IncidentStatus, PetitionStatus } from '@prisma/client';
import { TRANG_THAI_KET_THUC, TRANG_THAI_TAM_DINH_CHI } from '../../common/trang-thai/trang-thai-ket-thuc';
import { caseSnapshot, type CaseSnapshotRow } from './case.adapter';
import { incidentSnapshot, type IncidentSnapshotRow } from './incident.adapter';
import { petitionSnapshot, type PetitionSnapshotRow } from './petition.adapter';
import { RecordGateway } from './record-gateway';
import { ANCHOR_KEYS, dayAnchor, dayWithVietnamTime, type RecordAdapter } from './record-snapshot';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const petitionRow = (over: Partial<PetitionSnapshotRow> = {}): PetitionSnapshotRow => ({
  id: 'p1',
  stt: '2026-11973',
  loaiThongTin: 'Tố cáo',
  assignedTeamId: 'team-1',
  assignedToId: 'user-1',
  status: PetitionStatus.DANG_XU_LY,
  deadline: day('2026-02-04'),
  receivedDate: day('2026-01-05'),
  gioTiepNhan: null,
  ngayDeXuat: null,
  ngayGiaoDonViGiaiQuyet: null,
  ...over,
});

const incidentRow = (over: Partial<IncidentSnapshotRow> = {}): IncidentSnapshotRow => ({
  id: 'i1',
  code: '2026-9705',
  loaiThongTin: 'Tố giác',
  assignedTeamId: 'team-1',
  investigatorId: 'user-1',
  status: IncidentStatus.DANG_XAC_MINH,
  deadline: null,
  ngayTiepNhanNguonTin: null,
  ngayDeXuat: null,
  ngayGiaoDonViGiaiQuyet: null,
  ...over,
});

const caseRow = (over: Partial<CaseSnapshotRow> = {}): CaseSnapshotRow => ({
  id: 'c1',
  caseCode: '2026-9893',
  loaiThongTin: null,
  assignedTeamId: null,
  investigatorId: null,
  status: CaseStatus.DANG_DIEU_TRA,
  deadline: null,
  ngayTiepNhan: null,
  receiveDate: null,
  ngayDeXuat: null,
  ngayGiaoDonViGiaiQuyet: null,
  ngayKhoiTo: null,
  capDoToiPham: null,
  ...over,
});

describe('the anchors of a record', () => {
  it('the dates read from a record, in a fixed order', () => {
    expect([...ANCHOR_KEYS]).toEqual(['RECEIVED', 'PROPOSED', 'ASSIGNED_TO_UNIT', 'ACCEPTED', 'PROSECUTED', 'MINUTES_RECEIVED']);
  });

  it.each([
    ['a petition', () => petitionSnapshot(petitionRow())],
    ['an incident', () => incidentSnapshot(incidentRow())],
    ['a case', () => caseSnapshot(caseRow())],
  ])('%s answers every anchor key and no other', (_name, snapshot) => {
    expect(Object.keys(snapshot().anchors).sort()).toEqual([...ANCHOR_KEYS].sort());
  });

  it('a date column is a calendar day: the stored instant, and no time of day', () => {
    expect(dayAnchor(day('2026-01-05'))).toEqual({ at: day('2026-01-05'), hasTime: false });
  });

  it('a missing date is an empty anchor, never today', () => {
    expect(dayAnchor(null)).toEqual({ at: null, hasTime: false });
    expect(dayAnchor(undefined)).toEqual({ at: null, hasTime: false });
    expect(dayWithVietnamTime(null, '09:30')).toEqual({ at: null, hasTime: false });
  });

  it('a day with a declared time is that time in Vietnam (UTC+7) on that day', () => {
    expect(dayWithVietnamTime(day('2026-01-05'), '09:30')).toEqual({ at: new Date('2026-01-05T02:30:00.000Z'), hasTime: true });
  });

  it('a time before 07:00 in Vietnam falls on the previous day in UTC, and is still the declared day in Vietnam', () => {
    expect(dayWithVietnamTime(day('2026-01-05'), '00:15')).toEqual({ at: new Date('2026-01-04T17:15:00.000Z'), hasTime: true });
  });

  it.each([null, undefined, '', '9:30', '24:00', '09:60', 'abc'])('a time that is not HH:mm (%p) leaves the day alone', (time) => {
    expect(dayWithVietnamTime(day('2026-01-05'), time)).toEqual({ at: day('2026-01-05'), hasTime: false });
  });
});

describe('a petition as a record', () => {
  it('carries its number, information type, team, assignee, status and deadline', () => {
    expect(petitionSnapshot(petitionRow())).toMatchObject({
      kind: 'PETITION',
      id: 'p1',
      code: '2026-11973',
      informationType: 'Tố cáo',
      assignedTeamId: 'team-1',
      ownerUserId: 'user-1',
      status: 'DANG_XU_LY',
      isFinished: false,
      isSuspended: false,
      deadline: day('2026-02-04'),
    });
  });

  it('received = the received date, a day only when no time was declared', () => {
    expect(petitionSnapshot(petitionRow()).anchors.RECEIVED).toEqual({ at: day('2026-01-05'), hasTime: false });
  });

  it('received = the received date at the declared time when one was declared', () => {
    expect(petitionSnapshot(petitionRow({ gioTiepNhan: '14:05' })).anchors.RECEIVED).toEqual({
      at: new Date('2026-01-05T07:05:00.000Z'),
      hasTime: true,
    });
  });

  it('proposed and assigned-to-unit come from their own columns; accepted and prosecuted do not exist', () => {
    const { anchors } = petitionSnapshot(petitionRow({ ngayDeXuat: day('2026-01-06'), ngayGiaoDonViGiaiQuyet: day('2026-01-07') }));
    expect(anchors.PROPOSED).toEqual({ at: day('2026-01-06'), hasTime: false });
    expect(anchors.ASSIGNED_TO_UNIT).toEqual({ at: day('2026-01-07'), hasTime: false });
    expect(anchors.ACCEPTED).toEqual({ at: null, hasTime: false });
    expect(anchors.PROSECUTED).toEqual({ at: null, hasTime: false });
  });

  it('minutes-received does not exist for a petition, whatever its dates', () => {
    const { anchors } = petitionSnapshot(petitionRow({ gioTiepNhan: '09:30', ngayDeXuat: day('2026-01-06') }));
    expect(anchors.MINUTES_RECEIVED).toEqual({ at: null, hasTime: false });
  });

  it('a suspended petition is suspended and not finished', () => {
    expect(petitionSnapshot(petitionRow({ status: PetitionStatus.TAM_DINH_CHI }))).toMatchObject({ isFinished: false, isSuspended: true });
  });

  it('a resolved petition is finished and not suspended', () => {
    expect(petitionSnapshot(petitionRow({ status: PetitionStatus.DA_GIAI_QUYET }))).toMatchObject({ isFinished: true, isSuspended: false });
  });
});

describe('an incident as a record', () => {
  it('carries its code and its investigator as the owner', () => {
    expect(incidentSnapshot(incidentRow())).toMatchObject({ kind: 'INCIDENT', code: '2026-9705', ownerUserId: 'user-1', informationType: 'Tố giác' });
  });

  it('received = the date the source report was received, NOT the proposal date', () => {
    const { anchors } = incidentSnapshot(incidentRow({ ngayTiepNhanNguonTin: day('2026-01-02'), ngayDeXuat: day('2026-01-05') }));
    expect(anchors.RECEIVED).toEqual({ at: day('2026-01-02'), hasTime: false });
    expect(anchors.PROPOSED).toEqual({ at: day('2026-01-05'), hasTime: false });
  });

  it('with no dates entered every anchor is empty', () => {
    const { anchors } = incidentSnapshot(incidentRow());
    for (const key of ANCHOR_KEYS) expect(anchors[key]).toEqual({ at: null, hasTime: false });
  });

  it('minutes-received does not exist for an incident, whatever its dates', () => {
    const { anchors } = incidentSnapshot(incidentRow({ ngayTiepNhanNguonTin: day('2026-01-02'), ngayDeXuat: day('2026-01-05') }));
    expect(anchors.MINUTES_RECEIVED).toEqual({ at: null, hasTime: false });
  });

  it('assigned-to-unit comes from its own column', () => {
    expect(incidentSnapshot(incidentRow({ ngayGiaoDonViGiaiQuyet: day('2026-01-09') })).anchors.ASSIGNED_TO_UNIT.at).toEqual(day('2026-01-09'));
  });

  it('suspended is suspended; "suspended, limitation expired" is an outcome: finished, not suspended', () => {
    expect(incidentSnapshot(incidentRow({ status: IncidentStatus.TAM_DINH_CHI }))).toMatchObject({ isFinished: false, isSuspended: true });
    expect(incidentSnapshot(incidentRow({ status: IncidentStatus.TDC_HET_THOI_HIEU }))).toMatchObject({ isFinished: true, isSuspended: false });
  });
});

describe('a case as a record', () => {
  it('received = the day the case was received, even when the hand-over minutes carry another date', () => {
    const { anchors } = caseSnapshot(caseRow({ ngayTiepNhan: day('2026-01-03'), receiveDate: day('2026-01-08') }));
    expect(anchors.RECEIVED).toEqual({ at: day('2026-01-08'), hasTime: false });
  });

  it('received falls back to the date on the hand-over minutes when no received day was entered', () => {
    expect(caseSnapshot(caseRow({ ngayTiepNhan: day('2026-01-03') })).anchors.RECEIVED).toEqual({ at: day('2026-01-03'), hasTime: false });
  });

  it('with neither date the received anchor is empty', () => {
    expect(caseSnapshot(caseRow()).anchors.RECEIVED).toEqual({ at: null, hasTime: false });
  });

  it('minutes-received = the date on the hand-over minutes, and only that: the received day never stands in for it', () => {
    const both = caseSnapshot(caseRow({ ngayTiepNhan: day('2026-01-03'), receiveDate: day('2026-01-08') }));
    expect(both.anchors.MINUTES_RECEIVED).toEqual({ at: day('2026-01-03'), hasTime: false });
    expect(caseSnapshot(caseRow({ receiveDate: day('2026-01-08') })).anchors.MINUTES_RECEIVED).toEqual({ at: null, hasTime: false });
  });

  it('prosecuted = the date of the prosecution decision; accepted does not exist', () => {
    const { anchors } = caseSnapshot(caseRow({ ngayKhoiTo: day('2026-02-01'), ngayDeXuat: day('2026-01-10'), ngayGiaoDonViGiaiQuyet: day('2026-01-11') }));
    expect(anchors.PROSECUTED).toEqual({ at: day('2026-02-01'), hasTime: false });
    expect(anchors.PROPOSED.at).toEqual(day('2026-01-10'));
    expect(anchors.ASSIGNED_TO_UNIT.at).toEqual(day('2026-01-11'));
    expect(anchors.ACCEPTED).toEqual({ at: null, hasTime: false });
  });

  it('carries its case code and its investigator; a case without a code has none', () => {
    expect(caseSnapshot(caseRow({ investigatorId: 'user-9' }))).toMatchObject({ kind: 'CASE', code: '2026-9893', ownerUserId: 'user-9' });
    expect(caseSnapshot(caseRow({ caseCode: null })).code).toBeNull();
  });

  it('a suspended case is suspended and not finished; a concluded case is finished', () => {
    expect(caseSnapshot(caseRow({ status: CaseStatus.TAM_DINH_CHI }))).toMatchObject({ isFinished: false, isSuspended: true });
    expect(caseSnapshot(caseRow({ status: CaseStatus.DA_KET_LUAN }))).toMatchObject({ isFinished: true, isSuspended: false });
  });
});

describe('suspended and finished never overlap', () => {
  it.each(['case', 'incident', 'petition'] as const)('%s: no status is both', (kind) => {
    const finished = new Set<string>(TRANG_THAI_KET_THUC[kind]);
    expect(TRANG_THAI_TAM_DINH_CHI[kind].length).toBeGreaterThan(0);
    expect(TRANG_THAI_TAM_DINH_CHI[kind].filter((status) => finished.has(status))).toEqual([]);
  });
});

describe('the gateway chooses the adapter by kind', () => {
  const adapter = (kind: RecordAdapter['kind']) => ({
    kind,
    load: jest.fn().mockResolvedValue(null),
    canRead: jest.fn().mockResolvedValue(kind === 'INCIDENT'),
  });

  it('load and canRead go to the adapter of that kind and to no other, with the transaction handed on', async () => {
    const petitions = adapter('PETITION');
    const incidents = adapter('INCIDENT');
    const cases = adapter('CASE');
    const gateway = new RecordGateway(petitions as never, incidents as never, cases as never);
    const tx = { marker: 'tx' } as never;
    const user = { id: 'u', role: 'OFFICER' };

    await gateway.load('CASE', 'c1', tx);
    expect(cases.load).toHaveBeenCalledWith('c1', tx);
    expect(petitions.load).not.toHaveBeenCalled();
    expect(incidents.load).not.toHaveBeenCalled();

    expect(await gateway.canRead('INCIDENT', 'i1', user)).toBe(true);
    expect(await gateway.canRead('PETITION', 'p1', user)).toBe(false);
    expect(incidents.canRead).toHaveBeenCalledWith('i1', user);
    expect(petitions.canRead).toHaveBeenCalledWith('p1', user);
    expect(cases.canRead).not.toHaveBeenCalled();
  });
});

describe('the facts of a record that pick another duration', () => {
  it('a case carries the gravity of its crime; a case without one, a petition and an incident carry none', () => {
    expect(caseSnapshot(caseRow({ capDoToiPham: 'NGHIEM_TRONG' })).conditions).toEqual({ CRIME_GRAVITY: 'NGHIEM_TRONG' });
    expect(caseSnapshot(caseRow()).conditions).toEqual({});
    expect(petitionSnapshot(petitionRow()).conditions).toEqual({});
    expect(incidentSnapshot(incidentRow()).conditions).toEqual({});
  });
});
