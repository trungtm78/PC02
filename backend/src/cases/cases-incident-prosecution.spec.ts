import {ordinaryCaseAuthorityFixture,ordinaryCaseActorFixture,ordinaryCaseParentFixture} from './governance/case-ordinary-test.fixture';
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers return any. */
import { CasesService } from './cases.service';
import { CaseProvenance, IncidentStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ordinarySourceFixture } from '../case-child-access/test-source-creation-fixture';

describe('AR-01: Case form follows incident prosecution contract', () => {
  const source = {
    id: 'incident1',
    status: IncidentStatus.DANG_XAC_MINH,
    intakeStage: 'DA_NHAN',
    updatedAt: new Date('2026-10-01'),
    linkedCaseId: null,
    description: 'Full source',
    ngayDeXuat: new Date('2026-09-01'),
    deadline: new Date('2026-10-20'),
  };
  const tx = {...ordinaryCaseAuthorityFixture(),
    incident: { findFirst: jest.fn(), update: jest.fn() },
    case: { create: jest.fn() },
    incidentStatusHistory: { create: jest.fn() },
    documentNumberLog: { update: jest.fn() },
  };
  const db = {...ordinaryCaseAuthorityFixture(),
    case: { findMany: jest.fn().mockResolvedValue([]) },
    incident: tx.incident,
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const audit = { log: jest.fn() };
  const docNums = {
    commitWithTx: jest
      .fn()
      .mockResolvedValue({ number: 'CASE-UAT', logId: 'log-UAT' }),
  };
  const service = new CasesService(
    db as never,
    audit as never,
    {} as never,
    docNums as never,
    new EventEmitter2(),
    ordinarySourceFixture(db),
  );
  const input = {
    name: 'New case',
    caseCode: 'CASE-UAT',
    caseProvenance: CaseProvenance.FROM_INCIDENT,
    linkedIncidentId: source.id,
    expectedIncidentUpdatedAt: source.updatedAt.toISOString(),
    soQuyetDinhKhoiTo: 'QD-UAT',
    ngayKhoiTo: '2026-10-06',
  };
  beforeEach(() => {
    jest.clearAllMocks();
    tx.incident.findFirst.mockResolvedValue(source);
    tx.case.create.mockResolvedValue({
      id: 'case1',
      name: input.name,
      status: 'TIEP_NHAN',
      caseCode: input.caseCode,
    });
  });
  it('A03: restored received source can prosecute directly through Case form', async () => {
    tx.incident.findFirst.mockResolvedValue({
      ...source,
      status: IncidentStatus.PHUC_HOI_NGUON_TIN,
    });
    await service.create(input, 'actor');
    expect(tx.incidentStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: IncidentStatus.PHUC_HOI_NGUON_TIN,
          toStatus: IncidentStatus.DA_CHUYEN_VU_AN,
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INCIDENT_PROSECUTED' }),
      tx,
    );
  });
  it.each(['PHAN_LOAI', 'CHO_NHAN'])(
    'rejects intake source %s',
    async (intakeStage) => {
      tx.incident.findFirst.mockResolvedValue({ ...source, intakeStage });
      await expect(service.create(input, 'actor')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.case.create).not.toHaveBeenCalled();
    },
  );
  it('rejects source with ineligible legal status', async () => {
    tx.incident.findFirst.mockResolvedValue({
      ...source,
      status: IncidentStatus.TIEP_NHAN,
    });
    await expect(service.create(input, 'actor')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('rejects missing decision before linking', async () => {
    await expect(
      service.create({ ...input, soQuyetDinhKhoiTo: '' }, 'actor'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('eligible source closes incident/history and snapshots source within transaction', async () => {
    await service.create(input, 'actor');
    expect(tx.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IncidentStatus.DA_CHUYEN_VU_AN,
          linkedCaseId: 'case1',
        }),
      }),
    );
    expect(tx.incidentStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          toStatus: IncidentStatus.DA_CHUYEN_VU_AN,
          changedById: 'actor',
        }),
      }),
    );
    expect(tx.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          moTaChiTiet: source.description,
          metadata: expect.objectContaining({
            incidentSourceSnapshot: expect.objectContaining({ id: source.id }),
          }),
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INCIDENT_PROSECUTED' }),
      tx,
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CASE_CREATED' }),
      tx,
    );
  });
  it('release: undefined Case fields preserve source contacts, dates and intake unit', async () => {
    tx.incident.findFirst.mockResolvedValue({
      ...source,
      benVu: 'Synthetic contact',
      chuyenTuDonVi: 'Original source unit',
      cmndNguoiToGiac: 'TEST-ID',
      sdtNguoiToGiac: '0900000000',
      diaChiNguoiToGiac: 'Synthetic address',
      fromDate: new Date('2026-09-02'),
      donViGiaiQuyet: 'Receiving unit',
    });
    await service.create(input, 'actor');
    expect(tx.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenCungCap: 'Synthetic contact',
          nguonDon: 'Original source unit',
          cccdCungCap: 'TEST-ID',
          sdtCungCap: '0900000000',
          diaChiCungCap: 'Synthetic address',
          ngayDeXuat: source.ngayDeXuat,
          ngayXayRa: new Date('2026-09-02'),
          donViGiaiQuyet: 'Receiving unit',
        }),
      }),
    );
  });
});
